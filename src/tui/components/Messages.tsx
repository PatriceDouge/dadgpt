import React from "react";
import { Box, Text } from "ink";
import { colors } from "../theme.ts";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface MessagesProps {
  messages: Message[];
  streamingContent?: string;
}

export function Messages({ messages, streamingContent }: MessagesProps) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((msg, i) => (
        <MessageItem key={i} message={msg} />
      ))}
      {streamingContent && (
        <Box marginTop={1}>
          <Text color={colors.text}>{streamingContent}</Text>
        </Box>
      )}
    </Box>
  );
}

interface MessageItemProps {
  message: Message;
}

function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color={colors.textMuted}>{message.content}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      {isUser ? (
        <Box>
          <Text color={colors.user} bold>{"> "}</Text>
          <Box borderStyle="single" borderColor={colors.border} paddingX={1}>
            <Text color={colors.text}>{message.content}</Text>
          </Box>
        </Box>
      ) : (
        <Box>
          <Text color={colors.text}>{message.content}</Text>
        </Box>
      )}
    </Box>
  );
}
