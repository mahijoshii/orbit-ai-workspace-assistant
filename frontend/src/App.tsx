import { useEffect, useState } from "react";
import axios from "axios";
import "./styles.css";

const API_BASE = "http://localhost:8000";
const CALENDAR_START_HOUR = 8;
const CALENDAR_END_HOUR = 22;
const HOUR_HEIGHT = 72;

type ScheduledTask = {
  title: string;
  priority: string;
  task_type?: string;
  duration_minutes: number;
  deadline?: string | null;
  start: string;
  end: string;
  reason?: string;
};

type FollowUp = {
  id: string;
  thread_id: string;
  from: string;
  subject: string;
  snippet: string;
  score: number;
  matched_keywords: string[];
  suggested_action: string;
};

type CalendarEvent = {
  id: string;
  title: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string | null;
};

function App() {
  const [taskText, setTaskText] = useState(
    "study ECE for 3 hours today, reply to emails for 30 minutes, go to the gym for 1 hour tonight"
  );
  const [scheduled, setScheduled] = useState<ScheduledTask[]>([]);
  const [unscheduled, setUnscheduled] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [draftPreviews, setDraftPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");

  const loginWithGoogle = () => {
    window.location.href = `${API_BASE}/auth/login`;
  };

  const fetchCalendarEvents = async () => {
    setCalendarLoading(true);

    try {
      const res = await axios.get(`${API_BASE}/calendar/events`);
      setCalendarEvents(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarEvents();
  }, []);

  const generatePlan = async () => {
    setLoading(true);
    setCommitMessage("");

    try {
      const res = await axios.post(`${API_BASE}/planner/generate-plan`, {
        text: taskText,
      });

      setScheduled(res.data.scheduled || []);
      setUnscheduled(res.data.unscheduled || []);
    } catch (error) {
      console.error(error);
      alert("Failed to generate plan. Check your backend terminal.");
    } finally {
      setLoading(false);
    }
  };

  const commitPlan = async () => {
    if (scheduled.length === 0) {
      alert("Generate a plan first.");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/planner/commit-plan`, {
        scheduled,
      });

      setCommitMessage(
        `Committed ${res.data.created_count} tasks to Google Calendar.`
      );

      setScheduled([]);
      await fetchCalendarEvents();
    } catch (error) {
      console.error(error);
      alert("Failed to commit plan. Check your backend terminal.");
    } finally {
      setLoading(false);
    }
  };

  const updateTask = (
    index: number,
    field: keyof ScheduledTask,
    value: string
  ) => {
    const updated = [...scheduled];

    updated[index] = {
      ...updated[index],
      [field]: field === "duration_minutes" ? Number(value) : value,
    };

    setScheduled(updated);
  };

  const commitSingleTask = async (task: ScheduledTask, index: number) => {
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/planner/commit-task`, {
        task,
      });

      setCommitMessage(`Committed "${res.data.title}" to Google Calendar.`);

      const updated = [...scheduled];
      updated.splice(index, 1);
      setScheduled(updated);

      await fetchCalendarEvents();
    } catch (error) {
      console.error(error);
      alert("Failed to commit task. Check your backend terminal.");
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowUps = async () => {
    setFollowUpsLoading(true);
    setCommitMessage("");

    try {
      const res = await axios.get(`${API_BASE}/gmail/follow-ups`, {
        params: { max_results: 15 },
      });

      setFollowUps(res.data || []);
    } catch (error) {
      console.error(error);
      alert("Failed to fetch Gmail follow-ups. Check your backend terminal.");
    } finally {
      setFollowUpsLoading(false);
    }
  };

  const previewDraft = (followUp: FollowUp) => {
    setDraftPreviews((current) => ({
      ...current,
      [followUp.id]: `Hi,\n\nThanks for your email. I wanted to follow up on this and will get back to you shortly.\n\nBest,\nMahi`,
    }));
  };

  const updateDraftPreview = (id: string, body: string) => {
    setDraftPreviews((current) => ({
      ...current,
      [id]: body,
    }));
  };

  const approveDraft = async (followUp: FollowUp) => {
    const emailMatch = followUp.from.match(/<(.+?)>/);
    const to = emailMatch ? emailMatch[1] : followUp.from;

    try {
      await axios.post(`${API_BASE}/gmail/draft-follow-up`, {
        to,
        subject: `Re: ${followUp.subject || "Follow up"}`,
        body: draftPreviews[followUp.id],
      });

      setCommitMessage(`Approved and created draft for "${followUp.subject}".`);

      setFollowUps((current) =>
        current.filter((item) => item.id !== followUp.id)
      );

      setDraftPreviews((current) => {
        const updated = { ...current };
        delete updated[followUp.id];
        return updated;
      });
    } catch (error) {
      console.error(error);
      alert("Failed to create draft. Check your backend terminal.");
    }
  };

  const getEventStart = (event: CalendarEvent) => {
    return event.start.dateTime || `${event.start.date}T00:00:00`;
  };

  const getEventEnd = (event: CalendarEvent) => {
    return event.end.dateTime || `${event.end.date}T23:59:00`;
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDateTimeLocal = (iso: string) => {
    const date = new Date(iso);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const convertLocalToISO = (value: string) => {
    return new Date(value).toISOString();
  };

  const getCalendarEventType = (title: string) => {
    const text = title.toLowerCase();

    if (
      text.includes("study") ||
      text.includes("code") ||
      text.includes("ece") ||
      text.includes("assignment") ||
      text.includes("project") ||
      text.includes("work") ||
      text.includes("office") ||
      text.includes("amplify")
    ) {
      return "focus";
    }

    if (
      text.includes("email") ||
      text.includes("reply") ||
      text.includes("follow") ||
      text.includes("meeting") ||
      text.includes("call")
    ) {
      return "admin";
    }

    if (
      text.includes("gym") ||
      text.includes("run") ||
      text.includes("workout") ||
      text.includes("glutes") ||
      text.includes("legs") ||
      text.includes("walk") ||
      text.includes("lunch") ||
      text.includes("cardio") ||
      text.includes("core")
    ) {
      return "personal";
    }

    return "general";
  };

  const getCalendarEventStyle = (event: CalendarEvent) => {
    const start = new Date(getEventStart(event));
    const end = new Date(getEventEnd(event));

    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const calendarStartMinutes = CALENDAR_START_HOUR * 60;

    const top =
      ((startMinutes - calendarStartMinutes) / 60) * HOUR_HEIGHT;

    const height =
      Math.max(28, ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT);

    const durationMinutes = Math.max(1, endMinutes - startMinutes);

    return {
      top: `${Math.max(0, top)}px`,
      height: `${height}px`,
      zIndex: 10000 - durationMinutes,
    };
  };

  const sortedCalendarEvents = [...calendarEvents].sort(
    (a, b) =>
      new Date(getEventStart(a)).getTime() -
      new Date(getEventStart(b)).getTime()
  );

  return (
    <div className="app">
      <nav className="nav">
        <div>
          <div className="logo">Orbit</div>
          <div className="subtitle">AI Workspace Assistant</div>
        </div>
        <button className="secondary-btn" onClick={loginWithGoogle}>
          Connect Google
        </button>
      </nav>

      <main className="hero">
        <section className="hero-copy">
          <div className="eyebrow">Google Workspace + AI planning</div>
          <h1>Turn messy tasks into a scheduled day.</h1>
          <p>
            Orbit connects Gmail, Calendar, and Gemini to understand your tasks,
            detect follow-ups, find free time, and commit approved plans into
            Google Calendar.
          </p>
        </section>

        <section className="planner-card">
          <label>What do you need to do today?</label>
          <textarea
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
          />

          <div className="actions">
            <button onClick={generatePlan} disabled={loading}>
              {loading ? "Thinking..." : "Generate Plan"}
            </button>
            <button
              className="secondary-btn"
              onClick={commitPlan}
              disabled={loading || scheduled.length === 0}
            >
              Commit Full Plan
            </button>
          </div>

          {commitMessage && <div className="success">{commitMessage}</div>}
        </section>
      </main>

      <section className="dashboard calendar-section">
        <div className="section-header">
          <h2>Today's Calendar</h2>
          <p>Live Google Calendar view. Approved tasks appear here.</p>
        </div>

        <button
          className="secondary-btn"
          onClick={async () => {
            await fetchCalendarEvents();
            setCommitMessage("Calendar refreshed.");
          }}
          disabled={calendarLoading}
        >
          {calendarLoading ? "Refreshing..." : "Refresh Calendar"}
        </button>

        <div
          className="calendar-gcal-view"
          style={{
            height: `${
              (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT
            }px`,
          }}
        >
          {Array.from(
            { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 },
            (_, i) => {
              const hour = i + CALENDAR_START_HOUR;

              return (
                <div
                  className="calendar-gcal-hour"
                  key={hour}
                  style={{ top: `${i * HOUR_HEIGHT}px` }}
                >
                  <div className="calendar-gcal-label">
                    {hour < 12
                      ? `${hour} AM`
                      : hour === 12
                      ? "12 PM"
                      : `${hour - 12} PM`}
                  </div>
                  <div className="calendar-gcal-line" />
                </div>
              );
            }
          )}

          <div className="calendar-gcal-events">
            {sortedCalendarEvents.map((event) => (
              <div
                className={`calendar-gcal-event ${getCalendarEventType(
                  event.title
                )}`}
                style={getCalendarEventStyle(event)}
                key={event.id}
              >
                <div className="calendar-gcal-event-title">{event.title}</div>
                <div className="calendar-gcal-event-time">
                  {formatTime(getEventStart(event))} —{" "}
                  {formatTime(getEventEnd(event))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard">
        <div className="section-header">
          <h2>Generated Plan</h2>
          <p>Edit tasks first, then commit one task or the full schedule.</p>
        </div>

        {scheduled.length === 0 ? (
          <div className="empty">No plan generated yet.</div>
        ) : (
          <div className="task-grid">
            {scheduled.map((task, index) => (
              <div className="task-card" key={`${task.title}-${index}`}>
                <div className="task-top">
                  <span className="pill">{task.priority}</span>
                  {task.task_type && (
                    <span className="pill muted">{task.task_type}</span>
                  )}
                </div>

                <label className="mini-label">Task</label>
                <input
                  className="task-input"
                  value={task.title}
                  onChange={(e) => updateTask(index, "title", e.target.value)}
                />

                <label className="mini-label">Duration minutes</label>
                <input
                  className="task-input"
                  type="number"
                  value={task.duration_minutes}
                  onChange={(e) =>
                    updateTask(index, "duration_minutes", e.target.value)
                  }
                />

                <label className="mini-label">Start</label>
                <input
                  className="task-input"
                  type="datetime-local"
                  value={formatDateTimeLocal(task.start)}
                  onChange={(e) =>
                    updateTask(index, "start", convertLocalToISO(e.target.value))
                  }
                />

                <label className="mini-label">End</label>
                <input
                  className="task-input"
                  type="datetime-local"
                  value={formatDateTimeLocal(task.end)}
                  onChange={(e) =>
                    updateTask(index, "end", convertLocalToISO(e.target.value))
                  }
                />

                <p className="time">
                  {formatTime(task.start)} - {formatTime(task.end)}
                </p>

                <button
                  className="commit-one-btn"
                  onClick={() => commitSingleTask(task, index)}
                  disabled={loading}
                >
                  Commit this task
                </button>
              </div>
            ))}
          </div>
        )}

        {unscheduled.length > 0 && (
          <div className="unscheduled">
            <h3>Unscheduled Tasks</h3>
            <p className="unscheduled-subtitle">
              Orbit could not fit these into today's free calendar blocks. You
              can manually adjust the time, shorten the task, or free up space
              in Google Calendar.
            </p>

            <div className="unscheduled-list">
              {unscheduled.map((task, index) => (
                <div className="unscheduled-item" key={`${task.title}-${index}`}>
                  <div>
                    <strong>{task.title}</strong>
                    <p>
                      {task.reason ||
                        "No available time block was large enough."}
                    </p>
                  </div>

                  {task.duration_minutes && (
                    <span>{task.duration_minutes} min</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="dashboard workspace-section">
        <div className="section-header">
          <h2>Workspace Follow-Ups</h2>
          <p>Review suggested replies before creating Gmail drafts.</p>
        </div>

        <button
          className="secondary-btn"
          onClick={fetchFollowUps}
          disabled={followUpsLoading}
        >
          {followUpsLoading ? "Checking Gmail..." : "Check Gmail Follow-Ups"}
        </button>

        {followUps.length === 0 ? (
          <div className="empty workspace-empty">No follow-ups loaded yet.</div>
        ) : (
          <div className="followup-grid">
            {followUps.map((item) => (
              <div className="followup-card" key={item.id}>
                <div className="task-top">
                  <span className="pill">score {item.score}</span>
                  <span className="pill muted">gmail</span>
                </div>

                <h3>{item.subject || "No subject"}</h3>
                <p className="from">From: {item.from}</p>
                <p className="snippet">{item.snippet}</p>

                <div className="keyword-row">
                  {item.matched_keywords.map((keyword) => (
                    <span className="keyword" key={keyword}>
                      {keyword}
                    </span>
                  ))}
                </div>

                {draftPreviews[item.id] ? (
                  <>
                    <label className="mini-label">Draft preview</label>
                    <textarea
                      className="draft-preview"
                      value={draftPreviews[item.id]}
                      onChange={(e) =>
                        updateDraftPreview(item.id, e.target.value)
                      }
                    />

                    <button
                      className="commit-one-btn"
                      onClick={() => approveDraft(item)}
                    >
                      Approve and create Gmail draft
                    </button>
                  </>
                ) : (
                  <button
                    className="commit-one-btn"
                    onClick={() => previewDraft(item)}
                  >
                    Write follow-up draft
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default App;