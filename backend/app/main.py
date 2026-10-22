import http
import logging
import time
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.draft import router as draft_router
from app.api.email import router as email_router
from app.api.extract import router as extract_router
from app.api.fill import router as fill_router
from app.api.health import router as health_router
from app.api.profile import router as profile_router
from app.api.scam import router as scam_router
from app.api.search import router as search_router
from app.config import settings
from app.llm.bharatcode import BharatCodeError, request_key
from app.schemas.common import ErrorResponse
from app.services.jobs.scheduler import get_job_scheduler

logger = logging.getLogger("app.request")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = get_job_scheduler()
    scheduler.start()
    yield
    scheduler.stop()


def error_response(status_code: int, detail: str | None = None, headers=None) -> JSONResponse:
    try:
        error = http.HTTPStatus(status_code).phrase
    except ValueError:
        error = "Error"
    body = ErrorResponse(error=error, detail=detail if detail != error else None)
    return JSONResponse(
        body.model_dump(exclude_none=True), status_code=status_code, headers=headers
    )


async def http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else None
    return error_response(exc.status_code, detail, getattr(exc, "headers", None))


async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Field locations and messages only; never echo the submitted values.
    fields = "; ".join(".".join(str(p) for p in e["loc"]) + ": " + e["msg"] for e in exc.errors())
    return error_response(422, fields)


async def bharatcode_error(request: Request, exc: BharatCodeError) -> JSONResponse:
    body = ErrorResponse(error=str(exc), detail=exc.detail)
    return JSONResponse(body.model_dump(exclude_none=True), status_code=exc.status_code)


async def use_bharatcode_key(request: Request, call_next):
    # The user's own key, sent by the extension for this request only. Never stored or logged.
    token = request_key.set(request.headers.get("x-bharatcode-key") or None)
    try:
        return await call_next(request)
    finally:
        request_key.reset(token)


async def log_requests_metadata_only(request: Request, call_next):
    start_time = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:  # noqa: BLE001 - last-resort handler for any unhandled error
        # Answer here so the server never logs the exception message, which can hold
        # personal data. The traceback frames show code locations, not values.
        logger.error(
            "unhandled %s on %s %s\n%s",
            type(exc).__name__,
            request.method,
            request.url.path,
            "".join(traceback.format_tb(exc.__traceback__)),
        )
        response = error_response(500)

    # Privacy constraint: log only method, path, status and latency. Never the body or query.
    logger.info(
        "method=%s path=%s status=%d latency_ms=%.2f",
        request.method,
        request.url.path,
        response.status_code,
        (time.perf_counter() - start_time) * 1000.0,
    )
    return response


def create_app() -> FastAPI:
    app = FastAPI(title="Job Copilot Backend", version="0.1.0", lifespan=lifespan)
    app.middleware("http")(log_requests_metadata_only)
    app.middleware("http")(use_bharatcode_key)
    # Added last so it wraps everything, including the 500 answer above.
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=settings.JC_CORS_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_exception_handler(StarletteHTTPException, http_error)
    app.add_exception_handler(RequestValidationError, validation_error)
    app.add_exception_handler(BharatCodeError, bharatcode_error)
    app.include_router(health_router)
    app.include_router(extract_router)
    app.include_router(profile_router)
    app.include_router(search_router)
    app.include_router(draft_router)
    app.include_router(fill_router)
    app.include_router(email_router)
    app.include_router(scam_router)
    return app


app = create_app()
