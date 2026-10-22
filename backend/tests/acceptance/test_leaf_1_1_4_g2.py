import fitz
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


def make_image_only_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    # Draw shapes/pixels without any extractable text characters
    page.draw_rect(fitz.Rect(50, 50, 400, 600), color=(0.2, 0.2, 0.2), fill=(0.9, 0.9, 0.9))
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@pytest.mark.asyncio
async def test_image_only_pdf_rejected_with_422():
    scanned_pdf_bytes = make_image_only_pdf()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/profile/parse",
            files={"file": ("scanned_resume.pdf", scanned_pdf_bytes, "application/pdf")},
        )

        assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"
        data = response.json()
        error_msg = (data.get("detail") or data.get("error") or "").lower()

        # Design §4.2 & Contract C3: ask for a text-based resume, no OCR
        assert "text-based" in error_msg or "scanned" in error_msg or "image-only" in error_msg, (
            f"Expected error message requesting a text-based resume, got: {data}"
        )
