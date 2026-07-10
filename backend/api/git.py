"""
Git Integration API Endpoints
Provides git operations for project workspaces: status, diff, stage, commit, push, log.
"""

import subprocess
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from services.file_service import get_project_path
from api.auth import get_current_user

router = APIRouter(prefix="/api/git", tags=["git"])


def run_git(args: list, cwd: str, input_text: str = None) -> tuple[str, str, int]:
    """Run a git command and return stdout, stderr, returncode."""
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=30,
            input=input_text,
        )
        return result.stdout, result.stderr, result.returncode
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Git is not installed on the server.")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Git command timed out.")


def get_git_project_path(project: str, user_id: int) -> str:
    """Resolve and return a git-enabled project path as string."""
    try:
        path = get_project_path(project, user_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Project not found: {project}")

    return str(path)


class CommitRequest(BaseModel):
    message: str


class StageRequest(BaseModel):
    files: list[str]  # List of relative file paths, or ["."] for all


class PushRequest(BaseModel):
    remote: str = "origin"
    branch: str = "main"


class InitRequest(BaseModel):
    initial_branch: str = "main"


@router.get("/{project}/status")
async def git_status(project: str, current_user: dict = Depends(get_current_user)):
    """Get git status (porcelain v1 output parsed into structured data)."""
    cwd = get_git_project_path(project, current_user["id"])

    # Check if this is a git repo
    stdout, stderr, code = run_git(["rev-parse", "--git-dir"], cwd)
    if code != 0:
        return {"initialized": False, "files": [], "branch": None, "ahead": 0, "behind": 0}

    # Get current branch
    branch_out, _, _ = run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd)
    branch = branch_out.strip() or "HEAD"

    # Get ahead/behind
    ahead, behind = 0, 0
    tracking_out, _, track_code = run_git(["rev-list", "--left-right", "--count", f"@{{u}}...HEAD"], cwd)
    if track_code == 0:
        parts = tracking_out.strip().split()
        if len(parts) == 2:
            behind, ahead = int(parts[0]), int(parts[1])

    # Get status
    status_out, _, _ = run_git(["status", "--porcelain=v1", "-u"], cwd)

    files = []
    for line in status_out.splitlines():
        if len(line) < 4:
            continue
        index_status = line[0]
        worktree_status = line[1]
        filepath = line[3:].strip()

        # Handle renames (format: "old -> new")
        if " -> " in filepath:
            parts = filepath.split(" -> ")
            filepath = parts[1]

        status_code = f"{index_status}{worktree_status}".strip()
        files.append({
            "path": filepath,
            "index": index_status.strip() or None,
            "worktree": worktree_status.strip() or None,
            "status": status_code,
            "staged": index_status != " " and index_status != "?",
        })

    return {
        "initialized": True,
        "branch": branch,
        "ahead": ahead,
        "behind": behind,
        "files": files,
    }


@router.get("/{project}/diff")
async def git_diff(
    project: str,
    filepath: Optional[str] = None,
    staged: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """Get unified diff for a file or all files."""
    cwd = get_git_project_path(project, current_user["id"])

    args = ["diff"]
    if staged:
        args.append("--cached")

    args.extend(["--", filepath] if filepath else [])

    stdout, stderr, code = run_git(args, cwd)
    if code not in (0, 1):
        raise HTTPException(status_code=500, detail=stderr.strip() or "Git diff failed")

    return {"diff": stdout, "filepath": filepath}


@router.get("/{project}/log")
async def git_log(
    project: str,
    count: int = 20,
    current_user: dict = Depends(get_current_user),
):
    """Get recent git commit log."""
    cwd = get_git_project_path(project, current_user["id"])

    fmt = "%H|%h|%s|%an|%ae|%ar"
    stdout, stderr, code = run_git(["log", f"--format={fmt}", f"-{count}"], cwd)
    if code != 0:
        if "does not have any commits" in stderr or "fatal: your current branch" in stderr:
            return {"commits": []}
        raise HTTPException(status_code=500, detail=stderr.strip() or "Git log failed")

    commits = []
    for line in stdout.strip().splitlines():
        parts = line.split("|", 5)
        if len(parts) == 6:
            commits.append({
                "hash": parts[0],
                "short_hash": parts[1],
                "message": parts[2],
                "author": parts[3],
                "email": parts[4],
                "relative_date": parts[5],
            })

    return {"commits": commits}


@router.post("/{project}/stage")
async def git_stage(
    project: str,
    request: StageRequest,
    current_user: dict = Depends(get_current_user),
):
    """Stage one or more files (git add)."""
    cwd = get_git_project_path(project, current_user["id"])
    files = request.files or ["."]
    stdout, stderr, code = run_git(["add", "--"] + files, cwd)
    if code != 0:
        raise HTTPException(status_code=400, detail=stderr.strip() or "git add failed")
    return {"staged": files, "message": "Files staged successfully"}


@router.post("/{project}/unstage")
async def git_unstage(
    project: str,
    request: StageRequest,
    current_user: dict = Depends(get_current_user),
):
    """Unstage one or more files (git restore --staged)."""
    cwd = get_git_project_path(project, current_user["id"])
    files = request.files or ["."]
    stdout, stderr, code = run_git(["restore", "--staged", "--"] + files, cwd)
    if code != 0:
        raise HTTPException(status_code=400, detail=stderr.strip() or "git unstage failed")
    return {"unstaged": files, "message": "Files unstaged successfully"}


@router.post("/{project}/commit")
async def git_commit(
    project: str,
    request: CommitRequest,
    current_user: dict = Depends(get_current_user),
):
    """Commit staged changes."""
    cwd = get_git_project_path(project, current_user["id"])

    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Commit message cannot be empty")

    # Set a default git identity if not configured
    run_git(["config", "user.email", "ide@cloudide.local"], cwd)
    run_git(["config", "user.name", "Cloud IDE User"], cwd)

    stdout, stderr, code = run_git(["commit", "-m", request.message.strip()], cwd)
    if code != 0:
        raise HTTPException(status_code=400, detail=stderr.strip() or "git commit failed")

    return {"message": "Committed successfully", "output": stdout.strip()}


@router.post("/{project}/push")
async def git_push(
    project: str,
    request: PushRequest,
    current_user: dict = Depends(get_current_user),
):
    """Push commits to remote."""
    cwd = get_git_project_path(project, current_user["id"])
    stdout, stderr, code = run_git(["push", request.remote, request.branch], cwd)
    if code != 0:
        raise HTTPException(
            status_code=400,
            detail=stderr.strip() or "git push failed. Check that remote and credentials are configured."
        )
    return {"message": f"Pushed to {request.remote}/{request.branch}", "output": stdout.strip()}


@router.post("/{project}/init")
async def git_init(
    project: str,
    request: InitRequest,
    current_user: dict = Depends(get_current_user),
):
    """Initialize a git repository for a project."""
    cwd = get_git_project_path(project, current_user["id"])
    stdout, stderr, code = run_git(["init", "-b", request.initial_branch], cwd)
    if code != 0:
        # Try without -b flag (older git versions)
        stdout, stderr, code = run_git(["init"], cwd)
        if code != 0:
            raise HTTPException(status_code=500, detail=stderr.strip() or "git init failed")
    return {"message": "Git repository initialized", "output": stdout.strip()}
