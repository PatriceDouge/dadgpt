# DadGPT Architecture Guide
## Building Context from OpenCode's Architecture

This document provides a comprehensive breakdown of how OpenCode works end-to-end, organized to help you build DadGPT - a personal CLI tool for managing goals, todos, projects, and family life.

---

## Table of Contents
1. [Tech Stack Overview](#1-tech-stack-overview)
2. [Project Structure](#2-project-structure)
3. [CLI Entry Point & Bootstrapping](#3-cli-entry-point--bootstrapping)
4. [Command System](#4-command-system)
5. [Configuration Architecture](#5-configuration-architecture)
6. [Provider/LLM Integration](#6-providerllm-integration)
7. [Tool System](#7-tool-system)
8. [Agent Architecture](#8-agent-architecture)
9. [Session & Message System](#9-session--message-system)
10. [Storage & Persistence](#10-storage--persistence)
11. [Permission System](#11-permission-system)
12. [State Machines for DadGPT](#12-state-machines-for-dadgpt)
13. [TUI/Interface System](#13-tuiinterface-system)
14. [Event Bus](#14-event-bus)
15. [Building DadGPT: Key Components](#15-building-dadgpt-key-components)

---

## 1. Tech Stack Overview

OpenCode uses a modern TypeScript stack optimized for CLI performance:

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | **Bun 1.3.5** | Fast JS runtime (Zig-based) |
| Language | **TypeScript 5.8** | Type safety |
| Monorepo | **Bun workspaces + Turborepo** | Package management |
| AI SDK | **Vercel AI SDK (ai@5.0)** | LLM abstraction |
| Validation | **Zod 4.1** | Schema validation |
| CLI Parsing | **Yargs** | Command parsing |
| HTTP | **Hono** | Lightweight server |
| UI Framework | **SolidJS** | Reactive TUI |

**For DadGPT**: You could use Bun + TypeScript + Yargs + Vercel AI SDK + Zod + **XState** (for explicit state machines).

---

## 2. Project Structure

```
/packages/opencode/src/          # THE CORE - study this directory
├── index.ts                     # Entry point
├── /cli/                        # CLI commands & UI
│   ├── /cmd/                    # Command implementations
│   │   ├── run.ts               # Main run command (default)
│   │   ├── auth.ts              # Authentication
│   │   └── init.ts              # Project initialization
│   └── ui.ts                    # Terminal output utilities
├── /config/                     # Configuration loading
│   └── config.ts                # Hierarchical config system
├── /provider/                   # LLM providers
│   ├── provider.ts              # Provider abstraction
│   ├── models.ts                # Model definitions
│   └── /[provider]/             # Provider-specific code
├── /tool/                       # Built-in tools
│   ├── registry.ts              # Tool registration
│   ├── tool.ts                  # Tool interface
│   ├── read.ts, write.ts, etc.  # Individual tools
├── /agent/                      # Agent definitions
│   └── agent.ts                 # Agent system
├── /session/                    # Session management
│   ├── index.ts                 # Session CRUD
│   ├── message-v2.ts            # Message structures
│   ├── prompt.ts                # Chat loop (IMPORTANT)
│   ├── processor.ts             # Stream processing
│   ├── llm.ts                   # LLM execution
│   └── status.ts                # Session status states
├── /storage/                    # File-based persistence
│   └── storage.ts               # JSON file storage
├── /permission/                 # Permission system
│   └── next.ts                  # Permission FSM
├── /bus/                        # Event pub/sub
│   └── index.ts                 # Event bus
└── /plugin/                     # Plugin loading
    └── plugin.ts                # Plugin system
```

---

## 3. CLI Entry Point & Bootstrapping

### Entry Flow (`/packages/opencode/src/index.ts`)

```typescript
#!/usr/bin/env bun
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

// 1. Parse CLI arguments
yargs(hideBin(process.argv))
  // 2. Default command is "run" - chat is the default behavior
  .command(RunCommand)  // dadgpt "what's on my calendar?"
  .command(InitCommand) // dadgpt init
  .command(AuthCommand) // dadgpt auth
  // 3. Middleware for initialization
  .middleware(async (args) => {
    Log.init({ level: args.debug ? "DEBUG" : "INFO" })
    process.env.DADGPT = "1"
  })
  .parse()
```

**Key insight**: There's no `/chat` command - chatting IS the default. When you run `dadgpt "message"`, it invokes the `run` command which handles the chat.

### The Run Command (Default Behavior)

```typescript
// /src/cli/cmd/run.ts
export const RunCommand = cmd({
  command: "$0 [message..]",  // $0 = default command
  describe: "Run dadgpt",
  builder: (yargs) => yargs
    .positional("message", { type: "string", array: true })
    .option("model", { type: "string" })
    .option("continue", { type: "boolean" }),
  handler: async (args) => {
    const message = args.message?.join(" ")
    if (message) {
      await runWithMessage(message)
    } else {
      await startInteractiveMode()
    }
  }
})
```

Usage patterns:
- `dadgpt "what's on my calendar?"` - Single query
- `dadgpt --continue` - Continue last session
- `dadgpt` - Interactive mode (TUI)

---

## 4. Command System

### Command Registration Pattern

```typescript
import { type CommandModule } from "yargs"

export function cmd<T>(config: CommandModule<{}, T>): CommandModule<{}, T> {
  return config
}

// Example: /init command for DadGPT
export const InitCommand = cmd({
  command: "init",
  describe: "Create dadgpt.md with goals, todos, and structure",
  builder: (yargs) => yargs
    .option("template", {
      type: "string",
      choices: ["default", "minimal", "family-focused"],
      default: "default"
    }),
  handler: async (args) => {
    await createDadGPTFile(args.template)
  }
})
```

### DadGPT Commands

| Command | Usage | Purpose |
|---------|-------|---------|
| (default) | `dadgpt "message"` | Chat with AI |
| `init` | `dadgpt init` | Create dadgpt.md |
| `auth` | `dadgpt auth` | Set up API keys |
| `sync` | `dadgpt sync` | Sync Gmail/Calendar |
| `goals` | `dadgpt goals` | List/manage goals |
| `todos` | `dadgpt todos` | List/manage todos |

---

## 5. Configuration Architecture

### Configuration Hierarchy (lowest to highest precedence)

1. **Defaults** (hardcoded)
2. **Global config** (`~/.dadgpt/config.json`)
3. **Project config** (`dadgpt.md` or `.dadgpt/config.json`)
4. **Environment variables** (`DADGPT_*`)
5. **CLI flags**

### Config Loading

```typescript
// /src/config/config.ts
export namespace Config {
  export const Info = z.object({
    provider: z.record(Provider.Config).optional(),
    agent: z.record(Agent.Config).optional(),
    permission: PermissionRuleset.optional(),
    // DadGPT specific
    integrations: z.object({
      gmail: GmailConfig.optional(),
      calendar: CalendarConfig.optional(),
    }).optional(),
    family: z.array(FamilyMember).optional(),
    goalCategories: z.array(z.string()).default([
      "Health", "Family", "Work", "Personal", "Finance"
    ]),
  })

  // Lazy loading with caching
  export async function get(): Promise<Info> {
    return Instance.state("config", async () => {
      const global = await loadGlobalConfig()
      const project = await loadProjectConfig()
      return deepMerge(global, project)
    })
  }
}
```

### Environment Variables

```typescript
// /src/flag/flag.ts
export const DADGPT_MODEL = process.env.DADGPT_MODEL
export const DADGPT_PROVIDER = process.env.DADGPT_PROVIDER  // "openai" | "anthropic"
export const DADGPT_API_KEY = process.env.DADGPT_API_KEY
export const DADGPT_DEBUG = process.env.DADGPT_DEBUG === "1"
```

---

## 6. Provider/LLM Integration

### Provider System

OpenCode supports 40+ providers. For DadGPT, start with 2-3:

```typescript
// /src/provider/provider.ts
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"

export namespace Provider {
  export const Config = z.object({
    id: z.string(),
    api: z.object({
      baseURL: z.string().optional(),
      key: z.string().optional(),
    }).optional(),
  })

  export async function getModel(providerID: string, modelID: string) {
    const config = await Config.get()
    const key = config.provider?.[providerID]?.api?.key

    switch (providerID) {
      case "anthropic":
        return anthropic(modelID, { apiKey: key })
      case "openai":
        return openai(modelID, { apiKey: key })
      default:
        throw new Error(`Unknown provider: ${providerID}`)
    }
  }
}
```

### LLM Execution with Tools

```typescript
// /src/session/llm.ts
import { streamText, generateText } from "ai"

export async function chat(input: {
  messages: Message[]
  tools: Tool[]
  system: string
  model: LanguageModel
}) {
  const result = await streamText({
    model: input.model,
    messages: input.messages,
    tools: convertToAITools(input.tools),
    system: input.system,
    maxTokens: 16000,
    temperature: 0,
  })

  // Stream handling
  for await (const chunk of result.fullStream) {
    switch (chunk.type) {
      case "text-delta":
        process.stdout.write(chunk.textDelta)
        break
      case "tool-call":
        await handleToolCall(chunk)
        break
    }
  }

  return result
}
```

---

## 7. Tool System

### Tool Definition Interface

```typescript
// /src/tool/tool.ts
export namespace Tool {
  export interface Info {
    id: string
    init(ctx?: InitContext): Promise<{
      description: string
      parameters: z.ZodType
      execute(args: any, ctx: ExecuteContext): Promise<{
        title: string
        metadata: any
        output: string
      }>
    }>
  }
}
```

### OpenCode's Built-in Tools

| Tool | Purpose | Key File |
|------|---------|----------|
| `read` | Read file contents | `/src/tool/read.ts` |
| `write` | Write files | `/src/tool/write.ts` |
| `edit` | Edit with diffs | `/src/tool/edit.ts` |
| `bash` | Shell commands | `/src/tool/bash.ts` |
| `glob` | Find files | `/src/tool/glob.ts` |
| `grep` | Search content | `/src/tool/grep.ts` |
| `webfetch` | Fetch URLs | `/src/tool/webfetch.ts` |
| `websearch` | Web search | `/src/tool/websearch.ts` |
| `todowrite` | Manage todos | `/src/tool/todowrite.ts` |
| `question` | Ask user | `/src/tool/question.ts` |
| `task` | Spawn sub-agents | `/src/tool/task.ts` |

### Example Tool Implementation

```typescript
// /src/tool/read.ts
export const ReadTool: Tool.Info = {
  id: "read",
  async init() {
    return {
      description: "Read the contents of a file",
      parameters: z.object({
        file_path: z.string().describe("Absolute path to the file"),
        offset: z.number().optional(),
        limit: z.number().optional(),
      }),
      async execute(args, ctx) {
        // Check permission first
        await ctx.ask("read", args.file_path)

        const content = await Bun.file(args.file_path).text()

        return {
          title: `Read ${args.file_path}`,
          metadata: { path: args.file_path },
          output: content
        }
      }
    }
  }
}
```

### DadGPT Tools

```typescript
// Tools specific to DadGPT
const DADGPT_TOOLS: Tool.Info[] = [
  // File operations
  ReadTool,
  WriteTool,

  // Goal/Todo management
  GoalTool,      // CRUD for goals in dadgpt.md
  TodoTool,      // CRUD for todos

  // Integrations
  GmailTool,     // Read/send emails
  CalendarTool,  // Read/create events

  // Family
  FamilyTool,    // Query family info, birthdays, etc.

  // Reminders
  ReminderTool,  // Set reminders
]
```

---

## 8. Agent Architecture

### Agent Definition

```typescript
// /src/agent/agent.ts
export namespace Agent {
  export const Info = z.object({
    name: z.string(),
    description: z.string(),
    mode: z.enum(["primary", "subagent"]),
    permission: PermissionRuleset,
    model: z.string().optional(),
    temperature: z.number().optional(),
    prompt: z.string().optional(),
    steps: z.number().optional(),
  })
}
```

### OpenCode's Agents

| Agent | Mode | Purpose |
|-------|------|---------|
| `build` | primary | Full access for development |
| `plan` | primary | Read-only exploration |
| `explore` | subagent | Fast codebase search |
| `general` | subagent | Multi-step tasks |

### DadGPT Agents

```typescript
export const DadAgent: Agent.Info = {
  name: "dad",
  description: "Main DadGPT agent with full access",
  mode: "primary",
  permission: { allow: ["*"] },
  prompt: `You are DadGPT, a personal assistant helping manage
    goals, todos, family life, and projects. Be helpful, practical,
    and supportive.`
}

export const PlannerAgent: Agent.Info = {
  name: "planner",
  description: "Goal and schedule planning specialist",
  mode: "primary",
  permission: {
    allow: ["read", "goal", "todo", "calendar:read"],
    deny: ["bash", "write"]
  },
  prompt: `You help plan and organize goals, breaking them into
    actionable steps and scheduling time.`
}

export const FamilyAgent: Agent.Info = {
  name: "family",
  description: "Family-focused assistant",
  mode: "subagent",
  permission: { allow: ["family", "calendar", "reminder"] },
}
```

---

## 9. Session & Message System

### Session Structure

```typescript
// /src/session/index.ts
export namespace Session {
  export const Info = z.object({
    id: z.string(),           // ULID
    projectID: z.string(),
    directory: z.string(),
    title: z.string(),
    version: z.string(),
    time: z.object({
      created: z.number(),
      updated: z.number(),
    }),
  })

  export async function create(opts: CreateOptions): Promise<Info> {
    const session: Info = {
      id: ulid(),
      projectID: opts.projectID,
      directory: opts.directory,
      title: opts.title ?? "New Session",
      version: "2",
      time: { created: Date.now(), updated: Date.now() }
    }
    await Storage.write(["session", session.projectID, session.id], session)
    return session
  }
}
```

### Message Structure

```typescript
// /src/session/message-v2.ts
export namespace MessageV2 {
  export const User = z.object({
    id: z.string(),
    sessionID: z.string(),
    role: z.literal("user"),
    time: z.object({ created: z.number() }),
    parts: z.array(Part),
  })

  export const Assistant = z.object({
    id: z.string(),
    sessionID: z.string(),
    role: z.literal("assistant"),
    agent: z.string(),
    model: z.object({ providerID: z.string(), modelID: z.string() }),
    parts: z.array(Part),
    usage: TokenUsage.optional(),
  })

  // Tool execution states - THIS IS AN IMPLICIT STATE MACHINE
  export const ToolState = z.discriminatedUnion("status", [
    z.object({ status: z.literal("pending"), input: z.any() }),
    z.object({ status: z.literal("running"), input: z.any(), time: z.object({ start: z.number() }) }),
    z.object({ status: z.literal("completed"), input: z.any(), output: z.string(), time: TimeRange }),
    z.object({ status: z.literal("error"), input: z.any(), error: z.string(), time: TimeRange }),
  ])
}
```

### Chat Loop (`/src/session/prompt.ts`)

This is the heart of OpenCode - the main processing loop:

```typescript
export namespace SessionPrompt {
  export async function loop(sessionID: string, signal: AbortSignal) {
    let step = 0

    while (true) {
      // 1. Load messages
      const messages = await Session.getMessages(sessionID)
      const lastUser = findLastUser(messages)
      const lastAssistant = findLastAssistant(messages)

      // 2. Check exit condition
      if (lastAssistant?.finish && lastUser.id < lastAssistant.id) {
        break
      }

      // 3. Increment step
      step++

      // 4. Set status to busy
      SessionStatus.set(sessionID, { type: "busy" })

      // 5. Process LLM response
      const result = await Processor.process({
        sessionID,
        messages,
        agent: currentAgent,
        signal,
      })

      // 6. Handle result
      switch (result) {
        case "compact":
          await compactSession(sessionID)
          continue
        case "stop":
          break
        case "continue":
          continue
      }
    }

    SessionStatus.set(sessionID, { type: "idle" })
  }
}
```

---

## 10. Storage & Persistence

### File-Based Storage

```
~/.dadgpt/
├── config.json              # Global config
├── auth.json                # API keys (chmod 600)
└── data/
    ├── goals.json           # All goals
    ├── todos.json           # All todos
    ├── family.json          # Family info
    ├── projects/            # Project data
    │   └── {projectID}.json
    └── sessions/            # Chat sessions
        └── {sessionID}/
            ├── session.json
            └── messages/
                └── {messageID}.json
```

### Storage API

```typescript
// /src/storage/storage.ts
export namespace Storage {
  const BASE = path.join(os.homedir(), ".dadgpt/data")

  export async function read<T>(key: string[]): Promise<T | undefined> {
    const filePath = path.join(BASE, ...key) + ".json"
    try {
      return JSON.parse(await Bun.file(filePath).text())
    } catch {
      return undefined
    }
  }

  export async function write<T>(key: string[], content: T): Promise<void> {
    const filePath = path.join(BASE, ...key) + ".json"
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await Bun.write(filePath, JSON.stringify(content, null, 2))
  }

  export async function update<T>(key: string[], fn: (prev: T | undefined) => T): Promise<T> {
    const prev = await read<T>(key)
    const next = fn(prev)
    await write(key, next)
    return next
  }

  export async function list(prefix: string[]): Promise<string[]> {
    const dir = path.join(BASE, ...prefix)
    try {
      const entries = await fs.readdir(dir)
      return entries.filter(e => e.endsWith(".json")).map(e => e.slice(0, -5))
    } catch {
      return []
    }
  }
}
```

---

## 11. Permission System

### Permission Architecture

```typescript
// /src/permission/next.ts
export namespace Permission {
  export const Ruleset = z.object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
    ask: z.array(z.string()).optional(),
  })

  export async function check(
    tool: string,
    resource: string,
    ruleset: Ruleset
  ): Promise<"allow" | "deny" | "ask"> {
    if (matchesAny(resource, ruleset.deny)) return "deny"
    if (matchesAny(resource, ruleset.allow)) return "allow"
    if (matchesAny(resource, ruleset.ask)) return "ask"
    return "ask"  // Default to ask
  }

  // This is an IMPLICIT STATE MACHINE
  // States: none → asked → replied (once/always/reject)
  const pending = new Map<string, { resolve, reject }>()

  export async function ask(tool: string, resource: string): Promise<boolean> {
    const id = ulid()

    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      Bus.publish("permission.asked", { id, tool, resource })
    })
  }

  export function reply(id: string, answer: "once" | "always" | "reject") {
    const req = pending.get(id)
    if (!req) return

    pending.delete(id)

    if (answer === "reject") {
      req.reject(new Error("Permission denied"))
    } else {
      if (answer === "always") {
        saveApprovedPermission(id, resource)
      }
      req.resolve(true)
    }
  }
}
```

---

## 12. State Machines for DadGPT

OpenCode uses **implicit state machines** via Zod discriminated unions and switch statements. For DadGPT, you should use **explicit state machines** with a library like XState. Here's why and how:

### Current OpenCode Approach (Implicit FSM)

```typescript
// Tool states - discriminated union
const ToolState = z.discriminatedUnion("status", [
  { status: "pending" },
  { status: "running" },
  { status: "completed" },
  { status: "error" },
])

// Transitions via imperative switch
switch (event.type) {
  case "tool-call":
    state.status = "running"
    break
  case "tool-result":
    state.status = "completed"
    break
}
```

**Problems**:
- State transitions scattered across codebase
- Easy to create invalid states
- Hard to visualize flow
- No timeout handling
- Testing individual transitions is difficult

### Recommended: XState for DadGPT

```typescript
import { createMachine, assign } from "xstate"

// Goal State Machine
export const goalMachine = createMachine({
  id: "goal",
  initial: "not_started",
  context: {
    id: "",
    title: "",
    progress: 0,
    milestones: [],
  },
  states: {
    not_started: {
      on: {
        START: "in_progress",
        ABANDON: "abandoned",
      }
    },
    in_progress: {
      on: {
        UPDATE_PROGRESS: {
          actions: assign({ progress: (_, e) => e.progress })
        },
        COMPLETE: "completed",
        PAUSE: "paused",
        ABANDON: "abandoned",
      }
    },
    paused: {
      on: {
        RESUME: "in_progress",
        ABANDON: "abandoned",
      }
    },
    completed: {
      type: "final"
    },
    abandoned: {
      type: "final"
    }
  }
})
```

### DadGPT State Machines

#### 1. Goal Lifecycle FSM

```
                    ┌──────────────┐
                    │  not_started │
                    └──────┬───────┘
                           │ START
                           ▼
    ┌────────┐      ┌─────────────┐      ┌───────────┐
    │ paused │◄────►│ in_progress │─────►│ completed │
    └────────┘      └──────┬──────┘      └───────────┘
         │                 │
         │                 │ ABANDON
         │                 ▼
         └────────────►┌───────────┐
                       │ abandoned │
                       └───────────┘
```

#### 2. Todo Lifecycle FSM

```typescript
export const todoMachine = createMachine({
  id: "todo",
  initial: "pending",
  states: {
    pending: {
      on: {
        START: "in_progress",
        DEFER: "deferred",
        CANCEL: "cancelled",
      }
    },
    in_progress: {
      on: {
        COMPLETE: "done",
        BLOCK: "blocked",
        DEFER: "deferred",
      }
    },
    blocked: {
      on: {
        UNBLOCK: "in_progress",
        CANCEL: "cancelled",
      }
    },
    deferred: {
      on: {
        ACTIVATE: "pending",
        CANCEL: "cancelled",
      }
    },
    done: { type: "final" },
    cancelled: { type: "final" },
  }
})
```

#### 3. Session/Chat FSM

```typescript
export const sessionMachine = createMachine({
  id: "session",
  initial: "idle",
  states: {
    idle: {
      on: {
        USER_MESSAGE: "processing",
        LOAD_HISTORY: "loading",
      }
    },
    loading: {
      on: {
        LOADED: "idle",
        ERROR: "error",
      }
    },
    processing: {
      initial: "calling_llm",
      states: {
        calling_llm: {
          on: {
            TEXT_CHUNK: { actions: "appendText" },
            TOOL_CALL: "executing_tool",
            COMPLETE: "#session.idle",
            ERROR: "#session.error",
          }
        },
        executing_tool: {
          on: {
            TOOL_RESULT: "calling_llm",  // Continue with tool result
            TOOL_ERROR: "calling_llm",
            PERMISSION_DENIED: "#session.awaiting_permission",
          }
        },
      }
    },
    awaiting_permission: {
      on: {
        PERMISSION_GRANTED: "processing",
        PERMISSION_DENIED: "idle",
      }
    },
    error: {
      on: {
        RETRY: "processing",
        DISMISS: "idle",
      }
    },
  }
})
```

#### 4. Integration Sync FSM

```typescript
export const syncMachine = createMachine({
  id: "sync",
  initial: "idle",
  context: {
    lastSync: null,
    errors: [],
  },
  states: {
    idle: {
      on: {
        SYNC: "syncing",
        SCHEDULE: "scheduled",
      }
    },
    scheduled: {
      after: {
        SYNC_INTERVAL: "syncing"  // Auto-transition after interval
      },
      on: { CANCEL: "idle" }
    },
    syncing: {
      initial: "gmail",
      states: {
        gmail: {
          invoke: {
            src: "syncGmail",
            onDone: "calendar",
            onError: { target: "calendar", actions: "logError" }
          }
        },
        calendar: {
          invoke: {
            src: "syncCalendar",
            onDone: "#sync.complete",
            onError: { target: "#sync.complete", actions: "logError" }
          }
        },
      }
    },
    complete: {
      always: [
        { target: "scheduled", cond: "hasSchedule" },
        { target: "idle" }
      ]
    }
  }
})
```

### Benefits of Explicit State Machines

| Aspect | Implicit (OpenCode) | Explicit (XState) |
|--------|---------------------|-------------------|
| **Visualization** | Must read code | Auto-generated diagrams |
| **Transitions** | Scattered switch | Centralized definition |
| **Invalid states** | Runtime bugs | Compile-time prevention |
| **Testing** | Integration tests | Unit test each transition |
| **Timeouts** | Manual setTimeout | Built-in `after` |
| **Side effects** | Inline in handlers | Separate `actions`/`services` |
| **Persistence** | Manual serialize | Built-in state hydration |
| **Debugging** | console.log | XState Inspector |

### Using XState with DadGPT

```typescript
import { interpret } from "xstate"

// Create goal and persist state
const goalService = interpret(goalMachine.withContext({
  id: "goal-123",
  title: "Exercise 3x per week",
  progress: 0,
}))

// Subscribe to state changes
goalService.onTransition((state) => {
  console.log(`Goal is now: ${state.value}`)
  // Persist to storage
  Storage.write(["goals", state.context.id], {
    ...state.context,
    state: state.value,
  })
})

goalService.start()

// Trigger transitions
goalService.send("START")
goalService.send({ type: "UPDATE_PROGRESS", progress: 33 })
goalService.send("COMPLETE")
```

---

## 13. TUI/Interface System

### CLI UI Utilities

```typescript
// /src/cli/ui.ts
import chalk from "chalk"
import ora from "ora"
import readline from "readline"

export namespace UI {
  export function println(text: string) {
    console.log(text)
  }

  export function success(text: string) {
    console.log(chalk.green("✓ " + text))
  }

  export function error(text: string) {
    console.error(chalk.red("✗ " + text))
  }

  export function spinner(text: string) {
    return ora(text).start()
  }

  export async function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    return new Promise(resolve => {
      rl.question(question, (answer) => {
        rl.close()
        resolve(answer)
      })
    })
  }
}
```

### Simple Interactive Mode

For DadGPT, start simple with readline:

```typescript
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.blue("dadgpt> ")
  })

  rl.prompt()

  rl.on("line", async (line) => {
    const input = line.trim()

    if (input === "exit" || input === "quit") {
      rl.close()
      return
    }

    await processMessage(input)
    rl.prompt()
  })
}
```

---

## 14. Event Bus

### Pub/Sub System

```typescript
// /src/bus/index.ts
type Handler<T> = (payload: T) => void

export namespace Bus {
  const handlers = new Map<string, Set<Handler<any>>>()

  export function publish<T>(event: string, payload: T) {
    handlers.get(event)?.forEach(h => h(payload))
  }

  export function subscribe<T>(event: string, handler: Handler<T>): () => void {
    if (!handlers.has(event)) handlers.set(event, new Set())
    handlers.get(event)!.add(handler)
    return () => handlers.get(event)!.delete(handler)
  }
}
```

### DadGPT Events

```typescript
const Events = {
  "goal.created": z.object({ goal: Goal }),
  "goal.updated": z.object({ goal: Goal, prev: Goal }),
  "goal.completed": z.object({ goal: Goal }),
  "todo.created": z.object({ todo: Todo }),
  "todo.completed": z.object({ todo: Todo }),
  "sync.started": z.object({ source: z.string() }),
  "sync.completed": z.object({ source: z.string(), count: z.number() }),
  "message.received": z.object({ message: Message }),
}
```

---

## 15. Building DadGPT: Key Components

### Minimal File Structure

```
dadgpt/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── init.ts       # Create dadgpt.md
│   │   │   └── sync.ts       # Sync integrations
│   │   └── ui.ts             # Terminal utilities
│   ├── config/
│   │   └── config.ts         # Config loading
│   ├── provider/
│   │   └── provider.ts       # LLM providers
│   ├── tool/
│   │   ├── registry.ts
│   │   ├── goal.ts
│   │   ├── todo.ts
│   │   ├── gmail.ts
│   │   └── calendar.ts
│   ├── state/                # State machines
│   │   ├── goal.machine.ts
│   │   ├── todo.machine.ts
│   │   └── session.machine.ts
│   ├── session/
│   │   ├── session.ts
│   │   └── message.ts
│   ├── storage/
│   │   └── storage.ts
│   └── bus/
│       └── bus.ts
└── bin/
    └── dadgpt
```

### dadgpt.md Template

```markdown
# DadGPT - Personal Command Center

## Goals

### Health
- [ ] Exercise 3x per week
  - Status: in_progress
  - Progress: 33%
  - Due: ongoing

### Family
- [ ] Weekly family dinner
  - Status: in_progress
  - Next: Sunday 6pm

### Work
- [ ] Complete Q1 objectives
  - Status: in_progress
  - Progress: 60%
  - Due: 2024-03-31

## Todos

### Today
- [ ] Morning workout
- [ ] Review kids' homework
- [ ] Call mom

### This Week
- [ ] Schedule dentist appointment
- [ ] Plan weekend trip

### Someday
- [ ] Learn Spanish
- [ ] Build deck

## Family

### Members
- **Partner**: Sarah
  - Birthday: March 15
- **Kids**:
  - Emma (8) - Birthday: June 22
  - Jake (5) - Birthday: October 3

### Important Dates
- Wedding Anniversary: September 10
- Mom's Birthday: December 5

## Projects

### Home Renovation
- Status: planning
- Budget: $15,000
- Next: Get contractor quotes

## Notes

Quick reminders and thoughts...
```

### Core Components Checklist

```
[x] Default behavior is chat (no /chat command needed)
[ ] CLI Entry & Commands
    [ ] index.ts - Entry point with yargs
    [ ] $0 default command - Chat
    [ ] /init - Create dadgpt.md
    [ ] /sync - Sync integrations

[ ] State Machines (XState)
    [ ] goal.machine.ts - Goal lifecycle
    [ ] todo.machine.ts - Todo lifecycle
    [ ] session.machine.ts - Chat session flow
    [ ] sync.machine.ts - Integration sync

[ ] Configuration
    [ ] ~/.dadgpt/config.json
    [ ] dadgpt.md parsing

[ ] Provider Integration
    [ ] OpenAI
    [ ] Anthropic

[ ] Tools
    [ ] goal - CRUD goals
    [ ] todo - CRUD todos
    [ ] gmail - Email integration
    [ ] calendar - Calendar integration
    [ ] read/write - File access

[ ] Storage
    [ ] JSON file storage
    [ ] State persistence

[ ] Permission System
    [ ] Allow/deny rules
    [ ] User prompts
```

---

## Key Takeaways

1. **Chat is the default** - `dadgpt "message"` should just work
2. **State machines matter** - Use XState for goal/todo/session lifecycle
3. **Tools enable the AI** - Define clear tool interfaces
4. **Config is hierarchical** - Global → Project → CLI flags
5. **Storage is simple** - JSON files work fine for personal use
6. **Events decouple** - Use pub/sub for loose coupling
7. **Start minimal** - Add complexity only when needed

---

## Next Steps

1. `bun init` and set up project structure
2. Implement `/init` command to create dadgpt.md
3. Add XState for goal and todo state machines
4. Set up OpenAI/Anthropic providers
5. Build core tools (goal, todo, read, write)
6. Implement the chat loop
7. Add Gmail/Calendar integrations

Good luck building DadGPT!
