import { describe, test, expect, beforeEach, afterEach } from "vitest"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { ReadTool } from "../../../src/tool/read"
import { WriteTool } from "../../../src/tool/write"
import type { ToolContext } from "../../../src/tool/types"

describe("File Tools", () => {
  let testDir: string
  const mockCtx: ToolContext = { sessionId: "test-session" }

  beforeEach(async () => {
    // Create unique temp directory
    const random = Math.random().toString(36).substring(2, 15)
    testDir = path.join(
      os.tmpdir(),
      `dadgpt-file-test-${Date.now()}-${random}`
    )
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("ReadTool", () => {
    test("reads entire file content", async () => {
      const filePath = path.join(testDir, "test.txt")
      await fs.writeFile(filePath, "Line 1\nLine 2\nLine 3")

      const result = await ReadTool.execute({ path: filePath }, mockCtx)
      expect(result.title).toContain("test.txt")
      expect(result.output).toContain("1 | Line 1")
      expect(result.output).toContain("2 | Line 2")
      expect(result.output).toContain("3 | Line 3")
      expect(result.metadata?.totalLines).toBe(3)
    })

    test("supports offset parameter", async () => {
      const filePath = path.join(testDir, "test.txt")
      await fs.writeFile(filePath, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5")

      const result = await ReadTool.execute({ path: filePath, offset: 2 }, mockCtx)
      expect(result.output).not.toContain("Line 1")
      expect(result.output).not.toContain("Line 2")
      expect(result.output).toContain("3 | Line 3")
      expect(result.output).toContain("4 | Line 4")
      expect(result.metadata?.startLine).toBe(3)
    })

    test("supports limit parameter", async () => {
      const filePath = path.join(testDir, "test.txt")
      await fs.writeFile(filePath, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5")

      const result = await ReadTool.execute({ path: filePath, limit: 2 }, mockCtx)
      expect(result.output).toContain("Line 1")
      expect(result.output).toContain("Line 2")
      expect(result.output).not.toContain("Line 3")
      expect(result.metadata?.endLine).toBe(2)
    })

    test("supports both offset and limit", async () => {
      const filePath = path.join(testDir, "test.txt")
      await fs.writeFile(filePath, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5")

      const result = await ReadTool.execute(
        { path: filePath, offset: 1, limit: 2 },
        mockCtx
      )
      expect(result.output).not.toContain("Line 1")
      expect(result.output).toContain("2 | Line 2")
      expect(result.output).toContain("3 | Line 3")
      expect(result.output).not.toContain("Line 4")
    })

    test("returns error for non-existent file", async () => {
      const result = await ReadTool.execute(
        { path: path.join(testDir, "nonexistent.txt") },
        mockCtx
      )
      expect(result.title).toBe("Error")
      expect(result.output).toContain("File not found")
    })

    test("returns error for directory", async () => {
      const result = await ReadTool.execute({ path: testDir }, mockCtx)
      expect(result.title).toBe("Error")
      expect(result.output).toContain("directory")
    })

    test("handles relative path", async () => {
      const filePath = path.join(testDir, "test.txt")
      await fs.writeFile(filePath, "Content")

      // Change to test directory and use relative path
      const originalCwd = process.cwd()
      try {
        process.chdir(testDir)
        const result = await ReadTool.execute({ path: "test.txt" }, mockCtx)
        expect(result.title).toContain("test.txt")
        expect(result.output).toContain("Content")
      } finally {
        process.chdir(originalCwd)
      }
    })
  })

  describe("WriteTool", () => {
    test("writes content to new file", async () => {
      const filePath = path.join(testDir, "new.txt")

      const result = await WriteTool.execute(
        { path: filePath, content: "Hello, World!" },
        mockCtx
      )

      expect(result.title).toContain("Created")
      expect(result.metadata?.bytesWritten).toBe(13)

      const content = await fs.readFile(filePath, "utf-8")
      expect(content).toBe("Hello, World!")
    })

    test("overwrites existing file", async () => {
      const filePath = path.join(testDir, "existing.txt")
      await fs.writeFile(filePath, "Old content")

      const result = await WriteTool.execute(
        { path: filePath, content: "New content" },
        mockCtx
      )

      expect(result.title).toContain("Overwrote")

      const content = await fs.readFile(filePath, "utf-8")
      expect(content).toBe("New content")
    })

    test("supports append mode", async () => {
      const filePath = path.join(testDir, "append.txt")
      await fs.writeFile(filePath, "Original")

      const result = await WriteTool.execute(
        { path: filePath, content: "\nAppended", append: true },
        mockCtx
      )

      expect(result.title).toContain("Appended")

      const content = await fs.readFile(filePath, "utf-8")
      expect(content).toBe("Original\nAppended")
    })

    test("creates parent directories", async () => {
      const filePath = path.join(testDir, "sub", "dir", "new.txt")

      const result = await WriteTool.execute(
        { path: filePath, content: "Content" },
        mockCtx
      )

      expect(result.title).toContain("Created")

      const content = await fs.readFile(filePath, "utf-8")
      expect(content).toBe("Content")
    })

    test("respects createDirectories option", async () => {
      const filePath = path.join(testDir, "sub2", "new.txt")

      const result = await WriteTool.execute(
        { path: filePath, content: "Content", createDirectories: false },
        mockCtx
      )

      expect(result.title).toBe("Error")
      expect(result.output).toContain("Parent directory does not exist")
    })

    test("handles relative path", async () => {
      const originalCwd = process.cwd()
      try {
        process.chdir(testDir)
        const result = await WriteTool.execute(
          { path: "relative.txt", content: "Content" },
          mockCtx
        )

        expect(result.title).toContain("Created")

        const content = await fs.readFile(
          path.join(testDir, "relative.txt"),
          "utf-8"
        )
        expect(content).toBe("Content")
      } finally {
        process.chdir(originalCwd)
      }
    })
  })
})
