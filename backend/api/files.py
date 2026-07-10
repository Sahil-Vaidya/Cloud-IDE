"""
File API Endpoints
REST API for file and directory operations within project workspaces.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional

from services import file_service
from api.auth import get_current_user

router = APIRouter(prefix="/api/files", tags=["files"])


class FileContentRequest(BaseModel):
    path: str
    content: str


class CreateItemRequest(BaseModel):
    path: str
    type: str = "file"  # "file" or "directory"


class RenameRequest(BaseModel):
    old_path: str
    new_path: str


@router.get("/{project}")
async def get_file_tree(project: str, current_user: dict = Depends(get_current_user)):
    """Get the complete file tree for a project."""
    try:
        tree = file_service.get_file_tree(project, user_id=current_user["id"])
        return {"project": project, "tree": tree}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/{project}/content")
async def read_file(
    project: str,
    path: str = Query(..., description="Relative file path"),
    current_user: dict = Depends(get_current_user),
):
    """Read the content of a file."""
    try:
        content = file_service.read_file(project, path, current_user["id"])
        extension = file_service.get_file_extension(path)
        return {"path": path, "content": content, "extension": extension}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{project}/content")
async def update_file(
    project: str,
    request: FileContentRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update/create a file with new content."""
    try:
        result = file_service.write_file(project, request.path, request.content, current_user["id"])
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project}/create")
async def create_item(
    project: str,
    request: CreateItemRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a new file or directory."""
    try:
        result = file_service.create_item(project, request.path, request.type, current_user["id"])
        return result
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project}/content")
async def delete_item(
    project: str,
    path: str = Query(..., description="Relative file path"),
    current_user: dict = Depends(get_current_user),
):
    """Delete a file or directory."""
    try:
        result = file_service.delete_item(project, path, current_user["id"])
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project}/rename")
async def rename_item(
    project: str,
    request: RenameRequest,
    current_user: dict = Depends(get_current_user),
):
    """Rename or move a file/directory."""
    try:
        result = file_service.rename_item(project, request.old_path, request.new_path, current_user["id"])
        return result
    except (FileNotFoundError, FileExistsError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
