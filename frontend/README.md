# Memoria Frontend

You need Node >= 22 and a reachable Convex deployment.

```bash
pnpm install
npx convex dev
pnpm run dev
```

The frontend still supports local mock data. Set `OBSERVEGRAPH_USE_MOCK_DATA=false` to use live data paths.

## ObserveGraph Data Integrity

Write ObserveGraph runtime data through the Convex mutations in
`frontend/convex/observegraphStore.ts`: `upsertInstance`, `upsertSession`,
`upsertTask`, and `upsertAction`.

Direct inserts into `instances`, `sessions`, `tasks`, or `actions` are not a
supported ingest path unless the caller also keeps these derived tables in sync:

- `instanceWeeklyUsage`
- `sessionCostBreakdowns`
- `analyticsHourly`

The dashboard and detail views depend on those derived rows plus
`instances.metrics`. If they are stale or missing, the UI can legitimately show
zeroes or empty sections even when base rows exist.
