import React from "react"
import { Box, Text } from "ink"

/**
 * Message bubble component props
 */
export interface MessageBubbleProps {
  /** Message author role */
  role: "user" | "assistant"
  /** Message content text */
  content: string
  /** Optional timestamp as Unix milliseconds */
  timestamp?: number
}

/**
 * Format timestamp to human-readable time string
 */
function formatTime(ts: number): string {
  const date = new Date(ts)
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Message bubble component for displaying chat messages
 * User messages show 'You' in blueBright, assistant shows 'DadGPT' in gray
 */
export function MessageBubble({
  role,
  content,
  timestamp,
}: MessageBubbleProps): React.ReactElement {
  const isUser = role === "user"

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Role indicator with optional timestamp */}
      <Box>
        <Text color={isUser ? "blueBright" : "gray"} bold>
          {isUser ? "You" : "DadGPT"}
        </Text>
        {timestamp !== undefined && (
          <Text dimColor>
            {" · "}
            {formatTime(timestamp)}
          </Text>
        )}
      </Box>

      {/* Message content */}
      <Box>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  )
}
