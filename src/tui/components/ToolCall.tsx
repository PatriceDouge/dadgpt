import React from "react"
import { Box, Text } from "ink"

/**
 * Tool execution status type
 */
export type ToolStatus = "pending" | "running" | "completed" | "error"

/**
 * Tool call display component props
 */
export interface ToolCallProps {
  /** Tool name/identifier */
  tool: string
  /** Current execution status */
  status: ToolStatus
  /** Input parameters passed to the tool */
  input?: Record<string, unknown>
  /** Tool output on successful completion */
  output?: string
  /** Error message on failure */
  error?: string
}

/**
 * Status icons for each tool state
 */
const STATUS_ICONS: Record<ToolStatus, string> = {
  pending: "○",
  running: "◐",
  completed: "●",
  error: "✗",
}

/**
 * Color mapping for each status
 */
const STATUS_COLORS: Record<ToolStatus, string> = {
  pending: "gray",
  running: "blueBright",
  completed: "green",
  error: "red",
}

/**
 * Truncate a string to a maximum length with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str
  }
  return str.slice(0, maxLength) + "..."
}

/**
 * Tool call display component
 * Shows tool execution status with visual indicators and truncated input/output
 */
export function ToolCall({
  tool,
  status,
  input,
  output,
  error,
}: ToolCallProps): React.ReactElement {
  const statusIcon = STATUS_ICONS[status]
  const statusColor = STATUS_COLORS[status]

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      marginY={1}
    >
      {/* Header: status icon, tool name, status text */}
      <Box>
        <Text color={statusColor}>{statusIcon} </Text>
        <Text color="white" bold>
          {tool}
        </Text>
        <Text color="gray"> · </Text>
        <Text color="gray">{status}</Text>
      </Box>

      {/* Input preview (truncated) */}
      {input && (
        <Box marginTop={0}>
          <Text dimColor>{truncate(JSON.stringify(input), 60)}</Text>
        </Box>
      )}

      {/* Output on completion (truncated) */}
      {status === "completed" && output && (
        <Box marginTop={0}>
          <Text color="gray">{truncate(output, 100)}</Text>
        </Box>
      )}

      {/* Error message on error */}
      {status === "error" && error && (
        <Box marginTop={0}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  )
}
