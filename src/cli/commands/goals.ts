import type { CommandModule } from "yargs";
import { UI } from "../ui.ts";
import { DadGPTParser } from "../../parser/dadgpt-md.ts";
import type { GoalState } from "../../state/goal.machine.ts";

interface GoalsArgs {
  state?: string;
  category?: string;
  add?: string;
}

export const goalsCommand: CommandModule<object, GoalsArgs> = {
  command: "goals",
  describe: "List and manage goals",
  builder: (yargs) =>
    yargs
      .option("state", {
        type: "string",
        alias: "s",
        choices: ["not_started", "in_progress", "paused", "completed", "abandoned"],
        describe: "Filter by state",
      })
      .option("category", {
        type: "string",
        alias: "c",
        describe: "Filter by category",
      })
      .option("add", {
        type: "string",
        alias: "a",
        describe: "Add a new goal",
      }),

  handler: async (args) => {
    if (!(await DadGPTParser.exists())) {
      UI.error("No dadgpt.md found. Run 'dadgpt init' first.");
      return;
    }

    if (args.add) {
      await addGoal(args.add, args.category);
      return;
    }

    await listGoals(args.state as GoalState | undefined, args.category);
  },
};

async function listGoals(state?: GoalState, category?: string): Promise<void> {
  const data = await DadGPTParser.parse();

  UI.header("Goals");

  let totalGoals = 0;
  let displayedGoals = 0;

  for (const [cat, goals] of Object.entries(data.goals)) {
    // Filter by category
    if (category && cat.toLowerCase() !== category.toLowerCase()) {
      continue;
    }

    // Filter by state
    let filteredGoals = goals;
    if (state) {
      filteredGoals = goals.filter((g) => g.state === state);
    }

    totalGoals += goals.length;
    displayedGoals += filteredGoals.length;

    if (filteredGoals.length === 0) continue;

    UI.println(`\n  ${cat}:`);
    for (const goal of filteredGoals) {
      const statusIcon = getStatusIcon(goal.state);
      let line = `    ${statusIcon} ${goal.title}`;

      if (goal.progress > 0 && goal.progress < 100) {
        line += ` (${goal.progress}%)`;
      }

      if (goal.state !== "not_started" && goal.state !== "completed") {
        line += ` [${goal.state.replace("_", " ")}]`;
      }

      if (goal.dueDate) {
        line += ` - Due: ${goal.dueDate}`;
      }

      UI.println(line);
    }
  }

  UI.println();

  if (displayedGoals === 0) {
    if (state || category) {
      UI.dim("No goals matching the filter.");
    } else {
      UI.dim("No goals found. Add some with 'dadgpt goals --add \"Your goal\"'");
    }
  } else {
    UI.dim(`Showing ${displayedGoals} of ${totalGoals} goals`);
  }

  UI.println();

  // Summary stats
  const allGoals = Object.values(data.goals).flat();
  const stats = {
    not_started: allGoals.filter((g) => g.state === "not_started").length,
    in_progress: allGoals.filter((g) => g.state === "in_progress").length,
    completed: allGoals.filter((g) => g.state === "completed").length,
    paused: allGoals.filter((g) => g.state === "paused").length,
  };

  if (allGoals.length > 0) {
    UI.dim(
      `Summary: ${stats.completed} completed, ${stats.in_progress} in progress, ${stats.not_started} not started`
    );
  }
}

async function addGoal(title: string, category?: string): Promise<void> {
  const goalCategory = category ?? "Personal";

  await DadGPTParser.addGoal({
    id: Date.now().toString(),
    title,
    category: goalCategory,
    state: "not_started",
    progress: 0,
  });

  UI.success(`Added goal: "${title}" to ${goalCategory}`);
}

function getStatusIcon(state: GoalState): string {
  switch (state) {
    case "completed":
      return "✓";
    case "in_progress":
      return "→";
    case "paused":
      return "⏸";
    case "abandoned":
      return "✗";
    default:
      return "○";
  }
}
