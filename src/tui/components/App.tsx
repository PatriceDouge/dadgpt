import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Header } from "./Header.tsx";
import { Messages, type Message } from "./Messages.tsx";
import { Input } from "./Input.tsx";
import { Status, type StatusType } from "./Status.tsx";
import { Footer } from "./Footer.tsx";
import { colors } from "../theme.ts";

interface AppProps {
  version: string;
  model: string;
  provider: string;
  cwd: string;
  onMessage: (
    message: string,
    callbacks: {
      onStatus: (status: StatusType, toolName?: string, message?: string) => void;
      onChunk: (text: string) => void;
      onComplete: (response: string) => void;
      onError: (error: string) => void;
    }
  ) => Promise<void>;
  initialMessages?: Message[];
}

export function App({
  version,
  model,
  provider,
  cwd,
  onMessage,
  initialMessages = [],
}: AppProps) {
  const { exit } = useApp();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [status, setStatus] = useState<StatusType>("idle");
  const [statusTool, setStatusTool] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Handle escape to interrupt
  useInput((inputKey, key) => {
    if (key.escape && status !== "idle") {
      setStatus("idle");
      setStreamingContent("");
      // Could add abort controller here
    }
    if (key.ctrl && inputKey === "c") {
      exit();
    }
  });

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || status !== "idle") return;

      // Handle special commands
      if (trimmed === "/exit" || trimmed === "/quit") {
        exit();
        return;
      }

      if (trimmed === "/clear") {
        setMessages([]);
        setInput("");
        return;
      }

      if (trimmed === "/help") {
        setMessages((prev) => [
          ...prev,
          {
            role: "system" as const,
            content: `Commands:
  /help   - Show this help
  /clear  - Clear conversation
  /goals  - Show goals
  /todos  - Show todos
  /exit   - Exit DadGPT`,
          },
        ]);
        setInput("");
        return;
      }

      // Add user message
      const userMessage: Message = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setError(null);
      setStreamingContent("");

      // Call the message handler
      await onMessage(trimmed, {
        onStatus: (newStatus, toolName, message) => {
          setStatus(newStatus);
          setStatusTool(toolName);
          setStatusMessage(message);
        },
        onChunk: (text) => {
          setStreamingContent((prev) => prev + text);
        },
        onComplete: (response) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response },
          ]);
          setStreamingContent("");
          setStatus("idle");
        },
        onError: (err) => {
          setError(err);
          setStatus("idle");
          setStreamingContent("");
        },
      });
    },
    [status, onMessage, exit]
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Header version={version} model={model} provider={provider} cwd={cwd} />

      <Messages messages={messages} streamingContent={streamingContent} />

      {status !== "idle" && (
        <Status status={status} toolName={statusTool} message={statusMessage} />
      )}

      {error && (
        <Box marginY={1}>
          <Text color={colors.error}>Error: {error}</Text>
        </Box>
      )}

      <Input
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={status !== "idle"}
        placeholder={status !== "idle" ? "Waiting..." : "Type a message..."}
      />

      <Footer cwd={cwd} />
    </Box>
  );
}
