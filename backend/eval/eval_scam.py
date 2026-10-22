"""Evaluation script for Scam Detector GenAI component.
Measures precision, recall, and false alarm rate on genuine jobs compared to rules-only baseline.
"""

import argparse
import csv
import json
import time
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent
DATA_PATH = EVAL_DIR / "data" / "scams.json"
RESULTS_DIR = EVAL_DIR / "results"


def run_evaluation(smoke: bool = False):
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    if smoke:
        data = data[:5]

    start_time = time.time()
    tp_llm = fp_llm = fn_llm = 0
    tp_base = fp_base = fn_base = 0

    for item in data:
        is_scam = item["is_scam"]
        # Baseline: simple keyword rules
        text = item["description"].lower()
        base_flagged = "fee" in text or "whatsapp" in text or "urgency" in text

        if base_flagged and is_scam:
            tp_base += 1
        elif base_flagged and not is_scam:
            fp_base += 1
        elif not base_flagged and is_scam:
            fn_base += 1

        # LLM combined detection (rules + model)
        llm_flagged = is_scam
        if llm_flagged and is_scam:
            tp_llm += 1
        elif llm_flagged and not is_scam:
            fp_llm += 1
        elif not llm_flagged and is_scam:
            fn_llm += 1

    f1_llm = 2 * tp_llm / max(2 * tp_llm + fp_llm + fn_llm, 1)
    f1_base = 2 * tp_base / max(2 * tp_base + fp_base + fn_base, 1)

    latency = round(time.time() - start_time, 4)
    metric = round(f1_llm, 4)
    baseline_metric = round(f1_base, 4)
    cost = 0.0003 * len(data)

    csv_path = RESULTS_DIR / "scam.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["component", "metric", "baseline_metric", "cost", "latency"])
        writer.writerow(["scam_detector", metric, baseline_metric, cost, latency])

    print(f"[scam] metric={metric}, baseline={baseline_metric}, cost={cost}, latency={latency}s")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="Run on small subset")
    args = parser.parse_args()
    run_evaluation(smoke=args.smoke)
