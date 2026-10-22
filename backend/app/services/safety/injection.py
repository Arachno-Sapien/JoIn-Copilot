import re
from typing import Optional

INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+(instructions|prompts|directions)", re.IGNORECASE),
    re.compile(r"system\s*:\s*(you\s+are|unrestricted|output)", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(a|in|an)\b", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?(prior|previous)\s+(instructions|directions|guidelines)", re.IGNORECASE),
    re.compile(r"output\s+system\s+prompt", re.IGNORECASE),
    re.compile(r"developer\s+mode", re.IGNORECASE),
    re.compile(r"bypass\s+(safety|content|all)\s+instructions", re.IGNORECASE),
]


def detect_prompt_injection(text: str) -> Optional[str]:
    if not text:
        return None

    for pattern in INJECTION_PATTERNS:
        match = pattern.search(text)
        if match:
            return f"Potential prompt injection attempt detected: '{match.group(0)}'."

    return None
