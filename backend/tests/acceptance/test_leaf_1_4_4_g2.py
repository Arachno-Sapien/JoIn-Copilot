import sys
from pathlib import Path
import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
MOCK_PORTAL_DIR = REPO_ROOT / "mock-portal"
if str(MOCK_PORTAL_DIR) not in sys.path:
    sys.path.insert(0, str(MOCK_PORTAL_DIR))


def test_mock_portal_forms_include_complex_elements():
    import importlib.util
    portal_app_path = MOCK_PORTAL_DIR / "app.py"
    assert portal_app_path.exists(), f"mock-portal app.py not found at {portal_app_path}"
    spec = importlib.util.spec_from_file_location("mock_portal_app", portal_app_path)
    mock_portal_app = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mock_portal_app)
    app = mock_portal_app.app

    client = app.test_client()

    # Step 1 of application flow
    step1_resp = client.get("/apply/job-1/step1")
    if step1_resp.status_code == 404:
        # Try alternate URL
        step1_resp = client.get("/jobs/job-1/apply?step=1")
    assert step1_resp.status_code == 200
    step1_html = step1_resp.data.decode("utf-8").lower()

    # 1. Multi-step flow: check next step link/action
    assert "step=2" in step1_html or "step2" in step1_html or "next" in step1_html, (
        "Application must support multi-step flow"
    )

    # 2. File upload: resume / CV
    assert 'type="file"' in step1_html, "Application form must include file upload"

    # Step 2 of application flow
    step2_resp = client.get("/apply/job-1/step2")
    if step2_resp.status_code == 404:
        step2_resp = client.get("/jobs/job-1/apply?step=2")
    assert step2_resp.status_code == 200
    step2_html = step2_resp.data.decode("utf-8").lower()

    # 3. Dependent dropdowns: e.g. country and state or department and team
    assert (
        "data-depends-on" in step2_html
        or "data-parent" in step2_html
        or ("select" in step2_html and "country" in step2_html and "state" in step2_html)
        or ("select" in step2_html and "department" in step2_html and "role" in step2_html)
    ), "Form must include dependent dropdowns"

    # 4. Date pickers
    assert 'type="date"' in step2_html, "Form must include date picker input"

    # 5. Required checkboxes: e.g. terms, eligibility
    assert 'type="checkbox"' in step2_html and "required" in step2_html, (
        "Form must include required checkbox input"
    )

    # 6. Free-text questions: textarea
    assert "<textarea" in step2_html, "Form must include free-text textarea questions"
