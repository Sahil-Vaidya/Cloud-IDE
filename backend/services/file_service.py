"""
File System Service
Handles all file and directory operations for project workspaces.
Includes path safety validation to prevent directory traversal attacks.
"""

import os
import shutil
from pathlib import Path
from typing import Optional


# Base directory where all project workspaces are stored
# Located in the root project folder to prevent uvicorn reloads when modifying workspaces
WORKSPACES_DIR = Path(__file__).parent.parent.parent / "workspaces"
WORKSPACES_DIR.mkdir(parents=True, exist_ok=True)



def get_project_path(project_name: str) -> Path:
    """Get the absolute path to a project workspace."""
    # If it looks like an absolute path, check if it exists and return it
    if os.path.isabs(project_name) or (len(project_name) > 1 and project_name[1] == ":"):
        path = Path(project_name).resolve()
        if not path.exists():
            raise FileNotFoundError(f"Local path does not exist: {project_name}")
        return path

    project_path = (WORKSPACES_DIR / project_name).resolve()
    # Safety check: ensure the resolved path is within WORKSPACES_DIR
    if not str(project_path).lower().startswith(str(WORKSPACES_DIR.resolve()).lower()):
        raise ValueError("Invalid project name: path traversal detected")
    return project_path



def validate_path(project_name: str, relative_path: str) -> Path:
    """Validate and resolve a relative path within a project.
    Prevents directory traversal attacks.
    """
    project_path = get_project_path(project_name)
    full_path = (project_path / relative_path).resolve()
    if not str(full_path).lower().startswith(str(project_path).lower()):
        raise ValueError("Invalid path: directory traversal detected")
    return full_path


def get_file_tree(project_name: str, relative_path: str = "") -> list:
    """Build a recursive file tree structure for the project.
    Returns a list of dicts with name, path, type (file/directory), and children.
    """
    project_path = get_project_path(project_name)
    target_path = project_path / relative_path if relative_path else project_path

    if not target_path.exists():
        return []

    tree = []
    try:
        entries = sorted(target_path.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
    except PermissionError:
        return []

    for entry in entries:
        # Skip hidden files and __pycache__
        if entry.name.startswith('.') and entry.name not in ('.env', '.gitignore', '.flaskenv'):
            continue
        if entry.name == '__pycache__' or entry.name == 'node_modules':
            continue

        rel = str(entry.relative_to(project_path)).replace("\\", "/")
        node = {
            "name": entry.name,
            "path": rel,
            "type": "directory" if entry.is_dir() else "file",
        }

        if entry.is_dir():
            node["children"] = get_file_tree(project_name, rel)

        if entry.is_file():
            node["size"] = entry.stat().st_size
            node["extension"] = entry.suffix.lstrip(".")

        tree.append(node)

    return tree


def read_file(project_name: str, relative_path: str) -> str:
    """Read and return the contents of a file."""
    file_path = validate_path(project_name, relative_path)
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {relative_path}")
    if not file_path.is_file():
        raise ValueError(f"Not a file: {relative_path}")

    # Try to read as text, fall back to binary info
    try:
        return file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return f"[Binary file: {file_path.stat().st_size} bytes]"


def write_file(project_name: str, relative_path: str, content: str) -> dict:
    """Write content to a file. Creates parent directories if needed."""
    file_path = validate_path(project_name, relative_path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    return {"path": relative_path, "size": file_path.stat().st_size}


def create_item(project_name: str, relative_path: str, item_type: str = "file") -> dict:
    """Create a new file or directory."""
    item_path = validate_path(project_name, relative_path)

    if item_path.exists():
        raise FileExistsError(f"Already exists: {relative_path}")

    if item_type == "directory":
        item_path.mkdir(parents=True, exist_ok=True)
    else:
        item_path.parent.mkdir(parents=True, exist_ok=True)
        item_path.touch()

    return {"path": relative_path, "type": item_type}


def delete_item(project_name: str, relative_path: str) -> dict:
    """Delete a file or directory."""
    item_path = validate_path(project_name, relative_path)

    if not item_path.exists():
        raise FileNotFoundError(f"Not found: {relative_path}")

    if item_path.is_dir():
        shutil.rmtree(item_path)
    else:
        item_path.unlink()

    return {"path": relative_path, "deleted": True}


def rename_item(project_name: str, old_path: str, new_path: str) -> dict:
    """Rename or move a file/directory."""
    old = validate_path(project_name, old_path)
    new = validate_path(project_name, new_path)

    if not old.exists():
        raise FileNotFoundError(f"Not found: {old_path}")
    if new.exists():
        raise FileExistsError(f"Already exists: {new_path}")

    new.parent.mkdir(parents=True, exist_ok=True)
    old.rename(new)

    return {"old_path": old_path, "new_path": new_path}


def get_file_extension(filename: str) -> str:
    """Get file extension without the dot."""
    return Path(filename).suffix.lstrip(".")
