import { useState, useCallback, useRef, useEffect } from "react"
import { ChatLoop, type ChatLoopResult } from "../../session/loop"
import { Log } from "../../util/log"
import { ProviderError } from "../../util/errors"

/**
 * Tool call info for display in the UI
 */
export interface ToolCallInfo {
  toolId: string
  status: "running" | "completed" | "error"
  input?: unknown
  output?: string
  error?: string
}

/**
 * Hook for AI chat interactions.
 * Uses ChatLoop for full tool support and streaming responses.
 * Supports abort/cancellation via AbortController.
 */
export function useChat(sessionId?: string) {
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [error, setError] = useState<Error | null>(null)
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallInfo[]>([])
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
      setActiveToolCalls([])
    }
  }, [])

  /**
   * Send a message to the AI and stream the response.
   * Uses ChatLoop which handles tools, system prompts, and multi-turn tool execution.
   * Returns the result which includes content and tool calls made.
   */
  const sendMessage = useCallback(
    async (_content: string): Promise<ChatLoopResult | null> => {
      if (!sessionId) return null

      // Cancel any existing request
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      setIsLoading(true)
      setStreamingContent("")
      setError(null)
      setActiveToolCalls([])

      try {
        // Use ChatLoop.run() which handles tools, system prompts, and everything
        const result = await ChatLoop.run(sessionId, signal, {
          onTextChunk: (chunk) => {
            setStreamingContent((prev) => prev + chunk)
          },
          onToolStart: (toolId, input) => {
            setActiveToolCalls((prev) => [
              ...prev,
              { toolId, status: "running", input },
            ])
          },
          onToolComplete: (toolId, output) => {
            setActiveToolCalls((prev) =>
              prev.map((tc) =>
                tc.toolId === toolId && tc.status === "running"
                  ? { ...tc, status: "completed", output }
                  : tc
              )
            )
          },
          onToolError: (toolId, error) => {
            setActiveToolCalls((prev) =>
              prev.map((tc) =>
                tc.toolId === toolId && tc.status === "running"
                  ? { ...tc, status: "error", error }
                  : tc
              )
            )
          },
        })

        // Clear streaming content when done - ChatLoop saves the message
        setStreamingContent("")

        if (result.aborted) {
          Log.debug("AI request cancelled")
          return null
        }

        return result
      } catch (err) {
        // Don't report abort errors as actual errors
        if (err instanceof Error && err.name === "AbortError") {
          Log.debug("AI request aborted")
          return null
        }

        // Classify and handle different error types
        const classifiedError = classifyError(err)
        Log.formatAndLogError("AI request failed", err)
        setError(classifiedError)
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
    activeToolCalls,
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
