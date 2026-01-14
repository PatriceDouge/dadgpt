import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { createActor } from "xstate"
import {
  todoMachine,
  createTodoContext,
  type TodoContext,
} from "../../../src/state/todo.machine"

describe("Todo State Machine", () => {
  // Mock Date.now for consistent test results
  let nowSpy: ReturnType<typeof vi.spyOn>
  const mockNow = 1700000000000

  beforeEach(() => {
    nowSpy = vi.spyOn(Date, "now").mockReturnValue(mockNow)
  })

  afterEach(() => {
    nowSpy.mockRestore()
  })

  test("starts in pending state", () => {
    const actor = createActor(todoMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe("pending")
    actor.stop()
  })

  test("full lifecycle pending -> in_progress -> done", () => {
    const actor = createActor(todoMachine)
    actor.start()

    actor.send({ type: "START" })
    expect(actor.getSnapshot().value).toBe("in_progress")

    actor.send({ type: "COMPLETE" })
    expect(actor.getSnapshot().value).toBe("done")
    expect(actor.getSnapshot().context.completedAt).toBe(mockNow)

    actor.stop()
  })

  test("can be blocked and unblocked", () => {
    const actor = createActor(todoMachine)
    actor.start()
    actor.send({ type: "START" })

    actor.send({ type: "BLOCK", blockedBy: "other-todo-123" })
    expect(actor.getSnapshot().value).toBe("blocked")

    actor.send({ type: "UNBLOCK" })
    expect(actor.getSnapshot().value).toBe("in_progress")

    actor.stop()
  })

  test("blocked stores blockedBy ID", () => {
    const actor = createActor(todoMachine)
    actor.start()
    actor.send({ type: "START" })

    const blockingTodoId = "blocking-todo-456"
    actor.send({ type: "BLOCK", blockedBy: blockingTodoId })

    expect(actor.getSnapshot().value).toBe("blocked")
    expect(actor.getSnapshot().context.blockedBy).toBe(blockingTodoId)

    // UNBLOCK clears the blockedBy ID
    actor.send({ type: "UNBLOCK" })
    expect(actor.getSnapshot().context.blockedBy).toBeNull()

    actor.stop()
  })

  test("can defer with date", () => {
    const actor = createActor(todoMachine)
    actor.start()

    actor.send({ type: "DEFER", until: "2024-12-31" })
    expect(actor.getSnapshot().value).toBe("deferred")
    expect(actor.getSnapshot().context.dueDate).toBe("2024-12-31")

    actor.stop()
  })

  test("can reopen completed todo", () => {
    const actor = createActor(todoMachine)
    actor.start()
    actor.send({ type: "START" })
    actor.send({ type: "COMPLETE" })

    expect(actor.getSnapshot().value).toBe("done")
    expect(actor.getSnapshot().context.completedAt).toBe(mockNow)

    actor.send({ type: "REOPEN" })
    expect(actor.getSnapshot().value).toBe("pending")
    expect(actor.getSnapshot().context.completedAt).toBeNull()

    actor.stop()
  })

  test("can cancel and reopen", () => {
    const actor = createActor(todoMachine)
    actor.start()
    actor.send({ type: "CANCEL" })

    expect(actor.getSnapshot().value).toBe("cancelled")

    actor.send({ type: "REOPEN" })
    expect(actor.getSnapshot().value).toBe("pending")

    actor.stop()
  })

  test("can complete directly from pending (quick tasks)", () => {
    const actor = createActor(todoMachine)
    actor.start()

    // Direct completion from pending without going through in_progress
    actor.send({ type: "COMPLETE" })
    expect(actor.getSnapshot().value).toBe("done")
    expect(actor.getSnapshot().context.completedAt).toBe(mockNow)

    actor.stop()
  })

  test("can defer from in_progress", () => {
    const actor = createActor(todoMachine)
    actor.start()
    actor.send({ type: "START" })

    actor.send({ type: "DEFER", until: "2025-01-15" })
    expect(actor.getSnapshot().value).toBe("deferred")
    expect(actor.getSnapshot().context.dueDate).toBe("2025-01-15")

    actor.stop()
  })

  test("can start from deferred state", () => {
    const actor = createActor(todoMachine)
    actor.start()
    actor.send({ type: "DEFER", until: "2024-12-31" })

    expect(actor.getSnapshot().value).toBe("deferred")

    actor.send({ type: "START" })
    expect(actor.getSnapshot().value).toBe("in_progress")

    actor.stop()
  })

  test("can cancel from various states", () => {
    // Cancel from pending
    const actor1 = createActor(todoMachine)
    actor1.start()
    actor1.send({ type: "CANCEL" })
    expect(actor1.getSnapshot().value).toBe("cancelled")
    actor1.stop()

    // Cancel from in_progress
    const actor2 = createActor(todoMachine)
    actor2.start()
    actor2.send({ type: "START" })
    actor2.send({ type: "CANCEL" })
    expect(actor2.getSnapshot().value).toBe("cancelled")
    actor2.stop()

    // Cancel from blocked
    const actor3 = createActor(todoMachine)
    actor3.start()
    actor3.send({ type: "START" })
    actor3.send({ type: "BLOCK", blockedBy: "other" })
    actor3.send({ type: "CANCEL" })
    expect(actor3.getSnapshot().value).toBe("cancelled")
    actor3.stop()

    // Cancel from deferred
    const actor4 = createActor(todoMachine)
    actor4.start()
    actor4.send({ type: "DEFER", until: "2025-01-01" })
    actor4.send({ type: "CANCEL" })
    expect(actor4.getSnapshot().value).toBe("cancelled")
    actor4.stop()
  })

  test("updates updatedAt on state transitions", () => {
    const actor = createActor(todoMachine, {
      snapshot: todoMachine.resolveState({
        value: "pending",
        context: createTodoContext({
          id: "test-todo",
          updatedAt: 1000,
        }),
      }),
    })
    actor.start()

    actor.send({ type: "START" })
    expect(actor.getSnapshot().context.updatedAt).toBe(mockNow)

    actor.stop()
  })

  test("createTodoContext provides defaults", () => {
    const context = createTodoContext({ id: "test-id", title: "Test Todo" })

    expect(context.id).toBe("test-id")
    expect(context.title).toBe("Test Todo")
    expect(context.description).toBe("")
    expect(context.priority).toBe("medium") // Default
    expect(context.dueDate).toBeNull()
    expect(context.tags).toEqual([])
    expect(context.goalId).toBeNull()
    expect(context.blockedBy).toBeNull()
    expect(context.createdAt).toBe(mockNow)
    expect(context.updatedAt).toBe(mockNow)
    expect(context.completedAt).toBeNull()
  })

  test("createTodoContext accepts all fields", () => {
    const input: TodoContext = {
      id: "todo-1",
      title: "Write tests",
      description: "Create comprehensive unit tests",
      priority: "high",
      dueDate: "2024-12-31",
      tags: ["testing", "important"],
      goalId: "goal-123",
      blockedBy: "todo-456",
      createdAt: 1699000000000,
      updatedAt: 1699500000000,
      completedAt: null,
    }

    const context = createTodoContext(input)

    expect(context).toEqual(input)
  })

  test("done state is not final (can REOPEN)", () => {
    const actor = createActor(todoMachine)
    actor.start()
    actor.send({ type: "START" })
    actor.send({ type: "COMPLETE" })

    expect(actor.getSnapshot().value).toBe("done")
    // done is NOT a final state - actor should still be running
    expect(actor.getSnapshot().status).toBe("active")

    actor.stop()
  })

  test("cancelled state is not final (can REOPEN)", () => {
    const actor = createActor(todoMachine)
    actor.start()
    actor.send({ type: "CANCEL" })

    expect(actor.getSnapshot().value).toBe("cancelled")
    // cancelled is NOT a final state - actor should still be running
    expect(actor.getSnapshot().status).toBe("active")

    actor.stop()
  })

  test("BLOCK only works from in_progress state", () => {
    const actor = createActor(todoMachine)
    actor.start()

    // Try to BLOCK from pending - should not transition
    actor.send({ type: "BLOCK", blockedBy: "other-todo" })
    expect(actor.getSnapshot().value).toBe("pending")
    expect(actor.getSnapshot().context.blockedBy).toBeNull()

    actor.stop()
  })

  test("UNBLOCK only works from blocked state", () => {
    const actor = createActor(todoMachine)
    actor.start()
    actor.send({ type: "START" })

    // Try to UNBLOCK from in_progress - should not change state
    actor.send({ type: "UNBLOCK" })
    expect(actor.getSnapshot().value).toBe("in_progress")

    actor.stop()
  })

  test("REOPEN does not work from active states", () => {
    const actor = createActor(todoMachine)
    actor.start()
    actor.send({ type: "START" })

    // Try REOPEN from in_progress - should not change state
    actor.send({ type: "REOPEN" })
    expect(actor.getSnapshot().value).toBe("in_progress")

    actor.stop()
  })

  test("COMPLETE only works from pending and in_progress", () => {
    // Cannot complete from blocked
    const actor1 = createActor(todoMachine)
    actor1.start()
    actor1.send({ type: "START" })
    actor1.send({ type: "BLOCK", blockedBy: "other" })
    actor1.send({ type: "COMPLETE" })
    expect(actor1.getSnapshot().value).toBe("blocked")
    actor1.stop()

    // Cannot complete from deferred
    const actor2 = createActor(todoMachine)
    actor2.start()
    actor2.send({ type: "DEFER", until: "2025-01-01" })
    actor2.send({ type: "COMPLETE" })
    expect(actor2.getSnapshot().value).toBe("deferred")
    actor2.stop()
  })

  test("priority levels are correctly handled", () => {
    const lowPriority = createTodoContext({ id: "1", priority: "low" })
    expect(lowPriority.priority).toBe("low")

    const mediumPriority = createTodoContext({ id: "2", priority: "medium" })
    expect(mediumPriority.priority).toBe("medium")

    const highPriority = createTodoContext({ id: "3", priority: "high" })
    expect(highPriority.priority).toBe("high")
  })
})
