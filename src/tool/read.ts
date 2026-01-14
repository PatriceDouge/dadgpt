import { z } from "zod"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { Tool, ToolContext, ToolResult } from "./types"

/**
 * Parameters schema for the read tool
 */
const ReadToolParams = z.object({
  path: z.string().describe("Absolute or relative path to the file to read"),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Line number to start reading from (0-indexed)"),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Maximum number of lines to read"),
})

type ReadToolArgs = z.infer<typeof ReadToolParams>

/**
 * Resolve a path to an absolute path
 */
function resolvePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath
  }
  return path.resolve(process.cwd(), filePath)
}

/**
 * Execute the read tool
 */
async function executeReadTool(
  args: ReadToolArgs,
  _ctx: ToolContext
): Promise<ToolResult> {
  const filePath = resolvePath(args.path)

  try {
    // Check if file exists
    await fs.access(filePath)

    // Get file stats
    const stats = await fs.stat(filePath)

    if (stats.isDirectory()) {
      return {
        title: "Error",
        output: `Path is a directory, not a file: ${filePath}`,
      }
    }

    // Read file content
    const content = await fs.readFile(filePath, "utf-8")
    const lines = content.split("\n")

    // Apply offset and limit
    const offset = args.offset ?? 0
    const limit = args.limit ?? lines.length
    const selectedLines = lines.slice(offset, offset + limit)

    // Format output with line numbers
    const lineNumberWidth = String(offset + selectedLines.length).length
    const formattedContent = selectedLines
      .map((line, index) => {
        const lineNum = String(offset + index + 1).padStart(lineNumberWidth, " ")
        return `${lineNum} | ${line}`
      })
      .join("\n")

    const metadata: Record<string, unknown> = {
      path: filePath,
      totalLines: lines.length,
      startLine: offset + 1,
      endLine: Math.min(offset + limit, lines.length),
      bytesRead: content.length,
    }

    return {
      title: `File: ${path.basename(filePath)}`,
      output: formattedContent,
      metadata,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error)

    // Check for specific error types
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        title: "Error",
        output: `File not found: ${filePath}`,
      }
    }

    if ((error as NodeJS.ErrnoException).code === "EACCES") {
      return {
        title: "Error",
        output: `Permission denied: ${filePath}`,
      }
    }

    return {
      title: "Error",
      output: `Failed to read file: ${errorMessage}`,
    }
  }
}

/**
 * Read Tool - Reads file content with optional offset and limit
 */
export const ReadTool: Tool<typeof ReadToolParams> = {
  id: "read",
  description: `Read the contents of a file. Supports reading partial files with offset and limit.
- path: The file path to read (absolute or relative to current directory)
- offset: Optional starting line number (0-indexed, default: 0)
- limit: Optional maximum number of lines to read (default: all lines)

Output includes line numbers for easy reference.`,
  parameters: ReadToolParams,
  execute: executeReadTool,
}
