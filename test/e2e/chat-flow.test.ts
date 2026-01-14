/**
 * E2E Chat Flow Tests
 *
 * Tests the complete chat flow including:
 * - Sending messages and receiving responses (mocked LLM)
 * - Tool execution during chat
 * - Session persistence
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import { Session, type SessionData, type MessageData } from "../../src/session/session"
import { ChatLoop, type ChatLoopResult } from "../../src/session/loop"
import { Bus } from "../../src/bus/bus"
import { ToolRegistry } from "../../src/tool/registry"
import { GoalTool } from "../../src/tool/goal"
import { TodoTool } from "../../src/tool/todo"
import { Config } from "../../src/config/config"

// Mock the Provider module to avoid real API calls
vi.mock("../../src/provider/provider", () => ({
  Provider: {
    getModel: vi.fn(),
  },
}))

// Mock the streamText function from 'ai' to control LLM responses
vi.mock("ai", () => ({
  streamText: vi.fn(),
}))

import { Provider } from "../../src/provider/provider"
import { streamText } from "ai"

describe("E2E Chat Flow", () => {
  let testDir: string
  let homeDir: string
  let originalDataDir: string | undefined
  let originalHomeDir: string | undefined

  beforeEach(async () => {
    // Create unique temporary directories for each test
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    testDir = path.join(os.tmpdir(), `dadgpt-e2e-test-${uniqueId}`)
    homeDir = path.join(os.tmpdir(), `dadgpt-e2e-home-${uniqueId}`)

    // Save and override environment
    originalDataDir = process.env.DADGPT_DATA_DIR
    originalHomeDir = process.env.DADGPT_HOME
    process.env.DADGPT_DATA_DIR = testDir
    process.env.DADGPT_HOME = homeDir

    await fs.mkdir(testDir, { recursive: true })
    await fs.mkdir(homeDir, { recursive: true })

    // Clear all caches and registrations
    Bus.clear()
    ToolRegistry.clear()
    Config.invalidate()

    // Register the tools we need for testing
    ToolRegistry.register(GoalTool)
    ToolRegistry.register(TodoTool)

    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(async () => {
    // Restore original environment
    if (originalDataDir !== undefined) {
      process.env.DADGPT_DATA_DIR = originalDataDir
    } else {
      delete process.env.DADGPT_DATA_DIR
    }
    if (originalHomeDir !== undefined) {
      process.env.DADGPT_HOME = originalHomeDir
    } else {
      delete process.env.DADGPT_HOME
    }

    // Clean up test directories
    try {
      await fs.rm(testDir, { recursive: true, force: true })
      await fs.rm(homeDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  /**
   * Helper to create a mock LLM response without tool calls
   */
  function createMockTextResponse(content: string) {
    return {
      textStream: (async function* () {
        yield content
      })(),
      response: Promise.resolve({
        messages: [
          {
            role: "assistant",
            content: content,
          },
        ],
      }),
      usage: Promise.resolve({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      }),
    }
  }

  /**
   * Helper to create a mock LLM response with tool calls
   */
  function createMockToolCallResponse(
    toolName: string,
    toolArgs: Record<string, unknown>,
    toolCallId: string
  ) {
    return {
      textStream: (async function* () {
        // No text output for tool call responses
      })(),
      response: Promise.resolve({
        messages: [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId,
                toolName,
                args: toolArgs,
              },
            ],
          },
        ],
      }),
      usage: Promise.resolve({
        promptTokens: 20,
        completionTokens: 10,
        totalTokens: 30,
      }),
    }
  }

  describe("send message and receive response (mocked LLM)", () => {
    test("receives a simple text response from the LLM", async () => {
      // Setup: Create a session and add a user message
      const session = await Session.create("Test Chat Session")
      await Session.addMessage(session.id, {
        role: "user",
        content: "Hello, DadGPT!",
      })

      // Mock the LLM to return a simple response
      const mockModel = {} as ReturnType<typeof Provider.getModel>
      vi.mocked(Provider.getModel).mockResolvedValue(mockModel as never)
      vi.mocked(streamText).mockReturnValue(
        createMockTextResponse("Hello! How can I help you today?") as never
      )

      // Execute the chat loop
      const result = await ChatLoop.run(session.id)

      // Verify the result
      expect(result.content).toBe("Hello! How can I help you today?")
      expect(result.aborted).toBe(false)
      expect(result.toolCalls).toHaveLength(0)
      expect(result.usage).toBeDefined()
      expect(result.usage?.totalTokens).toBe(15)

      // Verify streamText was called
      expect(streamText).toHaveBeenCalledOnce()
    })

    test("streams text chunks to callback", async () => {
      // Setup: Create a session
      const session = await Session.create()
      await Session.addMessage(session.id, {
        role: "user",
        content: "Tell me a story",
      })

      // Mock LLM with chunked response
      const mockModel = {}
      vi.mocked(Provider.getModel).mockResolvedValue(mockModel as never)

      // Create a mock that yields multiple chunks
      const chunks = ["Once ", "upon ", "a time..."]
      vi.mocked(streamText).mockReturnValue({
        textStream: (async function* () {
          for (const chunk of chunks) {
            yield chunk
          }
        })(),
        response: Promise.resolve({
          messages: [{ role: "assistant", content: "Once upon a time..." }],
        }),
        usage: Promise.resolve({ promptTokens: 5, completionTokens: 5, totalTokens: 10 }),
      } as never)

      // Track chunks received
      const receivedChunks: string[] = []
      const result = await ChatLoop.run(session.id, undefined, {
        onTextChunk: (chunk) => receivedChunks.push(chunk),
      })

      // Verify chunks were streamed
      expect(receivedChunks).toEqual(chunks)
      expect(result.content).toBe("Once upon a time...")
    })

    test("handles abort signal during chat", async () => {
      // Setup: Create a session
      const session = await Session.create()
      await Session.addMessage(session.id, {
        role: "user",
        content: "Start a long task",
      })

      // Create abort controller
      const abortController = new AbortController()

      // Mock LLM - abort before it responds
      const mockModel = {}
      vi.mocked(Provider.getModel).mockResolvedValue(mockModel as never)

      // Abort immediately
      abortController.abort()

      // Execute with aborted signal
      const result = await ChatLoop.run(session.id, abortController.signal)

      // Verify it was aborted
      expect(result.aborted).toBe(true)
      expect(result.content).toBe("")
    })

    test("saves assistant response to session", async () => {
      // Setup: Create a session
      const session = await Session.create()
      await Session.addMessage(session.id, {
        role: "user",
        content: "Save this response",
      })

      // Mock LLM response
      const mockModel = {}
      vi.mocked(Provider.getModel).mockResolvedValue(mockModel as never)
      vi.mocked(streamText).mockReturnValue(
        createMockTextResponse("This response will be saved.") as never
      )

      // Execute chat loop
      await ChatLoop.run(session.id)

      // Verify response was saved to session
      const messages = await Session.getMessages(session.id)
      expect(messages).toHaveLength(2) // user + assistant
      expect(messages[1].role).toBe("assistant")
      expect(messages[1].content).toBe("This response will be saved.")
    })
  })

  describe("tool execution during chat", () => {
    test("executes tool calls and continues conversation", async () => {
      // Setup: Create a session
      const session = await Session.create()
      await Session.addMessage(session.id, {
        role: "user",
        content: "Create a new goal for me",
      })

      const mockModel = {}
      vi.mocked(Provider.getModel).mockResolvedValue(mockModel as never)

      // First call: LLM decides to use the goal tool
      // Second call: LLM provides final response after tool execution
      let callCount = 0
      vi.mocked(streamText).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First call: tool call
          return createMockToolCallResponse(
            "goal",
            { action: "create", title: "Learn TypeScript", category: "Work" },
            "tool-call-1"
          ) as never
        } else {
          // Second call: text response after tool execution
          return createMockTextResponse(
            'I created a new goal "Learn TypeScript" for you in the Work category.'
          ) as never
        }
      })

      // Track tool events
      const toolStartEvents: Array<{ toolId: string; args: unknown }> = []
      const toolCompleteEvents: Array<{ toolId: string; result: string }> = []

      const result = await ChatLoop.run(session.id, undefined, {
        onToolStart: (toolId, input) => toolStartEvents.push({ toolId, args: input }),
        onToolComplete: (toolId, output) => toolCompleteEvents.push({ toolId, result: output }),
      })

      // Verify tool was executed
      expect(toolStartEvents).toHaveLength(1)
      expect(toolStartEvents[0].toolId).toBe("goal")
      expect(toolCompleteEvents).toHaveLength(1)
      expect(toolCompleteEvents[0].toolId).toBe("goal")

      // Verify the result includes the tool call
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls[0].toolId).toBe("goal")
      expect(result.content).toContain("Learn TypeScript")

      // Verify the goal was actually created
      const goals = await fs.readdir(path.join(testDir, "goals"))
      expect(goals.length).toBeGreaterThan(0)
    })

    test("handles tool execution errors gracefully", async () => {
      // Setup: Create a session
      const session = await Session.create()
      await Session.addMessage(session.id, {
        role: "user",
        content: "Get a goal that doesn't exist",
      })

      const mockModel = {}
      vi.mocked(Provider.getModel).mockResolvedValue(mockModel as never)

      // First call: tool call with non-existent ID
      // Second call: text response
      let callCount = 0
      vi.mocked(streamText).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return createMockToolCallResponse(
            "goal",
            { action: "get", id: "nonexistent-goal-id" },
            "tool-call-err"
          ) as never
        } else {
          return createMockTextResponse(
            "I couldn't find that goal. Would you like to create a new one?"
          ) as never
        }
      })

      // Track error events
      const toolErrorEvents: Array<{ toolId: string; error: string }> = []

      const result = await ChatLoop.run(session.id, undefined, {
        onToolError: (toolId, error) => toolErrorEvents.push({ toolId, error }),
      })

      // The tool call should be recorded but without an error event
      // (since the tool returns an error message, it doesn't throw)
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls[0].output).toContain("Error")
      expect(result.content).toContain("couldn't find")
    })

    test("publishes bus events for tool lifecycle", async () => {
      // Setup: Create a session
      const session = await Session.create()
      await Session.addMessage(session.id, {
        role: "user",
        content: "List my todos",
      })

      const mockModel = {}
      vi.mocked(Provider.getModel).mockResolvedValue(mockModel as never)

      // Track bus events
      const startHandler = vi.fn()
      const completeHandler = vi.fn()
      Bus.subscribe("tool.start", startHandler)
      Bus.subscribe("tool.complete", completeHandler)

      let callCount = 0
      vi.mocked(streamText).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return createMockToolCallResponse(
            "todo",
            { action: "list" },
            "tool-call-2"
          ) as never
        } else {
          return createMockTextResponse("You have no todos.") as never
        }
      })

      await ChatLoop.run(session.id)

      // Verify bus events were published
      expect(startHandler).toHaveBeenCalledOnce()
      expect(startHandler).toHaveBeenCalledWith(
        expect.objectContaining({ toolId: "todo" })
      )
      expect(completeHandler).toHaveBeenCalledOnce()
      expect(completeHandler).toHaveBeenCalledWith(
        expect.objectContaining({ toolId: "todo" })
      )
    })

    test("respects maxIterations limit", async () => {
      // Setup: Create a session
      const session = await Session.create()
      await Session.addMessage(session.id, {
        role: "user",
        content: "Create multiple goals",
      })

      const mockModel = {}
      vi.mocked(Provider.getModel).mockResolvedValue(mockModel as never)

      // Always return tool calls to trigger max iterations
      vi.mocked(streamText).mockImplementation(() => {
        return createMockToolCallResponse(
          "goal",
          { action: "create", title: `Goal ${Date.now()}`, category: "Test" },
          `tool-call-${Date.now()}`
        ) as never
      })

      // Run with low maxIterations
      const result = await ChatLoop.run(session.id, undefined, {
        maxIterations: 3,
      })

      // Verify it stopped after max iterations (3 tool calls)
      expect(result.toolCalls).toHaveLength(3)
      // Note: content may be empty if the last response was a tool call
      expect(result.aborted).toBe(false)
    })
  })

  describe("session persistence", () => {
    test("persists conversation across chat loop runs", async () => {
      // Create session and add initial user message
      const session = await Session.create("Persistence Test")
      await Session.addMessage(session.id, {
        role: "user",
        content: "First message",
      })

      const mockModel = {}
      vi.mocked(Provider.getModel).mockResolvedValue(mockModel as never)
      vi.mocked(streamText).mockReturnValue(
        createMockTextResponse("First response") as never
      )

      // Run first chat loop
      await ChatLoop.run(session.id)

      // Verify first round of messages
      let messages = await Session.getMessages(session.id)
      expect(messages).toHaveLength(2)
      expect(messages[0].content).toBe("First message")
      expect(messages[1].content).toBe("First response")

      // Add second user message
      await Session.addMessage(session.id, {
        role: "user",
        content: "Second message",
      })

      vi.mocked(streamText).mockReturnValue(
        createMockTextResponse("Second response") as never
      )

      // Run second chat loop
      await ChatLoop.run(session.id)

      // Verify all messages are persisted
      messages = await Session.getMessages(session.id)
      expect(messages).toHaveLength(4)
      expect(messages.map(m => m.content)).toEqual([
        "First message",
        "First response",
        "Second message",
        "Second response",
      ])
    })

    test("loads existing session and continues conversation", async () => {
      // Create a session manually with messages
      const session = await Session.create("Load Test")
      await Session.addMessage(session.id, {
        role: "user",
        content: "I asked something earlier",
      })
      await Session.addMessage(session.id, {
        role: "assistant",
        content: "I answered you earlier",
      })
      await Session.addMessage(session.id, {
        role: "user",
        content: "Now I have a follow-up question",
      })

      const mockModel = {}
      vi.mocked(Provider.getModel).mockResolvedValue(mockModel as never)
      vi.mocked(streamText).mockReturnValue(
        createMockTextResponse("Here is the answer to your follow-up.") as never
      )

      // Run chat loop on existing session
      const result = await ChatLoop.run(session.id)

      expect(result.content).toBe("Here is the answer to your follow-up.")

      // Verify streamText was called with all previous messages
      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "user", content: "I asked something earlier" }),
            expect.objectContaining({ role: "assistant", content: "I answered you earlier" }),
            expect.objectContaining({ role: "user", content: "Now I have a follow-up question" }),
          ]),
        })
      )

      // Verify message was added to session
      const messages = await Session.getMessages(session.id)
      expect(messages).toHaveLength(4)
      expect(messages[3].content).toBe("Here is the answer to your follow-up.")
    })

    test("session data is persisted to disk", async () => {
      // Create session and run chat
      const session = await Session.create("Disk Persistence Test")
      await Session.addMessage(session.id, {
        role: "user",
        content: "Message to persist",
      })

      const mockModel = {}
      vi.mocked(Provider.getModel).mockResolvedValue(mockModel as never)
      vi.mocked(streamText).mockReturnValue(
        createMockTextResponse("Response to persist") as never
      )

      await ChatLoop.run(session.id)

      // Verify files exist on disk
      const sessionDir = path.join(testDir, "sessions", session.id)
      const sessionFile = path.join(sessionDir, "session.json")
      const messagesDir = path.join(sessionDir, "messages")

      // Check session file
      const sessionExists = await fs.access(sessionFile).then(() => true).catch(() => false)
      expect(sessionExists).toBe(true)

      // Read session data
      const sessionData = JSON.parse(await fs.readFile(sessionFile, "utf-8")) as SessionData
      expect(sessionData.id).toBe(session.id)
      expect(sessionData.title).toBe("Disk Persistence Test")

      // Check messages directory
      const messageFiles = await fs.readdir(messagesDir)
      expect(messageFiles.length).toBe(2) // user + assistant messages

      // Read message data
      const messageContents = await Promise.all(
        messageFiles.map(async (file) => {
          const content = await fs.readFile(path.join(messagesDir, file), "utf-8")
          return JSON.parse(content) as MessageData
        })
      )

      const contents = messageContents.map(m => m.content)
      expect(contents).toContain("Message to persist")
      expect(contents).toContain("Response to persist")
    })

    test("multiple sessions are isolated", async () => {
      // Create two separate sessions
      const session1 = await Session.create("Session 1")
      const session2 = await Session.create("Session 2")

      await Session.addMessage(session1.id, { role: "user", content: "Message in session 1" })
      await Session.addMessage(session2.id, { role: "user", content: "Message in session 2" })

      const mockModel = {}
      vi.mocked(Provider.getModel).mockResolvedValue(mockModel as never)

      // Different responses for different sessions
      vi.mocked(streamText)
        .mockReturnValueOnce(createMockTextResponse("Response for session 1") as never)
        .mockReturnValueOnce(createMockTextResponse("Response for session 2") as never)

      // Run both sessions
      await ChatLoop.run(session1.id)
      await ChatLoop.run(session2.id)

      // Verify messages are isolated
      const messages1 = await Session.getMessages(session1.id)
      const messages2 = await Session.getMessages(session2.id)

      expect(messages1).toHaveLength(2)
      expect(messages2).toHaveLength(2)

      expect(messages1[0].content).toBe("Message in session 1")
      expect(messages1[1].content).toBe("Response for session 1")

      expect(messages2[0].content).toBe("Message in session 2")
      expect(messages2[1].content).toBe("Response for session 2")

      // Verify sessions are listed
      const sessions = await Session.list()
      expect(sessions).toHaveLength(2)
    })
  })
})
