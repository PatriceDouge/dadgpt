import { z } from "zod";
import { defineTool } from "./types.ts";
import { CalendarClient } from "../integration/calendar/client.ts";

export const calendarTool = defineTool({
  name: "calendar",
  description: `Interact with Google Calendar. Actions:
- today: Show today's events
- week: Show this week's events
- list: List upcoming events
- create: Create a new event
- free: Find free time slots
Note: Requires Google authentication via 'dadgpt auth --google'`,

  parameters: z.object({
    action: z.enum(["today", "week", "list", "create", "free"]),
    maxResults: z.number().optional().describe("Maximum number of events"),
    summary: z.string().optional().describe("Event title for create"),
    description: z.string().optional().describe("Event description"),
    location: z.string().optional().describe("Event location"),
    startTime: z.string().optional().describe("Start time (ISO format or natural)"),
    endTime: z.string().optional().describe("End time (ISO format or natural)"),
    duration: z.number().optional().describe("Duration in minutes (alternative to endTime)"),
    attendees: z.array(z.string()).optional().describe("List of attendee emails"),
  }),

  async execute(args, _ctx) {
    // Check authentication
    if (!(await CalendarClient.isAuthenticated())) {
      return {
        title: "Calendar Not Configured",
        output: "Google Calendar is not set up. Run 'dadgpt auth --google' to authenticate.",
        error: true,
      };
    }

    try {
      switch (args.action) {
        case "today":
          return await showTodaysEvents();
        case "week":
          return await showWeeksEvents();
        case "list":
          return await listEvents(args.maxResults);
        case "create":
          return await createEvent(args);
        case "free":
          return await findFreeTime();
        default:
          return {
            title: "Error",
            output: `Unknown action: ${args.action}`,
            error: true,
          };
      }
    } catch (err) {
      return {
        title: "Calendar Error",
        output: `Error: ${(err as Error).message}`,
        error: true,
      };
    }
  },
});

async function showTodaysEvents() {
  const events = await CalendarClient.getTodaysEvents();

  if (events.length === 0) {
    return {
      title: "Today's Calendar",
      output: "No events scheduled for today.",
    };
  }

  const output = events
    .map((e) => formatEvent(e))
    .join("\n\n");

  return {
    title: `Today's Events (${events.length})`,
    output,
    metadata: { events },
  };
}

async function showWeeksEvents() {
  const events = await CalendarClient.getThisWeeksEvents();

  if (events.length === 0) {
    return {
      title: "This Week",
      output: "No events scheduled for this week.",
    };
  }

  // Group by day
  const byDay: Record<string, typeof events> = {};

  for (const event of events) {
    const startDate = event.start.dateTime ?? event.start.date ?? "";
    const day = new Date(startDate).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(event);
  }

  const output = Object.entries(byDay)
    .map(([day, dayEvents]) => {
      const eventList = dayEvents
        .map((e) => formatEventShort(e))
        .join("\n");
      return `${day}:\n${eventList}`;
    })
    .join("\n\n");

  return {
    title: `This Week (${events.length} events)`,
    output,
    metadata: { events },
  };
}

async function listEvents(maxResults?: number) {
  const events = await CalendarClient.listEvents({
    maxResults: maxResults ?? 10,
  });

  if (events.length === 0) {
    return {
      title: "Upcoming Events",
      output: "No upcoming events.",
    };
  }

  const output = events
    .map((e) => formatEvent(e))
    .join("\n\n");

  return {
    title: `Upcoming Events (${events.length})`,
    output,
    metadata: { events },
  };
}

async function createEvent(args: {
  summary?: string;
  description?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  attendees?: string[];
}) {
  if (!args.summary) {
    return {
      title: "Error",
      output: "Event title (summary) is required",
      error: true,
    };
  }

  if (!args.startTime) {
    return {
      title: "Error",
      output: "Start time is required",
      error: true,
    };
  }

  // Parse start time
  const startDate = new Date(args.startTime);
  if (isNaN(startDate.getTime())) {
    return {
      title: "Error",
      output: `Invalid start time: ${args.startTime}`,
      error: true,
    };
  }

  // Calculate end time
  let endDate: Date;
  if (args.endTime) {
    endDate = new Date(args.endTime);
  } else if (args.duration) {
    endDate = new Date(startDate.getTime() + args.duration * 60 * 1000);
  } else {
    // Default to 1 hour
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  }

  const event = await CalendarClient.createEvent({
    summary: args.summary,
    description: args.description,
    location: args.location,
    start: { dateTime: startDate.toISOString() },
    end: { dateTime: endDate.toISOString() },
    attendees: args.attendees?.map((email) => ({ email })),
  });

  const formattedStart = startDate.toLocaleString();
  const formattedEnd = endDate.toLocaleString();

  return {
    title: "Event Created",
    output: `Created: "${event.summary}"\nWhen: ${formattedStart} - ${formattedEnd}` +
      (event.location ? `\nWhere: ${event.location}` : ""),
    metadata: { event },
  };
}

async function findFreeTime() {
  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const busy = await CalendarClient.getFreeBusy({
    timeMin: now.toISOString(),
    timeMax: endOfWeek.toISOString(),
  });

  const primaryBusy = busy["primary"] ?? [];

  if (primaryBusy.length === 0) {
    return {
      title: "Free Time",
      output: "Your calendar is clear for the next week!",
    };
  }

  // Find free slots
  const freeSlots: Array<{ start: Date; end: Date }> = [];
  let current = now;

  for (const busySlot of primaryBusy) {
    const busyStart = new Date(busySlot.start);
    if (current < busyStart) {
      // There's free time before this busy slot
      const gapHours = (busyStart.getTime() - current.getTime()) / (1000 * 60 * 60);
      if (gapHours >= 0.5) {
        // Only show gaps of 30+ minutes
        freeSlots.push({ start: current, end: busyStart });
      }
    }
    current = new Date(busySlot.end);
  }

  // Add remaining time until end of week
  if (current < endOfWeek) {
    freeSlots.push({ start: current, end: endOfWeek });
  }

  const output = freeSlots
    .slice(0, 10)
    .map((slot) => {
      const start = slot.start.toLocaleString("en-US", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      });
      const end = slot.end.toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      const duration = Math.round((slot.end.getTime() - slot.start.getTime()) / (1000 * 60 * 60) * 10) / 10;
      return `  ${start} - ${end} (${duration}h free)`;
    })
    .join("\n");

  return {
    title: "Free Time Slots",
    output: `Available times this week:\n${output}`,
    metadata: { freeSlots: freeSlots.slice(0, 10) },
  };
}

function formatEvent(event: {
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
}): string {
  const startStr = event.start.dateTime ?? event.start.date ?? "";
  const endStr = event.end.dateTime ?? event.end.date ?? "";

  const start = new Date(startStr);
  const end = new Date(endStr);

  const isAllDay = !event.start.dateTime;

  let timeStr: string;
  if (isAllDay) {
    timeStr = "All day";
  } else {
    const startTime = start.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const endTime = end.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    timeStr = `${startTime} - ${endTime}`;
  }

  let result = `${event.summary}\n  ${timeStr}`;
  if (event.location) {
    result += `\n  📍 ${event.location}`;
  }

  return result;
}

function formatEventShort(event: {
  summary: string;
  start: { dateTime?: string; date?: string };
}): string {
  const startStr = event.start.dateTime ?? event.start.date ?? "";
  const start = new Date(startStr);

  const isAllDay = !event.start.dateTime;

  if (isAllDay) {
    return `  • ${event.summary} (all day)`;
  }

  const time = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `  • ${time} - ${event.summary}`;
}
