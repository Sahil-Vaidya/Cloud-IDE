"""
Database Viewer API Endpoints
Browse SQLite and MySQL databases, tables, schemas, run queries, and manage configs.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional

from services import db_service
from api.auth import get_current_user

router = APIRouter(prefix="/api/db", tags=["database"])


class QueryRequest(BaseModel):
    db_path: str
    query: str


class DBConfigRequest(BaseModel):
    type: str  # "sqlite" or "mysql"
    host: Optional[str] = None
    port: Optional[int] = 3306
    user: Optional[str] = None
    password: Optional[str] = None
    database: Optional[str] = None
    mock: Optional[bool] = False


@router.get("/{project}/config")
async def get_db_config(project: str, current_user: dict = Depends(get_current_user)):
    """Read the database configuration for a project."""
    try:
        config = db_service.get_db_config(project, current_user["id"])
        # Mask password before sending to client
        if "password" in config and config["password"]:
            config["password"] = "********"
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project}/config")
async def save_db_config(
    project: str,
    request: DBConfigRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save the database configuration for a project."""
    try:
        config_dict = request.dict(exclude_unset=True)
        # Preserve original password if it is returned as masked from the frontend
        if config_dict.get("password") == "********":
            old_config = db_service.get_db_config(project, current_user["id"])
            config_dict["password"] = old_config.get("password", "")
            
        result = db_service.save_db_config(project, config_dict, current_user["id"])
        return {"status": "success", "config": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project}/provision")
async def provision_database(
    project: str,
    request: DBConfigRequest,
    current_user: dict = Depends(get_current_user)
):
    """Provision a new database (MySQL, Postgres, MongoDB) dynamically for the project."""
    try:
        config_dict = request.dict(exclude_unset=True)
        # Preserve original password if it is returned as masked from the frontend
        if config_dict.get("password") == "********":
            old_config = db_service.get_db_config(project, current_user["id"])
            config_dict["password"] = old_config.get("password", "")
            
        result = db_service.provision_database(project, config_dict, current_user["id"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/{project}/databases")
async def list_databases(project: str, current_user: dict = Depends(get_current_user)):
    """Find all database files (SQLite) and configurations (MySQL) in a project."""
    try:
        databases = db_service.find_databases(project, current_user["id"])
        return {"project": project, "databases": databases}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project}/tables")
async def list_tables(
    project: str,
    db_path: str = Query(..., description="Relative path to SQLite file or 'mysql_config'"),
    current_user: dict = Depends(get_current_user),
):
    """List all tables in a database."""
    try:
        tables = db_service.get_tables(project, db_path, current_user["id"])
        return {"db_path": db_path, "tables": tables}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project}/schema/{table}")
async def get_schema(
    project: str,
    table: str,
    db_path: str = Query(..., description="Relative path to SQLite file or 'mysql_config'"),
    current_user: dict = Depends(get_current_user),
):
    """Get column schema for a table."""
    try:
        columns = db_service.get_table_schema(project, db_path, table, current_user["id"])
        return {"table": table, "columns": columns}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project}/rows/{table}")
async def get_rows(
    project: str,
    table: str,
    db_path: str = Query(..., description="Relative path to SQLite file or 'mysql_config'"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_column: Optional[str] = None,
    sort_direction: str = Query("ASC", pattern="^(ASC|DESC)$"),
    current_user: dict = Depends(get_current_user),
):
    """Get paginated rows from a table."""
    try:
        result = db_service.get_rows(
            project, db_path, table, page, page_size, sort_column, sort_direction, user_id=current_user["id"]
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project}/query")
async def execute_query(
    project: str,
    request: QueryRequest,
    current_user: dict = Depends(get_current_user)
):
    """Execute a read-only SQL query."""
    try:
        result = db_service.execute_query(project, request.db_path, request.query, current_user["id"])
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
