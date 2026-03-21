# Memoria API

FastAPI backend for the Memoria AI Agent Observability system.

## Quick Start

### Option A — Docker (recommended for others)

```bash
cd memoria/api
docker-compose up -d
```

- API:            http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Neo4j Browser:  http://localhost:7474 (user: `neo4j`, pass: `memoriapassword`)

### Option B — Local (your machine with Neo4j already running)

**Prerequisites:** Python 3.12+, [uv](https://docs.astral.sh/uv/)

```bash
cd memoria/api

# Install dependencies
uv pip install -e ".[dev]"

# Copy and fill in env vars
cp .env.example .env
# Edit .env with your Neo4j password

# Run the server
uvicorn app.main:app --reload
```

The server auto-runs schema migrations (constraints + indexes + root User node) on first boot.

### Manual DB init (optional)

If you want to run the init script directly against Neo4j:

```bash
cypher-shell -u neo4j -p <password> < scripts/init_db.cypher
```

## Running Tests

Tests require a running Neo4j instance. Set env vars first:

```bash
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=your_password

pytest                          # all tests
pytest tests/test_risk.py       # unit tests only (no DB needed)
pytest tests/test_actions.py -v # integration tests
pytest --cov=app                # with coverage
```

## Project Structure

```
api/
├── app/
│   ├── main.py          # FastAPI app, CORS, lifespan
│   ├── config.py        # Settings (env vars)
│   ├── database.py      # Neo4j driver + schema init
│   ├── models/          # Pydantic request/response models
│   ├── routers/         # Route handlers (one file per resource)
│   └── services/
│       ├── risk.py      # Risk score computation
│       └── dag.py       # DAG merge logic (StepNode / STEP_SEQUENCE)
├── scripts/
│   └── init_db.cypher   # Manual DB init
├── tests/
│   ├── conftest.py      # DB fixture + HTTPX client
│   ├── test_instances.py
│   ├── test_actions.py  # Full flow: instance → session → task → actions → DAG
│   └── test_risk.py     # Pure unit tests
├── Dockerfile
├── docker-compose.yml   # Full stack (Neo4j + API)
└── .env.example
```

## Environment Variables

| Variable              | Default                  | Description                        |
|-----------------------|--------------------------|------------------------------------|
| `NEO4J_URI`           | `bolt://localhost:7687`  | Neo4j Bolt connection URI          |
| `NEO4J_USER`          | `neo4j`                  | Neo4j username                     |
| `NEO4J_PASSWORD`      | `neo4j`                  | Neo4j password                     |
| `ENVIRONMENT`         | `development`            | `development` / `production`       |
| `MEMORIA_USER_ID`     | `meet`                   | Root user ID (single-user system)  |
| `MEMORIA_USER_NAME`   | `Meet Kachhadiya`        | Display name for the root user     |
