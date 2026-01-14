import type { z } from "zod"
import type { Tool, ToolContext, ToolResult } from "./types"

/**
 * Any tool type - used for registry which stores tools with various parameter types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any>

/**
 * Map of registered tools by ID
 */
const tools = new Map<string, AnyTool>()

/**
 * AI SDK compatible tool format
 */
export interface AITool {
  parameters: z.ZodTypeAny
  description: string
  execute: (
    args: unknown,
    options: { abortSignal?: AbortSignal }
  ) => Promise<string>
}

/**
 * Central registry for all tools.
 * Manages tool registration and provides access to tools for the AI SDK.
 */
export namespace ToolRegistry {
  /**
   * Register a tool with the registry.
   * @param tool - The tool to register
   */
  export function register(tool: AnyTool): void {
    tools.set(tool.id, tool)
  }

  /**
   * Get a tool by ID.
   * @param id - The tool ID to look up
   * @returns The tool if found, undefined otherwise
   */
  export function get(id: string): AnyTool | undefined {
    return tools.get(id)
  }

  /**
   * Get all registered tools.
   * @returns Array of all registered tools
   */
  export function getAll(): AnyTool[] {
    return Array.from(tools.values())
  }

  /**
   * Get tools formatted for the AI SDK.
   * Returns a record of tool name -> AI SDK tool format.
   * This can be passed directly to streamText/generateText.
   */
  export function getToolsForAI(
    ctx: ToolContext
  ): Record<string, AITool> {
    const result: Record<string, AITool> = {}

    for (const tool of tools.values()) {
      result[tool.id] = {
        parameters: tool.parameters,
        description: tool.description,
        execute: async (args, _options) => {
          const toolResult = await tool.execute(args, ctx)
          return formatToolResult(toolResult)
        },
      }
    }

    return result
  }

  /**
   * Check if a tool is registered.
   * @param id - The tool ID to check
   * @returns True if the tool is registered
   */
  export function has(id: string): boolean {
    return tools.has(id)
  }

  /**
   * Clear all registered tools.
   * Useful for testing.
   */
  export function clear(): void {
    tools.clear()
  }
}

/**
 * Format a ToolResult into a string for the AI.
 */
function formatToolResult(result: ToolResult): string {
  let output = `**${result.title}**\n\n${result.output}`

  if (result.metadata && Object.keys(result.metadata).length > 0) {
    output += `\n\nMetadata: ${JSON.stringify(result.metadata)}`
  }

  return output
}
