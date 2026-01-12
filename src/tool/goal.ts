import { z } from "zod";
import { defineTool } from "./types.ts";
import { DadGPTParser, type ParsedGoal } from "../parser/dadgpt-md.ts";
import { generateId } from "../util/id.ts";
import type { GoalState } from "../state/goal.machine.ts";
import { Storage } from "../storage/storage.ts";
import { Bus } from "../bus/bus.ts";

const GoalActionSchema = z.enum([
  "create",
  "list",
  "update",
  "complete",
  "pause",
  "resume",
  "abandon",
  "start",
]);

export const goalTool = defineTool({
  name: "goal",
  description: `Manage goals in dadgpt.md. Actions:
- create: Create a new goal
- list: List all goals (optionally filter by state or category)
- update: Update goal progress or details
- start: Start working on a goal (transition to in_progress)
- complete: Mark a goal as completed
- pause: Pause a goal
- resume: Resume a paused goal
- abandon: Abandon a goal`,

  parameters: z.object({
    action: GoalActionSchema,
    id: z.string().optional().describe("Goal ID (for update/complete/pause/resume/abandon)"),
    title: z.string().optional().describe("Goal title (for create)"),
    category: z.string().optional().describe("Goal category (Health, Family, Work, Personal, Finance)"),
    progress: z.number().min(0).max(100).optional().describe("Progress percentage (0-100)"),
    description: z.string().optional().describe("Goal description"),
    dueDate: z.string().optional().describe("Due date (e.g., '2024-12-31' or 'ongoing')"),
    filter: z.object({
      state: z.string().optional(),
      category: z.string().optional(),
    }).optional().describe("Filter for list action"),
    reason: z.string().optional().describe("Reason for pause/abandon"),
  }),

  async execute(args, _ctx) {
    switch (args.action) {
      case "create":
        return await createGoal(args);
      case "list":
        return await listGoals(args.filter);
      case "update":
        return await updateGoal(args);
      case "start":
        return await transitionGoal(args.id, "in_progress");
      case "complete":
        return await transitionGoal(args.id, "completed");
      case "pause":
        return await transitionGoal(args.id, "paused", args.reason);
      case "resume":
        return await transitionGoal(args.id, "in_progress");
      case "abandon":
        return await transitionGoal(args.id, "abandoned", args.reason);
      default:
        return {
          title: "Error",
          output: `Unknown action: ${args.action}`,
          error: true,
        };
    }
  },
});

async function createGoal(args: {
  title?: string;
  category?: string;
  description?: string;
  dueDate?: string;
  progress?: number;
}) {
  if (!args.title) {
    return {
      title: "Error",
      output: "Goal title is required",
      error: true,
    };
  }

  const goal: ParsedGoal = {
    id: generateId(),
    title: args.title,
    category: args.category ?? "Personal",
    state: "not_started",
    progress: args.progress ?? 0,
    description: args.description,
    dueDate: args.dueDate,
  };

  // Check if dadgpt.md exists
  if (!(await DadGPTParser.exists())) {
    await DadGPTParser.create();
  }

  await DadGPTParser.addGoal(goal);

  // Also store in JSON for state tracking
  await Storage.write(["goals", goal.id], {
    ...goal,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stateHistory: [],
  });

  Bus.publish("goal.created", { goal });

  return {
    title: "Goal Created",
    output: `Created goal "${goal.title}" in category "${goal.category}" (ID: ${goal.id})`,
    metadata: { goal },
  };
}

async function listGoals(filter?: { state?: string; category?: string }) {
  if (!(await DadGPTParser.exists())) {
    return {
      title: "No Goals",
      output: "No dadgpt.md file found. Run 'dadgpt init' to create one.",
    };
  }

  const data = await DadGPTParser.parse();
  let allGoals: ParsedGoal[] = [];

  for (const [category, goals] of Object.entries(data.goals)) {
    for (const goal of goals) {
      goal.category = category;
      allGoals.push(goal);
    }
  }

  // Apply filters
  if (filter?.state) {
    allGoals = allGoals.filter((g) => g.state === filter.state);
  }
  if (filter?.category) {
    allGoals = allGoals.filter(
      (g) => g.category.toLowerCase() === filter.category?.toLowerCase()
    );
  }

  if (allGoals.length === 0) {
    return {
      title: "Goals",
      output: "No goals found" + (filter ? " matching the filter" : ""),
    };
  }

  const output = allGoals
    .map((g) => {
      const status = g.state === "completed" ? "✓" : g.state === "in_progress" ? "→" : "○";
      let line = `${status} [${g.category}] ${g.title}`;
      if (g.progress > 0 && g.progress < 100) {
        line += ` (${g.progress}%)`;
      }
      if (g.state !== "not_started" && g.state !== "completed") {
        line += ` [${g.state}]`;
      }
      return line;
    })
    .join("\n");

  return {
    title: `Goals (${allGoals.length})`,
    output,
    metadata: { goals: allGoals },
  };
}

async function updateGoal(args: {
  id?: string;
  title?: string;
  progress?: number;
  description?: string;
  dueDate?: string;
}) {
  if (!args.id) {
    // Try to find by title
    if (args.title) {
      const data = await DadGPTParser.parse();
      for (const goals of Object.values(data.goals)) {
        const found = goals.find(
          (g) => g.title.toLowerCase().includes(args.title!.toLowerCase())
        );
        if (found) {
          args.id = found.id;
          break;
        }
      }
    }
    if (!args.id) {
      return {
        title: "Error",
        output: "Goal ID or title is required to update",
        error: true,
      };
    }
  }

  const updates: Partial<ParsedGoal> = {};
  if (args.progress !== undefined) updates.progress = args.progress;
  if (args.description !== undefined) updates.description = args.description;
  if (args.dueDate !== undefined) updates.dueDate = args.dueDate;

  // If progress is being set to a non-zero value and state is not_started, transition to in_progress
  if (args.progress && args.progress > 0) {
    const stored = await Storage.read<ParsedGoal & { state: GoalState }>(["goals", args.id]);
    if (stored && stored.state === "not_started") {
      updates.state = "in_progress";
    }
  }

  const updated = await DadGPTParser.updateGoal(args.id, updates);

  if (!updated) {
    return {
      title: "Error",
      output: `Goal with ID ${args.id} not found`,
      error: true,
    };
  }

  // Update storage
  await Storage.update(["goals", args.id], (prev: unknown) => ({
    ...(prev as object),
    ...updates,
    updatedAt: new Date().toISOString(),
  }));

  return {
    title: "Goal Updated",
    output: `Updated goal ${args.id}` +
      (args.progress !== undefined ? ` - Progress: ${args.progress}%` : ""),
    metadata: { id: args.id, updates },
  };
}

async function transitionGoal(
  id: string | undefined,
  targetState: GoalState,
  reason?: string
) {
  if (!id) {
    return {
      title: "Error",
      output: "Goal ID is required",
      error: true,
    };
  }

  const updates: Partial<ParsedGoal> = { state: targetState };
  if (targetState === "completed") {
    updates.progress = 100;
  }

  const updated = await DadGPTParser.updateGoal(id, updates);

  if (!updated) {
    return {
      title: "Error",
      output: `Goal with ID ${id} not found`,
      error: true,
    };
  }

  // Update storage with state history
  await Storage.update(["goals", id], (prev: unknown) => {
    const prevGoal = prev as { state?: GoalState; stateHistory?: Array<{ from: GoalState; to: GoalState; at: string; reason?: string }> } | undefined;
    return {
      ...prevGoal,
      state: targetState,
      progress: targetState === "completed" ? 100 : prevGoal?.state,
      updatedAt: new Date().toISOString(),
      stateHistory: [
        ...(prevGoal?.stateHistory ?? []),
        {
          from: prevGoal?.state ?? "not_started",
          to: targetState,
          at: new Date().toISOString(),
          reason,
        },
      ],
    };
  });

  const actionWord = {
    in_progress: "started",
    completed: "completed",
    paused: "paused",
    abandoned: "abandoned",
    not_started: "reset",
  }[targetState];

  if (targetState === "completed") {
    Bus.publish("goal.completed", { id });
  }

  return {
    title: `Goal ${actionWord.charAt(0).toUpperCase() + actionWord.slice(1)}`,
    output: `Goal ${id} has been ${actionWord}` + (reason ? ` (${reason})` : ""),
    metadata: { id, state: targetState },
  };
}
