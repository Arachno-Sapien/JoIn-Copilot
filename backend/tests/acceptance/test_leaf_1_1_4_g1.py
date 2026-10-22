import fitz

from app.services.parser.extractor import extract_text_from_pdf


def make_single_column_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    text = (
        "John Doe\n"
        "Email: john@example.com | Phone: +1-555-0100 | Location: San Francisco, CA\n\n"
        "Experience\n"
        "Senior Software Engineer - Acme Inc (2022 - Present)\n"
        "Built distributed event streaming pipelines processing 1M events/sec.\n"
        "Led migration from monolith to FastAPI microservices.\n\n"
        "Education\n"
        "B.S. in Computer Science - Stanford University (2018 - 2022)\n\n"
        "Skills\n"
        "Python, FastAPI, Docker, Kubernetes, AWS\n"
    )
    page.insert_text((50, 72), text, fontsize=11)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def make_two_column_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    # Left column: Contact info and skills (x: 50 to 220)
    left_col = (
        "Jane Smith\n"
        "jane@example.com\n"
        "+1-555-0200\n"
        "Seattle, WA\n\n"
        "SKILLS\n"
        "- Python\n"
        "- TypeScript\n"
        "- React\n"
        "- PostgreSQL\n\n"
        "EDUCATION\n"
        "B.S. Computer Engineering\n"
        "Univ of Washington\n"
        "2019 - 2023\n"
    )
    # Right column: Summary and experience (x: 240 to 540)
    right_col = (
        "PROFESSIONAL EXPERIENCE\n\n"
        "Software Engineer | CloudTech Solutions (2023 - Present)\n"
        "- Developed high-performance REST APIs in Python.\n"
        "- Optimized PostgreSQL queries reducing latency by 40%.\n\n"
        "PROJECTS\n"
        "AI Job Search Copilot\n"
        "- Built browser extension with React and FastAPI.\n"
    )
    page.insert_text((50, 72), left_col, fontsize=10)
    page.insert_text((240, 72), right_col, fontsize=10)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_extract_text_single_column():
    pdf_bytes = make_single_column_pdf()
    text = extract_text_from_pdf(pdf_bytes)

    assert "John Doe" in text
    assert "john@example.com" in text
    assert "FastAPI microservices" in text
    assert "Stanford University" in text
    assert "Kubernetes" in text


def test_extract_text_two_column_layout():
    pdf_bytes = make_two_column_pdf()
    text = extract_text_from_pdf(pdf_bytes)

    # Both columns must be captured without omitting either column
    assert "Jane Smith" in text
    assert "jane@example.com" in text
    assert "CloudTech Solutions" in text
    assert "PostgreSQL queries" in text
    assert "AI Job Search Copilot" in text
