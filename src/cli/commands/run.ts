import type { CommandModule } from "yargs";
import * as readline from "readline";
import { Storage } from "../../storage/storage.ts";
import { Configuration } from "../../config/config.ts";
import { SessionManager } from "../../session/session.ts";
import { chat } from "../../session/llm.ts";
import { DadGPTParser } from "../../parser/dadgpt-md.ts";
import { UI } from "../ui.ts";

interface RunArgs {
  message?: string[];
  model?: string;
  provider?: string;
  continue?: boolean;
  debug?: boolean;
}

export const runCommand: CommandModule<object, RunArgs> = {
  command: "$0 [message..]",
  describe: "Chat with DadGPT",
  builder: (yargs) =>
    yargs
      .positional("message", {
        type: "string",
        array: true,
        describe: "Message to send",
      })
      .option("model", {
        type: "string",
        alias: "m",
        describe: "Model to use (e.g., gpt-4o, claude-sonnet-4-20250514)",
      })
      .option("provider", {
        type: "string",
        alias: "p",
        describe: "Provider to use (openai, anthropic)",
      })
      .option("continue", {
        type: "boolean",
        alias: "c",
        describe: "Continue the last session",
      })
      .option("debug", {
        type: "boolean",
        alias: "d",
        describe: "Enable debug output",
      }),

  handler: async (args) => {
    await Storage.init();

    // Check for API key
    const config = await Configuration.load();
    const apiKey = await Configuration.getApiKey(
      args.provider ?? config.defaultProvider
    );

    if (!apiKey) {
      UI.error("No API key configured.");
      UI.println();
      UI.info("Run 'dadgpt auth' to set up your API key.");
      UI.println("Or set the OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.");
      return;
    }

    // Check if dadgpt.md exists
    if (!(await DadGPTParser.exists())) {
      UI.warn("No dadgpt.md found in current directory.");
      UI.println();
      const create = await UI.confirm("Would you like to create one?");
      if (create) {
        await DadGPTParser.create();
        UI.success("Created dadgpt.md");
        UI.println();
      }
    }

    const message = args.message?.join(" ");

    if (message) {
      // Single message mode
      await runSingleMessage(message, args);
    } else {
      // Interactive REPL mode
      await runInteractiveMode(args);
    }
  },
};

async function runSingleMessage(
  message: string,
  args: RunArgs
): Promise<void> {
  // Get or create session
  let session = args.continue ? await SessionManager.getLatest() : undefined;

  if (!session) {
    session = await SessionManager.create({
      title: message.slice(0, 50),
    });
  }

  // Add user message
  await SessionManager.addMessage(session.id, {
    role: "user",
    content: message,
  });

  // Get message history
  const messages = await SessionManager.getMessages(session.id);

  // Setup abort handling
  const abortController = new AbortController();

  process.on("SIGINT", () => {
    abortController.abort();
    UI.println();
    UI.dim("Interrupted");
    process.exit(0);
  });

  try {
    // Stream the response
    await chat({
      sessionId: session.id,
      messages,
      provider: args.provider,
      model: args.model,
      signal: abortController.signal,
      onTextChunk: (text) => {
        UI.print(text);
      },
      onToolCall: (name, _args) => {
        if (args.debug) {
          UI.println();
          UI.dim(`[Calling ${name}...]`);
        }
      },
      onToolResult: (name, _result) => {
        if (args.debug) {
          UI.dim(`[${name} completed]`);
        }
      },
    });

    UI.println();
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      UI.println();
      UI.dim("Aborted");
    } else {
      UI.println();
      UI.error(`Error: ${(err as Error).message}`);
    }
  }
}

async function runInteractiveMode(args: RunArgs): Promise<void> {
  UI.logo();

  // Get or create session
  let session = args.continue ? await SessionManager.getLatest() : undefined;

  if (session && args.continue) {
    UI.info(`Continuing session: ${session.title}`);
    UI.println();
  }

  if (!session) {
    session = await SessionManager.create();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    rl.question(UI.replPrompt(), async (input) => {
      const trimmed = input.trim();

      // Handle special commands
      if (trimmed === "/exit" || trimmed === "/quit" || trimmed === "exit" || trimmed === "quit") {
        UI.println();
        UI.success("Goodbye!");
        rl.close();
        return;
      }

      if (trimmed === "/help") {
        showHelp();
        promptUser();
        return;
      }

      if (trimmed === "/clear") {
        // Start a new session
        session = await SessionManager.create();
        UI.success("Started new session");
        promptUser();
        return;
      }

      if (trimmed === "/sessions") {
        await listSessions();
        promptUser();
        return;
      }

      if (trimmed === "/goals") {
        await showGoals();
        promptUser();
        return;
      }

      if (trimmed === "/todos") {
        await showTodos();
        promptUser();
        return;
      }

      if (!trimmed) {
        promptUser();
        return;
      }

      // Process the message
      await SessionManager.addMessage(session!.id, {
        role: "user",
        content: trimmed,
      });

      // Update title if first message
      const messages = await SessionManager.getMessages(session!.id);
      if (messages.length === 1) {
        await SessionManager.updateSessionTitle(session!.id, trimmed);
      }

      UI.println();

      try {
        await chat({
          sessionId: session!.id,
          messages,
          provider: args.provider,
          model: args.model,
          onTextChunk: (text) => {
            UI.print(text);
          },
          onToolCall: (name, _args) => {
            if (args.debug) {
              UI.println();
              UI.dim(`[Calling ${name}...]`);
            }
          },
          onToolResult: (name, _result) => {
            if (args.debug) {
              UI.dim(`[${name} completed]`);
            }
          },
        });
      } catch (err) {
        UI.error(`Error: ${(err as Error).message}`);
      }

      UI.println();
      UI.println();
      promptUser();
    });
  };

  // Handle Ctrl+C gracefully
  rl.on("close", () => {
    UI.println();
    process.exit(0);
  });

  promptUser();
}

function showHelp(): void {
  UI.header("DadGPT Commands");
  UI.println("  /help      - Show this help message");
  UI.println("  /clear     - Start a new session");
  UI.println("  /sessions  - List recent sessions");
  UI.println("  /goals     - List all goals");
  UI.println("  /todos     - List all todos");
  UI.println("  /exit      - Exit interactive mode");
  UI.println();
  UI.println("Or just type naturally to chat with DadGPT!");
  UI.println();
}

async function listSessions(): Promise<void> {
  const sessions = await SessionManager.list();

  if (sessions.length === 0) {
    UI.println("No sessions yet.");
    return;
  }

  UI.header("Recent Sessions");
  for (const session of sessions.slice(0, 10)) {
    const date = new Date(session.updatedAt).toLocaleDateString();
    UI.println(`  ${date} - ${session.title}`);
  }
  UI.println();
}

async function showGoals(): Promise<void> {
  if (!(await DadGPTParser.exists())) {
    UI.warn("No dadgpt.md found.");
    return;
  }

  const data = await DadGPTParser.parse();
  UI.header("Goals");

  for (const [category, goals] of Object.entries(data.goals)) {
    if (goals.length === 0) continue;

    UI.println(`\n  ${category}:`);
    for (const goal of goals) {
      const status = goal.state === "completed" ? "✓" : goal.state === "in_progress" ? "→" : "○";
      let line = `    ${status} ${goal.title}`;
      if (goal.progress > 0 && goal.progress < 100) {
        line += ` (${goal.progress}%)`;
      }
      UI.println(line);
    }
  }
  UI.println();
}

async function showTodos(): Promise<void> {
  if (!(await DadGPTParser.exists())) {
    UI.warn("No dadgpt.md found.");
    return;
  }

  const data = await DadGPTParser.parse();
  UI.header("Todos");

  const timeframeNames = {
    today: "Today",
    this_week: "This Week",
    someday: "Someday",
  };

  for (const [timeframe, todos] of Object.entries(data.todos)) {
    if (todos.length === 0) continue;

    UI.println(`\n  ${timeframeNames[timeframe as keyof typeof timeframeNames]}:`);
    for (const todo of todos) {
      const status = todo.state === "done" ? "✓" : "○";
      UI.println(`    ${status} ${todo.title}`);
    }
  }
  UI.println();
}
