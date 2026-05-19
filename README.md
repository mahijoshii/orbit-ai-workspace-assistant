# Orbit — AI Workspace Assistant

Orbit is an AI-powered productivity assistant built on top of Google Workspace.

It connects with Google Calendar and Gmail to help users plan their day, detect follow-ups, and turn natural-language tasks into scheduled calendar blocks.

---

## Why I’m Building This

Managing email, calendar events, and tasks is fragmented.

Every day, people:
- decide what to do next
- forget to follow up on emails
- manually move tasks into calendars

Even inside Google Workspace, these workflows are disconnected.

Orbit acts as an intelligent planning layer that sits on top of Gmail and Calendar and helps users go from:

“What do I need to do today?”
→ “My day is already planned.”

---

## Core Features

- Google OAuth authentication with secure token handling
- Calendar-aware scheduling using real-time availability from Google Calendar
- Gmail-based follow-up detection and draft generation
- Natural-language task parsing using Gemini API
- AI-powered daily planning with priority, deadline, and task-type awareness
- Constraint-based scheduling with buffers, chunking, and time-of-day optimization
- Approval-first workflow with editable schedules before committing actions
- Manual task adjustment and per-task calendar commit support
- Automated calendar execution via Google APIs

---

## Tech Stack

| Area | Tools |
|------|------|
| Frontend | React, TypeScript |
| Backend | Python, FastAPI |
| APIs | Google Calendar API, Gmail API |
| AI | Gemini API |
| Auth | Google OAuth 2.0 |
| Deployment | TBD |
| Intelligence | Task parsing, scheduling heuristics, constraint optimization |

---

## Planned Deployment

- Frontend: Vercel
- Backend API: Render or Railway
- OAuth + Google APIs: Google Cloud Platform

---


## Project Structure

```txt
orbit-ai-workspace-assistant/
├── backend/
├── frontend/
├── docs/
├── demo/
├── README.md
├── .gitignore
└── .env.example
```

---

## Build Tracker

### Phase 1 — Project Setup
- [x] Create repo
- [x] Add folder structure
- [x] Add README
- [x] Add `.gitignore`
- [x] Add `.env.example`

### Phase 2 — Google API Setup
- [x] Create Google Cloud project
- [x] Enable Calendar API
- [x] Enable Gmail API
- [x] Configure OAuth consent screen
- [x] Add test user
- [x] Create OAuth client
- [x] Add redirect URI
- [x] Store credentials locally

### Phase 3 — Backend Foundation
- [x] Set up FastAPI app
- [x] Add Google OAuth login
- [x] Add OAuth callback handler
- [x] Store user tokens locally
- [x] Add health check route

### Phase 4 — Calendar Integration
- [x] Fetch calendar events
- [x] Detect free time blocks
- [x] Create calendar events
- [x] Smart scheduling

### Phase 5 — Gmail Integration
- [x] Fetch email threads
- [x] Detect follow-ups
- [x] Generate replies
- [x] Create drafts

### Phase 6 — AI Planning Engine
- [x] Parse natural-language tasks
- [x] Rank tasks by priority
- [x] Schedule tasks into free calendar blocks
- [x] Commit approved plans to Google Calendar

### Phase 7 — Smarter Scheduling Intelligence
- [x] Avoid awkward scheduling times
- [x] Add buffers between tasks
- [x] Split long tasks into chunks
- [x] Improve priority and deadline handling
- [x] Add smarter task-type scheduling
- [ ] Respect explicit user-provided scheduling constraints
- [ ] Add personalized scheduling preferences

### Phase 8 — Frontend Dashboard (CURRENT)
- [x] Build React + TypeScript dashboard
- [x] Connect frontend to FastAPI backend
- [x] Generate AI-powered daily plans from the UI
- [x] Commit approved plans into Google Calendar
- [x] Allow manual task editing before calendar commit
- [x] Support committing individual tasks instead of full schedules
- [x] Display Google Calendar timeline
- [x] Display Gmail follow-ups requiring responses

### Phase 9 — Product Polish
- [ ] Add assistant UI
- [ ] Add animations / UX polish
- [ ] Add demo data mode
- [ ] Add screenshots

### Phase 10 — Engineering Polish
- [ ] Add Docker
- [ ] Add unit tests
- [ ] Add logging
- [ ] Add CI/CD

### Phase 11 — Demo
- [ ] Record demo video
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
7. Approve the plan
8. Commit approved tasks to Google Calendar

---

## What Works Today

Orbit is a fully functional AI scheduling system that:

- Authenticates users via Google OAuth
- Reads and writes real Google Calendar events
- Extracts and analyzes Gmail threads for follow-ups
- Converts natural-language input into structured tasks using Gemini
- Generates optimized daily plans based on free time, priority, and constraints
- Applies smart scheduling rules including buffers, chunking, and time-of-day fit
- Commits approved plans directly into Google Calendar
- Provides a live frontend dashboard for generating and approving AI schedules
- Supports approval-first scheduling before modifying Google Calendar
- Applies task chunking, buffers, and time-of-day scheduling heuristics

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

- Respect explicit user scheduling constraints from natural-language prompts
- Allow users to manually adjust AI-generated schedules before commit
- Support committing individual tasks instead of entire schedules
- Detect unanswered Gmail threads and surface follow-up recommendations
- Learn personalized scheduling preferences over time
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
7. Orbit commits approved tasks directly into Google Calendar

---

## Demo

Coming soon.

---

## Status

🚧 Currently building: **Human-in-the-loop Scheduling + Workspace UX (Phase 8)**

---

## Author

**Mahi Joshi**  
