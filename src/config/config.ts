import * as fs from "fs/promises";
import * as path from "path";
import { Storage } from "../storage/storage.ts";
import { type Config, ConfigSchema, type Auth, AuthSchema } from "./schema.ts";

// Environment variable prefix
const ENV_PREFIX = "DADGPT_";

// Cache for loaded config
let cachedConfig: Config | null = null;
let cachedAuth: Auth | null = null;

export namespace Configuration {
  export function getDefaults(): Config {
    return {
      defaultProvider: "openai",
      goalCategories: ["Health", "Family", "Work", "Personal", "Finance"],
    };
  }

  export async function loadGlobalConfig(): Promise<Partial<Config>> {
    const config = await Storage.readConfig<Config>("config");
    return config ?? {};
  }

  export async function loadProjectConfig(): Promise<Partial<Config>> {
    // Try to load from current directory's dadgpt.md frontmatter or .dadgpt/config.json
    const cwd = process.cwd();

    // Try .dadgpt/config.json first
    try {
      const configPath = path.join(cwd, ".dadgpt", "config.json");
      const content = await fs.readFile(configPath, "utf-8");
      return JSON.parse(content);
    } catch {
      // Ignore if not found
    }

    return {};
  }

  function loadEnvConfig(): Partial<Config> {
    const envConfig: Partial<Config> = {};

    // Provider from env
    const provider = process.env[`${ENV_PREFIX}PROVIDER`];
    if (provider) {
      envConfig.defaultProvider = provider;
    }

    // Model from env
    const model = process.env[`${ENV_PREFIX}MODEL`];
    if (model) {
      envConfig.defaultModel = model;
    }

    // API keys from env
    const openaiKey = process.env.OPENAI_API_KEY || process.env[`${ENV_PREFIX}OPENAI_API_KEY`];
    const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env[`${ENV_PREFIX}ANTHROPIC_API_KEY`];

    if (openaiKey || anthropicKey) {
      envConfig.provider = {};
      if (openaiKey) {
        envConfig.provider.openai = { apiKey: openaiKey };
      }
      if (anthropicKey) {
        envConfig.provider.anthropic = { apiKey: anthropicKey };
      }
    }

    return envConfig;
  }

  function deepMerge<T extends Record<string, unknown>>(
    base: T,
    ...overrides: Partial<T>[]
  ): T {
    const result = { ...base };

    for (const override of overrides) {
      for (const key in override) {
        const baseVal = result[key];
        const overrideVal = override[key];

        if (
          typeof baseVal === "object" &&
          baseVal !== null &&
          !Array.isArray(baseVal) &&
          typeof overrideVal === "object" &&
          overrideVal !== null &&
          !Array.isArray(overrideVal)
        ) {
          (result as Record<string, unknown>)[key] = deepMerge(
            baseVal as Record<string, unknown>,
            overrideVal as Record<string, unknown>
          );
        } else if (overrideVal !== undefined) {
          (result as Record<string, unknown>)[key] = overrideVal;
        }
      }
    }

    return result;
  }

  export async function load(cliOverrides?: Partial<Config>): Promise<Config> {
    if (cachedConfig && !cliOverrides) {
      return cachedConfig;
    }

    const defaults = getDefaults();
    const globalConfig = await loadGlobalConfig();
    const projectConfig = await loadProjectConfig();
    const envConfig = loadEnvConfig();

    const merged = deepMerge(
      defaults,
      globalConfig,
      projectConfig,
      envConfig,
      cliOverrides ?? {}
    );

    const validated = ConfigSchema.parse(merged);
    cachedConfig = validated;

    return validated;
  }

  export async function save(config: Partial<Config>): Promise<void> {
    const existing = await loadGlobalConfig();
    const merged = deepMerge(existing as Config, config);
    await Storage.writeConfig("config", merged);
    cachedConfig = null; // Invalidate cache
  }

  export async function loadAuth(): Promise<Auth> {
    if (cachedAuth) {
      return cachedAuth;
    }

    const auth = await Storage.readAuth<Auth>();
    cachedAuth = auth ? AuthSchema.parse(auth) : { providers: {} };
    return cachedAuth;
  }

  export async function saveAuth(auth: Partial<Auth>): Promise<void> {
    const existing = await loadAuth();
    const merged = { ...existing, ...auth };
    await Storage.writeAuth(merged);
    cachedAuth = null; // Invalidate cache
  }

  export async function getApiKey(provider: string): Promise<string | undefined> {
    // 1. Check environment first
    const envKey =
      process.env[`${provider.toUpperCase()}_API_KEY`] ||
      process.env[`${ENV_PREFIX}${provider.toUpperCase()}_API_KEY`];
    if (envKey) {
      return envKey;
    }

    // 2. Check config
    const config = await load();
    const configKey = config.provider?.[provider]?.apiKey;
    if (configKey) {
      return configKey;
    }

    // 3. Check auth file
    const auth = await loadAuth();
    return auth.providers?.[provider]?.apiKey;
  }

  export function clearCache(): void {
    cachedConfig = null;
    cachedAuth = null;
  }

  export function isDebug(): boolean {
    return process.env[`${ENV_PREFIX}DEBUG`] === "1" || process.env.DEBUG === "1";
  }
}
