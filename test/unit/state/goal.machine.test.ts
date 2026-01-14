import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { createActor } from "xstate"
import {
  goalMachine,
  createGoalContext,
  type GoalContext,
} from "../../../src/state/goal.machine"

describe("Goal State Machine", () => {
  // Mock Date.now for consistent test results
  let nowSpy: ReturnType<typeof vi.spyOn>
  const mockNow = 1700000000000

  beforeEach(() => {
    nowSpy = vi.spyOn(Date, "now").mockReturnValue(mockNow)
  })

  afterEach(() => {
    nowSpy.mockRestore()
  })

  test("starts in not_started state", () => {
    const actor = createActor(goalMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe("not_started")
    actor.stop()
  })

  test("transitions not_started -> in_progress on START", () => {
    const actor = createActor(goalMachine)
    actor.start()
    actor.send({ type: "START" })
    expect(actor.getSnapshot().value).toBe("in_progress")
    actor.stop()
  })

  test("can pause and resume", () => {
    const actor = createActor(goalMachine)
    actor.start()

    actor.send({ type: "START" })
    expect(actor.getSnapshot().value).toBe("in_progress")

    actor.send({ type: "PAUSE" })
    expect(actor.getSnapshot().value).toBe("paused")

    actor.send({ type: "RESUME" })
    expect(actor.getSnapshot().value).toBe("in_progress")

    actor.stop()
  })

  test("UPDATE_PROGRESS clamps to 0-100", () => {
    const actor = createActor(goalMachine, {
      snapshot: goalMachine.resolveState({
        value: "in_progress",
        context: createGoalContext({ id: "test-goal", progress: 0 }),
      }),
    })
    actor.start()

    // Normal progress update
    actor.send({ type: "UPDATE_PROGRESS", progress: 50 })
    expect(actor.getSnapshot().context.progress).toBe(50)

    // Above 100 should clamp to 100
    actor.send({ type: "UPDATE_PROGRESS", progress: 150 })
    expect(actor.getSnapshot().context.progress).toBe(100)

    // Below 0 should clamp to 0
    actor.send({ type: "UPDATE_PROGRESS", progress: -10 })
    expect(actor.getSnapshot().context.progress).toBe(0)

    actor.stop()
  })

  test("COMPLETE_MILESTONE marks correct milestone", () => {
    const actor = createActor(goalMachine, {
      snapshot: goalMachine.resolveState({
        value: "in_progress",
        context: createGoalContext({
          id: "test-goal",
          milestones: [
            { id: "m1", title: "First milestone", completed: false },
            { id: "m2", title: "Second milestone", completed: false },
          ],
        }),
      }),
    })
    actor.start()

    actor.send({ type: "COMPLETE_MILESTONE", milestoneId: "m1" })

    const milestones = actor.getSnapshot().context.milestones
    expect(milestones[0]?.completed).toBe(true)
    expect(milestones[1]?.completed).toBe(false)

    actor.stop()
  })

  test("completed is final state", () => {
    const actor = createActor(goalMachine)
    actor.start()
    actor.send({ type: "START" })
    actor.send({ type: "COMPLETE" })

    expect(actor.getSnapshot().value).toBe("completed")
    expect(actor.getSnapshot().status).toBe("done")

    // Verify progress is set to 100 on completion
    expect(actor.getSnapshot().context.progress).toBe(100)

    actor.stop()
  })

  test("can abandon from any non-final state", () => {
    // Test abandon from not_started
    const actor1 = createActor(goalMachine)
    actor1.start()
    actor1.send({ type: "ABANDON" })
    expect(actor1.getSnapshot().value).toBe("abandoned")
    actor1.stop()

    // Test abandon from in_progress
    const actor2 = createActor(goalMachine)
    actor2.start()
    actor2.send({ type: "START" })
    actor2.send({ type: "ABANDON" })
    expect(actor2.getSnapshot().value).toBe("abandoned")
    actor2.stop()

    // Test abandon from paused
    const actor3 = createActor(goalMachine)
    actor3.start()
    actor3.send({ type: "START" })
    actor3.send({ type: "PAUSE" })
    actor3.send({ type: "ABANDON" })
    expect(actor3.getSnapshot().value).toBe("abandoned")
    actor3.stop()
  })

  test("abandoned is final state", () => {
    const actor = createActor(goalMachine)
    actor.start()
    actor.send({ type: "ABANDON" })

    expect(actor.getSnapshot().value).toBe("abandoned")
    expect(actor.getSnapshot().status).toBe("done")

    actor.stop()
  })

  test("updates updatedAt on state transitions", () => {
    const actor = createActor(goalMachine, {
      snapshot: goalMachine.resolveState({
        value: "not_started",
        context: createGoalContext({
          id: "test-goal",
          updatedAt: 1000,
        }),
      }),
    })
    actor.start()

    actor.send({ type: "START" })
    expect(actor.getSnapshot().context.updatedAt).toBe(mockNow)

    actor.stop()
  })

  test("createGoalContext provides defaults", () => {
    const context = createGoalContext({ id: "test-id", title: "Test Goal" })

    expect(context.id).toBe("test-id")
    expect(context.title).toBe("Test Goal")
    expect(context.category).toBe("Personal") // Default
    expect(context.description).toBe("")
    expect(context.progress).toBe(0)
    expect(context.milestones).toEqual([])
    expect(context.dueDate).toBeNull()
    expect(context.createdAt).toBe(mockNow)
    expect(context.updatedAt).toBe(mockNow)
  })

  test("createGoalContext accepts all fields", () => {
    const input: GoalContext = {
      id: "goal-1",
      title: "Learn TypeScript",
      category: "Work",
      description: "Master TypeScript for better code",
      progress: 25,
      milestones: [{ id: "m1", title: "Basics", completed: true }],
      dueDate: "2024-12-31",
      createdAt: 1699000000000,
      updatedAt: 1699500000000,
    }

    const context = createGoalContext(input)

    expect(context).toEqual(input)
  })

  test("cannot transition from completed state", () => {
    const actor = createActor(goalMachine)
    actor.start()
    actor.send({ type: "START" })
    actor.send({ type: "COMPLETE" })

    // Try to transition from completed
    actor.send({ type: "START" })
    expect(actor.getSnapshot().value).toBe("completed")

    actor.send({ type: "ABANDON" })
    expect(actor.getSnapshot().value).toBe("completed")

    actor.stop()
  })

  test("cannot transition from abandoned state", () => {
    const actor = createActor(goalMachine)
    actor.start()
    actor.send({ type: "ABANDON" })

    // Try to transition from abandoned
    actor.send({ type: "START" })
    expect(actor.getSnapshot().value).toBe("abandoned")

    actor.send({ type: "RESUME" })
    expect(actor.getSnapshot().value).toBe("abandoned")

    actor.stop()
  })

  test("UPDATE_PROGRESS only works in in_progress state", () => {
    const actor = createActor(goalMachine, {
      snapshot: goalMachine.resolveState({
        value: "not_started",
        context: createGoalContext({ id: "test", progress: 0 }),
      }),
    })
    actor.start()

    // Try UPDATE_PROGRESS from not_started - should not change
    actor.send({ type: "UPDATE_PROGRESS", progress: 50 })
    expect(actor.getSnapshot().context.progress).toBe(0)
    expect(actor.getSnapshot().value).toBe("not_started")

    actor.stop()
  })

  test("COMPLETE_MILESTONE only works in in_progress state", () => {
    const actor = createActor(goalMachine, {
      snapshot: goalMachine.resolveState({
        value: "not_started",
        context: createGoalContext({
          id: "test",
          milestones: [{ id: "m1", title: "Milestone", completed: false }],
        }),
      }),
    })
    actor.start()

    // Try COMPLETE_MILESTONE from not_started - should not change
    actor.send({ type: "COMPLETE_MILESTONE", milestoneId: "m1" })
    expect(actor.getSnapshot().context.milestones[0]?.completed).toBe(false)

    actor.stop()
  })

  test("completing multiple milestones", () => {
    const actor = createActor(goalMachine, {
      snapshot: goalMachine.resolveState({
        value: "in_progress",
        context: createGoalContext({
          id: "test-goal",
          milestones: [
            { id: "m1", title: "First", completed: false },
            { id: "m2", title: "Second", completed: false },
            { id: "m3", title: "Third", completed: false },
          ],
        }),
      }),
    })
    actor.start()

    actor.send({ type: "COMPLETE_MILESTONE", milestoneId: "m1" })
    actor.send({ type: "COMPLETE_MILESTONE", milestoneId: "m3" })

    const milestones = actor.getSnapshot().context.milestones
    expect(milestones[0]?.completed).toBe(true)
    expect(milestones[1]?.completed).toBe(false)
    expect(milestones[2]?.completed).toBe(true)

    actor.stop()
  })
})
