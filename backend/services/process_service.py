"""
Process Service
Manages subprocess execution for running project servers.
Handles start/stop/restart and log capture.
Works on both Windows and Linux.
"""

import asyncio
import subprocess
import signal
import os
import sys
import time
from pathlib import Path
from typing import Optional, Dict
from collections import deque

from services.file_service import get_project_path


class ProcessInfo:
    """Stores information about a running process."""

    def __init__(self, project: str, command: str, process: subprocess.Popen, port: int = 8080):
        self.project = project
        self.command = command
        self.process = process
        self.port = port
        self.start_time = time.time()
        self.logs = deque(maxlen=5000)  # Keep last 5000 log lines
        self.log_subscribers = []  # WebSocket connections listening for logs

    @property
    def is_running(self) -> bool:
        return self.process.poll() is None

    @property
    def pid(self) -> int:
        return self.process.pid

    def to_dict(self) -> dict:
        return {
            "project": self.project,
            "command": self.command,
            "pid": self.pid,
            "port": self.port,
            "is_running": self.is_running,
            "uptime": round(time.time() - self.start_time, 1) if self.is_running else 0,
            "log_count": len(self.logs),
        }


# Global registry of running processes per project (keyed by f"{user_id}_{project_name}")
_processes: Dict[str, ProcessInfo] = {}


def detect_framework(project_name: str, user_id: int) -> dict:
    """Auto-detect the Python framework used in a project.
    Returns command and port information.
    """
    project_path = get_project_path(project_name, user_id)

    # Check for Django
    manage_py = project_path / "manage.py"
    if manage_py.exists():
        return {
            "framework": "django",
            "command": f'"{sys.executable}" manage.py runserver 0.0.0.0:8080',
            "port": 8080,
        }

    # Check for FastAPI (look for uvicorn in requirements or main.py)
    for req_file in ["requirements.txt", "pyproject.toml"]:
        req_path = project_path / req_file
        if req_path.exists():
            content = req_path.read_text(encoding="utf-8", errors="ignore")
            if "fastapi" in content.lower():
                # Try to find the app module
                app_file = _find_fastapi_app(project_path)
                return {
                    "framework": "fastapi",
                    "command": f'"{sys.executable}" -m uvicorn {app_file}:app --host 0.0.0.0 --port 8080 --reload --reload-exclude "*.sqlite3" --reload-exclude "*.db" --reload-exclude "*.json"',
                    "port": 8080,
                }

    # Check for Flask
    for req_file in ["requirements.txt", "pyproject.toml"]:
        req_path = project_path / req_file
        if req_path.exists():
            content = req_path.read_text(encoding="utf-8", errors="ignore")
            if "flask" in content.lower():
                app_file = _find_flask_app(project_path)
                return {
                    "framework": "flask",
                    "command": f'"{sys.executable}" -m flask --app {app_file} run --host 0.0.0.0 --port 8080',
                    "port": 8080,
                }

    # Default: try python main.py
    main_py = project_path / "main.py"
    if main_py.exists():
        return {
            "framework": "python",
            "command": f'"{sys.executable}" main.py',
            "port": 8080,
        }

    return {
        "framework": "unknown",
        "command": "",
        "port": 8080,
    }


def _find_fastapi_app(project_path: Path) -> str:
    """Try to find the FastAPI app entry point."""
    for candidate in ["main", "app", "server", "api"]:
        if (project_path / f"{candidate}.py").exists():
            return candidate
    return "main"


def _find_flask_app(project_path: Path) -> str:
    """Try to find the Flask app entry point."""
    for candidate in ["app", "main", "server", "wsgi"]:
        if (project_path / f"{candidate}.py").exists():
            return candidate
    return "app"


def start_process(project_name: str, command: Optional[str] = None, port: int = 8080, user_id: int = None) -> dict:
    """Start a server process for a project."""
    if user_id is None:
        raise ValueError("user_id is required for start_process")
    
    key = f"{user_id}_{project_name}"
    # Stop any existing process for this project
    if key in _processes and _processes[key].is_running:
        stop_process(project_name, user_id)

    project_path = get_project_path(project_name, user_id)

    if not project_path.exists():
        raise FileNotFoundError(f"Project not found: {project_name}")

    if not command:
        detected = detect_framework(project_name, user_id)
        command = detected["command"]
        port = detected.get("port", port)

    if not command:
        raise ValueError("Could not detect framework. Please provide a run command.")

    # Set up environment
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"  # Force unbuffered output for real-time logs

    # Start the process
    creation_flags = 0
    if sys.platform == "win32":
        creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP

    process = subprocess.Popen(
        command,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=str(project_path),
        env=env,
        creationflags=creation_flags,
        bufsize=1,
        universal_newlines=True,
    )

    proc_info = ProcessInfo(project_name, command, process, port)
    _processes[key] = proc_info

    # Start log reader in background
    _start_log_reader(proc_info)

    return proc_info.to_dict()


def _start_log_reader(proc_info: ProcessInfo):
    """Start a background thread to read process output."""
    import threading

    def reader():
        try:
            for line in iter(proc_info.process.stdout.readline, ""):
                if not line:
                    break
                proc_info.logs.append(line.rstrip("\n"))
                # Notify all WebSocket subscribers
                for callback in proc_info.log_subscribers:
                    try:
                        callback(line.rstrip("\n"))
                    except Exception:
                        pass
        except Exception:
            pass

    thread = threading.Thread(target=reader, daemon=True)
    thread.start()


def stop_process(project_name: str, user_id: int) -> dict:
    """Stop a running process for a project."""
    key = f"{user_id}_{project_name}"
    if key not in _processes:
        raise ValueError(f"No process found for project: {project_name}")

    proc_info = _processes[key]

    if proc_info.is_running:
        if sys.platform == "win32":
            proc_info.process.terminate()
            try:
                proc_info.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc_info.process.kill()
        else:
            os.killpg(os.getpgid(proc_info.pid), signal.SIGTERM)
            try:
                proc_info.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(os.getpgid(proc_info.pid), signal.SIGKILL)

    return {"project": project_name, "stopped": True}


def restart_process(project_name: str, user_id: int) -> dict:
    """Restart a project's process."""
    command = None
    port = 8080
    key = f"{user_id}_{project_name}"

    if key in _processes:
        command = _processes[key].command
        port = _processes[key].port
        stop_process(project_name, user_id)

    return start_process(project_name, command, port, user_id)


def get_process_status(project_name: str, user_id: int) -> dict:
    """Get the status of a project's process."""
    key = f"{user_id}_{project_name}"
    if key not in _processes:
        return {
            "project": project_name,
            "is_running": False,
            "command": "",
            "pid": None,
            "port": None,
        }

    return _processes[key].to_dict()


def get_recent_logs(project_name: str, count: int = 100, user_id: int = None) -> list:
    """Get recent log lines for a project."""
    if user_id is None:
        raise ValueError("user_id is required for get_recent_logs")
    key = f"{user_id}_{project_name}"
    if key not in _processes:
        return []

    logs = list(_processes[key].logs)
    return logs[-count:]


def subscribe_logs(project_name: str, callback, user_id: int):
    """Subscribe to real-time log updates for a project."""
    key = f"{user_id}_{project_name}"
    if key in _processes:
        _processes[key].log_subscribers.append(callback)


def unsubscribe_logs(project_name: str, callback, user_id: int):
    """Unsubscribe from log updates."""
    key = f"{user_id}_{project_name}"
    if key in _processes:
        try:
            _processes[key].log_subscribers.remove(callback)
        except ValueError:
            pass
