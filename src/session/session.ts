import { z } from "zod";
import { Storage } from "../storage/storage.ts";
import { generateId } from "../util/id.ts";

export const SessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  directory: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Session = z.infer<typeof SessionSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  toolCalls: z.array(z.object({
    id: z.string(),
    name: z.string(),
    args: z.unknown(),
  })).optional(),
  toolResults: z.array(z.object({
    toolCallId: z.string(),
    result: z.string(),
  })).optional(),
  model: z.object({
    provider: z.string(),
    model: z.string(),
  }).optional(),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
  }).optional(),
  createdAt: z.string(),
});

export type Message = z.infer<typeof MessageSchema>;

export namespace SessionManager {
  export async function create(options?: {
    title?: string;
    directory?: string;
  }): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: generateId(),
      title: options?.title ?? "New Session",
      directory: options?.directory ?? process.cwd(),
      createdAt: now,
      updatedAt: now,
    };

    await Storage.write(["sessions", session.id, "session"], session);

    return session;
  }

  export async function get(id: string): Promise<Session | undefined> {
    return Storage.read<Session>(["sessions", id, "session"]);
  }

  export async function update(
    id: string,
    updates: Partial<Session>
  ): Promise<Session | undefined> {
    const session = await get(id);
    if (!session) return undefined;

    const updated: Session = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await Storage.write(["sessions", id, "session"], updated);
    return updated;
  }

  export async function list(): Promise<Session[]> {
    const sessionIds = await Storage.list(["sessions"]);
    const sessions: Session[] = [];

    for (const id of sessionIds) {
      const session = await get(id);
      if (session) {
        sessions.push(session);
      }
    }

    // Sort by most recent first
    return sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  export async function getLatest(): Promise<Session | undefined> {
    const sessions = await list();
    return sessions[0];
  }

  export async function remove(id: string): Promise<boolean> {
    // Remove all messages first
    const messageIds = await Storage.list(["sessions", id, "messages"]);
    for (const msgId of messageIds) {
      await Storage.remove(["sessions", id, "messages", msgId]);
    }

    // Remove session
    return Storage.remove(["sessions", id, "session"]);
  }

  // Message management
  export async function addMessage(
    sessionId: string,
    message: Omit<Message, "id" | "sessionId" | "createdAt">
  ): Promise<Message> {
    const fullMessage: Message = {
      id: generateId(),
      sessionId,
      ...message,
      createdAt: new Date().toISOString(),
    };

    await Storage.write(
      ["sessions", sessionId, "messages", fullMessage.id],
      fullMessage
    );

    // Update session timestamp
    await update(sessionId, {});

    return fullMessage;
  }

  export async function getMessages(sessionId: string): Promise<Message[]> {
    const messageIds = await Storage.list(["sessions", sessionId, "messages"]);
    const messages: Message[] = [];

    for (const id of messageIds) {
      const message = await Storage.read<Message>([
        "sessions",
        sessionId,
        "messages",
        id,
      ]);
      if (message) {
        messages.push(message);
      }
    }

    // Sort by creation time
    return messages.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  export async function getMessageHistory(
    sessionId: string
  ): Promise<Array<{ role: "user" | "assistant" | "system"; content: string }>> {
    const messages = await getMessages(sessionId);
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  export async function updateSessionTitle(
    sessionId: string,
    firstMessage: string
  ): Promise<void> {
    // Generate a title from the first message
    const title =
      firstMessage.length > 50
        ? firstMessage.substring(0, 47) + "..."
        : firstMessage;

    await update(sessionId, { title });
  }
}
