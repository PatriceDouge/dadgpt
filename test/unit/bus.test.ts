import { describe, test, expect, beforeEach, vi } from "vitest"
import { Bus } from "../../src/bus/bus"

describe("Bus", () => {
  beforeEach(() => {
    Bus.clear()
  })

  test("subscribe and publish delivers payload", () => {
    const received: string[] = []
    Bus.subscribe("test.event", (payload: { msg: string }) => {
      received.push(payload.msg)
    })

    Bus.publish("test.event", { msg: "hello" })
    Bus.publish("test.event", { msg: "world" })

    expect(received).toEqual(["hello", "world"])
  })

  test("unsubscribe stops receiving events", () => {
    const received: number[] = []
    const unsub = Bus.subscribe("test", (n: number) => received.push(n))

    Bus.publish("test", 1)
    unsub()
    Bus.publish("test", 2)

    expect(received).toEqual([1])
  })

  test("multiple handlers for same event all fire", () => {
    let count = 0
    Bus.subscribe("inc", () => count++)
    Bus.subscribe("inc", () => count++)
    Bus.subscribe("inc", () => count++)

    Bus.publish("inc", null)

    expect(count).toBe(3)
  })

  test("handler error does not break other handlers", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const results: number[] = []

    Bus.subscribe("test", () => {
      throw new Error("fail")
    })
    Bus.subscribe("test", (n: number) => results.push(n))
    Bus.subscribe("test", (n: number) => results.push(n * 2))

    Bus.publish("test", 42)

    expect(results).toEqual([42, 84])
    expect(consoleSpy).toHaveBeenCalledTimes(1)

    consoleSpy.mockRestore()
  })

  test("clear removes all handlers", () => {
    const results: string[] = []
    Bus.subscribe("event1", (s: string) => results.push(s))
    Bus.subscribe("event2", (s: string) => results.push(s))

    Bus.publish("event1", "before")
    expect(results).toEqual(["before"])

    Bus.clear()

    Bus.publish("event1", "after1")
    Bus.publish("event2", "after2")

    // No new items should be added after clear
    expect(results).toEqual(["before"])
  })

  test("publish to event with no subscribers does not throw", () => {
    expect(() => {
      Bus.publish("nonexistent.event", { data: "test" })
    }).not.toThrow()
  })

  test("handlers receive the exact payload passed to publish", () => {
    const payload = {
      goalId: "goal_123",
      changes: { title: "New Title", progress: 50 }
    }
    let received: typeof payload | null = null

    Bus.subscribe("goal.updated", (p: typeof payload) => {
      received = p
    })

    Bus.publish("goal.updated", payload)

    expect(received).toEqual(payload)
    expect(received).toBe(payload) // Same reference
  })
})
