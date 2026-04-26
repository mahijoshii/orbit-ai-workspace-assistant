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

- Google OAuth login
- Google Calendar integration
- Gmail follow-up detection
- AI-generated daily planning
- Natural-language task scheduling
- Calendar event creation
- Approval-first workflow

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

### Phase 4 — Calendar Integration (CURRENT)
- [ ] Fetch calendar events
- [ ] Detect free time blocks
- [ ] Create calendar events
- [ ] Update/delete events

### Phase 5 — Gmail Integration
- [ ] Fetch email threads
- [ ] Detect follow-ups
- [ ] Generate replies
- [ ] Create drafts

### Phase 6 — AI Planning Engine
- [ ] Parse natural-language tasks
- [ ] Rank tasks by priority
- [ ] Schedule tasks into calendar
- [ ] Explain planning decisions

### Phase 7 — Frontend Dashboard
- [ ] Build React UI
- [ ] Display daily plan
- [ ] Display calendar
- [ ] Display follow-ups
- [ ] Add approve/reject actions

### Phase 8 — Product Polish
- [ ] Add assistant UI
- [ ] Add animations / UX polish
- [ ] Add demo data mode
- [ ] Add screenshots

### Phase 9 — Engineering Polish
- [ ] Add Docker
- [ ] Add unit tests
- [ ] Add logging
- [ ] Add CI/CD

### Phase 10 — Demo 
- [ ] Record demo video
- [ ] Add GIF to README
- [ ] Add architecture diagram

---

## MVP Goal

The MVP will allow a user to:

1. Log in with Google
2. Fetch calendar events
3. Enter tasks in natural language
4. Generate a daily plan
5. Approve tasks
6. Automatically schedule them

---

## Design Principles

- Approval-first (user stays in control)
- Google-native (feels like a Workspace extension)
- Useful before flashy
- Fast iteration over perfection

---

## Google APIs Used

- Google Calendar API
- Gmail API
- Google OAuth 2.0

---

## Demo

Coming soon.

---

## Status

Currently building: Calendar Integration (Phase 4)

---

## Author

**Mahi Joshi**  