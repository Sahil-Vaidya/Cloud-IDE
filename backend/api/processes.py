"""
Process Management API Endpoints
Start, stop, restart server processes and get status/logs.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services import process_service

router = APIRouter(prefix="/api/process", tags=["processes"])


class StartProcessRequest(BaseModel):
    project: str
    command: Optional[str] = None
    port: int = 8080


@router.post("/start")
async def start_process(request: StartProcessRequest):
    """Start a server process for a project."""
    try:
        result = process_service.start_process(
            request.project, request.command, request.port
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop_process(project: str):
    """Stop a running process."""
    try:
        result = process_service.stop_process(project)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restart")
async def restart_process(project: str):
    """Restart a project's process."""
    try:
        result = process_service.restart_process(project)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{project}")
async def get_status(project: str):
    """Get the status of a project's running process."""
    return process_service.get_process_status(project)


@router.get("/detect/{project}")
async def detect_framework(project: str):
    """Auto-detect the framework used in a project."""
    try:
        return process_service.detect_framework(project)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/{project}")
async def get_logs(project: str, count: int = 100):
    """Get recent log lines."""
    logs = process_service.get_recent_logs(project, count)
    return {"project": project, "logs": logs, "count": len(logs)}
