/**
 * Todos command - View and manage todos from the command line.
 *
 * Lists todos sorted by priority then due date with status icons,
 * priority badges, and due dates. Supports filtering and JSON output.
 */

import type { CommandModule } from "yargs"
import { Storage } from "../../storage/storage"
import type { GlobalOptions } from "../index"
import type { TodoState, TodoContext } from "../../state/todo.machine"

/**
 * Options specific to the todos command.
 */
export interface TodosOptions extends GlobalOptions {
  /** Filter by status */
  status?: TodoState
  /** Filter by priority */
  priority?: "low" | "medium" | "high"
  /** Filter by tag */
  tag?: string
  /** Output as JSON */
  json: boolean
}

/**
 * Stored todo structure (matches src/tool/todo.ts)
 */
interface StoredTodo extends TodoContext {
  state: TodoState
}

/**
 * Status icons for todo states
 */
const STATUS_ICONS: Record<TodoState, string> = {
  pending: "○",
  in_progress: "◐",
  blocked: "⊗",
  deferred: "⏸",
  done: "●",
  cancelled: "✗",
}

/**
 * Status colors (ANSI escape codes)
 */
const STATUS_COLORS: Record<TodoState, string> = {
  pending: "\x1b[90m", // gray
  in_progress: "\x1b[34m", // blue
  blocked: "\x1b[31m", // red
  deferred: "\x1b[33m", // yellow
  done: "\x1b[32m", // green
  cancelled: "\x1b[90m", // gray
}

/**
 * Priority badges and colors
 */
const PRIORITY_BADGES: Record<string, string> = {
  high: "\x1b[31m!!!\x1b[0m",
  medium: "\x1b[33m!!\x1b[0m",
  low: "\x1b[90m!\x1b[0m",
}

/**
 * Priority weight for sorting (higher = more urgent)
 */
const PRIORITY_WEIGHT: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

const RESET = "\x1b[0m"

/**
 * Format a due date for display
 */
function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return ""

  const date = new Date(dueDate)
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return `\x1b[31mOverdue by ${Math.abs(diffDays)}d${RESET}`
  } else if (diffDays === 0) {
    return `\x1b[33mDue today${RESET}`
  } else if (diffDays <= 7) {
    return `\x1b[33mDue in ${diffDays}d${RESET}`
  }
  return `Due: ${dueDate}`
}

/**
 * List all todos from storage
 */
async function listTodos(): Promise<StoredTodo[]> {
  const todoIds = await Storage.list(["todos"])
  const todos = await Promise.all(
    todoIds.map((id) => Storage.read<StoredTodo>(["todos", id]))
  )
  return todos.filter((t): t is StoredTodo => t !== undefined)
}

/**
 * Display todos in human-readable format
 */
function displayTodos(todos: StoredTodo[]): void {
  if (todos.length === 0) {
    console.log("\x1b[90mNo todos found.\x1b[0m")
    console.log("")
    console.log("Create todos using the chat interface or by running:")
    console.log("  \x1b[36mdadgpt \"Add a todo to finish the report\"\x1b[0m")
    return
  }

  // Sort by priority (high first) then by dueDate (earliest first, nulls last)
  todos.sort((a, b) => {
    // First by priority (high > medium > low)
    const priorityDiff = (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0)
    if (priorityDiff !== 0) return priorityDiff

    // Then by dueDate (null dates go last)
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    }
    if (a.dueDate) return -1
    if (b.dueDate) return 1

    // Finally by createdAt (oldest first)
    return a.createdAt - b.createdAt
  })

  console.log("")
  console.log("\x1b[1mTodos\x1b[0m")
  console.log("\x1b[90m" + "─".repeat(50) + RESET)

  for (const todo of todos) {
    const statusIcon = STATUS_ICONS[todo.state]
    const statusColor = STATUS_COLORS[todo.state]
    const priorityBadge = PRIORITY_BADGES[todo.priority] ?? ""
    const dueDisplay = formatDueDate(todo.dueDate)

    // Main todo line: status icon, priority badge, title
    console.log(
      `  ${statusColor}${statusIcon}${RESET} ${priorityBadge} ${todo.title}`
    )

    // Details line: due date and tags
    const details: string[] = []
    if (dueDisplay) {
      details.push(dueDisplay)
    }
    if (todo.tags.length > 0) {
      details.push(`\x1b[36m[${todo.tags.join(", ")}]${RESET}`)
    }
    if (details.length > 0) {
      console.log(`    ${details.join(" ")}`)
    }
  }

  console.log("")
  console.log(`\x1b[90mTotal: ${todos.length} todo${todos.length === 1 ? "" : "s"}${RESET}`)
}

/**
 * Todos command definition.
 */
export const todosCommand: CommandModule<GlobalOptions, TodosOptions> = {
  command: "todos",
  describe: "List and view todos",

  builder: (yargs) =>
    yargs
      .option("status", {
        alias: "s",
        type: "string",
        description: "Filter by status (pending, in_progress, blocked, deferred, done, cancelled)",
        choices: ["pending", "in_progress", "blocked", "deferred", "done", "cancelled"] as const,
      })
      .option("priority", {
        alias: "p",
        type: "string",
        description: "Filter by priority (low, medium, high)",
        choices: ["low", "medium", "high"] as const,
      })
      .option("tag", {
        alias: "t",
        type: "string",
        description: "Filter by tag",
      })
      .option("json", {
        type: "boolean",
        description: "Output as JSON",
        default: false,
      }),

  handler: async (argv) => {
    // Load all todos
    let todos = await listTodos()

    // Apply status filter
    if (argv.status) {
      todos = todos.filter((t) => t.state === argv.status)
    }

    // Apply priority filter
    if (argv.priority) {
      todos = todos.filter((t) => t.priority === argv.priority)
    }

    // Apply tag filter (case-insensitive)
    if (argv.tag) {
      const tagLower = argv.tag.toLowerCase()
      todos = todos.filter((t) =>
        t.tags.some((tag) => tag.toLowerCase() === tagLower)
      )
    }

    // Output
    if (argv.json) {
      console.log(JSON.stringify(todos, null, 2))
    } else {
      displayTodos(todos)
    }
  },
}
