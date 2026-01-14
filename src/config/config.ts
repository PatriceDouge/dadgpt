import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import { ConfigSchema, type Config as ConfigType } from "./schema"
import { DEFAULT_CONFIG } from "./defaults"
import { Log } from "../util/log"
import { ConfigError } from "../util/errors"

export type { ConfigType as Config }

/**
 * Get the config directory path.
 * Can be overridden with DADGPT_HOME environment variable.
 */
function getConfigPath(): string {
  const home = process.env.DADGPT_HOME ?? path.join(os.homedir(), ".dadgpt")
  return path.join(home, "config.json")
}

/** Project-level config filename */
const PROJECT_CONFIG = "dadgpt.config.json"

/** Cached config instance */
let cachedConfig: ConfigType | null = null

/**
 * Config namespace for loading, caching, and saving configuration.
 *
 * Precedence (later overrides earlier):
 * 1. Defaults (from defaults.ts)
 * 2. Global config (~/.dadgpt/config.json)
 * 3. Project config (./dadgpt.config.json in current directory)
 * 4. Environment variables (DADGPT_PROVIDER, DADGPT_MODEL)
 */
export namespace Config {
  /**
   * Load and merge configuration from all sources.
   * Results are cached until invalidate() is called.
   */
  export async function get(): Promise<ConfigType> {
    if (cachedConfig) return cachedConfig

    // Load configs in order of precedence
    const globalConfig = await loadGlobalConfig()
    const projectConfig = await loadProjectConfig()
    const envConfig = loadEnvConfig()

    // Merge configs (later overrides earlier)
    const merged = deepMerge(
      DEFAULT_CONFIG,
      globalConfig,
      projectConfig,
      envConfig
    )

    // Validate and cache
    cachedConfig = ConfigSchema.parse(merged)
    return cachedConfig
  }

  /**
   * Clear the cached configuration.
   * Next call to get() will reload from all sources.
   */
  export function invalidate(): void {
    cachedConfig = null
  }

  /**
   * Save configuration to the global config file (~/.dadgpt/config.json).
   * Merges with existing global config.
   * @throws ConfigError if configuration cannot be saved
   */
  export async function save(config: Partial<ConfigType>): Promise<void> {
    const configPath = getConfigPath()

    try {
      const currentGlobal = await loadGlobalConfig()
      const updated = deepMerge(currentGlobal, config)

      // Ensure directory exists
      await fs.mkdir(path.dirname(configPath), { recursive: true })
      await fs.writeFile(configPath, JSON.stringify(updated, null, 2), "utf-8")
      invalidate()
    } catch (err) {
      Log.formatAndLogError("Failed to save configuration", err)
      throw new ConfigError(
        `Failed to save configuration to ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
        "CONFIG_SAVE_ERROR"
      )
    }
  }
}

/**
 * Load global config from ~/.dadgpt/config.json.
 * Handles missing files, empty files, and invalid JSON gracefully.
 */
async function loadGlobalConfig(): Promise<Partial<ConfigType>> {
  try {
    const configPath = getConfigPath()
    const content = await fs.readFile(configPath, "utf-8")

    // Handle empty file gracefully
    const trimmed = content.trim()
    if (!trimmed) {
      Log.debug("Global config file is empty, using defaults")
      return {}
    }

    try {
      return JSON.parse(trimmed) as Partial<ConfigType>
    } catch (parseErr) {
      // Invalid JSON - log warning and use defaults
      Log.warn(
        `Invalid JSON in config file ${configPath}, using defaults: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
      )
      return {}
    }
  } catch {
    // File doesn't exist or can't be read - this is fine, use defaults
    return {}
  }
}

/**
 * Load project-level config from ./dadgpt.config.json.
 * Handles missing files, empty files, and invalid JSON gracefully.
 */
async function loadProjectConfig(): Promise<Partial<ConfigType>> {
  try {
    const content = await fs.readFile(PROJECT_CONFIG, "utf-8")

    // Handle empty file gracefully
    const trimmed = content.trim()
    if (!trimmed) {
      Log.debug("Project config file is empty, using defaults")
      return {}
    }

    try {
      return JSON.parse(trimmed) as Partial<ConfigType>
    } catch (parseErr) {
      // Invalid JSON - log warning and use defaults
      Log.warn(
        `Invalid JSON in project config ${PROJECT_CONFIG}, using defaults: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
      )
      return {}
    }
  } catch {
    // File doesn't exist or can't be read - this is fine, use defaults
    return {}
  }
}

/**
 * Load config overrides from environment variables.
 *
 * Supported variables:
 * - DADGPT_PROVIDER: Override default provider
 * - DADGPT_MODEL: Override default model
 */
function loadEnvConfig(): Partial<ConfigType> {
  const config: Partial<ConfigType> = {}

  if (process.env.DADGPT_PROVIDER) {
    config.defaultProvider = process.env.DADGPT_PROVIDER
  }
  if (process.env.DADGPT_MODEL) {
    config.defaultModel = process.env.DADGPT_MODEL
  }

  return config
}

/**
 * Deep merge objects, with later arguments taking precedence.
 * Arrays are replaced, not merged.
 */
function deepMerge<T extends Record<string, unknown>>(
  ...objects: Partial<T>[]
): Partial<T> {
  const result: Record<string, unknown> = {}

  for (const obj of objects) {
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (
          typeof value === "object" &&
          !Array.isArray(value) &&
          value !== null
        ) {
          // Recursively merge objects
          result[key] = deepMerge(
            (result[key] as Partial<T>) ?? {},
            value as Partial<T>
          )
        } else {
          // Replace primitives and arrays
          result[key] = value
        }
      }
    }
  }

  return result as Partial<T>
}
