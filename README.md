# DadGPT

A personal command center CLI that helps manage goals, todos, projects, and family life with an AI-powered chat interface.

## Features

- **Interactive TUI Chat** - Natural language interface powered by Claude or GPT
- **Goal Management** - Track long-term objectives with progress and milestones
- **Todo Management** - Daily/weekly tasks with priorities, tags, and state tracking
- **Project Management** - Multi-step projects with milestones and budgets
- **Family Info** - Store family member details and upcoming birthdays
- **Local-First Storage** - All data stored locally in `~/.dadgpt/`

## Prerequisites

- **Node.js 20+**
- **pnpm** (recommended) or npm

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd dadgpt

# Install dependencies
pnpm install

# Make the CLI executable (optional, for global usage)
chmod +x bin/dadgpt
```

## Configuration

### API Keys

DadGPT requires an API key from either Anthropic (Claude) or OpenAI. Configure your keys using one of these methods:

#### Option 1: Interactive Setup

```bash
pnpm dev auth
```

This will prompt you to enter API keys for available providers.

#### Option 2: Environment Variables

Create a `.env` file in the project root:

```bash
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...
```

#### Option 3: Config File

Edit `~/.dadgpt/config.json`:

```json
{
  "providers": {
    "anthropic": {
      "id": "anthropic",
      "apiKey": "sk-ant-..."
    }
  },
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514"
}
```

### Available Models

| Provider | Model ID | Description |
|----------|----------|-------------|
| Anthropic | `claude-sonnet-4-20250514` | Claude Sonnet 4 (default) |
| Anthropic | `claude-3-5-haiku-20241022` | Claude 3.5 Haiku (faster) |
| OpenAI | `gpt-4o` | GPT-4o |
| OpenAI | `gpt-4o-mini` | GPT-4o Mini (faster) |

## Usage

### Start Interactive Chat (Default)

```bash
# Development mode
pnpm dev

# Or with an initial message
pnpm dev "What are my goals for this week?"
```

### CLI Commands

#### Initialize Project

Creates a `dadgpt.md` file in the current directory for project-specific notes:

```bash
pnpm dev init
```

#### Configure API Keys

```bash
pnpm dev auth
```

#### List Goals

```bash
# List all goals
pnpm dev goals

# Filter by category
pnpm dev goals --category Work

# Filter by status
pnpm dev goals --status in_progress

# Output as JSON
pnpm dev goals --json
```

#### List Todos

```bash
# List all todos
pnpm dev todos

# Filter by status
pnpm dev todos --status pending

# Filter by priority
pnpm dev todos --priority high

# Filter by tag
pnpm dev todos --tag work

# Output as JSON
pnpm dev todos --json
```

### Command Options

```bash
pnpm dev --help          # Show help
pnpm dev --version       # Show version
pnpm dev --debug         # Enable debug logging
```

### Keyboard Shortcuts (in TUI)

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Ctrl+C` | Exit |
| `Escape` | Exit |

## Development

### Run in Development Mode

```bash
pnpm dev
```

### Run Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Type Checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm lint
```

### Build for Production

```bash
pnpm build
```

## Project Structure

```
dadgpt/
├── bin/dadgpt           # CLI entry point
├── src/
│   ├── index.ts         # Main entry
│   ├── cli/             # CLI commands (yargs)
│   ├── tui/             # React Ink TUI components
│   ├── config/          # Configuration system
│   ├── provider/        # LLM provider abstraction
│   ├── tool/            # AI tools (goal, todo, project, family, read, write)
│   ├── agent/           # AI agent definitions
│   ├── session/         # Chat session management
│   ├── state/           # XState state machines
│   ├── storage/         # JSON file persistence
│   ├── permission/      # Tool permission system
│   ├── bus/             # Event pub/sub system
│   ├── parser/          # Markdown parser for dadgpt.md
│   └── util/            # Utilities (id, log, errors)
└── test/
    ├── unit/            # Unit tests
    ├── integration/     # Integration tests
    ├── e2e/             # End-to-end tests
    └── fixtures/        # Test fixtures
```

## Data Storage

All data is stored locally in `~/.dadgpt/`:

```
~/.dadgpt/
├── config.json          # User configuration
├── data/
│   ├── goals/           # Goal data
│   ├── todos/           # Todo data
│   ├── projects/        # Project data
│   └── sessions/        # Chat session history
```

## AI Tools

DadGPT provides the following tools to the AI:

| Tool | Description |
|------|-------------|
| `goal` | Create, read, update, delete, and transition goals |
| `todo` | Create, read, update, delete, and transition todos |
| `project` | Manage projects with milestones |
| `family` | Store and query family member information |
| `read` | Read files from the filesystem |
| `write` | Write files to the filesystem |

## Permissions

By default, DadGPT allows read-only tools automatically and prompts for write operations:

- **Allowed**: `read`, `goal`, `todo`, `project`, `family`
- **Ask**: `write`, `bash`

Configure in `~/.dadgpt/config.json`:

```json
{
  "permissions": {
    "allow": ["read", "goal", "todo", "project", "family"],
    "deny": [],
    "ask": ["write", "bash"]
  }
}
```

## License

MIT
