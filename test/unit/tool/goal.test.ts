import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import { GoalTool } from "../../../src/tool/goal"
import { Storage } from "../../../src/storage/storage"
import { Bus } from "../../../src/bus/bus"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import type { ToolContext } from "../../../src/tool/types"

describe("Goal Tool", () => {
  let testDir: string
  const mockCtx: ToolContext = { sessionId: "test-session" }

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = path.join(
      os.tmpdir(),
      `dadgpt-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    await fs.mkdir(testDir, { recursive: true })
    // Override DATA_DIR for tests
    process.env.DADGPT_DATA_DIR = testDir
    // Clear bus handlers between tests
    Bus.clear()
  })

  afterEach(async () => {
    // Clean up test directory
    delete process.env.DADGPT_DATA_DIR
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe("create action", () => {
    test("create goal with required fields", async () => {
      const result = await GoalTool.execute(
        { action: "create", title: "Test Goal" },
        mockCtx
      )

      expect(result.title).toBe("Goal Created")
      expect(result.output).toContain("Test Goal")
      expect(result.metadata?.goalId).toBeDefined()

      // Verify goal was persisted
      const goals = await Storage.list(["goals"])
      expect(goals.length).toBe(1)
    })

    test("create goal with all fields", async () => {
      const result = await GoalTool.execute(
        {
          action: "create",
          title: "Complete Goal",
          category: "Health",
          description: "A detailed description",
          dueDate: "2025-12-31",
          milestones: [{ title: "Milestone 1" }, { title: "Milestone 2" }],
        },
        mockCtx
      )

      expect(result.title).toBe("Goal Created")
      expect(result.metadata?.goalId).toBeDefined()

      // Verify all fields persisted correctly
      const goalId = result.metadata?.goalId as string
      const goal = await Storage.read<{
        title: string
        category: string
        description: string
        dueDate: string
        milestones: { id: string; title: string; completed: boolean }[]
        state: string
      }>(["goals", goalId])

      expect(goal?.title).toBe("Complete Goal")
      expect(goal?.category).toBe("Health")
      expect(goal?.description).toBe("A detailed description")
      expect(goal?.dueDate).toBe("2025-12-31")
      expect(goal?.milestones).toHaveLength(2)
      expect(goal?.milestones[0].title).toBe("Milestone 1")
      expect(goal?.milestones[0].completed).toBe(false)
      expect(goal?.state).toBe("not_started")
    })

    test("create goal publishes event", async () => {
      const handler = vi.fn()
      Bus.subscribe("goal.created", handler)

      await GoalTool.execute(
        { action: "create", title: "Event Test" },
        mockCtx
      )

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ goalId: expect.any(String) })
      )
    })

    test("create goal without title returns error", async () => {
      const result = await GoalTool.execute({ action: "create" }, mockCtx)

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Title is required")
    })
  })

  describe("list action", () => {
    test("list all goals", async () => {
      // Create some test goals
      await GoalTool.execute(
        { action: "create", title: "Goal 1", category: "Work" },
        mockCtx
      )
      await GoalTool.execute(
        { action: "create", title: "Goal 2", category: "Health" },
        mockCtx
      )

      const result = await GoalTool.execute({ action: "list" }, mockCtx)

      expect(result.title).toBe("Goals")
      expect(result.output).toContain("Goal 1")
      expect(result.output).toContain("Goal 2")
      expect(result.metadata?.count).toBe(2)
    })

    test("list filters by category", async () => {
      await GoalTool.execute(
        { action: "create", title: "Work Goal", category: "Work" },
        mockCtx
      )
      await GoalTool.execute(
        { action: "create", title: "Health Goal", category: "Health" },
        mockCtx
      )

      const result = await GoalTool.execute(
        { action: "list", categoryFilter: "Work" },
        mockCtx
      )

      expect(result.output).toContain("Work Goal")
      expect(result.output).not.toContain("Health Goal")
      expect(result.metadata?.count).toBe(1)
    })

    test("list filters by status", async () => {
      // Create and start one goal
      const createResult = await GoalTool.execute(
        { action: "create", title: "Started Goal" },
        mockCtx
      )
      const startedId = createResult.metadata?.goalId as string
      await GoalTool.execute(
        { action: "transition", id: startedId, event: "START" },
        mockCtx
      )

      // Create another that remains not_started
      await GoalTool.execute(
        { action: "create", title: "Pending Goal" },
        mockCtx
      )

      const result = await GoalTool.execute(
        { action: "list", statusFilter: "in_progress" },
        mockCtx
      )

      expect(result.output).toContain("Started Goal")
      expect(result.output).not.toContain("Pending Goal")
      expect(result.metadata?.count).toBe(1)
    })

    test("list returns empty message when no goals", async () => {
      const result = await GoalTool.execute({ action: "list" }, mockCtx)

      expect(result.output).toBe("No goals found.")
      expect(result.metadata?.count).toBe(0)
    })
  })

  describe("get action", () => {
    test("get goal by ID", async () => {
      const createResult = await GoalTool.execute(
        {
          action: "create",
          title: "Detailed Goal",
          category: "Finance",
          description: "Test description",
        },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      const result = await GoalTool.execute(
        { action: "get", id: goalId },
        mockCtx
      )

      expect(result.title).toBe("Goal: Detailed Goal")
      expect(result.output).toContain("Title: Detailed Goal")
      expect(result.output).toContain("Category: Finance")
      expect(result.output).toContain("Status: not_started")
      expect(result.output).toContain("Description: Test description")
    })

    test("get goal with milestones", async () => {
      const createResult = await GoalTool.execute(
        {
          action: "create",
          title: "Goal with Milestones",
          milestones: [{ title: "First Step" }, { title: "Second Step" }],
        },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      const result = await GoalTool.execute(
        { action: "get", id: goalId },
        mockCtx
      )

      expect(result.output).toContain("Milestones:")
      expect(result.output).toContain("[ ] First Step")
      expect(result.output).toContain("[ ] Second Step")
    })

    test("get non-existent goal returns error", async () => {
      const result = await GoalTool.execute(
        { action: "get", id: "nonexistent-id" },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Goal not found")
    })

    test("get without ID returns error", async () => {
      const result = await GoalTool.execute({ action: "get" }, mockCtx)

      expect(result.title).toBe("Error")
      expect(result.output).toContain("ID is required")
    })
  })

  describe("transition action", () => {
    test("transition through states", async () => {
      const createResult = await GoalTool.execute(
        { action: "create", title: "State Test" },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      // START: not_started -> in_progress
      let result = await GoalTool.execute(
        { action: "transition", id: goalId, event: "START" },
        mockCtx
      )
      expect(result.output).toContain("not_started to in_progress")

      // PAUSE: in_progress -> paused
      result = await GoalTool.execute(
        { action: "transition", id: goalId, event: "PAUSE" },
        mockCtx
      )
      expect(result.output).toContain("in_progress to paused")

      // RESUME: paused -> in_progress
      result = await GoalTool.execute(
        { action: "transition", id: goalId, event: "RESUME" },
        mockCtx
      )
      expect(result.output).toContain("paused to in_progress")

      // COMPLETE: in_progress -> completed
      result = await GoalTool.execute(
        { action: "transition", id: goalId, event: "COMPLETE" },
        mockCtx
      )
      expect(result.output).toContain("in_progress to completed")
    })

    test("transition publishes goal.completed event", async () => {
      const handler = vi.fn()
      Bus.subscribe("goal.completed", handler)

      const createResult = await GoalTool.execute(
        { action: "create", title: "Complete Event Test" },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      // Start then complete
      await GoalTool.execute(
        { action: "transition", id: goalId, event: "START" },
        mockCtx
      )
      await GoalTool.execute(
        { action: "transition", id: goalId, event: "COMPLETE" },
        mockCtx
      )

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ goalId })
    })

    test("cannot transition from final state", async () => {
      const createResult = await GoalTool.execute(
        { action: "create", title: "Final State Test" },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      // Complete the goal
      await GoalTool.execute(
        { action: "transition", id: goalId, event: "START" },
        mockCtx
      )
      await GoalTool.execute(
        { action: "transition", id: goalId, event: "COMPLETE" },
        mockCtx
      )

      // Try to transition from completed
      const result = await GoalTool.execute(
        { action: "transition", id: goalId, event: "START" },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Cannot transition goal in final state")
    })

    test("transition without event returns error", async () => {
      const createResult = await GoalTool.execute(
        { action: "create", title: "Event Error Test" },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      const result = await GoalTool.execute(
        { action: "transition", id: goalId },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Event is required")
    })

    test("COMPLETE_MILESTONE requires milestoneId", async () => {
      const createResult = await GoalTool.execute(
        {
          action: "create",
          title: "Milestone Error Test",
          milestones: [{ title: "Test Milestone" }],
        },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      // Start the goal first
      await GoalTool.execute(
        { action: "transition", id: goalId, event: "START" },
        mockCtx
      )

      const result = await GoalTool.execute(
        { action: "transition", id: goalId, event: "COMPLETE_MILESTONE" },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("milestoneId is required")
    })

    test("COMPLETE_MILESTONE marks milestone as completed", async () => {
      const createResult = await GoalTool.execute(
        {
          action: "create",
          title: "Milestone Complete Test",
          milestones: [{ title: "Test Milestone" }],
        },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      // Start the goal first
      await GoalTool.execute(
        { action: "transition", id: goalId, event: "START" },
        mockCtx
      )

      // Get the milestone ID
      const getResult = await GoalTool.execute(
        { action: "get", id: goalId },
        mockCtx
      )
      const goal = getResult.metadata?.goal as {
        milestones: { id: string; completed: boolean }[]
      }
      const milestoneId = goal.milestones[0].id

      // Complete the milestone
      await GoalTool.execute(
        {
          action: "transition",
          id: goalId,
          event: "COMPLETE_MILESTONE",
          milestoneId,
        },
        mockCtx
      )

      // Verify milestone is completed
      const updatedResult = await GoalTool.execute(
        { action: "get", id: goalId },
        mockCtx
      )
      expect(updatedResult.output).toContain("[x] Test Milestone")
    })

    test("ABANDON transitions to abandoned state", async () => {
      const createResult = await GoalTool.execute(
        { action: "create", title: "Abandon Test" },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      const result = await GoalTool.execute(
        { action: "transition", id: goalId, event: "ABANDON" },
        mockCtx
      )

      expect(result.output).toContain("not_started to abandoned")
    })
  })

  describe("update action", () => {
    test("update goal title", async () => {
      const createResult = await GoalTool.execute(
        { action: "create", title: "Original Title" },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      const result = await GoalTool.execute(
        { action: "update", id: goalId, title: "Updated Title" },
        mockCtx
      )

      expect(result.title).toBe("Goal Updated")
      expect(result.output).toContain("title")

      // Verify persisted
      const getResult = await GoalTool.execute(
        { action: "get", id: goalId },
        mockCtx
      )
      expect(getResult.output).toContain("Title: Updated Title")
    })

    test("update goal description", async () => {
      const createResult = await GoalTool.execute(
        { action: "create", title: "Description Test" },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      await GoalTool.execute(
        { action: "update", id: goalId, description: "New description" },
        mockCtx
      )

      const getResult = await GoalTool.execute(
        { action: "get", id: goalId },
        mockCtx
      )
      expect(getResult.output).toContain("Description: New description")
    })

    test("update goal progress", async () => {
      const createResult = await GoalTool.execute(
        { action: "create", title: "Progress Test" },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      // Start goal to allow progress updates
      await GoalTool.execute(
        { action: "transition", id: goalId, event: "START" },
        mockCtx
      )

      await GoalTool.execute(
        { action: "update", id: goalId, progress: 50 },
        mockCtx
      )

      const getResult = await GoalTool.execute(
        { action: "get", id: goalId },
        mockCtx
      )
      expect(getResult.output).toContain("Progress: 50%")
    })

    test("update publishes event", async () => {
      const handler = vi.fn()
      Bus.subscribe("goal.updated", handler)

      const createResult = await GoalTool.execute(
        { action: "create", title: "Update Event Test" },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      await GoalTool.execute(
        { action: "update", id: goalId, title: "Changed" },
        mockCtx
      )

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          goalId,
          changes: expect.objectContaining({ title: "Changed" }),
        })
      )
    })

    test("update without changes returns no changes message", async () => {
      const createResult = await GoalTool.execute(
        { action: "create", title: "No Change Test" },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      const result = await GoalTool.execute(
        { action: "update", id: goalId },
        mockCtx
      )

      expect(result.title).toBe("No Changes")
    })
  })

  describe("delete action", () => {
    test("delete goal", async () => {
      const createResult = await GoalTool.execute(
        { action: "create", title: "To Delete" },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      const result = await GoalTool.execute(
        { action: "delete", id: goalId },
        mockCtx
      )

      expect(result.title).toBe("Goal Deleted")
      expect(result.output).toContain("To Delete")

      // Verify it's gone
      const getResult = await GoalTool.execute(
        { action: "get", id: goalId },
        mockCtx
      )
      expect(getResult.title).toBe("Error")
      expect(getResult.output).toContain("Goal not found")
    })

    test("delete publishes event", async () => {
      const handler = vi.fn()
      Bus.subscribe("goal.deleted", handler)

      const createResult = await GoalTool.execute(
        { action: "create", title: "Delete Event Test" },
        mockCtx
      )
      const goalId = createResult.metadata?.goalId as string

      await GoalTool.execute({ action: "delete", id: goalId }, mockCtx)

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ goalId })
    })

    test("delete non-existent goal returns error", async () => {
      const result = await GoalTool.execute(
        { action: "delete", id: "nonexistent-id" },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Goal not found")
    })

    test("delete without ID returns error", async () => {
      const result = await GoalTool.execute({ action: "delete" }, mockCtx)

      expect(result.title).toBe("Error")
      expect(result.output).toContain("ID is required")
    })
  })
})
