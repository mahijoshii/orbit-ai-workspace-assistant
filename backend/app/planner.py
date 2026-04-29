import json
import os
import re
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google import genai

from app.calendar import get_free_time, get_calendar_service

router = APIRouter()

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

    priority_order = {"high": 0, "medium": 1, "low": 2}
    tasks.sort(key=lambda task: priority_order.get(task.get("priority", "medium"), 1))

    available_blocks = [
        {
            "start": datetime.fromisoformat(block["start"]),
            "end": datetime.fromisoformat(block["end"]),
        }
        for block in free_blocks
    ]

    for task in tasks:
        duration = timedelta(minutes=int(task["duration_minutes"]))
        placed = False

        for block in available_blocks:
            if block["end"] - block["start"] >= duration:
                task_start = block["start"]
                task_end = task_start + duration

                scheduled.append(
                    {
                        "title": task["title"],
                        "priority": task["priority"],
                        "duration_minutes": task["duration_minutes"],
                        "deadline": task.get("deadline"),
                        "start": task_start.isoformat(),
                        "end": task_end.isoformat(),
                    }
                )

                block["start"] = task_end
                placed = True
                break

        if not placed:
            unscheduled.append(task)

    return {
        "scheduled": scheduled,
        "unscheduled": unscheduled,
        "free_blocks_used": free_blocks,
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