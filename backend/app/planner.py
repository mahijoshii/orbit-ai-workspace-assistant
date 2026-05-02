import json
import os
import re
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google import genai

from app.calendar import get_free_time, get_calendar_service

router = APIRouter()

MAX_TASK_CHUNK_MINUTES = 90
TASK_BUFFER_MINUTES = 10

PRIORITY_ORDER = {
    "high": 0,
    "medium": 1,
    "low": 2,
}

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


class TaskInput(BaseModel):
    text: str


class PlanInput(BaseModel):
    text: str


class ScheduledTask(BaseModel):
    title: str
    priority: str
    duration_minutes: int
    deadline: str | None = None
    start: str
    end: str


class CommitPlanInput(BaseModel):
    scheduled: list[ScheduledTask]


def clean_json_response(raw_text: str):
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```json", "", cleaned)
    cleaned = re.sub(r"^```", "", cleaned)
    cleaned = re.sub(r"```$", "", cleaned)
    return cleaned.strip()


def split_task_into_chunks(task: dict):
    duration_minutes = int(task["duration_minutes"])

    if duration_minutes <= MAX_TASK_CHUNK_MINUTES:
        return [duration_minutes]

    chunks = []

    while duration_minutes > 0:
        chunk = min(MAX_TASK_CHUNK_MINUTES, duration_minutes)
        chunks.append(chunk)
        duration_minutes -= chunk

    return chunks


@router.post("/parse-tasks")
def parse_tasks(input_data: TaskInput):
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(status_code=500, detail="Missing GEMINI_API_KEY")

    prompt = f"""
Convert the user's task dump into valid JSON only.

Each task must have:
- title: short task title
- duration_minutes: estimated duration as integer
- priority: high, medium, or low
- deadline: optional string or null

User input:
{input_data.text}

Return only JSON in this format:
[
  {{
    "title": "Review ECE notes",
    "duration_minutes": 60,
    "priority": "high",
    "deadline": "today"
  }}
]
"""

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
    )

    raw_text = clean_json_response(response.text)

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Gemini did not return valid JSON",
                "raw_response": raw_text,
            },
        )


@router.post("/generate-plan")
def generate_plan(input_data: PlanInput):
    tasks = parse_tasks(TaskInput(text=input_data.text))
    free_blocks = get_free_time()

    scheduled = []
    unscheduled = []

    tasks.sort(
        key=lambda task: (
            PRIORITY_ORDER.get(task.get("priority", "medium"), 1),
            int(task.get("duration_minutes", 30)),
        )
    )

    available_blocks = [
        {
            "start": datetime.fromisoformat(block["start"]),
            "end": datetime.fromisoformat(block["end"]),
        }
        for block in free_blocks
    ]

    for task in tasks:
        chunks = split_task_into_chunks(task)

        for index, chunk_minutes in enumerate(chunks):
            duration = timedelta(minutes=chunk_minutes)
            buffer = timedelta(minutes=TASK_BUFFER_MINUTES)
            placed = False

            for block in available_blocks:
                available_duration = block["end"] - block["start"]

                if available_duration >= duration + buffer:
                    task_start = block["start"] + buffer
                    task_end = task_start + duration

                    title = task["title"]
                    if len(chunks) > 1:
                        title = f"{task['title']} ({index + 1}/{len(chunks)})"

                    scheduled.append(
                        {
                            "title": title,
                            "priority": task["priority"],
                            "duration_minutes": chunk_minutes,
                            "deadline": task.get("deadline"),
                            "start": task_start.isoformat(),
                            "end": task_end.isoformat(),
                            "reason": "Scheduled based on priority, available free time, and buffer-aware planning.",
                        }
                    )

                    block["start"] = task_end
                    placed = True
                    break

            if not placed:
                unscheduled.append(
                    {
                        **task,
                        "duration_minutes": chunk_minutes,
                        "reason": "No free block was large enough after applying buffer rules.",
                    }
                )

    return {
        "scheduled": scheduled,
        "unscheduled": unscheduled,
        "free_blocks_used": free_blocks,
        "rules_applied": {
            "max_task_chunk_minutes": MAX_TASK_CHUNK_MINUTES,
            "task_buffer_minutes": TASK_BUFFER_MINUTES,
            "priority_order": PRIORITY_ORDER,
        },
    }


@router.post("/commit-plan")
def commit_plan(input_data: CommitPlanInput):
    service = get_calendar_service()

    created_events = []

    for task in input_data.scheduled:
        event_body = {
            "summary": task.title,
            "description": (
                "Scheduled by Orbit AI Workspace Assistant.\n"
                f"Priority: {task.priority}\n"
                f"Estimated duration: {task.duration_minutes} minutes"
            ),
            "start": {
                "dateTime": task.start,
                "timeZone": "America/Toronto",
            },
            "end": {
                "dateTime": task.end,
                "timeZone": "America/Toronto",
            },
        }

        created_event = (
            service.events()
            .insert(calendarId="primary", body=event_body)
            .execute()
        )

        created_events.append(
            {
                "title": task.title,
                "event_id": created_event.get("id"),
                "html_link": created_event.get("htmlLink"),
                "start": task.start,
                "end": task.end,
            }
        )

    return {
        "message": "Plan committed successfully",
        "created_count": len(created_events),
        "created_events": created_events,
    }