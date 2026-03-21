# Memoria

Local full-stack setup for:

- frontend
- FastAPI backend
- Convex

## Start

```bash
cp .env.example .env
docker compose up --build
```

Run Convex separately in the frontend workspace if you do not already have a deployment:

```bash
cd frontend
npx convex dev
```

## URLs

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- Convex site URL: `PUBLIC_CONVEX_SITE_URL` from your `.env`

Backend health check:

```bash
curl http://localhost:8000/health
```

## Notes

- Shared configuration lives in `.env.example`.
- Convex is the single persistence layer. Neo4j is no longer part of the stack.
- The Docker frontend still starts with mock data when `OBSERVEGRAPH_USE_MOCK_DATA=true`.
- The FastAPI backend talks to Convex through internal HTTP routes secured by `MEMORIA_CONVEX_INGEST_SECRET`.

## Useful commands

```bash
docker compose up --build -d
docker compose logs -f
docker compose logs -f api
docker compose down
```
