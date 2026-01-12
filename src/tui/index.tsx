import React from "react";
import { render } from "ink";
import { App } from "./components/App.tsx";
import type { StatusType } from "./components/Status.tsx";
import type { Message } from "./components/Messages.tsx";
import { SessionManager } from "../session/session.ts";
import { chat } from "../session/llm.ts";
import { Storage } from "../storage/storage.ts";

interface TUIOptions {
  provider?: string;
  model?: string;
  continueSession?: boolean;
}

export async function runTUI(options: TUIOptions = {}) {
  await Storage.init();

  // Get or create session
  let session = options.continueSession
    ? await SessionManager.getLatest()
    : undefined;

  if (!session) {
    session = await SessionManager.create();
  }

  // Load existing messages
  const existingMessages = await SessionManager.getMessages(session.id);
  const initialMessages: Message[] = existingMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Message handler
  const handleMessage = async (
    message: string,
    callbacks: {
      onStatus: (status: StatusType, toolName?: string, message?: string) => void;
      onChunk: (text: string) => void;
      onComplete: (response: string) => void;
      onError: (error: string) => void;
    }
  ) => {
    callbacks.onStatus("thinking");

    try {
      // Add user message to session
      await SessionManager.addMessage(session!.id, {
        role: "user",
        content: message,
      });

      // Get all messages
      const messages = await SessionManager.getMessages(session!.id);

      let fullResponse = "";

      await chat({
        sessionId: session!.id,
        messages,
        provider: options.provider,
        model: options.model,
        onTextChunk: (text) => {
          callbacks.onStatus("streaming");
          fullResponse += text;
          callbacks.onChunk(text);
        },
        onToolCall: (name, _args) => {
          callbacks.onStatus("tool", name);
        },
        onToolResult: (_name, _result) => {
          callbacks.onStatus("streaming");
        },
      });

      callbacks.onComplete(fullResponse);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      callbacks.onError(errorMessage);
    }
  };

  // Get model info for display
  const modelDisplay = options.model ?? "claude-sonnet-4";
  const providerDisplay = options.provider ?? "anthropic";

  // Render the app
  const { waitUntilExit } = render(
    <App
      version="0.1.0"
      model={modelDisplay}
      provider={providerDisplay}
      cwd={process.cwd()}
      onMessage={handleMessage}
      initialMessages={initialMessages}
    />
  );

  await waitUntilExit();
}
