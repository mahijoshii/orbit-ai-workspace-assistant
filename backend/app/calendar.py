import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

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


def get_calendar_service():
    creds = get_credentials()
    return build("calendar", "v3", credentials=creds)


def parse_event_time(event_time):
    if "dateTime" in event_time:
        return datetime.fromisoformat(event_time["dateTime"])

    if "date" in event_time:
        return datetime.fromisoformat(event_time["date"] + "T00:00:00-04:00")

    return None


@router.get("/events")
def get_events():
    service = get_calendar_service()

    now = datetime.now(ZoneInfo("America/Toronto"))
    # only plans ur day for todays date. can't see past or future
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    end_of_day = now.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()

    events_result = ( # only sees events from today and in 
        service.events()
        .list(
            calendarId="primary",
            timeMin=start_of_day,
            timeMax=end_of_day,
            maxResults=20,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )

    events = events_result.get("items", [])

    return [
        {
            "id": event.get("id"),
            "title": event.get("summary", "Untitled Event"),
            "start": event.get("start", {}),
            "end": event.get("end", {}),
            "location": event.get("location"),
        }
        for event in events
    ]


@router.get("/free-time")
def get_free_time():
    service = get_calendar_service()

    now = datetime.now(ZoneInfo("America/Toronto"))
    start_of_day = now.replace(hour=9, minute=0, second=0, microsecond=0)
    end_of_day = now.replace(hour=22, minute=0, second=0, microsecond=0)

    events_result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=start_of_day.isoformat(),
            timeMax=end_of_day.isoformat(),
            maxResults=50,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )

    events = events_result.get("items", [])

    busy_blocks = []

    for event in events:
        start = parse_event_time(event.get("start", {}))
        end = parse_event_time(event.get("end", {}))

        if start and end:
            busy_blocks.append((start, end))

    busy_blocks.sort(key=lambda block: block[0])

    free_blocks = []
    current_time = start_of_day

    for busy_start, busy_end in busy_blocks:
        if busy_start > current_time:
            free_blocks.append({
                "start": current_time.isoformat(),
                "end": busy_start.isoformat()
            })

        if busy_end > current_time:
            current_time = busy_end

    if current_time < end_of_day:
        free_blocks.append({
            "start": current_time.isoformat(),
            "end": end_of_day.isoformat()
        })

    return free_blocks


@router.post("/schedule-task")
def schedule_task(title: str, duration_minutes: int = 30):
    service = get_calendar_service()

    free_blocks = get_free_time()

    for block in free_blocks:
        start = datetime.fromisoformat(block["start"])
        end = datetime.fromisoformat(block["end"])

        if end - start >= timedelta(minutes=duration_minutes):
            task_end = start + timedelta(minutes=duration_minutes)

            event_body = {
                "summary": title,
                "description": "Scheduled by Orbit AI Workspace Assistant.",
                "start": {
                    "dateTime": start.isoformat(),
                    "timeZone": "America/Toronto",
                },
                "end": {
                    "dateTime": task_end.isoformat(),
                    "timeZone": "America/Toronto",
                },
            }

            created_event = (
                service.events()
                .insert(calendarId="primary", body=event_body)
                .execute()
            )

            return {
                "message": "Task scheduled successfully",
                "title": title,
                "start": start.isoformat(),
                "end": task_end.isoformat(),
                "html_link": created_event.get("htmlLink"),
            }

    return {
        "message": "No free time block found for this task"
    }


@router.post("/test-event")
def create_test_event():
    service = get_calendar_service()

    start = datetime.now(timezone.utc) + timedelta(hours=1)
    end = start + timedelta(minutes=30)

    event_body = {
        "summary": "Orbit Test Event",
        "description": "Created by Orbit AI Workspace Assistant.",
        "start": {
            "dateTime": start.isoformat(),
            "timeZone": "America/Toronto",
        },
        "end": {
            "dateTime": end.isoformat(),
            "timeZone": "America/Toronto",
        },
    }

    created_event = (
        service.events()
        .insert(calendarId="primary", body=event_body)
        .execute()
    )

    return {
        "message": "Event created successfully",
        "event_id": created_event.get("id"),
        "html_link": created_event.get("htmlLink"),
    }


@router.get("/calendars")
def get_calendars():
    service = get_calendar_service()

    calendar_list = service.calendarList().list().execute()
    calendars = calendar_list.get("items", [])

    return [
        {
            "id": calendar.get("id"),
            "summary": calendar.get("summary"),
            "primary": calendar.get("primary", False),
        }
        for calendar in calendars
    ]