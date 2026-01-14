import { Storage } from "../storage/storage"
import { createId } from "../util/id"
import { Bus } from "../bus/bus"
import { Log } from "../util/log"
import { StorageError } from "../util/errors"

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
   * @throws StorageError if session cannot be created
   */
  export async function create(title?: string): Promise<SessionData> {
    const session: SessionData = {
      id: createId(),
      title: title ?? "New Chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    try {
      await Storage.write(["sessions", session.id, "session"], session)
      Bus.publish("session.created", { sessionId: session.id })
      return session
    } catch (err) {
      Log.formatAndLogError("Failed to create session", err)
      throw new StorageError(
        `Failed to create session: ${err instanceof Error ? err.message : String(err)}`,
        "SESSION_CREATE_ERROR"
      )
    }
  }

  /**
   * Retrieve a session by ID.
   * @param id - The session ID
   * @returns The session data or undefined if not found
   */
  export async function get(id: string): Promise<SessionData | undefined> {
    try {
      return await Storage.read<SessionData>(["sessions", id, "session"])
    } catch (err) {
      Log.debug("Failed to get session", id, err)
      return undefined
    }
  }

  /**
   * List all sessions.
   * @returns Array of all sessions, sorted by updatedAt descending (most recent first)
   */
  export async function list(): Promise<SessionData[]> {
    try {
      // Get all session directories (sessions are stored in subdirectories)
      const sessionIds = await Storage.listDirs(["sessions"])

      // Load each session
      const sessions = await Promise.all(
        sessionIds.map((id) => get(id))
      )

      // Filter out undefined and sort by updatedAt descending
      return sessions
        .filter((s): s is SessionData => s !== undefined)
        .sort((a, b) => b.updatedAt - a.updatedAt)
    } catch (err) {
      Log.formatAndLogError("Failed to list sessions", err)
      return []
    }
  }

  /**
   * Get all messages for a session.
   * @param sessionId - The session ID
   * @returns Array of messages sorted by timestamp
   */
  export async function getMessages(sessionId: string): Promise<MessageData[]> {
    try {
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
    } catch (err) {
      Log.formatAndLogError("Failed to get messages for session", err)
      return []
    }
  }

  /**
   * Add a message to a session.
   * @param sessionId - The session ID
   * @param message - The message content (without id and timestamp)
   * @returns The created message with id and timestamp
   * @throws StorageError if message cannot be saved
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

    try {
      await Storage.write(
        ["sessions", sessionId, "messages", newMessage.id],
        newMessage
      )

      // Update session's updatedAt timestamp (non-critical, log error but continue)
      try {
        const session = await get(sessionId)
        if (session) {
          await Storage.write(["sessions", sessionId, "session"], {
            ...session,
            updatedAt: Date.now(),
          })
        }
      } catch (updateErr) {
        Log.debug("Failed to update session timestamp", updateErr)
      }

      Bus.publish("session.message", {
        sessionId,
        messageId: newMessage.id,
      })

      return newMessage
    } catch (err) {
      Log.formatAndLogError("Failed to add message", err)
      throw new StorageError(
        `Failed to save message: ${err instanceof Error ? err.message : String(err)}`,
        "MESSAGE_SAVE_ERROR"
      )
    }
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
    try {
      const session = await get(id)
      if (!session) return undefined

      const updated: SessionData = {
        ...session,
        title,
        updatedAt: Date.now(),
      }

      await Storage.write(["sessions", id, "session"], updated)
      return updated
    } catch (err) {
      Log.formatAndLogError("Failed to update session title", err)
      return undefined
    }
  }

  /**
   * Delete a session and all its messages.
   * @param id - The session ID
   * @returns true if deleted, false if not found or error occurred
   */
  export async function remove(id: string): Promise<boolean> {
    try {
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
    } catch (err) {
      Log.formatAndLogError("Failed to remove session", err)
      return false
    }
  }
}
