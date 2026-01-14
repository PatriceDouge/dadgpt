import { Storage } from "../storage/storage"
import { createId } from "../util/id"
import { Bus } from "../bus/bus"

/**
 * Session data structure for chat sessions.
 */
export interface SessionData {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

/**
 * Message data structure for session messages.
 */
export interface MessageData {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
}

/**
 * Session namespace for managing chat sessions.
 * Provides CRUD operations for sessions and messages.
 */
export namespace Session {
  /**
   * Create a new session with a unique ULID.
   * @param title - Optional title for the session (defaults to "New Chat")
   * @returns The newly created session
   */
  export async function create(title?: string): Promise<SessionData> {
    const session: SessionData = {
      id: createId(),
      title: title ?? "New Chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await Storage.write(["sessions", session.id, "session"], session)
    Bus.publish("session.created", { sessionId: session.id })

    return session
  }

  /**
   * Retrieve a session by ID.
   * @param id - The session ID
   * @returns The session data or undefined if not found
   */
  export async function get(id: string): Promise<SessionData | undefined> {
    return Storage.read<SessionData>(["sessions", id, "session"])
  }

  /**
   * List all sessions.
   * @returns Array of all sessions, sorted by updatedAt descending (most recent first)
   */
  export async function list(): Promise<SessionData[]> {
    // Get all session directories
    const sessionIds = await Storage.list(["sessions"])

    // Load each session
    const sessions = await Promise.all(
      sessionIds.map((id) => get(id))
    )

    // Filter out undefined and sort by updatedAt descending
    return sessions
      .filter((s): s is SessionData => s !== undefined)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /**
   * Get all messages for a session.
   * @param sessionId - The session ID
   * @returns Array of messages sorted by timestamp
   */
  export async function getMessages(sessionId: string): Promise<MessageData[]> {
    const messageIds = await Storage.list(["sessions", sessionId, "messages"])

    const messages = await Promise.all(
      messageIds.map((id) =>
        Storage.read<MessageData>(["sessions", sessionId, "messages", id])
      )
    )

    // Filter out undefined and sort by timestamp
    return messages
      .filter((msg): msg is MessageData => msg !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * Add a message to a session.
   * @param sessionId - The session ID
   * @param message - The message content (without id and timestamp)
   * @returns The created message with id and timestamp
   */
  export async function addMessage(
    sessionId: string,
    message: Omit<MessageData, "id" | "timestamp">
  ): Promise<MessageData> {
    const newMessage: MessageData = {
      ...message,
      id: createId(),
      timestamp: Date.now(),
    }

    await Storage.write(
      ["sessions", sessionId, "messages", newMessage.id],
      newMessage
    )

    // Update session's updatedAt timestamp
    const session = await get(sessionId)
    if (session) {
      await Storage.write(["sessions", sessionId, "session"], {
        ...session,
        updatedAt: Date.now(),
      })
    }

    Bus.publish("session.message", {
      sessionId,
      messageId: newMessage.id,
    })

    return newMessage
  }

  /**
   * Update a session's title.
   * @param id - The session ID
   * @param title - The new title
   * @returns The updated session or undefined if not found
   */
  export async function updateTitle(
    id: string,
    title: string
  ): Promise<SessionData | undefined> {
    const session = await get(id)
    if (!session) return undefined

    const updated: SessionData = {
      ...session,
      title,
      updatedAt: Date.now(),
    }

    await Storage.write(["sessions", id, "session"], updated)
    return updated
  }

  /**
   * Delete a session and all its messages.
   * @param id - The session ID
   * @returns true if deleted, false if not found
   */
  export async function remove(id: string): Promise<boolean> {
    const session = await get(id)
    if (!session) return false

    // Delete all messages first
    const messageIds = await Storage.list(["sessions", id, "messages"])
    await Promise.all(
      messageIds.map((msgId) =>
        Storage.remove(["sessions", id, "messages", msgId])
      )
    )

    // Delete the session file
    await Storage.remove(["sessions", id, "session"])

    return true
  }
}
