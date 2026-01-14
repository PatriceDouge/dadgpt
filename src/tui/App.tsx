import React, { useState, useEffect, useRef } from "react"
import { Box, Text } from "ink"
import { Header } from "./components/Header"
import { ChatView } from "./components/ChatView"
import { InputBox } from "./components/InputBox"
import { useSession, type Message } from "./hooks/useSession"
import { useChat } from "./hooks/useChat"
import { useKeyboard } from "./hooks/useKeyboard"
import { Config, type Config as ConfigType } from "../config/config"

/**
 * Main App component props
 */
export interface AppProps {
  /** Initial message to send when app starts */
  initialMessage?: string
  /** Existing session ID to continue */
  sessionId?: string
}

/**
 * Main TUI App component.
 * Composes Header, ChatView, and InputBox components.
 * Uses useSession, useChat, and useKeyboard hooks.
 */
export function App({
  initialMessage,
  sessionId,
}: AppProps): React.ReactElement {
  const [config, setConfig] = useState<ConfigType | null>(null)
  const initialMessageSent = useRef(false)

  // Use hooks for session management and chat
  const { session, messages, addMessage, refreshMessages } = useSession(sessionId)

  const { isLoading, streamingContent, sendMessage } = useChat(session?.id)

  // Handle keyboard shortcuts (Ctrl+C, Escape)
  useKeyboard()

  // Load config on mount
  useEffect(() => {
    Config.get().then(setConfig)
  }, [])

  // Send initial message if provided (only once when session is ready)
  useEffect(() => {
    if (initialMessage && session && !initialMessageSent.current) {
      initialMessageSent.current = true
      handleSubmit(initialMessage)
    }
  }, [initialMessage, session?.id])

  /**
   * Handle message submission from input box.
   * Adds user message to session, sends to AI via ChatLoop which handles tools.
   */
  const handleSubmit = async (content: string): Promise<void> => {
    if (!session) return

    // Add user message to local state and storage
    await addMessage({
      role: "user",
      content,
    })

    // Send to AI via ChatLoop (handles tools, saves assistant reply to storage)
    await sendMessage(content)

    // Refresh messages from storage to get the assistant's reply
    await refreshMessages()
  }

  // Show loading state while config is loading
  if (!config) {
    return (
      <Box>
        <Text color="gray">Loading...</Text>
      </Box>
    )
  }

  // Combine stored messages with streaming content for display
  const displayMessages: Message[] = [
    ...messages,
    ...(streamingContent
      ? [
          {
            id: "streaming",
            role: "assistant" as const,
            content: streamingContent,
            timestamp: Date.now(),
          },
        ]
      : []),
  ]

  return (
    <Box flexDirection="column" height="100%">
      {/* Header with logo */}
      <Header
        model={config.defaultModel}
        provider={config.defaultProvider}
        cwd={process.cwd()}
      />

      {/* Chat messages */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        <ChatView
          messages={displayMessages}
          isLoading={isLoading && !streamingContent}
        />
      </Box>

      {/* Input area */}
      <Box marginTop={1}>
        <InputBox
          onSubmit={handleSubmit}
          disabled={isLoading}
          placeholder={isLoading ? "Waiting for response..." : "Type a message..."}
        />
      </Box>
    </Box>
  )
}
