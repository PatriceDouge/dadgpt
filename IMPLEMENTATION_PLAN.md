# DadGPT Implementation Plan

A detailed implementation plan for building DadGPT - a personal CLI tool for managing goals, todos, projects, and family life with an AI-powered chat interface.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Phase 1: Foundation](#4-phase-1-foundation)
5. [Phase 2: Core Features](#5-phase-2-core-features)
6. [Phase 3: TUI Implementation](#6-phase-3-tui-implementation)
7. [Phase 4: AI Integration](#7-phase-4-ai-integration)
8. [Phase 5: Tools & Agents](#8-phase-5-tools--agents)
9. [Phase 6: Polish & Testing](#9-phase-6-polish--testing)
10. [Testing Strategy](#10-testing-strategy)
11. [File-by-File Implementation](#11-file-by-file-implementation)

---

## 1. Overview

### What is DadGPT?

DadGPT is a personal command center CLI that helps manage:
- **Goals** - Long-term objectives with progress tracking
- **Todos** - Daily/weekly tasks with state management
- **Projects** - Multi-step endeavors with milestones
- **Family** - Important dates, member info, reminders

### Design Principles

1. **Chat is the default** - Running `dadgpt` opens interactive TUI
2. **Grayscale aesthetic** - Clean, professional monochrome UI
3. **State machines** - Explicit XState machines for lifecycle management
4. **Local-first** - JSON file storage, no external dependencies initially
5. **Great DX** - Comprehensive testing, type safety throughout

### MVP Scope (No External Integrations)

**Included:**
- Interactive TUI chat interface
- Goal CRUD with state machine
- Todo CRUD with state machine
- Project management
- Family info storage
- Local file storage
- AI-powered assistance (OpenAI/Anthropic)

**Excluded (Future):**
- Gmail integration
- Calendar integration
- Reminders/notifications
- Cloud sync

---

## 2. Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | **Node.js 20+** | JavaScript runtime |
| Package Manager | **pnpm** | Fast, disk-efficient package manager |
| Language | **TypeScript 5.x** | Type safety |
| TS Execution | **tsx** | TypeScript execution without build |
| CLI Parsing | **Yargs** | Command parsing |
| TUI Framework | **React Ink** | Terminal UI components |
| AI SDK | **Vercel AI SDK (ai)** | LLM abstraction |
| Validation | **Zod** | Schema validation |
| State Machines | **XState 5** | Explicit state management |
| Testing | **Vitest** | Fast unit test framework |
| IDs | **ULID** | Sortable unique IDs |

### Dependencies

```json
{
  "name": "dadgpt",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "dadgpt": "./bin/dadgpt"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsup src/index.ts --format esm --dts",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "ink": "^5.0.0",
    "ink-text-input": "^6.0.0",
    "react": "^18.0.0",
    "xstate": "^5.0.0",
    "yargs": "^17.0.0",
    "zod": "^3.23.0",
    "ulid": "^2.3.0",
    "chalk": "^5.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/yargs": "^17.0.0",
    "tsx": "^4.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "eslint": "^9.0.0"
  }
}
```

---

## 3. Project Structure

```
dadgpt/
├── package.json
├── tsconfig.json
├── bin/
│   └── dadgpt                    # CLI entry script
├── src/
│   ├── index.ts                  # Main entry point
│   │
│   ├── cli/                      # CLI layer
│   │   ├── index.ts              # Yargs setup
│   │   ├── commands/
│   │   │   ├── run.ts            # Default command (TUI)
│   │   │   ├── init.ts           # Initialize dadgpt.md
│   │   │   ├── auth.ts           # Configure API keys
│   │   │   ├── goals.ts          # List/manage goals
│   │   │   ├── todos.ts          # List/manage todos
│   │   │   └── projects.ts       # List/manage projects
│   │   └── ui.ts                 # Terminal utilities
│   │
│   ├── tui/                      # React Ink TUI
│   │   ├── App.tsx               # Main TUI app
│   │   ├── theme.ts              # Grayscale color theme
│   │   ├── components/
│   │   │   ├── Header.tsx        # ASCII art header
│   │   │   ├── StatusBar.tsx     # Model/provider info
│   │   │   ├── ChatView.tsx      # Message history
│   │   │   ├── MessageBubble.tsx # Individual messages
│   │   │   ├── InputBox.tsx      # User input area
│   │   │   ├── Spinner.tsx       # Loading indicator
│   │   │   ├── ToolCall.tsx      # Tool execution display
│   │   │   └── PermissionPrompt.tsx
│   │   └── hooks/
│   │       ├── useSession.ts     # Session state hook
│   │       ├── useChat.ts        # Chat streaming hook
│   │       └── useKeyboard.ts    # Keyboard shortcuts
│   │
│   ├── config/                   # Configuration
│   │   ├── config.ts             # Config loading/merging
│   │   ├── schema.ts             # Zod schemas
│   │   └── defaults.ts           # Default values
│   │
│   ├── provider/                 # LLM providers
│   │   ├── provider.ts           # Provider abstraction
│   │   ├── models.ts             # Model definitions
│   │   └── registry.ts           # Provider registry
│   │
│   ├── tool/                     # AI tools
│   │   ├── types.ts              # Tool interfaces
│   │   ├── registry.ts           # Tool registration
│   │   ├── goal.ts               # Goal CRUD tool
│   │   ├── todo.ts               # Todo CRUD tool
│   │   ├── project.ts            # Project CRUD tool
│   │   ├── family.ts             # Family info tool
│   │   ├── read.ts               # File read tool
│   │   └── write.ts              # File write tool
│   │
│   ├── agent/                    # Agent definitions
│   │   ├── agent.ts              # Agent interface
│   │   ├── dad.ts                # Main DadGPT agent
│   │   └── prompts.ts            # System prompts
│   │
│   ├── session/                  # Session management
│   │   ├── session.ts            # Session CRUD
│   │   ├── message.ts            # Message types
│   │   ├── processor.ts          # Stream processing
│   │   └── loop.ts               # Main chat loop
│   │
│   ├── state/                    # XState machines
│   │   ├── goal.machine.ts       # Goal lifecycle
│   │   ├── todo.machine.ts       # Todo lifecycle
│   │   ├── project.machine.ts    # Project lifecycle
│   │   └── session.machine.ts    # Chat session flow
│   │
│   ├── storage/                  # Persistence
│   │   ├── storage.ts            # JSON file storage
│   │   └── paths.ts              # File path helpers
│   │
│   ├── permission/               # Permission system
│   │   ├── permission.ts         # Permission checking
│   │   └── rules.ts              # Default rules
│   │
│   ├── bus/                      # Event system
│   │   └── bus.ts                # Pub/sub event bus
│   │
│   ├── parser/                   # Markdown parsing
│   │   └── dadgpt-md.ts          # Parse dadgpt.md
│   │
│   └── util/                     # Utilities
│       ├── id.ts                 # ULID generation
│       ├── log.ts                # Logging
│       └── errors.ts             # Error types
│
└── test/                         # Tests
    ├── unit/
    │   ├── storage.test.ts
    │   ├── config.test.ts
    │   ├── state/
    │   │   ├── goal.machine.test.ts
    │   │   ├── todo.machine.test.ts
    │   │   └── session.machine.test.ts
    │   ├── tool/
    │   │   ├── goal.test.ts
    │   │   ├── todo.test.ts
    │   │   └── project.test.ts
    │   └── parser/
    │       └── dadgpt-md.test.ts
    ├── integration/
    │   ├── cli.test.ts
    │   ├── session.test.ts
    │   └── chat-loop.test.ts
    └── fixtures/
        ├── dadgpt.md
        └── config.json
```

---

## 4. Phase 1: Foundation

### 4.1 Project Setup

**Files to create:**
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `bin/dadgpt` - Executable entry point
- `src/index.ts` - Main entry

**package.json:** (See full package.json in Tech Stack section above)

**bin/dadgpt:**
```bash
#!/usr/bin/env node
import("tsx/esm").then(() => import("../src/index.ts"))
```

**vitest.config.ts:**
```typescript
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts"],
    },
  },
})
```

### 4.2 Utility Layer

**src/util/id.ts:**
```typescript
import { ulid } from "ulid"

export function createId(): string {
  return ulid()
}

export function createTimestampedId(prefix: string): string {
  return `${prefix}_${ulid()}`
}
```

**src/util/log.ts:**
```typescript
export namespace Log {
  let level: "DEBUG" | "INFO" | "WARN" | "ERROR" = "INFO"

  export function init(opts: { level: typeof level }) {
    level = opts.level
  }

  export function debug(...args: unknown[]) {
    if (level === "DEBUG") console.debug("[DEBUG]", ...args)
  }

  export function info(...args: unknown[]) {
    if (["DEBUG", "INFO"].includes(level)) console.info("[INFO]", ...args)
  }

  export function warn(...args: unknown[]) {
    console.warn("[WARN]", ...args)
  }

  export function error(...args: unknown[]) {
    console.error("[ERROR]", ...args)
  }
}
```

### 4.3 Storage Layer

**src/storage/paths.ts:**
```typescript
import * as path from "path"
import * as os from "os"

export const DADGPT_HOME = path.join(os.homedir(), ".dadgpt")
export const DATA_DIR = path.join(DADGPT_HOME, "data")
export const CONFIG_PATH = path.join(DADGPT_HOME, "config.json")
export const AUTH_PATH = path.join(DADGPT_HOME, "auth.json")

export function getDataPath(...segments: string[]): string {
  return path.join(DATA_DIR, ...segments) + ".json"
}

export function getSessionPath(sessionId: string): string {
  return path.join(DATA_DIR, "sessions", sessionId)
}
```

**src/storage/storage.ts:**
```typescript
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { DATA_DIR, getDataPath } from "./paths"

export namespace Storage {
  export async function read<T>(key: string[]): Promise<T | undefined> {
    const filePath = getDataPath(...key)
    try {
      const content = await fs.readFile(filePath, "utf-8")
      return JSON.parse(content) as T
    } catch {
      return undefined
    }
  }

  export async function write<T>(key: string[], data: T): Promise<void> {
    const filePath = getDataPath(...key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
  }

  export async function remove(key: string[]): Promise<boolean> {
    const filePath = getDataPath(...key)
    try {
      await fs.unlink(filePath)
      return true
    } catch {
      return false
    }
  }

  export async function update<T>(
    key: string[],
    fn: (prev: T | undefined) => T
  ): Promise<T> {
    const prev = await read<T>(key)
    const next = fn(prev)
    await write(key, next)
    return next
  }

  export async function list(prefix: string[]): Promise<string[]> {
    const dir = path.join(DATA_DIR, ...prefix)
    try {
      const entries = await fs.readdir(dir)
      return entries
        .filter(e => e.endsWith(".json"))
        .map(e => e.slice(0, -5))
    } catch {
      return []
    }
  }

  export async function exists(key: string[]): Promise<boolean> {
    const filePath = getDataPath(...key)
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  export async function ensureDir(): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}
```

### 4.4 Event Bus

**src/bus/bus.ts:**
```typescript
type Handler<T> = (payload: T) => void | Promise<void>

const handlers = new Map<string, Set<Handler<any>>>()

export namespace Bus {
  export function publish<T>(event: string, payload: T): void {
    const eventHandlers = handlers.get(event)
    if (eventHandlers) {
      for (const handler of eventHandlers) {
        try {
          handler(payload)
        } catch (err) {
          console.error(`Error in event handler for ${event}:`, err)
        }
      }
    }
  }

  export function subscribe<T>(
    event: string,
    handler: Handler<T>
  ): () => void {
    if (!handlers.has(event)) {
      handlers.set(event, new Set())
    }
    handlers.get(event)!.add(handler)

    // Return unsubscribe function
    return () => {
      handlers.get(event)?.delete(handler)
    }
  }

  export function clear(): void {
    handlers.clear()
  }
}

// Type-safe event definitions
export const Events = {
  // Goal events
  "goal.created": {} as { goalId: string },
  "goal.updated": {} as { goalId: string; changes: Record<string, unknown> },
  "goal.completed": {} as { goalId: string },
  "goal.deleted": {} as { goalId: string },

  // Todo events
  "todo.created": {} as { todoId: string },
  "todo.completed": {} as { todoId: string },
  "todo.deleted": {} as { todoId: string },

  // Session events
  "session.created": {} as { sessionId: string },
  "session.message": {} as { sessionId: string; messageId: string },

  // Tool events
  "tool.start": {} as { toolId: string; args: unknown },
  "tool.complete": {} as { toolId: string; result: string },
  "tool.error": {} as { toolId: string; error: string },

  // Permission events
  "permission.asked": {} as { id: string; tool: string; resource: string },
  "permission.replied": {} as { id: string; answer: string },
} as const

export type EventName = keyof typeof Events
export type EventPayload<E extends EventName> = typeof Events[E]
```

### 4.5 Tests for Phase 1

**test/unit/storage.test.ts:**
```typescript
import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { Storage } from "../../src/storage/storage"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

describe("Storage", () => {
  const testDir = path.join(os.tmpdir(), "dadgpt-test-" + Date.now())

  beforeEach(async () => {
    // Override DATA_DIR for tests
    process.env.DADGPT_DATA_DIR = testDir
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  test("write and read", async () => {
    const data = { name: "Test", value: 42 }
    await Storage.write(["test", "item"], data)
    const result = await Storage.read(["test", "item"])
    expect(result).toEqual(data)
  })

  test("read non-existent returns undefined", async () => {
    const result = await Storage.read(["nonexistent"])
    expect(result).toBeUndefined()
  })

  test("update creates if not exists", async () => {
    const result = await Storage.update(["new"], (prev) => ({
      count: (prev?.count ?? 0) + 1
    }))
    expect(result).toEqual({ count: 1 })
  })

  test("update modifies existing", async () => {
    await Storage.write(["counter"], { count: 5 })
    const result = await Storage.update(["counter"], (prev: any) => ({
      count: prev.count + 1
    }))
    expect(result).toEqual({ count: 6 })
  })

  test("list returns json file names", async () => {
    await Storage.write(["items", "a"], { id: "a" })
    await Storage.write(["items", "b"], { id: "b" })
    const list = await Storage.list(["items"])
    expect(list.sort()).toEqual(["a", "b"])
  })

  test("remove deletes file", async () => {
    await Storage.write(["todelete"], { data: true })
    expect(await Storage.exists(["todelete"])).toBe(true)
    await Storage.remove(["todelete"])
    expect(await Storage.exists(["todelete"])).toBe(false)
  })
})
```

**test/unit/bus.test.ts:**
```typescript
import { describe, test, expect, beforeEach } from "vitest"
import { Bus } from "../../src/bus/bus"

describe("Bus", () => {
  beforeEach(() => {
    Bus.clear()
  })

  test("subscribe and publish", () => {
    const received: string[] = []
    Bus.subscribe("test.event", (payload: { msg: string }) => {
      received.push(payload.msg)
    })

    Bus.publish("test.event", { msg: "hello" })
    Bus.publish("test.event", { msg: "world" })

    expect(received).toEqual(["hello", "world"])
  })

  test("unsubscribe stops receiving", () => {
    const received: number[] = []
    const unsub = Bus.subscribe("test", (n: number) => received.push(n))

    Bus.publish("test", 1)
    unsub()
    Bus.publish("test", 2)

    expect(received).toEqual([1])
  })

  test("multiple handlers for same event", () => {
    let count = 0
    Bus.subscribe("inc", () => count++)
    Bus.subscribe("inc", () => count++)

    Bus.publish("inc", null)

    expect(count).toBe(2)
  })

  test("handler error does not break other handlers", () => {
    const results: number[] = []
    Bus.subscribe("test", () => { throw new Error("fail") })
    Bus.subscribe("test", (n: number) => results.push(n))

    Bus.publish("test", 42)

    expect(results).toEqual([42])
  })
})
```

---

## 5. Phase 2: Core Features

### 5.1 Configuration System

**src/config/schema.ts:**
```typescript
import { z } from "zod"

export const ProviderConfigSchema = z.object({
  id: z.string(),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
})

export const ModelConfigSchema = z.object({
  provider: z.string(),
  model: z.string(),
  temperature: z.number().default(0),
  maxTokens: z.number().default(4096),
})

export const PermissionRulesetSchema = z.object({
  allow: z.array(z.string()).default([]),
  deny: z.array(z.string()).default([]),
  ask: z.array(z.string()).default(["*"]),
})

export const FamilyMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  relationship: z.string(),
  birthday: z.string().optional(),
  notes: z.string().optional(),
})

export const ConfigSchema = z.object({
  // Provider settings
  providers: z.record(ProviderConfigSchema).default({}),
  defaultProvider: z.string().default("anthropic"),
  defaultModel: z.string().default("claude-sonnet-4-20250514"),

  // UI settings
  theme: z.enum(["dark", "light"]).default("dark"),

  // Permission settings
  permissions: PermissionRulesetSchema.default({}),

  // Goal categories
  goalCategories: z.array(z.string()).default([
    "Health",
    "Family",
    "Work",
    "Personal",
    "Finance",
  ]),

  // Family members (for family tool)
  family: z.array(FamilyMemberSchema).default([]),
})

export type Config = z.infer<typeof ConfigSchema>
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>
export type FamilyMember = z.infer<typeof FamilyMemberSchema>
```

**src/config/defaults.ts:**
```typescript
import type { Config } from "./schema"

export const DEFAULT_CONFIG: Config = {
  providers: {},
  defaultProvider: "anthropic",
  defaultModel: "claude-sonnet-4-20250514",
  theme: "dark",
  permissions: {
    allow: ["read", "goal", "todo", "project", "family"],
    deny: [],
    ask: ["write", "bash"],
  },
  goalCategories: ["Health", "Family", "Work", "Personal", "Finance"],
  family: [],
}
```

**src/config/config.ts:**
```typescript
import * as path from "path"
import * as os from "os"
import { ConfigSchema, type Config } from "./schema"
import { DEFAULT_CONFIG } from "./defaults"

const CONFIG_PATH = path.join(os.homedir(), ".dadgpt", "config.json")
const PROJECT_CONFIG = "dadgpt.config.json"

let cachedConfig: Config | null = null

export namespace Config {
  export async function get(): Promise<Config> {
    if (cachedConfig) return cachedConfig

    // Load configs in order of precedence
    const globalConfig = await loadGlobalConfig()
    const projectConfig = await loadProjectConfig()
    const envConfig = loadEnvConfig()

    // Merge configs (later overrides earlier)
    const merged = deepMerge(
      DEFAULT_CONFIG,
      globalConfig,
      projectConfig,
      envConfig
    )

    // Validate
    cachedConfig = ConfigSchema.parse(merged)
    return cachedConfig
  }

  export function invalidate(): void {
    cachedConfig = null
  }

  export async function save(config: Partial<Config>): Promise<void> {
    const current = await get()
    const updated = { ...current, ...config }
    await Bun.write(CONFIG_PATH, JSON.stringify(updated, null, 2))
    invalidate()
  }
}

async function loadGlobalConfig(): Promise<Partial<Config>> {
  try {
    const content = await Bun.file(CONFIG_PATH).text()
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function loadProjectConfig(): Promise<Partial<Config>> {
  try {
    const content = await Bun.file(PROJECT_CONFIG).text()
    return JSON.parse(content)
  } catch {
    return {}
  }
}

function loadEnvConfig(): Partial<Config> {
  const config: Partial<Config> = {}

  if (process.env.DADGPT_PROVIDER) {
    config.defaultProvider = process.env.DADGPT_PROVIDER
  }
  if (process.env.DADGPT_MODEL) {
    config.defaultModel = process.env.DADGPT_MODEL
  }

  return config
}

function deepMerge(...objects: Partial<Config>[]): Partial<Config> {
  const result: Record<string, unknown> = {}

  for (const obj of objects) {
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (typeof value === "object" && !Array.isArray(value) && value !== null) {
          result[key] = deepMerge(
            (result[key] as Partial<Config>) ?? {},
            value as Partial<Config>
          )
        } else {
          result[key] = value
        }
      }
    }
  }

  return result as Partial<Config>
}
```

### 5.2 State Machines

**src/state/goal.machine.ts:**
```typescript
import { createMachine, assign } from "xstate"

export interface GoalContext {
  id: string
  title: string
  category: string
  description: string
  progress: number
  milestones: Array<{
    id: string
    title: string
    completed: boolean
  }>
  dueDate: string | null
  createdAt: number
  updatedAt: number
}

export type GoalEvent =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "UPDATE_PROGRESS"; progress: number }
  | { type: "COMPLETE_MILESTONE"; milestoneId: string }
  | { type: "COMPLETE" }
  | { type: "ABANDON" }

export type GoalState =
  | "not_started"
  | "in_progress"
  | "paused"
  | "completed"
  | "abandoned"

export const goalMachine = createMachine({
  id: "goal",
  initial: "not_started",
  types: {} as {
    context: GoalContext
    events: GoalEvent
  },
  context: {
    id: "",
    title: "",
    category: "",
    description: "",
    progress: 0,
    milestones: [],
    dueDate: null,
    createdAt: 0,
    updatedAt: 0,
  },
  states: {
    not_started: {
      on: {
        START: {
          target: "in_progress",
          actions: assign({ updatedAt: () => Date.now() }),
        },
        ABANDON: {
          target: "abandoned",
          actions: assign({ updatedAt: () => Date.now() }),
        },
      },
    },
    in_progress: {
      on: {
        UPDATE_PROGRESS: {
          actions: assign({
            progress: ({ event }) => Math.min(100, Math.max(0, event.progress)),
            updatedAt: () => Date.now(),
          }),
        },
        COMPLETE_MILESTONE: {
          actions: assign({
            milestones: ({ context, event }) =>
              context.milestones.map((m) =>
                m.id === event.milestoneId ? { ...m, completed: true } : m
              ),
            updatedAt: () => Date.now(),
          }),
        },
        PAUSE: {
          target: "paused",
          actions: assign({ updatedAt: () => Date.now() }),
        },
        COMPLETE: {
          target: "completed",
          actions: assign({
            progress: 100,
            updatedAt: () => Date.now(),
          }),
        },
        ABANDON: {
          target: "abandoned",
          actions: assign({ updatedAt: () => Date.now() }),
        },
      },
    },
    paused: {
      on: {
        RESUME: {
          target: "in_progress",
          actions: assign({ updatedAt: () => Date.now() }),
        },
        ABANDON: {
          target: "abandoned",
          actions: assign({ updatedAt: () => Date.now() }),
        },
      },
    },
    completed: {
      type: "final",
    },
    abandoned: {
      type: "final",
    },
  },
})

export function createGoalContext(
  partial: Partial<GoalContext>
): GoalContext {
  return {
    id: partial.id ?? "",
    title: partial.title ?? "",
    category: partial.category ?? "Personal",
    description: partial.description ?? "",
    progress: partial.progress ?? 0,
    milestones: partial.milestones ?? [],
    dueDate: partial.dueDate ?? null,
    createdAt: partial.createdAt ?? Date.now(),
    updatedAt: partial.updatedAt ?? Date.now(),
  }
}
```

**src/state/todo.machine.ts:**
```typescript
import { createMachine, assign } from "xstate"

export interface TodoContext {
  id: string
  title: string
  description: string
  priority: "low" | "medium" | "high"
  dueDate: string | null
  tags: string[]
  goalId: string | null  // Link to parent goal
  blockedBy: string | null  // ID of blocking todo
  createdAt: number
  updatedAt: number
  completedAt: number | null
}

export type TodoEvent =
  | { type: "START" }
  | { type: "COMPLETE" }
  | { type: "BLOCK"; blockedBy: string }
  | { type: "UNBLOCK" }
  | { type: "DEFER"; until: string }
  | { type: "CANCEL" }
  | { type: "REOPEN" }

export type TodoState =
  | "pending"
  | "in_progress"
  | "blocked"
  | "deferred"
  | "done"
  | "cancelled"

export const todoMachine = createMachine({
  id: "todo",
  initial: "pending",
  types: {} as {
    context: TodoContext
    events: TodoEvent
  },
  context: {
    id: "",
    title: "",
    description: "",
    priority: "medium",
    dueDate: null,
    tags: [],
    goalId: null,
    blockedBy: null,
    createdAt: 0,
    updatedAt: 0,
    completedAt: null,
  },
  states: {
    pending: {
      on: {
        START: {
          target: "in_progress",
          actions: assign({ updatedAt: () => Date.now() }),
        },
        DEFER: {
          target: "deferred",
          actions: assign({
            dueDate: ({ event }) => event.until,
            updatedAt: () => Date.now(),
          }),
        },
        CANCEL: {
          target: "cancelled",
          actions: assign({ updatedAt: () => Date.now() }),
        },
      },
    },
    in_progress: {
      on: {
        COMPLETE: {
          target: "done",
          actions: assign({
            completedAt: () => Date.now(),
            updatedAt: () => Date.now(),
          }),
        },
        BLOCK: {
          target: "blocked",
          actions: assign({
            blockedBy: ({ event }) => event.blockedBy,
            updatedAt: () => Date.now(),
          }),
        },
        DEFER: {
          target: "deferred",
          actions: assign({
            dueDate: ({ event }) => event.until,
            updatedAt: () => Date.now(),
          }),
        },
      },
    },
    blocked: {
      on: {
        UNBLOCK: {
          target: "in_progress",
          actions: assign({
            blockedBy: null,
            updatedAt: () => Date.now(),
          }),
        },
        CANCEL: {
          target: "cancelled",
          actions: assign({ updatedAt: () => Date.now() }),
        },
      },
    },
    deferred: {
      on: {
        START: {
          target: "pending",
          actions: assign({ updatedAt: () => Date.now() }),
        },
        CANCEL: {
          target: "cancelled",
          actions: assign({ updatedAt: () => Date.now() }),
        },
      },
    },
    done: {
      on: {
        REOPEN: {
          target: "pending",
          actions: assign({
            completedAt: null,
            updatedAt: () => Date.now(),
          }),
        },
      },
    },
    cancelled: {
      on: {
        REOPEN: {
          target: "pending",
          actions: assign({ updatedAt: () => Date.now() }),
        },
      },
    },
  },
})

export function createTodoContext(
  partial: Partial<TodoContext>
): TodoContext {
  return {
    id: partial.id ?? "",
    title: partial.title ?? "",
    description: partial.description ?? "",
    priority: partial.priority ?? "medium",
    dueDate: partial.dueDate ?? null,
    tags: partial.tags ?? [],
    goalId: partial.goalId ?? null,
    blockedBy: partial.blockedBy ?? null,
    createdAt: partial.createdAt ?? Date.now(),
    updatedAt: partial.updatedAt ?? Date.now(),
    completedAt: partial.completedAt ?? null,
  }
}
```

**src/state/project.machine.ts:**
```typescript
import { createMachine, assign } from "xstate"

export interface ProjectContext {
  id: string
  name: string
  description: string
  status: string
  budget: number | null
  milestones: Array<{
    id: string
    title: string
    completed: boolean
    dueDate: string | null
  }>
  todoIds: string[]  // Linked todos
  goalId: string | null  // Parent goal
  createdAt: number
  updatedAt: number
}

export type ProjectEvent =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "COMPLETE" }
  | { type: "CANCEL" }
  | { type: "ADD_MILESTONE"; milestone: { id: string; title: string; dueDate: string | null } }
  | { type: "COMPLETE_MILESTONE"; milestoneId: string }

export const projectMachine = createMachine({
  id: "project",
  initial: "planning",
  types: {} as {
    context: ProjectContext
    events: ProjectEvent
  },
  context: {
    id: "",
    name: "",
    description: "",
    status: "planning",
    budget: null,
    milestones: [],
    todoIds: [],
    goalId: null,
    createdAt: 0,
    updatedAt: 0,
  },
  states: {
    planning: {
      on: {
        START: {
          target: "active",
          actions: assign({
            status: "active",
            updatedAt: () => Date.now(),
          }),
        },
        CANCEL: {
          target: "cancelled",
          actions: assign({ updatedAt: () => Date.now() }),
        },
      },
    },
    active: {
      on: {
        PAUSE: {
          target: "on_hold",
          actions: assign({
            status: "on_hold",
            updatedAt: () => Date.now(),
          }),
        },
        COMPLETE: {
          target: "completed",
          actions: assign({
            status: "completed",
            updatedAt: () => Date.now(),
          }),
        },
        ADD_MILESTONE: {
          actions: assign({
            milestones: ({ context, event }) => [
              ...context.milestones,
              { ...event.milestone, completed: false },
            ],
            updatedAt: () => Date.now(),
          }),
        },
        COMPLETE_MILESTONE: {
          actions: assign({
            milestones: ({ context, event }) =>
              context.milestones.map((m) =>
                m.id === event.milestoneId ? { ...m, completed: true } : m
              ),
            updatedAt: () => Date.now(),
          }),
        },
        CANCEL: {
          target: "cancelled",
          actions: assign({ updatedAt: () => Date.now() }),
        },
      },
    },
    on_hold: {
      on: {
        RESUME: {
          target: "active",
          actions: assign({
            status: "active",
            updatedAt: () => Date.now(),
          }),
        },
        CANCEL: {
          target: "cancelled",
          actions: assign({ updatedAt: () => Date.now() }),
        },
      },
    },
    completed: {
      type: "final",
    },
    cancelled: {
      type: "final",
    },
  },
})
```

### 5.3 State Machine Tests

**test/unit/state/goal.machine.test.ts:**
```typescript
import { describe, test, expect } from "vitest"
import { createActor } from "xstate"
import { goalMachine, createGoalContext } from "../../../src/state/goal.machine"

describe("Goal State Machine", () => {
  test("starts in not_started state", () => {
    const actor = createActor(goalMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe("not_started")
  })

  test("transitions from not_started to in_progress on START", () => {
    const actor = createActor(goalMachine)
    actor.start()
    actor.send({ type: "START" })
    expect(actor.getSnapshot().value).toBe("in_progress")
  })

  test("can pause and resume", () => {
    const actor = createActor(goalMachine)
    actor.start()

    actor.send({ type: "START" })
    expect(actor.getSnapshot().value).toBe("in_progress")

    actor.send({ type: "PAUSE" })
    expect(actor.getSnapshot().value).toBe("paused")

    actor.send({ type: "RESUME" })
    expect(actor.getSnapshot().value).toBe("in_progress")
  })

  test("updates progress within bounds", () => {
    const actor = createActor(goalMachine.provide({
      context: createGoalContext({ id: "test" }),
    }))
    actor.start()
    actor.send({ type: "START" })

    actor.send({ type: "UPDATE_PROGRESS", progress: 50 })
    expect(actor.getSnapshot().context.progress).toBe(50)

    actor.send({ type: "UPDATE_PROGRESS", progress: 150 })
    expect(actor.getSnapshot().context.progress).toBe(100)

    actor.send({ type: "UPDATE_PROGRESS", progress: -10 })
    expect(actor.getSnapshot().context.progress).toBe(0)
  })

  test("completes milestone", () => {
    const actor = createActor(goalMachine.provide({
      context: createGoalContext({
        id: "test",
        milestones: [
          { id: "m1", title: "First", completed: false },
          { id: "m2", title: "Second", completed: false },
        ],
      }),
    }))
    actor.start()
    actor.send({ type: "START" })
    actor.send({ type: "COMPLETE_MILESTONE", milestoneId: "m1" })

    const milestones = actor.getSnapshot().context.milestones
    expect(milestones[0].completed).toBe(true)
    expect(milestones[1].completed).toBe(false)
  })

  test("completed is final state", () => {
    const actor = createActor(goalMachine)
    actor.start()
    actor.send({ type: "START" })
    actor.send({ type: "COMPLETE" })

    expect(actor.getSnapshot().value).toBe("completed")
    expect(actor.getSnapshot().status).toBe("done")
  })

  test("can abandon from any non-final state", () => {
    const states = ["not_started", "in_progress", "paused"]

    for (const startState of states) {
      const actor = createActor(goalMachine)
      actor.start()

      if (startState !== "not_started") {
        actor.send({ type: "START" })
      }
      if (startState === "paused") {
        actor.send({ type: "PAUSE" })
      }

      actor.send({ type: "ABANDON" })
      expect(actor.getSnapshot().value).toBe("abandoned")
    }
  })
})
```

**test/unit/state/todo.machine.test.ts:**
```typescript
import { describe, test, expect } from "vitest"
import { createActor } from "xstate"
import { todoMachine, createTodoContext } from "../../../src/state/todo.machine"

describe("Todo State Machine", () => {
  test("starts in pending state", () => {
    const actor = createActor(todoMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe("pending")
  })

  test("full lifecycle: pending -> in_progress -> done", () => {
    const actor = createActor(todoMachine)
    actor.start()

    actor.send({ type: "START" })
    expect(actor.getSnapshot().value).toBe("in_progress")

    actor.send({ type: "COMPLETE" })
    expect(actor.getSnapshot().value).toBe("done")
    expect(actor.getSnapshot().context.completedAt).not.toBeNull()
  })

  test("can be blocked and unblocked", () => {
    const actor = createActor(todoMachine)
    actor.start()
    actor.send({ type: "START" })

    actor.send({ type: "BLOCK", blockedBy: "other-todo-123" })
    expect(actor.getSnapshot().value).toBe("blocked")
    expect(actor.getSnapshot().context.blockedBy).toBe("other-todo-123")

    actor.send({ type: "UNBLOCK" })
    expect(actor.getSnapshot().value).toBe("in_progress")
    expect(actor.getSnapshot().context.blockedBy).toBeNull()
  })

  test("can defer with date", () => {
    const actor = createActor(todoMachine)
    actor.start()

    actor.send({ type: "DEFER", until: "2024-12-31" })
    expect(actor.getSnapshot().value).toBe("deferred")
    expect(actor.getSnapshot().context.dueDate).toBe("2024-12-31")
  })

  test("can reopen completed todo", () => {
    const actor = createActor(todoMachine)
    actor.start()
    actor.send({ type: "START" })
    actor.send({ type: "COMPLETE" })

    expect(actor.getSnapshot().value).toBe("done")

    actor.send({ type: "REOPEN" })
    expect(actor.getSnapshot().value).toBe("pending")
    expect(actor.getSnapshot().context.completedAt).toBeNull()
  })

  test("can cancel and reopen", () => {
    const actor = createActor(todoMachine)
    actor.start()
    actor.send({ type: "CANCEL" })

    expect(actor.getSnapshot().value).toBe("cancelled")

    actor.send({ type: "REOPEN" })
    expect(actor.getSnapshot().value).toBe("pending")
  })
})
```

---

## 6. Phase 3: TUI Implementation

### 6.1 Theme System

**src/tui/theme.ts:**
```typescript
import chalk from "chalk"

// Grayscale palette inspired by OpenCode
export const theme = {
  // Background shades (conceptual - terminal handles actual bg)
  bg: {
    primary: "#1a1a1a",
    secondary: "#2a2a2a",
    tertiary: "#3a3a3a",
  },

  // Text colors - grayscale
  text: {
    primary: chalk.white,        // #ffffff
    secondary: chalk.gray,       // #888888
    muted: chalk.dim,            // dimmed
    accent: chalk.blueBright,    // accent for highlights
  },

  // Status colors
  status: {
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    info: chalk.blue,
  },

  // UI elements
  ui: {
    border: chalk.gray("─"),
    borderLight: chalk.dim("─"),
    bullet: chalk.gray("•"),
    arrow: chalk.gray("›"),
    prompt: chalk.blueBright(">"),
  },

  // Semantic styles
  styles: {
    header: chalk.bold.white,
    subheader: chalk.gray,
    label: chalk.dim,
    value: chalk.white,
    link: chalk.underline.blueBright,
    code: chalk.cyan,
    timestamp: chalk.dim,
  },
}

// Box drawing characters
export const box = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
  leftT: "├",
  rightT: "┤",
}

// Dimmed box for less emphasis
export const dimBox = {
  topLeft: chalk.dim("┌"),
  topRight: chalk.dim("┐"),
  bottomLeft: chalk.dim("└"),
  bottomRight: chalk.dim("┘"),
  horizontal: chalk.dim("─"),
  vertical: chalk.dim("│"),
}
```

### 6.2 ASCII Header Component

**src/tui/components/Header.tsx:**
```tsx
import React from "react"
import { Box, Text } from "ink"
import { theme } from "../theme"

const ASCII_LOGO = `
 ___   _   ___   ___ ___ _____
|   \\ /_\\ |   \\ / __| _ \\_   _|
| |) / _ \\| |) | (_ |  _/ | |
|___/_/ \\_\\___/ \\___|_|   |_|
`.trim()

interface HeaderProps {
  model: string
  provider: string
  cwd: string
}

export function Header({ model, provider, cwd }: HeaderProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* ASCII Art Logo */}
      <Box>
        <Text color="blueBright">{ASCII_LOGO}</Text>
      </Box>

      {/* Tagline */}
      <Box marginTop={1}>
        <Text color="gray">Your AI-powered personal command center</Text>
      </Box>

      {/* Status Bar */}
      <Box marginTop={1}>
        <Text color="gray">
          {model}
          <Text color="gray"> · </Text>
          {provider}
          <Text color="gray"> · </Text>
          {cwd}
        </Text>
      </Box>
    </Box>
  )
}
```

### 6.3 Input Box Component

**src/tui/components/InputBox.tsx:**
```tsx
import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import TextInput from "ink-text-input"

interface InputBoxProps {
  onSubmit: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

export function InputBox({
  onSubmit,
  disabled = false,
  placeholder = "Type a message..."
}: InputBoxProps) {
  const [value, setValue] = useState("")

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSubmit(value.trim())
      setValue("")
    }
  }

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
    >
      <Text color="blueBright">{"> "}</Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder={placeholder}
        focus={!disabled}
      />
    </Box>
  )
}
```

### 6.4 Message Components

**src/tui/components/MessageBubble.tsx:**
```tsx
import React from "react"
import { Box, Text } from "ink"

interface MessageBubbleProps {
  role: "user" | "assistant"
  content: string
  timestamp?: number
}

export function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === "user"

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      paddingLeft={isUser ? 4 : 0}
    >
      {/* Role indicator */}
      <Box>
        <Text color={isUser ? "blueBright" : "gray"} bold>
          {isUser ? "You" : "DadGPT"}
        </Text>
        {timestamp && (
          <Text color="gray" dimColor>
            {" · "}
            {formatTime(timestamp)}
          </Text>
        )}
      </Box>

      {/* Message content */}
      <Box marginTop={0} paddingLeft={0}>
        <Text color={isUser ? "white" : "gray"} wrap="wrap">
          {content}
        </Text>
      </Box>
    </Box>
  )
}

function formatTime(ts: number): string {
  const date = new Date(ts)
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })
}
```

**src/tui/components/ChatView.tsx:**
```tsx
import React from "react"
import { Box, Text } from "ink"
import { MessageBubble } from "./MessageBubble"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
}

interface ChatViewProps {
  messages: Message[]
  isLoading?: boolean
}

export function ChatView({ messages, isLoading }: ChatViewProps) {
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
          <Text color="gray">
            <Spinner /> Thinking...
          </Text>
        </Box>
      )}
    </Box>
  )
}

function Spinner() {
  const [frame, setFrame] = React.useState(0)
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

  React.useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  return <Text color="blueBright">{frames[frame]}</Text>
}
```

### 6.5 Tool Call Display

**src/tui/components/ToolCall.tsx:**
```tsx
import React from "react"
import { Box, Text } from "ink"

interface ToolCallProps {
  tool: string
  status: "pending" | "running" | "completed" | "error"
  input?: Record<string, unknown>
  output?: string
  error?: string
}

export function ToolCall({ tool, status, input, output, error }: ToolCallProps) {
  const statusIcon = {
    pending: "○",
    running: "◐",
    completed: "●",
    error: "✗",
  }[status]

  const statusColor = {
    pending: "gray",
    running: "blueBright",
    completed: "green",
    error: "red",
  }[status] as const

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      marginY={1}
    >
      {/* Header */}
      <Box>
        <Text color={statusColor}>{statusIcon} </Text>
        <Text color="white" bold>{tool}</Text>
        <Text color="gray"> · </Text>
        <Text color="gray">{status}</Text>
      </Box>

      {/* Input preview */}
      {input && (
        <Box marginTop={0}>
          <Text color="gray" dimColor>
            {JSON.stringify(input, null, 0).slice(0, 60)}
            {JSON.stringify(input).length > 60 ? "..." : ""}
          </Text>
        </Box>
      )}

      {/* Output or error */}
      {status === "completed" && output && (
        <Box marginTop={0}>
          <Text color="gray">
            {output.slice(0, 100)}
            {output.length > 100 ? "..." : ""}
          </Text>
        </Box>
      )}

      {status === "error" && error && (
        <Box marginTop={0}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  )
}
```

### 6.6 Main App Component

**src/tui/App.tsx:**
```tsx
import React, { useState, useEffect } from "react"
import { Box, useApp, useInput } from "ink"
import { Header } from "./components/Header"
import { ChatView } from "./components/ChatView"
import { InputBox } from "./components/InputBox"
import { useSession } from "./hooks/useSession"
import { useChat } from "./hooks/useChat"
import { Config } from "../config/config"

interface AppProps {
  initialMessage?: string
  sessionId?: string
}

export function App({ initialMessage, sessionId }: AppProps) {
  const { exit } = useApp()
  const [config, setConfig] = useState<Awaited<ReturnType<typeof Config.get>> | null>(null)

  const {
    session,
    messages,
    addMessage
  } = useSession(sessionId)

  const {
    isLoading,
    sendMessage,
    streamingContent
  } = useChat(session?.id)

  // Load config
  useEffect(() => {
    Config.get().then(setConfig)
  }, [])

  // Send initial message if provided
  useEffect(() => {
    if (initialMessage && session) {
      handleSubmit(initialMessage)
    }
  }, [initialMessage, session?.id])

  // Keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit()
    }
    if (key.escape) {
      exit()
    }
  })

  const handleSubmit = async (content: string) => {
    if (!session) return

    // Add user message
    await addMessage({
      role: "user",
      content,
    })

    // Send to AI
    await sendMessage(content)
  }

  if (!config) {
    return <Box><Text color="gray">Loading...</Text></Box>
  }

  // Combine stored messages with streaming content
  const displayMessages = [
    ...messages,
    ...(streamingContent ? [{
      id: "streaming",
      role: "assistant" as const,
      content: streamingContent,
      timestamp: Date.now(),
    }] : []),
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
```

### 6.7 TUI Hooks

**src/tui/hooks/useSession.ts:**
```tsx
import { useState, useEffect, useCallback } from "react"
import { Storage } from "../../storage/storage"
import { createId } from "../../util/id"
import { Bus } from "../../bus/bus"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
}

interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export function useSession(existingSessionId?: string) {
  const [session, setSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  // Initialize or load session
  useEffect(() => {
    async function init() {
      if (existingSessionId) {
        // Load existing session
        const loaded = await Storage.read<Session>(["sessions", existingSessionId, "session"])
        if (loaded) {
          setSession(loaded)
          // Load messages
          const msgIds = await Storage.list(["sessions", existingSessionId, "messages"])
          const msgs = await Promise.all(
            msgIds.map(id =>
              Storage.read<Message>(["sessions", existingSessionId, "messages", id])
            )
          )
          setMessages(msgs.filter(Boolean) as Message[])
          return
        }
      }

      // Create new session
      const newSession: Session = {
        id: createId(),
        title: "New Chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await Storage.write(["sessions", newSession.id, "session"], newSession)
      setSession(newSession)
      Bus.publish("session.created", { sessionId: newSession.id })
    }

    init()
  }, [existingSessionId])

  const addMessage = useCallback(async (msg: Omit<Message, "id" | "timestamp">) => {
    if (!session) return null

    const message: Message = {
      ...msg,
      id: createId(),
      timestamp: Date.now(),
    }

    await Storage.write(
      ["sessions", session.id, "messages", message.id],
      message
    )

    setMessages(prev => [...prev, message])
    Bus.publish("session.message", { sessionId: session.id, messageId: message.id })

    return message
  }, [session])

  return {
    session,
    messages,
    addMessage,
  }
}
```

**src/tui/hooks/useChat.ts:**
```tsx
import { useState, useCallback } from "react"
import { streamText } from "ai"
import { Provider } from "../../provider/provider"
import { Config } from "../../config/config"
import { Storage } from "../../storage/storage"
import { createId } from "../../util/id"

export function useChat(sessionId?: string) {
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [error, setError] = useState<Error | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    if (!sessionId) return

    setIsLoading(true)
    setStreamingContent("")
    setError(null)

    try {
      const config = await Config.get()
      const model = await Provider.getModel(
        config.defaultProvider,
        config.defaultModel
      )

      // Load conversation history
      const msgIds = await Storage.list(["sessions", sessionId, "messages"])
      const messages = await Promise.all(
        msgIds.map(id =>
          Storage.read<{ role: string; content: string }>(
            ["sessions", sessionId, "messages", id]
          )
        )
      )

      const result = await streamText({
        model,
        messages: messages.filter(Boolean).map(m => ({
          role: m!.role as "user" | "assistant",
          content: m!.content,
        })),
        system: getSystemPrompt(),
      })

      let fullContent = ""

      for await (const chunk of result.textStream) {
        fullContent += chunk
        setStreamingContent(fullContent)
      }

      // Save assistant message
      const assistantMsg = {
        id: createId(),
        role: "assistant" as const,
        content: fullContent,
        timestamp: Date.now(),
      }

      await Storage.write(
        ["sessions", sessionId, "messages", assistantMsg.id],
        assistantMsg
      )

      setStreamingContent("")
      return assistantMsg

    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  return {
    isLoading,
    streamingContent,
    error,
    sendMessage,
  }
}

function getSystemPrompt(): string {
  return `You are DadGPT, a personal command center assistant.

You help manage:
- Goals: Long-term objectives with progress tracking
- Todos: Daily and weekly tasks
- Projects: Multi-step endeavors
- Family: Important dates and information

Be helpful, practical, and supportive. Keep responses concise but informative.
When appropriate, suggest breaking down goals into actionable steps.`
}
```

---

## 7. Phase 4: AI Integration

### 7.1 Provider System

**src/provider/models.ts:**
```typescript
export interface ModelInfo {
  id: string
  name: string
  provider: string
  contextWindow: number
  maxOutput: number
}

export const MODELS: Record<string, ModelInfo> = {
  // Anthropic
  "claude-sonnet-4-20250514": {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    contextWindow: 200000,
    maxOutput: 8192,
  },
  "claude-3-5-haiku-20241022": {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    contextWindow: 200000,
    maxOutput: 8192,
  },

  // OpenAI
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextWindow: 128000,
    maxOutput: 4096,
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    contextWindow: 128000,
    maxOutput: 16384,
  },
}

export function getModelInfo(modelId: string): ModelInfo | undefined {
  return MODELS[modelId]
}
```

**src/provider/provider.ts:**
```typescript
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"
import { Config } from "../config/config"

export namespace Provider {
  export async function getModel(
    providerId: string,
    modelId: string
  ): Promise<LanguageModel> {
    const config = await Config.get()

    switch (providerId) {
      case "anthropic": {
        const apiKey = config.providers.anthropic?.apiKey
          ?? process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
          throw new Error("Anthropic API key not configured. Run: dadgpt auth")
        }
        return anthropic(modelId, { apiKey })
      }

      case "openai": {
        const apiKey = config.providers.openai?.apiKey
          ?? process.env.OPENAI_API_KEY
        if (!apiKey) {
          throw new Error("OpenAI API key not configured. Run: dadgpt auth")
        }
        return openai(modelId, { apiKey })
      }

      default:
        throw new Error(`Unknown provider: ${providerId}`)
    }
  }

  export function listProviders(): string[] {
    return ["anthropic", "openai"]
  }
}
```

### 7.2 Tool System

**src/tool/types.ts:**
```typescript
import { z } from "zod"

export interface ToolContext {
  sessionId: string
  userId?: string
}

export interface ToolResult {
  title: string
  output: string
  metadata?: Record<string, unknown>
}

export interface Tool {
  id: string
  description: string
  parameters: z.ZodType
  execute(args: unknown, ctx: ToolContext): Promise<ToolResult>
}

export type ToolStatus = "pending" | "running" | "completed" | "error"

export interface ToolExecution {
  id: string
  toolId: string
  status: ToolStatus
  input: unknown
  output?: string
  error?: string
  startedAt?: number
  completedAt?: number
}
```

**src/tool/registry.ts:**
```typescript
import type { Tool } from "./types"
import { GoalTool } from "./goal"
import { TodoTool } from "./todo"
import { ProjectTool } from "./project"
import { FamilyTool } from "./family"
import { ReadTool } from "./read"
import { WriteTool } from "./write"

const tools = new Map<string, Tool>()

export namespace ToolRegistry {
  export function register(tool: Tool): void {
    tools.set(tool.id, tool)
  }

  export function get(id: string): Tool | undefined {
    return tools.get(id)
  }

  export function getAll(): Tool[] {
    return Array.from(tools.values())
  }

  export function getToolsForAI(): Array<{
    name: string
    description: string
    parameters: Record<string, unknown>
  }> {
    return getAll().map(tool => ({
      name: tool.id,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    }))
  }
}

// Initialize default tools
function init() {
  ToolRegistry.register(GoalTool)
  ToolRegistry.register(TodoTool)
  ToolRegistry.register(ProjectTool)
  ToolRegistry.register(FamilyTool)
  ToolRegistry.register(ReadTool)
  ToolRegistry.register(WriteTool)
}

init()

// Helper to convert Zod schema to JSON Schema
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // Simplified - use zod-to-json-schema in production
  return { type: "object" }
}
```

### 7.3 Goal Tool

**src/tool/goal.ts:**
```typescript
import { z } from "zod"
import type { Tool, ToolContext, ToolResult } from "./types"
import { Storage } from "../storage/storage"
import { createId } from "../util/id"
import { Bus } from "../bus/bus"
import {
  goalMachine,
  createGoalContext,
  type GoalContext,
  type GoalState
} from "../state/goal.machine"
import { createActor } from "xstate"

const GoalArgsSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    category: z.string().optional(),
    status: z.string().optional(),
  }),
  z.object({
    action: z.literal("create"),
    title: z.string(),
    category: z.string().optional(),
    description: z.string().optional(),
    dueDate: z.string().optional(),
  }),
  z.object({
    action: z.literal("get"),
    goalId: z.string(),
  }),
  z.object({
    action: z.literal("update"),
    goalId: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    progress: z.number().optional(),
  }),
  z.object({
    action: z.literal("transition"),
    goalId: z.string(),
    event: z.enum(["START", "PAUSE", "RESUME", "COMPLETE", "ABANDON"]),
  }),
  z.object({
    action: z.literal("delete"),
    goalId: z.string(),
  }),
])

interface StoredGoal extends GoalContext {
  state: GoalState
}

export const GoalTool: Tool = {
  id: "goal",
  description: `Manage goals. Actions:
- list: List all goals, optionally filtered by category or status
- create: Create a new goal
- get: Get details of a specific goal
- update: Update goal properties
- transition: Change goal state (START, PAUSE, RESUME, COMPLETE, ABANDON)
- delete: Delete a goal`,
  parameters: GoalArgsSchema,

  async execute(args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const input = GoalArgsSchema.parse(args)

    switch (input.action) {
      case "list": {
        const goalIds = await Storage.list(["goals"])
        const goals = await Promise.all(
          goalIds.map(id => Storage.read<StoredGoal>(["goals", id]))
        )

        let filtered = goals.filter(Boolean) as StoredGoal[]

        if (input.category) {
          filtered = filtered.filter(g =>
            g.category.toLowerCase() === input.category!.toLowerCase()
          )
        }
        if (input.status) {
          filtered = filtered.filter(g => g.state === input.status)
        }

        return {
          title: `Listed ${filtered.length} goals`,
          output: JSON.stringify(filtered, null, 2),
        }
      }

      case "create": {
        const id = createId()
        const context = createGoalContext({
          id,
          title: input.title,
          category: input.category ?? "Personal",
          description: input.description ?? "",
          dueDate: input.dueDate ?? null,
        })

        const goal: StoredGoal = {
          ...context,
          state: "not_started",
        }

        await Storage.write(["goals", id], goal)
        Bus.publish("goal.created", { goalId: id })

        return {
          title: `Created goal: ${input.title}`,
          output: JSON.stringify(goal, null, 2),
        }
      }

      case "get": {
        const goal = await Storage.read<StoredGoal>(["goals", input.goalId])
        if (!goal) {
          return {
            title: "Goal not found",
            output: `No goal found with ID: ${input.goalId}`,
          }
        }
        return {
          title: goal.title,
          output: JSON.stringify(goal, null, 2),
        }
      }

      case "update": {
        const goal = await Storage.read<StoredGoal>(["goals", input.goalId])
        if (!goal) {
          return {
            title: "Goal not found",
            output: `No goal found with ID: ${input.goalId}`,
          }
        }

        const updated: StoredGoal = {
          ...goal,
          title: input.title ?? goal.title,
          description: input.description ?? goal.description,
          progress: input.progress ?? goal.progress,
          updatedAt: Date.now(),
        }

        await Storage.write(["goals", input.goalId], updated)
        Bus.publish("goal.updated", { goalId: input.goalId, changes: input })

        return {
          title: `Updated goal: ${updated.title}`,
          output: JSON.stringify(updated, null, 2),
        }
      }

      case "transition": {
        const goal = await Storage.read<StoredGoal>(["goals", input.goalId])
        if (!goal) {
          return {
            title: "Goal not found",
            output: `No goal found with ID: ${input.goalId}`,
          }
        }

        // Use state machine
        const actor = createActor(
          goalMachine.provide({
            context: goal,
          }),
          { state: goalMachine.resolveState({ value: goal.state, context: goal }) }
        )

        actor.start()
        actor.send({ type: input.event })

        const snapshot = actor.getSnapshot()
        const updated: StoredGoal = {
          ...snapshot.context,
          state: snapshot.value as GoalState,
        }

        await Storage.write(["goals", input.goalId], updated)

        if (updated.state === "completed") {
          Bus.publish("goal.completed", { goalId: input.goalId })
        }

        return {
          title: `Goal transitioned to: ${updated.state}`,
          output: JSON.stringify(updated, null, 2),
        }
      }

      case "delete": {
        await Storage.remove(["goals", input.goalId])
        Bus.publish("goal.deleted", { goalId: input.goalId })

        return {
          title: "Goal deleted",
          output: `Deleted goal: ${input.goalId}`,
        }
      }
    }
  },
}
```

### 7.4 Todo Tool

**src/tool/todo.ts:**
```typescript
import { z } from "zod"
import type { Tool, ToolContext, ToolResult } from "./types"
import { Storage } from "../storage/storage"
import { createId } from "../util/id"
import { Bus } from "../bus/bus"
import {
  todoMachine,
  createTodoContext,
  type TodoContext,
  type TodoState,
} from "../state/todo.machine"
import { createActor } from "xstate"

const TodoArgsSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    status: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    tag: z.string().optional(),
  }),
  z.object({
    action: z.literal("create"),
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    dueDate: z.string().optional(),
    tags: z.array(z.string()).optional(),
    goalId: z.string().optional(),
  }),
  z.object({
    action: z.literal("get"),
    todoId: z.string(),
  }),
  z.object({
    action: z.literal("complete"),
    todoId: z.string(),
  }),
  z.object({
    action: z.literal("transition"),
    todoId: z.string(),
    event: z.enum(["START", "COMPLETE", "BLOCK", "UNBLOCK", "DEFER", "CANCEL", "REOPEN"]),
    blockedBy: z.string().optional(),
    until: z.string().optional(),
  }),
  z.object({
    action: z.literal("delete"),
    todoId: z.string(),
  }),
])

interface StoredTodo extends TodoContext {
  state: TodoState
}

export const TodoTool: Tool = {
  id: "todo",
  description: `Manage todos. Actions:
- list: List todos, optionally filtered by status, priority, or tag
- create: Create a new todo
- get: Get todo details
- complete: Mark a todo as complete (shortcut)
- transition: Change todo state
- delete: Delete a todo`,
  parameters: TodoArgsSchema,

  async execute(args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const input = TodoArgsSchema.parse(args)

    switch (input.action) {
      case "list": {
        const todoIds = await Storage.list(["todos"])
        const todos = await Promise.all(
          todoIds.map(id => Storage.read<StoredTodo>(["todos", id]))
        )

        let filtered = todos.filter(Boolean) as StoredTodo[]

        if (input.status) {
          filtered = filtered.filter(t => t.state === input.status)
        }
        if (input.priority) {
          filtered = filtered.filter(t => t.priority === input.priority)
        }
        if (input.tag) {
          filtered = filtered.filter(t =>
            t.tags.some(tag => tag.toLowerCase() === input.tag!.toLowerCase())
          )
        }

        // Sort by priority and due date
        filtered.sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 }
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority]
          }
          if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          }
          return 0
        })

        return {
          title: `Listed ${filtered.length} todos`,
          output: JSON.stringify(filtered, null, 2),
        }
      }

      case "create": {
        const id = createId()
        const context = createTodoContext({
          id,
          title: input.title,
          description: input.description ?? "",
          priority: input.priority ?? "medium",
          dueDate: input.dueDate ?? null,
          tags: input.tags ?? [],
          goalId: input.goalId ?? null,
        })

        const todo: StoredTodo = {
          ...context,
          state: "pending",
        }

        await Storage.write(["todos", id], todo)
        Bus.publish("todo.created", { todoId: id })

        return {
          title: `Created todo: ${input.title}`,
          output: JSON.stringify(todo, null, 2),
        }
      }

      case "get": {
        const todo = await Storage.read<StoredTodo>(["todos", input.todoId])
        if (!todo) {
          return {
            title: "Todo not found",
            output: `No todo found with ID: ${input.todoId}`,
          }
        }
        return {
          title: todo.title,
          output: JSON.stringify(todo, null, 2),
        }
      }

      case "complete": {
        const todo = await Storage.read<StoredTodo>(["todos", input.todoId])
        if (!todo) {
          return {
            title: "Todo not found",
            output: `No todo found with ID: ${input.todoId}`,
          }
        }

        // Quick complete - transition through states if needed
        const updated: StoredTodo = {
          ...todo,
          state: "done",
          completedAt: Date.now(),
          updatedAt: Date.now(),
        }

        await Storage.write(["todos", input.todoId], updated)
        Bus.publish("todo.completed", { todoId: input.todoId })

        return {
          title: `Completed: ${todo.title}`,
          output: JSON.stringify(updated, null, 2),
        }
      }

      case "transition": {
        const todo = await Storage.read<StoredTodo>(["todos", input.todoId])
        if (!todo) {
          return {
            title: "Todo not found",
            output: `No todo found with ID: ${input.todoId}`,
          }
        }

        const actor = createActor(
          todoMachine.provide({ context: todo }),
          { state: todoMachine.resolveState({ value: todo.state, context: todo }) }
        )

        actor.start()

        // Send appropriate event with data
        switch (input.event) {
          case "BLOCK":
            actor.send({ type: "BLOCK", blockedBy: input.blockedBy ?? "" })
            break
          case "DEFER":
            actor.send({ type: "DEFER", until: input.until ?? "" })
            break
          default:
            actor.send({ type: input.event })
        }

        const snapshot = actor.getSnapshot()
        const updated: StoredTodo = {
          ...snapshot.context,
          state: snapshot.value as TodoState,
        }

        await Storage.write(["todos", input.todoId], updated)

        if (updated.state === "done") {
          Bus.publish("todo.completed", { todoId: input.todoId })
        }

        return {
          title: `Todo transitioned to: ${updated.state}`,
          output: JSON.stringify(updated, null, 2),
        }
      }

      case "delete": {
        await Storage.remove(["todos", input.todoId])
        Bus.publish("todo.deleted", { todoId: input.todoId })

        return {
          title: "Todo deleted",
          output: `Deleted todo: ${input.todoId}`,
        }
      }
    }
  },
}
```

---

## 8. Phase 5: CLI Commands

### 8.1 CLI Entry Point

**src/cli/index.ts:**
```typescript
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { RunCommand } from "./commands/run"
import { InitCommand } from "./commands/init"
import { AuthCommand } from "./commands/auth"
import { GoalsCommand } from "./commands/goals"
import { TodosCommand } from "./commands/todos"
import { Log } from "../util/log"

export async function cli() {
  await yargs(hideBin(process.argv))
    .scriptName("dadgpt")
    .usage("$0 [message..] - Your AI-powered personal command center")

    // Default command (chat/TUI)
    .command(RunCommand)

    // Subcommands
    .command(InitCommand)
    .command(AuthCommand)
    .command(GoalsCommand)
    .command(TodosCommand)

    // Global options
    .option("debug", {
      type: "boolean",
      description: "Enable debug logging",
      default: false,
    })
    .option("model", {
      type: "string",
      description: "Model to use",
    })
    .option("provider", {
      type: "string",
      description: "Provider to use",
    })

    // Middleware
    .middleware((args) => {
      Log.init({ level: args.debug ? "DEBUG" : "INFO" })
    })

    .help()
    .alias("h", "help")
    .version()
    .alias("v", "version")
    .strict()
    .parse()
}
```

**src/index.ts:**
```typescript
import { cli } from "./cli"

cli().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
```

### 8.2 Run Command (Default)

**src/cli/commands/run.ts:**
```typescript
import type { CommandModule } from "yargs"
import { render } from "ink"
import React from "react"
import { App } from "../../tui/App"

interface RunArgs {
  message?: string[]
  continue?: boolean
  session?: string
}

export const RunCommand: CommandModule<{}, RunArgs> = {
  command: "$0 [message..]",
  describe: "Start DadGPT (interactive mode or single message)",

  builder: (yargs) =>
    yargs
      .positional("message", {
        type: "string",
        array: true,
        description: "Message to send (starts interactive mode if omitted)",
      })
      .option("continue", {
        alias: "c",
        type: "boolean",
        description: "Continue last session",
      })
      .option("session", {
        alias: "s",
        type: "string",
        description: "Session ID to continue",
      }),

  handler: async (args) => {
    const message = args.message?.join(" ")

    // Render the TUI
    const { waitUntilExit } = render(
      React.createElement(App, {
        initialMessage: message,
        sessionId: args.session,
      })
    )

    await waitUntilExit()
  },
}
```

### 8.3 Init Command

**src/cli/commands/init.ts:**
```typescript
import type { CommandModule } from "yargs"
import * as fs from "fs/promises"
import * as path from "path"
import chalk from "chalk"
import { Storage } from "../../storage/storage"

interface InitArgs {
  template: string
  force: boolean
}

const DADGPT_MD_TEMPLATE = `# DadGPT - Personal Command Center

## Goals

### Health
<!-- Add health-related goals here -->

### Family
<!-- Add family-related goals here -->

### Work
<!-- Add work-related goals here -->

### Personal
<!-- Add personal goals here -->

## Todos

### Today
- [ ] Example task

### This Week
- [ ] Weekly planning

### Someday
- [ ] Future ideas

## Family

### Members
<!-- Add family members and their info -->

### Important Dates
<!-- Birthdays, anniversaries, etc. -->

## Projects

<!-- Add project details here -->

## Notes

<!-- Quick notes and reminders -->
`

export const InitCommand: CommandModule<{}, InitArgs> = {
  command: "init",
  describe: "Initialize DadGPT in current directory",

  builder: (yargs) =>
    yargs
      .option("template", {
        alias: "t",
        type: "string",
        choices: ["default", "minimal"],
        default: "default",
        description: "Template to use",
      })
      .option("force", {
        alias: "f",
        type: "boolean",
        default: false,
        description: "Overwrite existing files",
      }),

  handler: async (args) => {
    const mdPath = path.join(process.cwd(), "dadgpt.md")

    // Check if file exists
    try {
      await fs.access(mdPath)
      if (!args.force) {
        console.log(chalk.yellow("dadgpt.md already exists. Use --force to overwrite."))
        return
      }
    } catch {
      // File doesn't exist, continue
    }

    // Write template
    await fs.writeFile(mdPath, DADGPT_MD_TEMPLATE)
    console.log(chalk.green("✓ Created dadgpt.md"))

    // Ensure global config directory exists
    await Storage.ensureDir()
    console.log(chalk.green("✓ Initialized ~/.dadgpt directory"))

    console.log()
    console.log("Next steps:")
    console.log(chalk.gray("  1. Run"), chalk.cyan("dadgpt auth"), chalk.gray("to configure API keys"))
    console.log(chalk.gray("  2. Run"), chalk.cyan("dadgpt"), chalk.gray("to start chatting"))
  },
}
```

### 8.4 Auth Command

**src/cli/commands/auth.ts:**
```typescript
import type { CommandModule } from "yargs"
import * as readline from "readline"
import chalk from "chalk"
import { Config } from "../../config/config"
import { Provider } from "../../provider/provider"

interface AuthArgs {
  provider?: string
}

export const AuthCommand: CommandModule<{}, AuthArgs> = {
  command: "auth [provider]",
  describe: "Configure API keys",

  builder: (yargs) =>
    yargs
      .positional("provider", {
        type: "string",
        choices: Provider.listProviders(),
        description: "Provider to configure",
      }),

  handler: async (args) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    const question = (prompt: string): Promise<string> =>
      new Promise((resolve) => rl.question(prompt, resolve))

    try {
      const providers = args.provider
        ? [args.provider]
        : Provider.listProviders()

      const config = await Config.get()
      const updates: Record<string, { apiKey: string }> = {}

      for (const provider of providers) {
        console.log(chalk.bold(`\nConfiguring ${provider}:`))

        const existing = config.providers[provider]?.apiKey
        if (existing) {
          console.log(chalk.gray(`  Current: ${maskKey(existing)}`))
        }

        const key = await question(`  API Key (enter to skip): `)

        if (key.trim()) {
          updates[provider] = { apiKey: key.trim() }
          console.log(chalk.green(`  ✓ Updated ${provider} API key`))
        }
      }

      if (Object.keys(updates).length > 0) {
        await Config.save({
          providers: {
            ...config.providers,
            ...updates,
          },
        })
        console.log(chalk.green("\n✓ Configuration saved"))
      } else {
        console.log(chalk.gray("\nNo changes made"))
      }

    } finally {
      rl.close()
    }
  },
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****"
  return key.slice(0, 4) + "****" + key.slice(-4)
}
```

### 8.5 Goals Command

**src/cli/commands/goals.ts:**
```typescript
import type { CommandModule } from "yargs"
import chalk from "chalk"
import { Storage } from "../../storage/storage"
import type { GoalContext, GoalState } from "../../state/goal.machine"

interface GoalsArgs {
  category?: string
  status?: string
  json: boolean
}

interface StoredGoal extends GoalContext {
  state: GoalState
}

export const GoalsCommand: CommandModule<{}, GoalsArgs> = {
  command: "goals",
  describe: "List and manage goals",

  builder: (yargs) =>
    yargs
      .option("category", {
        alias: "c",
        type: "string",
        description: "Filter by category",
      })
      .option("status", {
        alias: "s",
        type: "string",
        description: "Filter by status",
      })
      .option("json", {
        type: "boolean",
        default: false,
        description: "Output as JSON",
      }),

  handler: async (args) => {
    const goalIds = await Storage.list(["goals"])
    const goals = await Promise.all(
      goalIds.map(id => Storage.read<StoredGoal>(["goals", id]))
    )

    let filtered = goals.filter(Boolean) as StoredGoal[]

    if (args.category) {
      filtered = filtered.filter(g =>
        g.category.toLowerCase() === args.category!.toLowerCase()
      )
    }
    if (args.status) {
      filtered = filtered.filter(g => g.state === args.status)
    }

    if (args.json) {
      console.log(JSON.stringify(filtered, null, 2))
      return
    }

    if (filtered.length === 0) {
      console.log(chalk.gray("No goals found."))
      console.log(chalk.gray("Start chatting with DadGPT to create goals!"))
      return
    }

    // Group by category
    const byCategory = new Map<string, StoredGoal[]>()
    for (const goal of filtered) {
      const cat = goal.category
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(goal)
    }

    for (const [category, categoryGoals] of byCategory) {
      console.log(chalk.bold(`\n${category}`))

      for (const goal of categoryGoals) {
        const statusIcon = getStatusIcon(goal.state)
        const progressBar = renderProgressBar(goal.progress)

        console.log(`  ${statusIcon} ${goal.title}`)
        console.log(chalk.gray(`     ${progressBar} ${goal.progress}%`))
        if (goal.dueDate) {
          console.log(chalk.gray(`     Due: ${goal.dueDate}`))
        }
      }
    }

    console.log()
  },
}

function getStatusIcon(state: GoalState): string {
  switch (state) {
    case "not_started": return chalk.gray("○")
    case "in_progress": return chalk.blue("◐")
    case "paused": return chalk.yellow("◑")
    case "completed": return chalk.green("●")
    case "abandoned": return chalk.red("✗")
    default: return "?"
  }
}

function renderProgressBar(progress: number): string {
  const width = 20
  const filled = Math.round((progress / 100) * width)
  const empty = width - filled
  return chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(empty))
}
```

---

## 9. Phase 6: Testing Strategy

### 9.1 Test Structure

```
test/
├── unit/                    # Fast, isolated tests
│   ├── storage.test.ts
│   ├── config.test.ts
│   ├── bus.test.ts
│   ├── state/
│   │   ├── goal.machine.test.ts
│   │   ├── todo.machine.test.ts
│   │   └── project.machine.test.ts
│   ├── tool/
│   │   ├── goal.test.ts
│   │   ├── todo.test.ts
│   │   └── project.test.ts
│   └── parser/
│       └── dadgpt-md.test.ts
│
├── integration/             # Tests with real storage
│   ├── cli.test.ts
│   ├── session.test.ts
│   └── tool-integration.test.ts
│
├── e2e/                     # End-to-end tests
│   └── chat-flow.test.ts
│
└── fixtures/                # Test data
    ├── dadgpt.md
    ├── config.json
    └── sample-goals.json
```

### 9.2 Test Coverage Goals

| Area | Target Coverage | Priority |
|------|-----------------|----------|
| State machines | 100% | Critical |
| Storage | 95% | High |
| Tools | 90% | High |
| Config | 85% | Medium |
| CLI commands | 80% | Medium |
| TUI components | 70% | Lower |

### 9.3 Unit Test Examples

**test/unit/tool/goal.test.ts:**
```typescript
import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { GoalTool } from "../../../src/tool/goal"
import { Storage } from "../../../src/storage/storage"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

describe("GoalTool", () => {
  const testDir = path.join(os.tmpdir(), `dadgpt-test-${Date.now()}`)
  const ctx = { sessionId: "test-session" }

  beforeEach(async () => {
    process.env.DADGPT_DATA_DIR = testDir
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("create action", () => {
    test("creates goal with required fields", async () => {
      const result = await GoalTool.execute({
        action: "create",
        title: "Test Goal",
      }, ctx)

      expect(result.title).toContain("Test Goal")

      const output = JSON.parse(result.output)
      expect(output.title).toBe("Test Goal")
      expect(output.state).toBe("not_started")
      expect(output.category).toBe("Personal")
    })

    test("creates goal with all fields", async () => {
      const result = await GoalTool.execute({
        action: "create",
        title: "Health Goal",
        category: "Health",
        description: "Exercise regularly",
        dueDate: "2024-12-31",
      }, ctx)

      const output = JSON.parse(result.output)
      expect(output.title).toBe("Health Goal")
      expect(output.category).toBe("Health")
      expect(output.description).toBe("Exercise regularly")
      expect(output.dueDate).toBe("2024-12-31")
    })
  })

  describe("list action", () => {
    test("lists all goals", async () => {
      // Create test goals
      await GoalTool.execute({ action: "create", title: "Goal 1" }, ctx)
      await GoalTool.execute({ action: "create", title: "Goal 2" }, ctx)

      const result = await GoalTool.execute({ action: "list" }, ctx)
      const goals = JSON.parse(result.output)

      expect(goals.length).toBe(2)
    })

    test("filters by category", async () => {
      await GoalTool.execute({
        action: "create",
        title: "Health Goal",
        category: "Health"
      }, ctx)
      await GoalTool.execute({
        action: "create",
        title: "Work Goal",
        category: "Work"
      }, ctx)

      const result = await GoalTool.execute({
        action: "list",
        category: "Health"
      }, ctx)

      const goals = JSON.parse(result.output)
      expect(goals.length).toBe(1)
      expect(goals[0].title).toBe("Health Goal")
    })
  })

  describe("transition action", () => {
    test("transitions goal through states", async () => {
      // Create goal
      const createResult = await GoalTool.execute({
        action: "create",
        title: "Transition Test",
      }, ctx)
      const created = JSON.parse(createResult.output)

      // Start
      let result = await GoalTool.execute({
        action: "transition",
        goalId: created.id,
        event: "START",
      }, ctx)
      expect(JSON.parse(result.output).state).toBe("in_progress")

      // Pause
      result = await GoalTool.execute({
        action: "transition",
        goalId: created.id,
        event: "PAUSE",
      }, ctx)
      expect(JSON.parse(result.output).state).toBe("paused")

      // Resume
      result = await GoalTool.execute({
        action: "transition",
        goalId: created.id,
        event: "RESUME",
      }, ctx)
      expect(JSON.parse(result.output).state).toBe("in_progress")

      // Complete
      result = await GoalTool.execute({
        action: "transition",
        goalId: created.id,
        event: "COMPLETE",
      }, ctx)
      expect(JSON.parse(result.output).state).toBe("completed")
    })
  })
})
```

### 9.4 Integration Test Example

**test/integration/cli.test.ts:**
```typescript
import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { execa } from "execa"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"

describe("CLI Integration", () => {
  const testDir = path.join(os.tmpdir(), `dadgpt-cli-${Date.now()}`)

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
    process.env.DADGPT_DATA_DIR = testDir
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  test("init creates dadgpt.md", async () => {
    const cwd = path.join(testDir, "project")
    await fs.mkdir(cwd, { recursive: true })

    const { stdout } = await execa("pnpm", ["run", "dev", "--", "init"], { cwd })

    expect(stdout).toContain("Created dadgpt.md")

    const mdContent = await fs.readFile(
      path.join(cwd, "dadgpt.md"),
      "utf-8"
    )
    expect(mdContent).toContain("# DadGPT")
  })

  test("goals command shows empty state", async () => {
    const { stdout } = await execa("pnpm", ["run", "dev", "--", "goals"])
    expect(stdout).toContain("No goals found")
  })

  test("goals --json outputs valid JSON", async () => {
    const { stdout } = await execa("pnpm", ["run", "dev", "--", "goals", "--json"])
    const parsed = JSON.parse(stdout)
    expect(Array.isArray(parsed)).toBe(true)
  })
})
```

Note: Add `execa` to devDependencies: `"execa": "^9.0.0"`

---

## 10. Testing Strategy

### 10.1 Testing Pyramid

```
        /\
       /  \     E2E Tests (10%)
      /----\    - Full chat flows
     /      \   - TUI interaction
    /--------\
   /          \ Integration Tests (30%)
  /------------\  - CLI commands
 /              \ - Tool + Storage
/----------------\
        Unit Tests (60%)
      - State machines
      - Storage operations
      - Tool logic
      - Config parsing
```

### 10.2 Test Utilities

**test/helpers/setup.ts:**
```typescript
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

export async function createTestEnvironment() {
  const testDir = path.join(os.tmpdir(), `dadgpt-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await fs.mkdir(testDir, { recursive: true })

  const originalEnv = process.env.DADGPT_DATA_DIR
  process.env.DADGPT_DATA_DIR = testDir

  return {
    dir: testDir,
    cleanup: async () => {
      process.env.DADGPT_DATA_DIR = originalEnv
      await fs.rm(testDir, { recursive: true, force: true })
    },
  }
}

export function createMockContext(overrides = {}) {
  return {
    sessionId: "test-session",
    ...overrides,
  }
}
```

### 10.3 Mock Providers

**test/mocks/provider.ts:**
```typescript
export function createMockModel() {
  return {
    async *textStream() {
      yield "Hello, "
      yield "I'm DadGPT. "
      yield "How can I help?"
    },

    async generate() {
      return {
        text: "Hello, I'm DadGPT. How can I help?",
        usage: { promptTokens: 10, completionTokens: 20 },
      }
    },
  }
}
```

### 10.4 Running Tests

```bash
# Run all tests
pnpm test

# Run with watch mode
pnpm test:watch

# Run specific test file
pnpm vitest test/unit/state/goal.machine.test.ts

# Run with coverage
pnpm test:coverage

# Run only unit tests
pnpm vitest test/unit/

# Run only integration tests
pnpm vitest test/integration/
```

---

## 11. Implementation Checklist

### Phase 1: Foundation
- [ ] Project setup (package.json, tsconfig.json)
- [ ] Utility layer (id.ts, log.ts, errors.ts)
- [ ] Storage layer (storage.ts, paths.ts)
- [ ] Event bus (bus.ts)
- [ ] Unit tests for storage and bus

### Phase 2: Core Features
- [ ] Config system (schema.ts, config.ts, defaults.ts)
- [ ] Goal state machine (goal.machine.ts)
- [ ] Todo state machine (todo.machine.ts)
- [ ] Project state machine (project.machine.ts)
- [ ] Unit tests for state machines

### Phase 3: TUI
- [ ] Theme system (theme.ts)
- [ ] Header component (Header.tsx)
- [ ] Input component (InputBox.tsx)
- [ ] Message components (MessageBubble.tsx, ChatView.tsx)
- [ ] Tool display (ToolCall.tsx)
- [ ] Main App (App.tsx)
- [ ] TUI hooks (useSession.ts, useChat.ts)

### Phase 4: AI Integration
- [ ] Provider system (provider.ts, models.ts)
- [ ] Tool types and registry (types.ts, registry.ts)
- [ ] Goal tool (goal.ts)
- [ ] Todo tool (todo.ts)
- [ ] Project tool (project.ts)
- [ ] Family tool (family.ts)
- [ ] File tools (read.ts, write.ts)
- [ ] Tool tests

### Phase 5: CLI
- [ ] CLI entry (cli/index.ts)
- [ ] Run command (commands/run.ts)
- [ ] Init command (commands/init.ts)
- [ ] Auth command (commands/auth.ts)
- [ ] Goals command (commands/goals.ts)
- [ ] Todos command (commands/todos.ts)
- [ ] Integration tests

### Phase 6: Polish
- [ ] Error handling
- [ ] Edge cases
- [ ] Performance optimization
- [ ] E2E tests
- [ ] Documentation

---

## Appendix: Key Decisions

### Why XState over implicit FSM?
- Visualizable state charts
- Impossible invalid states
- Built-in timeout handling
- Easy to test transitions
- State persistence support

### Why React Ink over raw readline?
- Component-based UI
- Easy to compose complex layouts
- Built-in text input handling
- Familiar React paradigm

### Why JSON files over SQLite?
- Simpler to debug (human-readable)
- Easy backup (just copy files)
- No binary dependencies
- Sufficient for personal use

### Why Vercel AI SDK?
- Provider abstraction
- Streaming support
- Tool calling built-in
- Active development

---

*Document version: 1.0*
*Last updated: January 2025*
