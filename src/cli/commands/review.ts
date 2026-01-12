import type { Arguments, CommandBuilder } from "yargs";
import { UI } from "../ui.ts";
import { Intelligence } from "../../intelligence/suggestions.ts";

interface ReviewArgs {
  type: string;
  debug?: boolean;
}

export const command = "review [type]";
export const desc = "Get insights and suggestions";

export const builder: CommandBuilder<unknown, ReviewArgs> = (yargs) =>
  yargs
    .positional("type", {
      type: "string",
      default: "suggestions",
      choices: ["suggestions", "weekly", "daily"],
      describe: "Type of review to generate",
    })
    .example("$0 review", "Get context-aware suggestions")
    .example("$0 review weekly", "Generate weekly review")
    .example("$0 review daily", "Get daily planning suggestions");

export async function handler(argv: Arguments<ReviewArgs>): Promise<void> {
  const reviewType = argv.type ?? "suggestions";

  UI.header(`Review - ${reviewType.charAt(0).toUpperCase() + reviewType.slice(1)}`);

  try {
    if (reviewType === "weekly") {
      const review = await Intelligence.generateWeeklyReview();

      console.log("\nCompleted:");
      console.log(`  Goals: ${review.completed.goals}`);
      console.log(`  Todos: ${review.completed.todos}`);

      console.log("\nIn Progress:");
      console.log(`  Goals: ${review.inProgress.goals}`);
      console.log(`  Todos: ${review.inProgress.todos}`);

      console.log("\nRecommendations:");
      for (const suggestion of review.suggestions) {
        console.log(`  - ${suggestion}`);
      }
    } else {
      const suggestions = await Intelligence.generateSuggestions();

      if (suggestions.length === 0) {
        UI.success("Everything looks good! No immediate suggestions.");
        return;
      }

      // For daily, filter to high priority and action items
      const filtered =
        reviewType === "daily"
          ? suggestions.filter((s) => s.priority === "high" || s.type === "action")
          : suggestions;

      if (filtered.length === 0) {
        UI.info("No urgent items. Check your todo list for today's tasks.");
        return;
      }

      const typeEmoji: Record<string, string> = {
        reminder: "!",
        action: ">",
        insight: "*",
        warning: "!",
      };

      const priorityColor: Record<string, (s: string) => string> = {
        high: (s) => `\x1b[31m${s}\x1b[0m`, // red
        medium: (s) => `\x1b[33m${s}\x1b[0m`, // yellow
        low: (s) => `\x1b[90m${s}\x1b[0m`, // gray
      };

      console.log("");
      for (const s of filtered) {
        const marker = typeEmoji[s.type] ?? "-";
        const colorFn = priorityColor[s.priority] ?? ((x: string) => x);
        console.log(colorFn(`[${marker}] ${s.title}`));
        console.log(`    ${s.message}`);
        console.log("");
      }

      UI.info(`${filtered.length} suggestion${filtered.length !== 1 ? "s" : ""}`);
    }
  } catch (error) {
    UI.error(error instanceof Error ? error.message : "Failed to generate review");
    process.exit(1);
  }
}
