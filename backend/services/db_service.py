"""
Database Service
Provides SQLite introspection and read-only query execution.
Discovers SQLite database files within project workspaces.
"""

import sqlite3
from pathlib import Path
from typing import Optional

from services.file_service import get_project_path


def find_databases(project_name: str) -> list:
    """Find all SQLite database files in a project workspace."""
    project_path = get_project_path(project_name)
    databases = []

    # Common SQLite file extensions
    sqlite_extensions = {".db", ".sqlite", ".sqlite3", ".db3"}

    for file_path in project_path.rglob("*"):
        if file_path.is_file() and file_path.suffix in sqlite_extensions:
            rel_path = str(file_path.relative_to(project_path)).replace("\\", "/")
            try:
                # Verify it's a valid SQLite file
                conn = sqlite3.connect(str(file_path))
                conn.execute("SELECT 1")
                conn.close()
                databases.append({
                    "path": rel_path,
                    "name": file_path.name,
                    "size": file_path.stat().st_size,
                })
            except Exception:
                pass

    return databases


def _get_connection(project_name: str, db_path: str) -> sqlite3.Connection:
    """Get a read-only SQLite connection to a database file."""
    project_path = get_project_path(project_name)
    full_path = (project_path / db_path).resolve()

    # Safety: ensure the path is within the project
    if not str(full_path).startswith(str(project_path.resolve())):
        raise ValueError("Invalid database path: directory traversal detected")

    if not full_path.exists():
        raise FileNotFoundError(f"Database file not found: {db_path}")

    # Connect in read-only mode using URI
    uri = f"file:{full_path}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def get_tables(project_name: str, db_path: str) -> list:
    """List all tables in a SQLite database."""
    conn = _get_connection(project_name, db_path)
    try:
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        tables = [row["name"] for row in cursor.fetchall()]
        return tables
    finally:
        conn.close()


def get_table_schema(project_name: str, db_path: str, table_name: str) -> list:
    """Get the schema (columns) of a specific table."""
    conn = _get_connection(project_name, db_path)
    try:
        # Validate table name to prevent SQL injection
        tables = get_tables(project_name, db_path)
        if table_name not in tables:
            raise ValueError(f"Table not found: {table_name}")

        cursor = conn.execute(f"PRAGMA table_info(\"{table_name}\")")
        columns = []
        for row in cursor.fetchall():
            columns.append({
                "cid": row["cid"],
                "name": row["name"],
                "type": row["type"],
                "notnull": bool(row["notnull"]),
                "default_value": row["dflt_value"],
                "pk": bool(row["pk"]),
            })
        return columns
    finally:
        conn.close()


def get_rows(
    project_name: str,
    db_path: str,
    table_name: str,
    page: int = 1,
    page_size: int = 50,
    sort_column: Optional[str] = None,
    sort_direction: str = "ASC",
) -> dict:
    """Get paginated rows from a table."""
    conn = _get_connection(project_name, db_path)
    try:
        # Validate table name
        tables = get_tables(project_name, db_path)
        if table_name not in tables:
            raise ValueError(f"Table not found: {table_name}")

        # Get total count
        count_cursor = conn.execute(f"SELECT COUNT(*) as cnt FROM \"{table_name}\"")
        total = count_cursor.fetchone()["cnt"]

        # Build query with pagination
        offset = (page - 1) * page_size
        query = f"SELECT * FROM \"{table_name}\""

        if sort_column:
            # Validate sort column exists
            schema = get_table_schema(project_name, db_path, table_name)
            valid_columns = [col["name"] for col in schema]
            if sort_column in valid_columns:
                direction = "DESC" if sort_direction.upper() == "DESC" else "ASC"
                query += f" ORDER BY \"{sort_column}\" {direction}"

        query += f" LIMIT {page_size} OFFSET {offset}"

        cursor = conn.execute(query)
        columns = [description[0] for description in cursor.description]
        rows_raw = cursor.fetchall()

        rows = []
        for row in rows_raw:
            row_dict = {}
            for i, col in enumerate(columns):
                val = row[i]
                # Convert bytes to string representation
                if isinstance(val, bytes):
                    val = f"<binary: {len(val)} bytes>"
                row_dict[col] = val
            rows.append(row_dict)

        return {
            "columns": columns,
            "rows": rows,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        }
    finally:
        conn.close()


def execute_query(project_name: str, db_path: str, query: str) -> dict:
    """Execute a read-only SQL query and return results.
    Only SELECT statements are allowed for safety.
    """
    # Validate query is read-only
    stripped = query.strip().upper()
    allowed_starts = ("SELECT", "PRAGMA", "EXPLAIN")
    if not any(stripped.startswith(s) for s in allowed_starts):
        raise ValueError(
            "Only SELECT, PRAGMA, and EXPLAIN queries are allowed. "
            "This is a read-only database viewer."
        )

    # Block dangerous operations even within SELECT
    dangerous_keywords = ["DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE", "ATTACH"]
    for keyword in dangerous_keywords:
        if keyword in stripped:
            raise ValueError(f"Query contains disallowed keyword: {keyword}")

    conn = _get_connection(project_name, db_path)
    try:
        cursor = conn.execute(query)

        if cursor.description:
            columns = [desc[0] for desc in cursor.description]
            rows_raw = cursor.fetchmany(1000)  # Limit to 1000 rows

            rows = []
            for row in rows_raw:
                row_dict = {}
                for i, col in enumerate(columns):
                    val = row[i]
                    if isinstance(val, bytes):
                        val = f"<binary: {len(val)} bytes>"
                    row_dict[col] = val
                rows.append(row_dict)

            return {
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "truncated": len(rows_raw) >= 1000,
            }
        else:
            return {
                "columns": [],
                "rows": [],
                "row_count": 0,
                "truncated": False,
            }
    finally:
        conn.close()
