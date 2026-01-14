import { useState, useCallback, useRef, useEffect } from "react"
import { streamText, type CoreMessage } from "ai"
import { Config } from "../../config/config"
import { Storage } from "../../storage/storage"
import { Log } from "../../util/log"
import { ProviderError } from "../../util/errors"
import { Provider } from "../../provider/provider"
import type { Message } from "./useSession"

/**
 * Hook for AI chat interactions.
 * Handles sending messages to the LLM and streaming responses.
 * Supports abort/cancellation via AbortController.
 */
export function useChat(sessionId?: string) {
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  /**
   * Cancel any ongoing AI request.
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
      setStreamingContent("")
    }
  }, [])

  /**
   * Send a message to the AI and stream the response.
   * Loads config, gets model, streams response.
   * Returns the final content so the caller can save it to the session.
   */
  const sendMessage = useCallback(
    async (_content: string): Promise<string | null> => {
      if (!sessionId) return null

      // Cancel any existing request
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      setIsLoading(true)
      setStreamingContent("")
      setError(null)

      try {
        const config = await Config.get()
        const model = await Provider.getModel(config.defaultProvider, config.defaultModel)

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

        // Stream the response with abort signal
        const result = streamText({
          model,
          messages: history,
          abortSignal: signal,
        })

        let fullContent = ""

        // Update streaming content as chunks arrive
        for await (const chunk of result.textStream) {
          // Check for abort between chunks
          if (signal.aborted) {
            Log.debug("AI request cancelled")
            return null
          }
          fullContent += chunk
          setStreamingContent(fullContent)
        }

        // Don't return content if the request was aborted
        if (signal.aborted) {
          return null
        }

        // Clear streaming content - caller will add to messages
        setStreamingContent("")

        // Return the full content for the caller to save
        return fullContent
      } catch (err) {
        // Don't report abort errors as actual errors
        if (err instanceof Error && err.name === "AbortError") {
          Log.debug("AI request aborted")
          return null
        }

        // Classify and handle different error types
        const error = classifyError(err)
        Log.formatAndLogError("AI request failed", err)
        setError(error)
        return null
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [sessionId]
  )

  return {
    isLoading,
    streamingContent,
    error,
    sendMessage,
    cancel,
  }
}

/**
 * Classify an error into a user-friendly error type.
 * Handles network errors, API errors, and other common issues.
 */
function classifyError(err: unknown): Error {
  if (err instanceof Error) {
    const message = err.message.toLowerCase()

    // Network errors
    if (
      message.includes("fetch failed") ||
      message.includes("network") ||
      message.includes("enotfound") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("econnreset")
    ) {
      return new ProviderError(
        "Network error: Unable to connect to AI provider. Please check your internet connection.",
        "NETWORK_ERROR"
      )
    }

    // API key errors
    if (
      message.includes("unauthorized") ||
      message.includes("invalid api key") ||
      message.includes("authentication") ||
      message.includes("401")
    ) {
      return new ProviderError(
        "Authentication error: Invalid or missing API key. Run 'dadgpt auth' to configure.",
        "AUTH_ERROR"
      )
    }

    // Rate limit errors
    if (message.includes("rate limit") || message.includes("429")) {
      return new ProviderError(
        "Rate limit exceeded. Please wait a moment and try again.",
        "RATE_LIMIT"
      )
    }

    // Service errors
    if (
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("service")
    ) {
      return new ProviderError(
        "AI service temporarily unavailable. Please try again later.",
        "SERVICE_ERROR"
      )
    }

    // Timeout errors
    if (message.includes("timeout") || message.includes("timed out")) {
      return new ProviderError(
        "Request timed out. Please try again.",
        "TIMEOUT_ERROR"
      )
    }

    // Return the original error if we can't classify it
    return err
  }

  return new Error("Unknown error occurred")
}
