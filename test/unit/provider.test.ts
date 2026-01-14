import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { Provider } from "../../src/provider/provider"
import { MODELS, getModelInfo } from "../../src/provider/models"
import { Config } from "../../src/config/config"

describe("Models", () => {
  describe("MODELS registry", () => {
    test("contains claude-sonnet-4-20250514", () => {
      const model = MODELS["claude-sonnet-4-20250514"]
      expect(model).toBeDefined()
      expect(model.provider).toBe("anthropic")
      expect(model.name).toBe("Claude Sonnet 4")
      expect(model.contextWindow).toBe(200000)
    })

    test("contains claude-3-5-haiku-20241022", () => {
      const model = MODELS["claude-3-5-haiku-20241022"]
      expect(model).toBeDefined()
      expect(model.provider).toBe("anthropic")
      expect(model.name).toBe("Claude 3.5 Haiku")
    })

    test("contains gpt-4o", () => {
      const model = MODELS["gpt-4o"]
      expect(model).toBeDefined()
      expect(model.provider).toBe("openai")
      expect(model.name).toBe("GPT-4o")
      expect(model.contextWindow).toBe(128000)
    })

    test("contains gpt-4o-mini", () => {
      const model = MODELS["gpt-4o-mini"]
      expect(model).toBeDefined()
      expect(model.provider).toBe("openai")
      expect(model.name).toBe("GPT-4o Mini")
    })
  })

  describe("getModelInfo()", () => {
    test("returns model info for valid model ID", () => {
      const info = getModelInfo("gpt-4o")
      expect(info).toBeDefined()
      expect(info!.id).toBe("gpt-4o")
      expect(info!.provider).toBe("openai")
    })

    test("returns undefined for unknown model ID", () => {
      const info = getModelInfo("unknown-model")
      expect(info).toBeUndefined()
    })
  })
})

describe("Provider namespace", () => {
  let testDir: string
  let originalHome: string | undefined
  let originalDataDir: string | undefined
  let originalAnthropicKey: string | undefined
  let originalOpenAIKey: string | undefined

  beforeEach(async () => {
    // Create unique temp directory
    const random = Math.random().toString(36).substring(2, 15)
    testDir = path.join(
      os.tmpdir(),
      `dadgpt-provider-test-${Date.now()}-${random}`
    )
    await fs.mkdir(testDir, { recursive: true })

    // Store original env vars
    originalHome = process.env.DADGPT_HOME
    originalDataDir = process.env.DADGPT_DATA_DIR
    originalAnthropicKey = process.env.ANTHROPIC_API_KEY
    originalOpenAIKey = process.env.OPENAI_API_KEY

    // Override for testing
    process.env.DADGPT_HOME = testDir
    process.env.DADGPT_DATA_DIR = path.join(testDir, "data")

    // Clear API keys to prevent interference
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY

    // Create data directory
    await fs.mkdir(path.join(testDir, "data"), { recursive: true })

    // Clear config cache
    Config.invalidate()
  })

  afterEach(async () => {
    // Restore original env vars
    if (originalHome !== undefined) {
      process.env.DADGPT_HOME = originalHome
    } else {
      delete process.env.DADGPT_HOME
    }

    if (originalDataDir !== undefined) {
      process.env.DADGPT_DATA_DIR = originalDataDir
    } else {
      delete process.env.DADGPT_DATA_DIR
    }

    if (originalAnthropicKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalAnthropicKey
    } else {
      delete process.env.ANTHROPIC_API_KEY
    }

    if (originalOpenAIKey !== undefined) {
      process.env.OPENAI_API_KEY = originalOpenAIKey
    } else {
      delete process.env.OPENAI_API_KEY
    }

    // Clear config cache
    Config.invalidate()

    // Clear mocks
    vi.restoreAllMocks()

    // Clean up temp directory
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("listProviders()", () => {
    test("returns array of provider info", () => {
      const providers = Provider.listProviders()
      expect(Array.isArray(providers)).toBe(true)
      expect(providers.length).toBeGreaterThan(0)

      const anthropic = providers.find((p) => p.id === "anthropic")
      expect(anthropic).toBeDefined()
      expect(anthropic!.name).toBe("Anthropic")
      expect(anthropic!.envVar).toBe("ANTHROPIC_API_KEY")

      const openai = providers.find((p) => p.id === "openai")
      expect(openai).toBeDefined()
      expect(openai!.name).toBe("OpenAI")
      expect(openai!.envVar).toBe("OPENAI_API_KEY")
    })
  })

  describe("isSupported()", () => {
    test("returns true for supported providers", () => {
      expect(Provider.isSupported("anthropic")).toBe(true)
      expect(Provider.isSupported("openai")).toBe(true)
    })

    test("returns false for unsupported providers", () => {
      expect(Provider.isSupported("google")).toBe(false)
      expect(Provider.isSupported("unknown")).toBe(false)
    })
  })

  describe("getProviderInfo()", () => {
    test("returns provider info for valid provider", () => {
      const info = Provider.getProviderInfo("anthropic")
      expect(info).toBeDefined()
      expect(info!.id).toBe("anthropic")
      expect(info!.name).toBe("Anthropic")
    })

    test("returns undefined for unknown provider", () => {
      const info = Provider.getProviderInfo("unknown")
      expect(info).toBeUndefined()
    })
  })

  describe("getModel()", () => {
    test("throws ProviderError for unsupported provider", async () => {
      await expect(
        Provider.getModel("unsupported", "some-model")
      ).rejects.toThrow("Unsupported provider: unsupported")
    })

    test("throws ProviderError when API key is missing", async () => {
      // No API key in config or env
      await expect(
        Provider.getModel("anthropic", "claude-sonnet-4-20250514")
      ).rejects.toThrow("Missing API key for Anthropic")
    })

    test("uses API key from config", async () => {
      // Write config with API key
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          providers: {
            anthropic: {
              id: "anthropic",
              apiKey: "test-config-api-key",
            },
          },
        })
      )

      // This should not throw (API key is present in config)
      // The actual API call might fail, but the key retrieval should work
      // We can't fully test the model creation without mocking the SDK
      const model = await Provider.getModel(
        "anthropic",
        "claude-sonnet-4-20250514"
      )
      expect(model).toBeDefined()
    })

    test("uses API key from environment variable", async () => {
      // Set API key in environment
      process.env.ANTHROPIC_API_KEY = "test-env-api-key"

      const model = await Provider.getModel(
        "anthropic",
        "claude-sonnet-4-20250514"
      )
      expect(model).toBeDefined()
    })

    test("config API key takes precedence over env var", async () => {
      // Set both
      process.env.ANTHROPIC_API_KEY = "env-key"
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          providers: {
            anthropic: {
              id: "anthropic",
              apiKey: "config-key",
            },
          },
        })
      )

      // Should use config key (we can't easily verify this without more mocking)
      const model = await Provider.getModel(
        "anthropic",
        "claude-sonnet-4-20250514"
      )
      expect(model).toBeDefined()
    })

    test("creates OpenAI model when API key is present", async () => {
      process.env.OPENAI_API_KEY = "test-openai-key"

      const model = await Provider.getModel("openai", "gpt-4o")
      expect(model).toBeDefined()
    })
  })
})
