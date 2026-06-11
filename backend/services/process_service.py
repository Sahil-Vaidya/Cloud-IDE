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


# Global registry of running processes per project
_processes: Dict[str, ProcessInfo] = {}


def detect_framework(project_name: str) -> dict:
    """Auto-detect the Python framework used in a project.
    Returns command and port information.
    """
    project_path = get_project_path(project_name)

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
                    "command": f'"{sys.executable}" -m uvicorn {app_file}:app --host 0.0.0.0 --port 8080 --reload',
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


def start_process(project_name: str, command: Optional[str] = None, port: int = 8080) -> dict:
    """Start a server process for a project."""
    # Stop any existing process for this project
    if project_name in _processes and _processes[project_name].is_running:
        stop_process(project_name)

    project_path = get_project_path(project_name)

    if not project_path.exists():
        raise FileNotFoundError(f"Project not found: {project_name}")

    if not command:
        detected = detect_framework(project_name)
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
    _processes[project_name] = proc_info

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


def stop_process(project_name: str) -> dict:
    """Stop a running process for a project."""
    if project_name not in _processes:
        raise ValueError(f"No process found for project: {project_name}")

    proc_info = _processes[project_name]

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


def restart_process(project_name: str) -> dict:
    """Restart a project's process."""
    command = None
    port = 8080

    if project_name in _processes:
        command = _processes[project_name].command
        port = _processes[project_name].port
        stop_process(project_name)

    return start_process(project_name, command, port)


def get_process_status(project_name: str) -> dict:
    """Get the status of a project's process."""
    if project_name not in _processes:
        return {
            "project": project_name,
            "is_running": False,
            "command": "",
            "pid": None,
            "port": None,
        }

    return _processes[project_name].to_dict()


def get_recent_logs(project_name: str, count: int = 100) -> list:
    """Get recent log lines for a project."""
    if project_name not in _processes:
        return []

    logs = list(_processes[project_name].logs)
    return logs[-count:]


def subscribe_logs(project_name: str, callback):
    """Subscribe to real-time log updates for a project."""
    if project_name in _processes:
        _processes[project_name].log_subscribers.append(callback)


def unsubscribe_logs(project_name: str, callback):
    """Unsubscribe from log updates."""
    if project_name in _processes:
        try:
            _processes[project_name].log_subscribers.remove(callback)
        except ValueError:
            pass
