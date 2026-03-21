# Memoria

Lokaler Full-Stack-Start für:

- Frontend
- FastAPI-Backend
- Neo4j

## Start

```bash
cp .env.example .env
docker compose up --build
```

## Zugriff

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- API-Doku: `http://localhost:8000/docs`
- Neo4j Browser: `http://localhost:7474`

Backend-Healthcheck:

```bash
curl http://localhost:8000/health
```

## Hinweise

- Die gemeinsame Konfiguration liegt in `.env.example`.
- Das Docker-Frontend startet standardmäßig mit Mockdaten aus `frontend/mockdata/`.
- `convex dev` ist nicht Teil der Compose.
- Standard-Zugang für Neo4j: `neo4j / memoriapassword`

## Nützliche Befehle

```bash
docker compose up --build -d
docker compose logs -f
docker compose logs -f api
docker compose down
```

## Wenn etwas nicht läuft

```bash
docker compose ps
docker compose logs --tail=200 api
docker compose logs --tail=200 neo4j
```
