"""
WebSocket Endpoints
Handles terminal PTY sessions and live log streaming via WebSocket.
"""

import asyncio
import subprocess
import sys
import os
import json
from typing import Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from services.file_service import get_project_path
from services import process_service
from api.auth import get_user_from_token

router = APIRouter(tags=["websockets"])

# Track active terminal sessions
_terminal_sessions: Dict[str, subprocess.Popen] = {}


@router.websocket("/ws/terminal/{project}")
async def terminal_websocket(websocket: WebSocket, project: str):
    """Interactive terminal WebSocket endpoint.
    Spawns a shell process and bridges stdin/stdout over WebSocket.
    """
    await websocket.accept()

    # Authenticate via query token
    token = websocket.query_params.get("token")
    user = get_user_from_token(token)
    if not user:
        await websocket.send_json({"type": "error", "data": "Unauthorized connection. Session expired.\r\n"})
        await websocket.close(code=1008)
        return

    user_id = user["id"]
    try:
        project_path = get_project_path(project, user_id)
    except Exception as e:
        await websocket.send_json({"type": "error", "data": f"Error resolving project: {str(e)}\r\n"})
        await websocket.close()
        return

    if not project_path.exists():
        await websocket.send_json({"type": "error", "data": f"Project not found: {project}\r\n"})
        await websocket.close()
        return

    # Determine shell
    if sys.platform == "win32":
        shell_cmd = ["powershell.exe", "-NoLogo", "-NoProfile"]
    else:
        shell_cmd = ["/bin/bash", "--login"]

    env = os.environ.copy()
    env["TERM"] = "xterm-256color"
    env["PYTHONUNBUFFERED"] = "1"

    creation_flags = 0
    if sys.platform == "win32":
        creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP

    try:
        process = subprocess.Popen(
            shell_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=str(project_path),
            env=env,
            creationflags=creation_flags,
            bufsize=0,
        )

        session_id = f"{user_id}_{project}_{id(websocket)}"
        _terminal_sessions[session_id] = process

        await websocket.send_json({
            "type": "connected",
            "data": f"Terminal connected to {project}\r\n"
        })

        # Task: Read from process stdout and send to WebSocket
        async def read_output():
            loop = asyncio.get_event_loop()
            try:
                while process.poll() is None:
                    data = await loop.run_in_executor(
                        None, lambda: process.stdout.read(4096)
                    )
                    if data:
                        try:
                            text = data.decode("utf-8", errors="replace")
                            await websocket.send_json({
                                "type": "output",
                                "data": text
                            })
                        except Exception:
                            break
                    else:
                        break
            except Exception:
                pass

        # Start output reader
        output_task = asyncio.create_task(read_output())

        # Main loop: Read from WebSocket and write to process stdin
        try:
            while True:
                message = await websocket.receive_text()
                try:
                    msg = json.loads(message)
                except json.JSONDecodeError:
                    msg = {"type": "input", "data": message}

                if msg.get("type") == "input" and process.poll() is None:
                    data = msg.get("data", "")
                    process.stdin.write(data.encode("utf-8"))
                    process.stdin.flush()
                elif msg.get("type") == "resize":
                    # Terminal resize — limited support on Windows subprocess
                    pass

        except WebSocketDisconnect:
            pass
        finally:
            output_task.cancel()
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
            if session_id in _terminal_sessions:
                del _terminal_sessions[session_id]

    except Exception as e:
        try:
            await websocket.send_json({
                "type": "error",
                "data": f"Terminal error: {str(e)}\r\n"
            })
        except Exception:
            pass


@router.websocket("/ws/logs/{project}")
async def logs_websocket(websocket: WebSocket, project: str):
    """Live log streaming WebSocket endpoint.
    Streams stdout/stderr from the project's running server process.
    """
    await websocket.accept()

    # Authenticate via query token
    token = websocket.query_params.get("token")
    user = get_user_from_token(token)
    if not user:
        await websocket.close(code=1008)
        return

    user_id = user["id"]

    # Send recent logs first
    recent_logs = process_service.get_recent_logs(project, 200, user_id=user_id)
    for line in recent_logs:
        await websocket.send_json({"type": "log", "data": line})

    # Set up real-time subscriber
    log_queue = asyncio.Queue()

    def on_log(line: str):
        try:
            log_queue.put_nowait(line)
        except asyncio.QueueFull:
            pass

    process_service.subscribe_logs(project, on_log, user_id=user_id)

    try:
        # Task to push queued logs to WebSocket
        async def push_logs():
            while True:
                try:
                    line = await asyncio.wait_for(log_queue.get(), timeout=1.0)
                    await websocket.send_json({"type": "log", "data": line})
                except asyncio.TimeoutError:
                    # Send heartbeat to keep connection alive
                    try:
                        await websocket.send_json({"type": "heartbeat"})
                    except Exception:
                        break
                except Exception:
                    break

        push_task = asyncio.create_task(push_logs())

        # Keep connection open, listen for client messages (e.g., close)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            push_task.cancel()

    finally:
        process_service.unsubscribe_logs(project, on_log, user_id=user_id)
