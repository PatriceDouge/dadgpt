import { z } from "zod";
import { defineTool } from "./types.ts";
import { Intelligence } from "../intelligence/suggestions.ts";

export const reviewTool = defineTool({
  name: "review",
  description: `Generate insights and suggestions. Actions:
- suggestions: Get context-aware suggestions based on current state
- weekly: Generate a weekly review summary
- daily: Generate daily planning suggestions`,

  parameters: z.object({
    action: z.enum(["suggestions", "weekly", "daily"]),
  }),

  async execute(args, _ctx) {
    switch (args.action) {
      case "suggestions":
        return await getSuggestions();
      case "weekly":
        return await getWeeklyReview();
      case "daily":
        return await getDailyPlan();
      default:
        return {
          title: "Error",
          output: `Unknown action: ${args.action}`,
          error: true,
        };
    }
  },
});

async function getSuggestions() {
  const suggestions = await Intelligence.generateSuggestions();

  if (suggestions.length === 0) {
    return {
      title: "No Suggestions",
      output: "Everything looks good! No immediate suggestions.",
    };
  }

  const typeEmoji = {
    reminder: "🔔",
    action: "⚡",
    insight: "💡",
    warning: "⚠️",
  };

  const output = suggestions
    .map((s) => {
      const emoji = typeEmoji[s.type];
      return `${emoji} [${s.priority.toUpperCase()}] ${s.title}\n   ${s.message}`;
    })
    .join("\n\n");

  return {
    title: `Suggestions (${suggestions.length})`,
    output,
    metadata: { suggestions },
  };
}

async function getWeeklyReview() {
  const review = await Intelligence.generateWeeklyReview();

  const output = `Weekly Review Summary
────────────────────

Completed:
  • Goals: ${review.completed.goals}
  • Todos: ${review.completed.todos}

In Progress:
  • Goals: ${review.inProgress.goals}
  • Todos: ${review.inProgress.todos}

Recommendations:
${review.suggestions.map((s) => `  • ${s}`).join("\n")}`;

  return {
    title: "Weekly Review",
    output,
    metadata: review,
  };
}

async function getDailyPlan() {
  const suggestions = await Intelligence.generateSuggestions();

  // Filter for high-priority and action items
  const todayFocus = suggestions.filter(
    (s) => s.priority === "high" || s.type === "action"
  );

  if (todayFocus.length === 0) {
    return {
      title: "Daily Plan",
      output: "No urgent items. Check your todo list for today's tasks.",
    };
  }

  const output = `Today's Focus
─────────────

${todayFocus
    .map((s) => {
      const prefix = s.type === "reminder" ? "📌" : s.type === "warning" ? "⚠️" : "→";
      return `${prefix} ${s.title}: ${s.message}`;
    })
    .join("\n\n")}`;

  return {
    title: "Daily Plan",
    output,
    metadata: { focus: todayFocus },
  };
}
