import type { LanguageModelV1 } from "ai"
import type { Tool } from "../tool/types"

/**
 * Agent interface defining the contract for AI agents in DadGPT.
 * Agents are specialized AI assistants with specific tools and prompts.
 */
export interface Agent {
  /** Unique identifier for the agent */
  id: string
  /** Human-readable name */
  name: string
  /** Brief description of the agent's purpose */
  description: string
  /** System prompt that defines the agent's behavior */
  systemPrompt: string
  /** List of tool IDs this agent has access to */
  toolIds: string[]
}

/**
 * Configuration for running an agent
 */
export interface AgentRunConfig {
  /** The agent to run */
  agent: Agent
  /** The language model to use */
  model: LanguageModelV1
  /** The session ID for context */
  sessionId: string
  /** Optional abort signal for cancellation */
  abortSignal?: AbortSignal
}

/**
 * Result from an agent interaction
 */
export interface AgentResult {
  /** The response content */
  content: string
  /** Tool calls made during the interaction */
  toolCalls: Array<{
    toolId: string
    input: unknown
    output: string
  }>
  /** Usage statistics */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Agent registry to store and retrieve agents
 */
const agents = new Map<string, Agent>()

/**
 * Agent management namespace
 */
export namespace Agents {
  /**
   * Register an agent
   */
  export function register(agent: Agent): void {
    agents.set(agent.id, agent)
  }

  /**
   * Get an agent by ID
   */
  export function get(id: string): Agent | undefined {
    return agents.get(id)
  }

  /**
   * Get all registered agents
   */
  export function getAll(): Agent[] {
    return Array.from(agents.values())
  }

  /**
   * Get the tools for an agent
   */
  export function getTools(agent: Agent, allTools: Tool[]): Tool[] {
    return allTools.filter((tool) => agent.toolIds.includes(tool.id))
  }

  /**
   * Clear all registered agents (useful for testing)
   */
  export function clear(): void {
    agents.clear()
  }
}
