import { useState, useEffect, useCallback } from "react"
import { Storage } from "../../storage/storage"
import { createId } from "../../util/id"
import { Bus } from "../../bus/bus"

/**
 * Message interface for chat messages
 */
export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
}

/**
 * Session interface for chat sessions
 */
export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

/**
 * Hook for managing chat sessions.
 * Creates a new session if no sessionId is provided.
 * Loads existing session and messages if sessionId is provided.
 */
export function useSession(existingSessionId?: string) {
  const [session, setSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  // Initialize or load session
  useEffect(() => {
    async function init() {
      if (existingSessionId) {
        // Load existing session
        const loaded = await Storage.read<Session>([
          "sessions",
          existingSessionId,
          "session",
        ])
        if (loaded) {
          setSession(loaded)
          // Load messages
          const msgIds = await Storage.list([
            "sessions",
            existingSessionId,
            "messages",
          ])
          const loadedMessages = await Promise.all(
            msgIds.map((id) =>
              Storage.read<Message>([
                "sessions",
                existingSessionId,
                "messages",
                id,
              ])
            )
          )
          // Filter out undefined and sort by timestamp
          const validMessages = loadedMessages
            .filter((msg): msg is Message => msg !== undefined)
            .sort((a, b) => a.timestamp - b.timestamp)
          setMessages(validMessages)
          return
        }
      }

      // Create new session
      const newSession: Session = {
        id: createId(),
        title: "New Chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await Storage.write(["sessions", newSession.id, "session"], newSession)
      setSession(newSession)
      Bus.publish("session.created", { sessionId: newSession.id })
    }

    init()
  }, [existingSessionId])

  /**
   * Add a message to the session.
   * Saves to storage and updates state.
   * Publishes session.message event.
   */
  const addMessage = useCallback(
    async (
      msg: Omit<Message, "id" | "timestamp">
    ): Promise<Message | null> => {
      if (!session) return null

      const message: Message = {
        ...msg,
        id: createId(),
        timestamp: Date.now(),
      }

      await Storage.write(
        ["sessions", session.id, "messages", message.id],
        message
      )

      setMessages((prev) => [...prev, message])
      Bus.publish("session.message", {
        sessionId: session.id,
        messageId: message.id,
      })

      return message
    },
    [session]
  )

  return {
    session,
    messages,
    addMessage,
  }
}
