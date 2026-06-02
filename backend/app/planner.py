import json
import os
import re
from datetime import datetime, timedelta
from google.genai import errors

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google import genai

from app.calendar import get_free_time, get_calendar_service
from app.preferences import get_preferences

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


def parse_time_phrase(
    raw_hour: str,
    meridiem: str | None,
    assume_pm_for_daytime: bool = False,
):
    hour = int(raw_hour)

    if meridiem:
        meridiem = meridiem.lower()
        if meridiem == "pm" and hour != 12:
            hour += 12
        if meridiem == "am" and hour == 12:
            hour = 0
    elif assume_pm_for_daytime and 1 <= hour <= 7:
        hour += 12

    return hour


def extract_scheduling_constraints(text: str):
    normalized = text.lower()
    preferences = get_preferences()
    constraints = {
        "earliest_hour": preferences["preferred_start_hour"],
        "latest_hour": preferences["preferred_end_hour"],
        "buffer_minutes": preferences["default_buffer_minutes"],
        "preferred_window": None,
        "notes": [
            f"Use preferred schedule window {preferences['preferred_start_hour']}:00-{preferences['preferred_end_hour']}:00",
            f"Use default {preferences['default_buffer_minutes']} minute buffer",
        ],
    }

    buffer_match = re.search(r"leave\s+(\d+)\s+minutes?\s+between", normalized)
    if buffer_match:
        constraints["buffer_minutes"] = int(buffer_match.group(1))
        constraints["notes"].append(
            f"Leave {constraints['buffer_minutes']} minutes between tasks"
        )

    no_after_match = re.search(
        r"no\s+(?:meetings|tasks|work|events)\s+after\s+(\d{1,2})(?::\d{2})?\s*(am|pm)?",
        normalized,
    )
    if no_after_match:
        constraints["latest_hour"] = parse_time_phrase(
            no_after_match.group(1), no_after_match.group(2), True
        )
        constraints["notes"].append(
            f"Do not schedule after {constraints['latest_hour']}:00"
        )

    after_match = re.search(r"\bafter\s+(\d{1,2})(?::\d{2})?\s*(am|pm)?", normalized)
    if after_match and not no_after_match:
        constraints["earliest_hour"] = parse_time_phrase(
            after_match.group(1), after_match.group(2), True
        )
        constraints["notes"].append(f"Start after {constraints['earliest_hour']}:00")

    before_match = re.search(r"\bbefore\s+(\d{1,2})(?::\d{2})?\s*(am|pm)?", normalized)
    if before_match:
        constraints["latest_hour"] = parse_time_phrase(
            before_match.group(1), before_match.group(2), True
        )
        constraints["notes"].append(f"Finish before {constraints['latest_hour']}:00")

    if "before lunch" in normalized:
        constraints["latest_hour"] = 12
        constraints["preferred_window"] = "morning"
        constraints["notes"].append("Finish before lunch")

    if "morning" in normalized:
        constraints["earliest_hour"] = constraints["earliest_hour"] or 9
        constraints["latest_hour"] = min(constraints["latest_hour"] or 12, 12)
        constraints["preferred_window"] = "morning"
        constraints["notes"].append("Prefer morning scheduling")

    if "afternoon" in normalized:
        constraints["earliest_hour"] = max(constraints["earliest_hour"] or 12, 12)
        constraints["latest_hour"] = constraints["latest_hour"] or 17
        constraints["preferred_window"] = "afternoon"
        constraints["notes"].append("Prefer afternoon scheduling")

    if "evening" in normalized:
        constraints["earliest_hour"] = max(constraints["earliest_hour"] or 17, 17)
        constraints["preferred_window"] = "evening"
        constraints["notes"].append("Prefer evening scheduling")

    return constraints


def apply_scheduling_constraints(blocks: list[dict], constraints: dict):
    constrained_blocks = []

    for block in blocks:
        start = block["start"]
        end = block["end"]

        if constraints["earliest_hour"] is not None:
            earliest = start.replace(
                hour=constraints["earliest_hour"],
                minute=0,
                second=0,
                microsecond=0,
            )
            start = max(start, earliest)

        if constraints["latest_hour"] is not None:
            latest = end.replace(
                hour=constraints["latest_hour"],
                minute=0,
                second=0,
                microsecond=0,
            )
            end = min(end, latest)

        if end > start:
            constrained_blocks.append({"start": start, "end": end})

    return constrained_blocks


def find_internal_conflicts(tasks: list[ScheduledTask]):
    conflicts = []
    sorted_tasks = sorted(tasks, key=lambda task: datetime.fromisoformat(task.start))

    for index in range(1, len(sorted_tasks)):
        previous = sorted_tasks[index - 1]
        current = sorted_tasks[index]

        if datetime.fromisoformat(previous.end) > datetime.fromisoformat(current.start):
            conflicts.append(
                {
                    "type": "generated-task",
                    "task": current.title,
                    "conflicts_with": previous.title,
                    "start": current.start,
                    "end": current.end,
                }
            )

    return conflicts


def find_calendar_conflicts(tasks: list[ScheduledTask]):
    if not tasks:
        return []

    service = get_calendar_service()
    earliest = min(datetime.fromisoformat(task.start) for task in tasks)
    latest = max(datetime.fromisoformat(task.end) for task in tasks)

    events_result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=earliest.isoformat(),
            timeMax=latest.isoformat(),
            maxResults=50,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )

    conflicts = []

    for task in tasks:
        task_start = datetime.fromisoformat(task.start)
        task_end = datetime.fromisoformat(task.end)

        for event in events_result.get("items", []):
            event_start = event.get("start", {}).get("dateTime")
            event_end = event.get("end", {}).get("dateTime")

            if not event_start or not event_end:
                continue

            busy_start = datetime.fromisoformat(event_start)
            busy_end = datetime.fromisoformat(event_end)

            if task_start < busy_end and task_end > busy_start:
                conflicts.append(
                    {
                        "type": "calendar-event",
                        "task": task.title,
                        "conflicts_with": event.get("summary", "Untitled Event"),
                        "start": task.start,
                        "end": task.end,
                    }
                )

    return conflicts


def assert_no_conflicts(tasks: list[ScheduledTask]):
    conflicts = find_internal_conflicts(tasks) + find_calendar_conflicts(tasks)

    if conflicts:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Schedule has conflicts. Adjust the overlapping tasks before committing.",
                "conflicts": conflicts,
            },
        )


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

    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
        )
    except errors.ServerError:
        raise HTTPException(
            status_code=503,
            detail="Gemini is temporarily overloaded. Please try again in a moment.",
        )
    except errors.APIError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini API error: {str(e)}",
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
    scheduling_constraints = extract_scheduling_constraints(input_data.text)

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
    available_blocks = apply_scheduling_constraints(
        available_blocks, scheduling_constraints
    )

    for task in tasks:
        chunks = split_task_into_chunks(task)

        for index, chunk_minutes in enumerate(chunks):
            duration = timedelta(minutes=chunk_minutes)
            buffer = timedelta(minutes=scheduling_constraints["buffer_minutes"])
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
                        "reason": f"Scheduled as a {task['task_type']} task using priority, deadline, buffer, time-of-day fit, and your stated constraints.",
                    }
                )

                block["start"] = best_slot["end"]
                placed = True

            if not placed:
                unscheduled.append(
                    {
                        **task,
                        "duration_minutes": chunk_minutes,
                        "reason": "No free block was large enough after applying buffer, task-fit rules, and your stated constraints.",
                    }
                )

    return {
        "scheduled": scheduled,
        "unscheduled": unscheduled,
        "free_blocks_used": free_blocks,
        "rules_applied": {
            "max_task_chunk_minutes": MAX_TASK_CHUNK_MINUTES,
            "task_buffer_minutes": scheduling_constraints["buffer_minutes"],
            "priority_order": PRIORITY_ORDER,
            "task_types": ["focus", "admin", "personal", "general"],
            "scheduling_constraints": scheduling_constraints,
        },
    }


@router.post("/commit-plan")
def commit_plan(input_data: CommitPlanInput):
    service = get_calendar_service()
    assert_no_conflicts(input_data.scheduled)

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
    assert_no_conflicts([task])

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
