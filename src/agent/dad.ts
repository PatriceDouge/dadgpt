import type { Agent } from "./agent"
import { Agents } from "./agent"
import { DAD_SYSTEM_PROMPT } from "./prompts"

/**
 * The main DadGPT agent.
 * Has full access to all tools for managing goals, todos, projects, and family.
 */
export const DadAgent: Agent = {
  id: "dad",
  name: "DadGPT",
  description:
    "Your AI-powered personal command center for managing goals, todos, projects, and family life.",
  systemPrompt: DAD_SYSTEM_PROMPT,
  // Full tool access - all available tools
  toolIds: ["goal", "todo", "project", "family", "read", "write"],
}

// Register the DadAgent on import
Agents.register(DadAgent)

/**
 * Get the default agent (DadAgent)
 */
export function getDefaultAgent(): Agent {
  return DadAgent
}
