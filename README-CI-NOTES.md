# CI & Maintenance

This repository uses:
- **GitHub Actions** (`.github/workflows/ci.yml`) for Python lint (ruff) and tests (pytest),
  plus an optional Node build if `package.json` exists.
- **CodeQL** (`.github/workflows/codeql.yml`) for security scanning.
- **Dependabot** (`.github/dependabot.yml`) for weekly dependency update PRs.
- **Ruff** and **Pytest** configured via `pyproject.toml`.
- A minimal smoke test at `tests/test_smoke.py` to keep CI green.

## Local dev (quick)
```

python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt || true
pip install -r requirements-dev.txt || true
pip install ruff pytest
ruff check .
pytest -q
```
