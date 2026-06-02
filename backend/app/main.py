from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.calendar import router as calendar_router
from app.auth import router as auth_router
from app.config import FRONTEND_URL
from app.gmail import router as gmail_router
from app.planner import router as planner_router
from app.preferences import router as preferences_router
from app.weather import router as weather_router

app = FastAPI(title="Orbit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Orbit API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(calendar_router, prefix="/calendar", tags=["calendar"])
app.include_router(gmail_router, prefix="/gmail", tags=["gmail"])
app.include_router(planner_router, prefix="/planner", tags=["planner"])
app.include_router(preferences_router, prefix="/preferences", tags=["preferences"])
app.include_router(weather_router, prefix="/weather", tags=["weather"])
