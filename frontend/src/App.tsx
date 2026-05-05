import { useState } from "react";
import axios from "axios";
import "./styles.css";

const API_BASE = "http://localhost:8000";

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

function App() {
  const [taskText, setTaskText] = useState(
    "study ECE for 3 hours today, reply to emails for 30 minutes, go to the gym for 1 hour tonight"
  );
  const [scheduled, setScheduled] = useState<ScheduledTask[]>([]);
  const [unscheduled, setUnscheduled] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");

  const loginWithGoogle = () => {
    window.location.href = `${API_BASE}/auth/login`;
  };

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
    } catch (error) {
      console.error(error);
      alert("Failed to commit plan. Check your backend terminal.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

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
              Commit to Calendar
            </button>
          </div>

          {commitMessage && <div className="success">{commitMessage}</div>}
        </section>
      </main>

      <section className="dashboard">
        <div className="section-header">
          <h2>Generated Plan</h2>
          <p>Review first. Commit only when it looks right.</p>
        </div>

        {scheduled.length === 0 ? (
          <div className="empty">No plan generated yet.</div>
        ) : (
          <div className="task-grid">
            {scheduled.map((task, index) => (
              <div className="task-card" key={`${task.title}-${index}`}>
                <div className="task-top">
                  <span className="pill">{task.priority}</span>
                  {task.task_type && <span className="pill muted">{task.task_type}</span>}
                </div>
                <h3>{task.title}</h3>
                <p className="time">
                  {formatTime(task.start)} - {formatTime(task.end)}
                </p>
                <p className="reason">{task.reason}</p>
              </div>
            ))}
          </div>
        )}

        {unscheduled.length > 0 && (
          <div className="unscheduled">
            <h3>Unscheduled</h3>
            {unscheduled.map((task, index) => (
              <p key={index}>{task.title}</p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default App;