# DadGPT Product Requirements Document

## Executive Summary

DadGPT is a personal CLI AI assistant designed to help manage goals, todos, projects, and family life. Built on modern TypeScript tooling and inspired by OpenCode's architecture, it provides a conversational interface to a personal command center stored in `dadgpt.md`.

**Vision**: "Your AI-powered life manager that understands context, tracks progress, and helps you be a better version of yourself."

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Personas](#2-user-personas)
3. [User Stories](#3-user-stories)
4. [Features & Requirements](#4-features--requirements)
5. [Technical Architecture](#5-technical-architecture)
6. [Data Models](#6-data-models)
7. [API & Integrations](#7-api--integrations)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Success Metrics](#10-success-metrics)

---

## 1. Product Overview

### 1.1 Problem Statement

Modern life involves juggling multiple responsibilities: work objectives, personal health goals, family commitments, household projects, and more. Existing tools are fragmented—calendars, todo apps, note apps, email—making it hard to maintain a unified view of priorities and progress.

### 1.2 Solution

DadGPT provides:
- **Single source of truth**: `dadgpt.md` as a human-readable, version-controllable personal command center
- **Conversational interface**: Natural language interaction via CLI
- **Smart assistance**: AI-powered planning, reminders, and progress tracking
- **Integration hub**: Gmail and Google Calendar sync to surface relevant context
- **State-aware**: Explicit state machines ensure goals and todos have clear lifecycle stages

### 1.3 Key Differentiators

| Aspect | Traditional Apps | DadGPT |
|--------|-----------------|--------|
| Interface | Multiple GUIs | Single CLI + markdown file |
| Data ownership | Cloud-locked | Local files, git-friendly |
| AI assistance | Separate tools | Native, context-aware |
| Customization | Limited | Fully programmable |
| Privacy | Vendor-dependent | Local-first |

---

## 2. User Personas

### 2.1 Primary Persona: "Productive Dad"

**Demographics**:
- 30-50 years old
- Technical professional (developer, engineer, analyst)
- Has family responsibilities (partner, children)
- Comfortable with command line

**Goals**:
- Track and achieve personal and professional goals
- Never miss important family dates
- Maintain work-life balance
- Stay on top of household projects

**Pain Points**:
- Too many apps to check
- Forgets follow-ups and commitments
- Goals get lost without accountability
- Context switching between tools

**Behaviors**:
- Lives in terminal
- Prefers text over GUI
- Values automation
- Wants data portability

### 2.2 Secondary Persona: "Organized Professional"

**Demographics**:
- 25-45 years old
- Knowledge worker
- May or may not have family
- Appreciates CLI efficiency

**Goals**:
- Professional development tracking
- Project management
- Email triage assistance
- Calendar optimization

---

## 3. User Stories

### 3.1 Core Interaction (Epic: Chat)

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-001 | As a user, I can run `dadgpt "message"` to chat with my AI assistant | P0 | Single command sends message, streams response |
| US-002 | As a user, I can run `dadgpt` without arguments to enter interactive mode | P0 | REPL-style interface with prompt |
| US-003 | As a user, I can run `dadgpt --continue` to resume my last session | P1 | Loads previous context, continues conversation |
| US-004 | As a user, I can specify a model with `dadgpt --model gpt-4` | P1 | Uses specified model for session |
| US-005 | As a user, I can abort a response with Ctrl+C gracefully | P0 | Stops streaming, saves partial response |

### 3.2 Initialization (Epic: Setup)

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-010 | As a new user, I can run `dadgpt init` to create my dadgpt.md file | P0 | Creates file with template structure |
| US-011 | As a user, I can choose a template during init (default, minimal, family-focused) | P2 | Template selection via flag or prompt |
| US-012 | As a user, I can run `dadgpt auth` to configure API keys | P0 | Securely stores keys in ~/.dadgpt/auth.json |
| US-013 | As a user, I can use environment variables for API keys | P0 | DADGPT_API_KEY, DADGPT_PROVIDER work |
| US-014 | As a user, I see helpful onboarding when running without setup | P1 | Guides through init and auth |

### 3.3 Goal Management (Epic: Goals)

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-020 | As a user, I can ask "add a goal to exercise 3x per week" | P0 | Goal added to dadgpt.md with proper structure |
| US-021 | As a user, I can ask "what are my goals?" | P0 | Lists all goals with status and progress |
| US-022 | As a user, I can ask "update my exercise goal to 50% complete" | P0 | Updates progress, triggers state transition if needed |
| US-023 | As a user, I can ask "mark my exercise goal as complete" | P0 | Transitions goal to completed state |
| US-024 | As a user, I can ask "pause my learning Spanish goal" | P1 | Transitions to paused state |
| US-025 | As a user, I can ask "show my health goals" | P1 | Filters goals by category |
| US-026 | As a user, I can ask "what goals are in progress?" | P1 | Filters by state |
| US-027 | As a user, I can see goal history and state transitions | P2 | Logs state changes with timestamps |

### 3.4 Todo Management (Epic: Todos)

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-030 | As a user, I can ask "add a todo to call mom" | P0 | Todo added to appropriate section |
| US-031 | As a user, I can ask "what's on my todo list?" | P0 | Shows todos organized by timeframe |
| US-032 | As a user, I can ask "mark call mom as done" | P0 | Transitions todo to done state |
| US-033 | As a user, I can ask "defer dentist appointment to next week" | P1 | Moves todo, sets deferred state |
| US-034 | As a user, I can ask "what did I complete today?" | P1 | Shows completed todos with timestamps |
| US-035 | As a user, I can ask "I'm blocked on X because Y" | P1 | Marks as blocked with reason |
| US-036 | As a user, I can ask "show my blocked todos" | P1 | Filters by blocked state |
| US-037 | As a user, I can ask "prioritize my todos for today" | P2 | AI suggests priority ordering |

### 3.5 Family Management (Epic: Family)

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-040 | As a user, I can store family member information | P1 | Names, birthdays, relationships stored |
| US-041 | As a user, I can ask "when is Emma's birthday?" | P1 | Returns birthday with countdown |
| US-042 | As a user, I can ask "any upcoming family events?" | P1 | Shows upcoming birthdays, anniversaries |
| US-043 | As a user, I can ask "add Jake's soccer practice on Tuesdays at 4pm" | P2 | Creates recurring family event |
| US-044 | As a user, I get proactive reminders for important dates | P2 | Notifies 1 week, 1 day before |

### 3.6 Email Integration (Epic: Gmail)

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-050 | As a user, I can run `dadgpt sync gmail` to fetch recent emails | P1 | Syncs last N emails to local cache |
| US-051 | As a user, I can ask "any important emails today?" | P1 | AI summarizes/prioritizes emails |
| US-052 | As a user, I can ask "draft a reply to John's email" | P2 | Generates draft based on context |
| US-053 | As a user, I can ask "remind me to follow up on X email" | P2 | Creates todo linked to email |
| US-054 | As a user, I can ask "what emails need responses?" | P2 | Shows emails awaiting reply |

### 3.7 Calendar Integration (Epic: Calendar)

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-060 | As a user, I can run `dadgpt sync calendar` to fetch events | P1 | Syncs calendar events locally |
| US-061 | As a user, I can ask "what's on my calendar today?" | P1 | Lists today's events |
| US-062 | As a user, I can ask "schedule a meeting with Bob tomorrow at 2pm" | P2 | Creates calendar event |
| US-063 | As a user, I can ask "when am I free this week?" | P2 | Shows available time slots |
| US-064 | As a user, I can ask "block 2 hours for deep work tomorrow" | P2 | Creates focus time event |

### 3.8 Projects (Epic: Projects)

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-070 | As a user, I can track projects with status and next actions | P2 | Project structure in dadgpt.md |
| US-071 | As a user, I can ask "what's the status of home renovation?" | P2 | Shows project details and progress |
| US-072 | As a user, I can ask "add a task to home renovation project" | P2 | Adds task under project |
| US-073 | As a user, I can ask "what projects need attention?" | P2 | Shows stalled/blocked projects |

### 3.9 Reflection & Planning (Epic: Insights)

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-080 | As a user, I can ask "how did I do this week?" | P2 | Summarizes completed items, progress |
| US-081 | As a user, I can ask "help me plan my week" | P2 | AI suggests schedule based on goals/todos |
| US-082 | As a user, I can ask "what should I focus on?" | P2 | Prioritizes based on due dates, importance |
| US-083 | As a user, I can run a weekly review workflow | P3 | Guided review of goals, todos, calendar |

---

## 4. Features & Requirements

### 4.1 Core Features

#### F-001: CLI Interface
**Description**: Command-line interface as primary interaction method

**Requirements**:
- Default command runs chat (no subcommand needed)
- Support for single-message mode: `dadgpt "message"`
- Support for interactive REPL mode: `dadgpt`
- Global flags: `--model`, `--provider`, `--debug`, `--continue`
- Graceful interrupt handling (Ctrl+C)
- Color-coded output (errors in red, success in green)
- Streaming response display

#### F-002: dadgpt.md Command Center
**Description**: Markdown file as the source of truth for personal data

**Requirements**:
- Human-readable, editable markdown format
- Structured sections: Goals, Todos, Family, Projects, Notes
- Version-controllable with git
- Parser handles various markdown styles
- Bidirectional sync (AI writes, human edits)
- Backup before modifications

#### F-003: LLM Provider Integration
**Description**: Support for multiple AI providers

**Requirements**:
- OpenAI support (GPT-4, GPT-4-turbo, GPT-3.5)
- Anthropic support (Claude 3 Opus, Sonnet, Haiku)
- Easy provider switching via config or flag
- Secure API key storage
- Token usage tracking
- Rate limit handling
- Streaming responses

#### F-004: Tool System
**Description**: AI-callable tools for actions

**Requirements**:
- Goal CRUD tool
- Todo CRUD tool
- File read/write tools
- Gmail integration tool
- Calendar integration tool
- Family query tool
- Reminder tool
- Extensible tool registry

#### F-005: State Machines
**Description**: Explicit state management for entities

**Requirements**:
- Goal states: not_started, in_progress, paused, completed, abandoned
- Todo states: pending, in_progress, blocked, deferred, done, cancelled
- Valid state transitions enforced
- State change history logged
- Persistence of current state
- XState integration

#### F-006: Session Management
**Description**: Conversation context and history

**Requirements**:
- Session creation and persistence
- Message history storage
- Session continuation (`--continue`)
- Context summarization for long sessions
- Session listing and selection
- Session export

#### F-007: Configuration System
**Description**: Hierarchical configuration

**Requirements**:
- Global config: `~/.dadgpt/config.json`
- Project config: `dadgpt.md` frontmatter or `.dadgpt/config.json`
- Environment variables: `DADGPT_*`
- CLI flags override all
- Sensible defaults
- Config validation with Zod

#### F-008: Storage System
**Description**: Local file-based persistence

**Requirements**:
- JSON file storage in `~/.dadgpt/data/`
- Atomic writes (write to temp, then rename)
- Backup before destructive operations
- List/read/write/update primitives
- No external database dependency

### 4.2 Integration Features

#### F-010: Gmail Integration
**Description**: Email context and assistance

**Requirements**:
- OAuth 2.0 authentication flow
- Fetch recent emails
- Email summarization
- Draft composition
- Reply suggestions
- Follow-up reminders
- Respect rate limits

#### F-011: Google Calendar Integration
**Description**: Calendar awareness and management

**Requirements**:
- OAuth 2.0 authentication
- Fetch upcoming events
- Create/update events
- Find free time slots
- Recurring event support
- Multiple calendar support

### 4.3 Permission System

#### F-020: Permission Management
**Description**: Control AI tool access

**Requirements**:
- Allow/deny/ask rules per tool
- Glob pattern matching for resources
- Persistent permission grants
- Per-session overrides
- Clear permission prompts
- Audit log of granted permissions

---

## 5. Technical Architecture

### 5.1 Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Bun 1.3+ | Fast startup, native TS |
| Language | TypeScript 5.8+ | Type safety |
| CLI Parsing | Yargs | Mature, flexible |
| AI SDK | Vercel AI SDK (ai@5.0) | Provider abstraction |
| Validation | Zod 4+ | Runtime schema validation |
| State Machines | XState 5+ | Explicit state management |
| HTTP | Hono | Lightweight (for OAuth) |
| Testing | Bun test | Native, fast |

### 5.2 Directory Structure

```
dadgpt/
├── package.json
├── tsconfig.json
├── bunfig.toml
├── src/
│   ├── index.ts                 # Entry point
│   ├── cli/
│   │   ├── index.ts             # Yargs setup
│   │   ├── commands/
│   │   │   ├── run.ts           # Default chat command
│   │   │   ├── init.ts          # Create dadgpt.md
│   │   │   ├── auth.ts          # API key setup
│   │   │   ├── sync.ts          # Integration sync
│   │   │   ├── goals.ts         # Goal management
│   │   │   └── todos.ts         # Todo management
│   │   └── ui.ts                # Terminal utilities
│   ├── config/
│   │   ├── config.ts            # Config loading/merging
│   │   └── schema.ts            # Config Zod schemas
│   ├── provider/
│   │   ├── index.ts             # Provider abstraction
│   │   ├── openai.ts            # OpenAI provider
│   │   └── anthropic.ts         # Anthropic provider
│   ├── tool/
│   │   ├── registry.ts          # Tool registration
│   │   ├── types.ts             # Tool interfaces
│   │   ├── goal.ts              # Goal CRUD
│   │   ├── todo.ts              # Todo CRUD
│   │   ├── read.ts              # File reading
│   │   ├── write.ts             # File writing
│   │   ├── gmail.ts             # Gmail integration
│   │   ├── calendar.ts          # Calendar integration
│   │   └── family.ts            # Family queries
│   ├── state/
│   │   ├── goal.machine.ts      # Goal lifecycle FSM
│   │   ├── todo.machine.ts      # Todo lifecycle FSM
│   │   ├── session.machine.ts   # Chat session FSM
│   │   └── sync.machine.ts      # Sync workflow FSM
│   ├── session/
│   │   ├── session.ts           # Session CRUD
│   │   ├── message.ts           # Message structures
│   │   ├── prompt.ts            # Chat loop
│   │   ├── processor.ts         # Stream processing
│   │   └── llm.ts               # LLM execution
│   ├── storage/
│   │   └── storage.ts           # File storage
│   ├── parser/
│   │   └── dadgpt-md.ts         # Markdown parser
│   ├── permission/
│   │   └── permission.ts        # Permission system
│   ├── integration/
│   │   ├── gmail/
│   │   │   ├── auth.ts
│   │   │   └── client.ts
│   │   └── calendar/
│   │       ├── auth.ts
│   │       └── client.ts
│   ├── bus/
│   │   └── bus.ts               # Event pub/sub
│   └── util/
│       ├── log.ts               # Logging
│       └── id.ts                # ULID generation
├── test/
│   ├── cli/
│   ├── tool/
│   ├── state/
│   └── fixtures/
└── bin/
    └── dadgpt                   # Executable entry
```

### 5.3 Key Flows

#### Chat Flow
```
User Input → Yargs Parse → Run Command → Session Load/Create
     ↓
Message Add → LLM Call → Stream Response → Tool Calls?
     ↓                         ↓
Display Text              Execute Tool → Permission Check
     ↓                         ↓
Loop Until Done ←───────── Tool Result
     ↓
Save Session → Display Complete
```

#### Goal Creation Flow
```
User: "add goal to exercise"
     ↓
LLM interprets → goal.create tool call
     ↓
Permission check (auto-allow for goal)
     ↓
goalMachine.start() → Initial state: not_started
     ↓
Parse dadgpt.md → Add goal section → Write dadgpt.md
     ↓
Storage.write([goals, id], goalData)
     ↓
Bus.publish("goal.created", goal)
     ↓
Return success to LLM → LLM confirms to user
```

---

## 6. Data Models

### 6.1 Goal

```typescript
interface Goal {
  id: string              // ULID
  title: string           // "Exercise 3x per week"
  category: string        // "Health" | "Family" | "Work" | "Personal" | "Finance"
  state: GoalState        // From state machine
  progress: number        // 0-100
  description?: string
  milestones?: Milestone[]
  dueDate?: string        // ISO date
  createdAt: string       // ISO datetime
  updatedAt: string
  stateHistory: StateTransition[]
}

type GoalState = "not_started" | "in_progress" | "paused" | "completed" | "abandoned"

interface Milestone {
  id: string
  title: string
  completed: boolean
  completedAt?: string
}

interface StateTransition {
  from: GoalState
  to: GoalState
  at: string
  reason?: string
}
```

### 6.2 Todo

```typescript
interface Todo {
  id: string
  title: string
  state: TodoState
  timeframe: "today" | "this_week" | "someday"
  priority?: "high" | "medium" | "low"
  dueDate?: string
  goalId?: string         // Link to parent goal
  projectId?: string      // Link to project
  blockedReason?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

type TodoState = "pending" | "in_progress" | "blocked" | "deferred" | "done" | "cancelled"
```

### 6.3 Family Member

```typescript
interface FamilyMember {
  id: string
  name: string
  relationship: string    // "partner" | "child" | "parent" | "sibling" | etc
  birthday?: string       // "MM-DD" or "YYYY-MM-DD"
  notes?: string
}

interface ImportantDate {
  id: string
  title: string           // "Wedding Anniversary"
  date: string            // "MM-DD" for recurring
  members?: string[]      // Associated family member IDs
}
```

### 6.4 Project

```typescript
interface Project {
  id: string
  title: string
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled"
  description?: string
  budget?: number
  nextAction?: string
  tasks: ProjectTask[]
  createdAt: string
  updatedAt: string
}

interface ProjectTask {
  id: string
  title: string
  completed: boolean
  completedAt?: string
}
```

### 6.5 Session

```typescript
interface Session {
  id: string
  title: string
  directory: string       // Working directory
  version: string         // Schema version
  createdAt: string
  updatedAt: string
}

interface Message {
  id: string
  sessionId: string
  role: "user" | "assistant" | "system"
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  model?: { provider: string; model: string }
  usage?: { promptTokens: number; completionTokens: number }
  createdAt: string
}
```

### 6.6 Configuration

```typescript
interface Config {
  provider?: {
    [id: string]: {
      apiKey?: string
      baseUrl?: string
      defaultModel?: string
    }
  }
  defaultProvider?: string
  defaultModel?: string
  agents?: {
    [name: string]: AgentConfig
  }
  permission?: {
    allow?: string[]
    deny?: string[]
    ask?: string[]
  }
  integrations?: {
    gmail?: {
      enabled: boolean
      syncCount: number
    }
    calendar?: {
      enabled: boolean
      calendars: string[]
    }
  }
  goalCategories?: string[]
}
```

---

## 7. API & Integrations

### 7.1 LLM Providers

#### OpenAI
- **Auth**: API key via `OPENAI_API_KEY` or config
- **Models**: gpt-4, gpt-4-turbo, gpt-3.5-turbo
- **Features**: Streaming, function calling

#### Anthropic
- **Auth**: API key via `ANTHROPIC_API_KEY` or config
- **Models**: claude-3-opus, claude-3-sonnet, claude-3-haiku
- **Features**: Streaming, tool use

### 7.2 Google APIs

#### Gmail API
- **Auth**: OAuth 2.0 with offline access
- **Scopes**: `gmail.readonly`, `gmail.compose`
- **Endpoints**:
  - `GET /gmail/v1/users/me/messages` - List messages
  - `GET /gmail/v1/users/me/messages/{id}` - Get message
  - `POST /gmail/v1/users/me/messages/send` - Send message
  - `POST /gmail/v1/users/me/drafts` - Create draft

#### Google Calendar API
- **Auth**: OAuth 2.0 with offline access
- **Scopes**: `calendar.readonly`, `calendar.events`
- **Endpoints**:
  - `GET /calendar/v3/calendars/{id}/events` - List events
  - `POST /calendar/v3/calendars/{id}/events` - Create event
  - `GET /calendar/v3/freeBusy` - Check availability

### 7.3 Tool Definitions

Each tool follows this interface:

```typescript
interface Tool {
  name: string
  description: string
  parameters: ZodSchema
  execute(args: z.infer<typeof parameters>, ctx: Context): Promise<ToolResult>
}

interface ToolResult {
  title: string
  output: string
  metadata?: Record<string, unknown>
}
```

#### Goal Tool
```typescript
{
  name: "goal",
  description: "Manage goals - create, update, list, complete, pause, or abandon",
  parameters: z.object({
    action: z.enum(["create", "update", "list", "complete", "pause", "abandon"]),
    id: z.string().optional(),
    title: z.string().optional(),
    category: z.string().optional(),
    progress: z.number().optional(),
    filter: z.object({
      state: z.string().optional(),
      category: z.string().optional(),
    }).optional(),
  })
}
```

#### Todo Tool
```typescript
{
  name: "todo",
  description: "Manage todos - create, update, list, complete, defer, block, or cancel",
  parameters: z.object({
    action: z.enum(["create", "update", "list", "complete", "defer", "block", "cancel"]),
    id: z.string().optional(),
    title: z.string().optional(),
    timeframe: z.enum(["today", "this_week", "someday"]).optional(),
    priority: z.enum(["high", "medium", "low"]).optional(),
    blockedReason: z.string().optional(),
    filter: z.object({
      state: z.string().optional(),
      timeframe: z.string().optional(),
    }).optional(),
  })
}
```

---

## 8. Non-Functional Requirements

### 8.1 Performance

| Metric | Target |
|--------|--------|
| CLI startup time | < 100ms |
| Time to first token | < 500ms after LLM response starts |
| dadgpt.md parse time | < 50ms for typical file |
| Local storage operations | < 10ms |

### 8.2 Security

- API keys stored with 600 permissions
- OAuth tokens encrypted at rest
- No sensitive data in logs
- Sandboxed tool execution
- Permission prompts for sensitive operations

### 8.3 Reliability

- Graceful degradation when offline
- Automatic retry with exponential backoff
- Atomic file writes to prevent corruption
- Backup before destructive changes

### 8.4 Usability

- Clear error messages with actionable guidance
- Consistent command structure
- Tab completion support
- Help text for all commands
- Progressive disclosure (simple by default, powerful when needed)

### 8.5 Maintainability

- Comprehensive test coverage (>80%)
- TypeScript strict mode
- ESLint + Prettier formatting
- Modular architecture
- Clear separation of concerns

---

## 9. Implementation Roadmap

### Phase 1: Foundation (MVP)
**Goal**: Basic chat functionality with goal/todo management

- [ ] Project scaffolding (Bun, TypeScript, Yargs)
- [ ] CLI entry point with default chat command
- [ ] Configuration system (global config, env vars)
- [ ] OpenAI provider integration
- [ ] Basic streaming chat loop
- [ ] `dadgpt init` command
- [ ] dadgpt.md parser (read goals/todos)
- [ ] Goal tool (create, list, update)
- [ ] Todo tool (create, list, complete)
- [ ] File storage system
- [ ] Goal state machine (XState)
- [ ] Todo state machine
- [ ] Session persistence

### Phase 2: Enhanced Experience
**Goal**: Multi-provider support, better UX

- [ ] Anthropic provider integration
- [ ] `dadgpt auth` command
- [ ] Interactive mode improvements
- [ ] Session continuation (`--continue`)
- [ ] Permission system
- [ ] Family data support
- [ ] Family query tool
- [ ] Better error handling
- [ ] Debug logging (`--debug`)

### Phase 3: Integrations
**Goal**: External service connectivity

- [ ] Gmail OAuth flow
- [ ] Gmail sync command
- [ ] Gmail read/summarize tool
- [ ] Calendar OAuth flow
- [ ] Calendar sync command
- [ ] Calendar query tool
- [ ] Event creation tool
- [ ] Sync state machine

### Phase 4: Intelligence
**Goal**: Proactive assistance

- [ ] Email draft composition
- [ ] Calendar scheduling assistance
- [ ] Weekly planning helper
- [ ] Progress insights
- [ ] Reminder system
- [ ] Important date notifications

### Phase 5: Polish
**Goal**: Production readiness

- [ ] Comprehensive test suite
- [ ] Performance optimization
- [ ] Documentation
- [ ] Error recovery improvements
- [ ] Context summarization for long sessions
- [ ] Export/backup functionality

---

## 10. Success Metrics

### 10.1 Adoption Metrics

| Metric | Target (90 days) |
|--------|------------------|
| Daily active usage | 5+ days/week |
| Goals created | 10+ |
| Todos completed | 50+ |
| Sessions per week | 10+ |

### 10.2 Quality Metrics

| Metric | Target |
|--------|--------|
| Tool execution success rate | > 95% |
| State machine transition accuracy | 100% |
| Data integrity (no corruption) | 100% |
| CLI crash rate | < 1% of sessions |

### 10.3 Satisfaction Indicators

- Continued personal use
- Desire to add more features
- Recommending to others
- Contributing improvements

---

## Appendix A: Command Reference

```bash
# Chat (default)
dadgpt "what are my goals?"
dadgpt                          # Interactive mode
dadgpt --continue               # Resume last session
dadgpt --model gpt-4            # Use specific model
dadgpt --provider anthropic     # Use specific provider

# Setup
dadgpt init                     # Create dadgpt.md
dadgpt init --template minimal  # Use minimal template
dadgpt auth                     # Configure API keys
dadgpt auth --provider openai   # Configure specific provider

# Sync
dadgpt sync                     # Sync all integrations
dadgpt sync gmail               # Sync Gmail only
dadgpt sync calendar            # Sync Calendar only

# Management (convenience commands, also available via chat)
dadgpt goals                    # List goals
dadgpt goals --state in_progress
dadgpt todos                    # List todos
dadgpt todos --timeframe today
```

---

## Appendix B: Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DADGPT_API_KEY` | Default API key | `sk-...` |
| `DADGPT_PROVIDER` | Default provider | `openai`, `anthropic` |
| `DADGPT_MODEL` | Default model | `gpt-4` |
| `DADGPT_DEBUG` | Enable debug logging | `1` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |

---

## Appendix C: dadgpt.md Format

```markdown
---
# Optional YAML frontmatter for config overrides
provider: anthropic
model: claude-3-sonnet
---

# DadGPT - Personal Command Center

## Goals

### Health
- [ ] Exercise 3x per week
  - State: in_progress
  - Progress: 33%
  - Milestones:
    - [x] Join gym
    - [ ] Establish routine
    - [ ] 30 day streak

### Family
- [ ] Weekly family dinner
  - State: in_progress
  - Next: Sunday 6pm

## Todos

### Today
- [ ] Morning workout
- [ ] Review kids' homework

### This Week
- [ ] Schedule dentist appointment

### Someday
- [ ] Learn Spanish

## Family

### Members
- **Partner**: Sarah (Birthday: March 15)
- **Kids**:
  - Emma (8) - Birthday: June 22
  - Jake (5) - Birthday: October 3

### Important Dates
- Wedding Anniversary: September 10

## Projects

### Home Renovation
- Status: planning
- Budget: $15,000
- Next: Get contractor quotes
- Tasks:
  - [ ] Research contractors
  - [ ] Get 3 quotes

## Notes

Quick thoughts and reminders...
```

---

*Document Version: 1.0*
*Last Updated: 2025-01-11*
*Author: DadGPT Development*
