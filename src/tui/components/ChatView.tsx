import React, { useState, useEffect } from "react"
import { Box, Text } from "ink"
import { MessageBubble } from "./MessageBubble"

/**
 * Message interface for chat messages
 */
export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
}

/**
 * ChatView component props
 */
export interface ChatViewProps {
  /** Array of messages to display */
  messages: Message[]
  /** Whether the AI is currently loading/thinking */
  isLoading?: boolean
}

/**
 * Simple inline spinner component for loading state
 * Uses braille characters for animation
 */
function LoadingSpinner(): React.ReactElement {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length)
    }, 80)
    return () => clearInterval(timer)
  }, [frames.length])

  return <Text color="blueBright">{frames[frame]}</Text>
}

/**
 * ChatView component displays conversation history
 * Renders MessageBubble for each message with empty state and loading indicator
 */
export function ChatView({
  messages,
  isLoading = false,
}: ChatViewProps): React.ReactElement {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.length === 0 ? (
        <Box paddingY={2}>
          <Text color="gray">
            Start a conversation by typing a message below.
          </Text>
        </Box>
      ) : (
        messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
          />
        ))
      )}

      {isLoading && (
        <Box>
          <LoadingSpinner />
          <Text color="gray"> Thinking...</Text>
        </Box>
      )}
    </Box>
  )
}
