import { useEffect, useState, type MouseEvent } from "react";
import axios from "axios";
import "./styles.css";
import AssistantPanel from "./components/AssistantPanel";

const API_BASE = "http://localhost:8000";
const CALENDAR_START_HOUR = 8;
const CALENDAR_END_HOUR = 22;
const HOUR_HEIGHT = 72;
const CALENDAR_TOP_PADDING = 28;

const LOADING_STEPS = [
  "Analyzing your calendar",
  "Finding free time",
  "Prioritizing tasks",
  "Optimizing your schedule",
];

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

type SchedulingConstraints = {
  earliest_hour?: number | null;
  latest_hour?: number | null;
  buffer_minutes?: number;
  preferred_window?: string | null;
  notes?: string[];
};

type PlanRules = {
  scheduling_constraints?: SchedulingConstraints;
};

type Preferences = {
  preferred_start_hour: number;
  preferred_end_hour: number;
  default_buffer_minutes: number;
  location_name: string;
  latitude: number;
  longitude: number;
};

type WeatherReport = {
  location_name: string;
  temperature: number;
  precipitation: number;
  wind_speed: number;
  description: string;
  advice: string[];
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

type ContextSearchResult = {
  query: string;
  summary: string;
  gmail_results: FollowUp[];
  note_results: {
    source: string;
    title: string;
    path: string;
    snippet: string;
    score: number;
  }[];
};

type SelectedCalendarItem =
  | { type: "generated"; index: number }
  | { type: "calendar"; event: CalendarEvent }
  | null;

type ScheduleConflict = {
  taskIndex: number;
  taskTitle: string;
  conflictsWith: string;
  type: "calendar" | "generated" | "invalid";
};

function App() {
  const [taskText, setTaskText] = useState(
    "study ECE for an hour, reply to emails for 30 minutes"
  );
  const [scheduled, setScheduled] = useState<ScheduledTask[]>([]);
  const [unscheduled, setUnscheduled] = useState<any[]>([]);
  const [planRules, setPlanRules] = useState<PlanRules | null>(null);
  const [preferences, setPreferences] = useState<Preferences>({
    preferred_start_hour: 9,
    preferred_end_hour: 22,
    default_buffer_minutes: 10,
    location_name: "Toronto",
    latitude: 43.6532,
    longitude: -79.3832,
  });
  const [weather, setWeather] = useState<WeatherReport | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [contextQuery, setContextQuery] = useState("");
  const [contextResult, setContextResult] = useState<ContextSearchResult | null>(null);
  const [draftPreviews, setDraftPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [selectedCalendarItem, setSelectedCalendarItem] =
    useState<SelectedCalendarItem>(null);
  const [selectedStartValue, setSelectedStartValue] = useState("");
  const [selectedEndValue, setSelectedEndValue] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let interval: number | undefined;

    if (loading) {
      interval = window.setInterval(() => {
        setLoadingStep((current) => (current + 1) % LOADING_STEPS.length);
      }, 1200);
    } else {
      setLoadingStep(0);
    }

    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [loading]);

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

  const fetchPreferences = async () => {
    try {
      const res = await axios.get(`${API_BASE}/preferences`);
      setPreferences(res.data);
      return res.data as Preferences;
    } catch (error) {
      console.error(error);
      return preferences;
    }
  };

  const fetchWeather = async (savedPreferences = preferences) => {
    try {
      const res = await axios.get(`${API_BASE}/weather/current`, {
        params: {
          latitude: savedPreferences.latitude,
          longitude: savedPreferences.longitude,
        },
      });
      setWeather(res.data);
    } catch (error) {
      console.error(error);
      setWeather(null);
    }
  };

  useEffect(() => {
    const loadContext = async () => {
      const savedPreferences = await fetchPreferences();
      await fetchWeather(savedPreferences);
    };

    loadContext();
  }, []);

  const savePreferences = async () => {
    setPreferencesSaving(true);

    try {
      const res = await axios.put(`${API_BASE}/preferences`, preferences);
      setPreferences(res.data);
      await fetchWeather(res.data);
      setCommitMessage("Scheduling preferences saved.");
    } catch (error) {
      console.error(error);
      alert("Failed to save preferences. Check your backend terminal.");
    } finally {
      setPreferencesSaving(false);
    }
  };

  const searchWorkspaceContext = async (query = contextQuery) => {
    if (!query.trim()) {
      alert("Enter a meeting, topic, person, or project to search.");
      return;
    }

    setContextLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/gmail/context-search`, {
        query,
        max_results: 8,
      });
      setContextQuery(query);
      setContextResult(res.data);
    } catch (error) {
      console.error(error);
      alert("Failed to search workspace context. Check your backend terminal.");
    } finally {
      setContextLoading(false);
    }
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
      setPlanRules(res.data.rules_applied || null);
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

    if (scheduleConflicts.length > 0) {
      alert("Fix schedule conflicts before committing the full plan.");
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
      setPlanRules(null);
      await fetchCalendarEvents();
    } catch (error: any) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      alert(detail?.message || "Failed to commit plan. Check your backend terminal.");
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

    const nextTask = {
      ...updated[index],
      [field]: field === "duration_minutes" ? Number(value) : value,
    };

    if (field === "duration_minutes") {
      const start = new Date(nextTask.start);
      nextTask.end = new Date(
        start.getTime() + Number(value) * 60 * 1000
      ).toISOString();
    }

    updated[index] = nextTask;
    setScheduled(updated);
  };

  const commitSingleTask = async (task: ScheduledTask, index: number) => {
    const taskConflicts = getTaskConflicts(task, index);
    if (taskConflicts.length > 0) {
      alert("Fix this task's conflicts before committing it.");
      return;
    }

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
    } catch (error: any) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      alert(detail?.message || "Failed to commit task. Check your backend terminal.");
    } finally {
      setLoading(false);
    }
  };

  const removeScheduledTask = (index: number) => {
    setScheduled((current) => current.filter((_, taskIndex) => taskIndex !== index));
  };

  const moveScheduledTask = (index: number, minutes: number) => {
    setScheduled((current) =>
      current.map((task, taskIndex) => {
        if (taskIndex !== index) return task;

        const start = new Date(task.start);
        const end = new Date(task.end);

        return {
          ...task,
          start: new Date(start.getTime() + minutes * 60 * 1000).toISOString(),
          end: new Date(end.getTime() + minutes * 60 * 1000).toISOString(),
        };
      })
    );
  };

  const placeScheduledTask = (index: number, start: Date) => {
    setScheduled((current) =>
      current.map((task, taskIndex) => {
        if (taskIndex !== index) return task;

        const durationMs =
          new Date(task.end).getTime() - new Date(task.start).getTime();

        return {
          ...task,
          start: start.toISOString(),
          end: new Date(start.getTime() + durationMs).toISOString(),
        };
      })
    );
  };

  const updateCalendarEventTimes = async (
    event: CalendarEvent,
    start: string,
    end: string
  ) => {
    setCalendarLoading(true);

    try {
      await axios.patch(`${API_BASE}/calendar/events/${event.id}`, {
        start,
        end,
      });
      setCommitMessage(`Moved "${event.title}" in Google Calendar.`);
      await fetchCalendarEvents();
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.detail || "Failed to move calendar event.");
    } finally {
      setCalendarLoading(false);
    }
  };

  const moveCalendarEvent = async (event: CalendarEvent, start: Date) => {
    const durationMs =
      new Date(getEventEnd(event)).getTime() - new Date(getEventStart(event)).getTime();

    if (durationMs <= 0) {
      alert("This event cannot be moved because its time range is invalid.");
      return;
    }

    await updateCalendarEventTimes(
      event,
      start.toISOString(),
      new Date(start.getTime() + durationMs).toISOString()
    );
  };

  const deleteCalendarEvent = async (event: CalendarEvent) => {
    if (!window.confirm(`Delete "${event.title}" from Google Calendar?`)) return;

    setCalendarLoading(true);
    setCommitMessage("");

    try {
      await axios.delete(`${API_BASE}/calendar/events/${event.id}`);
      setCommitMessage(`Deleted "${event.title}" from Google Calendar.`);
      await fetchCalendarEvents();
    } catch (error) {
      console.error(error);
      alert("Failed to delete calendar event. Check your backend terminal.");
    } finally {
      setCalendarLoading(false);
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

  const selectCalendarItem = (item: Exclude<SelectedCalendarItem, null>) => {
    setSelectedCalendarItem(item);

    if (item.type === "calendar") {
      setSelectedStartValue(formatDateTimeLocal(getEventStart(item.event)));
      setSelectedEndValue(formatDateTimeLocal(getEventEnd(item.event)));
      return;
    }

    const task = scheduled[item.index];
    setSelectedStartValue(formatDateTimeLocal(task.start));
    setSelectedEndValue(formatDateTimeLocal(task.end));
  };

  const clearSelectedCalendarItem = () => {
    setSelectedCalendarItem(null);
    setSelectedStartValue("");
    setSelectedEndValue("");
  };

  const applySelectedManualTimes = async () => {
    if (!selectedCalendarItem || !selectedStartValue || !selectedEndValue) return;

    const start = convertLocalToISO(selectedStartValue);
    const end = convertLocalToISO(selectedEndValue);

    if (new Date(end) <= new Date(start)) {
      alert("End time must be after start time.");
      return;
    }

    if (selectedCalendarItem.type === "generated") {
      setScheduled((current) =>
        current.map((task, index) =>
          index === selectedCalendarItem.index ? { ...task, start, end } : task
        )
      );
    }

    if (selectedCalendarItem.type === "calendar") {
      await updateCalendarEventTimes(selectedCalendarItem.event, start, end);
    }

    clearSelectedCalendarItem();
  };

  const getEventTitleText = (event: CalendarEvent | ScheduledTask) => {
    return "title" in event ? event.title : "";
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
      CALENDAR_TOP_PADDING +
      ((startMinutes - calendarStartMinutes) / 60) * HOUR_HEIGHT;
    const height = Math.max(28, ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT);
    const durationMinutes = Math.max(1, endMinutes - startMinutes);

    return {
      top: `${Math.max(0, top)}px`,
      height: `${height}px`,
      zIndex: 10000 - durationMinutes,
    };
  };

  const getScheduledTaskStyle = (task: ScheduledTask) => {
    const start = new Date(task.start);
    const end = new Date(task.end);

    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const calendarStartMinutes = CALENDAR_START_HOUR * 60;

    const top =
      CALENDAR_TOP_PADDING +
      ((startMinutes - calendarStartMinutes) / 60) * HOUR_HEIGHT;
    const height = Math.max(28, ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT);
    const durationMinutes = Math.max(1, endMinutes - startMinutes);

    return {
      top: `${Math.max(0, top)}px`,
      height: `${height}px`,
      zIndex: 12000 - durationMinutes,
    };
  };

  const overlaps = (startA: string, endA: string, startB: string, endB: string) => {
    return new Date(startA) < new Date(endB) && new Date(endA) > new Date(startB);
  };

  const getTaskConflicts = (task: ScheduledTask, taskIndex: number) => {
    const conflicts: ScheduleConflict[] = [];

    if (new Date(task.end) <= new Date(task.start)) {
      conflicts.push({
        taskIndex,
        taskTitle: task.title,
        conflictsWith: "its own start/end time",
        type: "invalid",
      });
    }

    calendarEvents.forEach((event) => {
      if (overlaps(task.start, task.end, getEventStart(event), getEventEnd(event))) {
        conflicts.push({
          taskIndex,
          taskTitle: task.title,
          conflictsWith: event.title,
          type: "calendar",
        });
      }
    });

    scheduled.forEach((otherTask, otherIndex) => {
      if (otherIndex === taskIndex) return;

      if (overlaps(task.start, task.end, otherTask.start, otherTask.end)) {
        conflicts.push({
          taskIndex,
          taskTitle: task.title,
          conflictsWith: otherTask.title,
          type: "generated",
        });
      }
    });

    return conflicts;
  };

  const scheduleConflicts = scheduled.flatMap((task, index) =>
    getTaskConflicts(task, index)
  );

  const getSmartAdjustment = (conflict: ScheduleConflict) => {
    const task = scheduled[conflict.taskIndex];
    const bufferMinutes = planRules?.scheduling_constraints?.buffer_minutes || 10;
    const durationMs = new Date(task.end).getTime() - new Date(task.start).getTime();

    const busyItems = [
      ...calendarEvents.map((event) => ({
        start: getEventStart(event),
        end: getEventEnd(event),
      })),
      ...scheduled
        .filter((_, index) => index !== conflict.taskIndex)
        .map((item) => ({ start: item.start, end: item.end })),
    ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const overlapping = busyItems.find((item) =>
      overlaps(task.start, task.end, item.start, item.end)
    );

    if (!overlapping) return "Try moving it by 15 minutes.";

    const suggestedStart = new Date(
      new Date(overlapping.end).getTime() + bufferMinutes * 60 * 1000
    );
    const suggestedEnd = new Date(suggestedStart.getTime() + durationMs);

    return `Try ${formatTime(suggestedStart.toISOString())} - ${formatTime(
      suggestedEnd.toISOString()
    )}.`;
  };

  const getBriefingSuggestions = () => {
    const titles = [
      ...calendarEvents.map(getEventTitleText),
      ...scheduled.map((task) => task.title),
    ].join(" ").toLowerCase();

    const suggestions = [];

    if (titles.includes("walk") || titles.includes("run")) {
      if (weather) {
        suggestions.push(
          `For outdoor time in ${weather.location_name}, it is ${Math.round(
            weather.temperature
          )}C and ${weather.description}. ${weather.advice[0]}`
        );
      } else {
        suggestions.push("For outdoor time, check the weather and grab comfortable layers.");
      }
    }

    if (titles.includes("cook") || titles.includes("meal") || titles.includes("dinner")) {
      suggestions.push("For cooking, check groceries and thaw anything frozen early.");
    }

    if (titles.includes("meeting") || titles.includes("presentation") || titles.includes("call")) {
      suggestions.push("For meetings, review related follow-ups before the next event.");
    }

    if (scheduled.length >= 4 || calendarEvents.length >= 5) {
      suggestions.push("Your day looks dense; leave buffer between heavier blocks.");
    }

    if (followUps.length > 0) {
      suggestions.push(`You have ${followUps.length} Gmail follow-up${followUps.length === 1 ? "" : "s"} to review.`);
    }

    if (weather && (titles.includes("walk") || titles.includes("run") || titles.includes("outdoor"))) {
      weather.advice.slice(1, 3).forEach((tip) => suggestions.push(tip));
    }

    return suggestions.slice(0, 4);
  };

  const getRelatedFollowUps = (event: CalendarEvent) => {
    const keywords = event.title
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3);

    return followUps.filter((item) => {
      const text = `${item.subject} ${item.snippet}`.toLowerCase();
      return keywords.some((keyword) => text.includes(keyword));
    });
  };

  const getPrepSuggestions = (event: CalendarEvent, relatedFollowUps: FollowUp[]) => {
    const title = event.title.toLowerCase();
    const suggestions = [];

    if (title.includes("cardio") || title.includes("core") || title.includes("workout")) {
      suggestions.push("Warm up for 5-10 minutes, then pick 3-4 moves like planks, dead bugs, mountain climbers, bicycle crunches, or leg raises.");
      suggestions.push("Eat protein today and bring water so the workout does not feel weirdly punishing.");
    }

    if (title.includes("grocer") || title.includes("walmart") || title.includes("shop")) {
      suggestions.push("Check staples before you leave: protein, vegetables, fruit, breakfast items, snacks, and anything you need for dinner.");
      suggestions.push("Open your notes or fridge quickly so you do not buy duplicates or forget the one oddly specific thing you needed.");
    }

    if (title.includes("cook") || title.includes("meal") || title.includes("dinner") || title.includes("lunch")) {
      suggestions.push("Check whether anything frozen needs to thaw, then confirm you have protein, produce, and a carb or side ready.");
      suggestions.push("If this is a busy day, prep the chopping or marinade early so cooking later is easy.");
    }

    if (title.includes("walk") || title.includes("run")) {
      if (weather) {
        suggestions.push(
          `Weather in ${weather.location_name}: ${Math.round(weather.temperature)}C, ${weather.description}, wind ${Math.round(weather.wind_speed)} km/h.`
        );
        weather.advice.slice(0, 2).forEach((tip) => suggestions.push(tip));
      } else {
        suggestions.push("Check the weather before heading out, pick comfortable shoes, and bring water if it is warm.");
      }
      suggestions.push("If it is cold or rainy, choose layers and a route that is easy to shorten.");
    }

    if (
      title.includes("meeting") ||
      title.includes("presentation") ||
      title.includes("call") ||
      title.includes("sync") ||
      title.includes("review")
    ) {
      suggestions.push("Skim the agenda/title, write down your top question, and identify the decision or update you need from this event.");
      suggestions.push(
        relatedFollowUps.length > 0
          ? "Review the matched Gmail follow-ups below so you can bring the latest context."
          : "Check recent Gmail threads for this topic if you need more context before joining."
      );
    }

    if (suggestions.length === 0) {
      suggestions.push("Look at the title and location, then decide what you need ready before this starts.");
      suggestions.push("Leave a small buffer beforehand so you are not switching contexts at the last second.");
    }

    return suggestions.slice(0, 3);
  };

  const getCalendarClickStartTime = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = Math.max(0, event.clientY - rect.top - CALENDAR_TOP_PADDING);
    const rawMinutes = CALENDAR_START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
    const roundedMinutes = Math.round(rawMinutes / 15) * 15;

    const baseDate =
      selectedCalendarItem?.type === "calendar"
        ? new Date(getEventStart(selectedCalendarItem.event))
        : selectedCalendarItem?.type === "generated"
        ? new Date(scheduled[selectedCalendarItem.index].start)
        : new Date();

    baseDate.setHours(Math.floor(roundedMinutes / 60));
    baseDate.setMinutes(roundedMinutes % 60, 0, 0);
    return baseDate;
  };

  const handleCalendarClick = async (event: MouseEvent<HTMLDivElement>) => {
    if (!selectedCalendarItem) return;

    const start = getCalendarClickStartTime(event);

    if (selectedCalendarItem.type === "generated") {
      placeScheduledTask(selectedCalendarItem.index, start);
    }

    if (selectedCalendarItem.type === "calendar") {
      await moveCalendarEvent(selectedCalendarItem.event, start);
    }

    setSelectedCalendarItem(null);
  };

  const getSelectedItemTitle = () => {
    if (!selectedCalendarItem) return "";
    if (selectedCalendarItem.type === "calendar") {
      return selectedCalendarItem.event.title;
    }
    return scheduled[selectedCalendarItem.index]?.title || "Generated task";
  };

  const sortedCalendarEvents = [...calendarEvents].sort(
    (a, b) =>
      new Date(getEventStart(a)).getTime() -
      new Date(getEventStart(b)).getTime()
  );
  const now = new Date();
  const upcomingEvents = sortedCalendarEvents.filter(
    (event) => new Date(getEventEnd(event)) >= now
  );
  const happeningNowEvent = sortedCalendarEvents.find(
    (event) =>
      new Date(getEventStart(event)) <= now && new Date(getEventEnd(event)) > now
  );
  const nextUpcomingEvent = sortedCalendarEvents.find(
    (event) =>
      new Date(getEventStart(event)) > now &&
      event.id !== happeningNowEvent?.id
  );
  const briefingSuggestions = getBriefingSuggestions();
  const meetingPrepEvents = upcomingEvents.filter((event) => {
    const title = event.title.toLowerCase();
    return (
      title.includes("meeting") ||
      title.includes("presentation") ||
      title.includes("call") ||
      title.includes("sync") ||
      title.includes("review")
    );
  });
  const prepEvents = meetingPrepEvents.length > 0
    ? meetingPrepEvents.slice(0, 3)
    : upcomingEvents.slice(0, 3);

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
              {loading ? "Orbit is thinking..." : "Generate Plan"}
            </button>
            <button
              className="secondary-btn"
              onClick={commitPlan}
              disabled={loading || scheduled.length === 0 || scheduleConflicts.length > 0}
            >
              Commit Full Plan
            </button>
            <button
              className="settings-btn"
              onClick={() => setSettingsOpen((current) => !current)}
              title="Scheduling settings"
            >
              ⚙
            </button>
          </div>

          {loading && (
            <div className="thinking-card">
              <div className="thinking-orb" />
              <div>
                <strong>{LOADING_STEPS[loadingStep]}</strong>
                <span>Orbit is preparing the best plan for your day.</span>
              </div>
              <div className="thinking-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          {commitMessage && <div className="success">{commitMessage}</div>}

          {settingsOpen && (
          <div className="preferences-panel appear-in">
            <div>
              <strong>Scheduling Preferences</strong>
              <span>Used as defaults when generating plans.</span>
            </div>

            <div className="preferences-grid compact-preferences-grid">
              <label>
                Start hour
                <input
                  className="task-input"
                  type="number"
                  min="0"
                  max="23"
                  value={preferences.preferred_start_hour}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      preferred_start_hour: Number(event.target.value),
                    }))
                  }
                />
              </label>

              <label>
                End hour
                <input
                  className="task-input"
                  type="number"
                  min="1"
                  max="24"
                  value={preferences.preferred_end_hour}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      preferred_end_hour: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>

            <button
              className="secondary-btn preferences-save"
              onClick={savePreferences}
              disabled={preferencesSaving}
            >
              {preferencesSaving ? "Saving..." : "Save Preferences"}
            </button>
          </div>
          )}
        </section>
      </main>

      <section className="dashboard intelligence-grid">
        <div className="briefing-card">
          <div className="section-header compact-header">
            <div>
              <h2>Daily Briefing</h2>
              <p>Your day, follow-ups, and prep reminders in one pass.</p>
            </div>
          </div>

          <div className="briefing-stats">
            <div>
              <strong>{calendarEvents.length}</strong>
              <span>calendar events</span>
            </div>
            <div>
              <strong>{scheduled.length}</strong>
              <span>generated tasks</span>
            </div>
            <div>
              <strong>{followUps.length}</strong>
              <span>Gmail follow-ups</span>
            </div>
          </div>

          {weather && (
            <div className="weather-strip">
              <strong>{weather.location_name}</strong>
              <span>
                {Math.round(weather.temperature)}C, {weather.description}, wind{" "}
                {Math.round(weather.wind_speed)} km/h
              </span>
            </div>
          )}

          {happeningNowEvent && (
            <div className="briefing-next">
              <span className="mini-label">Happening now</span>
              <p>
                <strong>{happeningNowEvent.title}</strong> until{" "}
                {formatTime(getEventEnd(happeningNowEvent))}
              </p>
            </div>
          )}

          <div className="briefing-next">
            <span className="mini-label">Next up</span>
            {nextUpcomingEvent ? (
              <p>
                <strong>{nextUpcomingEvent.title}</strong> at{" "}
                {formatTime(getEventStart(nextUpcomingEvent))}
              </p>
            ) : (
              <p>
                {happeningNowEvent
                  ? "Nothing else is scheduled after this loaded event."
                  : "No upcoming calendar events loaded for today."}
              </p>
            )}
          </div>

          <div className="briefing-list">
            {briefingSuggestions.length === 0 ? (
              <p>Generate a plan or load Gmail follow-ups for prep suggestions.</p>
            ) : (
              briefingSuggestions.map((suggestion) => (
                <div className="briefing-item" key={suggestion}>
                  {suggestion}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="meeting-prep-card">
          <div className="section-header compact-header">
            <div>
              <h2>Meeting Prep</h2>
              <p>Upcoming events matched with Gmail follow-up context.</p>
            </div>
          </div>

          {prepEvents.length === 0 ? (
            <div className="empty mini-empty">
              Refresh Calendar to load upcoming prep targets.
            </div>
          ) : (
            <div className="prep-list">
              {prepEvents.map((event) => {
                const relatedFollowUps = getRelatedFollowUps(event);
                const prepSuggestions = getPrepSuggestions(event, relatedFollowUps);

                return (
                  <div className="prep-item" key={event.id}>
                    <div>
                      <strong>{event.title}</strong>
                      <span>{formatTime(getEventStart(event))}</span>
                    </div>
                    <ul className="prep-suggestions">
                      {prepSuggestions.map((suggestion) => (
                        <li key={suggestion}>{suggestion}</li>
                      ))}
                    </ul>
                    {relatedFollowUps.slice(0, 2).map((item) => (
                      <small key={item.id}>{item.subject || item.snippet}</small>
                    ))}
                    <button
                      className="secondary-btn prep-search-btn"
                      onClick={() => searchWorkspaceContext(event.title)}
                      disabled={contextLoading}
                    >
                      {contextLoading ? "Searching..." : "Search Gmail context"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="context-search">
            <label className="mini-label">Search workspace context</label>
            <div className="context-search-row">
              <input
                className="task-input"
                placeholder="Meeting, person, class, project..."
                value={contextQuery}
                onChange={(event) => setContextQuery(event.target.value)}
              />
              <button
                className="secondary-btn"
                onClick={() => searchWorkspaceContext()}
                disabled={contextLoading}
              >
                {contextLoading ? "Searching..." : "Search"}
              </button>
            </div>

            {contextResult && (
              <div className="context-result">
                <strong>Prep summary</strong>
                <p>{contextResult.summary}</p>

                {contextResult.gmail_results.length > 0 && (
                  <>
                    <span className="mini-label">Gmail matches</span>
                    {contextResult.gmail_results.slice(0, 3).map((item) => (
                      <small key={item.id}>
                        {item.subject || "No subject"} - {item.snippet}
                      </small>
                    ))}
                  </>
                )}

                {contextResult.note_results.length > 0 && (
                  <>
                    <span className="mini-label">Local note matches</span>
                    {contextResult.note_results.slice(0, 3).map((item) => (
                      <small key={item.path}>
                        {item.title} - {item.snippet}
                      </small>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

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

        <p className="calendar-instructions">
          Click an event or generated task, then click a time to move it. You
          can also edit the selected start and end time manually.
        </p>

        {selectedCalendarItem && (
          <div className="calendar-move-hint">
            <div>
              <span>
                Moving <strong>{getSelectedItemTitle()}</strong>
              </span>
              <div className="calendar-manual-edit">
                <label>
                  Start
                  <input
                    className="task-input"
                    type="datetime-local"
                    value={selectedStartValue}
                    onChange={(event) => setSelectedStartValue(event.target.value)}
                  />
                </label>
                <label>
                  End
                  <input
                    className="task-input"
                    type="datetime-local"
                    value={selectedEndValue}
                    onChange={(event) => setSelectedEndValue(event.target.value)}
                  />
                </label>
              </div>
            </div>
            <button
              className="secondary-btn mini-action-btn"
              onClick={applySelectedManualTimes}
            >
              Apply
            </button>
            <button
              className="secondary-btn mini-action-btn"
              onClick={clearSelectedCalendarItem}
            >
              Cancel
            </button>
          </div>
        )}

        <div
          className={`calendar-gcal-view ${
            selectedCalendarItem ? "move-target-active" : ""
          }`}
          onClick={handleCalendarClick}
          style={{
            height: `${
              (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT +
              CALENDAR_TOP_PADDING
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
                  style={{ top: `${CALENDAR_TOP_PADDING + i * HOUR_HEIGHT}px` }}
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
                )} ${
                  selectedCalendarItem?.type === "calendar" &&
                  selectedCalendarItem.event.id === event.id
                    ? "selected-calendar-item"
                    : ""
                }`}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  selectCalendarItem({ type: "calendar", event });
                }}
                style={getCalendarEventStyle(event)}
                key={event.id}
                title="Click to select, then click a time to move"
              >
                <div className="calendar-event-actions">
                  <button
                    className="calendar-icon-btn"
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      deleteCalendarEvent(event);
                    }}
                    disabled={calendarLoading}
                    title="Delete calendar event"
                  >
                    x
                  </button>
                </div>
                <div className="calendar-gcal-event-title">{event.title}</div>
                <div className="calendar-gcal-event-time">
                  {formatTime(getEventStart(event))} -{" "}
                  {formatTime(getEventEnd(event))}
                </div>
              </div>
            ))}

            {scheduled.map((task, index) => (
              <div
                className={`calendar-gcal-event generated-preview ${getCalendarEventType(
                  task.title
                )} ${
                  selectedCalendarItem?.type === "generated" &&
                  selectedCalendarItem.index === index
                    ? "selected-calendar-item"
                    : ""
                }`}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  selectCalendarItem({ type: "generated", index });
                }}
                style={getScheduledTaskStyle(task)}
                key={`${task.title}-${task.start}-${index}`}
                title="Click to select, then click a time to move"
              >
                <div className="calendar-gcal-event-title">{task.title}</div>
                <div className="calendar-gcal-event-time">
                  {formatTime(task.start)} - {formatTime(task.end)}
                </div>
                <span className="preview-badge">Generated</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard">
        <div className="section-header">
          <h2>Generated Plan</h2>
          <p>
            {scheduled.length === 0
              ? "Generate a plan to see editable tasks here."
              : "Edit, drag, remove, or commit tasks after resolving conflicts."}
          </p>
        </div>

        {planRules?.scheduling_constraints?.notes &&
          planRules.scheduling_constraints.notes.length > 0 && (
            <div className="constraints-card appear-in">
              <strong>Scheduling constraints applied</strong>
              <div>
                {planRules.scheduling_constraints.notes.map((note) => (
                  <span className="keyword" key={note}>
                    {note}
                  </span>
                ))}
              </div>
            </div>
          )}

        {scheduleConflicts.length > 0 && (
          <div className="conflict-card appear-in">
            <h3>Conflicts to fix before committing</h3>
            {scheduleConflicts.map((conflict, index) => (
              <div className="conflict-item" key={`${conflict.taskTitle}-${index}`}>
                <span>
                  <strong>{conflict.taskTitle}</strong> overlaps with{" "}
                  {conflict.conflictsWith}.
                </span>
                <em>{getSmartAdjustment(conflict)}</em>
              </div>
            ))}
          </div>
        )}

        {scheduled.length === 0 ? (
          <div className="empty empty-polished">
            <div className="empty-icon">✦</div>
            <h3>No plan generated yet.</h3>
            <p>
              Add a task dump above and Orbit will turn it into editable
              calendar-ready blocks.
            </p>
          </div>
        ) : (
          <div className="task-grid">
            {scheduled.map((task, index) => (
              <div className="task-card appear-in" key={`${task.title}-${index}`}>
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

                <div className="task-adjust-row">
                  <button
                    className="secondary-btn mini-action-btn"
                    onClick={() => moveScheduledTask(index, -15)}
                    disabled={loading}
                  >
                    -15m
                  </button>
                  <button
                    className="secondary-btn mini-action-btn"
                    onClick={() => moveScheduledTask(index, 15)}
                    disabled={loading}
                  >
                    +15m
                  </button>
                  <button
                    className="secondary-btn mini-action-btn danger-lite"
                    onClick={() => removeScheduledTask(index)}
                    disabled={loading}
                  >
                    Remove
                  </button>
                </div>

                <button
                  className="commit-one-btn"
                  onClick={() => commitSingleTask(task, index)}
                  disabled={loading || getTaskConflicts(task, index).length > 0}
                >
                  Commit this task
                </button>
              </div>
            ))}
          </div>
        )}

        {unscheduled.length > 0 && (
          <div className="unscheduled appear-in">
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
          <p>
            {followUps.length === 0
              ? "Check Gmail to surface threads that may need attention."
              : "Review suggested replies before creating Gmail drafts."}
          </p>
        </div>

        <button
          className="secondary-btn"
          onClick={fetchFollowUps}
          disabled={followUpsLoading}
        >
          {followUpsLoading
            ? "Orbit is checking Gmail..."
            : "Check Gmail Follow-Ups"}
        </button>

        {followUpsLoading && (
          <div className="thinking-card compact-thinking">
            <div className="thinking-orb" />
            <div>
              <strong>Scanning Gmail</strong>
              <span>Orbit is looking for unanswered threads.</span>
            </div>
            <div className="thinking-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {followUps.length === 0 ? (
          <div className="empty workspace-empty empty-polished">
            <div className="empty-icon">✉</div>
            <h3>No follow-ups detected.</h3>
            <p>
              Refresh to scan recent Gmail again.
            </p>
          </div>
        ) : (
          <div className="followup-grid">
            {followUps.map((item) => (
              <div className="followup-card appear-in" key={item.id}>
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

      <AssistantPanel
        onGeneratePlan={generatePlan}
        onCheckFollowUps={fetchFollowUps}
        onRefreshCalendar={async () => {
          await fetchCalendarEvents();
          setCommitMessage("Calendar refreshed.");
        }}
        loading={loading}
        followUpsLoading={followUpsLoading}
        calendarLoading={calendarLoading}
      />
    </div>
  );
}

export default App;
