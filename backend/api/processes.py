"""
Process Management API Endpoints
Start, stop, restart server processes and get status/logs.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from services import process_service
from api.auth import get_current_user

router = APIRouter(prefix="/api/process", tags=["processes"])


class StartProcessRequest(BaseModel):
    project: str
    command: Optional[str] = None
    port: int = 8080


@router.post("/start")
async def start_process(request: StartProcessRequest, current_user: dict = Depends(get_current_user)):
    """Start a server process for a project."""
    try:
        result = process_service.start_process(
            request.project, request.command, request.port, user_id=current_user["id"]
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop_process(project: str, current_user: dict = Depends(get_current_user)):
    """Stop a running process."""
    try:
        result = process_service.stop_process(project, user_id=current_user["id"])
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restart")
async def restart_process(project: str, current_user: dict = Depends(get_current_user)):
    """Restart a project's process."""
    try:
        result = process_service.restart_process(project, user_id=current_user["id"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{project}")
async def get_status(project: str, current_user: dict = Depends(get_current_user)):
    """Get the status of a project's running process."""
    return process_service.get_process_status(project, user_id=current_user["id"])


@router.get("/detect/{project}")
async def detect_framework(project: str, current_user: dict = Depends(get_current_user)):
    """Auto-detect the framework used in a project."""
    try:
        return process_service.detect_framework(project, user_id=current_user["id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/{project}")
async def get_logs(project: str, count: int = 100, current_user: dict = Depends(get_current_user)):
    """Get recent log lines."""
    logs = process_service.get_recent_logs(project, count, user_id=current_user["id"])
    return {"project": project, "logs": logs, "count": len(logs)}
