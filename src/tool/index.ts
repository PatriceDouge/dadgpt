/**
 * Tool initialization - imports and registers all tools
 * Import this file to ensure all tools are available
 */

import { ToolRegistry } from "./registry"
import { GoalTool } from "./goal"
import { TodoTool } from "./todo"
import { ProjectTool } from "./project"
import { FamilyTool } from "./family"
import { ReadTool } from "./read"
import { WriteTool } from "./write"

/**
 * Initialize all default tools.
 * Call this once at startup to register all tools.
 */
export function initializeTools(): void {
  // Only register if not already registered
  if (!ToolRegistry.has("goal")) {
    ToolRegistry.register(GoalTool)
  }
  if (!ToolRegistry.has("todo")) {
    ToolRegistry.register(TodoTool)
  }
  if (!ToolRegistry.has("project")) {
    ToolRegistry.register(ProjectTool)
  }
  if (!ToolRegistry.has("family")) {
    ToolRegistry.register(FamilyTool)
  }
  if (!ToolRegistry.has("read")) {
    ToolRegistry.register(ReadTool)
  }
  if (!ToolRegistry.has("write")) {
    ToolRegistry.register(WriteTool)
  }
}

// Auto-initialize when this module is imported
initializeTools()

// Re-export tools and registry for convenience
export { ToolRegistry } from "./registry"
export { GoalTool } from "./goal"
export { TodoTool } from "./todo"
export { ProjectTool } from "./project"
export { FamilyTool } from "./family"
export { ReadTool } from "./read"
export { WriteTool } from "./write"
export type { Tool, ToolContext, ToolResult, ToolExecution } from "./types"
