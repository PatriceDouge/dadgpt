import { createMachine, assign } from "xstate";

export type GoalState =
  | "not_started"
  | "in_progress"
  | "paused"
  | "completed"
  | "abandoned";

export interface GoalContext {
  id: string;
  title: string;
  category: string;
  description?: string;
  progress: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  stateHistory: Array<{
    from: GoalState;
    to: GoalState;
    at: string;
    reason?: string;
  }>;
}

export type GoalEvent =
  | { type: "START" }
  | { type: "UPDATE_PROGRESS"; progress: number }
  | { type: "PAUSE"; reason?: string }
  | { type: "RESUME" }
  | { type: "COMPLETE" }
  | { type: "ABANDON"; reason?: string };

function recordTransition(
  context: GoalContext,
  from: GoalState,
  to: GoalState,
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

export const goalMachine = createMachine({
  id: "goal",
  initial: "not_started",
  types: {} as {
    context: GoalContext;
    events: GoalEvent;
  },
  context: {
    id: "",
    title: "",
    category: "Personal",
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stateHistory: [],
  },
  states: {
    not_started: {
      on: {
        START: {
          target: "in_progress",
          actions: assign(({ context }) =>
            recordTransition(context, "not_started", "in_progress")
          ),
        },
        ABANDON: {
          target: "abandoned",
          actions: assign(({ context, event }) =>
            recordTransition(context, "not_started", "abandoned", event.reason)
          ),
        },
      },
    },
    in_progress: {
      on: {
        UPDATE_PROGRESS: {
          actions: assign(({ context, event }) => ({
            ...context,
            progress: Math.min(100, Math.max(0, event.progress)),
            updatedAt: new Date().toISOString(),
          })),
        },
        PAUSE: {
          target: "paused",
          actions: assign(({ context, event }) =>
            recordTransition(context, "in_progress", "paused", event.reason)
          ),
        },
        COMPLETE: {
          target: "completed",
          actions: assign(({ context }) => ({
            ...recordTransition(context, "in_progress", "completed"),
            progress: 100,
          })),
        },
        ABANDON: {
          target: "abandoned",
          actions: assign(({ context, event }) =>
            recordTransition(context, "in_progress", "abandoned", event.reason)
          ),
        },
      },
    },
    paused: {
      on: {
        RESUME: {
          target: "in_progress",
          actions: assign(({ context }) =>
            recordTransition(context, "paused", "in_progress")
          ),
        },
        ABANDON: {
          target: "abandoned",
          actions: assign(({ context, event }) =>
            recordTransition(context, "paused", "abandoned", event.reason)
          ),
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
});

export function createGoalContext(
  id: string,
  title: string,
  category: string,
  options?: {
    description?: string;
    dueDate?: string;
    progress?: number;
  }
): GoalContext {
  const now = new Date().toISOString();
  return {
    id,
    title,
    category,
    description: options?.description,
    progress: options?.progress ?? 0,
    dueDate: options?.dueDate,
    createdAt: now,
    updatedAt: now,
    stateHistory: [],
  };
}
