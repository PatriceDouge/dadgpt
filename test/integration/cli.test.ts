/**
 * CLI Integration Tests
 *
 * Tests the CLI commands by running them via execa and verifying outputs.
 * Uses temporary directories for isolation.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { execa } from "execa"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"

// Get the project root directory (where this test runs from)
const PROJECT_ROOT = path.resolve(__dirname, "../..")

describe("CLI Integration", () => {
  let testDir: string
  let dataDir: string
  let homeDir: string

  beforeEach(async () => {
    // Create unique temporary directories for each test
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    testDir = path.join(os.tmpdir(), `dadgpt-cli-test-${uniqueId}`)
    dataDir = path.join(testDir, "data")
    homeDir = path.join(testDir, "home", ".dadgpt")

    await fs.mkdir(testDir, { recursive: true })
    await fs.mkdir(dataDir, { recursive: true })
    await fs.mkdir(homeDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directories
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  /**
   * Run a CLI command with test environment variables.
   * The CLI is executed from the project root, but we can change the
   * working directory for specific commands using the cwd option.
   */
  async function runCli(args: string[], options: { workDir?: string } = {}) {
    // Commands that need to operate in the test directory (like init)
    // use workDir option. Otherwise, we run from project root.
    const workingDir = options.workDir ?? PROJECT_ROOT

    const result = await execa("npx", ["tsx", path.join(PROJECT_ROOT, "src/index.ts"), ...args], {
      cwd: workingDir,
      env: {
        ...process.env,
        DADGPT_DATA_DIR: dataDir,
        DADGPT_HOME: homeDir,
      },
      reject: false, // Don't throw on non-zero exit codes
    })
    return result
  }

  describe("init command", () => {
    test("creates dadgpt.md file", async () => {
      // Init command needs to run from testDir to create file there
      const result = await runCli(["init"], { workDir: testDir })

      // Check exit code
      expect(result.exitCode).toBe(0)

      // Check that dadgpt.md was created
      const filePath = path.join(testDir, "dadgpt.md")
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false)
      expect(fileExists).toBe(true)

      // Check file content
      const content = await fs.readFile(filePath, "utf-8")
      expect(content).toContain("# DadGPT Configuration")
      expect(content).toContain("## Goals")
      expect(content).toContain("## Todos")

      // Check output message
      expect(result.stdout).toContain("Created dadgpt.md")
    })

    test("warns if dadgpt.md already exists without --force", async () => {
      // Create an existing file
      const filePath = path.join(testDir, "dadgpt.md")
      await fs.writeFile(filePath, "Existing content", "utf-8")

      const result = await runCli(["init"], { workDir: testDir })

      // Should not overwrite
      expect(result.stdout).toContain("already exists")
      const content = await fs.readFile(filePath, "utf-8")
      expect(content).toBe("Existing content")
    })

    test("overwrites with --force flag", async () => {
      // Create an existing file
      const filePath = path.join(testDir, "dadgpt.md")
      await fs.writeFile(filePath, "Existing content", "utf-8")

      const result = await runCli(["init", "--force"], { workDir: testDir })

      // Should overwrite
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Created dadgpt.md")

      const content = await fs.readFile(filePath, "utf-8")
      expect(content).toContain("# DadGPT Configuration")
    })

    test("creates minimal template with -t minimal", async () => {
      const result = await runCli(["init", "-t", "minimal"], { workDir: testDir })

      expect(result.exitCode).toBe(0)

      const filePath = path.join(testDir, "dadgpt.md")
      const content = await fs.readFile(filePath, "utf-8")

      // Minimal template should be shorter
      expect(content).toContain("# DadGPT Configuration")
      expect(content).not.toContain("Welcome to DadGPT!")
    })
  })

  describe("goals command", () => {
    test("shows empty state when no goals exist", async () => {
      const result = await runCli(["goals"])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("No goals found")
    })

    test("outputs valid JSON with --json flag", async () => {
      const result = await runCli(["goals", "--json"])

      expect(result.exitCode).toBe(0)

      // Should be valid JSON (empty array)
      const parsed = JSON.parse(result.stdout)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toEqual([])
    })

    test("lists goals when they exist", async () => {
      // Create a test goal in storage
      const goalId = "test-goal-123"
      const goalDir = path.join(dataDir, "goals")
      await fs.mkdir(goalDir, { recursive: true })
      await fs.writeFile(
        path.join(goalDir, `${goalId}.json`),
        JSON.stringify({
          id: goalId,
          title: "Test Goal for Integration",
          category: "Personal",
          description: "A test goal",
          progress: 50,
          milestones: [],
          dueDate: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          state: "in_progress",
        }),
        "utf-8"
      )

      const result = await runCli(["goals"])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Test Goal for Integration")
      expect(result.stdout).toContain("Personal")
    })

    test("filters by category", async () => {
      // Create goals in different categories
      const goalDir = path.join(dataDir, "goals")
      await fs.mkdir(goalDir, { recursive: true })

      await fs.writeFile(
        path.join(goalDir, "goal-work.json"),
        JSON.stringify({
          id: "goal-work",
          title: "Work Goal",
          category: "Work",
          description: "",
          progress: 25,
          milestones: [],
          dueDate: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          state: "in_progress",
        }),
        "utf-8"
      )

      await fs.writeFile(
        path.join(goalDir, "goal-personal.json"),
        JSON.stringify({
          id: "goal-personal",
          title: "Personal Goal",
          category: "Personal",
          description: "",
          progress: 75,
          milestones: [],
          dueDate: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          state: "in_progress",
        }),
        "utf-8"
      )

      // Filter by Work category
      const result = await runCli(["goals", "-c", "Work"])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Work Goal")
      expect(result.stdout).not.toContain("Personal Goal")
    })

    test("outputs goals as JSON with --json", async () => {
      // Create a test goal
      const goalDir = path.join(dataDir, "goals")
      await fs.mkdir(goalDir, { recursive: true })
      await fs.writeFile(
        path.join(goalDir, "goal-json-test.json"),
        JSON.stringify({
          id: "goal-json-test",
          title: "JSON Test Goal",
          category: "Test",
          description: "Testing JSON output",
          progress: 33,
          milestones: [],
          dueDate: "2025-12-31",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          state: "not_started",
        }),
        "utf-8"
      )

      const result = await runCli(["goals", "--json"])

      expect(result.exitCode).toBe(0)

      const parsed = JSON.parse(result.stdout)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBe(1)
      expect(parsed[0].title).toBe("JSON Test Goal")
      expect(parsed[0].progress).toBe(33)
    })
  })

  describe("todos command", () => {
    test("shows empty state when no todos exist", async () => {
      const result = await runCli(["todos"])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("No todos found")
    })

    test("outputs valid JSON with --json flag", async () => {
      const result = await runCli(["todos", "--json"])

      expect(result.exitCode).toBe(0)

      // Should be valid JSON (empty array)
      const parsed = JSON.parse(result.stdout)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toEqual([])
    })

    test("lists todos when they exist", async () => {
      // Create a test todo in storage
      const todoDir = path.join(dataDir, "todos")
      await fs.mkdir(todoDir, { recursive: true })
      await fs.writeFile(
        path.join(todoDir, "todo-test-123.json"),
        JSON.stringify({
          id: "todo-test-123",
          title: "Test Todo for Integration",
          description: "A test todo",
          priority: "high",
          dueDate: null,
          tags: ["testing"],
          goalId: null,
          blockedBy: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: null,
          state: "pending",
        }),
        "utf-8"
      )

      const result = await runCli(["todos"])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Test Todo for Integration")
      expect(result.stdout).toContain("testing")
    })

    test("filters by priority", async () => {
      // Create todos with different priorities
      const todoDir = path.join(dataDir, "todos")
      await fs.mkdir(todoDir, { recursive: true })

      await fs.writeFile(
        path.join(todoDir, "todo-high.json"),
        JSON.stringify({
          id: "todo-high",
          title: "High Priority Todo",
          description: "",
          priority: "high",
          dueDate: null,
          tags: [],
          goalId: null,
          blockedBy: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: null,
          state: "pending",
        }),
        "utf-8"
      )

      await fs.writeFile(
        path.join(todoDir, "todo-low.json"),
        JSON.stringify({
          id: "todo-low",
          title: "Low Priority Todo",
          description: "",
          priority: "low",
          dueDate: null,
          tags: [],
          goalId: null,
          blockedBy: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: null,
          state: "pending",
        }),
        "utf-8"
      )

      // Filter by high priority
      const result = await runCli(["todos", "-p", "high"])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("High Priority Todo")
      expect(result.stdout).not.toContain("Low Priority Todo")
    })

    test("outputs todos as JSON with --json", async () => {
      // Create a test todo
      const todoDir = path.join(dataDir, "todos")
      await fs.mkdir(todoDir, { recursive: true })
      await fs.writeFile(
        path.join(todoDir, "todo-json-test.json"),
        JSON.stringify({
          id: "todo-json-test",
          title: "JSON Test Todo",
          description: "Testing JSON output",
          priority: "medium",
          dueDate: "2025-06-15",
          tags: ["test", "json"],
          goalId: null,
          blockedBy: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: null,
          state: "in_progress",
        }),
        "utf-8"
      )

      const result = await runCli(["todos", "--json"])

      expect(result.exitCode).toBe(0)

      const parsed = JSON.parse(result.stdout)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBe(1)
      expect(parsed[0].title).toBe("JSON Test Todo")
      expect(parsed[0].tags).toContain("test")
      expect(parsed[0].tags).toContain("json")
    })
  })

  describe("help command", () => {
    test("shows help information", async () => {
      const result = await runCli(["--help"])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("dadgpt")
      expect(result.stdout).toContain("init")
      expect(result.stdout).toContain("goals")
      expect(result.stdout).toContain("todos")
    })
  })
})
