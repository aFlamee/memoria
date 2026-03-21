from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.convex_client import close_client, init_client
from app.routers import analytics, actions, instances, sessions, tasks, templates


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_client()
    yield
    await close_client()


app = FastAPI(
    title="Memoria API",
    description=(
        "Observability & auditing backend for autonomous AI agents. "
        "Tracks instances, sessions, tasks, actions, and DAG-based task patterns."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(instances.router)
app.include_router(sessions.router)
app.include_router(tasks.router)
app.include_router(actions.router)
app.include_router(templates.router)
app.include_router(analytics.router)


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": "memoria-api"}
