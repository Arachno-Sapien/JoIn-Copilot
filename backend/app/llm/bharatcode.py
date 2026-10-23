"""The one client for the BharatCode model API (https://bharatcode.ai/build).

Every model call in the backend ends here. It uses POST /responses with
store false, so each call resends its full context and nothing is kept on
BharatCode's side. The user's own key arrives per request from the extension
(the X-BharatCode-Key header, read in app.main) and is never stored or logged.
"""

import asyncio
import contextvars
import logging
from typing import Any

import httpx

BASE_URL = "https://bharatcode.ai/api/model/v1"
MODEL = "qwen-3.8-27b"
MAX_OUTPUT_TOKENS = 32000  # API maximum, reasoning included
BUSY_RETRY_DELAYS = (2, 4, 8)  # seconds to wait before each retry after a 503
KEY_HELP = (
    "Paste your BharatCode API key in the extension options. Get one at "
    "https://bharatcode.ai/account (free for students with an .ac.in or .edu.in email)."
)

logger = logging.getLogger("app.bharatcode")

# The user's key for the current request only.
request_key: contextvars.ContextVar[str | None] = contextvars.ContextVar("bharatcode_key", default=None)


class BharatCodeError(Exception):
    """A model call failed. str(error) and .detail are safe to show the user."""

    status_code = 502
    detail: str | None = None


class MissingKeyError(BharatCodeError):
    status_code = 401

    def __init__(self) -> None:
        super().__init__("BharatCode API key missing")
        self.detail = KEY_HELP


class KeyRejectedError(BharatCodeError):
    status_code = 401

    def __init__(self) -> None:
        super().__init__("BharatCode rejected the API key")
        self.detail = "Check the key in the extension options. " + KEY_HELP


class NoApiAccessError(BharatCodeError):
    """HTTP 402: the key is valid but its plan does not include API use."""

    status_code = 402

    def __init__(self, request_id: str | None) -> None:
        super().__init__(
            "Your BharatCode account has no API access yet. Students can verify an .ac.in or "
            ".edu.in email for free access at https://bharatcode.ai/account, or choose Lite or Pro there."
        )
        self.detail = f"Request id {request_id}." if request_id else None


class BusyError(BharatCodeError):
    status_code = 503

    def __init__(self, request_id: str | None) -> None:
        super().__init__("BharatCode is busy, try again")
        self.detail = f"Request id {request_id}." if request_id else None


class TruncatedError(BharatCodeError):
    """The answer hit the output limit. The partial text is kept but never parsed."""

    def __init__(self, partial_text: str, request_id: str | None) -> None:
        super().__init__("BharatCode's answer was cut off at the output limit, so it was not used")
        self.partial_text = partial_text
        self.detail = f"Partial output (not used): {partial_text[:1000]}"


class RequestFailedError(BharatCodeError):
    def __init__(self, message: str, request_id: str | None = None) -> None:
        super().__init__(message)
        self.detail = f"Request id {request_id}." if request_id else None


async def _sleep(seconds: float) -> None:
    await asyncio.sleep(seconds)


def _output_text(body: dict[str, Any]) -> str:
    return "".join(
        part.get("text", "")
        for item in body.get("output") or []
        if item.get("type") == "message"
        for part in item.get("content") or []
        if part.get("type") == "output_text"
    )


def _error_message(response: httpx.Response) -> str:
    try:
        error = response.json().get("error")
    except ValueError:
        return ""
    message = error.get("message") if isinstance(error, dict) else error
    return str(message)[:200] if message else ""


async def respond(
    *,
    instructions: str,
    user_input: str,
    schema_name: str,
    json_schema: dict[str, Any],
    max_output_tokens: int,
    effort: str | None,
) -> str:
    """Ask the model for JSON matching json_schema and return its text."""
    key = request_key.get()
    if not key:
        raise MissingKeyError()

    body: dict[str, Any] = {
        "model": MODEL,
        "store": False,
        "instructions": instructions,
        "input": user_input,
        "max_output_tokens": min(max_output_tokens, MAX_OUTPUT_TOKENS),
        "text": {
            "format": {
                "type": "json_schema",
                "name": schema_name,
                "schema": json_schema,
                "strict": False,
            }
        },
    }
    if effort:
        body["reasoning"] = {"effort": effort}

    headers = {"Authorization": f"Bearer {key}"}
    timeout = httpx.Timeout(180, connect=15)
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=timeout) as http:
        for attempt, delay in enumerate((*BUSY_RETRY_DELAYS, None), start=1):
            try:
                response = await http.post("/responses", json=body, headers=headers)
            except httpx.HTTPError as err:
                logger.warning("BharatCode unreachable: %s", type(err).__name__)
                raise RequestFailedError("Could not reach BharatCode, check your connection") from err

            request_id = response.headers.get("x-request-id")
            status_code = response.status_code
            if status_code == 503:
                logger.warning("BharatCode busy (503), attempt %d, x-request-id=%s", attempt, request_id)
                if delay is None:
                    raise BusyError(request_id)
                await _sleep(delay)
                continue
            if status_code in (401, 403):
                logger.warning("BharatCode rejected the key (%d), x-request-id=%s", status_code, request_id)
                raise KeyRejectedError()
            if status_code == 402:
                logger.warning("BharatCode plan has no API access (402), x-request-id=%s", request_id)
                raise NoApiAccessError(request_id)
            if status_code != 200:
                logger.warning("BharatCode returned %d, x-request-id=%s", status_code, request_id)
                message = _error_message(response)
                suffix = f": {message}" if message else ""
                raise RequestFailedError(
                    f"BharatCode request failed (HTTP {status_code}){suffix}", request_id
                )

            try:
                data = response.json()
            except ValueError as err:
                logger.warning("BharatCode sent a non-JSON reply, x-request-id=%s", request_id)
                raise RequestFailedError("BharatCode sent an unreadable reply", request_id) from err

            status = data.get("status")
            if status == "incomplete":
                reason = (data.get("incomplete_details") or {}).get("reason")
                logger.warning("BharatCode reply incomplete (%s), x-request-id=%s", reason, request_id)
                if reason == "max_output_tokens":
                    raise TruncatedError(_output_text(data), request_id)
                raise RequestFailedError(f"BharatCode's reply was incomplete ({reason})", request_id)
            if status not in (None, "completed"):
                logger.warning("BharatCode reply status %s, x-request-id=%s", status, request_id)
                raise RequestFailedError(f"BharatCode's reply {status}", request_id)
            return _output_text(data)

    raise AssertionError("unreachable")  # the loop always returns or raises
