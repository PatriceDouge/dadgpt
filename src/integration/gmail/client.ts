import { z } from "zod";
import { Storage } from "../../storage/storage.ts";

export const EmailSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  from: z.string(),
  to: z.array(z.string()),
  subject: z.string(),
  snippet: z.string(),
  body: z.string().optional(),
  date: z.string(),
  isRead: z.boolean(),
  labels: z.array(z.string()),
});

export type Email = z.infer<typeof EmailSchema>;

export interface GmailAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export namespace GmailClient {
  const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

  export async function isAuthenticated(): Promise<boolean> {
    const auth = await getAuth();
    return !!auth?.accessToken;
  }

  export async function getAuth(): Promise<GmailAuth | undefined> {
    const stored = await Storage.readAuth<{ google?: GmailAuth }>();
    return stored?.google;
  }

  export async function saveAuth(auth: GmailAuth): Promise<void> {
    const existing = await Storage.readAuth<Record<string, unknown>>();
    await Storage.writeAuth({
      ...existing,
      google: auth,
    });
  }

  export async function listMessages(options?: {
    maxResults?: number;
    query?: string;
  }): Promise<Email[]> {
    const auth = await getAuth();
    if (!auth) {
      throw new Error("Not authenticated with Gmail");
    }

    // Check if token is expired
    if (Date.now() > auth.expiresAt) {
      throw new Error("Gmail token expired. Please re-authenticate.");
    }

    const params = new URLSearchParams();
    params.set("maxResults", String(options?.maxResults ?? 20));
    if (options?.query) {
      params.set("q", options.query);
    }

    const response = await fetch(
      `${GMAIL_API_BASE}/users/me/messages?${params}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gmail API error: ${error}`);
    }

    const data = await response.json() as {
      messages?: Array<{ id: string; threadId: string }>;
    };

    if (!data.messages) {
      return [];
    }

    // Fetch full message details
    const emails: Email[] = [];
    for (const msg of data.messages.slice(0, 10)) {
      try {
        const email = await getMessage(msg.id, auth.accessToken);
        if (email) {
          emails.push(email);
        }
      } catch {
        // Skip failed messages
      }
    }

    return emails;
  }

  async function getMessage(
    id: string,
    accessToken: string
  ): Promise<Email | null> {
    const response = await fetch(
      `${GMAIL_API_BASE}/users/me/messages/${id}?format=full`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      id: string;
      threadId: string;
      snippet: string;
      internalDate: string;
      labelIds: string[];
      payload: {
        headers: Array<{ name: string; value: string }>;
        body?: { data?: string };
        parts?: Array<{ mimeType: string; body?: { data?: string } }>;
      };
    };

    const headers = data.payload.headers;
    const getHeader = (name: string): string => {
      return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
    };

    // Decode body
    let body = "";
    if (data.payload.body?.data) {
      body = Buffer.from(data.payload.body.data, "base64").toString("utf-8");
    } else if (data.payload.parts) {
      const textPart = data.payload.parts.find(
        (p) => p.mimeType === "text/plain"
      );
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      }
    }

    return {
      id: data.id,
      threadId: data.threadId,
      from: getHeader("From"),
      to: getHeader("To").split(",").map((s) => s.trim()),
      subject: getHeader("Subject"),
      snippet: data.snippet,
      body,
      date: new Date(parseInt(data.internalDate)).toISOString(),
      isRead: !data.labelIds.includes("UNREAD"),
      labels: data.labelIds,
    };
  }

  export async function sendMessage(options: {
    to: string;
    subject: string;
    body: string;
    replyTo?: string;
  }): Promise<{ id: string }> {
    const auth = await getAuth();
    if (!auth) {
      throw new Error("Not authenticated with Gmail");
    }

    // Construct email in RFC 2822 format
    const email = [
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      options.replyTo ? `In-Reply-To: ${options.replyTo}` : "",
      "Content-Type: text/plain; charset=utf-8",
      "",
      options.body,
    ]
      .filter(Boolean)
      .join("\r\n");

    const encodedEmail = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await fetch(
      `${GMAIL_API_BASE}/users/me/messages/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encodedEmail }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    const data = await response.json() as { id: string };
    return { id: data.id };
  }

  export async function createDraft(options: {
    to: string;
    subject: string;
    body: string;
    replyTo?: string;
  }): Promise<{ id: string; message: { id: string } }> {
    const auth = await getAuth();
    if (!auth) {
      throw new Error("Not authenticated with Gmail");
    }

    const email = [
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      options.replyTo ? `In-Reply-To: ${options.replyTo}` : "",
      "Content-Type: text/plain; charset=utf-8",
      "",
      options.body,
    ]
      .filter(Boolean)
      .join("\r\n");

    const encodedEmail = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await fetch(
      `${GMAIL_API_BASE}/users/me/drafts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: { raw: encodedEmail },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create draft: ${error}`);
    }

    return await response.json() as { id: string; message: { id: string } };
  }

  // Cache synced emails locally
  export async function syncEmails(maxResults: number = 50): Promise<number> {
    const emails = await listMessages({ maxResults });

    // Store in local cache
    await Storage.write(["cache", "emails"], {
      emails,
      syncedAt: new Date().toISOString(),
    });

    return emails.length;
  }

  export async function getCachedEmails(): Promise<Email[]> {
    const cache = await Storage.read<{ emails: Email[]; syncedAt: string }>([
      "cache",
      "emails",
    ]);
    return cache?.emails ?? [];
  }
}
