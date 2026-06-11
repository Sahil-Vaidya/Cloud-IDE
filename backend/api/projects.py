"""
Project Management API Endpoints
Create, list, delete projects and clone from GitHub.
"""

import os
import shutil
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException, File, UploadFile, Form
from pydantic import BaseModel
from typing import Optional

from services.file_service import WORKSPACES_DIR, get_project_path

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

FLASK_APP = '''"""Flask application."""
from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/")
def index():
    return jsonify({"message": "Hello from Flask!", "status": "running"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
'''

# ─── FastAPI template ────────────────────────────────────────────────

FASTAPI_APP = '''"""FastAPI application."""
from fastapi import FastAPI

app = FastAPI(title="My FastAPI App")

@app.get("/")
async def root():
    return {"message": "Hello from FastAPI!", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "ok"}
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
async def list_projects():
    """List all projects in the workspaces directory."""
    WORKSPACES_DIR.mkdir(parents=True, exist_ok=True)
    projects = []
    for entry in sorted(WORKSPACES_DIR.iterdir()):
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
async def create_project(request: CreateProjectRequest):
    """Create a new project, optionally from a template."""
    name = request.name.strip()
    if not name or "/" in name or "\\" in name or ".." in name:
        raise HTTPException(status_code=400, detail="Invalid project name")

    project_path = WORKSPACES_DIR / name
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
async def clone_project(request: CloneProjectRequest):
    """Clone a GitHub repository as a new project."""
    name = request.name.strip()
    url = request.url.strip()

    if not name or "/" in name or "\\" in name or ".." in name:
        raise HTTPException(status_code=400, detail="Invalid project name")

    if not url.startswith("http://") and not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Invalid URL. Use https:// format.")

    project_path = WORKSPACES_DIR / name
    if project_path.exists():
        raise HTTPException(status_code=409, detail=f"Project '{name}' already exists")

    try:
        result = subprocess.run(
            ["git", "clone", url, str(project_path)],
            capture_output=True,
            text=True,
            timeout=120,
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
        raise HTTPException(status_code=504, detail="Clone operation timed out (120s)")


@router.delete("/{name}")
async def delete_project(name: str):
    """Delete a project and all its files."""
    project_path = get_project_path(name)
    if not project_path.exists():
        raise HTTPException(status_code=404, detail=f"Project not found: {name}")

    shutil.rmtree(project_path)
    return {"name": name, "deleted": True}


@router.post("/select-local")
async def select_local_directory():
    """Open a native folder selection dialog and return the selected path."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        
        path = filedialog.askdirectory(title="Select Local Project Folder")
        root.destroy()
        
        if not path:
            return {"status": "cancelled", "path": None}
            
        return {"status": "selected", "path": os.path.normpath(path)}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to open native file explorer: {str(e)}"
        )


@router.post("/upload")
async def upload_project(
    project_name: str = Form(...),
    files: list[UploadFile] = File(...)
):
    """Recreate a project structure inside workspaces directory from browser-uploaded files."""
    name = project_name.strip()
    if not name or "/" in name or "\\" in name or ".." in name:
        raise HTTPException(status_code=400, detail="Invalid project name")

    project_path = WORKSPACES_DIR / name
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


