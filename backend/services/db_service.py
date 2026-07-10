"""
Database Service
Provides SQLite and MySQL introspection and read-only query execution.
Discovers SQLite database files within project workspaces and manages MySQL connections.
"""

import os
import json
import sqlite3
import re
from pathlib import Path
from typing import Optional, List, Dict, Any

import pymysql
from services.file_service import get_project_path

# Paths to mock databases inside the project workspace
MOCK_DB_FILENAME = ".ide_mysql_mock.db"
MOCK_POSTGRES_FILENAME = ".ide_postgres_mock.db"
MOCK_MONGO_FILENAME = ".ide_mongo_mock.db"


def get_db_config_path(project_name: str, user_id: int) -> Path:
    """Get the path to the database configuration file."""
    return get_project_path(project_name, user_id) / ".ide_db_config.json"


def get_db_config(project_name: str, user_id: int) -> dict:
    """Read the database configuration for a project."""
    config_path = get_db_config_path(project_name, user_id)
    if config_path.exists():
        try:
            return json.loads(config_path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"type": "sqlite"}


def save_db_config(project_name: str, config: dict, user_id: int) -> dict:
    """Save the database configuration for a project."""
    config_path = get_db_config_path(project_name, user_id)
    config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
    return config


def find_databases(project_name: str, user_id: int) -> list:
    """Find all SQLite database files and check configured databases."""
    project_path = get_project_path(project_name, user_id)
    databases = []

    # Common SQLite file extensions
    sqlite_extensions = {".db", ".sqlite", ".sqlite3", ".db3"}

    for file_path in project_path.rglob("*"):
        if file_path.is_file() and file_path.suffix in sqlite_extensions:
            # Hide internal mock databases
            if file_path.name in (MOCK_DB_FILENAME, MOCK_POSTGRES_FILENAME, MOCK_MONGO_FILENAME):
                continue
            rel_path = str(file_path.relative_to(project_path)).replace("\\", "/")
            try:
                # Verify it's a valid SQLite file
                conn = sqlite3.connect(str(file_path))
                conn.execute("SELECT 1")
                conn.close()
                databases.append({
                    "path": rel_path,
                    "name": file_path.name,
                    "type": "sqlite",
                    "size": file_path.stat().st_size,
                })
            except Exception:
                pass

    # Check for configured databases (MySQL, Postgres, MongoDB)
    config = get_db_config(project_name, user_id)
    db_type = config.get("type", "sqlite")
    if db_type in ("mysql", "postgres", "mongodb"):
        db_name = config.get("database", "unknown")
        databases.append({
            "path": f"{db_type}_config",
            "name": f"{db_type.upper()}: {db_name}",
            "type": db_type,
            "size": 0,
        })

    return databases


def _init_mock_db(project_path: Path, filename: str, db_type: str):
    """Initialize mock tables inside SQLite files to simulate MySQL, Postgres, or MongoDB databases."""
    db_path = project_path / filename
    if db_path.exists():
        return
    
    conn = sqlite3.connect(str(db_path))
    try:
        if db_type == "postgres":
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS pg_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    full_name TEXT,
                    status TEXT DEFAULT 'active',
                    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS pg_articles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    author_id INTEGER,
                    title TEXT NOT NULL,
                    content TEXT,
                    published BOOLEAN DEFAULT 0,
                    FOREIGN KEY(author_id) REFERENCES pg_users(id)
                );
            """)
            conn.executemany(
                "INSERT INTO pg_users (email, full_name, status) VALUES (?, ?, ?)",
                [
                    ("john@postgres.org", "John Doe", "active"),
                    ("jane@postgres.org", "Jane Smith", "active"),
                    ("disabled_user@postgres.org", "Legacy User", "suspended")
                ]
            )
            conn.executemany(
                "INSERT INTO pg_articles (author_id, title, content, published) VALUES (?, ?, ?, ?)",
                [
                    (1, "Getting Started with Postgres", "Postgres is amazing...", 1),
                    (1, "Advanced SQL Queries", "Let's talk about window functions...", 0),
                    (2, "NoSQL vs SQL", "A detailed comparison...", 1)
                ]
            )
        elif db_type == "mongodb":
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS mongo_tasks (
                    _id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    priority INTEGER DEFAULT 1,
                    tags TEXT
                );
                CREATE TABLE IF NOT EXISTS mongo_logs (
                    _id TEXT PRIMARY KEY,
                    level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.executemany(
                "INSERT INTO mongo_tasks (_id, title, status, priority, tags) VALUES (?, ?, ?, ?, ?)",
                [
                    ("65f123456789abcdef000001", "Design IDE Interface", "completed", 3, "frontend,design"),
                    ("65f123456789abcdef000002", "Connect MongoDB Browser", "in-progress", 2, "backend,database"),
                    ("65f123456789abcdef000003", "Test Docker Sandbox", "pending", 1, "ops,security")
                ]
            )
            conn.executemany(
                "INSERT INTO mongo_logs (_id, level, message) VALUES (?, ?, ?)",
                [
                    ("65f2123456789abcdef00001", "INFO", "Web IDE Started successfully on port 8000"),
                    ("65f2123456789abcdef00002", "WARNING", "High memory usage detected on sandbox"),
                    ("65f2123456789abcdef00003", "ERROR", "Failed to connect to primary MongoDB cluster")
                ]
            )
        else: # mysql
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT NOT NULL,
                    role TEXT DEFAULT 'developer',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    price REAL NOT NULL,
                    stock INTEGER DEFAULT 10,
                    category TEXT
                );
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    product_id INTEGER,
                    quantity INTEGER,
                    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id),
                    FOREIGN KEY(product_id) REFERENCES products(id)
                );
            """)
            conn.executemany(
                "INSERT INTO users (username, email, role) VALUES (?, ?, ?)",
                [
                    ("admin", "admin@cloudide.dev", "administrator"),
                    ("sahil", "sahil@yuvro.com", "developer"),
                    ("test_user", "test@test.com", "guest")
                ]
            )
            conn.executemany(
                "INSERT INTO products (name, price, stock, category) VALUES (?, ?, ?, ?)",
                [
                    ("MacBook Pro M3", 1999.99, 15, "Computers"),
                    ("iPhone 15 Pro", 999.50, 45, "Phones"),
                    ("AirPods Max", 549.00, 8, "Audio")
                ]
            )
            conn.executemany(
                "INSERT INTO orders (user_id, product_id, quantity) VALUES (?, ?, ?)",
                [
                    (1, 1, 1),
                    (2, 2, 2),
                    (2, 3, 1)
                ]
            )
        conn.commit()
    finally:
        conn.close()


def _get_sqlite_connection(project_name: str, db_path: str, user_id: int) -> sqlite3.Connection:
    """Get a read-only SQLite connection to a database file."""
    project_path = get_project_path(project_name, user_id)
    full_path = (project_path / db_path).resolve()

    # Safety: ensure the path is within the project
    if not str(full_path).lower().startswith(str(project_path.resolve()).lower()):
        raise ValueError("Invalid database path: directory traversal detected")

    if not full_path.exists():
        raise FileNotFoundError(f"Database file not found: {db_path}")

    # Connect in read-only mode using URI
    uri = f"file:{full_path}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _is_mock_required(config: dict) -> bool:
    """Check if the connection should run in mock mode."""
    return (config.get("mock") is True) or (config.get("host") == "localhost" and not config.get("password"))


def _get_mysql_connection_or_mock(project_name: str, user_id: int) -> Any:
    """Get a MySQL connection using PyMySQL, falling back to a mock SQLite database."""
    config = get_db_config(project_name, user_id)
    project_path = get_project_path(project_name, user_id)

    if _is_mock_required(config):
        _init_mock_db(project_path, MOCK_DB_FILENAME, "mysql")
        conn = sqlite3.connect(str(project_path / MOCK_DB_FILENAME))
        conn.row_factory = sqlite3.Row
        return conn, True

    try:
        conn = pymysql.connect(
            host=config.get("host", "127.0.0.1"),
            port=config.get("port", 3306),
            user=config.get("user", "root"),
            password=config.get("password", ""),
            database=config.get("database"),
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=3
        )
        return conn, False
    except Exception:
        _init_mock_db(project_path, MOCK_DB_FILENAME, "mysql")
        conn = sqlite3.connect(str(project_path / MOCK_DB_FILENAME))
        conn.row_factory = sqlite3.Row
        return conn, True


def _get_postgres_connection_or_mock(project_name: str, user_id: int) -> Any:
    """Get a PostgreSQL connection, falling back to mock SQLite database."""
    config = get_db_config(project_name, user_id)
    project_path = get_project_path(project_name, user_id)

    if _is_mock_required(config):
        _init_mock_db(project_path, MOCK_POSTGRES_FILENAME, "postgres")
        conn = sqlite3.connect(str(project_path / MOCK_POSTGRES_FILENAME))
        conn.row_factory = sqlite3.Row
        return conn, True

    try:
        import pg8000.dbapi
        conn = pg8000.dbapi.connect(
            host=config.get("host", "127.0.0.1"),
            port=int(config.get("port", 5432)),
            user=config.get("user", "postgres"),
            password=config.get("password", ""),
            database=config.get("database"),
            timeout=3
        )
        return conn, False
    except Exception:
        _init_mock_db(project_path, MOCK_POSTGRES_FILENAME, "postgres")
        conn = sqlite3.connect(str(project_path / MOCK_POSTGRES_FILENAME))
        conn.row_factory = sqlite3.Row
        return conn, True


def _get_mongodb_connection_or_mock(project_name: str, user_id: int) -> Any:
    """Get a MongoDB client + database connection, falling back to mock SQLite database."""
    config = get_db_config(project_name, user_id)
    project_path = get_project_path(project_name, user_id)

    if _is_mock_required(config):
        _init_mock_db(project_path, MOCK_MONGO_FILENAME, "mongodb")
        conn = sqlite3.connect(str(project_path / MOCK_MONGO_FILENAME))
        conn.row_factory = sqlite3.Row
        return conn, True

    try:
        from pymongo import MongoClient
        client = MongoClient(
            host=config.get("host", "127.0.0.1"),
            port=int(config.get("port", 27017)),
            username=config.get("user") or None,
            password=config.get("password") or None,
            authSource=config.get("database") or "admin",
            serverSelectionTimeoutMS=2000
        )
        # Verify connection
        client.server_info()
        db = client[config.get("database", "admin")]
        return (client, db), False
    except Exception:
        _init_mock_db(project_path, MOCK_MONGO_FILENAME, "mongodb")
        conn = sqlite3.connect(str(project_path / MOCK_MONGO_FILENAME))
        conn.row_factory = sqlite3.Row
        return conn, True


def get_tables(project_name: str, db_path: str, user_id: int) -> list:
    """List all tables or collections in a database."""
    if db_path == "mysql_config":
        conn, is_mock = _get_mysql_connection_or_mock(project_name, user_id)
        try:
            if is_mock:
                cursor = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
                )
                return [row["name"] for row in cursor.fetchall()]
            else:
                with conn.cursor() as cursor:
                    cursor.execute("SHOW TABLES")
                    rows = cursor.fetchall()
                    return [list(row.values())[0] for row in rows]
        finally:
            conn.close()

    elif db_path == "postgres_config":
        conn, is_mock = _get_postgres_connection_or_mock(project_name, user_id)
        try:
            if is_mock:
                cursor = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
                )
                return [row["name"] for row in cursor.fetchall()]
            else:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
                )
                return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()

    elif db_path == "mongodb_config":
        res, is_mock = _get_mongodb_connection_or_mock(project_name, user_id)
        if is_mock:
            try:
                cursor = res.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
                )
                return [row["name"] for row in cursor.fetchall()]
            finally:
                res.close()
        else:
            client, db = res
            try:
                return db.list_collection_names()
            finally:
                client.close()

    else:
        conn = _get_sqlite_connection(project_name, db_path, user_id)
        try:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
            return [row["name"] for row in cursor.fetchall()]
        finally:
            conn.close()


def get_table_schema(project_name: str, db_path: str, table_name: str, user_id: int) -> list:
    """Get the column attributes or document schema of a specific table/collection."""
    tables = get_tables(project_name, db_path, user_id)
    if table_name not in tables:
        raise ValueError(f"Table or Collection not found: {table_name}")

    if db_path == "mysql_config":
        conn, is_mock = _get_mysql_connection_or_mock(project_name, user_id)
        try:
            if is_mock:
                cursor = conn.execute(f"PRAGMA table_info(\"{table_name}\")")
                return [{
                    "cid": row["cid"],
                    "name": row["name"],
                    "type": row["type"],
                    "notnull": bool(row["notnull"]),
                    "default_value": row["dflt_value"],
                    "pk": bool(row["pk"]),
                } for row in cursor.fetchall()]
            else:
                with conn.cursor() as cursor:
                    cursor.execute(f"SHOW COLUMNS FROM `{table_name}`")
                    rows = cursor.fetchall()
                    return [{
                        "cid": i,
                        "name": row["Field"],
                        "type": row["Type"],
                        "notnull": row["Null"] == "NO",
                        "default_value": row["Default"],
                        "pk": row["Key"] == "PRI",
                    } for i, row in enumerate(rows)]
        finally:
            conn.close()

    elif db_path == "postgres_config":
        conn, is_mock = _get_postgres_connection_or_mock(project_name, user_id)
        try:
            if is_mock:
                cursor = conn.execute(f"PRAGMA table_info(\"{table_name}\")")
                return [{
                    "cid": row["cid"],
                    "name": row["name"],
                    "type": row["type"],
                    "notnull": bool(row["notnull"]),
                    "default_value": row["dflt_value"],
                    "pk": bool(row["pk"]),
                } for row in cursor.fetchall()]
            else:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns 
                    WHERE table_name = %s ORDER BY ordinal_position
                """, (table_name,))
                rows = cursor.fetchall()
                
                cursor.execute("""
                    SELECT kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu 
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = %s
                """, (table_name,))
                pks = {r[0] for r in cursor.fetchall()}
                
                return [{
                    "cid": i,
                    "name": r[0],
                    "type": r[1],
                    "notnull": r[2] == "NO",
                    "default_value": r[3],
                    "pk": r[0] in pks,
                } for i, r in enumerate(rows)]
        finally:
            conn.close()

    elif db_path == "mongodb_config":
        res, is_mock = _get_mongodb_connection_or_mock(project_name, user_id)
        if is_mock:
            try:
                cursor = res.execute(f"PRAGMA table_info(\"{table_name}\")")
                return [{
                    "cid": row["cid"],
                    "name": row["name"],
                    "type": row["type"],
                    "notnull": bool(row["notnull"]),
                    "default_value": row["dflt_value"],
                    "pk": bool(row["pk"]),
                } for row in cursor.fetchall()]
            finally:
                res.close()
        else:
            client, db = res
            try:
                # Sample 10 documents to infer document structure
                sample_docs = list(db[table_name].find().limit(10))
                fields = {}
                for doc in sample_docs:
                    for k, v in doc.items():
                        fields[k] = type(v).__name__
                if not fields:
                    fields["_id"] = "ObjectId"
                
                return [{
                    "cid": i,
                    "name": name,
                    "type": ftype,
                    "notnull": False,
                    "default_value": None,
                    "pk": name == "_id",
                } for i, (name, ftype) in enumerate(fields.items())]
            finally:
                client.close()

    else:
        conn = _get_sqlite_connection(project_name, db_path, user_id)
        try:
            cursor = conn.execute(f"PRAGMA table_info(\"{table_name}\")")
            return [{
                "cid": row["cid"],
                "name": row["name"],
                "type": row["type"],
                "notnull": bool(row["notnull"]),
                "default_value": row["dflt_value"],
                "pk": bool(row["pk"]),
            } for row in cursor.fetchall()]
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
    user_id: int = None,
) -> dict:
    """Get paginated rows/documents from a table/collection."""
    if user_id is None:
        raise ValueError("user_id is required for get_rows")

    tables = get_tables(project_name, db_path, user_id)
    if table_name not in tables:
        raise ValueError(f"Table not found: {table_name}")

    offset = (page - 1) * page_size

    if db_path == "mysql_config":
        conn, is_mock = _get_mysql_connection_or_mock(project_name, user_id)
        try:
            if is_mock:
                return _get_sqlite_paginated_rows(conn, table_name, page, page_size, sort_column, sort_direction, project_name, db_path, user_id)
            else:
                with conn.cursor() as cursor:
                    cursor.execute(f"SELECT COUNT(*) as cnt FROM `{table_name}`")
                    total = cursor.fetchone()["cnt"]
                    
                    query = f"SELECT * FROM `{table_name}`"
                    if sort_column:
                        schema = get_table_schema(project_name, db_path, table_name, user_id)
                        valid_columns = [col["name"] for col in schema]
                        if sort_column in valid_columns:
                            direction = "DESC" if sort_direction.upper() == "DESC" else "ASC"
                            query += f" ORDER BY `{sort_column}` {direction}"
                    query += f" LIMIT {page_size} OFFSET {offset}"
                    
                    cursor.execute(query)
                    rows = cursor.fetchall()
                    columns = [desc[0] for desc in cursor.description] if cursor.description else []
                    
                    # Convert bytes or datetimes to serializable types
                    for row in rows:
                        for col in columns:
                            if isinstance(row[col], bytes):
                                row[col] = f"<binary: {len(row[col])} bytes>"
                            elif row[col] is not None and not isinstance(row[col], (int, float, str, bool)):
                                row[col] = str(row[col])
                                
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

    elif db_path == "postgres_config":
        conn, is_mock = _get_postgres_connection_or_mock(project_name, user_id)
        try:
            if is_mock:
                return _get_sqlite_paginated_rows(conn, table_name, page, page_size, sort_column, sort_direction, project_name, db_path, user_id)
            else:
                cursor = conn.cursor()
                cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
                total = cursor.fetchone()[0]
                
                query = f'SELECT * FROM "{table_name}"'
                if sort_column:
                    schema = get_table_schema(project_name, db_path, table_name, user_id)
                    valid_columns = [col["name"] for col in schema]
                    if sort_column in valid_columns:
                        direction = "DESC" if sort_direction.upper() == "DESC" else "ASC"
                        query += f' ORDER BY "{sort_column}" {direction}'
                query += f" LIMIT {page_size} OFFSET {offset}"
                
                cursor.execute(query)
                rows_raw = cursor.fetchall()
                columns = [desc[0] for desc in cursor.description]
                
                rows = []
                for row in rows_raw:
                    row_dict = {}
                    for i, col in enumerate(columns):
                        val = row[i]
                        if isinstance(val, bytes):
                            val = f"<binary: {len(val)} bytes>"
                        elif val is not None and not isinstance(val, (int, float, str, bool)):
                            val = str(val)
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

    elif db_path == "mongodb_config":
        res, is_mock = _get_mongodb_connection_or_mock(project_name, user_id)
        if is_mock:
            try:
                return _get_sqlite_paginated_rows(res, table_name, page, page_size, sort_column, sort_direction, project_name, db_path, user_id)
            finally:
                res.close()
        else:
            client, db = res
            try:
                collection = db[table_name]
                total = collection.count_documents({})
                
                cursor = collection.find()
                if sort_column:
                    direction = -1 if sort_direction.upper() == "DESC" else 1
                    cursor = cursor.sort(sort_column, direction)
                cursor = cursor.skip(offset).limit(page_size)
                
                rows_raw = list(cursor)
                columns = set()
                for doc in rows_raw:
                    columns.update(doc.keys())
                columns = sorted(list(columns), key=lambda x: (x != "_id", x))
                
                rows = []
                for doc in rows_raw:
                    row_dict = {}
                    for col in columns:
                        val = doc.get(col)
                        if val is None:
                            row_dict[col] = None
                        elif col == "_id":
                            row_dict[col] = str(val)
                        elif isinstance(val, (dict, list)):
                            row_dict[col] = json.dumps(val)
                        else:
                            row_dict[col] = str(val)
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
                client.close()

    else:
        conn = _get_sqlite_connection(project_name, db_path, user_id)
        try:
            return _get_sqlite_paginated_rows(conn, table_name, page, page_size, sort_column, sort_direction, project_name, db_path, user_id)
        finally:
            conn.close()


def _get_sqlite_paginated_rows(conn: sqlite3.Connection, table_name: str, page: int, page_size: int, sort_column: Optional[str], sort_direction: str, project_name: str, db_path: str, user_id: int) -> dict:
    """Helper to fetch paginated rows from a SQLite database connection."""
    offset = (page - 1) * page_size
    count_cursor = conn.execute(f"SELECT COUNT(*) as cnt FROM \"{table_name}\"")
    total = count_cursor.fetchone()["cnt"]

    query = f"SELECT * FROM \"{table_name}\""
    if sort_column:
        schema = get_table_schema(project_name, db_path, table_name, user_id)
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


def execute_query(project_name: str, db_path: str, query: str, user_id: int) -> dict:
    """Execute a read-only query on SQL or NoSQL database."""
    # Check for NoSQL vs SQL
    if db_path == "mongodb_config":
        res, is_mock = _get_mongodb_connection_or_mock(project_name, user_id)
        if is_mock:
            # Re-route mock mongo SQL queries through normal SQLite executor
            try:
                return _execute_sqlite_query(res, query)
            finally:
                res.close()
        else:
            client, db = res
            try:
                # MongoDB query is parsed as JSON
                try:
                    query_dict = json.loads(query)
                except Exception:
                    raise ValueError(
                        "Invalid MongoDB query. Please provide a JSON string, e.g.:\n"
                        '{"collection": "mongo_tasks", "find": {"status": "completed"}, "limit": 100}'
                    )
                
                col_name = query_dict.get("collection")
                if not col_name:
                    raise ValueError("MongoDB query JSON must specify a 'collection' field.")
                if col_name not in db.list_collection_names():
                    raise ValueError(f"Collection '{col_name}' does not exist.")
                
                find_filter = query_dict.get("find", {})
                sort_filter = query_dict.get("sort", None)
                limit = min(int(query_dict.get("limit", 100)), 1000)
                
                cursor = db[col_name].find(find_filter)
                if sort_filter:
                    cursor = cursor.sort(list(sort_filter.items()))
                cursor = cursor.limit(limit)
                
                rows_raw = list(cursor)
                columns = set()
                for doc in rows_raw:
                    columns.update(doc.keys())
                columns = sorted(list(columns), key=lambda x: (x != "_id", x))
                
                rows = []
                for doc in rows_raw:
                    row_dict = {}
                    for col in columns:
                        val = doc.get(col)
                        if val is None:
                            row_dict[col] = None
                        elif col == "_id":
                            row_dict[col] = str(val)
                        elif isinstance(val, (dict, list)):
                            row_dict[col] = json.dumps(val)
                        else:
                            row_dict[col] = str(val)
                    rows.append(row_dict)
                    
                return {
                    "columns": columns,
                    "rows": rows,
                    "row_count": len(rows),
                    "truncated": len(rows_raw) >= limit,
                }
            finally:
                client.close()

    # SQL DB execution
    stripped = query.strip().upper()
    allowed_starts = ("SELECT", "PRAGMA", "EXPLAIN", "SHOW", "DESCRIBE")
    if not any(stripped.startswith(s) for s in allowed_starts):
        raise ValueError(
            "Only SELECT, PRAGMA, SHOW, DESCRIBE, and EXPLAIN queries are allowed. "
            "This is a read-only database viewer."
        )

    # Block dangerous mutations
    dangerous_keywords = ["DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE", "ATTACH", "REPLACE"]
    for keyword in dangerous_keywords:
        if re.search(r'\b' + re.escape(keyword) + r'\b', stripped):
            raise ValueError(f"Query contains disallowed mutation keyword: {keyword}")

    if db_path == "mysql_config":
        conn, is_mock = _get_mysql_connection_or_mock(project_name, user_id)
        try:
            if is_mock:
                return _execute_sqlite_query(conn, query)
            else:
                with conn.cursor() as cursor:
                    cursor.execute(query)
                    if cursor.description:
                        columns = [desc[0] for desc in cursor.description]
                        rows = cursor.fetchmany(1000)
                        
                        # Format outputs
                        for r in rows:
                            for c in columns:
                                if isinstance(r[c], bytes):
                                    r[c] = f"<binary: {len(r[c])} bytes>"
                                elif r[c] is not None and not isinstance(r[c], (int, float, str, bool)):
                                    r[c] = str(r[c])
                                    
                        return {
                            "columns": columns,
                            "rows": rows,
                            "row_count": len(rows),
                            "truncated": len(rows) >= 1000,
                        }
        finally:
            conn.close()

    elif db_path == "postgres_config":
        conn, is_mock = _get_postgres_connection_or_mock(project_name, user_id)
        try:
            if is_mock:
                return _execute_sqlite_query(conn, query)
            else:
                cursor = conn.cursor()
                cursor.execute(query)
                if cursor.description:
                    columns = [desc[0] for desc in cursor.description]
                    rows_raw = cursor.fetchmany(1000)
                    
                    rows = []
                    for row in rows_raw:
                        row_dict = {}
                        for i, col in enumerate(columns):
                            val = row[i]
                            if isinstance(val, bytes):
                                val = f"<binary: {len(val)} bytes>"
                            elif val is not None and not isinstance(val, (int, float, str, bool)):
                                val = str(val)
                            row_dict[col] = val
                        rows.append(row_dict)
                        
                    return {
                        "columns": columns,
                        "rows": rows,
                        "row_count": len(rows),
                        "truncated": len(rows_raw) >= 1000,
                    }
        finally:
            conn.close()

    else:
        conn = _get_sqlite_connection(project_name, db_path, user_id)
        try:
            return _execute_sqlite_query(conn, query)
        finally:
            conn.close()


def _execute_sqlite_query(conn: sqlite3.Connection, query: str) -> dict:
    """Helper to execute custom query on SQLite database connection."""
    cursor = conn.execute(query)
    if cursor.description:
        columns = [desc[0] for desc in cursor.description]
        rows_raw = cursor.fetchmany(1000)

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

    return {
        "columns": [],
        "rows": [],
        "row_count": 0,
        "truncated": False,
    }


def provision_database(project_name: str, config: dict, user_id: int) -> dict:
    """Dynamic DB schema creation for isolated database environments."""
    db_type = config.get("type", "sqlite")
    if db_type == "sqlite":
        # SQLite DB is already provisioned by creating a workspace file
        return {"type": "sqlite", "message": "SQLite database is provisioned locally in the workspace."}

    # Generate an isolated database name specific to the user, project, and db type
    safe_project = re.sub(r'[^a-zA-Z0-9_]', '_', project_name).lower()
    db_name = f"ide_user_{user_id}_{safe_project}_{db_type}"
    config["database"] = db_name

    # If simulated mock fallback is requested, update configuration and exit early
    if _is_mock_required(config):
        project_path = get_project_path(project_name, user_id)
        if db_type == "mysql":
            _init_mock_db(project_path, MOCK_DB_FILENAME, "mysql")
        elif db_type == "postgres":
            _init_mock_db(project_path, MOCK_POSTGRES_FILENAME, "postgres")
        elif db_type == "mongodb":
            _init_mock_db(project_path, MOCK_MONGO_FILENAME, "mongodb")
            
        save_db_config(project_name, config, user_id)
        return {
            "status": "success",
            "database": db_name,
            "message": f"Successfully simulated/provisioned isolated mock database '{db_name}'",
            "config": config
        }

    # Provision on real database server
    try:
        if db_type == "mysql":
            # Connect to MySQL server (without selecting db)
            conn = pymysql.connect(
                host=config.get("host", "127.0.0.1"),
                port=int(config.get("port", 3306)),
                user=config.get("user", "root"),
                password=config.get("password", ""),
                connect_timeout=3
            )
            try:
                with conn.cursor() as cursor:
                    # Create database
                    cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}`")
                conn.commit()
            finally:
                conn.close()

        elif db_type == "postgres":
            import pg8000.dbapi
            # Connect to Postgres database (using 'postgres' default database)
            conn = pg8000.dbapi.connect(
                host=config.get("host", "127.0.0.1"),
                port=int(config.get("port", 5432)),
                user=config.get("user", "postgres"),
                password=config.get("password", ""),
                database="postgres",
                timeout=3
            )
            # CREATE DATABASE cannot run inside transaction
            conn.autocommit = True
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
                if not cursor.fetchone():
                    cursor.execute(f'CREATE DATABASE "{db_name}"')
            finally:
                conn.close()

        elif db_type == "mongodb":
            from pymongo import MongoClient
            client = MongoClient(
                host=config.get("host", "127.0.0.1"),
                port=int(config.get("port", 27017)),
                username=config.get("user") or None,
                password=config.get("password") or None,
                serverSelectionTimeoutMS=2000
            )
            # Create a collection to force MongoDB database instantiation
            db = client[db_name]
            db["_provision"].insert_one({"provisioned": True})
            client.close()

        # Save connection details to settings file
        save_db_config(project_name, config, user_id)
        
        return {
            "status": "success",
            "database": db_name,
            "message": f"Successfully provisioned isolated database '{db_name}' on the server.",
            "config": config
        }
    except Exception as e:
        raise RuntimeError(f"Database provisioning failed: {str(e)}")
