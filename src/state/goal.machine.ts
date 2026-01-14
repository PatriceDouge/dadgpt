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
