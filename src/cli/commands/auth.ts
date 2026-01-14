/**
 * Auth command - Configure API keys for LLM providers.
 *
 * Prompts for API keys interactively and saves them to the global config.
 * Supports configuring a single provider or all providers.
 */

import type { CommandModule } from "yargs"
import * as readline from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { Config } from "../../config/config"
import { Log } from "../../util/log"
import type { GlobalOptions } from "../index"
import type { ProviderConfig } from "../../config/schema"

/**
 * Options specific to the auth command.
 */
export interface AuthOptions extends GlobalOptions {
  /** Provider to configure (optional, configures all if not specified) */
  provider?: string
}

/**
 * Supported providers and their display names.
 */
const PROVIDERS: Record<string, { name: string; envVar: string }> = {
  anthropic: {
    name: "Anthropic",
    envVar: "ANTHROPIC_API_KEY",
  },
  openai: {
    name: "OpenAI",
    envVar: "OPENAI_API_KEY",
  },
}

/**
 * Mask an API key, showing only the first 4 and last 4 characters.
 */
function maskApiKey(key: string): string {
  if (key.length <= 12) {
    return "*".repeat(key.length)
  }
  const first = key.slice(0, 4)
  const last = key.slice(-4)
  const middle = "*".repeat(Math.min(key.length - 8, 20))
  return `${first}${middle}${last}`
}

/**
 * Get the current API key for a provider from config or environment.
 */
async function getCurrentKey(
  providerId: string
): Promise<{ key: string | undefined; source: "config" | "env" | undefined }> {
  const config = await Config.get()
  const providerConfig = config.providers[providerId]

  // Check config first
  if (providerConfig?.apiKey) {
    return { key: providerConfig.apiKey, source: "config" }
  }

  // Check environment variable
  const envVar = PROVIDERS[providerId]?.envVar
  if (envVar && process.env[envVar]) {
    return { key: process.env[envVar], source: "env" }
  }

  return { key: undefined, source: undefined }
}

/**
 * Configure API key for a single provider.
 */
async function configureProvider(
  providerId: string,
  rl: readline.Interface
): Promise<boolean> {
  const providerInfo = PROVIDERS[providerId]
  if (!providerInfo) {
    console.log(`\x1b[31m✗\x1b[0m  Unknown provider: ${providerId}`)
    console.log(`   Supported providers: ${Object.keys(PROVIDERS).join(", ")}`)
    return false
  }

  console.log("")
  console.log(`\x1b[1m${providerInfo.name}\x1b[0m`)

  // Show current key status
  const { key: currentKey, source } = await getCurrentKey(providerId)
  if (currentKey) {
    const masked = maskApiKey(currentKey)
    const sourceText = source === "env" ? ` (from ${providerInfo.envVar})` : ""
    console.log(`   Current key: ${masked}${sourceText}`)
  } else {
    console.log("   No API key configured")
  }

  // Prompt for new key
  const prompt = currentKey
    ? `   Enter new API key (or press Enter to keep current): `
    : `   Enter API key: `

  const newKey = await rl.question(prompt)

  // Handle input
  if (!newKey.trim()) {
    if (currentKey) {
      console.log("   \x1b[90mKeeping existing key\x1b[0m")
      return true
    }
    console.log("   \x1b[33m⚠\x1b[0m  No key provided, skipping")
    return false
  }

  // Validate key format (basic validation)
  const trimmedKey = newKey.trim()
  if (trimmedKey.length < 10) {
    console.log("   \x1b[31m✗\x1b[0m  API key seems too short")
    return false
  }

  // Save the key to config
  try {
    const config = await Config.get()
    const existingProvider = config.providers[providerId]

    const updatedProvider: ProviderConfig = {
      id: providerId,
      apiKey: trimmedKey,
      ...(existingProvider?.baseURL && { baseURL: existingProvider.baseURL }),
    }

    await Config.save({
      providers: {
        ...config.providers,
        [providerId]: updatedProvider,
      },
    })

    console.log(`   \x1b[32m✓\x1b[0m  API key saved for ${providerInfo.name}`)
    Log.debug(`Saved API key for provider: ${providerId}`)
    return true
  } catch (error) {
    Log.error(`Failed to save API key for ${providerId}:`, error)
    console.log(`   \x1b[31m✗\x1b[0m  Failed to save API key`)
    return false
  }
}

/**
 * Auth command definition.
 */
export const authCommand: CommandModule<GlobalOptions, AuthOptions> = {
  command: "auth [provider]",
  describe: "Configure API keys for LLM providers",

  builder: (yargs) =>
    yargs.positional("provider", {
      type: "string",
      description: "Provider to configure (anthropic, openai). Configures all if not specified.",
    }),

  handler: async (argv) => {
    console.log("\x1b[1mDadGPT Authentication Setup\x1b[0m")
    console.log("\x1b[90mConfigure API keys for AI providers\x1b[0m")

    // Create readline interface for interactive input
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    })

    try {
      if (argv.provider) {
        // Configure single provider
        const success = await configureProvider(argv.provider, rl)
        if (!success) {
          process.exitCode = 1
        }
      } else {
        // Configure all providers
        let anyConfigured = false
        for (const providerId of Object.keys(PROVIDERS)) {
          const success = await configureProvider(providerId, rl)
          if (success) {
            anyConfigured = true
          }
        }

        if (!anyConfigured) {
          console.log("")
          console.log("\x1b[33m⚠\x1b[0m  No API keys were configured")
        }
      }

      // Show next steps
      console.log("")
      console.log("\x1b[90mYou can also set API keys via environment variables:\x1b[0m")
      for (const [, info] of Object.entries(PROVIDERS)) {
        console.log(`   ${info.envVar}`)
      }
      console.log("")
      console.log("Run \x1b[36mdadgpt\x1b[0m to start chatting!")
    } finally {
      rl.close()
    }
  },
}
