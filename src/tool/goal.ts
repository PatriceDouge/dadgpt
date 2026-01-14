import { z } from "zod"
import { createActor } from "xstate"
import type { Tool, ToolContext, ToolResult } from "./types"
import { Storage } from "../storage/storage"
import { Bus } from "../bus/bus"
import { createTimestampedId } from "../util/id"
import {
  goalMachine,
  createGoalContext,
  type GoalContext,
  type GoalState,
  type GoalEvent,
} from "../state/goal.machine"

/**
 * Storage key prefix for goals
 */
const GOALS_PREFIX = ["goals"]

/**
 * Stored goal includes state machine state
 */
interface StoredGoal extends GoalContext {
  state: GoalState
}

/**
 * Parameters schema for the goal tool
 */
const GoalToolParams = z.object({
  action: z.enum(["list", "create", "get", "update", "transition", "delete"]),
  // For create
  title: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  milestones: z
    .array(z.object({ title: z.string() }))
    .optional(),
  // For get, update, transition, delete
  id: z.string().optional(),
  // For update
  progress: z.number().min(0).max(100).optional(),
  // For transition
  event: z
    .enum(["START", "PAUSE", "RESUME", "COMPLETE", "ABANDON", "COMPLETE_MILESTONE"])
    .optional(),
  milestoneId: z.string().optional(),
  // For list filters
  categoryFilter: z.string().optional(),
  statusFilter: z.enum(["not_started", "in_progress", "paused", "completed", "abandoned"]).optional(),
})

type GoalToolArgs = z.infer<typeof GoalToolParams>

/**
 * Load a goal from storage
 */
async function loadGoal(id: string): Promise<StoredGoal | undefined> {
  return Storage.read<StoredGoal>([...GOALS_PREFIX, id])
}

/**
 * Save a goal to storage
 */
async function saveGoal(goal: StoredGoal): Promise<void> {
  await Storage.write([...GOALS_PREFIX, goal.id], goal)
}

/**
 * List all goals from storage
 */
async function listGoals(): Promise<StoredGoal[]> {
  const goalIds = await Storage.list(GOALS_PREFIX)
  const goals = await Promise.all(
    goalIds.map((id) => loadGoal(id))
  )
  return goals.filter((g): g is StoredGoal => g !== undefined)
}

/**
 * Execute the goal tool actions
 */
async function executeGoalTool(
  args: GoalToolArgs,
  _ctx: ToolContext
): Promise<ToolResult> {
  switch (args.action) {
    case "list":
      return handleList(args)
    case "create":
      return handleCreate(args)
    case "get":
      return handleGet(args)
    case "update":
      return handleUpdate(args)
    case "transition":
      return handleTransition(args)
    case "delete":
      return handleDelete(args)
    default:
      return {
        title: "Error",
        output: `Unknown action: ${args.action}`,
      }
  }
}

/**
 * Handle list action
 */
async function handleList(args: GoalToolArgs): Promise<ToolResult> {
  let goals = await listGoals()

  // Apply category filter
  if (args.categoryFilter) {
    goals = goals.filter(
      (g) => g.category.toLowerCase() === args.categoryFilter!.toLowerCase()
    )
  }

  // Apply status filter
  if (args.statusFilter) {
    goals = goals.filter((g) => g.state === args.statusFilter)
  }

  // Sort by createdAt descending (newest first)
  goals.sort((a, b) => b.createdAt - a.createdAt)

  if (goals.length === 0) {
    return {
      title: "Goals",
      output: "No goals found.",
      metadata: { count: 0 },
    }
  }

  const output = goals
    .map(
      (g) =>
        `- [${g.state}] ${g.title} (${g.category}) - ${g.progress}% complete${g.dueDate ? ` | Due: ${g.dueDate}` : ""}`
    )
    .join("\n")

  return {
    title: "Goals",
    output,
    metadata: { count: goals.length },
  }
}

/**
 * Handle create action
 */
async function handleCreate(args: GoalToolArgs): Promise<ToolResult> {
  if (!args.title) {
    return {
      title: "Error",
      output: "Title is required to create a goal.",
    }
  }

  const id = createTimestampedId("goal")
  const now = Date.now()

  // Create milestones with IDs if provided
  const milestones = (args.milestones ?? []).map((m, index) => ({
    id: `${id}_m${index}`,
    title: m.title,
    completed: false,
  }))

  const context = createGoalContext({
    id,
    title: args.title,
    category: args.category ?? "Personal",
    description: args.description ?? "",
    dueDate: args.dueDate ?? null,
    milestones,
    createdAt: now,
    updatedAt: now,
  })

  const goal: StoredGoal = {
    ...context,
    state: "not_started",
  }

  await saveGoal(goal)
  Bus.publish("goal.created", { goalId: id })

  return {
    title: "Goal Created",
    output: `Created goal: "${args.title}" (ID: ${id})`,
    metadata: { goalId: id },
  }
}

/**
 * Handle get action
 */
async function handleGet(args: GoalToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to get a goal.",
    }
  }

  const goal = await loadGoal(args.id)
  if (!goal) {
    return {
      title: "Error",
      output: `Goal not found: ${args.id}`,
    }
  }

  const milestonesOutput =
    goal.milestones.length > 0
      ? `\nMilestones:\n${goal.milestones.map((m) => `  - [${m.completed ? "x" : " "}] ${m.title}`).join("\n")}`
      : ""

  const output = `
Title: ${goal.title}
Category: ${goal.category}
Status: ${goal.state}
Progress: ${goal.progress}%
Description: ${goal.description || "(none)"}
Due Date: ${goal.dueDate || "(none)"}${milestonesOutput}
Created: ${new Date(goal.createdAt).toLocaleString()}
Updated: ${new Date(goal.updatedAt).toLocaleString()}
`.trim()

  return {
    title: `Goal: ${goal.title}`,
    output,
    metadata: { goal },
  }
}

/**
 * Handle update action
 */
async function handleUpdate(args: GoalToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to update a goal.",
    }
  }

  const goal = await loadGoal(args.id)
  if (!goal) {
    return {
      title: "Error",
      output: `Goal not found: ${args.id}`,
    }
  }

  const changes: Record<string, unknown> = {}

  if (args.title !== undefined) {
    goal.title = args.title
    changes.title = args.title
  }

  if (args.description !== undefined) {
    goal.description = args.description
    changes.description = args.description
  }

  if (args.progress !== undefined) {
    // Use state machine for progress update if in_progress
    if (goal.state === "in_progress") {
      const actor = createActor(goalMachine, {
        snapshot: goalMachine.resolveState({
          value: goal.state,
          context: goal,
        }),
      })
      actor.start()
      actor.send({ type: "UPDATE_PROGRESS", progress: args.progress })
      const snapshot = actor.getSnapshot()
      goal.progress = snapshot.context.progress
      goal.updatedAt = snapshot.context.updatedAt
      actor.stop()
    } else {
      // Allow direct progress update for non-in_progress states
      goal.progress = Math.min(100, Math.max(0, args.progress))
      goal.updatedAt = Date.now()
    }
    changes.progress = goal.progress
  }

  if (Object.keys(changes).length === 0) {
    return {
      title: "No Changes",
      output: "No fields were specified to update.",
    }
  }

  goal.updatedAt = Date.now()
  await saveGoal(goal)
  Bus.publish("goal.updated", { goalId: args.id, changes })

  return {
    title: "Goal Updated",
    output: `Updated goal "${goal.title}": ${Object.keys(changes).join(", ")}`,
    metadata: { goalId: args.id, changes },
  }
}

/**
 * Handle transition action
 */
async function handleTransition(args: GoalToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to transition a goal.",
    }
  }

  if (!args.event) {
    return {
      title: "Error",
      output: "Event is required to transition a goal. Valid events: START, PAUSE, RESUME, COMPLETE, ABANDON, COMPLETE_MILESTONE",
    }
  }

  const goal = await loadGoal(args.id)
  if (!goal) {
    return {
      title: "Error",
      output: `Goal not found: ${args.id}`,
    }
  }

  // Check if goal is in a final state
  if (goal.state === "completed" || goal.state === "abandoned") {
    return {
      title: "Error",
      output: `Cannot transition goal in final state: ${goal.state}`,
    }
  }

  // Create actor with current state
  const actor = createActor(goalMachine, {
    snapshot: goalMachine.resolveState({
      value: goal.state,
      context: goal,
    }),
  })
  actor.start()

  // Build the event
  let event: GoalEvent
  if (args.event === "COMPLETE_MILESTONE") {
    if (!args.milestoneId) {
      actor.stop()
      return {
        title: "Error",
        output: "milestoneId is required for COMPLETE_MILESTONE event.",
      }
    }
    event = { type: "COMPLETE_MILESTONE", milestoneId: args.milestoneId }
  } else {
    event = { type: args.event } as GoalEvent
  }

  // Send the event
  actor.send(event)

  // Get the new state
  const snapshot = actor.getSnapshot()
  const newState = snapshot.value as GoalState
  const newContext = snapshot.context

  actor.stop()

  // Update stored goal
  const updatedGoal: StoredGoal = {
    ...newContext,
    state: newState,
  }
  await saveGoal(updatedGoal)

  // Publish events
  if (newState === "completed") {
    Bus.publish("goal.completed", { goalId: args.id })
  }

  return {
    title: "Goal Transitioned",
    output: `Goal "${goal.title}" transitioned from ${goal.state} to ${newState}`,
    metadata: { goalId: args.id, previousState: goal.state, newState },
  }
}

/**
 * Handle delete action
 */
async function handleDelete(args: GoalToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to delete a goal.",
    }
  }

  const goal = await loadGoal(args.id)
  if (!goal) {
    return {
      title: "Error",
      output: `Goal not found: ${args.id}`,
    }
  }

  const deleted = await Storage.remove([...GOALS_PREFIX, args.id])
  if (!deleted) {
    return {
      title: "Error",
      output: `Failed to delete goal: ${args.id}`,
    }
  }

  Bus.publish("goal.deleted", { goalId: args.id })

  return {
    title: "Goal Deleted",
    output: `Deleted goal: "${goal.title}" (ID: ${args.id})`,
    metadata: { goalId: args.id },
  }
}

/**
 * Goal Tool - Manages goals with CRUD operations and state transitions
 */
export const GoalTool: Tool<typeof GoalToolParams> = {
  id: "goal",
  description: `Manage goals with full lifecycle support. Actions:
- list: List all goals (optional filters: categoryFilter, statusFilter)
- create: Create a new goal (required: title; optional: category, description, dueDate, milestones)
- get: Get goal details by ID
- update: Update goal fields (title, description, progress)
- transition: Change goal state (events: START, PAUSE, RESUME, COMPLETE, ABANDON, COMPLETE_MILESTONE)
- delete: Remove a goal by ID`,
  parameters: GoalToolParams,
  execute: executeGoalTool,
}
