import { useState } from "react";

type AssistantPanelProps = {
  onGeneratePlan: () => void;
  onCheckFollowUps: () => void;
  onRefreshCalendar: () => void;
  loading: boolean;
  followUpsLoading: boolean;
  calendarLoading: boolean;
};

function AssistantPanel({
  onGeneratePlan,
  onCheckFollowUps,
  onRefreshCalendar,
  loading,
  followUpsLoading,
  calendarLoading,
}: AssistantPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="assistant-float">
      {open && (
        <div className="assistant-popover">
          <div className="assistant-popover-header">
            <div>
              <div className="assistant-mini-badge">Orbit Assistant</div>
              <h3>Need a quick action?</h3>
            </div>
            <button className="assistant-close" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>

          <p>
            I can generate your plan, check Gmail follow-ups, or refresh your
            calendar.
          </p>

          <div className="assistant-popover-actions">
            <button onClick={onGeneratePlan} disabled={loading}>
              {loading ? "Thinking..." : "Generate plan"}
            </button>

            <button
              className="secondary-btn"
              onClick={onCheckFollowUps}
              disabled={followUpsLoading}
            >
              {followUpsLoading ? "Checking..." : "Check follow-ups"}
            </button>

            <button
              className="secondary-btn"
              onClick={onRefreshCalendar}
              disabled={calendarLoading}
            >
              {calendarLoading ? "Refreshing..." : "Refresh calendar"}
            </button>
          </div>
        </div>
      )}

      <button className="assistant-bubble" onClick={() => setOpen(!open)}>
        ✦
      </button>
    </div>
  );
}

export default AssistantPanel;