import base64
import json
import os
import re
from email.mime.text import MIMEText
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import errors
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from app.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_URL, SCOPES

router = APIRouter()

TOKEN_FILE = Path("token.json")
DOCS_DIR = Path(__file__).resolve().parent.parent.parent / "docs"
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


class DraftInput(BaseModel):
    to: str
    subject: str
    body: str


class ContextSearchInput(BaseModel):
    query: str
    max_results: int = 8


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


def clean_query(query: str):
    words = re.findall(r"[a-zA-Z0-9]+", query.lower())
    return [word for word in words if len(word) > 2]


def search_local_docs(query: str, limit: int = 5):
    if not DOCS_DIR.exists():
        return []

    keywords = clean_query(query)
    results = []

    for path in DOCS_DIR.rglob("*"):
        if path.suffix.lower() not in [".md", ".txt"]:
            continue

        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        text_lower = text.lower()
        score = sum(1 for keyword in keywords if keyword in text_lower)

        if score == 0:
            continue

        first_match = min(
            (text_lower.find(keyword) for keyword in keywords if keyword in text_lower),
            default=0,
        )
        snippet_start = max(0, first_match - 80)
        snippet = text[snippet_start:snippet_start + 260].replace("\n", " ").strip()

        results.append(
            {
                "source": "local-doc",
                "title": path.name,
                "path": str(path.relative_to(DOCS_DIR)),
                "snippet": snippet,
                "score": score,
            }
        )

    results.sort(key=lambda item: item["score"], reverse=True)
    return results[:limit]


def summarize_context(query: str, gmail_results: list[dict], note_results: list[dict]):
    context_lines = []

    for item in gmail_results[:5]:
        context_lines.append(
            f"Gmail: {item.get('subject', 'No subject')} - {item.get('snippet', '')}"
        )

    for item in note_results[:5]:
        context_lines.append(
            f"Note: {item.get('title')} - {item.get('snippet', '')}"
        )

    if not context_lines:
        return "No related Gmail or local note context was found yet."

    if not os.getenv("GEMINI_API_KEY"):
        return "Review the matched Gmail snippets and local notes below before the event."

    prompt = f"""
Create a short meeting prep summary for this event or search query.

Query:
{query}

Context:
{chr(10).join(context_lines)}

Return 3 concise bullets:
- what to review
- likely action item
- question to bring
"""

    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
        )
        return response.text.strip()
    except (errors.APIError, errors.ServerError):
        return "Review the matched Gmail snippets and local notes below before the event."


@router.get("/messages")
def get_messages(max_results: int = 10, q: str = "in:inbox newer_than:14d"):
    service = get_gmail_service()

    result = (
        service.users()
        .messages()
        .list(userId="me", maxResults=max_results, q=q)
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


@router.post("/context-search")
def search_workspace_context(input_data: ContextSearchInput):
    query = input_data.query.strip()

    if not query:
        return {
            "query": query,
            "gmail_results": [],
            "note_results": [],
            "summary": "Enter a meeting, topic, person, or project to search.",
        }

    gmail_query = f"newer_than:30d {query}"

    try:
        gmail_results = get_messages(
            max_results=input_data.max_results,
            q=gmail_query,
        )
    except Exception:
        gmail_results = []

    note_results = search_local_docs(query)

    return {
        "query": query,
        "gmail_results": gmail_results,
        "note_results": note_results,
        "summary": summarize_context(query, gmail_results, note_results),
    }


@router.post("/draft-follow-up")
def create_draft_follow_up(input_data: DraftInput):
    service = get_gmail_service()

    message = MIMEText(input_data.body)
    message["to"] = input_data.to
    message["subject"] = input_data.subject

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
