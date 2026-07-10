"""
Authentication API Router
Manages user signup, login, session tokens, and dependency injection.
Uses a SQLite database ide_users.db to store users and session mappings.
"""

import os
import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/api/auth", tags=["auth"])

DB_PATH = Path(__file__).parent.parent / "ide_users.db"


class UserAuthRequest(BaseModel):
    email: EmailStr
    password: str


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_auth_db():
    """Create tables if they do not exist."""
    conn = get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        conn.commit()
    finally:
        conn.close()


def hash_password(password: str) -> str:
    """Hash a password using PBKDF2 with SHA-256."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    )
    return f"{salt}:{key.hex()}"


def verify_password(stored_password: str, provided_password: str) -> bool:
    """Verify a password against its stored hash."""
    try:
        salt, hex_key = stored_password.split(":")
        key = hashlib.pbkdf2_hmac(
            "sha256",
            provided_password.encode("utf-8"),
            salt.encode("utf-8"),
            100000
        )
        return secrets.compare_digest(key.hex(), hex_key)
    except Exception:
        return False


@router.post("/register")
async def register(request: UserAuthRequest):
    """Register a new user."""
    email = request.email.strip().lower()
    password = request.password
    
    if len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters long"
        )
        
    conn = get_db()
    try:
        # Check if user already exists
        cursor = conn.execute("SELECT 1 FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=409,
                detail="User with this email already exists"
            )
            
        password_hash = hash_password(password)
        conn.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (email, password_hash)
        )
        conn.commit()
        return {"message": "User registered successfully"}
    finally:
        conn.close()


@router.post("/login")
async def login(request: UserAuthRequest):
    """Authenticate user and issue a session token."""
    email = request.email.strip().lower()
    password = request.password
    
    conn = get_db()
    try:
        cursor = conn.execute(
            "SELECT id, password_hash FROM users WHERE email = ?",
            (email,)
        )
        user = cursor.fetchone()
        if not user or not verify_password(user["password_hash"], password):
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password"
            )
            
        # Create session token
        token = secrets.token_hex(32)
        # Session expires in 24 hours
        expires_at = (datetime.utcnow() + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
        
        conn.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user["id"], expires_at)
        )
        conn.commit()
        
        return {
            "token": token,
            "user": {
                "id": user["id"],
                "email": email
            }
        }
    finally:
        conn.close()


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency to authorize routes and fetch active user session."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication header"
        )
        
    token = authorization.split(" ")[1]
    
    conn = get_db()
    try:
        # Fetch valid session which is not expired
        cursor = conn.execute(
            """
            SELECT u.id, u.email 
            FROM users u 
            JOIN sessions s ON u.id = s.user_id 
            WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
            """,
            (token,)
        )
        user = cursor.fetchone()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or invalid token"
            )
            
        return {"id": user["id"], "email": user["email"]}
    finally:
        conn.close()


def get_user_from_token(token: str) -> Optional[dict]:
    """Helper to verify a session token synchronously (for WebSockets)."""
    if not token:
        return None
        
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT u.id, u.email 
            FROM users u 
            JOIN sessions s ON u.id = s.user_id 
            WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
            """,
            (token,)
        )
        user = cursor.fetchone()
        if user:
            return {"id": user["id"], "email": user["email"]}
        return None
    finally:
        conn.close()
