import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { Config } from "../../src/config/config"
import { DEFAULT_CONFIG } from "../../src/config/defaults"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"

describe("Config", () => {
  let testHomeDir: string
  let originalCwd: string
  let originalEnvVars: {
    DADGPT_HOME?: string
    DADGPT_PROVIDER?: string
    DADGPT_MODEL?: string
  }

  beforeEach(async () => {
    // Store original environment variables
    originalEnvVars = {
      DADGPT_HOME: process.env.DADGPT_HOME,
      DADGPT_PROVIDER: process.env.DADGPT_PROVIDER,
      DADGPT_MODEL: process.env.DADGPT_MODEL,
    }

    // Store original cwd
    originalCwd = process.cwd()

    // Create a unique temporary directory for each test
    testHomeDir = path.join(
      os.tmpdir(),
      `dadgpt-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    await fs.mkdir(testHomeDir, { recursive: true })

    // Set DADGPT_HOME to our test directory
    process.env.DADGPT_HOME = testHomeDir

    // Clear any cached config
    Config.invalidate()

    // Clear env overrides
    delete process.env.DADGPT_PROVIDER
    delete process.env.DADGPT_MODEL
  })

  afterEach(async () => {
    // Restore original environment variables
    if (originalEnvVars.DADGPT_HOME !== undefined) {
      process.env.DADGPT_HOME = originalEnvVars.DADGPT_HOME
    } else {
      delete process.env.DADGPT_HOME
    }
    if (originalEnvVars.DADGPT_PROVIDER !== undefined) {
      process.env.DADGPT_PROVIDER = originalEnvVars.DADGPT_PROVIDER
    } else {
      delete process.env.DADGPT_PROVIDER
    }
    if (originalEnvVars.DADGPT_MODEL !== undefined) {
      process.env.DADGPT_MODEL = originalEnvVars.DADGPT_MODEL
    } else {
      delete process.env.DADGPT_MODEL
    }

    // Restore original cwd
    try {
      process.chdir(originalCwd)
    } catch {
      // Ignore if directory doesn't exist
    }

    // Clear cached config
    Config.invalidate()

    // Clean up test directory
    try {
      await fs.rm(testHomeDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe("get()", () => {
    test("default config returned when no files exist", async () => {
      // No config files exist in testHomeDir or current directory
      const config = await Config.get()

      // Should return default config values
      expect(config.defaultProvider).toBe(DEFAULT_CONFIG.defaultProvider)
      expect(config.defaultModel).toBe(DEFAULT_CONFIG.defaultModel)
      expect(config.theme).toBe(DEFAULT_CONFIG.theme)
      expect(config.goalCategories).toEqual(DEFAULT_CONFIG.goalCategories)
      expect(config.permissions).toEqual(DEFAULT_CONFIG.permissions)
      expect(config.family).toEqual(DEFAULT_CONFIG.family)
      expect(config.providers).toEqual(DEFAULT_CONFIG.providers)
    })

    test("global config loaded and merged", async () => {
      // Create global config file with custom values
      const globalConfigPath = path.join(testHomeDir, "config.json")
      const globalConfig = {
        defaultProvider: "openai",
        theme: "light",
        goalCategories: ["Custom1", "Custom2"],
      }
      await fs.writeFile(globalConfigPath, JSON.stringify(globalConfig, null, 2))

      const config = await Config.get()

      // Global config values should be applied
      expect(config.defaultProvider).toBe("openai")
      expect(config.theme).toBe("light")
      expect(config.goalCategories).toEqual(["Custom1", "Custom2"])

      // Unspecified values should fall back to defaults
      expect(config.defaultModel).toBe(DEFAULT_CONFIG.defaultModel)
      expect(config.permissions).toEqual(DEFAULT_CONFIG.permissions)
    })

    test("env vars override config", async () => {
      // Create global config
      const globalConfigPath = path.join(testHomeDir, "config.json")
      const globalConfig = {
        defaultProvider: "anthropic",
        defaultModel: "claude-3-5-haiku-20241022",
      }
      await fs.writeFile(globalConfigPath, JSON.stringify(globalConfig, null, 2))

      // Set environment variables to override
      process.env.DADGPT_PROVIDER = "openai"
      process.env.DADGPT_MODEL = "gpt-4o"

      const config = await Config.get()

      // Env vars should take precedence over global config
      expect(config.defaultProvider).toBe("openai")
      expect(config.defaultModel).toBe("gpt-4o")
    })

    test("handles empty global config file gracefully", async () => {
      // Create empty config file
      const globalConfigPath = path.join(testHomeDir, "config.json")
      await fs.writeFile(globalConfigPath, "")

      const config = await Config.get()

      // Should return default config
      expect(config.defaultProvider).toBe(DEFAULT_CONFIG.defaultProvider)
      expect(config.defaultModel).toBe(DEFAULT_CONFIG.defaultModel)
    })

    test("handles invalid JSON in global config file gracefully", async () => {
      // Create config file with invalid JSON
      const globalConfigPath = path.join(testHomeDir, "config.json")
      await fs.writeFile(globalConfigPath, "{ invalid json }")

      const config = await Config.get()

      // Should return default config
      expect(config.defaultProvider).toBe(DEFAULT_CONFIG.defaultProvider)
      expect(config.defaultModel).toBe(DEFAULT_CONFIG.defaultModel)
    })

    test("handles whitespace-only config file gracefully", async () => {
      // Create config file with only whitespace
      const globalConfigPath = path.join(testHomeDir, "config.json")
      await fs.writeFile(globalConfigPath, "   \n\t  \n  ")

      const config = await Config.get()

      // Should return default config
      expect(config.defaultProvider).toBe(DEFAULT_CONFIG.defaultProvider)
      expect(config.defaultModel).toBe(DEFAULT_CONFIG.defaultModel)
    })

    test("deep merges nested objects", async () => {
      // Create global config with partial providers object
      const globalConfigPath = path.join(testHomeDir, "config.json")
      const globalConfig = {
        providers: {
          anthropic: {
            id: "anthropic",
            apiKey: "sk-ant-test123",
          },
        },
      }
      await fs.writeFile(globalConfigPath, JSON.stringify(globalConfig, null, 2))

      const config = await Config.get()

      // Providers should be merged
      expect(config.providers).toEqual({
        anthropic: {
          id: "anthropic",
          apiKey: "sk-ant-test123",
        },
      })

      // Other defaults should still be present
      expect(config.defaultProvider).toBe(DEFAULT_CONFIG.defaultProvider)
    })

    test("config is cached between calls", async () => {
      // Create global config
      const globalConfigPath = path.join(testHomeDir, "config.json")
      await fs.writeFile(
        globalConfigPath,
        JSON.stringify({ defaultProvider: "openai" })
      )

      // First call
      const config1 = await Config.get()
      expect(config1.defaultProvider).toBe("openai")

      // Modify the file
      await fs.writeFile(
        globalConfigPath,
        JSON.stringify({ defaultProvider: "anthropic" })
      )

      // Second call should return cached value
      const config2 = await Config.get()
      expect(config2.defaultProvider).toBe("openai")
      expect(config2).toBe(config1) // Same reference
    })
  })

  describe("invalidate()", () => {
    test("invalidate clears cache", async () => {
      // Create global config
      const globalConfigPath = path.join(testHomeDir, "config.json")
      await fs.writeFile(
        globalConfigPath,
        JSON.stringify({ defaultProvider: "openai" })
      )

      // First call
      const config1 = await Config.get()
      expect(config1.defaultProvider).toBe("openai")

      // Modify the file
      await fs.writeFile(
        globalConfigPath,
        JSON.stringify({ defaultProvider: "anthropic" })
      )

      // Invalidate cache
      Config.invalidate()

      // Next call should reload from file
      const config2 = await Config.get()
      expect(config2.defaultProvider).toBe("anthropic")
      expect(config2).not.toBe(config1) // Different reference
    })
  })

  describe("save()", () => {
    test("saves config to global config file", async () => {
      await Config.save({ defaultProvider: "openai" })

      // Read the file directly
      const globalConfigPath = path.join(testHomeDir, "config.json")
      const content = await fs.readFile(globalConfigPath, "utf-8")
      const saved = JSON.parse(content)

      expect(saved.defaultProvider).toBe("openai")
    })

    test("merges with existing global config", async () => {
      // Create existing global config
      const globalConfigPath = path.join(testHomeDir, "config.json")
      await fs.writeFile(
        globalConfigPath,
        JSON.stringify({
          defaultProvider: "anthropic",
          theme: "light",
        })
      )

      // Save new value
      await Config.save({ defaultModel: "gpt-4o" })

      // Read the file
      const content = await fs.readFile(globalConfigPath, "utf-8")
      const saved = JSON.parse(content)

      // Should have merged values
      expect(saved.defaultProvider).toBe("anthropic")
      expect(saved.theme).toBe("light")
      expect(saved.defaultModel).toBe("gpt-4o")
    })

    test("invalidates cache after save", async () => {
      // Load config to populate cache
      await Config.get()

      // Save new value
      await Config.save({ defaultProvider: "openai" })

      // Cache should be cleared, next get should reflect saved value
      const config = await Config.get()
      expect(config.defaultProvider).toBe("openai")
    })

    test("creates config directory if it does not exist", async () => {
      // Remove the test home directory
      await fs.rm(testHomeDir, { recursive: true, force: true })

      // Save should create the directory
      await Config.save({ defaultProvider: "openai" })

      // Verify file was created
      const globalConfigPath = path.join(testHomeDir, "config.json")
      const exists = await fs.access(globalConfigPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })
  })

  describe("precedence", () => {
    test("project config overrides global config", async () => {
      // Create a project directory
      const projectDir = path.join(testHomeDir, "project")
      await fs.mkdir(projectDir, { recursive: true })

      // Create global config
      const globalConfigPath = path.join(testHomeDir, "config.json")
      await fs.writeFile(
        globalConfigPath,
        JSON.stringify({ defaultProvider: "anthropic", theme: "dark" })
      )

      // Create project config in the project directory
      const projectConfigPath = path.join(projectDir, "dadgpt.config.json")
      await fs.writeFile(
        projectConfigPath,
        JSON.stringify({ defaultProvider: "openai" })
      )

      // Change to project directory
      process.chdir(projectDir)

      // Invalidate to pick up new cwd
      Config.invalidate()

      const config = await Config.get()

      // Project config should override global config
      expect(config.defaultProvider).toBe("openai")
      // Global value still applied for non-overridden fields
      expect(config.theme).toBe("dark")
    })

    test("full precedence chain: defaults < global < project < env", async () => {
      // Create a project directory
      const projectDir = path.join(testHomeDir, "project")
      await fs.mkdir(projectDir, { recursive: true })

      // Create global config (overrides defaults)
      const globalConfigPath = path.join(testHomeDir, "config.json")
      await fs.writeFile(
        globalConfigPath,
        JSON.stringify({
          defaultProvider: "from-global",
          defaultModel: "from-global",
          theme: "light",
        })
      )

      // Create project config (overrides global)
      const projectConfigPath = path.join(projectDir, "dadgpt.config.json")
      await fs.writeFile(
        projectConfigPath,
        JSON.stringify({
          defaultProvider: "from-project",
          defaultModel: "from-project",
        })
      )

      // Set env vars (overrides project)
      process.env.DADGPT_PROVIDER = "from-env"

      // Change to project directory
      process.chdir(projectDir)

      // Invalidate to pick up new cwd
      Config.invalidate()

      const config = await Config.get()

      // Env var takes precedence for defaultProvider
      expect(config.defaultProvider).toBe("from-env")
      // Project config takes precedence for defaultModel (no env override)
      expect(config.defaultModel).toBe("from-project")
      // Global config applies for theme (not in project or env)
      expect(config.theme).toBe("light")
      // Defaults apply for goalCategories (not in any override)
      expect(config.goalCategories).toEqual(DEFAULT_CONFIG.goalCategories)
    })
  })
})
