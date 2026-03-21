# Memoria API

FastAPI backend for the Memoria AI Agent Observability system.

## Quick Start

### Option A — Docker

```bash
docker compose up -d
```

- API: `http://localhost:8000`
- Interactive docs: `http://localhost:8000/docs`

### Option B — Local

**Prerequisites:** Python 3.12+, [uv](https://docs.astral.sh/uv/)

```bash
uv pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload
```

The backend expects a reachable Convex site URL and the shared ingest secret.

## Running Tests

```bash
pytest
pytest tests/test_risk.py
pytest tests/test_actions.py -v
pytest --cov=app
```

The integration tests use an in-memory fake Convex adapter and do not require external services.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `CONVEX_SITE_URL` | `http://127.0.0.1:3210` | Convex site URL used by the backend |
| `MEMORIA_CONVEX_INGEST_SECRET` | `memoria-local-ingest-secret` | Shared secret for internal FastAPI -> Convex HTTP calls |
| `ENVIRONMENT` | `development` | `development` / `production` |
| `MEMORIA_USER_ID` | `meet` | Root user ID |
| `MEMORIA_USER_NAME` | `Meet Kachhadiya` | Root user display name |
