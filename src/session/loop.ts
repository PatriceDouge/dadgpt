/**
 * Chat loop for processing AI conversations with tool calls.
 * The main chat processing loop that handles LLM interactions.
 */

import { streamText, type CoreMessage } from "ai"
import { Session } from "./session"
import { Config } from "../config/config"
import { Provider } from "../provider/provider"
import { ToolRegistry } from "../tool/registry"
import { getDefaultAgent } from "../agent/dad"
import { Bus } from "../bus/bus"
import { createId } from "../util/id"
import type { ToolContext } from "../tool/types"

/**
 * Result from a chat loop iteration
 */
export interface ChatLoopResult {
  /** The final assistant response content */
  content: string
  /** Tool calls made during the loop */
  toolCalls: Array<{
    id: string
    toolId: string
    input: unknown
    output: string
  }>
  /** Whether the loop was aborted */
  aborted: boolean
  /** Usage statistics (if available) */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Options for running the chat loop
 */
export interface ChatLoopOptions {
  /** Maximum number of iterations (tool call rounds) before stopping */
  maxIterations?: number
  /** Callback for streaming text chunks */
  onTextChunk?: (chunk: string) => void
  /** Callback when a tool starts execution */
  onToolStart?: (toolId: string, input: unknown) => void
  /** Callback when a tool completes */
  onToolComplete?: (toolId: string, output: string) => void
  /** Callback when a tool errors */
  onToolError?: (toolId: string, error: string) => void
}

const DEFAULT_MAX_ITERATIONS = 10

/**
 * Chat loop namespace for running AI conversations
 */
export namespace ChatLoop {
  /**
   * Run the main chat loop for a session.
   *
   * This function:
   * 1. Loads messages from the session
   * 2. Calls the LLM with the messages and tools
   * 3. Processes any tool calls
   * 4. Continues until the assistant finishes without tool calls or max iterations reached
   *
   * @param sessionId - The session ID to run the loop for
   * @param signal - Optional abort signal for cancellation
   * @param options - Optional configuration for the loop
   * @returns The result of the chat loop
   */
  export async function run(
    sessionId: string,
    signal?: AbortSignal,
    options: ChatLoopOptions = {}
  ): Promise<ChatLoopResult> {
    const {
      maxIterations = DEFAULT_MAX_ITERATIONS,
      onTextChunk,
      onToolStart,
      onToolComplete,
      onToolError,
    } = options

    // Check if already aborted
    if (signal?.aborted) {
      return {
        content: "",
        toolCalls: [],
        aborted: true,
      }
    }

    // Load config and get model
    const config = await Config.get()
    const model = await Provider.getModel(
      config.defaultProvider,
      config.defaultModel
    )

    // Get the default agent and its system prompt
    const agent = getDefaultAgent()

    // Load session messages
    const sessionMessages = await Session.getMessages(sessionId)

    // Convert to CoreMessage format for AI SDK
    const messages: CoreMessage[] = sessionMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    // Create tool context
    const toolCtx: ToolContext = { sessionId }

    // Get tools formatted for AI SDK
    const tools = ToolRegistry.getToolsForAI(toolCtx)

    // Track all tool calls made
    const allToolCalls: ChatLoopResult["toolCalls"] = []

    // Track final content
    let finalContent = ""

    // Track usage
    const totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    }

    // Run the loop
    let iteration = 0
    while (iteration < maxIterations) {
      // Check for abort
      if (signal?.aborted) {
        return {
          content: finalContent,
          toolCalls: allToolCalls,
          aborted: true,
          usage: totalUsage,
        }
      }

      iteration++

      // Call the LLM with streaming
      const result = await streamText({
        model,
        system: agent.systemPrompt,
        messages,
        tools,
        maxSteps: 1, // We handle the loop ourselves for more control
        abortSignal: signal,
      })

      // Collect the streamed text
      let iterationContent = ""
      for await (const chunk of result.textStream) {
        iterationContent += chunk
        onTextChunk?.(chunk)

        // Check for abort during streaming
        if (signal?.aborted) {
          return {
            content: finalContent + iterationContent,
            toolCalls: allToolCalls,
            aborted: true,
            usage: totalUsage,
          }
        }
      }

      // Get the full response including tool calls
      const response = await result.response
      const usage = await result.usage

      // Update usage totals
      if (usage) {
        totalUsage.promptTokens += usage.promptTokens
        totalUsage.completionTokens += usage.completionTokens
        totalUsage.totalTokens += usage.totalTokens
      }

      // Check for tool calls in the response
      const lastMessage = response.messages[response.messages.length - 1]
      const hasToolCalls =
        lastMessage &&
        lastMessage.role === "assistant" &&
        Array.isArray(lastMessage.content) &&
        lastMessage.content.some((part) => part.type === "tool-call")

      if (!hasToolCalls) {
        // No tool calls - we're done
        finalContent = iterationContent
        break
      }

      // Process tool calls
      if (lastMessage && lastMessage.role === "assistant" && Array.isArray(lastMessage.content)) {
        const toolCallParts = lastMessage.content.filter(
          (part): part is { type: "tool-call"; toolCallId: string; toolName: string; args: unknown } =>
            part.type === "tool-call"
        )

        // Execute each tool call
        const toolResults: CoreMessage[] = []

        for (const toolCall of toolCallParts) {
          const toolCallId = createId()

          // Notify about tool start
          Bus.publish("tool.start", {
            toolId: toolCall.toolName,
            args: toolCall.args,
          })
          onToolStart?.(toolCall.toolName, toolCall.args)

          try {
            // Get and execute the tool
            const tool = tools[toolCall.toolName]
            if (!tool) {
              throw new Error(`Tool not found: ${toolCall.toolName}`)
            }

            const output = await tool.execute(toolCall.args, { abortSignal: signal })

            // Track the tool call
            allToolCalls.push({
              id: toolCallId,
              toolId: toolCall.toolName,
              input: toolCall.args,
              output,
            })

            // Notify about tool completion
            Bus.publish("tool.complete", {
              toolId: toolCall.toolName,
              result: output,
            })
            onToolComplete?.(toolCall.toolName, output)

            // Add tool result to messages
            toolResults.push({
              role: "tool",
              content: [
                {
                  type: "tool-result",
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  result: output,
                },
              ],
            })
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error)

            // Track the failed tool call
            allToolCalls.push({
              id: toolCallId,
              toolId: toolCall.toolName,
              input: toolCall.args,
              output: `Error: ${errorMessage}`,
            })

            // Notify about tool error
            Bus.publish("tool.error", {
              toolId: toolCall.toolName,
              error: errorMessage,
            })
            onToolError?.(toolCall.toolName, errorMessage)

            // Add error result to messages
            toolResults.push({
              role: "tool",
              content: [
                {
                  type: "tool-result",
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  result: `Error: ${errorMessage}`,
                  isError: true,
                },
              ],
            })
          }
        }

        // Add the assistant message with tool calls to the conversation
        messages.push(lastMessage as CoreMessage)

        // Add the tool results to the conversation
        messages.push(...toolResults)
      }
    }

    // Save the final assistant message to the session
    if (finalContent) {
      await Session.addMessage(sessionId, {
        role: "assistant",
        content: finalContent,
      })
    }

    return {
      content: finalContent,
      toolCalls: allToolCalls,
      aborted: false,
      usage: totalUsage,
    }
  }
}
