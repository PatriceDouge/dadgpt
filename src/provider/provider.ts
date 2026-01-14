/**
 * Provider abstraction for LLM providers
 */

import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModelV1 } from "ai"
import { Config } from "../config/config"
import { ProviderError } from "../util/errors"

/** Supported provider IDs */
export type ProviderId = "anthropic" | "openai"

/** Provider metadata */
export interface ProviderInfo {
  id: ProviderId
  name: string
  envVar: string
}

/** Registry of available providers */
const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    envVar: "ANTHROPIC_API_KEY",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    envVar: "OPENAI_API_KEY",
  },
}

/**
 * Provider namespace for creating LLM model instances
 */
export namespace Provider {
  /**
   * Get a language model instance for the specified provider and model.
   *
   * API keys are resolved in the following order:
   * 1. Config providers[providerId].apiKey
   * 2. Environment variable (ANTHROPIC_API_KEY or OPENAI_API_KEY)
   *
   * @param providerId - The provider ID ('anthropic' or 'openai')
   * @param modelId - The model ID to use
   * @returns A LanguageModel instance ready for use with Vercel AI SDK
   * @throws ProviderError if provider is unsupported or API key is missing
   */
  export async function getModel(
    providerId: string,
    modelId: string
  ): Promise<LanguageModelV1> {
    const providerInfo = PROVIDERS[providerId as ProviderId]
    if (!providerInfo) {
      throw new ProviderError(
        `Unsupported provider: ${providerId}. Supported providers: ${Object.keys(PROVIDERS).join(", ")}`,
        "UNSUPPORTED_PROVIDER"
      )
    }

    // Get API key from config or environment
    const config = await Config.get()
    const configApiKey = config.providers[providerId]?.apiKey
    const envApiKey = process.env[providerInfo.envVar]
    const apiKey = configApiKey ?? envApiKey

    if (!apiKey) {
      throw new ProviderError(
        `Missing API key for ${providerInfo.name}. Set ${providerInfo.envVar} environment variable or configure in ~/.dadgpt/config.json`,
        "MISSING_API_KEY"
      )
    }

    // Create provider instance with API key and return the model
    switch (providerId) {
      case "anthropic": {
        const provider = createAnthropic({ apiKey })
        return provider(modelId)
      }
      case "openai": {
        const provider = createOpenAI({ apiKey })
        return provider(modelId)
      }
      default:
        // This should never happen due to the check above, but TypeScript needs it
        throw new ProviderError(
          `Unsupported provider: ${providerId}`,
          "UNSUPPORTED_PROVIDER"
        )
    }
  }

  /**
   * List all available providers
   * @returns Array of provider information objects
   */
  export function listProviders(): ProviderInfo[] {
    return Object.values(PROVIDERS)
  }

  /**
   * Check if a provider is supported
   * @param providerId - The provider ID to check
   * @returns true if the provider is supported
   */
  export function isSupported(providerId: string): providerId is ProviderId {
    return providerId in PROVIDERS
  }

  /**
   * Get provider info by ID
   * @param providerId - The provider ID
   * @returns ProviderInfo if found, undefined otherwise
   */
  export function getProviderInfo(providerId: string): ProviderInfo | undefined {
    return PROVIDERS[providerId as ProviderId]
  }
}
