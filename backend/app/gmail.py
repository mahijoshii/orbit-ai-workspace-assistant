import base64
import json
from email.mime.text import MIMEText
from pathlib import Path

from fastapi import APIRouter, HTTPException
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from app.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_URL, SCOPES

router = APIRouter()

TOKEN_FILE = Path("token.json")


def get_credentials():
    if not TOKEN_FILE.exists():
        raise HTTPException(status_code=401, detail="Not logged in with Google yet")

    token_data = json.loads(TOKEN_FILE.read_text())

    creds = Credentials(
        token=token_data.get("access_token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri=GOOGLE_TOKEN_URL,
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        token_data["access_token"] = creds.token
        TOKEN_FILE.write_text(json.dumps(token_data, indent=2))

    return creds


def get_gmail_service():
    creds = get_credentials()
    return build("gmail", "v1", credentials=creds)


def get_header(headers, name):
    for header in headers:
        if header.get("name", "").lower() == name.lower():
            return header.get("value")
    return None


@router.get("/messages")
def get_messages(max_results: int = 10):
    service = get_gmail_service()

    result = (
        service.users()
        .messages()
        .list(userId="me", maxResults=max_results, q="in:inbox newer_than:14d")
        .execute()
    )

    messages = result.get("messages", [])

    output = []

    for message in messages:
        msg = (
            service.users()
            .messages()
            .get(userId="me", id=message["id"], format="metadata")
            .execute()
        )

        headers = msg.get("payload", {}).get("headers", [])

        output.append(
            {
                "id": msg.get("id"),
                "thread_id": msg.get("threadId"),
                "from": get_header(headers, "From"),
                "subject": get_header(headers, "Subject"),
                "date": get_header(headers, "Date"),
                "snippet": msg.get("snippet"),
            }
        )

    return output


@router.get("/follow-ups")
def detect_follow_ups(max_results: int = 10):
    messages = get_messages(max_results=max_results)

    follow_ups = []

    keywords = [
        "following up",
        "checking in",
        "let me know",
        "thoughts",
        "waiting",
        "next steps",
        "could you",
        "can you",
        "please",
        "deadline",
    ]

    for msg in messages:
        text = f"{msg.get('subject', '')} {msg.get('snippet', '')}".lower()

        score = 0
        matched_keywords = []

        for keyword in keywords:
            if keyword in text:
                score += 1
                matched_keywords.append(keyword)

        if score > 0:
            follow_ups.append(
                {
                    "id": msg["id"],
                    "thread_id": msg["thread_id"],
                    "from": msg["from"],
                    "subject": msg["subject"],
                    "snippet": msg["snippet"],
                    "score": score,
                    "matched_keywords": matched_keywords,
                    "suggested_action": "Review and consider replying",
                }
            )

    follow_ups.sort(key=lambda item: item["score"], reverse=True)

    return follow_ups


@router.post("/draft-follow-up")
def create_draft_follow_up(to: str, subject: str, body: str):
    service = get_gmail_service()

    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject

    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()

    draft_body = {
        "message": {
            "raw": raw_message
        }
    }

    draft = (
        service.users()
        .drafts()
        .create(userId="me", body=draft_body)
        .execute()
    )

    return {
        "message": "Draft created successfully",
        "draft_id": draft.get("id"),
    }