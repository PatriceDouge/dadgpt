/**
 * Session Integration Tests
 *
 * Tests the Session namespace for managing chat sessions.
 * Uses temporary directories for storage isolation.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import { Session, type SessionData, type MessageData } from "../../src/session/session"
import { Bus } from "../../src/bus/bus"

describe("Session Integration", () => {
  let testDir: string
  let originalEnv: string | undefined

  beforeEach(async () => {
    // Create unique temporary directory for each test
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    testDir = path.join(os.tmpdir(), `dadgpt-session-test-${uniqueId}`)

    // Save and override data directory
    originalEnv = process.env.DADGPT_DATA_DIR
    process.env.DADGPT_DATA_DIR = testDir

    await fs.mkdir(testDir, { recursive: true })

    // Clear bus handlers between tests
    Bus.clear()
  })

  afterEach(async () => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.DADGPT_DATA_DIR = originalEnv
    } else {
      delete process.env.DADGPT_DATA_DIR
    }

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe("Session.create", () => {
    test("creates a new session with default title", async () => {
      const session = await Session.create()

      expect(session).toBeDefined()
      expect(session.id).toBeTruthy()
      expect(session.title).toBe("New Chat")
      expect(session.createdAt).toBeGreaterThan(0)
      expect(session.updatedAt).toBeGreaterThan(0)
    })

    test("creates a new session with custom title", async () => {
      const session = await Session.create("My Custom Session")

      expect(session).toBeDefined()
      expect(session.title).toBe("My Custom Session")
    })

    test("publishes session.created event", async () => {
      const handler = vi.fn()
      Bus.subscribe("session.created", handler)

      const session = await Session.create()

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ sessionId: session.id })
    })

    test("persists session to storage", async () => {
      const session = await Session.create("Persistent Session")

      // Verify file was created
      const filePath = path.join(testDir, "sessions", session.id, "session.json")
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false)
      expect(fileExists).toBe(true)

      // Verify content
      const content = await fs.readFile(filePath, "utf-8")
      const parsed = JSON.parse(content) as SessionData
      expect(parsed.id).toBe(session.id)
      expect(parsed.title).toBe("Persistent Session")
    })
  })

  describe("Session.get", () => {
    test("retrieves an existing session", async () => {
      const created = await Session.create("Session to Retrieve")

      const retrieved = await Session.get(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.title).toBe("Session to Retrieve")
    })

    test("returns undefined for non-existent session", async () => {
      const result = await Session.get("non-existent-session-id")

      expect(result).toBeUndefined()
    })
  })

  describe("Session.list", () => {
    test("returns empty array when no sessions exist", async () => {
      const sessions = await Session.list()

      expect(sessions).toEqual([])
    })

    test("lists all created sessions", async () => {
      // Create multiple sessions
      const session1 = await Session.create("First Session")
      const session2 = await Session.create("Second Session")
      const session3 = await Session.create("Third Session")

      const sessions = await Session.list()

      expect(sessions).toHaveLength(3)
      const ids = sessions.map(s => s.id)
      expect(ids).toContain(session1.id)
      expect(ids).toContain(session2.id)
      expect(ids).toContain(session3.id)
    })

    test("sorts sessions by updatedAt descending (most recent first)", async () => {
      // Create sessions with small delays to ensure different timestamps
      const session1 = await Session.create("First")
      await new Promise(resolve => setTimeout(resolve, 10))
      const session2 = await Session.create("Second")
      await new Promise(resolve => setTimeout(resolve, 10))
      const session3 = await Session.create("Third")

      const sessions = await Session.list()

      // Most recently created should be first
      expect(sessions[0].id).toBe(session3.id)
      expect(sessions[1].id).toBe(session2.id)
      expect(sessions[2].id).toBe(session1.id)
    })
  })

  describe("Session.addMessage", () => {
    test("adds a user message to a session", async () => {
      const session = await Session.create()

      const message = await Session.addMessage(session.id, {
        role: "user",
        content: "Hello, DadGPT!",
      })

      expect(message).toBeDefined()
      expect(message.id).toBeTruthy()
      expect(message.role).toBe("user")
      expect(message.content).toBe("Hello, DadGPT!")
      expect(message.timestamp).toBeGreaterThan(0)
    })

    test("adds an assistant message to a session", async () => {
      const session = await Session.create()

      const message = await Session.addMessage(session.id, {
        role: "assistant",
        content: "Hello! How can I help you today?",
      })

      expect(message.role).toBe("assistant")
      expect(message.content).toBe("Hello! How can I help you today?")
    })

    test("publishes session.message event", async () => {
      const handler = vi.fn()
      Bus.subscribe("session.message", handler)

      const session = await Session.create()
      const message = await Session.addMessage(session.id, {
        role: "user",
        content: "Test message",
      })

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({
        sessionId: session.id,
        messageId: message.id,
      })
    })

    test("persists message to storage", async () => {
      const session = await Session.create()
      const message = await Session.addMessage(session.id, {
        role: "user",
        content: "Persistent message",
      })

      // Verify file was created
      const filePath = path.join(
        testDir,
        "sessions",
        session.id,
        "messages",
        `${message.id}.json`
      )
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false)
      expect(fileExists).toBe(true)

      // Verify content
      const content = await fs.readFile(filePath, "utf-8")
      const parsed = JSON.parse(content) as MessageData
      expect(parsed.content).toBe("Persistent message")
    })

    test("updates session's updatedAt timestamp", async () => {
      const session = await Session.create()
      const originalUpdatedAt = session.updatedAt

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10))

      await Session.addMessage(session.id, {
        role: "user",
        content: "Trigger timestamp update",
      })

      const updatedSession = await Session.get(session.id)
      expect(updatedSession?.updatedAt).toBeGreaterThan(originalUpdatedAt)
    })
  })

  describe("Session.getMessages", () => {
    test("returns empty array for session with no messages", async () => {
      const session = await Session.create()

      const messages = await Session.getMessages(session.id)

      expect(messages).toEqual([])
    })

    test("returns all messages for a session", async () => {
      const session = await Session.create()

      await Session.addMessage(session.id, { role: "user", content: "First message" })
      await Session.addMessage(session.id, { role: "assistant", content: "First response" })
      await Session.addMessage(session.id, { role: "user", content: "Second message" })

      const messages = await Session.getMessages(session.id)

      expect(messages).toHaveLength(3)
    })

    test("returns messages sorted by timestamp", async () => {
      const session = await Session.create()

      const msg1 = await Session.addMessage(session.id, { role: "user", content: "First" })
      await new Promise(resolve => setTimeout(resolve, 10))
      const msg2 = await Session.addMessage(session.id, { role: "assistant", content: "Second" })
      await new Promise(resolve => setTimeout(resolve, 10))
      const msg3 = await Session.addMessage(session.id, { role: "user", content: "Third" })

      const messages = await Session.getMessages(session.id)

      // Should be in chronological order
      expect(messages[0].id).toBe(msg1.id)
      expect(messages[1].id).toBe(msg2.id)
      expect(messages[2].id).toBe(msg3.id)
    })

    test("returns empty array for non-existent session", async () => {
      const messages = await Session.getMessages("non-existent-session")

      expect(messages).toEqual([])
    })
  })

  describe("Session.updateTitle", () => {
    test("updates session title", async () => {
      const session = await Session.create("Original Title")

      const updated = await Session.updateTitle(session.id, "Updated Title")

      expect(updated?.title).toBe("Updated Title")
    })

    test("returns undefined for non-existent session", async () => {
      const result = await Session.updateTitle("non-existent", "New Title")

      expect(result).toBeUndefined()
    })

    test("updates updatedAt timestamp", async () => {
      const session = await Session.create()
      const originalUpdatedAt = session.updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      const updated = await Session.updateTitle(session.id, "New Title")

      expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt)
    })
  })

  describe("Session.remove", () => {
    test("removes a session and its messages", async () => {
      const session = await Session.create()
      await Session.addMessage(session.id, { role: "user", content: "Message to delete" })
      await Session.addMessage(session.id, { role: "assistant", content: "Another message" })

      const result = await Session.remove(session.id)

      expect(result).toBe(true)

      // Verify session is gone
      const retrieved = await Session.get(session.id)
      expect(retrieved).toBeUndefined()

      // Verify messages are gone
      const messages = await Session.getMessages(session.id)
      expect(messages).toEqual([])
    })

    test("returns false for non-existent session", async () => {
      const result = await Session.remove("non-existent-session")

      expect(result).toBe(false)
    })
  })

  describe("Full conversation flow", () => {
    test("complete conversation workflow", async () => {
      // Create a session
      const session = await Session.create("Integration Test Session")
      expect(session.id).toBeTruthy()

      // Add user message
      const userMsg = await Session.addMessage(session.id, {
        role: "user",
        content: "What are my goals for today?",
      })
      expect(userMsg.role).toBe("user")

      // Add assistant response
      const assistantMsg = await Session.addMessage(session.id, {
        role: "assistant",
        content: "Here are your goals for today: 1. Exercise, 2. Review reports",
      })
      expect(assistantMsg.role).toBe("assistant")

      // Retrieve messages
      const messages = await Session.getMessages(session.id)
      expect(messages).toHaveLength(2)
      expect(messages[0].content).toBe("What are my goals for today?")
      expect(messages[1].content).toContain("Exercise")

      // List sessions
      const sessions = await Session.list()
      expect(sessions.some(s => s.id === session.id)).toBe(true)

      // Update title based on conversation
      await Session.updateTitle(session.id, "Daily Goals Check-in")

      // Verify updated title
      const updatedSession = await Session.get(session.id)
      expect(updatedSession?.title).toBe("Daily Goals Check-in")
    })
  })
})
