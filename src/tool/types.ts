import type { z } from "zod"

/**
 * Context passed to tool execution
 */
export interface ToolContext {
  sessionId: string
  userId?: string
}

/**
 * Result returned from tool execution
 */
export interface ToolResult {
  title: string
  output: string
  metadata?: Record<string, unknown>
}

/**
 * Tool definition interface
 */
export interface Tool<TParams extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string
  description: string
  parameters: TParams
  execute: (args: z.infer<TParams>, ctx: ToolContext) => Promise<ToolResult>
}

/**
 * Status of a tool execution
 */
export type ToolStatus = "pending" | "running" | "completed" | "error"

/**
 * Tracks the state of a tool execution
 */
export interface ToolExecution {
  id: string
  toolId: string
  status: ToolStatus
  input: unknown
  output?: string
  error?: string
  startedAt: number
  completedAt?: number
}
