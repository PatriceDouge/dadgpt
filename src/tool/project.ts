import { z } from "zod"
import { createActor } from "xstate"
import type { Tool, ToolContext, ToolResult } from "./types"
import { Storage } from "../storage/storage"
import { Bus } from "../bus/bus"
import { createTimestampedId } from "../util/id"
import {
  projectMachine,
  createProjectContext,
  type ProjectContext,
  type ProjectState,
  type ProjectEvent,
} from "../state/project.machine"

/**
 * Storage key prefix for projects
 */
const PROJECTS_PREFIX = ["projects"]

/**
 * Stored project includes state machine state
 */
interface StoredProject extends ProjectContext {
  state: ProjectState
}

/**
 * Parameters schema for the project tool
 */
const ProjectToolParams = z.object({
  action: z.enum(["list", "create", "get", "update", "transition", "addMilestone", "delete"]),
  // For create
  name: z.string().optional(),
  description: z.string().optional(),
  budget: z.number().optional(),
  goalId: z.string().optional(),
  // For get, update, transition, addMilestone, delete
  id: z.string().optional(),
  // For addMilestone
  milestoneTitle: z.string().optional(),
  milestoneDueDate: z.string().optional(),
  // For transition
  event: z
    .enum(["START", "PAUSE", "RESUME", "COMPLETE", "CANCEL", "COMPLETE_MILESTONE"])
    .optional(),
  milestoneId: z.string().optional(),
  // For list filters
  statusFilter: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]).optional(),
})

type ProjectToolArgs = z.infer<typeof ProjectToolParams>

/**
 * Load a project from storage
 */
async function loadProject(id: string): Promise<StoredProject | undefined> {
  return Storage.read<StoredProject>([...PROJECTS_PREFIX, id])
}

/**
 * Save a project to storage
 */
async function saveProject(project: StoredProject): Promise<void> {
  await Storage.write([...PROJECTS_PREFIX, project.id], project)
}

/**
 * List all projects from storage
 */
async function listProjects(): Promise<StoredProject[]> {
  const projectIds = await Storage.list(PROJECTS_PREFIX)
  const projects = await Promise.all(
    projectIds.map((id) => loadProject(id))
  )
  return projects.filter((p): p is StoredProject => p !== undefined)
}

/**
 * Execute the project tool actions
 */
async function executeProjectTool(
  args: ProjectToolArgs,
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
    case "addMilestone":
      return handleAddMilestone(args)
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
async function handleList(args: ProjectToolArgs): Promise<ToolResult> {
  let projects = await listProjects()

  // Apply status filter
  if (args.statusFilter) {
    projects = projects.filter((p) => p.state === args.statusFilter)
  }

  // Sort by createdAt descending (newest first)
  projects.sort((a, b) => b.createdAt - a.createdAt)

  if (projects.length === 0) {
    return {
      title: "Projects",
      output: "No projects found.",
      metadata: { count: 0 },
    }
  }

  const output = projects
    .map(
      (p) =>
        `- [${p.state}] ${p.name}${p.budget !== null ? ` | Budget: $${p.budget}` : ""}${p.milestones.length > 0 ? ` | ${p.milestones.filter((m) => m.completed).length}/${p.milestones.length} milestones` : ""}`
    )
    .join("\n")

  return {
    title: "Projects",
    output,
    metadata: { count: projects.length },
  }
}

/**
 * Handle create action
 */
async function handleCreate(args: ProjectToolArgs): Promise<ToolResult> {
  if (!args.name) {
    return {
      title: "Error",
      output: "Name is required to create a project.",
    }
  }

  const id = createTimestampedId("project")
  const now = Date.now()

  const context = createProjectContext({
    id,
    name: args.name,
    description: args.description ?? "",
    budget: args.budget ?? null,
    goalId: args.goalId ?? null,
    createdAt: now,
    updatedAt: now,
  })

  const project: StoredProject = {
    ...context,
    state: "planning",
  }

  await saveProject(project)
  Bus.publish("project.created", { projectId: id })

  return {
    title: "Project Created",
    output: `Created project: "${args.name}" (ID: ${id})`,
    metadata: { projectId: id },
  }
}

/**
 * Handle get action
 */
async function handleGet(args: ProjectToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to get a project.",
    }
  }

  const project = await loadProject(args.id)
  if (!project) {
    return {
      title: "Error",
      output: `Project not found: ${args.id}`,
    }
  }

  const milestonesOutput =
    project.milestones.length > 0
      ? `\nMilestones:\n${project.milestones.map((m) => `  - [${m.completed ? "x" : " "}] ${m.title}${m.dueDate ? ` (Due: ${m.dueDate})` : ""}`).join("\n")}`
      : ""

  const output = `
Name: ${project.name}
Status: ${project.state}
Description: ${project.description || "(none)"}
Budget: ${project.budget !== null ? `$${project.budget}` : "(none)"}
Goal ID: ${project.goalId || "(none)"}
Todos: ${project.todoIds.length > 0 ? project.todoIds.join(", ") : "(none)"}${milestonesOutput}
Created: ${new Date(project.createdAt).toLocaleString()}
Updated: ${new Date(project.updatedAt).toLocaleString()}
`.trim()

  return {
    title: `Project: ${project.name}`,
    output,
    metadata: { project },
  }
}

/**
 * Handle update action
 */
async function handleUpdate(args: ProjectToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to update a project.",
    }
  }

  const project = await loadProject(args.id)
  if (!project) {
    return {
      title: "Error",
      output: `Project not found: ${args.id}`,
    }
  }

  const changes: Record<string, unknown> = {}

  if (args.name !== undefined) {
    project.name = args.name
    changes.name = args.name
  }

  if (args.description !== undefined) {
    project.description = args.description
    changes.description = args.description
  }

  if (args.budget !== undefined) {
    project.budget = args.budget
    changes.budget = args.budget
  }

  if (args.goalId !== undefined) {
    project.goalId = args.goalId
    changes.goalId = args.goalId
  }

  if (Object.keys(changes).length === 0) {
    return {
      title: "No Changes",
      output: "No fields were specified to update.",
    }
  }

  project.updatedAt = Date.now()
  await saveProject(project)
  Bus.publish("project.updated", { projectId: args.id, changes })

  return {
    title: "Project Updated",
    output: `Updated project "${project.name}": ${Object.keys(changes).join(", ")}`,
    metadata: { projectId: args.id, changes },
  }
}

/**
 * Handle transition action
 */
async function handleTransition(args: ProjectToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to transition a project.",
    }
  }

  if (!args.event) {
    return {
      title: "Error",
      output: "Event is required to transition a project. Valid events: START, PAUSE, RESUME, COMPLETE, CANCEL, COMPLETE_MILESTONE",
    }
  }

  const project = await loadProject(args.id)
  if (!project) {
    return {
      title: "Error",
      output: `Project not found: ${args.id}`,
    }
  }

  // Check if project is in a final state
  if (project.state === "completed" || project.state === "cancelled") {
    return {
      title: "Error",
      output: `Cannot transition project in final state: ${project.state}`,
    }
  }

  // Create actor with current state
  const actor = createActor(projectMachine, {
    snapshot: projectMachine.resolveState({
      value: project.state,
      context: project,
    }),
  })
  actor.start()

  // Build the event
  let event: ProjectEvent
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
    event = { type: args.event } as ProjectEvent
  }

  // Send the event
  actor.send(event)

  // Get the new state
  const snapshot = actor.getSnapshot()
  const newState = snapshot.value as ProjectState
  const newContext = snapshot.context

  actor.stop()

  // Check if state actually changed (for non-COMPLETE_MILESTONE events)
  if (args.event !== "COMPLETE_MILESTONE" && newState === project.state) {
    return {
      title: "No Change",
      output: `Event ${args.event} is not valid from state ${project.state}.`,
      metadata: { projectId: args.id, currentState: project.state },
    }
  }

  // Update stored project
  const updatedProject: StoredProject = {
    ...newContext,
    state: newState,
  }
  await saveProject(updatedProject)

  // Publish events
  if (newState === "completed") {
    Bus.publish("project.completed", { projectId: args.id })
  }

  return {
    title: "Project Transitioned",
    output: `Project "${project.name}" transitioned from ${project.state} to ${newState}`,
    metadata: { projectId: args.id, previousState: project.state, newState },
  }
}

/**
 * Handle addMilestone action
 */
async function handleAddMilestone(args: ProjectToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to add a milestone.",
    }
  }

  if (!args.milestoneTitle) {
    return {
      title: "Error",
      output: "milestoneTitle is required to add a milestone.",
    }
  }

  const project = await loadProject(args.id)
  if (!project) {
    return {
      title: "Error",
      output: `Project not found: ${args.id}`,
    }
  }

  // Check if project is in a final state
  if (project.state === "completed" || project.state === "cancelled") {
    return {
      title: "Error",
      output: `Cannot add milestone to project in final state: ${project.state}`,
    }
  }

  // Create actor with current state
  const actor = createActor(projectMachine, {
    snapshot: projectMachine.resolveState({
      value: project.state,
      context: project,
    }),
  })
  actor.start()

  // Generate milestone ID
  const milestoneId = createTimestampedId("milestone")

  // Send ADD_MILESTONE event
  actor.send({
    type: "ADD_MILESTONE",
    milestone: {
      id: milestoneId,
      title: args.milestoneTitle,
      dueDate: args.milestoneDueDate ?? null,
    },
  })

  // Get the new state
  const snapshot = actor.getSnapshot()
  const newContext = snapshot.context
  const newState = snapshot.value as ProjectState

  actor.stop()

  // Update stored project
  const updatedProject: StoredProject = {
    ...newContext,
    state: newState,
  }
  await saveProject(updatedProject)

  return {
    title: "Milestone Added",
    output: `Added milestone "${args.milestoneTitle}" to project "${project.name}"`,
    metadata: { projectId: args.id, milestoneId },
  }
}

/**
 * Handle delete action
 */
async function handleDelete(args: ProjectToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to delete a project.",
    }
  }

  const project = await loadProject(args.id)
  if (!project) {
    return {
      title: "Error",
      output: `Project not found: ${args.id}`,
    }
  }

  const deleted = await Storage.remove([...PROJECTS_PREFIX, args.id])
  if (!deleted) {
    return {
      title: "Error",
      output: `Failed to delete project: ${args.id}`,
    }
  }

  Bus.publish("project.deleted", { projectId: args.id })

  return {
    title: "Project Deleted",
    output: `Deleted project: "${project.name}" (ID: ${args.id})`,
    metadata: { projectId: args.id },
  }
}

/**
 * Project Tool - Manages projects with CRUD operations and state transitions
 */
export const ProjectTool: Tool<typeof ProjectToolParams> = {
  id: "project",
  description: `Manage projects with full lifecycle support. Actions:
- list: List all projects (optional filter: statusFilter)
- create: Create a new project (required: name; optional: description, budget, goalId)
- get: Get project details by ID
- update: Update project fields (name, description, budget, goalId)
- transition: Change project state (events: START, PAUSE, RESUME, COMPLETE, CANCEL, COMPLETE_MILESTONE)
- addMilestone: Add a milestone to a project (required: milestoneTitle; optional: milestoneDueDate)
- delete: Remove a project by ID`,
  parameters: ProjectToolParams,
  execute: executeProjectTool,
}
