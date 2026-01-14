/**
 * Model definitions for supported LLM providers
 */

export interface ModelInfo {
  id: string
  name: string
  provider: "anthropic" | "openai"
  contextWindow: number
  maxOutput: number
}

/**
 * Registry of supported models with their metadata
 */
export const MODELS: Record<string, ModelInfo> = {
  "claude-sonnet-4-20250514": {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    contextWindow: 200000,
    maxOutput: 8192,
  },
  "claude-3-5-haiku-20241022": {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    contextWindow: 200000,
    maxOutput: 8192,
  },
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextWindow: 128000,
    maxOutput: 16384,
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    contextWindow: 128000,
    maxOutput: 16384,
  },
}

/**
 * Get model info by model ID
 * @param modelId - The model ID to look up
 * @returns ModelInfo if found, undefined otherwise
 */
export function getModelInfo(modelId: string): ModelInfo | undefined {
  return MODELS[modelId]
}
