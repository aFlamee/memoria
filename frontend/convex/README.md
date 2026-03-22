# Memoria Convex Layer

This directory owns Memoria's persistent data model and the internal HTTP
contract used by the FastAPI backend.

## Source Of Truth

- `schema.ts`: table definitions.
- `observegraphStore.ts`: writes plus derived-table maintenance.
- `observegraph.ts`: frontend-facing queries and dashboard reads.
- `http.ts`: internal HTTP routes used by `backend/api`.

Do not edit `_generated/` by hand.

## Write Path

The supported ingest path is:

1. agent/runtime -> `backend/api`
2. `backend/api` -> `convex/http.ts`
3. `http.ts` -> `observegraphStore.ts` mutations

The internal HTTP routes are protected by `MEMORIA_CONVEX_INGEST_SECRET`.

Do not write directly to base tables unless the matching derived data is kept in
sync. The dashboard depends on those derived rows and on `instances.metrics`.

## Read Path

- The frontend server loaders query `api.observegraph.*`.
- Live reads use `PUBLIC_CONVEX_URL`.
- Local mock mode is controlled by `OBSERVEGRAPH_USE_MOCK_DATA`.

## Useful Commands

```bash
npx convex dev
pnpm run codegen:convex
```
