"""
Database Viewer API Endpoints
Browse SQLite databases, tables, schemas, and run read-only queries.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from services import db_service

router = APIRouter(prefix="/api/db", tags=["database"])


class QueryRequest(BaseModel):
    db_path: str
    query: str


@router.get("/{project}/databases")
async def list_databases(project: str):
    """Find all SQLite database files in a project."""
    try:
        databases = db_service.find_databases(project)
        return {"project": project, "databases": databases}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project}/tables")
async def list_tables(project: str, db_path: str = Query(..., description="Relative path to SQLite file")):
    """List all tables in a SQLite database."""
    try:
        tables = db_service.get_tables(project, db_path)
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
    db_path: str = Query(..., description="Relative path to SQLite file"),
):
    """Get column schema for a table."""
    try:
        columns = db_service.get_table_schema(project, db_path, table)
        return {"table": table, "columns": columns}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project}/rows/{table}")
async def get_rows(
    project: str,
    table: str,
    db_path: str = Query(..., description="Relative path to SQLite file"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_column: Optional[str] = None,
    sort_direction: str = Query("ASC", pattern="^(ASC|DESC)$"),
):
    """Get paginated rows from a table."""
    try:
        result = db_service.get_rows(
            project, db_path, table, page, page_size, sort_column, sort_direction
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project}/query")
async def execute_query(project: str, request: QueryRequest):
    """Execute a read-only SQL query."""
    try:
        result = db_service.execute_query(project, request.db_path, request.query)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
