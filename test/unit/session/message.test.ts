import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import {
  ToolCallStatusSchema,
  ToolCallSchema,
  UserMessageSchema,
  AssistantMessageSchema,
  UsageSchema,
  ModelInfoSchema,
  MessageSchema,
  createUserMessage,
  createAssistantMessage,
  createToolCall,
} from "../../../src/session/message"

describe("Message Schemas", () => {
  describe("ToolCallStatusSchema", () => {
    test("validates valid statuses", () => {
      expect(ToolCallStatusSchema.parse("pending")).toBe("pending")
      expect(ToolCallStatusSchema.parse("running")).toBe("running")
      expect(ToolCallStatusSchema.parse("completed")).toBe("completed")
      expect(ToolCallStatusSchema.parse("error")).toBe("error")
    })

    test("rejects invalid status", () => {
      expect(() => ToolCallStatusSchema.parse("invalid")).toThrow()
    })
  })

  describe("ToolCallSchema", () => {
    test("validates valid tool call", () => {
      const toolCall = {
        id: "tc_123",
        toolId: "goal",
        status: "completed",
        input: { action: "list" },
        output: "Listed 5 goals",
        startedAt: Date.now(),
        completedAt: Date.now(),
      }

      const result = ToolCallSchema.parse(toolCall)
      expect(result.id).toBe("tc_123")
      expect(result.toolId).toBe("goal")
      expect(result.status).toBe("completed")
    })

    test("validates tool call without optional fields", () => {
      const toolCall = {
        id: "tc_123",
        toolId: "goal",
        status: "pending",
        input: {},
        startedAt: Date.now(),
      }

      const result = ToolCallSchema.parse(toolCall)
      expect(result.output).toBeUndefined()
      expect(result.error).toBeUndefined()
      expect(result.completedAt).toBeUndefined()
    })

    test("validates tool call with error", () => {
      const toolCall = {
        id: "tc_123",
        toolId: "bash",
        status: "error",
        input: { command: "rm -rf /" },
        error: "Permission denied",
        startedAt: Date.now(),
        completedAt: Date.now(),
      }

      const result = ToolCallSchema.parse(toolCall)
      expect(result.error).toBe("Permission denied")
    })
  })

  describe("UserMessageSchema", () => {
    test("validates valid user message", () => {
      const msg = {
        id: "msg_123",
        sessionId: "sess_456",
        role: "user",
        content: "Hello, world!",
        timestamp: Date.now(),
      }

      const result = UserMessageSchema.parse(msg)
      expect(result.role).toBe("user")
      expect(result.content).toBe("Hello, world!")
    })

    test("rejects message with wrong role", () => {
      const msg = {
        id: "msg_123",
        sessionId: "sess_456",
        role: "assistant",
        content: "Hello!",
        timestamp: Date.now(),
      }

      expect(() => UserMessageSchema.parse(msg)).toThrow()
    })
  })

  describe("AssistantMessageSchema", () => {
    test("validates valid assistant message", () => {
      const msg = {
        id: "msg_123",
        sessionId: "sess_456",
        role: "assistant",
        content: "Hello! How can I help?",
        timestamp: Date.now(),
      }

      const result = AssistantMessageSchema.parse(msg)
      expect(result.role).toBe("assistant")
    })

    test("validates with modelInfo and usage", () => {
      const msg = {
        id: "msg_123",
        sessionId: "sess_456",
        role: "assistant",
        content: "Hello!",
        timestamp: Date.now(),
        modelInfo: {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      }

      const result = AssistantMessageSchema.parse(msg)
      expect(result.modelInfo?.provider).toBe("anthropic")
      expect(result.usage?.totalTokens).toBe(150)
    })

    test("validates with toolCalls", () => {
      const msg = {
        id: "msg_123",
        sessionId: "sess_456",
        role: "assistant",
        content: "Let me check that for you.",
        timestamp: Date.now(),
        toolCalls: [
          {
            id: "tc_1",
            toolId: "goal",
            status: "completed",
            input: { action: "list" },
            output: "Found 3 goals",
            startedAt: Date.now(),
            completedAt: Date.now(),
          },
        ],
      }

      const result = AssistantMessageSchema.parse(msg)
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls![0].toolId).toBe("goal")
    })
  })

  describe("UsageSchema", () => {
    test("validates valid usage", () => {
      const usage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      }

      const result = UsageSchema.parse(usage)
      expect(result.totalTokens).toBe(150)
    })

    test("rejects missing fields", () => {
      expect(() => UsageSchema.parse({ promptTokens: 100 })).toThrow()
    })
  })

  describe("ModelInfoSchema", () => {
    test("validates valid model info", () => {
      const info = {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
      }

      const result = ModelInfoSchema.parse(info)
      expect(result.provider).toBe("anthropic")
      expect(result.model).toBe("claude-sonnet-4-20250514")
    })
  })

  describe("MessageSchema (discriminated union)", () => {
    test("parses user message correctly", () => {
      const msg = {
        id: "msg_123",
        sessionId: "sess_456",
        role: "user",
        content: "Hello!",
        timestamp: Date.now(),
      }

      const result = MessageSchema.parse(msg)
      expect(result.role).toBe("user")
    })

    test("parses assistant message correctly", () => {
      const msg = {
        id: "msg_123",
        sessionId: "sess_456",
        role: "assistant",
        content: "Hello!",
        timestamp: Date.now(),
      }

      const result = MessageSchema.parse(msg)
      expect(result.role).toBe("assistant")
    })

    test("rejects invalid role", () => {
      const msg = {
        id: "msg_123",
        sessionId: "sess_456",
        role: "system",
        content: "Hello!",
        timestamp: Date.now(),
      }

      expect(() => MessageSchema.parse(msg)).toThrow()
    })
  })
})

describe("Message Helper Functions", () => {
  describe("createUserMessage", () => {
    test("creates user message with role", () => {
      const msg = createUserMessage({
        id: "msg_123",
        sessionId: "sess_456",
        content: "Hello!",
        timestamp: Date.now(),
      })

      expect(msg.role).toBe("user")
      expect(msg.id).toBe("msg_123")
      expect(msg.content).toBe("Hello!")
    })
  })

  describe("createAssistantMessage", () => {
    test("creates assistant message with role", () => {
      const msg = createAssistantMessage({
        id: "msg_123",
        sessionId: "sess_456",
        content: "Hello! How can I help?",
        timestamp: Date.now(),
      })

      expect(msg.role).toBe("assistant")
      expect(msg.id).toBe("msg_123")
    })

    test("includes optional fields", () => {
      const msg = createAssistantMessage({
        id: "msg_123",
        sessionId: "sess_456",
        content: "Done!",
        timestamp: Date.now(),
        modelInfo: {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        toolCalls: [],
      })

      expect(msg.modelInfo?.provider).toBe("anthropic")
      expect(msg.usage?.totalTokens).toBe(150)
    })
  })

  describe("createToolCall", () => {
    let mockDateNow: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      mockDateNow = vi.spyOn(Date, "now").mockReturnValue(1234567890)
    })

    afterEach(() => {
      mockDateNow.mockRestore()
    })

    test("creates tool call with default status and startedAt", () => {
      const call = createToolCall({
        id: "tc_123",
        toolId: "goal",
        input: { action: "list" },
      })

      expect(call.status).toBe("pending")
      expect(call.startedAt).toBe(1234567890)
      expect(call.id).toBe("tc_123")
      expect(call.toolId).toBe("goal")
    })

    test("allows overriding status", () => {
      const call = createToolCall({
        id: "tc_123",
        toolId: "goal",
        input: {},
        status: "running",
      })

      expect(call.status).toBe("running")
    })

    test("allows overriding startedAt", () => {
      const call = createToolCall({
        id: "tc_123",
        toolId: "goal",
        input: {},
        startedAt: 9999999999,
      })

      expect(call.startedAt).toBe(9999999999)
    })

    test("includes optional fields", () => {
      const call = createToolCall({
        id: "tc_123",
        toolId: "goal",
        input: { action: "get", id: "123" },
        output: "Goal found",
        completedAt: 1234567900,
      })

      expect(call.output).toBe("Goal found")
      expect(call.completedAt).toBe(1234567900)
    })
  })
})
