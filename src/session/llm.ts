import { streamText, type LanguageModel } from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { Provider } from "../provider/provider.ts";
import { ToolRegistry } from "../tool/registry.ts";
import type { ToolContext } from "../tool/types.ts";
import { SessionManager, type Message } from "./session.ts";

const SYSTEM_PROMPT = `You are DadGPT, a helpful personal assistant focused on helping manage goals, todos, family life, and personal projects.

Your capabilities:
- Manage goals (create, track progress, complete) using the goal tool
- Manage todos (create, complete, defer, block) using the todo tool
- Track family information (birthdays, important dates) using the family tool
- Read and write files using the read and write tools
- Get smart suggestions and insights using the review tool
- Access Gmail (list, read, draft) using the gmail tool
- Manage calendar events using the calendar tool

Key behaviors:
- Be helpful, practical, and supportive
- Focus on actionable advice and concrete next steps
- Help break down large goals into manageable tasks
- Proactively remind about upcoming important dates and birthdays
- Keep responses concise but informative
- When the user asks general questions like "what should I focus on?" or "what's important today?", use the review tool to get suggestions
- When starting a new day or session, consider offering a daily review

Data is stored in dadgpt.md in the current directory. If it doesn't exist, suggest running 'dadgpt init' to create it.

When managing goals and todos:
- Goals have states: not_started, in_progress, paused, completed, abandoned
- Todos have states: pending, in_progress, blocked, deferred, done, cancelled
- Always confirm actions taken
- Suggest next steps when appropriate

Proactive behaviors:
- If you notice birthdays or important dates coming up, mention them
- If there are blocked todos, suggest ways to unblock them
- If goals have been stagnant, gently encourage progress
- Offer to do a weekly review on Sundays or when asked`;

export interface ChatOptions {
  sessionId: string;
  messages: Message[];
  provider?: string;
  model?: string;
  onTextChunk?: (text: string) => void;
  onToolCall?: (name: string, args: unknown) => void;
  onToolResult?: (name: string, result: string) => void;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
  finishReason: string;
}

export async function chat(options: ChatOptions): Promise<ChatResult> {
  const { sessionId, messages, onTextChunk, onToolCall, onToolResult, signal } = options;

  // Get the model
  const { model, provider, modelId } = await Provider.getModel(
    options.provider,
    options.model
  );

  // Create tool context
  const toolContext: ToolContext = {
    sessionId,
    workingDirectory: process.cwd(),
    ask: async (_tool: string, _resource: string) => {
      // For now, auto-approve all tool calls
      // In a full implementation, this would prompt the user
      return true;
    },
  };

  // Get tools in AI SDK format
  const tools = ToolRegistry.toAITools(toolContext);

  // Convert messages to ModelMessage format
  const modelMessages: ModelMessage[] = messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  // Stream the response
  const result = await streamText({
    model: model as LanguageModel,
    messages: modelMessages,
    tools,
    system: SYSTEM_PROMPT,
    abortSignal: signal,
  });

  let fullContent = "";

  // Process the stream
  for await (const chunk of result.fullStream) {
    switch (chunk.type) {
      case "text-delta":
        fullContent += chunk.text;
        onTextChunk?.(chunk.text);
        break;

      case "tool-call":
        onToolCall?.(chunk.toolName, chunk.input);
        break;

      case "tool-result":
        onToolResult?.(chunk.toolName, String(chunk.output));
        break;
    }
  }

  // Get final usage
  const usage = await result.usage;

  // Build usage info
  const usageInfo = usage?.inputTokens !== undefined && usage?.outputTokens !== undefined
    ? {
        promptTokens: usage.inputTokens,
        completionTokens: usage.outputTokens,
      }
    : undefined;

  // Save assistant message
  await SessionManager.addMessage(sessionId, {
    role: "assistant",
    content: fullContent,
    model: { provider, model: modelId },
    usage: usageInfo,
  });

  return {
    content: fullContent,
    usage: usageInfo,
    finishReason: await result.finishReason,
  };
}
