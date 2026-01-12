import { z } from "zod";
import { Storage } from "../../storage/storage.ts";

export const CalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional(),
  }),
  end: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional(),
  }),
  attendees: z.array(z.object({
    email: z.string(),
    displayName: z.string().optional(),
    responseStatus: z.string().optional(),
  })).optional(),
  status: z.string(),
  htmlLink: z.string().optional(),
});

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export interface CalendarAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export namespace CalendarClient {
  const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

  export async function isAuthenticated(): Promise<boolean> {
    const auth = await getAuth();
    return !!auth?.accessToken;
  }

  export async function getAuth(): Promise<CalendarAuth | undefined> {
    const stored = await Storage.readAuth<{ google?: CalendarAuth }>();
    return stored?.google;
  }

  export async function listEvents(options?: {
    calendarId?: string;
    maxResults?: number;
    timeMin?: string;
    timeMax?: string;
  }): Promise<CalendarEvent[]> {
    const auth = await getAuth();
    if (!auth) {
      throw new Error("Not authenticated with Google Calendar");
    }

    if (Date.now() > auth.expiresAt) {
      throw new Error("Google token expired. Please re-authenticate.");
    }

    const calendarId = options?.calendarId ?? "primary";
    const params = new URLSearchParams();

    params.set("maxResults", String(options?.maxResults ?? 50));
    params.set("singleEvents", "true");
    params.set("orderBy", "startTime");

    // Default to today onwards
    const timeMin = options?.timeMin ?? new Date().toISOString();
    params.set("timeMin", timeMin);

    if (options?.timeMax) {
      params.set("timeMax", options.timeMax);
    }

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Calendar API error: ${error}`);
    }

    const data = await response.json() as { items?: CalendarEvent[] };
    return data.items ?? [];
  }

  export async function createEvent(options: {
    calendarId?: string;
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    attendees?: Array<{ email: string }>;
  }): Promise<CalendarEvent> {
    const auth = await getAuth();
    if (!auth) {
      throw new Error("Not authenticated with Google Calendar");
    }

    const calendarId = options.calendarId ?? "primary";

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: options.summary,
          description: options.description,
          location: options.location,
          start: options.start,
          end: options.end,
          attendees: options.attendees,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create event: ${error}`);
    }

    return await response.json() as CalendarEvent;
  }

  export async function updateEvent(options: {
    calendarId?: string;
    eventId: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
  }): Promise<CalendarEvent> {
    const auth = await getAuth();
    if (!auth) {
      throw new Error("Not authenticated with Google Calendar");
    }

    const calendarId = options.calendarId ?? "primary";

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${options.eventId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: options.summary,
          description: options.description,
          location: options.location,
          start: options.start,
          end: options.end,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update event: ${error}`);
    }

    return await response.json() as CalendarEvent;
  }

  export async function deleteEvent(options: {
    calendarId?: string;
    eventId: string;
  }): Promise<void> {
    const auth = await getAuth();
    if (!auth) {
      throw new Error("Not authenticated with Google Calendar");
    }

    const calendarId = options.calendarId ?? "primary";

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${options.eventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete event: ${error}`);
    }
  }

  export async function getFreeBusy(options: {
    timeMin: string;
    timeMax: string;
    calendars?: string[];
  }): Promise<
    Record<string, Array<{ start: string; end: string }>>
  > {
    const auth = await getAuth();
    if (!auth) {
      throw new Error("Not authenticated with Google Calendar");
    }

    const calendars = options.calendars ?? ["primary"];

    const response = await fetch(
      `${CALENDAR_API_BASE}/freeBusy`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: options.timeMin,
          timeMax: options.timeMax,
          items: calendars.map((id) => ({ id })),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get free/busy: ${error}`);
    }

    const data = await response.json() as {
      calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
    };

    const result: Record<string, Array<{ start: string; end: string }>> = {};
    for (const [calId, calData] of Object.entries(data.calendars)) {
      result[calId] = calData.busy;
    }

    return result;
  }

  // Get today's events
  export async function getTodaysEvents(): Promise<CalendarEvent[]> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return listEvents({
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
    });
  }

  // Get this week's events
  export async function getThisWeeksEvents(): Promise<CalendarEvent[]> {
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    return listEvents({
      timeMin: now.toISOString(),
      timeMax: endOfWeek.toISOString(),
    });
  }

  // Cache synced events locally
  export async function syncEvents(): Promise<number> {
    const events = await getThisWeeksEvents();

    await Storage.write(["cache", "calendar"], {
      events,
      syncedAt: new Date().toISOString(),
    });

    return events.length;
  }

  export async function getCachedEvents(): Promise<CalendarEvent[]> {
    const cache = await Storage.read<{
      events: CalendarEvent[];
      syncedAt: string;
    }>(["cache", "calendar"]);
    return cache?.events ?? [];
  }
}
