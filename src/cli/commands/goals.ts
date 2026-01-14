/**
 * Goals command - View and manage goals from the command line.
 *
 * Lists goals grouped by category with status icons, progress bars,
 * and due dates. Supports filtering and JSON output.
 */

import type { CommandModule } from "yargs"
import { Storage } from "../../storage/storage"
import type { GlobalOptions } from "../index"
import type { GoalState } from "../../state/goal.machine"
import { Log } from "../../util/log"

/**
 * Options specific to the goals command.
 */
export interface GoalsOptions extends GlobalOptions {
  /** Filter by category */
  category?: string
  /** Filter by status */
  status?: GoalState
  /** Output as JSON */
  json: boolean
}

/**
 * Stored goal structure (matches src/tool/goal.ts)
 */
interface StoredGoal {
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
  state: GoalState
}

/**
 * Status icons for goal states
 */
const STATUS_ICONS: Record<GoalState, string> = {
  not_started: "○",
  in_progress: "◐",
  paused: "⏸",
  completed: "●",
  abandoned: "✗",
}

/**
 * Status colors (ANSI escape codes)
 */
const STATUS_COLORS: Record<GoalState, string> = {
  not_started: "\x1b[90m", // gray
  in_progress: "\x1b[34m", // blue
  paused: "\x1b[33m", // yellow
  completed: "\x1b[32m", // green
  abandoned: "\x1b[31m", // red
}

const RESET = "\x1b[0m"

/**
 * Create a progress bar string
 */
function createProgressBar(progress: number, width: number = 10): string {
  const filled = Math.round((progress / 100) * width)
  const empty = width - filled
  const bar = "█".repeat(filled) + "░".repeat(empty)
  return `[${bar}]`
}

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
 * List all goals from storage
 */
async function listGoals(): Promise<StoredGoal[]> {
  const goalIds = await Storage.list(["goals"])
  const goals = await Promise.all(
    goalIds.map((id) => Storage.read<StoredGoal>(["goals", id]))
  )
  return goals.filter((g): g is StoredGoal => g !== undefined)
}

/**
 * Display goals in human-readable format
 */
function displayGoals(goals: StoredGoal[]): void {
  if (goals.length === 0) {
    console.log("\x1b[90mNo goals found.\x1b[0m")
    console.log("")
    console.log("Create goals using the chat interface or by running:")
    console.log("  \x1b[36mdadgpt \"Create a goal to learn TypeScript\"\x1b[0m")
    return
  }

  // Group goals by category
  const grouped = new Map<string, StoredGoal[]>()
  for (const goal of goals) {
    const category = goal.category || "Uncategorized"
    if (!grouped.has(category)) {
      grouped.set(category, [])
    }
    grouped.get(category)!.push(goal)
  }

  // Sort categories alphabetically
  const sortedCategories = Array.from(grouped.keys()).sort()

  for (const category of sortedCategories) {
    const categoryGoals = grouped.get(category)!

    // Sort goals within category: active first, then by progress desc
    categoryGoals.sort((a, b) => {
      // Completed/abandoned goals go last
      const aActive = a.state !== "completed" && a.state !== "abandoned"
      const bActive = b.state !== "completed" && b.state !== "abandoned"
      if (aActive !== bActive) return bActive ? 1 : -1
      // Then by progress descending
      return b.progress - a.progress
    })

    // Print category header
    console.log("")
    console.log(`\x1b[1m${category}\x1b[0m`)
    console.log("\x1b[90m" + "─".repeat(40) + RESET)

    for (const goal of categoryGoals) {
      const statusIcon = STATUS_ICONS[goal.state]
      const statusColor = STATUS_COLORS[goal.state]
      const progressBar = createProgressBar(goal.progress)
      const dueDisplay = formatDueDate(goal.dueDate)

      // Main goal line
      console.log(
        `  ${statusColor}${statusIcon}${RESET} ${goal.title}`
      )

      // Progress and due date line
      const progressText = `\x1b[90m${goal.progress}%${RESET}`
      const details = [progressBar, progressText]
      if (dueDisplay) {
        details.push(dueDisplay)
      }
      console.log(`    ${details.join(" ")}`)
    }
  }

  console.log("")
  console.log(`\x1b[90mTotal: ${goals.length} goal${goals.length === 1 ? "" : "s"}${RESET}`)
}

/**
 * Goals command definition.
 */
export const goalsCommand: CommandModule<GlobalOptions, GoalsOptions> = {
  command: "goals",
  describe: "List and view goals",

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
        description: "Filter by status (not_started, in_progress, paused, completed, abandoned)",
        choices: ["not_started", "in_progress", "paused", "completed", "abandoned"] as const,
      })
      .option("json", {
        type: "boolean",
        description: "Output as JSON",
        default: false,
      }),

  handler: async (argv) => {
    try {
      // Load all goals
      let goals = await listGoals()

      // Apply category filter (case-insensitive)
      if (argv.category) {
        goals = goals.filter(
          (g) => g.category.toLowerCase() === argv.category!.toLowerCase()
        )
      }

      // Apply status filter
      if (argv.status) {
        goals = goals.filter((g) => g.state === argv.status)
      }

      // Output
      if (argv.json) {
        console.log(JSON.stringify(goals, null, 2))
      } else {
        displayGoals(goals)
      }
    } catch (err) {
      Log.formatAndLogError("Failed to load goals", err)
      if (argv.json) {
        // Output empty array for JSON mode to maintain parseable output
        console.log("[]")
      }
      process.exit(1)
    }
  },
}
