import { z } from "zod"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { Tool, ToolContext, ToolResult } from "./types"

/**
 * Parameters schema for the write tool
 */
const WriteToolParams = z.object({
  path: z.string().describe("Absolute or relative path to the file to write"),
  content: z.string().describe("The content to write to the file"),
  append: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, append to existing file instead of overwriting"),
  createDirectories: z
    .boolean()
    .optional()
    .default(true)
    .describe("If true, create parent directories if they don't exist"),
})

type WriteToolArgs = z.infer<typeof WriteToolParams>

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
 * Execute the write tool
 */
async function executeWriteTool(
  args: WriteToolArgs,
  _ctx: ToolContext
): Promise<ToolResult> {
  const filePath = resolvePath(args.path)
  const content = args.content
  const append = args.append ?? false
  const createDirectories = args.createDirectories ?? true

  try {
    // Create parent directories if needed
    if (createDirectories) {
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })
    }

    // Check if file exists (for metadata)
    let fileExisted = false
    let previousSize = 0
    try {
      const stats = await fs.stat(filePath)
      fileExisted = true
      previousSize = stats.size

      if (stats.isDirectory()) {
        return {
          title: "Error",
          output: `Path is a directory, not a file: ${filePath}`,
        }
      }
    } catch {
      // File doesn't exist, which is fine
    }

    // Write or append to file
    if (append) {
      await fs.appendFile(filePath, content, "utf-8")
    } else {
      await fs.writeFile(filePath, content, "utf-8")
    }

    // Get new file stats
    const newStats = await fs.stat(filePath)

    const action = append ? "Appended to" : fileExisted ? "Overwrote" : "Created"
    const lines = content.split("\n").length

    const metadata: Record<string, unknown> = {
      path: filePath,
      action: append ? "append" : "write",
      bytesWritten: content.length,
      totalBytes: newStats.size,
      linesWritten: lines,
      previouslyExisted: fileExisted,
    }

    if (fileExisted && !append) {
      metadata.previousSize = previousSize
    }

    return {
      title: `${action}: ${path.basename(filePath)}`,
      output: `${action} file: ${filePath}\n\nBytes written: ${content.length}\nTotal file size: ${newStats.size} bytes\nLines: ${lines}`,
      metadata,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error)

    // Check for specific error types
    if ((error as NodeJS.ErrnoException).code === "EACCES") {
      return {
        title: "Error",
        output: `Permission denied: ${filePath}`,
      }
    }

    if ((error as NodeJS.ErrnoException).code === "ENOENT" && !args.createDirectories) {
      return {
        title: "Error",
        output: `Parent directory does not exist: ${path.dirname(filePath)}`,
      }
    }

    if ((error as NodeJS.ErrnoException).code === "EROFS") {
      return {
        title: "Error",
        output: `Read-only file system: ${filePath}`,
      }
    }

    return {
      title: "Error",
      output: `Failed to write file: ${errorMessage}`,
    }
  }
}

/**
 * Write Tool - Writes content to a file
 */
export const WriteTool: Tool<typeof WriteToolParams> = {
  id: "write",
  description: `Write content to a file. Can create new files or overwrite/append to existing ones.
- path: The file path to write (absolute or relative to current directory)
- content: The content to write to the file
- append: If true, append to existing file instead of overwriting (default: false)
- createDirectories: If true, create parent directories if they don't exist (default: true)`,
  parameters: WriteToolParams,
  execute: executeWriteTool,
}
