# Contributing

Thanks for your interest in improving **RAG Pipeline Visualization**! This guide covers how to get set up and the checks your change should pass.

## Getting started

See the [README](README.md) for full setup instructions. In short:

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Frontend
cd frontend
npm install --legacy-peer-deps
```

## Development workflow

1. Create a branch from `main`: `git checkout -b feat/my-change`.
2. Make your change with tests where it makes sense.
3. Run the checks below locally.
4. Open a pull request describing **what** changed and **why**.

## Checks before opening a PR

These mirror the CI pipeline — if they pass locally, CI should be green.

**Backend**

```bash
cd backend
ruff check app tests        # lint
ruff format app tests       # format
pytest -q                   # tests
```

**Frontend**

```bash
cd frontend
npm run lint                # oxlint (fails on any warning)
npm test                    # vitest
npm run build               # type-check + production build
```

> The backend targets **Python 3.11+**. If your local interpreter is older,
> some standard-library features (e.g. `datetime.UTC`) will not be available.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) prefixes
(`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `perf:`, `ci:`). This keeps the
history readable and helps with release notes.

## Code style

- **Python** — formatted and linted by Ruff (config in `backend/pyproject.toml`).
- **TypeScript/React** — linted by oxlint; keep components typed and avoid `any`.

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
