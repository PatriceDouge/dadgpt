import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { FamilyTool } from "../../../src/tool/family"
import { Config } from "../../../src/config/config"
import { Bus } from "../../../src/bus/bus"
import type { ToolContext } from "../../../src/tool/types"

describe("Family Tool", () => {
  let testDir: string
  let originalHome: string | undefined
  let originalDataDir: string | undefined
  const mockCtx: ToolContext = { sessionId: "test-session" }

  beforeEach(async () => {
    // Create unique temp directory
    const random = Math.random().toString(36).substring(2, 15)
    testDir = path.join(
      os.tmpdir(),
      `dadgpt-family-test-${Date.now()}-${random}`
    )
    await fs.mkdir(testDir, { recursive: true })
    await fs.mkdir(path.join(testDir, "data"), { recursive: true })

    // Store original env vars
    originalHome = process.env.DADGPT_HOME
    originalDataDir = process.env.DADGPT_DATA_DIR

    // Override for testing
    process.env.DADGPT_HOME = testDir
    process.env.DADGPT_DATA_DIR = path.join(testDir, "data")

    // Clear config cache
    Config.invalidate()

    // Clear bus handlers
    Bus.clear()
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

  describe("list action", () => {
    test("returns empty message when no family members", async () => {
      const result = await FamilyTool.execute({ action: "list" }, mockCtx)
      expect(result.title).toBe("Family Members")
      expect(result.output).toContain("No family members found")
      expect(result.metadata?.count).toBe(0)
    })

    test("lists all family members", async () => {
      // Add family to config
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          family: [
            { id: "f1", name: "Alice", relationship: "Wife", birthday: "03-15" },
            { id: "f2", name: "Bob", relationship: "Son", notes: "Loves soccer" },
          ],
        })
      )
      Config.invalidate()

      const result = await FamilyTool.execute({ action: "list" }, mockCtx)
      expect(result.output).toContain("Alice (Wife)")
      expect(result.output).toContain("Birthday: 03-15")
      expect(result.output).toContain("Bob (Son)")
      expect(result.output).toContain("Notes: Loves soccer")
      expect(result.metadata?.count).toBe(2)
    })
  })

  describe("add action", () => {
    test("requires name", async () => {
      const result = await FamilyTool.execute(
        { action: "add", relationship: "Friend" },
        mockCtx
      )
      expect(result.title).toBe("Error")
      expect(result.output).toContain("Name is required")
    })

    test("requires relationship", async () => {
      const result = await FamilyTool.execute(
        { action: "add", name: "Alice" },
        mockCtx
      )
      expect(result.title).toBe("Error")
      expect(result.output).toContain("Relationship is required")
    })

    test("validates birthday format", async () => {
      const result = await FamilyTool.execute(
        { action: "add", name: "Alice", relationship: "Wife", birthday: "invalid" },
        mockCtx
      )
      expect(result.title).toBe("Error")
      expect(result.output).toContain("Invalid birthday format")
    })

    test("adds family member with MM-DD birthday", async () => {
      const handler = vi.fn()
      Bus.subscribe("family.added", handler)

      const result = await FamilyTool.execute(
        { action: "add", name: "Alice", relationship: "Wife", birthday: "03-15" },
        mockCtx
      )

      expect(result.title).toBe("Family Member Added")
      expect(result.output).toContain("Added Alice (Wife)")
      expect(result.output).toContain("birthday 03-15")
      expect(result.metadata?.memberId).toBeDefined()
      expect(handler).toHaveBeenCalledWith({ memberId: result.metadata?.memberId })
    })

    test("adds family member with YYYY-MM-DD birthday", async () => {
      const result = await FamilyTool.execute(
        { action: "add", name: "Bob", relationship: "Son", birthday: "2015-06-20" },
        mockCtx
      )

      expect(result.title).toBe("Family Member Added")
      expect(result.output).toContain("birthday 2015-06-20")
    })

    test("adds family member with notes", async () => {
      const result = await FamilyTool.execute(
        {
          action: "add",
          name: "Charlie",
          relationship: "Friend",
          notes: "Met at work",
        },
        mockCtx
      )

      expect(result.title).toBe("Family Member Added")

      // Verify it was saved
      Config.invalidate()
      const config = await Config.get()
      const member = config.family.find((m) => m.name === "Charlie")
      expect(member?.notes).toBe("Met at work")
    })
  })

  describe("get action", () => {
    test("requires ID", async () => {
      const result = await FamilyTool.execute({ action: "get" }, mockCtx)
      expect(result.title).toBe("Error")
      expect(result.output).toContain("ID is required")
    })

    test("returns error for non-existent member", async () => {
      const result = await FamilyTool.execute(
        { action: "get", id: "nonexistent" },
        mockCtx
      )
      expect(result.title).toBe("Error")
      expect(result.output).toContain("Family member not found")
    })

    test("returns family member details", async () => {
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          family: [
            {
              id: "f1",
              name: "Alice",
              relationship: "Wife",
              birthday: "03-15",
              notes: "Best partner",
            },
          ],
        })
      )
      Config.invalidate()

      const result = await FamilyTool.execute({ action: "get", id: "f1" }, mockCtx)
      expect(result.title).toContain("Alice")
      expect(result.output).toContain("Name: Alice")
      expect(result.output).toContain("Relationship: Wife")
      expect(result.output).toContain("Birthday: 03-15")
      expect(result.output).toContain("Notes: Best partner")
    })
  })

  describe("update action", () => {
    test("requires ID", async () => {
      const result = await FamilyTool.execute(
        { action: "update", name: "New Name" },
        mockCtx
      )
      expect(result.title).toBe("Error")
      expect(result.output).toContain("ID is required")
    })

    test("returns error for non-existent member", async () => {
      const result = await FamilyTool.execute(
        { action: "update", id: "nonexistent", name: "New Name" },
        mockCtx
      )
      expect(result.title).toBe("Error")
      expect(result.output).toContain("Family member not found")
    })

    test("returns no changes when no fields specified", async () => {
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          family: [{ id: "f1", name: "Alice", relationship: "Wife" }],
        })
      )
      Config.invalidate()

      const result = await FamilyTool.execute({ action: "update", id: "f1" }, mockCtx)
      expect(result.title).toBe("No Changes")
    })

    test("updates multiple fields", async () => {
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          family: [{ id: "f1", name: "Alice", relationship: "Wife" }],
        })
      )
      Config.invalidate()

      const handler = vi.fn()
      Bus.subscribe("family.updated", handler)

      const result = await FamilyTool.execute(
        {
          action: "update",
          id: "f1",
          name: "Alicia",
          birthday: "03-15",
          notes: "New notes",
        },
        mockCtx
      )

      expect(result.title).toBe("Family Member Updated")
      expect(result.output).toContain("Updated Alicia")
      expect(handler).toHaveBeenCalled()
    })

    test("validates birthday format on update", async () => {
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          family: [{ id: "f1", name: "Alice", relationship: "Wife" }],
        })
      )
      Config.invalidate()

      const result = await FamilyTool.execute(
        { action: "update", id: "f1", birthday: "invalid" },
        mockCtx
      )
      expect(result.title).toBe("Error")
      expect(result.output).toContain("Invalid birthday format")
    })

    test("clears birthday when empty string", async () => {
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          family: [{ id: "f1", name: "Alice", relationship: "Wife", birthday: "03-15" }],
        })
      )
      Config.invalidate()

      const result = await FamilyTool.execute(
        { action: "update", id: "f1", birthday: "" },
        mockCtx
      )

      expect(result.title).toBe("Family Member Updated")

      Config.invalidate()
      const config = await Config.get()
      const member = config.family.find((m) => m.id === "f1")
      expect(member?.birthday).toBeUndefined()
    })
  })

  describe("remove action", () => {
    test("requires ID", async () => {
      const result = await FamilyTool.execute({ action: "remove" }, mockCtx)
      expect(result.title).toBe("Error")
      expect(result.output).toContain("ID is required")
    })

    test("returns error for non-existent member", async () => {
      const result = await FamilyTool.execute(
        { action: "remove", id: "nonexistent" },
        mockCtx
      )
      expect(result.title).toBe("Error")
      expect(result.output).toContain("Family member not found")
    })

    test("removes family member", async () => {
      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          family: [{ id: "f1", name: "Alice", relationship: "Wife" }],
        })
      )
      Config.invalidate()

      const handler = vi.fn()
      Bus.subscribe("family.removed", handler)

      const result = await FamilyTool.execute(
        { action: "remove", id: "f1" },
        mockCtx
      )

      expect(result.title).toBe("Family Member Removed")
      expect(result.output).toContain("Removed Alice")
      expect(handler).toHaveBeenCalledWith({ memberId: "f1" })

      // Verify removal
      Config.invalidate()
      const config = await Config.get()
      expect(config.family.length).toBe(0)
    })
  })

  describe("upcoming action", () => {
    test("returns empty message when no upcoming birthdays", async () => {
      const result = await FamilyTool.execute({ action: "upcoming" }, mockCtx)
      expect(result.title).toBe("Upcoming Birthdays")
      expect(result.output).toContain("No birthdays")
      expect(result.metadata?.count).toBe(0)
    })

    test("lists upcoming birthdays within default 30 days", async () => {
      // Get tomorrow's date
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const month = String(tomorrow.getMonth() + 1).padStart(2, "0")
      const day = String(tomorrow.getDate()).padStart(2, "0")
      const tomorrowBirthday = `${month}-${day}`

      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          family: [
            { id: "f1", name: "Alice", relationship: "Wife", birthday: tomorrowBirthday },
          ],
        })
      )
      Config.invalidate()

      const result = await FamilyTool.execute({ action: "upcoming" }, mockCtx)
      expect(result.output).toContain("Alice (Wife)")
      expect(result.output).toContain("Tomorrow")
      expect(result.metadata?.count).toBe(1)
    })

    test("respects custom days limit", async () => {
      // Get date 5 days from now
      const future = new Date()
      future.setDate(future.getDate() + 5)
      const month = String(future.getMonth() + 1).padStart(2, "0")
      const day = String(future.getDate()).padStart(2, "0")
      const futureBirthday = `${month}-${day}`

      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          family: [
            { id: "f1", name: "Alice", relationship: "Wife", birthday: futureBirthday },
          ],
        })
      )
      Config.invalidate()

      // With 3 day limit, should not show
      const result1 = await FamilyTool.execute(
        { action: "upcoming", days: 3 },
        mockCtx
      )
      expect(result1.output).toContain("No birthdays")

      // With 10 day limit, should show
      const result2 = await FamilyTool.execute(
        { action: "upcoming", days: 10 },
        mockCtx
      )
      expect(result2.output).toContain("Alice")
      expect(result2.output).toContain("in 5 days")
    })

    test("shows appropriate text for today or tomorrow", async () => {
      // Use tomorrow to avoid timing issues with "today" comparisons
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const month = String(tomorrow.getMonth() + 1).padStart(2, "0")
      const day = String(tomorrow.getDate()).padStart(2, "0")
      const tomorrowBirthday = `${month}-${day}`

      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          family: [
            { id: "f1", name: "Alice", relationship: "Wife", birthday: tomorrowBirthday },
          ],
        })
      )
      Config.invalidate()

      const result = await FamilyTool.execute({ action: "upcoming" }, mockCtx)
      // Should show either TODAY! (if close to midnight) or Tomorrow
      expect(result.output).toMatch(/TODAY!|Tomorrow/)
    })

    test("sorts by proximity", async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const m1 = String(tomorrow.getMonth() + 1).padStart(2, "0")
      const d1 = String(tomorrow.getDate()).padStart(2, "0")

      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      const m2 = String(nextWeek.getMonth() + 1).padStart(2, "0")
      const d2 = String(nextWeek.getDate()).padStart(2, "0")

      await fs.writeFile(
        path.join(testDir, "config.json"),
        JSON.stringify({
          family: [
            { id: "f1", name: "Zara", relationship: "Friend", birthday: `${m2}-${d2}` },
            { id: "f2", name: "Alice", relationship: "Wife", birthday: `${m1}-${d1}` },
          ],
        })
      )
      Config.invalidate()

      const result = await FamilyTool.execute({ action: "upcoming" }, mockCtx)
      // Alice should come before Zara (tomorrow vs next week)
      expect(result.output.indexOf("Alice")).toBeLessThan(result.output.indexOf("Zara"))
    })
  })
})
