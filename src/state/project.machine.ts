import { createMachine, assign } from "xstate"

export interface ProjectContext {
  id: string
  name: string
  description: string
  status: string
  budget: number | null
  milestones: Array<{
    id: string
    title: string
    completed: boolean
    dueDate: string | null
  }>
  todoIds: string[]
  goalId: string | null
  createdAt: number
  updatedAt: number
}

export type ProjectEvent =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "COMPLETE" }
  | { type: "CANCEL" }
  | { type: "ADD_MILESTONE"; milestone: { id: string; title: string; dueDate: string | null } }
  | { type: "COMPLETE_MILESTONE"; milestoneId: string }

export type ProjectState =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled"

export const projectMachine = createMachine({
  id: "project",
  initial: "planning",
  types: {} as {
    context: ProjectContext
    events: ProjectEvent
  },
  context: {
    id: "",
    name: "",
    description: "",
    status: "planning",
    budget: null,
    milestones: [],
    todoIds: [],
    goalId: null,
    createdAt: 0,
    updatedAt: 0,
  },
  states: {
    planning: {
      on: {
        START: {
          target: "active",
          actions: assign({
            status: "active",
            updatedAt: () => Date.now(),
          }),
        },
        ADD_MILESTONE: {
          actions: assign({
            milestones: ({ context, event }) => [
              ...context.milestones,
              { ...event.milestone, completed: false },
            ],
            updatedAt: () => Date.now(),
          }),
        },
        CANCEL: {
          target: "cancelled",
          actions: assign({
            status: "cancelled",
            updatedAt: () => Date.now(),
          }),
        },
      },
    },
    active: {
      on: {
        PAUSE: {
          target: "on_hold",
          actions: assign({
            status: "on_hold",
            updatedAt: () => Date.now(),
          }),
        },
        COMPLETE: {
          target: "completed",
          actions: assign({
            status: "completed",
            updatedAt: () => Date.now(),
          }),
        },
        ADD_MILESTONE: {
          actions: assign({
            milestones: ({ context, event }) => [
              ...context.milestones,
              { ...event.milestone, completed: false },
            ],
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
        CANCEL: {
          target: "cancelled",
          actions: assign({
            status: "cancelled",
            updatedAt: () => Date.now(),
          }),
        },
      },
    },
    on_hold: {
      on: {
        RESUME: {
          target: "active",
          actions: assign({
            status: "active",
            updatedAt: () => Date.now(),
          }),
        },
        CANCEL: {
          target: "cancelled",
          actions: assign({
            status: "cancelled",
            updatedAt: () => Date.now(),
          }),
        },
      },
    },
    completed: {
      type: "final",
    },
    cancelled: {
      type: "final",
    },
  },
})

export function createProjectContext(
  partial: Partial<ProjectContext>
): ProjectContext {
  return {
    id: partial.id ?? "",
    name: partial.name ?? "",
    description: partial.description ?? "",
    status: partial.status ?? "planning",
    budget: partial.budget ?? null,
    milestones: partial.milestones ?? [],
    todoIds: partial.todoIds ?? [],
    goalId: partial.goalId ?? null,
    createdAt: partial.createdAt ?? Date.now(),
    updatedAt: partial.updatedAt ?? Date.now(),
  }
}
