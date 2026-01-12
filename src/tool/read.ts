import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import { defineTool } from "./types.ts";

export const readTool = defineTool({
  name: "read",
  description: "Read the contents of a file. Use this to examine files in the current directory or dadgpt.md.",

  parameters: z.object({
    file_path: z.string().describe("Path to the file to read (relative or absolute)"),
    offset: z.number().optional().describe("Line number to start reading from (1-indexed)"),
    limit: z.number().optional().describe("Maximum number of lines to read"),
  }),

  async execute(args, ctx) {
    // Resolve path relative to working directory
    const filePath = path.isAbsolute(args.file_path)
      ? args.file_path
      : path.join(ctx.workingDirectory, args.file_path);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      let lines = content.split("\n");

      // Apply offset and limit
      if (args.offset && args.offset > 0) {
        lines = lines.slice(args.offset - 1);
      }
      if (args.limit && args.limit > 0) {
        lines = lines.slice(0, args.limit);
      }

      // Add line numbers
      const startLine = args.offset ?? 1;
      const numberedContent = lines
        .map((line, i) => `${String(startLine + i).padStart(4)} | ${line}`)
        .join("\n");

      return {
        title: `Read ${path.basename(filePath)}`,
        output: numberedContent || "(empty file)",
        metadata: {
          path: filePath,
          totalLines: content.split("\n").length,
          linesReturned: lines.length,
        },
      };
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === "ENOENT") {
        return {
          title: "File Not Found",
          output: `File not found: ${filePath}`,
          error: true,
        };
      }
      if (error.code === "EISDIR") {
        return {
          title: "Is a Directory",
          output: `${filePath} is a directory, not a file. Use 'ls' to list directory contents.`,
          error: true,
        };
      }
      return {
        title: "Read Error",
        output: `Error reading file: ${error.message}`,
        error: true,
      };
    }
  },
});
