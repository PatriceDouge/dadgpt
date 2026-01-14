import { z } from "zod"
import { createActor } from "xstate"
import type { Tool, ToolContext, ToolResult } from "./types"
import { Storage } from "../storage/storage"
import { Bus } from "../bus/bus"
import { createTimestampedId } from "../util/id"
import {
  todoMachine,
  createTodoContext,
  type TodoContext,
  type TodoState,
  type TodoEvent,
} from "../state/todo.machine"

/**
 * Storage key prefix for todos
 */
const TODOS_PREFIX = ["todos"]

/**
 * Stored todo includes state machine state
 */
interface StoredTodo extends TodoContext {
  state: TodoState
}

/**
 * Parameters schema for the todo tool
 */
const TodoToolParams = z.object({
  action: z.enum(["list", "create", "get", "complete", "transition", "delete"]),
  // For create
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
  goalId: z.string().optional(),
  // For get, complete, transition, delete
  id: z.string().optional(),
  // For transition
  event: z
    .enum(["START", "COMPLETE", "BLOCK", "UNBLOCK", "DEFER", "CANCEL", "REOPEN"])
    .optional(),
  blockedBy: z.string().optional(),
  until: z.string().optional(),
  // For list filters
  statusFilter: z.enum(["pending", "in_progress", "blocked", "deferred", "done", "cancelled"]).optional(),
  priorityFilter: z.enum(["low", "medium", "high"]).optional(),
  tagFilter: z.string().optional(),
})

type TodoToolArgs = z.infer<typeof TodoToolParams>

/**
 * Load a todo from storage
 */
async function loadTodo(id: string): Promise<StoredTodo | undefined> {
  return Storage.read<StoredTodo>([...TODOS_PREFIX, id])
}

/**
 * Save a todo to storage
 */
async function saveTodo(todo: StoredTodo): Promise<void> {
  await Storage.write([...TODOS_PREFIX, todo.id], todo)
}

/**
 * List all todos from storage
 */
async function listTodos(): Promise<StoredTodo[]> {
  const todoIds = await Storage.list(TODOS_PREFIX)
  const todos = await Promise.all(
    todoIds.map((id) => loadTodo(id))
  )
  return todos.filter((t): t is StoredTodo => t !== undefined)
}

/**
 * Priority weight for sorting (higher = more urgent)
 */
const PRIORITY_WEIGHT: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

/**
 * Execute the todo tool actions
 */
async function executeTodoTool(
  args: TodoToolArgs,
  _ctx: ToolContext
): Promise<ToolResult> {
  switch (args.action) {
    case "list":
      return handleList(args)
    case "create":
      return handleCreate(args)
    case "get":
      return handleGet(args)
    case "complete":
      return handleComplete(args)
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
async function handleList(args: TodoToolArgs): Promise<ToolResult> {
  let todos = await listTodos()

  // Apply status filter
  if (args.statusFilter) {
    todos = todos.filter((t) => t.state === args.statusFilter)
  }

  // Apply priority filter
  if (args.priorityFilter) {
    todos = todos.filter((t) => t.priority === args.priorityFilter)
  }

  // Apply tag filter
  if (args.tagFilter) {
    const tagLower = args.tagFilter.toLowerCase()
    todos = todos.filter((t) =>
      t.tags.some((tag) => tag.toLowerCase() === tagLower)
    )
  }

  // Sort by priority (high first) then by dueDate (earliest first)
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

  if (todos.length === 0) {
    return {
      title: "Todos",
      output: "No todos found.",
      metadata: { count: 0 },
    }
  }

  const priorityIcon: Record<string, string> = {
    high: "!!!",
    medium: "!!",
    low: "!",
  }

  const output = todos
    .map(
      (t) =>
        `- [${t.state}] ${priorityIcon[t.priority] ?? ""} ${t.title}${t.dueDate ? ` | Due: ${t.dueDate}` : ""}${t.tags.length > 0 ? ` | Tags: ${t.tags.join(", ")}` : ""}`
    )
    .join("\n")

  return {
    title: "Todos",
    output,
    metadata: { count: todos.length },
  }
}

/**
 * Handle create action
 */
async function handleCreate(args: TodoToolArgs): Promise<ToolResult> {
  if (!args.title) {
    return {
      title: "Error",
      output: "Title is required to create a todo.",
    }
  }

  const id = createTimestampedId("todo")
  const now = Date.now()

  const context = createTodoContext({
    id,
    title: args.title,
    description: args.description ?? "",
    priority: args.priority ?? "medium",
    dueDate: args.dueDate ?? null,
    tags: args.tags ?? [],
    goalId: args.goalId ?? null,
    createdAt: now,
    updatedAt: now,
  })

  const todo: StoredTodo = {
    ...context,
    state: "pending",
  }

  await saveTodo(todo)
  Bus.publish("todo.created", { todoId: id })

  return {
    title: "Todo Created",
    output: `Created todo: "${args.title}" (ID: ${id})`,
    metadata: { todoId: id },
  }
}

/**
 * Handle get action
 */
async function handleGet(args: TodoToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to get a todo.",
    }
  }

  const todo = await loadTodo(args.id)
  if (!todo) {
    return {
      title: "Error",
      output: `Todo not found: ${args.id}`,
    }
  }

  const output = `
Title: ${todo.title}
Status: ${todo.state}
Priority: ${todo.priority}
Description: ${todo.description || "(none)"}
Due Date: ${todo.dueDate || "(none)"}
Tags: ${todo.tags.length > 0 ? todo.tags.join(", ") : "(none)"}
Goal ID: ${todo.goalId || "(none)"}
Blocked By: ${todo.blockedBy || "(none)"}
Created: ${new Date(todo.createdAt).toLocaleString()}
Updated: ${new Date(todo.updatedAt).toLocaleString()}
Completed: ${todo.completedAt ? new Date(todo.completedAt).toLocaleString() : "(not completed)"}
`.trim()

  return {
    title: `Todo: ${todo.title}`,
    output,
    metadata: { todo },
  }
}

/**
 * Handle complete action - shortcut to mark a todo as done
 */
async function handleComplete(args: TodoToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to complete a todo.",
    }
  }

  const todo = await loadTodo(args.id)
  if (!todo) {
    return {
      title: "Error",
      output: `Todo not found: ${args.id}`,
    }
  }

  // Check if already done
  if (todo.state === "done") {
    return {
      title: "Already Complete",
      output: `Todo "${todo.title}" is already completed.`,
      metadata: { todoId: args.id },
    }
  }

  // Check if we can complete from current state
  const completableStates: TodoState[] = ["pending", "in_progress"]
  if (!completableStates.includes(todo.state)) {
    return {
      title: "Error",
      output: `Cannot complete todo from state: ${todo.state}. Use transition to change state first.`,
    }
  }

  // Create actor with current state
  const actor = createActor(todoMachine, {
    snapshot: todoMachine.resolveState({
      value: todo.state,
      context: todo,
    }),
  })
  actor.start()
  actor.send({ type: "COMPLETE" })

  const snapshot = actor.getSnapshot()
  const newState = snapshot.value as TodoState
  const newContext = snapshot.context

  actor.stop()

  // Update stored todo
  const updatedTodo: StoredTodo = {
    ...newContext,
    state: newState,
  }
  await saveTodo(updatedTodo)

  Bus.publish("todo.completed", { todoId: args.id })

  return {
    title: "Todo Completed",
    output: `Completed todo: "${todo.title}"`,
    metadata: { todoId: args.id },
  }
}

/**
 * Handle transition action
 */
async function handleTransition(args: TodoToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to transition a todo.",
    }
  }

  if (!args.event) {
    return {
      title: "Error",
      output: "Event is required to transition a todo. Valid events: START, COMPLETE, BLOCK, UNBLOCK, DEFER, CANCEL, REOPEN",
    }
  }

  const todo = await loadTodo(args.id)
  if (!todo) {
    return {
      title: "Error",
      output: `Todo not found: ${args.id}`,
    }
  }

  // Create actor with current state
  const actor = createActor(todoMachine, {
    snapshot: todoMachine.resolveState({
      value: todo.state,
      context: todo,
    }),
  })
  actor.start()

  // Build the event
  let event: TodoEvent
  switch (args.event) {
    case "BLOCK":
      if (!args.blockedBy) {
        actor.stop()
        return {
          title: "Error",
          output: "blockedBy is required for BLOCK event.",
        }
      }
      event = { type: "BLOCK", blockedBy: args.blockedBy }
      break
    case "DEFER":
      if (!args.until) {
        actor.stop()
        return {
          title: "Error",
          output: "until (date) is required for DEFER event.",
        }
      }
      event = { type: "DEFER", until: args.until }
      break
    default:
      event = { type: args.event } as TodoEvent
  }

  // Send the event
  actor.send(event)

  // Get the new state
  const snapshot = actor.getSnapshot()
  const newState = snapshot.value as TodoState
  const newContext = snapshot.context

  actor.stop()

  // Check if state actually changed
  if (newState === todo.state) {
    return {
      title: "No Change",
      output: `Event ${args.event} is not valid from state ${todo.state}.`,
      metadata: { todoId: args.id, currentState: todo.state },
    }
  }

  // Update stored todo
  const updatedTodo: StoredTodo = {
    ...newContext,
    state: newState,
  }
  await saveTodo(updatedTodo)

  // Publish events
  if (newState === "done") {
    Bus.publish("todo.completed", { todoId: args.id })
  }

  return {
    title: "Todo Transitioned",
    output: `Todo "${todo.title}" transitioned from ${todo.state} to ${newState}`,
    metadata: { todoId: args.id, previousState: todo.state, newState },
  }
}

/**
 * Handle delete action
 */
async function handleDelete(args: TodoToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to delete a todo.",
    }
  }

  const todo = await loadTodo(args.id)
  if (!todo) {
    return {
      title: "Error",
      output: `Todo not found: ${args.id}`,
    }
  }

  const deleted = await Storage.remove([...TODOS_PREFIX, args.id])
  if (!deleted) {
    return {
      title: "Error",
      output: `Failed to delete todo: ${args.id}`,
    }
  }

  Bus.publish("todo.deleted", { todoId: args.id })

  return {
    title: "Todo Deleted",
    output: `Deleted todo: "${todo.title}" (ID: ${args.id})`,
    metadata: { todoId: args.id },
  }
}

/**
 * Todo Tool - Manages todos with CRUD operations and state transitions
 */
export const TodoTool: Tool<typeof TodoToolParams> = {
  id: "todo",
  description: `Manage todos with full lifecycle support. Actions:
- list: List all todos (optional filters: statusFilter, priorityFilter, tagFilter). Sorted by priority then dueDate.
- create: Create a new todo (required: title; optional: description, priority, dueDate, tags, goalId)
- get: Get todo details by ID
- complete: Quick shortcut to mark a todo as done
- transition: Change todo state (events: START, COMPLETE, BLOCK, UNBLOCK, DEFER, CANCEL, REOPEN)
- delete: Remove a todo by ID`,
  parameters: TodoToolParams,
  execute: executeTodoTool,
}
