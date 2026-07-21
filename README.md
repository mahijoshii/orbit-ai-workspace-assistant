# Orbit - AI Workspace Assistant

Orbit is an AI-powered productivity assistant built on top of Google Workspace.

It connects with Google Calendar and Gmail to help users plan their day, detect follow-ups, and turn natural-language tasks into scheduled calendar blocks.

---

## Demo

Watch the Orbit demo video: [Google Drive demo](https://drive.google.com/file/d/10GmlQxcXXxcrdee7CVkC2BMcsh3PhuQ_/view?usp=sharing)

---

## Why I'm Building This

Managing email, calendar events, and tasks is fragmented.

Every day, people:
- decide what to do next
- forget to follow up on emails
- manually move tasks into calendars

Even inside Google Workspace, these workflows are disconnected.

Orbit acts as an intelligent planning layer that sits on top of Gmail and Calendar and helps users go from:

"What do I need to do today?"
to
"My day is already planned."

---

## Core Features

- Google OAuth authentication with secure token handling
- Calendar-aware scheduling using real-time availability from Google Calendar
- Gmail-based follow-up detection and draft generation
- Natural-language task parsing using Gemini API
- AI-powered daily planning with priority, deadline, task type, and user constraints
- Constraint-based scheduling with buffers, chunking, and time-of-day optimization
- Approval-first workflow with editable schedules before committing actions
- Manual task adjustment, click-to-move repositioning, manual time editing, and per-task calendar commit support
- Conflict detection before committing generated tasks
- Calendar event deletion through the dashboard
- Daily briefing with calendar, task, and Gmail follow-up context
- Meeting prep suggestions based on upcoming events and Gmail follow-ups
- Automated calendar execution via Google APIs

---

## Tech Stack

| Area | Tools |
|------|------|
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI |
| APIs | Google Calendar API, Gmail API |
| AI | Gemini API |
| Auth | Google OAuth 2.0 |
| Deployment | TBD |
| Intelligence | Task parsing, scheduling heuristics, constraint optimization, prep suggestions |

---

## Planned Deployment

- Frontend: Vercel
- Backend API: Render or Railway
- OAuth + Google APIs: Google Cloud Platform

---

## Project Structure

```txt
orbit-ai-workspace-assistant/
|-- backend/
|-- frontend/
|-- docs/
|-- demo/
|-- README.md
|-- .gitignore
`-- .env.example
```

---

## Build Tracker

### Phase 1 - Project Setup
- [x] Create repo
- [x] Add folder structure
- [x] Add README
- [x] Add `.gitignore`
- [x] Add `.env.example`

### Phase 2 - Google API Setup
- [x] Create Google Cloud project
- [x] Enable Calendar API
- [x] Enable Gmail API
- [x] Configure OAuth consent screen
- [x] Add test user
- [x] Create OAuth client
- [x] Add redirect URI
- [x] Store credentials locally

### Phase 3 - Backend Foundation
- [x] Set up FastAPI app
- [x] Add Google OAuth login
- [x] Add OAuth callback handler
- [x] Store user tokens locally
- [x] Add health check route

### Phase 4 - Calendar Integration
- [x] Fetch calendar events
- [x] Detect free time blocks
- [x] Create calendar events
- [x] Smart scheduling

### Phase 5 - Gmail Integration
- [x] Fetch email threads
- [x] Detect follow-ups
- [x] Generate replies
- [x] Create drafts

### Phase 6 - AI Planning Engine
- [x] Parse natural-language tasks
- [x] Rank tasks by priority
- [x] Schedule tasks into free calendar blocks
- [x] Commit approved plans to Google Calendar

### Phase 7 - Smarter Scheduling Intelligence
- [x] Avoid awkward scheduling times
- [x] Add buffers between tasks
- [x] Split long tasks into chunks
- [x] Improve priority and deadline handling
- [x] Add smarter task-type scheduling
- [x] Respect explicit user-provided scheduling constraints
- [x] Add personalized scheduling preferences

### Phase 8 - Frontend Dashboard
- [x] Build React + TypeScript dashboard
- [x] Connect frontend to FastAPI backend
- [x] Generate AI-powered daily plans from the UI
- [x] Commit approved plans into Google Calendar
- [x] Allow manual task editing before calendar commit
- [x] Support committing individual tasks instead of full schedules
- [x] Display Google Calendar timeline
- [x] Display Gmail follow-ups requiring responses

### Phase 9 - Product Polish
- [x] Add assistant UI
- [x] Add animations / UX polish

### Phase 10 - Interactive Scheduling
- [x] Allow deleting scheduled tasks and calendar events
- [x] Add click-to-move task scheduling
- [x] Support visual task repositioning directly in calendar view
- [x] Support manual start/end time editing for selected calendar items
- [x] Add conflict detection and overlap warnings
- [x] Add smart schedule adjustment suggestions

### Phase 11 - Workspace Intelligence
- [x] Add AI daily briefing at the top of the dashboard
- [x] Summarize calendar events, tasks, and follow-ups
- [x] Surface contextual prep suggestions for upcoming events
- [x] Add weather-aware preparation recommendations
- [x] Add cooking and grocery preparation reminders
- [x] Suggest schedule adjustments based on upcoming workload

### Phase 12 - Meeting Prep Assistant
- [x] Detect upcoming meetings and presentations
- [x] Search Gmail threads related to meetings
- [x] Search notes and documents for meeting context
- [x] Generate AI summaries for meeting preparation
- [x] Surface relevant action items and follow-ups
- [x] Add searchable workspace context assistant

### Phase 13 - Engineering Polish
- [ ] Add Docker
- [ ] Add unit tests
- [x] Add basic dependency/runtime polish
- [ ] Add logging
- [ ] Add CI/CD

### Phase 14 - Demo
- [ ] Add screenshots
- [x] Record demo video
- [ ] Add GIF to README
- [ ] Add architecture diagram

---

## MVP Goal

The MVP allows a user to:

1. Log in with Google
2. Fetch calendar events
3. Detect free time blocks
4. Fetch Gmail messages and detect follow-ups
5. Enter tasks in natural language
6. Generate a structured daily plan
7. Review, edit, remove, or reposition generated tasks and calendar events
8. Detect conflicts before committing
9. Approve the plan
10. Commit approved tasks to Google Calendar

---

## What Works Today

Orbit is a functional AI scheduling system that:

- Authenticates users via Google OAuth
- Reads and writes real Google Calendar events
- Deletes Google Calendar events from the dashboard
- Extracts and analyzes Gmail messages for follow-ups
- Converts natural-language input into structured tasks using Gemini
- Generates optimized daily plans based on free time, priority, deadlines, task type, and constraints
- Applies scheduling rules including buffers, chunking, time-of-day fit, and explicit user constraints
- Supports constraints like "after 3pm", "before lunch", "morning", "no meetings after 5", and "leave 30 minutes between tasks"
- Lets users edit, remove, nudge, click-to-move, and visually reposition generated tasks before commit
- Lets users click-to-move existing Google Calendar events and manually edit selected start/end times
- Detects overlaps between generated tasks and existing calendar events before committing
- Commits approved plans or individual tasks directly into Google Calendar
- Shows a Daily Briefing with current/next calendar context, generated tasks, Gmail follow-ups, and prep reminders
- Shows a Meeting Prep panel with practical suggestions based on upcoming event titles and Gmail follow-up context
- Searches Gmail and local docs for meeting prep context
- Generates short meeting prep summaries from matched workspace context
- Uses saved scheduling preferences for default planning hours, buffer time, and weather location
- Uses free weather data for outdoor preparation suggestions
- Supports repositioning existing Google Calendar events through the dashboard
- Provides a live frontend dashboard for generating and approving AI schedules
- Supports approval-first scheduling before modifying Google Calendar

---

## Current Limitations

- Weather-aware suggestions use free Open-Meteo data and the saved user location, not a paid weather API.
- Meeting Prep searches Gmail snippets and local files under `docs/`, but does not yet search Google Docs through the Google Drive/Docs APIs.
- Personalized scheduling preferences are saved locally, but Orbit does not yet learn them automatically from behavior.
- Calendar repositioning supports click-to-move and manual start/end editing, not full event resizing.
- The project is still local-first and not production deployed.

---

## Why This Project Matters

Orbit goes beyond simple task management by combining natural language understanding, real-world constraints, and API execution into a single system.

It demonstrates how AI can move from suggestion to action by:
- interpreting user intent
- reasoning about time and constraints
- optimizing decisions
- executing workflows across real applications

This mirrors the architecture of modern AI agents and productivity tools.

---

## Planned Intelligence Improvements

- Learn personalized scheduling preferences automatically from user behavior
- Search full Gmail threads for richer meeting context
- Search Google Docs through Google Drive/Docs APIs
- Add deeper multi-source AI summaries for meeting preparation
- Improve conflict resolution with one-click rescheduling
- Add full calendar event resizing
- Add contextual task placement based on workload and calendar density

---

## Design Principles

- Approval-first: Orbit suggests actions before taking them
- Google-native: the product should feel like a natural extension of Google Workspace
- Useful before flashy: core planning should work before UI polish
- Privacy-aware: secrets and OAuth tokens stay local during MVP development
- Fast iteration over perfection

---

## Google APIs Used

- Google Calendar API
- Gmail API
- Google OAuth 2.0
- Gemini API

---

## Example Workflow

1. User logs in with Google OAuth
2. Orbit fetches Gmail and Calendar context
3. User enters tasks in natural language
4. Gemini converts tasks into structured planning objects
5. Orbit detects free time and optimizes scheduling
6. User reviews the generated plan
7. User edits, removes, or repositions generated tasks and calendar events
8. Orbit warns about conflicts before commit
9. User commits approved tasks directly into Google Calendar
10. Orbit shows a briefing and prep suggestions for the day

---

## Local Development

Backend:

```bash
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```

---

## Status

Currently building: **Workspace Intelligence + Meeting Prep MVP (Phases 11-12)**

---

## Author

**Mahi Joshi**
