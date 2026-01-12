import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import { defineTool } from "./types.ts";

export const writeTool = defineTool({
  name: "write",
  description: "Write content to a file. Creates the file if it doesn't exist, or overwrites if it does. Creates parent directories as needed.",

  parameters: z.object({
    file_path: z.string().describe("Path to the file to write (relative or absolute)"),
    content: z.string().describe("Content to write to the file"),
    append: z.boolean().optional().describe("If true, append to file instead of overwriting"),
  }),

  async execute(args, ctx) {
    // Resolve path relative to working directory
    const filePath = path.isAbsolute(args.file_path)
      ? args.file_path
      : path.join(ctx.workingDirectory, args.file_path);

    try {
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Backup existing file if it exists
      try {
        const existing = await fs.readFile(filePath, "utf-8");
        await fs.writeFile(filePath + ".bak", existing);
      } catch {
        // No existing file to backup
      }

      // Write the file
      if (args.append) {
        await fs.appendFile(filePath, args.content);
      } else {
        await fs.writeFile(filePath, args.content);
      }

      const lineCount = args.content.split("\n").length;

      return {
        title: `Wrote ${path.basename(filePath)}`,
        output: `Successfully ${args.append ? "appended to" : "wrote"} ${filePath} (${lineCount} lines)`,
        metadata: {
          path: filePath,
          lines: lineCount,
          bytes: Buffer.byteLength(args.content),
          append: args.append ?? false,
        },
      };
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      return {
        title: "Write Error",
        output: `Error writing file: ${error.message}`,
        error: true,
      };
    }
  },
});
