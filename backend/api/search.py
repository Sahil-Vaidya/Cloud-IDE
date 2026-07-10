"""
Search API Endpoint
Searches for text across all files in a project workspace.
"""

import os
import re
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends

from services.file_service import get_project_path
from api.auth import get_current_user

router = APIRouter(prefix="/api/search", tags=["search"])

# Extensions to skip (binary files, etc.)
SKIP_EXTENSIONS = {
    '.pyc', '.pyo', '.pyd', '.so', '.dll', '.dylib', '.exe', '.bin',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg', '.webp',
    '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.wav',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.pdf', '.docx', '.xlsx', '.pptx',
    '.db', '.sqlite', '.sqlite3',
    '.lock', '.log',
}

SKIP_DIRS = {
    '__pycache__', 'node_modules', '.git', '.venv', 'venv',
    'env', '.env', 'dist', 'build', '.next', '__snapshots__',
    '.mypy_cache', '.pytest_cache', 'coverage', '.tox',
}

MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB max per file


@router.get("/{project}")
async def search_in_files(
    project: str,
    q: str = Query(..., min_length=1, description="Search query"),
    case_sensitive: bool = Query(False),
    use_regex: bool = Query(False),
    max_results: int = Query(200, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
):
    """Search for text across all project files."""
    try:
        project_path = get_project_path(project, current_user["id"])
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

    if not project_path.exists():
        raise HTTPException(status_code=404, detail=f"Project not found: {project}")

    results = []
    total_files_searched = 0
    total_matches = 0

    try:
        if use_regex:
            flags = 0 if case_sensitive else re.IGNORECASE
            pattern = re.compile(q, flags)
        else:
            pattern = None
    except re.error as e:
        raise HTTPException(status_code=400, detail=f"Invalid regex: {e}")

    def matches(line: str) -> bool:
        if pattern:
            return bool(pattern.search(line))
        if case_sensitive:
            return q in line
        return q.lower() in line.lower()

    for root, dirs, files in os.walk(project_path):
        # Filter out skip directories in-place to prevent descending
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]

        for filename in sorted(files):
            if total_matches >= max_results:
                break

            ext = Path(filename).suffix.lower()
            if ext in SKIP_EXTENSIONS:
                continue

            file_path = Path(root) / filename
            if file_path.stat().st_size > MAX_FILE_SIZE:
                continue

            total_files_searched += 1

            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            file_matches = []
            for line_num, line in enumerate(content.splitlines(), start=1):
                if matches(line):
                    file_matches.append({
                        "line": line_num,
                        "content": line.rstrip(),
                    })
                    total_matches += 1
                    if total_matches >= max_results:
                        break

            if file_matches:
                rel_path = str(file_path.relative_to(project_path)).replace("\\", "/")
                results.append({
                    "file": rel_path,
                    "matches": file_matches,
                    "match_count": len(file_matches),
                })

        if total_matches >= max_results:
            break

    return {
        "query": q,
        "results": results,
        "total_files": total_files_searched,
        "total_matches": total_matches,
        "truncated": total_matches >= max_results,
    }
