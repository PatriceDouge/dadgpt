import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import { TodoTool } from "../../../src/tool/todo"
import { Storage } from "../../../src/storage/storage"
import { Bus } from "../../../src/bus/bus"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import type { ToolContext } from "../../../src/tool/types"

describe("Todo Tool", () => {
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
    test("create todo with required fields", async () => {
      const result = await TodoTool.execute(
        { action: "create", title: "Test Todo" },
        mockCtx
      )

      expect(result.title).toBe("Todo Created")
      expect(result.output).toContain("Test Todo")
      expect(result.metadata?.todoId).toBeDefined()

      // Verify todo was persisted
      const todos = await Storage.list(["todos"])
      expect(todos.length).toBe(1)
    })

    test("create todo with all fields", async () => {
      const result = await TodoTool.execute(
        {
          action: "create",
          title: "Complete Todo",
          description: "A detailed description",
          priority: "high",
          dueDate: "2025-12-31",
          tags: ["work", "urgent"],
          goalId: "goal_123",
        },
        mockCtx
      )

      expect(result.title).toBe("Todo Created")
      expect(result.metadata?.todoId).toBeDefined()

      // Verify all fields persisted correctly
      const todoId = result.metadata?.todoId as string
      const todo = await Storage.read<{
        title: string
        description: string
        priority: string
        dueDate: string
        tags: string[]
        goalId: string
        state: string
      }>(["todos", todoId])

      expect(todo?.title).toBe("Complete Todo")
      expect(todo?.description).toBe("A detailed description")
      expect(todo?.priority).toBe("high")
      expect(todo?.dueDate).toBe("2025-12-31")
      expect(todo?.tags).toEqual(["work", "urgent"])
      expect(todo?.goalId).toBe("goal_123")
      expect(todo?.state).toBe("pending")
    })

    test("create todo publishes event", async () => {
      const handler = vi.fn()
      Bus.subscribe("todo.created", handler)

      await TodoTool.execute(
        { action: "create", title: "Event Test" },
        mockCtx
      )

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ todoId: expect.any(String) })
      )
    })

    test("create todo without title returns error", async () => {
      const result = await TodoTool.execute({ action: "create" }, mockCtx)

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Title is required")
    })

    test("create todo defaults to medium priority", async () => {
      const result = await TodoTool.execute(
        { action: "create", title: "Default Priority" },
        mockCtx
      )

      const todoId = result.metadata?.todoId as string
      const todo = await Storage.read<{ priority: string }>(["todos", todoId])

      expect(todo?.priority).toBe("medium")
    })
  })

  describe("list action", () => {
    test("list all todos", async () => {
      // Create some test todos
      await TodoTool.execute(
        { action: "create", title: "Todo 1" },
        mockCtx
      )
      await TodoTool.execute(
        { action: "create", title: "Todo 2" },
        mockCtx
      )

      const result = await TodoTool.execute({ action: "list" }, mockCtx)

      expect(result.title).toBe("Todos")
      expect(result.output).toContain("Todo 1")
      expect(result.output).toContain("Todo 2")
      expect(result.metadata?.count).toBe(2)
    })

    test("list filters by status", async () => {
      // Create and start one todo
      const createResult = await TodoTool.execute(
        { action: "create", title: "Started Todo" },
        mockCtx
      )
      const startedId = createResult.metadata?.todoId as string
      await TodoTool.execute(
        { action: "transition", id: startedId, event: "START" },
        mockCtx
      )

      // Create another that remains pending
      await TodoTool.execute(
        { action: "create", title: "Pending Todo" },
        mockCtx
      )

      const result = await TodoTool.execute(
        { action: "list", statusFilter: "in_progress" },
        mockCtx
      )

      expect(result.output).toContain("Started Todo")
      expect(result.output).not.toContain("Pending Todo")
      expect(result.metadata?.count).toBe(1)
    })

    test("list filters by priority", async () => {
      await TodoTool.execute(
        { action: "create", title: "High Priority", priority: "high" },
        mockCtx
      )
      await TodoTool.execute(
        { action: "create", title: "Low Priority", priority: "low" },
        mockCtx
      )

      const result = await TodoTool.execute(
        { action: "list", priorityFilter: "high" },
        mockCtx
      )

      expect(result.output).toContain("High Priority")
      expect(result.output).not.toContain("Low Priority")
      expect(result.metadata?.count).toBe(1)
    })

    test("list filters by tag", async () => {
      await TodoTool.execute(
        { action: "create", title: "Work Todo", tags: ["work"] },
        mockCtx
      )
      await TodoTool.execute(
        { action: "create", title: "Personal Todo", tags: ["personal"] },
        mockCtx
      )

      const result = await TodoTool.execute(
        { action: "list", tagFilter: "work" },
        mockCtx
      )

      expect(result.output).toContain("Work Todo")
      expect(result.output).not.toContain("Personal Todo")
      expect(result.metadata?.count).toBe(1)
    })

    test("list returns empty message when no todos", async () => {
      const result = await TodoTool.execute({ action: "list" }, mockCtx)

      expect(result.output).toBe("No todos found.")
      expect(result.metadata?.count).toBe(0)
    })

    test("list sorts by priority then dueDate", async () => {
      // Create todos in reverse order of expected sorting
      await TodoTool.execute(
        { action: "create", title: "Low Later", priority: "low", dueDate: "2025-12-31" },
        mockCtx
      )
      await TodoTool.execute(
        { action: "create", title: "High Later", priority: "high", dueDate: "2025-12-31" },
        mockCtx
      )
      await TodoTool.execute(
        { action: "create", title: "High Earlier", priority: "high", dueDate: "2025-06-15" },
        mockCtx
      )

      const result = await TodoTool.execute({ action: "list" }, mockCtx)

      // High priority should come first, then sorted by dueDate
      const output = result.output
      const highEarlierPos = output.indexOf("High Earlier")
      const highLaterPos = output.indexOf("High Later")
      const lowLaterPos = output.indexOf("Low Later")

      expect(highEarlierPos).toBeLessThan(highLaterPos)
      expect(highLaterPos).toBeLessThan(lowLaterPos)
    })

    test("list shows priority icons", async () => {
      await TodoTool.execute(
        { action: "create", title: "Urgent Task", priority: "high" },
        mockCtx
      )

      const result = await TodoTool.execute({ action: "list" }, mockCtx)

      expect(result.output).toContain("!!!")
    })
  })

  describe("get action", () => {
    test("get todo by ID", async () => {
      const createResult = await TodoTool.execute(
        {
          action: "create",
          title: "Detailed Todo",
          priority: "high",
          description: "Test description",
        },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      const result = await TodoTool.execute(
        { action: "get", id: todoId },
        mockCtx
      )

      expect(result.title).toBe("Todo: Detailed Todo")
      expect(result.output).toContain("Title: Detailed Todo")
      expect(result.output).toContain("Priority: high")
      expect(result.output).toContain("Status: pending")
      expect(result.output).toContain("Description: Test description")
    })

    test("get non-existent todo returns error", async () => {
      const result = await TodoTool.execute(
        { action: "get", id: "nonexistent-id" },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Todo not found")
    })

    test("get without ID returns error", async () => {
      const result = await TodoTool.execute({ action: "get" }, mockCtx)

      expect(result.title).toBe("Error")
      expect(result.output).toContain("ID is required")
    })
  })

  describe("complete action", () => {
    test("complete shortcut marks todo as done", async () => {
      const createResult = await TodoTool.execute(
        { action: "create", title: "Quick Complete" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      const result = await TodoTool.execute(
        { action: "complete", id: todoId },
        mockCtx
      )

      expect(result.title).toBe("Todo Completed")
      expect(result.output).toContain("Quick Complete")

      // Verify state is done
      const getResult = await TodoTool.execute(
        { action: "get", id: todoId },
        mockCtx
      )
      expect(getResult.output).toContain("Status: done")
    })

    test("complete publishes event", async () => {
      const handler = vi.fn()
      Bus.subscribe("todo.completed", handler)

      const createResult = await TodoTool.execute(
        { action: "create", title: "Complete Event Test" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      await TodoTool.execute({ action: "complete", id: todoId }, mockCtx)

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ todoId })
    })

    test("complete already done todo returns message", async () => {
      const createResult = await TodoTool.execute(
        { action: "create", title: "Already Done" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      // Complete once
      await TodoTool.execute({ action: "complete", id: todoId }, mockCtx)

      // Try to complete again
      const result = await TodoTool.execute(
        { action: "complete", id: todoId },
        mockCtx
      )

      expect(result.title).toBe("Already Complete")
    })

    test("cannot complete from blocked state", async () => {
      const createResult = await TodoTool.execute(
        { action: "create", title: "Blocked Todo" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      // Start then block
      await TodoTool.execute(
        { action: "transition", id: todoId, event: "START" },
        mockCtx
      )
      await TodoTool.execute(
        { action: "transition", id: todoId, event: "BLOCK", blockedBy: "other-todo" },
        mockCtx
      )

      const result = await TodoTool.execute(
        { action: "complete", id: todoId },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Cannot complete todo from state")
    })
  })

  describe("transition action", () => {
    test("block and unblock todo", async () => {
      const createResult = await TodoTool.execute(
        { action: "create", title: "Block Test" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      // Start the todo
      await TodoTool.execute(
        { action: "transition", id: todoId, event: "START" },
        mockCtx
      )

      // Block it
      let result = await TodoTool.execute(
        { action: "transition", id: todoId, event: "BLOCK", blockedBy: "blocker-123" },
        mockCtx
      )
      expect(result.output).toContain("in_progress to blocked")

      // Verify blockedBy is stored
      const getResult = await TodoTool.execute(
        { action: "get", id: todoId },
        mockCtx
      )
      expect(getResult.output).toContain("Blocked By: blocker-123")

      // Unblock it
      result = await TodoTool.execute(
        { action: "transition", id: todoId, event: "UNBLOCK" },
        mockCtx
      )
      expect(result.output).toContain("blocked to in_progress")
    })

    test("BLOCK requires blockedBy parameter", async () => {
      const createResult = await TodoTool.execute(
        { action: "create", title: "Block Error Test" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      await TodoTool.execute(
        { action: "transition", id: todoId, event: "START" },
        mockCtx
      )

      const result = await TodoTool.execute(
        { action: "transition", id: todoId, event: "BLOCK" },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("blockedBy is required")
    })

    test("defer with date", async () => {
      const createResult = await TodoTool.execute(
        { action: "create", title: "Defer Test" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      const result = await TodoTool.execute(
        { action: "transition", id: todoId, event: "DEFER", until: "2025-12-31" },
        mockCtx
      )

      expect(result.output).toContain("pending to deferred")

      // Verify dueDate is updated
      const getResult = await TodoTool.execute(
        { action: "get", id: todoId },
        mockCtx
      )
      expect(getResult.output).toContain("Due Date: 2025-12-31")
    })

    test("DEFER requires until parameter", async () => {
      const createResult = await TodoTool.execute(
        { action: "create", title: "Defer Error Test" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      const result = await TodoTool.execute(
        { action: "transition", id: todoId, event: "DEFER" },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("until (date) is required")
    })

    test("can reopen done todo", async () => {
      const createResult = await TodoTool.execute(
        { action: "create", title: "Reopen Test" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      // Complete the todo
      await TodoTool.execute({ action: "complete", id: todoId }, mockCtx)

      // Reopen it
      const result = await TodoTool.execute(
        { action: "transition", id: todoId, event: "REOPEN" },
        mockCtx
      )

      expect(result.output).toContain("done to pending")

      // Verify state
      const getResult = await TodoTool.execute(
        { action: "get", id: todoId },
        mockCtx
      )
      expect(getResult.output).toContain("Status: pending")
    })

    test("can cancel and reopen", async () => {
      const createResult = await TodoTool.execute(
        { action: "create", title: "Cancel Test" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      // Cancel the todo
      let result = await TodoTool.execute(
        { action: "transition", id: todoId, event: "CANCEL" },
        mockCtx
      )
      expect(result.output).toContain("pending to cancelled")

      // Reopen it
      result = await TodoTool.execute(
        { action: "transition", id: todoId, event: "REOPEN" },
        mockCtx
      )
      expect(result.output).toContain("cancelled to pending")
    })

    test("invalid transition returns no change", async () => {
      const createResult = await TodoTool.execute(
        { action: "create", title: "Invalid Transition" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      // Try to unblock a pending todo (invalid)
      const result = await TodoTool.execute(
        { action: "transition", id: todoId, event: "UNBLOCK" },
        mockCtx
      )

      expect(result.title).toBe("No Change")
      expect(result.output).toContain("not valid from state pending")
    })

    test("transition without event returns error", async () => {
      const createResult = await TodoTool.execute(
        { action: "create", title: "Event Error Test" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      const result = await TodoTool.execute(
        { action: "transition", id: todoId },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Event is required")
    })

    test("full lifecycle: pending -> in_progress -> done", async () => {
      const createResult = await TodoTool.execute(
        { action: "create", title: "Lifecycle Test" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      // START: pending -> in_progress
      let result = await TodoTool.execute(
        { action: "transition", id: todoId, event: "START" },
        mockCtx
      )
      expect(result.output).toContain("pending to in_progress")

      // COMPLETE: in_progress -> done
      result = await TodoTool.execute(
        { action: "transition", id: todoId, event: "COMPLETE" },
        mockCtx
      )
      expect(result.output).toContain("in_progress to done")
    })
  })

  describe("delete action", () => {
    test("delete todo", async () => {
      const createResult = await TodoTool.execute(
        { action: "create", title: "To Delete" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      const result = await TodoTool.execute(
        { action: "delete", id: todoId },
        mockCtx
      )

      expect(result.title).toBe("Todo Deleted")
      expect(result.output).toContain("To Delete")

      // Verify it's gone
      const getResult = await TodoTool.execute(
        { action: "get", id: todoId },
        mockCtx
      )
      expect(getResult.title).toBe("Error")
      expect(getResult.output).toContain("Todo not found")
    })

    test("delete publishes event", async () => {
      const handler = vi.fn()
      Bus.subscribe("todo.deleted", handler)

      const createResult = await TodoTool.execute(
        { action: "create", title: "Delete Event Test" },
        mockCtx
      )
      const todoId = createResult.metadata?.todoId as string

      await TodoTool.execute({ action: "delete", id: todoId }, mockCtx)

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ todoId })
    })

    test("delete non-existent todo returns error", async () => {
      const result = await TodoTool.execute(
        { action: "delete", id: "nonexistent-id" },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Todo not found")
    })

    test("delete without ID returns error", async () => {
      const result = await TodoTool.execute({ action: "delete" }, mockCtx)

      expect(result.title).toBe("Error")
      expect(result.output).toContain("ID is required")
    })
  })
})
