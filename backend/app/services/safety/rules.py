import re

from app.schemas.job import Job

# Regex patterns for scam red flags
FEE_OR_DEPOSIT_PATTERN = re.compile(
    r"\b(registration\s+fee|training\s+fee|equipment\s+deposit|refundable\s+deposit|application\s+fee|processing\s+fee|mandatory\s+fee|pay\s+\$\d+)\b",
    re.IGNORECASE,
)

WHATSAPP_PATTERN = re.compile(r"\b(whatsapp|wa\.me)\b", re.IGNORECASE)
PERSONAL_EMAIL_PATTERN = re.compile(
    r"\b[a-zA-Z0-9_.+-]+@(gmail|yahoo|hotmail|outlook|proton|aol)\.com\b",
    re.IGNORECASE,
)

OUTSIZED_HOURLY_PATTERN = re.compile(r"\$(\d+)\s*(?:per|\/)\s*(?:hour|hr)", re.IGNORECASE)
OUTSIZED_WEEKLY_PATTERN = re.compile(r"\$(\d+)\s*(?:per|\/)\s*(?:week|wk)", re.IGNORECASE)
ENTRY_ROLE_PATTERN = re.compile(r"\b(entry\s*level|beginner|clerk|data\s*entry|assistant)\b", re.IGNORECASE)

URGENCY_NO_INTERVIEW_PATTERN = re.compile(
    r"\b(immediate\s+start|start\s+immediately|start\s+today|hired\s+right\s+away)\b.*\b(no\s+interview|without\s+interview)\b|\b(no\s+interview|without\s+interview)\b.*\b(immediate\s+start|start\s+immediately|start\s+today)\b",
    re.IGNORECASE,
)


def check_rule_signals(job: Job) -> list[str]:
    signals: list[str] = []
    text = f"{job.title} {job.description}"

    # 1. Fee or deposit
    if FEE_OR_DEPOSIT_PATTERN.search(text):
        signals.append("Job description requires payment of a fee or security deposit.")

    # 2. Contact only via WhatsApp or personal email domain
    if WHATSAPP_PATTERN.search(text):
        signals.append("Requires contact via WhatsApp instead of official company channels.")
    if PERSONAL_EMAIL_PATTERN.search(text):
        signals.append("Uses a personal email domain (e.g. Gmail/Yahoo) for recruitment.")

    # 3. Outsized pay for entry level role
    is_entry = ENTRY_ROLE_PATTERN.search(text)
    hourly_match = OUTSIZED_HOURLY_PATTERN.search(text)
    weekly_match = OUTSIZED_WEEKLY_PATTERN.search(text)

    if hourly_match:
        rate = int(hourly_match.group(1))
        if rate >= 250 or (is_entry and rate >= 150):
            signals.append(f"Outsized compensation of ${rate}/hr for entry level or simple tasks.")
    elif weekly_match:
        rate = int(weekly_match.group(1))
        if rate >= 5000 or (is_entry and rate >= 3000):
            signals.append(f"Outsized compensation of ${rate}/week for entry level tasks.")

    # 4. No company website or URL
    company_url = getattr(job, "company_url", None) or (job.url if "example.com" not in job.url and job.url else "")
    if not company_url or (isinstance(company_url, str) and company_url.strip() == ""):
        signals.append("No company website or official URL provided.")

    # 5. Urgency without an interview
    if URGENCY_NO_INTERVIEW_PATTERN.search(text):
        signals.append("High urgency to hire immediately with no interview process.")

    return signals
