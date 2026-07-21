import json
import logging
import secrets
from pathlib import Path
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

from app.config import (
    GOOGLE_AUTH_URL,
    GOOGLE_TOKEN_URL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    FRONTEND_URL,
    SCOPES,
)

router = APIRouter()
logger = logging.getLogger('orbit.auth')

TOKEN_FILE = Path("token.json")
STATE_FILE = Path("oauth_state.json")


@router.get("/login")
def login():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Missing GOOGLE_CLIENT_ID")

    state = secrets.token_urlsafe(32)
    logger.info("Starting Google OAuth login")

    STATE_FILE.write_text(json.dumps({"state": state}))

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }

    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return RedirectResponse(auth_url)


@router.get("/callback")
def callback(request: Request):
    error = request.query_params.get("error")
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")

    code = request.query_params.get("code")
    state = request.query_params.get("state")

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    if not STATE_FILE.exists():
        raise HTTPException(status_code=400, detail="Missing OAuth state file")

    saved_state = json.loads(STATE_FILE.read_text()).get("state")

    if state != saved_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    token_payload = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    token_response = requests.post(GOOGLE_TOKEN_URL, data=token_payload)

    if token_response.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Failed to exchange code for token",
                "google_response": token_response.text,
            },
        )

    token_data = token_response.json()
    TOKEN_FILE.write_text(json.dumps(token_data, indent=2))
    logger.info("Google OAuth callback completed successfully")

    return RedirectResponse(f"{FRONTEND_URL}?login=success")


@router.get("/status")
def auth_status():
    return {
        "authenticated": TOKEN_FILE.exists(),
    }

@router.post("/logout")
def logout():
    removed_files = []

    for path in (TOKEN_FILE, STATE_FILE):
        if path.exists():
            path.unlink()
            removed_files.append(path.name)

    logger.info("Google OAuth session cleared")

    return {
        "message": "Logged out successfully",
        "removed_files": removed_files,
    }
