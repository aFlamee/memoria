from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_driver, close_driver, ensure_schema
from app.routers import instances, sessions, tasks, actions, templates, analytics


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_driver()
    await ensure_schema()
    yield
    await close_driver()


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
