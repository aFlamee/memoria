# Memoria

Local full-stack setup for:

- frontend
- FastAPI backend
- Neo4j

## Start

```bash
cp .env.example .env
docker compose up --build
```

## URLs

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- Neo4j Browser: `http://localhost:7474`

Backend health check:

```bash
curl http://localhost:8000/health
```

## First-time Convex setup

Convex is not required for the default Docker start.
The Docker frontend uses local mock data by default.

If you want to use a real Convex deployment for local development:

1. Install dependencies in the frontend:

```bash
cd frontend
pnpm install
```

2. Start Convex and create or link a project:

```bash
npx convex dev
```

3. Copy the generated values from `frontend/.env.local` into your root `.env` if you want the rest of the project to use the same deployment.

4. To let the frontend use Convex instead of mock data, set this in the root `.env`:

```bash
OBSERVEGRAPH_USE_MOCK_DATA=false
```

## Notes

- Shared configuration lives in [`.env.example`](/Users/mochiqt/Repos/memoria/.env.example).
- The Docker frontend starts with mock data from `frontend/mockdata/`.
- `convex dev` is not part of the Docker Compose stack.
- Default Neo4j credentials: `neo4j / memoriapassword`

## Useful commands

```bash
docker compose up --build -d
docker compose logs -f
docker compose logs -f api
docker compose down
```

## If something fails

```bash
docker compose ps
docker compose logs --tail=200 api
docker compose logs --tail=200 neo4j
```
