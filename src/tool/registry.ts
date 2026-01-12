import { zodToJsonSchema } from "zod-to-json-schema";
import type { AnyToolDefinition, ToolContext, ToolResult } from "./types.ts";
import { goalTool } from "./goal.ts";
import { todoTool } from "./todo.ts";
import { readTool } from "./read.ts";
import { writeTool } from "./write.ts";
import { familyTool } from "./family.ts";
import { gmailTool } from "./gmail.ts";
import { calendarTool } from "./calendar.ts";
import { reviewTool } from "./review.ts";

// Registry of all available tools
const tools: AnyToolDefinition[] = [
  goalTool,
  todoTool,
  readTool,
  writeTool,
  familyTool,
  gmailTool,
  calendarTool,
  reviewTool,
];

export namespace ToolRegistry {
  export function getAll(): AnyToolDefinition[] {
    return tools;
  }

  export function get(name: string): AnyToolDefinition | undefined {
    return tools.find((t) => t.name === name);
  }

  export function getNames(): string[] {
    return tools.map((t) => t.name);
  }

  // Convert our tools to AI SDK format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function toAITools(ctx: ToolContext): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aiTools: Record<string, any> = {};

    for (const t of tools) {
      // Convert Zod schema to JSON Schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawSchema = zodToJsonSchema(t.parameters as any, {
        target: "openApi3",
        $refStrategy: "none",
      }) as Record<string, unknown>;

      // Remove $schema field that can cause issues
      const { $schema, ...jsonSchema } = rawSchema;

      aiTools[t.name] = {
        description: t.description,
        parameters: jsonSchema,
        execute: async (args: unknown) => {
          const result = await t.execute(args, ctx);
          return formatToolResult(result);
        },
      };
    }

    return aiTools;
  }

  // Format tool result for the AI
  function formatToolResult(result: ToolResult): string {
    if (result.error) {
      return `Error: ${result.output}`;
    }
    return result.output;
  }

  export function register(toolDef: AnyToolDefinition): void {
    // Check for duplicate
    const existing = tools.findIndex((t) => t.name === toolDef.name);
    if (existing >= 0) {
      tools[existing] = toolDef;
    } else {
      tools.push(toolDef);
    }
  }

  export function unregister(name: string): boolean {
    const index = tools.findIndex((t) => t.name === name);
    if (index >= 0) {
      tools.splice(index, 1);
      return true;
    }
    return false;
  }
}
