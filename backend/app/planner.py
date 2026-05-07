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

FOCUS_KEYWORDS = ["study", "write", "build", "code", "assignment", "project", "research"]
ADMIN_KEYWORDS = ["email", "reply", "message", "follow up", "follow-up", "inbox"]
PERSONAL_KEYWORDS = ["gym", "run", "workout", "meal", "cook", "walk"]
URGENT_DEADLINES = ["today", "tonight", "asap", "urgent"]

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


class CommitTaskInput(BaseModel):
    task: ScheduledTask


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


def infer_task_type(task: dict):
    text = f"{task.get('title', '')} {task.get('deadline', '')}".lower()

    if any(keyword in text for keyword in FOCUS_KEYWORDS):
        return "focus"
    if any(keyword in text for keyword in ADMIN_KEYWORDS):
        return "admin"
    if any(keyword in text for keyword in PERSONAL_KEYWORDS):
        return "personal"

    return "general"


def deadline_score(task: dict):
    deadline = str(task.get("deadline", "")).lower()

    if any(word in deadline for word in URGENT_DEADLINES):
        return 0

    return 1


def score_slot(task_type: str, start_time: datetime):
    hour = start_time.hour

    if task_type == "focus":
        if 9 <= hour <= 13:
            return 0
        if 14 <= hour <= 17:
            return 1
        return 3

    if task_type == "admin":
        if 11 <= hour <= 16:
            return 0
        return 2

    if task_type == "personal":
        if 16 <= hour <= 20:
            return 0
        if 12 <= hour <= 15:
            return 1
        return 3

    if 9 <= hour <= 18:
        return 1

    return 3


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

    for task in tasks:
        task["task_type"] = infer_task_type(task)

    tasks.sort(
        key=lambda task: (
            deadline_score(task),
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

            candidate_slots = []

            for block_index, block in enumerate(available_blocks):
                available_duration = block["end"] - block["start"]

                if available_duration >= duration + buffer:
                    proposed_start = block["start"] + buffer
                    proposed_end = proposed_start + duration

                    candidate_slots.append(
                        {
                            "block_index": block_index,
                            "start": proposed_start,
                            "end": proposed_end,
                            "score": score_slot(task["task_type"], proposed_start),
                        }
                    )

            if candidate_slots:
                best_slot = min(candidate_slots, key=lambda slot: slot["score"])
                block = available_blocks[best_slot["block_index"]]

                title = task["title"]
                if len(chunks) > 1:
                    title = f"{task['title']} ({index + 1}/{len(chunks)})"

                scheduled.append(
                    {
                        "title": title,
                        "priority": task["priority"],
                        "task_type": task["task_type"],
                        "duration_minutes": chunk_minutes,
                        "deadline": task.get("deadline"),
                        "start": best_slot["start"].isoformat(),
                        "end": best_slot["end"].isoformat(),
                        "reason": f"Scheduled as a {task['task_type']} task using priority, deadline, buffer, and time-of-day fit.",
                    }
                )

                block["start"] = best_slot["end"]
                placed = True

            if not placed:
                unscheduled.append(
                    {
                        **task,
                        "duration_minutes": chunk_minutes,
                        "reason": "No free block was large enough after applying buffer and task-fit rules.",
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
            "task_types": ["focus", "admin", "personal", "general"],
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


@router.post("/commit-task")
def commit_task(input_data: CommitTaskInput):
    service = get_calendar_service()
    task = input_data.task

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

    return {
        "message": "Task committed successfully",
        "title": task.title,
        "event_id": created_event.get("id"),
        "html_link": created_event.get("htmlLink"),
        "start": task.start,
        "end": task.end,
    }