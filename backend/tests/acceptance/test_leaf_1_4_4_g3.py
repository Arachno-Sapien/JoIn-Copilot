import csv
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
EVAL_DIR = REPO_ROOT / "backend" / "eval"
RESULTS_DIR = EVAL_DIR / "results"

EVAL_SCRIPTS = [
    "eval_resume_parser.py",
    "eval_matching.py",
    "eval_fabrication.py",
    "eval_scam.py",
    "eval_email.py",
    "eval_form_agent.py",
    "eval_injection.py",
]


def test_evaluation_scripts_run_smoke_and_write_csv(monkeypatch):
    monkeypatch.setenv("JC_LLM_MODE", "mock")
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    for script_name in EVAL_SCRIPTS:
        script_path = EVAL_DIR / script_name
        assert script_path.exists(), f"Evaluation script {script_name} must exist under backend/eval/"

        # Run script in smoke mode
        res = subprocess.run(  # exit code is asserted below
            [sys.executable, str(script_path), "--smoke"],
            check=False,
            cwd=str(REPO_ROOT / "backend"),
            capture_output=True,
            text=True,
        )
        assert res.returncode == 0, f"Script {script_name} failed: {res.stderr} {res.stdout}"

    # Check results CSV files
    csv_files = list(RESULTS_DIR.glob("*.csv"))
    assert len(csv_files) > 0, f"Expected CSV files under {RESULTS_DIR}"

    # Verify CSV rows contain: metric, baseline_metric, cost, latency
    total_rows = 0
    for csv_file in csv_files:
        with open(csv_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            assert "metric" in reader.fieldnames, f"Missing 'metric' header in {csv_file.name}"
            assert "baseline_metric" in reader.fieldnames, f"Missing 'baseline_metric' header in {csv_file.name}"
            assert "cost" in reader.fieldnames, f"Missing 'cost' header in {csv_file.name}"
            assert "latency" in reader.fieldnames, f"Missing 'latency' header in {csv_file.name}"

            for row in reader:
                total_rows += 1
                assert float(row["cost"]) >= 0.0
                assert float(row["latency"]) >= 0.0

    assert total_rows >= len(EVAL_SCRIPTS), (
        f"Expected at least {len(EVAL_SCRIPTS)} result rows across evaluation CSVs, got {total_rows}"
    )
