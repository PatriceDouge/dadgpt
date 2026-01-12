import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import { Configuration } from "../config/config.ts";

export type ProviderID = "openai" | "anthropic";

export interface ProviderInfo {
  id: ProviderID;
  name: string;
  models: ModelInfo[];
  defaultModel: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  supportsTools: boolean;
}

// Provider definitions
export const PROVIDERS: Record<ProviderID, ProviderInfo> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    defaultModel: "gpt-4o",
    models: [
      { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, supportsTools: true },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", contextWindow: 128000, supportsTools: true },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", contextWindow: 128000, supportsTools: true },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", contextWindow: 16385, supportsTools: true },
    ],
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", contextWindow: 200000, supportsTools: true },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", contextWindow: 200000, supportsTools: true },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", contextWindow: 200000, supportsTools: true },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", contextWindow: 200000, supportsTools: true },
    ],
  },
};

export namespace Provider {
  export async function getModel(
    providerID?: string,
    modelID?: string
  ): Promise<{ model: LanguageModel; provider: ProviderID; modelId: string }> {
    const config = await Configuration.load();

    // Determine provider
    const provider = (providerID ?? config.defaultProvider ?? "openai") as ProviderID;
    if (!PROVIDERS[provider]) {
      throw new Error(`Unknown provider: ${provider}. Available: ${Object.keys(PROVIDERS).join(", ")}`);
    }

    // Determine model
    const providerInfo = PROVIDERS[provider];
    const model = modelID ?? config.defaultModel ?? providerInfo.defaultModel;

    // Get API key
    const apiKey = await Configuration.getApiKey(provider);
    if (!apiKey) {
      throw new Error(
        `No API key found for ${provider}. Set ${provider.toUpperCase()}_API_KEY environment variable or run 'dadgpt auth'.`
      );
    }

    // Create provider instance
    let languageModel: LanguageModel;

    switch (provider) {
      case "openai": {
        const openai = createOpenAI({ apiKey });
        languageModel = openai(model);
        break;
      }
      case "anthropic": {
        const anthropic = createAnthropic({ apiKey });
        languageModel = anthropic(model);
        break;
      }
      default:
        throw new Error(`Provider ${provider} not implemented`);
    }

    return { model: languageModel, provider, modelId: model };
  }

  export function listProviders(): ProviderInfo[] {
    return Object.values(PROVIDERS);
  }

  export function getProviderInfo(id: ProviderID): ProviderInfo | undefined {
    return PROVIDERS[id];
  }

  export function listModels(providerID: ProviderID): ModelInfo[] {
    return PROVIDERS[providerID]?.models ?? [];
  }

  export function isValidProvider(id: string): id is ProviderID {
    return id in PROVIDERS;
  }

  export function isValidModel(providerID: ProviderID, modelID: string): boolean {
    const provider = PROVIDERS[providerID];
    return provider?.models.some((m) => m.id === modelID) ?? false;
  }
}
