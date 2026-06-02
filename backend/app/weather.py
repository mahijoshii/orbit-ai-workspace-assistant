import json
from urllib.parse import urlencode
from urllib.request import urlopen

from fastapi import APIRouter, HTTPException

from app.preferences import get_preferences

router = APIRouter()

WEATHER_CODES = {
    0: "clear",
    1: "mostly clear",
    2: "partly cloudy",
    3: "cloudy",
    45: "foggy",
    48: "foggy",
    51: "light drizzle",
    53: "drizzle",
    55: "heavy drizzle",
    61: "light rain",
    63: "rain",
    65: "heavy rain",
    71: "light snow",
    73: "snow",
    75: "heavy snow",
    80: "rain showers",
    81: "rain showers",
    82: "heavy rain showers",
    95: "thunderstorms",
}


def weather_advice(description: str, temperature: float, precipitation: float, wind: float):
    tips = []

    if temperature <= 5:
        tips.append("Wear a warm layer before heading outside.")
    elif temperature >= 24:
        tips.append("Bring water and choose lighter clothes if you go out.")

    if precipitation > 30 or "rain" in description or "drizzle" in description:
        tips.append("Bring an umbrella or rain jacket.")

    if "snow" in description:
        tips.append("Wear boots or shoes with grip.")

    if wind >= 25:
        tips.append("It may feel windy, so secure loose layers.")

    if not tips:
        tips.append("Weather looks manageable for outdoor plans.")

    return tips


@router.get("/current")
def current_weather(latitude: float | None = None, longitude: float | None = None):
    preferences = get_preferences()
    lat = latitude if latitude is not None else preferences["latitude"]
    lon = longitude if longitude is not None else preferences["longitude"]

    params = urlencode(
        {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,precipitation,weather_code,wind_speed_10m",
            "timezone": "auto",
        }
    )

    try:
        with urlopen(f"https://api.open-meteo.com/v1/forecast?{params}", timeout=8) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Weather lookup failed: {str(exc)}",
        )

    current = data.get("current", {})
    code = int(current.get("weather_code", 0))
    description = WEATHER_CODES.get(code, "mixed weather")
    temperature = float(current.get("temperature_2m", 0))
    precipitation = float(current.get("precipitation", 0))
    wind = float(current.get("wind_speed_10m", 0))

    return {
        "location_name": preferences.get("location_name", "Saved location"),
        "temperature": temperature,
        "precipitation": precipitation,
        "wind_speed": wind,
        "description": description,
        "advice": weather_advice(description, temperature, precipitation, wind),
    }
