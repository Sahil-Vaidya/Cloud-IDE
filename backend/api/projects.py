"""
Project Management API Endpoints
Create, list, delete projects and clone from GitHub.
"""

import os
import shutil
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException, File, UploadFile, Form, Depends
from pydantic import BaseModel
from typing import Optional

from services.file_service import WORKSPACES_DIR, get_project_path
from api.auth import get_current_user

router = APIRouter(prefix="/api/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str
    template: Optional[str] = None  # "django", "flask", "fastapi", "blank"


class CloneProjectRequest(BaseModel):
    name: str
    url: str


# ─── Django template files ───────────────────────────────────────────

DJANGO_MANAGE_PY = '''#!/usr/bin/env python
"""Django\'s command-line utility for administrative tasks."""
import os
import sys

def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn\'t import Django. Are you sure it\'s installed?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == "__main__":
    main()
'''

DJANGO_SETTINGS = '''"""Django settings."""
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = "django-insecure-change-me-in-production"
DEBUG = True
ALLOWED_HOSTS = ["*"]
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [], "APP_DIRS": True, "OPTIONS": {"context_processors": ["django.template.context_processors.debug", "django.template.context_processors.request", "django.contrib.auth.context_processors.auth", "django.contrib.messages.context_processors.messages"]}}]
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
STATIC_URL = "static/"
'''

DJANGO_URLS = '''"""URL configuration."""
from django.contrib import admin
from django.urls import path

urlpatterns = [
    path("admin/", admin.site.urls),
]
'''

# ─── Flask template ──────────────────────────────────────────────────

FLASK_APP = '''"""Flask application with CRUD Task Manager."""
import sqlite3
from flask import Flask, jsonify, request, render_template_string

app = Flask(__name__)

def init_db():
    conn = sqlite3.connect("db.sqlite3")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            completed BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_db()

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    conn = sqlite3.connect("db.sqlite3")
    conn.row_factory = sqlite3.Row
    cursor = conn.execute("SELECT * FROM tasks ORDER BY created_at DESC")
    tasks = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(tasks)

@app.route("/api/tasks", methods=["POST"])
def create_task():
    data = request.get_json() or {}
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Task title cannot be empty"}), 400
    conn = sqlite3.connect("db.sqlite3")
    cursor = conn.execute("INSERT INTO tasks (title) VALUES (?)", (title,))
    task_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return jsonify({"id": task_id, "title": title, "completed": False})

@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    data = request.get_json() or {}
    completed = int(data.get("completed", False))
    conn = sqlite3.connect("db.sqlite3")
    cursor = conn.execute("UPDATE tasks SET completed = ? WHERE id = ?", (completed, task_id))
    conn.commit()
    rowcount = cursor.rowcount
    conn.close()
    if rowcount == 0:
        return jsonify({"error": "Task not found"}), 404
    return jsonify({"id": task_id, "completed": bool(completed)})

@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    conn = sqlite3.connect("db.sqlite3")
    cursor = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    rowcount = cursor.rowcount
    conn.close()
    if rowcount == 0:
        return jsonify({"error": "Task not found"}), 404
    return jsonify({"deleted": True})

@app.route("/")
def index():
    return render_template_string("""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Manager</title>
    <style>
        :root {
            --bg: #0b0813;
            --panel: rgba(18, 12, 34, 0.75);
            --border: rgba(138, 43, 226, 0.3);
            --primary: #8a2be2;
            --secondary: #00f2fe;
            --text: #f1edfc;
            --text-muted: #8c85a3;
        }
        body {
            background-color: var(--bg);
            color: var(--text);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 40px 16px;
            display: flex;
            justify-content: center;
        }
        .container {
            width: 100%;
            max-width: 480px;
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
        }
        h2 {
            margin: 0 0 20px 0;
            text-align: center;
            font-weight: 700;
            background: linear-gradient(135deg, var(--secondary), var(--primary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .input-group {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
        }
        input {
            flex: 1;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 10px 12px;
            color: #fff;
            outline: none;
            font-size: 14px;
            transition: border-color 0.2s;
        }
        input:focus {
            border-color: var(--secondary);
        }
        button {
            background: linear-gradient(135deg, var(--primary), #52188c);
            border: none;
            border-radius: 8px;
            color: #fff;
            padding: 10px 16px;
            cursor: pointer;
            font-weight: 600;
            transition: opacity 0.2s;
        }
        button:hover {
            opacity: 0.9;
        }
        .task-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .task-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border);
            border-radius: 8px;
        }
        .task-text {
            cursor: pointer;
            flex: 1;
            font-size: 14px;
        }
        .task-text.completed {
            text-decoration: line-through;
            color: var(--text-muted);
        }
        .delete-btn {
            background: transparent;
            border: none;
            color: #ff4a4a;
            font-size: 12px;
            cursor: pointer;
            padding: 4px;
        }
        .delete-btn:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Task Manager</h2>
        <div class="input-group">
            <input type="text" id="task-input" placeholder="What needs to be done?" />
            <button onclick="addTask()">Add Task</button>
        </div>
        <ul id="task-list" class="task-list"></ul>
    </div>
    <script>
        async function fetchTasks() {
            const res = await fetch('/api/tasks');
            const tasks = await res.json();
            const list = document.getElementById('task-list');
            list.innerHTML = '';
            tasks.forEach(task => {
                const li = document.createElement('li');
                li.className = 'task-item';
                li.innerHTML = `
                    <span class="task-text ${task.completed ? 'completed' : ''}" onclick="toggleTask(${task.id}, ${task.completed})">
                        ${task.completed ? '✅' : '⬜'} ${task.title}
                    </span>
                    <button class="delete-btn" onclick="deleteTask(${task.id})">Delete</button>
                `;
                list.appendChild(li);
            });
        }

        async function addTask() {
            const input = document.getElementById('task-input');
            const title = input.value.trim();
            if (!title) return;
            await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            });
            input.value = '';
            fetchTasks();
        }

        async function toggleTask(id, currentStatus) {
            await fetch(`/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: !currentStatus })
            });
            fetchTasks();
        }

        async function deleteTask(id) {
            if (!confirm('Delete this task?')) return;
            await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
            fetchTasks();
        }

        fetchTasks();
    </script>
</body>
</html>""")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
'''

# ─── FastAPI template ────────────────────────────────────────────────

FASTAPI_APP = '''"""FastAPI application with CRUD Task Manager."""
import sqlite3
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

app = FastAPI(title="FastAPI CRUD Task Manager")

# Setup SQLite Database
def init_db():
    conn = sqlite3.connect("db.sqlite3")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            completed BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_db()

class TaskCreate(BaseModel):
    title: str

class TaskUpdate(BaseModel):
    completed: bool

@app.get("/api/tasks")
def get_tasks():
    conn = sqlite3.connect("db.sqlite3")
    conn.row_factory = sqlite3.Row
    cursor = conn.execute("SELECT * FROM tasks ORDER BY created_at DESC")
    tasks = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return tasks

@app.post("/api/tasks")
def create_task(task: TaskCreate):
    title = task.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Task title cannot be empty")
    conn = sqlite3.connect("db.sqlite3")
    cursor = conn.execute("INSERT INTO tasks (title) VALUES (?)", (title,))
    task_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": task_id, "title": title, "completed": False}

@app.put("/api/tasks/{task_id}")
def update_task(task_id: int, task: TaskUpdate):
    conn = sqlite3.connect("db.sqlite3")
    cursor = conn.execute("UPDATE tasks SET completed = ? WHERE id = ?", (int(task.completed), task_id))
    conn.commit()
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")
    conn.close()
    return {"id": task_id, "completed": task.completed}

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int):
    conn = sqlite3.connect("db.sqlite3")
    cursor = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")
    conn.close()
    return {"deleted": True}

@app.get("/", response_class=HTMLResponse)
def index():
    return """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Manager</title>
    <style>
        :root {
            --bg: #0b0813;
            --panel: rgba(18, 12, 34, 0.75);
            --border: rgba(138, 43, 226, 0.3);
            --primary: #8a2be2;
            --secondary: #00f2fe;
            --text: #f1edfc;
            --text-muted: #8c85a3;
        }
        body {
            background-color: var(--bg);
            color: var(--text);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 40px 16px;
            display: flex;
            justify-content: center;
        }
        .container {
            width: 100%;
            max-width: 480px;
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
        }
        h2 {
            margin: 0 0 20px 0;
            text-align: center;
            font-weight: 700;
            background: linear-gradient(135deg, var(--secondary), var(--primary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .input-group {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
        }
        input {
            flex: 1;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 10px 12px;
            color: #fff;
            outline: none;
            font-size: 14px;
            transition: border-color 0.2s;
        }
        input:focus {
            border-color: var(--secondary);
        }
        button {
            background: linear-gradient(135deg, var(--primary), #52188c);
            border: none;
            border-radius: 8px;
            color: #fff;
            padding: 10px 16px;
            cursor: pointer;
            font-weight: 600;
            transition: opacity 0.2s;
        }
        button:hover {
            opacity: 0.9;
        }
        .task-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .task-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border);
            border-radius: 8px;
        }
        .task-text {
            cursor: pointer;
            flex: 1;
            font-size: 14px;
        }
        .task-text.completed {
            text-decoration: line-through;
            color: var(--text-muted);
        }
        .delete-btn {
            background: transparent;
            border: none;
            color: #ff4a4a;
            font-size: 12px;
            cursor: pointer;
            padding: 4px;
        }
        .delete-btn:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Task Manager</h2>
        <div class="input-group">
            <input type="text" id="task-input" placeholder="What needs to be done?" />
            <button onclick="addTask()">Add Task</button>
        </div>
        <ul id="task-list" class="task-list"></ul>
    </div>
    <script>
        async function fetchTasks() {
            const res = await fetch('/api/tasks');
            const tasks = await res.json();
            const list = document.getElementById('task-list');
            list.innerHTML = '';
            tasks.forEach(task => {
                const li = document.createElement('li');
                li.className = 'task-item';
                li.innerHTML = `
                    <span class="task-text ${task.completed ? 'completed' : ''}" onclick="toggleTask(${task.id}, ${task.completed})">
                        ${task.completed ? '✅' : '⬜'} ${task.title}
                    </span>
                    <button class="delete-btn" onclick="deleteTask(${task.id})">Delete</button>
                `;
                list.appendChild(li);
            });
        }

        async function addTask() {
            const input = document.getElementById('task-input');
            const title = input.value.trim();
            if (!title) return;
            await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            });
            input.value = '';
            fetchTasks();
        }

        async function toggleTask(id, currentStatus) {
            await fetch(`/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: !currentStatus })
            });
            fetchTasks();
        }

        async function deleteTask(id) {
            if (!confirm('Delete this task?')) return;
            await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
            fetchTasks();
        }

        fetchTasks();
    </script>
</body>
</html>"""
'''


TEMPLATES = {
    "django": {
        "manage.py": DJANGO_MANAGE_PY,
        "config/__init__.py": "",
        "config/settings.py": DJANGO_SETTINGS,
        "config/urls.py": DJANGO_URLS,
        "config/wsgi.py": 'import os\nfrom django.core.wsgi import get_wsgi_application\nos.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")\napplication = get_wsgi_application()\n',
        "requirements.txt": "django>=4.2\n",
    },
    "flask": {
        "app.py": FLASK_APP,
        "requirements.txt": "flask>=3.0\n",
    },
    "fastapi": {
        "main.py": FASTAPI_APP,
        "requirements.txt": "fastapi>=0.115\nuvicorn[standard]>=0.30\n",
    },
    "blank": {
        "main.py": '"""Main entry point."""\n\nprint("Hello, World!")\n',
        "requirements.txt": "# Add your dependencies here\n",
    },
}


@router.get("")
async def list_projects(current_user: dict = Depends(get_current_user)):
    """List all projects in the user's workspaces directory."""
    user_dir = WORKSPACES_DIR / f"user_{current_user['id']}"
    user_dir.mkdir(parents=True, exist_ok=True)
    projects = []
    for entry in sorted(user_dir.iterdir()):
        if entry.is_dir() and not entry.name.startswith("."):
            # Count files
            file_count = sum(1 for _ in entry.rglob("*") if _.is_file())
            projects.append({
                "name": entry.name,
                "path": str(entry),
                "file_count": file_count,
                "size": sum(f.stat().st_size for f in entry.rglob("*") if f.is_file()),
            })
    return {"projects": projects}


@router.post("")
async def create_project(request: CreateProjectRequest, current_user: dict = Depends(get_current_user)):
    """Create a new project, optionally from a template."""
    name = request.name.strip()
    if not name or "/" in name or "\\" in name or ".." in name:
        raise HTTPException(status_code=400, detail="Invalid project name")

    user_dir = WORKSPACES_DIR / f"user_{current_user['id']}"
    user_dir.mkdir(parents=True, exist_ok=True)
    
    project_path = user_dir / name
    if project_path.exists():
        raise HTTPException(status_code=409, detail=f"Project '{name}' already exists")

    template = request.template or "blank"
    if template not in TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Unknown template: {template}")

    # Create project directory and template files
    project_path.mkdir(parents=True)
    for file_path, content in TEMPLATES[template].items():
        full_path = project_path / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content, encoding="utf-8")

    return {"name": name, "template": template, "message": f"Project '{name}' created successfully"}


@router.post("/clone")
async def clone_project(request: CloneProjectRequest, current_user: dict = Depends(get_current_user)):
    """Clone a GitHub repository as a new project."""
    name = request.name.strip()
    url = request.url.strip()

    if not name or "/" in name or "\\" in name or ".." in name:
        raise HTTPException(status_code=400, detail="Invalid project name")

    if not url.startswith("http://") and not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Invalid URL. Use https:// format.")

    user_dir = WORKSPACES_DIR / f"user_{current_user['id']}"
    user_dir.mkdir(parents=True, exist_ok=True)

    project_path = user_dir / name
    if project_path.exists():
        raise HTTPException(status_code=409, detail=f"Project '{name}' already exists")

    try:
        # Prevent git clone from prompting for credentials on stdin
        env = {**os.environ, "GIT_TERMINAL_PROMPT": "0"}
        result = subprocess.run(
            ["git", "clone", url, str(project_path)],
            capture_output=True,
            text=True,
            timeout=45,
            env=env,
        )
        if result.returncode != 0:
            # Clean up on failure
            if project_path.exists():
                shutil.rmtree(project_path)
            raise HTTPException(
                status_code=400,
                detail=f"Git clone failed: {result.stderr.strip()}"
            )

        return {
            "name": name,
            "url": url,
            "message": f"Project '{name}' cloned successfully",
        }
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Git is not installed on the server. Please install git."
        )
    except subprocess.TimeoutExpired:
        if project_path.exists():
            shutil.rmtree(project_path)
        raise HTTPException(status_code=542, detail="Clone operation timed out (45s)")



@router.delete("/{name}")
async def delete_project(name: str, current_user: dict = Depends(get_current_user)):
    """Delete a project and all its files."""
    project_path = get_project_path(name, current_user["id"])
    if not project_path.exists():
        raise HTTPException(status_code=404, detail=f"Project not found: {name}")

    shutil.rmtree(project_path)
    return {"name": name, "deleted": True}


@router.post("/select-local")
def select_local_directory(current_user: dict = Depends(get_current_user)):
    """Open a native folder selection dialog in a subprocess and return the selected path.
    Declared as synchronous (def) so FastAPI runs it in a background thread pool, preventing event loop blocking.
    """
    code = """
import tkinter as tk
from tkinter import filedialog
import os
import sys
try:
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    path = filedialog.askdirectory(title="Select Local Project Folder")
    root.destroy()
    if path:
        print(os.path.normpath(path))
        sys.exit(0)
    else:
        sys.exit(1)
except Exception as e:
    print(str(e), file=sys.stderr)
    sys.exit(2)
"""
    try:
        # Run tkinter in a separate python process with 60 seconds timeout
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            path = result.stdout.strip()
            if path:
                return {"status": "selected", "path": path}
        elif result.returncode == 1:
            return {"status": "cancelled", "path": None}
        else:
            err = result.stderr.strip()
            raise Exception(err or "Failed to open native dialog")
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=408,
            detail="Native folder selection dialog timed out (60s)"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to open native file explorer: {str(e)}"
        )


@router.post("/upload")
async def upload_project(
    project_name: str = Form(...),
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Recreate a project structure inside workspaces directory from browser-uploaded files."""
    name = project_name.strip()
    if not name or "/" in name or "\\" in name or ".." in name:
        raise HTTPException(status_code=400, detail="Invalid project name")

    user_dir = WORKSPACES_DIR / f"user_{current_user['id']}"
    user_dir.mkdir(parents=True, exist_ok=True)

    project_path = user_dir / name
    if project_path.exists():
        # Clear existing to prevent conflict if they choose to re-upload
        shutil.rmtree(project_path)
    
    project_path.mkdir(parents=True)

    for file in files:
        rel_path = file.filename
        if not rel_path:
            continue
            
        # Standardize path separators
        rel_path = rel_path.replace("\\", "/")
        parts = Path(rel_path).parts
        
        # Strip the root folder name prepended by the browser directory upload
        if len(parts) > 1:
            dest_rel_path = Path(*parts[1:])
        else:
            dest_rel_path = Path(rel_path)
            
        dest_path = (project_path / dest_rel_path).resolve()
        
        # Security: ensure file path stays within the project path
        if not str(dest_path).startswith(str(project_path.resolve())):
            continue
            
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
    return {"name": name, "message": f"Project '{name}' uploaded and opened successfully"}


