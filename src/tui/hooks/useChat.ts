import { useState, useCallback } from "react"
import { streamText, type CoreMessage } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import { Config } from "../../config/config"
import { Storage } from "../../storage/storage"
import { createId } from "../../util/id"
import type { Message } from "./useSession"

/**
 * Get the language model based on provider and model configuration.
 * Reads API keys from environment variables.
 */
function getModel(provider: string, model: string) {
  switch (provider) {
    case "anthropic":
      return anthropic(model)
    case "openai":
      return openai(model)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Hook for AI chat interactions.
 * Handles sending messages to the LLM and streaming responses.
 */
export function useChat(sessionId?: string) {
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [error, setError] = useState<Error | null>(null)

  /**
   * Send a message to the AI and stream the response.
   * Loads config, gets model, streams response, and saves to storage.
   */
  const sendMessage = useCallback(
    async (_content: string) => {
      if (!sessionId) return

      setIsLoading(true)
      setStreamingContent("")
      setError(null)

      try {
        const config = await Config.get()
        const model = getModel(config.defaultProvider, config.defaultModel)

        // Load conversation history
        const msgIds = await Storage.list(["sessions", sessionId, "messages"])
        const loadedMessages = await Promise.all(
          msgIds.map((id) =>
            Storage.read<Message>(["sessions", sessionId, "messages", id])
          )
        )

        // Sort by timestamp and convert to AI SDK format
        const history: CoreMessage[] = loadedMessages
          .filter((msg): msg is Message => msg !== undefined)
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }))

        // Stream the response
        const result = streamText({
          model,
          messages: history,
        })

        let fullContent = ""

        // Update streaming content as chunks arrive
        for await (const chunk of result.textStream) {
          fullContent += chunk
          setStreamingContent(fullContent)
        }

        // Save assistant message to storage when complete
        const assistantMessage: Message = {
          id: createId(),
          role: "assistant",
          content: fullContent,
          timestamp: Date.now(),
        }

        await Storage.write(
          ["sessions", sessionId, "messages", assistantMessage.id],
          assistantMessage
        )

        // Clear streaming content after saving
        setStreamingContent("")
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Unknown error occurred")
        setError(error)
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId]
  )

  return {
    isLoading,
    streamingContent,
    error,
    sendMessage,
  }
}
