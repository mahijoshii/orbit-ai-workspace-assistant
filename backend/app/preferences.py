import json
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()

PREFERENCES_FILE = Path("preferences.json")

DEFAULT_PREFERENCES = {
    "preferred_start_hour": 9,
    "preferred_end_hour": 22,
    "default_buffer_minutes": 10,
    "location_name": "Toronto",
    "latitude": 43.6532,
    "longitude": -79.3832,
}


class SchedulingPreferences(BaseModel):
    preferred_start_hour: int = Field(default=9, ge=0, le=23)
    preferred_end_hour: int = Field(default=22, ge=1, le=24)
    default_buffer_minutes: int = Field(default=10, ge=0, le=120)
    location_name: str = "Toronto"
    latitude: float = 43.6532
    longitude: float = -79.3832


def get_preferences():
    if not PREFERENCES_FILE.exists():
        return DEFAULT_PREFERENCES.copy()

    try:
        saved = json.loads(PREFERENCES_FILE.read_text())
    except json.JSONDecodeError:
        return DEFAULT_PREFERENCES.copy()

    return {
        **DEFAULT_PREFERENCES,
        **saved,
    }


@router.get("")
def read_preferences():
    return get_preferences()


@router.put("")
def update_preferences(preferences: SchedulingPreferences):
    data = preferences.model_dump()
    PREFERENCES_FILE.write_text(json.dumps(data, indent=2))
    return data
