import fitz
import pytest

from app.schemas.profile import Preferences, Profile
from app.services.parser.assign_ids import assign_stable_bullet_ids
from app.services.parser.extractor import ImageOnlyPDFError, extract_text_from_pdf


def test_extract_text_empty_pdf():
    with pytest.raises(ImageOnlyPDFError):
        extract_text_from_pdf(b"")


def test_extract_text_scanned_pdf():
    doc = fitz.open()
    page = doc.new_page()
    page.draw_rect(fitz.Rect(10, 10, 100, 100), color=(1, 0, 0))
    pdf_bytes = doc.tobytes()
    doc.close()

    with pytest.raises(ImageOnlyPDFError, match="text-based"):
        extract_text_from_pdf(pdf_bytes)


def test_assign_stable_bullet_ids_empty():
    profile = Profile(
        schema_version=1,
        name="Test",
        email="test@example.com",
        phone="+1234567890",
        location="Remote",
        skills=[],
        preferences=Preferences(),
    )
    assigned = assign_stable_bullet_ids(profile)
    assert assigned.experience == []
    assert assigned.projects == []
