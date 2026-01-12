import { z } from "zod";

export interface ToolContext {
  sessionId: string;
  workingDirectory: string;
  ask: (tool: string, resource: string) => Promise<boolean>;
}

export interface ToolResult {
  title: string;
  output: string;
  metadata?: Record<string, unknown>;
  error?: boolean;
}

export interface ToolDefinition<TParams extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  parameters: TParams;
  execute: (args: z.infer<TParams>, ctx: ToolContext) => Promise<ToolResult>;
}

export type AnyToolDefinition = ToolDefinition<z.ZodType>;

// Helper to create tools with proper typing
export function defineTool<TParams extends z.ZodType>(
  tool: ToolDefinition<TParams>
): ToolDefinition<TParams> {
  return tool;
}
