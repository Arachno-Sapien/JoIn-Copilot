# Contributing

To get a working copy running, follow the [setup guide](docs/guide/setup.md).

## Ground rules

The full list is in [`.agents/rules/job-copilot.md`](.agents/rules/job-copilot.md). These matter most:

- The extension never submits an application. It fills the form, and the user clicks submit.
- The backend never stores personal data. Profiles, resumes, drafts, applications and emails pass through it in memory only.
- Every model call goes through `backend/app/llm/provider.py` (any OpenAI-compatible `/chat/completions`) and returns data checked against a Pydantic schema. The model gets no tools, and no model id is hard-coded: each user picks one.
- Tests never call a real model or a real job site. Use mock mode and mocked HTTP.
- Use conventional commit messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## Run the checks

Backend, from `backend/`:

```bash
uv run --locked ruff check .
uv run --locked pytest
```

Extension, from `extension/`:

```bash
npm run compile
npm test
```

CI runs the backend checks on every push and pull request.
