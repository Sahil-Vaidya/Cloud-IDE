"""
Cloud IDE — Backend API Server
FastAPI application entry point.
Serves REST APIs and WebSocket endpoints for the browser-based IDE.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import files, projects, processes, database, websockets


app = FastAPI(
    title="Cloud IDE API",
    description="Backend API for the browser-based full-stack IDE",
    version="1.0.0",
)

# CORS configuration — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(files.router)
app.include_router(projects.router)
app.include_router(processes.router)
app.include_router(database.router)
app.include_router(websockets.router)


@app.get("/")
async def root():
    """API health check."""
    return {
        "name": "Cloud IDE API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "projects": "/api/projects",
            "files": "/api/files/{project}",
            "process": "/api/process",
            "database": "/api/db/{project}",
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
