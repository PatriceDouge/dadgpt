import { z } from "zod"

/**
 * Tool call status type - tracks execution state
 */
export type ToolCallStatus = "pending" | "running" | "completed" | "error"

/**
 * Zod schema for tool call status
 */
export const ToolCallStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "error",
])

/**
 * Zod schema for ToolCall - tracks individual tool invocations
 */
export const ToolCallSchema = z.object({
  id: z.string(),
  toolId: z.string(),
  status: ToolCallStatusSchema,
  input: z.unknown(),
  output: z.string().optional(),
  error: z.string().optional(),
  startedAt: z.number(),
  completedAt: z.number().optional(),
})

/**
 * ToolCall type - tracks individual tool invocations within a message
 */
export type ToolCall = z.infer<typeof ToolCallSchema>

/**
 * Zod schema for UserMessage
 */
export const UserMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.literal("user"),
  content: z.string(),
  timestamp: z.number(),
})

/**
 * UserMessage type - represents a message from the user
 */
export type UserMessage = z.infer<typeof UserMessageSchema>

/**
 * Usage statistics from LLM call
 */
export const UsageSchema = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
})

/**
 * Usage type - token usage statistics
 */
export type Usage = z.infer<typeof UsageSchema>

/**
 * Model information for assistant messages
 */
export const ModelInfoSchema = z.object({
  provider: z.string(),
  model: z.string(),
})

/**
 * ModelInfo type - identifies the model used
 */
export type ModelInfo = z.infer<typeof ModelInfoSchema>

/**
 * Zod schema for AssistantMessage
 */
export const AssistantMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.literal("assistant"),
  content: z.string(),
  timestamp: z.number(),
  modelInfo: ModelInfoSchema.optional(),
  usage: UsageSchema.optional(),
  toolCalls: z.array(ToolCallSchema).optional(),
})

/**
 * AssistantMessage type - represents a message from the AI assistant
 */
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>

/**
 * Union schema for any message type
 */
export const MessageSchema = z.discriminatedUnion("role", [
  UserMessageSchema,
  AssistantMessageSchema,
])

/**
 * Message type - union of UserMessage and AssistantMessage
 */
export type Message = z.infer<typeof MessageSchema>

/**
 * Helper to create a new UserMessage
 */
export function createUserMessage(
  partial: Omit<UserMessage, "role">
): UserMessage {
  return {
    ...partial,
    role: "user",
  }
}

/**
 * Helper to create a new AssistantMessage
 */
export function createAssistantMessage(
  partial: Omit<AssistantMessage, "role">
): AssistantMessage {
  return {
    ...partial,
    role: "assistant",
  }
}

/**
 * Helper to create a new ToolCall
 */
export function createToolCall(
  partial: Omit<ToolCall, "status" | "startedAt"> & {
    status?: ToolCallStatus
    startedAt?: number
  }
): ToolCall {
  return {
    status: "pending",
    startedAt: Date.now(),
    ...partial,
  }
}
