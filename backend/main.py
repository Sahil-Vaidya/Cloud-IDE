"""
Cloud IDE — Backend API Server
FastAPI application entry point.
Serves REST APIs and WebSocket endpoints for the browser-based IDE.
"""

import logging
import subprocess
import sys
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api import files, projects, processes, database, websockets, auth, search, git

# ─── Logging Setup ─────────────────────────────────────────────────────────────
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_DIR / "ide_server.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("cloud_ide")

# ─── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Cloud IDE API",
    description="Backend API for the browser-based full-stack IDE",
    version="1.0.0",
)


@app.on_event("startup")
def startup_event():
    logger.info("Cloud IDE API starting up...")
    auth.init_auth_db()
    logger.info("Auth database initialized")


# ─── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Global Error Handler ───────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )


# ─── Mount API Routers ──────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(files.router)
app.include_router(projects.router)
app.include_router(processes.router)
app.include_router(database.router)
app.include_router(search.router)
app.include_router(git.router)
app.include_router(websockets.router)


# ─── Health & Root Endpoints ────────────────────────────────────────────────────
@app.get("/")
async def root():
    """API health check."""
    return {
        "name": "Cloud IDE API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "auth": "/api/auth",
            "projects": "/api/projects",
            "files": "/api/files/{project}",
            "process": "/api/process",
            "database": "/api/db/{project}",
            "search": "/api/search/{project}",
            "git": "/api/git/{project}",
            "terminal_ws": "/ws/terminal/{project}",
            "logs_ws": "/ws/logs/{project}",
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
