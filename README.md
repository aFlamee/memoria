# Memoria

Memoria is the observability surface for autonomous agent runs. It stores agent
runtime data in Convex, exposes ingest and read APIs through FastAPI, and
renders the dashboard in SvelteKit.

## What Matters

- `frontend/`: SvelteKit UI plus the Convex schema, queries, mutations, and
  internal HTTP routes.
- `backend/api/`: FastAPI service that validates ingest payloads and forwards
  them into Convex.
- `docker-compose.yml`: local frontend + API stack for day-to-day development.
- `.env.example`: shared local configuration for the full stack.

## Quick Start

1. Copy the shared environment file:

   ```bash
   cp .env.example .env
   ```

2. Start or connect a Convex deployment from the frontend workspace:

   ```bash
   cd frontend
   npx convex dev
   ```

3. Start the local app stack from the repository root:

   ```bash
   docker compose up --build
   ```

## Local URLs

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- Convex site URL: `PUBLIC_CONVEX_SITE_URL` from `.env`

Quick health check:

```bash
curl http://localhost:8000/health
```

## Runtime Flow

1. An agent runtime emits instance, session, task, and action events.
2. `backend/api` validates those payloads and forwards them to Convex.
3. `frontend/convex/http.ts` protects the internal write routes with
   `MEMORIA_CONVEX_INGEST_SECRET`.
4. The frontend reads the aggregated view directly from Convex.

Convex is the source of truth. Neo4j is not part of the current stack.

## Important Environment Variables

- `PUBLIC_CONVEX_URL`: frontend read URL for live Convex queries.
- `PUBLIC_CONVEX_SITE_URL` / `CONVEX_SITE_URL`: Convex site URL used by the
  backend.
- `MEMORIA_CONVEX_INGEST_SECRET`: shared secret for backend -> Convex internal
  write routes.
- `OBSERVEGRAPH_USE_MOCK_DATA`: set to `true` to run the frontend against local
  mock data.

## Important Docs

- [backend/api/README.md](/Users/mochiqt/Repos/memoria/backend/api/README.md):
  backend setup, tests, and API environment.
- [frontend/README.md](/Users/mochiqt/Repos/memoria/frontend/README.md):
  frontend startup and data-integrity notes.
- [frontend/convex/README.md](/Users/mochiqt/Repos/memoria/frontend/convex/README.md):
  Convex ownership and write/read contract.

`frontend/observegraph-system-design.md` is useful as background, but parts of
it describe an older Neo4j-based design and should not be treated as the
current source of truth.

## Related Public Repo

[`meetrk/memoriaclaw`](https://github.com/aFlamee/memoriaclaw) is the public
agent/runtime side that is relevant to Memoria. It is a public fork of
`openclaw/openclaw`, and it represents the kind of agent runtime Memoria is
built to observe: a process that can register instances, open sessions, report
tasks, and emit action-level telemetry into this stack.

## Useful Commands

```bash
docker compose up --build -d
docker compose logs -f
docker compose logs -f api
docker compose down
```
