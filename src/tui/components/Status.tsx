import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { colors } from "../theme.ts";

export type StatusType = "idle" | "thinking" | "tool" | "streaming";

interface StatusProps {
  status: StatusType;
  toolName?: string;
  message?: string;
}

export function Status({ status, toolName, message }: StatusProps) {
  if (status === "idle") {
    return null;
  }

  const getStatusText = () => {
    switch (status) {
      case "thinking":
        return message || "Thinking...";
      case "tool":
        return toolName ? `${toolName}...` : "Running tool...";
      case "streaming":
        return "";
      default:
        return "";
    }
  };

  const getColor = () => {
    switch (status) {
      case "thinking":
        return colors.thinking;  // magenta
      case "tool":
        return colors.toolCall;  // cyan
      case "streaming":
        return colors.streaming; // green
      default:
        return colors.textMuted;
    }
  };

  const statusText = getStatusText();
  if (!statusText) return null;

  return (
    <Box marginY={1}>
      <Text color={colors.textMuted}>{"∴ "}</Text>
      <Text color={getColor()}>
        <Spinner type="dots" />
      </Text>
      <Text color={getColor()}> {statusText}</Text>
      {status === "tool" && (
        <Text color={colors.textDim}> (esc to interrupt)</Text>
      )}
    </Box>
  );
}
