import { describe, test, expect, beforeEach, afterEach } from "vitest"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { Permission } from "../../src/permission/permission"
import {
  matchesPattern,
  matchesAnyPattern,
  evaluateRules,
  DEFAULT_RULES,
} from "../../src/permission/rules"
import { Config } from "../../src/config/config"

describe("Permission Rules", () => {
  describe("matchesPattern", () => {
    test("exact match works", () => {
      expect(matchesPattern("goal", "goal")).toBe(true)
      expect(matchesPattern("goal", "todo")).toBe(false)
    })

    test("wildcard * matches everything", () => {
      expect(matchesPattern("goal", "*")).toBe(true)
      expect(matchesPattern("todo", "*")).toBe(true)
      expect(matchesPattern("any.thing.at.all", "*")).toBe(true)
    })

    test("prefix wildcard .* matches prefix", () => {
      expect(matchesPattern("file.read", "file.*")).toBe(true)
      expect(matchesPattern("file.write", "file.*")).toBe(true)
      expect(matchesPattern("file", "file.*")).toBe(true)
      expect(matchesPattern("other.read", "file.*")).toBe(false)
    })

    test("prefix wildcard does not match unrelated tools", () => {
      expect(matchesPattern("files", "file.*")).toBe(false)
      expect(matchesPattern("myfile.read", "file.*")).toBe(false)
    })
  })

  describe("matchesAnyPattern", () => {
    test("returns true if any pattern matches", () => {
      expect(matchesAnyPattern("goal", ["todo", "goal", "project"])).toBe(true)
      expect(matchesAnyPattern("file.read", ["file.*", "bash"])).toBe(true)
    })

    test("returns false if no pattern matches", () => {
      expect(matchesAnyPattern("bash", ["goal", "todo", "project"])).toBe(false)
    })

    test("handles empty array", () => {
      expect(matchesAnyPattern("goal", [])).toBe(false)
    })
  })

  describe("evaluateRules", () => {
    test("deny takes highest priority", () => {
      const result = evaluateRules("bash", undefined, {
        allow: ["bash"],
        deny: ["bash"],
        ask: ["bash"],
      })
      expect(result).toBe("deny")
    })

    test("allow takes second priority", () => {
      const result = evaluateRules("goal", undefined, {
        allow: ["goal"],
        deny: [],
        ask: ["goal"],
      })
      expect(result).toBe("allow")
    })

    test("ask takes third priority", () => {
      const result = evaluateRules("write", undefined, {
        allow: [],
        deny: [],
        ask: ["write"],
      })
      expect(result).toBe("ask")
    })

    test("defaults to ask when nothing matches", () => {
      const result = evaluateRules("unknown", undefined, {
        allow: [],
        deny: [],
        ask: [],
      })
      expect(result).toBe("ask")
    })

    test("works with wildcard in ask", () => {
      const result = evaluateRules("anything", undefined, {
        allow: [],
        deny: [],
        ask: ["*"],
      })
      expect(result).toBe("ask")
    })

    test("default rules allow read operations", () => {
      expect(evaluateRules("read", undefined, DEFAULT_RULES)).toBe("allow")
      expect(evaluateRules("goal", undefined, DEFAULT_RULES)).toBe("allow")
      expect(evaluateRules("todo", undefined, DEFAULT_RULES)).toBe("allow")
      expect(evaluateRules("project", undefined, DEFAULT_RULES)).toBe("allow")
      expect(evaluateRules("family", undefined, DEFAULT_RULES)).toBe("allow")
    })

    test("default rules ask for write and bash", () => {
      expect(evaluateRules("write", undefined, DEFAULT_RULES)).toBe("ask")
      expect(evaluateRules("bash", undefined, DEFAULT_RULES)).toBe("ask")
    })
  })
})

describe("Permission namespace", () => {
  let testDir: string
  let originalHome: string | undefined
  let originalDataDir: string | undefined

  beforeEach(async () => {
    // Create unique temp directory
    const random = Math.random().toString(36).substring(2, 15)
    testDir = path.join(
      os.tmpdir(),
      `dadgpt-permission-test-${Date.now()}-${random}`
    )
    await fs.mkdir(testDir, { recursive: true })

    // Store original env vars
    originalHome = process.env.DADGPT_HOME
    originalDataDir = process.env.DADGPT_DATA_DIR

    // Override for testing
    process.env.DADGPT_HOME = testDir
    process.env.DADGPT_DATA_DIR = path.join(testDir, "data")

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

    // Clear config cache
    Config.invalidate()

    // Clean up temp directory
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("check()", () => {
    test("uses provided ruleset directly", async () => {
      const result = await Permission.check("custom", undefined, {
        allow: ["custom"],
        deny: [],
        ask: [],
      })
      expect(result).toBe("allow")
    })

    test("loads rules from config when no ruleset provided", async () => {
      // Write config with custom rules
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          permissions: {
            allow: ["myTool"],
            deny: ["badTool"],
            ask: [],
          },
        })
      )

      const allowResult = await Permission.check("myTool", undefined)
      expect(allowResult).toBe("allow")

      const denyResult = await Permission.check("badTool", undefined)
      expect(denyResult).toBe("deny")
    })

    test("uses default rules when config fails to load", async () => {
      // Write invalid config
      await fs.writeFile(path.join(testDir, "config.json"), "invalid json{")

      // Should fall back to default rules
      const result = await Permission.check("goal", undefined)
      expect(result).toBe("allow") // goal is in default allow list
    })
  })

  describe("checkSync()", () => {
    test("evaluates ruleset synchronously", () => {
      const result = Permission.checkSync("tool", undefined, {
        allow: ["tool"],
        deny: [],
        ask: [],
      })
      expect(result).toBe("allow")
    })
  })

  describe("isAllowed()", () => {
    test("returns true when decision is allow", async () => {
      // Write config
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          permissions: { allow: ["myTool"], deny: [], ask: [] },
        })
      )

      const result = await Permission.isAllowed("myTool")
      expect(result).toBe(true)
    })

    test("returns false when decision is not allow", async () => {
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          permissions: { allow: [], deny: ["myTool"], ask: [] },
        })
      )

      const result = await Permission.isAllowed("myTool")
      expect(result).toBe(false)
    })
  })

  describe("isDenied()", () => {
    test("returns true when decision is deny", async () => {
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          permissions: { allow: [], deny: ["badTool"], ask: [] },
        })
      )

      const result = await Permission.isDenied("badTool")
      expect(result).toBe(true)
    })

    test("returns false when decision is not deny", async () => {
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          permissions: { allow: ["goodTool"], deny: [], ask: [] },
        })
      )

      const result = await Permission.isDenied("goodTool")
      expect(result).toBe(false)
    })
  })

  describe("requiresPermission()", () => {
    test("returns true when decision is ask", async () => {
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          permissions: { allow: [], deny: [], ask: ["askTool"] },
        })
      )

      const result = await Permission.requiresPermission("askTool")
      expect(result).toBe(true)
    })

    test("returns false when decision is not ask", async () => {
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          permissions: { allow: ["allowedTool"], deny: [], ask: [] },
        })
      )

      const result = await Permission.requiresPermission("allowedTool")
      expect(result).toBe(false)
    })
  })
})
