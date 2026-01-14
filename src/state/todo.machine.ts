import { createMachine, assign } from "xstate"

export interface TodoContext {
  id: string
  title: string
  description: string
  priority: "low" | "medium" | "high"
  dueDate: string | null
  tags: string[]
  goalId: string | null
  blockedBy: string | null
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
        COMPLETE: {
          target: "done",
          actions: assign({
            completedAt: () => Date.now(),
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
        CANCEL: {
          target: "cancelled",
          actions: assign({ updatedAt: () => Date.now() }),
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
          target: "in_progress",
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
