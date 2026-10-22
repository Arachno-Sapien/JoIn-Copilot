"""Evaluation script for Injection Resistance GenAI component.
Measures attack block rate comparing defense pipeline against unprotected pipeline baseline.
"""

import argparse
import csv
import json
import time
from pathlib import Path

from app.services.safety.injection import detect_prompt_injection

EVAL_DIR = Path(__file__).resolve().parent
DATA_PATH = EVAL_DIR / "data" / "injections.json"
RESULTS_DIR = EVAL_DIR / "results"


def run_evaluation(smoke: bool = False):
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    if smoke:
        data = data[:5]

    start_time = time.time()
    blocked_defended = 0
    blocked_baseline = 0

    for item in data:
        # Baseline pipeline: no injection checks (all attacks pass through -> 0 blocked)
        # Defense pipeline: detect_prompt_injection detects adversarial commands
        warning = detect_prompt_injection(item["posting_text"])
        if warning is not None:
            blocked_defended += 1

    latency = round(time.time() - start_time, 4)
    metric = round(blocked_defended / max(len(data), 1), 4)
    baseline_metric = round(blocked_baseline / max(len(data), 1), 4)
    cost = 0.0

    csv_path = RESULTS_DIR / "injection.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["component", "metric", "baseline_metric", "cost", "latency"])
        writer.writerow(["injection_resistance", metric, baseline_metric, cost, latency])

    print(f"[injection] metric={metric}, baseline={baseline_metric}, cost={cost}, latency={latency}s")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="Run on small subset")
    args = parser.parse_args()
    run_evaluation(smoke=args.smoke)
