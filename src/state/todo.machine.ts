import { createMachine, assign } from "xstate";

export type TodoState =
  | "pending"
  | "in_progress"
  | "blocked"
  | "deferred"
  | "done"
  | "cancelled";

export type TodoTimeframe = "today" | "this_week" | "someday";
export type TodoPriority = "high" | "medium" | "low";

export interface TodoContext {
  id: string;
  title: string;
  timeframe: TodoTimeframe;
  priority?: TodoPriority;
  dueDate?: string;
  goalId?: string;
  projectId?: string;
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  stateHistory: Array<{
    from: TodoState;
    to: TodoState;
    at: string;
    reason?: string;
  }>;
}

export type TodoEvent =
  | { type: "START" }
  | { type: "COMPLETE" }
  | { type: "BLOCK"; reason: string }
  | { type: "UNBLOCK" }
  | { type: "DEFER"; timeframe?: TodoTimeframe }
  | { type: "ACTIVATE" }
  | { type: "CANCEL"; reason?: string };

function recordTransition(
  context: TodoContext,
  from: TodoState,
  to: TodoState,
  reason?: string
) {
  return {
    ...context,
    updatedAt: new Date().toISOString(),
    stateHistory: [
      ...context.stateHistory,
      {
        from,
        to,
        at: new Date().toISOString(),
        reason,
      },
    ],
  };
}

export const todoMachine = createMachine({
  id: "todo",
  initial: "pending",
  types: {} as {
    context: TodoContext;
    events: TodoEvent;
  },
  context: {
    id: "",
    title: "",
    timeframe: "today" as TodoTimeframe,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stateHistory: [],
  },
  states: {
    pending: {
      on: {
        START: {
          target: "in_progress",
          actions: assign(({ context }) =>
            recordTransition(context, "pending", "in_progress")
          ),
        },
        DEFER: {
          target: "deferred",
          actions: assign(({ context, event }) => ({
            ...recordTransition(context, "pending", "deferred"),
            timeframe: event.timeframe ?? context.timeframe,
          })),
        },
        CANCEL: {
          target: "cancelled",
          actions: assign(({ context, event }) =>
            recordTransition(context, "pending", "cancelled", event.reason)
          ),
        },
        COMPLETE: {
          target: "done",
          actions: assign(({ context }) => ({
            ...recordTransition(context, "pending", "done"),
            completedAt: new Date().toISOString(),
          })),
        },
      },
    },
    in_progress: {
      on: {
        COMPLETE: {
          target: "done",
          actions: assign(({ context }) => ({
            ...recordTransition(context, "in_progress", "done"),
            completedAt: new Date().toISOString(),
          })),
        },
        BLOCK: {
          target: "blocked",
          actions: assign(({ context, event }) => ({
            ...recordTransition(context, "in_progress", "blocked", event.reason),
            blockedReason: event.reason,
          })),
        },
        DEFER: {
          target: "deferred",
          actions: assign(({ context, event }) => ({
            ...recordTransition(context, "in_progress", "deferred"),
            timeframe: event.timeframe ?? context.timeframe,
          })),
        },
        CANCEL: {
          target: "cancelled",
          actions: assign(({ context, event }) =>
            recordTransition(context, "in_progress", "cancelled", event.reason)
          ),
        },
      },
    },
    blocked: {
      on: {
        UNBLOCK: {
          target: "in_progress",
          actions: assign(({ context }) => ({
            ...recordTransition(context, "blocked", "in_progress"),
            blockedReason: undefined,
          })),
        },
        CANCEL: {
          target: "cancelled",
          actions: assign(({ context, event }) =>
            recordTransition(context, "blocked", "cancelled", event.reason)
          ),
        },
      },
    },
    deferred: {
      on: {
        ACTIVATE: {
          target: "pending",
          actions: assign(({ context }) =>
            recordTransition(context, "deferred", "pending")
          ),
        },
        CANCEL: {
          target: "cancelled",
          actions: assign(({ context, event }) =>
            recordTransition(context, "deferred", "cancelled", event.reason)
          ),
        },
      },
    },
    done: {
      type: "final",
    },
    cancelled: {
      type: "final",
    },
  },
});

export function createTodoContext(
  id: string,
  title: string,
  options?: {
    timeframe?: TodoTimeframe;
    priority?: TodoPriority;
    dueDate?: string;
    goalId?: string;
    projectId?: string;
  }
): TodoContext {
  const now = new Date().toISOString();
  return {
    id,
    title,
    timeframe: options?.timeframe ?? "today",
    priority: options?.priority,
    dueDate: options?.dueDate,
    goalId: options?.goalId,
    projectId: options?.projectId,
    createdAt: now,
    updatedAt: now,
    stateHistory: [],
  };
}
