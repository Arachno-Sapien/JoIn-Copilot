"""The one client for the model API: any OpenAI-compatible POST /chat/completions.

Every model call in the backend ends here. Each user picks the provider in the
extension options, and the extension sends the base URL, model and key with each
request (the X-LLM-Base-URL, X-LLM-Model and X-LLM-Key headers, read in app.main).
None of them is stored or logged. Set JC_LLM_BASE_URLS on a shared backend so it
only calls the providers you list.
"""

import asyncio
import contextvars
import ipaddress
import logging
import re
from typing import Any, NamedTuple
from urllib.parse import urlsplit

import httpx

from app.config import settings

BUSY_RETRY_DELAYS = (2, 4, 8)  # seconds to wait before each retry after a 429 or 503
SETUP_HELP = (
    "Open the extension options and set your AI provider: an OpenAI-compatible base URL, "
    "a model and, if the provider needs one, an API key."
)

logger = logging.getLogger("app.llm")


class Connection(NamedTuple):
    base_url: str | None = None
    model: str | None = None
    key: str | None = None


# The user's provider for the current request only.
request_connection: contextvars.ContextVar[Connection] = contextvars.ContextVar(
    "llm_connection", default=Connection()  # noqa: B039 - a NamedTuple is immutable
)


class ProviderError(Exception):
    """A model call failed. str(error) and .detail are safe to show the user."""

    status_code = 502
    detail: str | None = None


class NotConfiguredError(ProviderError):
    status_code = 401

    def __init__(self) -> None:
        super().__init__("No AI provider set up")
        self.detail = SETUP_HELP


class ProviderNotAllowedError(ProviderError):
    status_code = 403

    def __init__(self) -> None:
        super().__init__("This backend does not allow that AI provider URL")
        self.detail = (
            "Without JC_LLM_BASE_URLS the backend calls only https providers on the internet and "
            "providers on this computer. To use another one, add its base URL to JC_LLM_BASE_URLS."
        )


class KeyRejectedError(ProviderError):
    status_code = 401

    def __init__(self) -> None:
        super().__init__("The AI provider rejected the API key")
        self.detail = "Check the key in the extension options."


class BusyError(ProviderError):
    status_code = 503

    def __init__(self, request_id: str | None) -> None:
        super().__init__("The AI provider is busy or rate-limited, try again")
        self.detail = f"Request id {request_id}." if request_id else None


class TruncatedError(ProviderError):
    """The answer hit the output limit. The partial text is kept but never parsed."""

    def __init__(self, partial_text: str, request_id: str | None) -> None:
        super().__init__("The AI provider's answer was cut off at the output limit, so it was not used")
        self.partial_text = partial_text
        self.detail = f"Partial output (not used): {partial_text[:1000]}"


CODE_FENCE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL | re.IGNORECASE)


class RequestFailedError(ProviderError):
    def __init__(self, message: str, request_id: str | None = None) -> None:
        super().__init__(message)
        self.detail = f"Request id {request_id}." if request_id else None


# Names that mean the machine running the backend, for a local model server such as Ollama.
LOCAL_HOSTS = {"localhost", "host.docker.internal"}


def _url_key(url: str) -> tuple[str, str, int | None, str]:
    parts = urlsplit(url.strip())
    return parts.scheme.lower(), (parts.hostname or "").lower(), parts.port, parts.path.rstrip("/")


def _is_local(host: str) -> bool:
    if host in LOCAL_HOSTS:
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def _allowlist() -> set[tuple[str, str, int | None, str]]:
    return {_url_key(u) for u in settings.JC_LLM_BASE_URLS.split(",") if u.strip()}


def connection() -> Connection:
    """The current request's provider. Raises unless a base URL and model were sent.

    With JC_LLM_BASE_URLS set, only the URLs it lists are called. Without it, only https
    providers and providers on this computer are, and respond() also refuses host names
    that resolve to private addresses.
    """
    conn = request_connection.get()
    if not conn.base_url or not conn.model:
        raise NotConfiguredError()
    try:
        target = _url_key(conn.base_url)
    except ValueError as err:  # for example a port that is not a number
        raise ProviderNotAllowedError() from err
    scheme, host = target[0], target[1]
    allowed = _allowlist()
    if allowed:
        if target not in allowed:
            raise ProviderNotAllowedError()
    elif not host or scheme not in ("http", "https") or (scheme == "http" and not _is_local(host)):
        raise ProviderNotAllowedError()
    return conn


async def _resolve(host: str) -> list[str]:
    infos = await asyncio.get_running_loop().getaddrinfo(host, None)
    return [info[4][0] for info in infos]


async def _refuse_private_addresses(host: str) -> None:
    """Keeps a backend without an allowlist from calling into its own network."""
    if _is_local(host) or _allowlist():
        return
    try:
        addresses = await _resolve(host)
    except OSError:
        return  # A name that does not resolve cannot be reached either.
    # ponytail: httpx resolves the name again, so DNS rebinding can slip past this check;
    # a backend other people can reach must set JC_LLM_BASE_URLS (docs/guide/self-hosting.md).
    for address in addresses:
        ip = ipaddress.ip_address(address.split("%")[0])
        if not (ip.is_global or ip.is_loopback):
            raise ProviderNotAllowedError()


async def _sleep(seconds: float) -> None:
    await asyncio.sleep(seconds)


def _error_message(response: httpx.Response) -> str:
    try:
        error = response.json().get("error")
    except (ValueError, AttributeError):
        return ""
    message = error.get("message") if isinstance(error, dict) else error
    return str(message)[:200] if message else ""


async def respond(*, instructions: str, user_input: str, schema_name: str, json_schema: dict[str, Any]) -> str:
    """Ask the model for JSON matching json_schema and return its text."""
    conn = connection()
    await _refuse_private_addresses(_url_key(conn.base_url)[1])
    body: dict[str, Any] = {
        "model": conn.model,
        "messages": [
            {"role": "system", "content": instructions},
            {"role": "user", "content": user_input},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": schema_name, "schema": json_schema, "strict": False},
        },
    }
    headers = {"Authorization": f"Bearer {conn.key}"} if conn.key else {}
    # The provider sends nothing until the answer is done, and local models can be slow.
    timeout = httpx.Timeout(300, connect=15)
    async with httpx.AsyncClient(base_url=conn.base_url.rstrip("/"), timeout=timeout, follow_redirects=False) as http:
        for attempt, delay in enumerate((*BUSY_RETRY_DELAYS, None), start=1):
            try:
                response = await http.post("/chat/completions", json=body, headers=headers)
            except httpx.ReadTimeout as err:
                logger.warning("AI provider sent nothing for %ss", timeout.read)
                raise RequestFailedError("The AI provider took too long to answer, try again") from err
            except httpx.HTTPError as err:
                logger.warning("AI provider unreachable: %s", type(err).__name__)
                raise RequestFailedError("Could not reach the AI provider, check its base URL") from err

            request_id = response.headers.get("x-request-id")
            status_code = response.status_code
            if status_code in (429, 503):
                logger.warning("AI provider busy (%d), attempt %d, x-request-id=%s", status_code, attempt, request_id)
                if delay is None:
                    raise BusyError(request_id)
                await _sleep(delay)
                continue
            if status_code in (401, 403):
                logger.warning("AI provider rejected the key (%d), x-request-id=%s", status_code, request_id)
                raise KeyRejectedError()
            if status_code != 200:
                logger.warning("AI provider returned %d, x-request-id=%s", status_code, request_id)
                message = _error_message(response)
                suffix = f": {message}" if message else ""
                raise RequestFailedError(f"AI provider request failed (HTTP {status_code}){suffix}", request_id)

            try:
                choice = response.json()["choices"][0]
                text = choice["message"].get("content") or ""
            except (ValueError, KeyError, IndexError, TypeError, AttributeError) as err:
                logger.warning("AI provider reply had no choices, x-request-id=%s", request_id)
                raise RequestFailedError("The AI provider's reply was not a chat completion", request_id) from err
            if choice.get("finish_reason") == "length":
                logger.warning("AI provider reply cut off, x-request-id=%s", request_id)
                raise TruncatedError(text, request_id)
            if not text:
                logger.warning("AI provider reply empty (%s), x-request-id=%s", choice.get("finish_reason"), request_id)
                raise RequestFailedError("The AI provider sent an empty answer", request_id)
            # Some models wrap the JSON in a Markdown code fence despite the response format.
            return CODE_FENCE.sub(r"\1", text.strip())

    raise AssertionError("unreachable")  # the loop always returns or raises
