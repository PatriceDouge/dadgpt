import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { Storage } from "../../src/storage/storage"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"

describe("Storage", () => {
  let testDir: string

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = path.join(os.tmpdir(), `dadgpt-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(testDir, { recursive: true })
    // Override DATA_DIR for tests
    process.env.DADGPT_DATA_DIR = testDir
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

  test("write and read roundtrip", async () => {
    const data = { name: "Test Goal", value: 42, nested: { key: "value" } }
    await Storage.write(["test", "item"], data)
    const result = await Storage.read<typeof data>(["test", "item"])
    expect(result).toEqual(data)
  })

  test("read non-existent returns undefined", async () => {
    const result = await Storage.read(["nonexistent", "file"])
    expect(result).toBeUndefined()
  })

  test("update creates if not exists", async () => {
    interface CounterData {
      count: number
    }
    const result = await Storage.update<CounterData>(["new", "counter"], (prev) => ({
      count: (prev?.count ?? 0) + 1,
    }))
    expect(result).toEqual({ count: 1 })

    // Verify it was persisted
    const persisted = await Storage.read<CounterData>(["new", "counter"])
    expect(persisted).toEqual({ count: 1 })
  })

  test("update modifies existing", async () => {
    interface CounterData {
      count: number
    }
    // Write initial data
    await Storage.write(["counter"], { count: 5 })

    // Update it
    const result = await Storage.update<CounterData>(["counter"], (prev) => ({
      count: (prev?.count ?? 0) + 1,
    }))
    expect(result).toEqual({ count: 6 })

    // Verify it was persisted
    const persisted = await Storage.read<CounterData>(["counter"])
    expect(persisted).toEqual({ count: 6 })
  })

  test("list returns json file names without extension", async () => {
    // Write multiple items
    await Storage.write(["items", "alpha"], { id: "alpha" })
    await Storage.write(["items", "beta"], { id: "beta" })
    await Storage.write(["items", "gamma"], { id: "gamma" })

    const list = await Storage.list(["items"])
    expect(list.sort()).toEqual(["alpha", "beta", "gamma"])
  })

  test("list returns empty array for non-existent directory", async () => {
    const list = await Storage.list(["nonexistent", "directory"])
    expect(list).toEqual([])
  })

  test("remove deletes file", async () => {
    // Create a file
    await Storage.write(["todelete"], { data: true })
    expect(await Storage.exists(["todelete"])).toBe(true)

    // Remove it
    const result = await Storage.remove(["todelete"])
    expect(result).toBe(true)

    // Verify it's gone
    expect(await Storage.exists(["todelete"])).toBe(false)
  })

  test("remove returns false for non-existent file", async () => {
    const result = await Storage.remove(["nonexistent"])
    expect(result).toBe(false)
  })

  test("exists returns correct boolean", async () => {
    // File doesn't exist yet
    expect(await Storage.exists(["checkme"])).toBe(false)

    // Create the file
    await Storage.write(["checkme"], { exists: true })

    // Now it exists
    expect(await Storage.exists(["checkme"])).toBe(true)
  })

  test("ensureDir creates data directory", async () => {
    // Remove the test dir to verify ensureDir creates it
    await fs.rm(testDir, { recursive: true, force: true })

    // Verify it doesn't exist
    await expect(fs.access(testDir)).rejects.toThrow()

    // Ensure dir
    await Storage.ensureDir()

    // Now it should exist
    await expect(fs.access(testDir)).resolves.toBeUndefined()
  })

  test("write creates nested directories", async () => {
    const data = { deeply: "nested" }
    await Storage.write(["a", "b", "c", "d"], data)

    const result = await Storage.read<typeof data>(["a", "b", "c", "d"])
    expect(result).toEqual(data)
  })

  test("write overwrites existing data", async () => {
    await Storage.write(["overwrite"], { version: 1 })
    await Storage.write(["overwrite"], { version: 2 })

    const result = await Storage.read<{ version: number }>(["overwrite"])
    expect(result).toEqual({ version: 2 })
  })
})
