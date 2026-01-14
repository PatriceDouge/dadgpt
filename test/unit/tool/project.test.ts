import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import { ProjectTool } from "../../../src/tool/project"
import { Storage } from "../../../src/storage/storage"
import { Bus } from "../../../src/bus/bus"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import type { ToolContext } from "../../../src/tool/types"

describe("Project Tool", () => {
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
    test("create project with required fields", async () => {
      const result = await ProjectTool.execute(
        { action: "create", name: "Test Project" },
        mockCtx
      )

      expect(result.title).toBe("Project Created")
      expect(result.output).toContain("Test Project")
      expect(result.metadata?.projectId).toBeDefined()

      // Verify project was persisted
      const projects = await Storage.list(["projects"])
      expect(projects.length).toBe(1)
    })

    test("create project with all fields", async () => {
      const result = await ProjectTool.execute(
        {
          action: "create",
          name: "Complete Project",
          description: "A detailed description",
          budget: 5000,
          goalId: "goal_123",
        },
        mockCtx
      )

      expect(result.title).toBe("Project Created")
      expect(result.metadata?.projectId).toBeDefined()

      // Verify all fields persisted correctly
      const projectId = result.metadata?.projectId as string
      const project = await Storage.read<{
        name: string
        description: string
        budget: number
        goalId: string
        state: string
        milestones: unknown[]
      }>(["projects", projectId])

      expect(project?.name).toBe("Complete Project")
      expect(project?.description).toBe("A detailed description")
      expect(project?.budget).toBe(5000)
      expect(project?.goalId).toBe("goal_123")
      expect(project?.state).toBe("planning")
      expect(project?.milestones).toEqual([])
    })

    test("create project publishes event", async () => {
      const handler = vi.fn()
      Bus.subscribe("project.created", handler)

      await ProjectTool.execute(
        { action: "create", name: "Event Test" },
        mockCtx
      )

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: expect.any(String) })
      )
    })

    test("create project without name returns error", async () => {
      const result = await ProjectTool.execute({ action: "create" }, mockCtx)

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Name is required")
    })
  })

  describe("list action", () => {
    test("list all projects", async () => {
      // Create some test projects
      await ProjectTool.execute(
        { action: "create", name: "Project 1" },
        mockCtx
      )
      await ProjectTool.execute(
        { action: "create", name: "Project 2" },
        mockCtx
      )

      const result = await ProjectTool.execute({ action: "list" }, mockCtx)

      expect(result.title).toBe("Projects")
      expect(result.output).toContain("Project 1")
      expect(result.output).toContain("Project 2")
      expect(result.metadata?.count).toBe(2)
    })

    test("list filters by status", async () => {
      // Create and start one project
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Started Project" },
        mockCtx
      )
      const startedId = createResult.metadata?.projectId as string
      await ProjectTool.execute(
        { action: "transition", id: startedId, event: "START" },
        mockCtx
      )

      // Create another that remains in planning
      await ProjectTool.execute(
        { action: "create", name: "Planning Project" },
        mockCtx
      )

      const result = await ProjectTool.execute(
        { action: "list", statusFilter: "active" },
        mockCtx
      )

      expect(result.output).toContain("Started Project")
      expect(result.output).not.toContain("Planning Project")
      expect(result.metadata?.count).toBe(1)
    })

    test("list returns empty message when no projects", async () => {
      const result = await ProjectTool.execute({ action: "list" }, mockCtx)

      expect(result.output).toBe("No projects found.")
      expect(result.metadata?.count).toBe(0)
    })

    test("list shows budget when present", async () => {
      await ProjectTool.execute(
        { action: "create", name: "Budget Project", budget: 10000 },
        mockCtx
      )

      const result = await ProjectTool.execute({ action: "list" }, mockCtx)

      expect(result.output).toContain("Budget: $10000")
    })

    test("list shows milestone progress", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Milestone Project" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      // Add milestones
      await ProjectTool.execute(
        { action: "addMilestone", id: projectId, milestoneTitle: "M1" },
        mockCtx
      )
      await ProjectTool.execute(
        { action: "addMilestone", id: projectId, milestoneTitle: "M2" },
        mockCtx
      )

      const result = await ProjectTool.execute({ action: "list" }, mockCtx)

      expect(result.output).toContain("0/2 milestones")
    })
  })

  describe("get action", () => {
    test("get project by ID", async () => {
      const createResult = await ProjectTool.execute(
        {
          action: "create",
          name: "Detailed Project",
          description: "Test description",
          budget: 5000,
        },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      const result = await ProjectTool.execute(
        { action: "get", id: projectId },
        mockCtx
      )

      expect(result.title).toBe("Project: Detailed Project")
      expect(result.output).toContain("Name: Detailed Project")
      expect(result.output).toContain("Status: planning")
      expect(result.output).toContain("Description: Test description")
      expect(result.output).toContain("Budget: $5000")
    })

    test("get project with milestones", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Project with Milestones" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      // Add milestones
      await ProjectTool.execute(
        { action: "addMilestone", id: projectId, milestoneTitle: "First Step", milestoneDueDate: "2025-06-01" },
        mockCtx
      )
      await ProjectTool.execute(
        { action: "addMilestone", id: projectId, milestoneTitle: "Second Step" },
        mockCtx
      )

      const result = await ProjectTool.execute(
        { action: "get", id: projectId },
        mockCtx
      )

      expect(result.output).toContain("Milestones:")
      expect(result.output).toContain("[ ] First Step")
      expect(result.output).toContain("(Due: 2025-06-01)")
      expect(result.output).toContain("[ ] Second Step")
    })

    test("get non-existent project returns error", async () => {
      const result = await ProjectTool.execute(
        { action: "get", id: "nonexistent-id" },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Project not found")
    })

    test("get without ID returns error", async () => {
      const result = await ProjectTool.execute({ action: "get" }, mockCtx)

      expect(result.title).toBe("Error")
      expect(result.output).toContain("ID is required")
    })
  })

  describe("addMilestone action", () => {
    test("add milestone to project", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Milestone Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      const result = await ProjectTool.execute(
        { action: "addMilestone", id: projectId, milestoneTitle: "New Milestone" },
        mockCtx
      )

      expect(result.title).toBe("Milestone Added")
      expect(result.output).toContain("New Milestone")
      expect(result.metadata?.milestoneId).toBeDefined()

      // Verify milestone was added
      const getResult = await ProjectTool.execute(
        { action: "get", id: projectId },
        mockCtx
      )
      expect(getResult.output).toContain("New Milestone")
    })

    test("add milestone with due date", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Milestone Date Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      await ProjectTool.execute(
        { action: "addMilestone", id: projectId, milestoneTitle: "Dated Milestone", milestoneDueDate: "2025-12-31" },
        mockCtx
      )

      const getResult = await ProjectTool.execute(
        { action: "get", id: projectId },
        mockCtx
      )
      expect(getResult.output).toContain("(Due: 2025-12-31)")
    })

    test("cannot add milestone to completed project", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Complete Project" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      // Complete the project
      await ProjectTool.execute(
        { action: "transition", id: projectId, event: "START" },
        mockCtx
      )
      await ProjectTool.execute(
        { action: "transition", id: projectId, event: "COMPLETE" },
        mockCtx
      )

      const result = await ProjectTool.execute(
        { action: "addMilestone", id: projectId, milestoneTitle: "Late Milestone" },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Cannot add milestone to project in final state")
    })

    test("add milestone without title returns error", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Error Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      const result = await ProjectTool.execute(
        { action: "addMilestone", id: projectId },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("milestoneTitle is required")
    })
  })

  describe("transition action", () => {
    test("transition through states", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "State Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      // START: planning -> active
      let result = await ProjectTool.execute(
        { action: "transition", id: projectId, event: "START" },
        mockCtx
      )
      expect(result.output).toContain("planning to active")

      // PAUSE: active -> on_hold
      result = await ProjectTool.execute(
        { action: "transition", id: projectId, event: "PAUSE" },
        mockCtx
      )
      expect(result.output).toContain("active to on_hold")

      // RESUME: on_hold -> active
      result = await ProjectTool.execute(
        { action: "transition", id: projectId, event: "RESUME" },
        mockCtx
      )
      expect(result.output).toContain("on_hold to active")

      // COMPLETE: active -> completed
      result = await ProjectTool.execute(
        { action: "transition", id: projectId, event: "COMPLETE" },
        mockCtx
      )
      expect(result.output).toContain("active to completed")
    })

    test("transition publishes project.completed event", async () => {
      const handler = vi.fn()
      Bus.subscribe("project.completed", handler)

      const createResult = await ProjectTool.execute(
        { action: "create", name: "Complete Event Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      // Start then complete
      await ProjectTool.execute(
        { action: "transition", id: projectId, event: "START" },
        mockCtx
      )
      await ProjectTool.execute(
        { action: "transition", id: projectId, event: "COMPLETE" },
        mockCtx
      )

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ projectId })
    })

    test("cannot transition from final state", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Final State Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      // Complete the project
      await ProjectTool.execute(
        { action: "transition", id: projectId, event: "START" },
        mockCtx
      )
      await ProjectTool.execute(
        { action: "transition", id: projectId, event: "COMPLETE" },
        mockCtx
      )

      // Try to transition from completed
      const result = await ProjectTool.execute(
        { action: "transition", id: projectId, event: "START" },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Cannot transition project in final state")
    })

    test("COMPLETE_MILESTONE marks milestone as completed", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Milestone Complete Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      // Start the project
      await ProjectTool.execute(
        { action: "transition", id: projectId, event: "START" },
        mockCtx
      )

      // Add a milestone
      const milestoneResult = await ProjectTool.execute(
        { action: "addMilestone", id: projectId, milestoneTitle: "Test Milestone" },
        mockCtx
      )
      const milestoneId = milestoneResult.metadata?.milestoneId as string

      // Complete the milestone
      await ProjectTool.execute(
        {
          action: "transition",
          id: projectId,
          event: "COMPLETE_MILESTONE",
          milestoneId,
        },
        mockCtx
      )

      // Verify milestone is completed
      const getResult = await ProjectTool.execute(
        { action: "get", id: projectId },
        mockCtx
      )
      expect(getResult.output).toContain("[x] Test Milestone")
    })

    test("COMPLETE_MILESTONE requires milestoneId", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Milestone Error Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      // Start the project first
      await ProjectTool.execute(
        { action: "transition", id: projectId, event: "START" },
        mockCtx
      )

      const result = await ProjectTool.execute(
        { action: "transition", id: projectId, event: "COMPLETE_MILESTONE" },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("milestoneId is required")
    })

    test("transition without event returns error", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Event Error Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      const result = await ProjectTool.execute(
        { action: "transition", id: projectId },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Event is required")
    })

    test("invalid transition returns no change", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Invalid Transition" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      // Try to PAUSE from planning (invalid - must be in active first)
      const result = await ProjectTool.execute(
        { action: "transition", id: projectId, event: "PAUSE" },
        mockCtx
      )

      expect(result.title).toBe("No Change")
      expect(result.output).toContain("not valid from state planning")
    })

    test("CANCEL transitions to cancelled state", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Cancel Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      const result = await ProjectTool.execute(
        { action: "transition", id: projectId, event: "CANCEL" },
        mockCtx
      )

      expect(result.output).toContain("planning to cancelled")
    })
  })

  describe("update action", () => {
    test("update project name", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Original Name" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      const result = await ProjectTool.execute(
        { action: "update", id: projectId, name: "Updated Name" },
        mockCtx
      )

      expect(result.title).toBe("Project Updated")
      expect(result.output).toContain("name")

      // Verify persisted
      const getResult = await ProjectTool.execute(
        { action: "get", id: projectId },
        mockCtx
      )
      expect(getResult.output).toContain("Name: Updated Name")
    })

    test("update project description", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Description Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      await ProjectTool.execute(
        { action: "update", id: projectId, description: "New description" },
        mockCtx
      )

      const getResult = await ProjectTool.execute(
        { action: "get", id: projectId },
        mockCtx
      )
      expect(getResult.output).toContain("Description: New description")
    })

    test("update project budget", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "Budget Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      await ProjectTool.execute(
        { action: "update", id: projectId, budget: 15000 },
        mockCtx
      )

      const getResult = await ProjectTool.execute(
        { action: "get", id: projectId },
        mockCtx
      )
      expect(getResult.output).toContain("Budget: $15000")
    })

    test("update publishes event", async () => {
      const handler = vi.fn()
      Bus.subscribe("project.updated", handler)

      const createResult = await ProjectTool.execute(
        { action: "create", name: "Update Event Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      await ProjectTool.execute(
        { action: "update", id: projectId, name: "Changed" },
        mockCtx
      )

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId,
          changes: expect.objectContaining({ name: "Changed" }),
        })
      )
    })

    test("update without changes returns no changes message", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "No Change Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      const result = await ProjectTool.execute(
        { action: "update", id: projectId },
        mockCtx
      )

      expect(result.title).toBe("No Changes")
    })

    test("update non-existent project returns error", async () => {
      const result = await ProjectTool.execute(
        { action: "update", id: "nonexistent-id", name: "New Name" },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Project not found")
    })
  })

  describe("delete action", () => {
    test("delete project", async () => {
      const createResult = await ProjectTool.execute(
        { action: "create", name: "To Delete" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      const result = await ProjectTool.execute(
        { action: "delete", id: projectId },
        mockCtx
      )

      expect(result.title).toBe("Project Deleted")
      expect(result.output).toContain("To Delete")

      // Verify it's gone
      const getResult = await ProjectTool.execute(
        { action: "get", id: projectId },
        mockCtx
      )
      expect(getResult.title).toBe("Error")
      expect(getResult.output).toContain("Project not found")
    })

    test("delete publishes event", async () => {
      const handler = vi.fn()
      Bus.subscribe("project.deleted", handler)

      const createResult = await ProjectTool.execute(
        { action: "create", name: "Delete Event Test" },
        mockCtx
      )
      const projectId = createResult.metadata?.projectId as string

      await ProjectTool.execute({ action: "delete", id: projectId }, mockCtx)

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ projectId })
    })

    test("delete non-existent project returns error", async () => {
      const result = await ProjectTool.execute(
        { action: "delete", id: "nonexistent-id" },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Project not found")
    })

    test("delete without ID returns error", async () => {
      const result = await ProjectTool.execute({ action: "delete" }, mockCtx)

      expect(result.title).toBe("Error")
      expect(result.output).toContain("ID is required")
    })
  })
})
