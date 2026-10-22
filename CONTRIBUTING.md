# Contributing to Job Copilot

Thank you for your interest in contributing to Job Copilot!

## Development Guidelines

1. **Local-first & Privacy:** Personal data must never leave the browser.
2. **No Auto-Submit:** The extension fills forms but never clicks submit automatically.
3. **Structured Outputs Only:** The backend LLM pipeline uses Pydantic structured outputs without tool/function execution.
4. **Offline Tests:** All gates and acceptance tests run with mock LLMs and mock data.
5. **Conventional Commits:** Use standard conventional commit format (`feat:`, `fix:`, `chore:`, `test:`).

## Running Tests

```bash
# Backend tests
cd backend
uv run --locked pytest

# Extension tests
cd extension
npx vitest run
```
