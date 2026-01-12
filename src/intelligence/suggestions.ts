import { DadGPTParser, type ParsedGoal, type ParsedTodo } from "../parser/dadgpt-md.ts";
import type { TodoTimeframe } from "../state/todo.machine.ts";

export interface Suggestion {
  type: "reminder" | "action" | "insight" | "warning";
  priority: "high" | "medium" | "low";
  title: string;
  message: string;
  actionable?: {
    tool: string;
    action: string;
    args?: Record<string, unknown>;
  };
}

export namespace Intelligence {
  // Generate context-aware suggestions based on current state
  export async function generateSuggestions(): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    if (!(await DadGPTParser.exists())) {
      return suggestions;
    }

    const data = await DadGPTParser.parse();

    // Check for birthdays
    suggestions.push(...checkUpcomingBirthdays(data.family.members));

    // Check for important dates
    suggestions.push(...checkUpcomingDates(data.family.importantDates));

    // Check for stale in-progress items
    suggestions.push(...checkStaleProgress(data.todos));

    // Check for goals without recent activity
    suggestions.push(...checkGoalProgress(data.goals));

    // Check for overdue todos
    suggestions.push(...checkOverdueTodos(data.todos));

    // Check for empty today list
    suggestions.push(...checkEmptyToday(data.todos));

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  function checkUpcomingBirthdays(members: { name: string; birthday?: string }[]): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const today = new Date();

    for (const member of members) {
      if (!member.birthday) continue;

      const daysUntil = getDaysUntilDate(member.birthday);
      if (daysUntil === null) continue;

      if (daysUntil === 0) {
        suggestions.push({
          type: "reminder",
          priority: "high",
          title: "Birthday Today!",
          message: `Today is ${member.name}'s birthday! Don't forget to wish them well.`,
        });
      } else if (daysUntil === 1) {
        suggestions.push({
          type: "reminder",
          priority: "high",
          title: "Birthday Tomorrow",
          message: `${member.name}'s birthday is tomorrow! Time to prepare.`,
        });
      } else if (daysUntil <= 7) {
        suggestions.push({
          type: "reminder",
          priority: "medium",
          title: "Upcoming Birthday",
          message: `${member.name}'s birthday is in ${daysUntil} days (${member.birthday}).`,
        });
      }
    }

    return suggestions;
  }

  function checkUpcomingDates(dates: { title: string; date: string }[]): Suggestion[] {
    const suggestions: Suggestion[] = [];

    for (const date of dates) {
      const daysUntil = getDaysUntilDate(date.date);
      if (daysUntil === null) continue;

      if (daysUntil === 0) {
        suggestions.push({
          type: "reminder",
          priority: "high",
          title: "Event Today",
          message: `"${date.title}" is happening today!`,
        });
      } else if (daysUntil <= 3) {
        suggestions.push({
          type: "reminder",
          priority: "high",
          title: "Upcoming Event",
          message: `"${date.title}" is in ${daysUntil} day${daysUntil > 1 ? "s" : ""} (${date.date}).`,
        });
      } else if (daysUntil <= 7) {
        suggestions.push({
          type: "reminder",
          priority: "medium",
          title: "Upcoming Event",
          message: `"${date.title}" is coming up in ${daysUntil} days (${date.date}).`,
        });
      }
    }

    return suggestions;
  }

  function checkStaleProgress(todos: Record<TodoTimeframe, ParsedTodo[]>): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const allTodos = [...todos.today, ...todos.this_week, ...todos.someday];

    const inProgress = allTodos.filter((t) => t.state === "in_progress");
    const blocked = allTodos.filter((t) => t.state === "blocked");

    if (inProgress.length > 3) {
      suggestions.push({
        type: "warning",
        priority: "medium",
        title: "Too Many In Progress",
        message: `You have ${inProgress.length} todos in progress. Consider focusing on fewer items to increase completion rate.`,
      });
    }

    if (blocked.length > 0) {
      suggestions.push({
        type: "action",
        priority: "medium",
        title: "Blocked Items",
        message: `You have ${blocked.length} blocked todo${blocked.length > 1 ? "s" : ""}. Review if blockers can be resolved.`,
        actionable: {
          tool: "todo",
          action: "list",
          args: { filter: { state: "blocked" } },
        },
      });
    }

    return suggestions;
  }

  function checkGoalProgress(goals: Record<string, ParsedGoal[]>): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const allGoals = Object.values(goals).flat();

    const inProgress = allGoals.filter((g) => g.state === "in_progress");
    const notStarted = allGoals.filter((g) => g.state === "not_started");
    const paused = allGoals.filter((g) => g.state === "paused");

    // Check for goals with no progress
    for (const goal of inProgress) {
      if (goal.progress === 0) {
        suggestions.push({
          type: "action",
          priority: "medium",
          title: "Goal Needs Attention",
          message: `Goal "${goal.title}" is marked as in progress but has 0% completion. Consider updating progress or creating tasks.`,
        });
      }
    }

    // Suggest starting a goal if many are not started
    if (notStarted.length > 0 && inProgress.length < 2) {
      suggestions.push({
        type: "insight",
        priority: "low",
        title: "Ready to Start?",
        message: `You have ${notStarted.length} goal${notStarted.length > 1 ? "s" : ""} not yet started. Consider picking one to work on.`,
      });
    }

    // Remind about paused goals
    if (paused.length > 0) {
      suggestions.push({
        type: "reminder",
        priority: "low",
        title: "Paused Goals",
        message: `You have ${paused.length} paused goal${paused.length > 1 ? "s" : ""}. Review if any should be resumed or abandoned.`,
      });
    }

    return suggestions;
  }

  function checkOverdueTodos(todos: Record<TodoTimeframe, ParsedTodo[]>): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allTodos = [...todos.today, ...todos.this_week, ...todos.someday];

    for (const todo of allTodos) {
      if (todo.dueDate && todo.state !== "done" && todo.state !== "cancelled") {
        const dueDate = new Date(todo.dueDate);
        if (dueDate < today) {
          suggestions.push({
            type: "warning",
            priority: "high",
            title: "Overdue Todo",
            message: `"${todo.title}" was due on ${todo.dueDate}. Complete, defer, or cancel it.`,
            actionable: {
              tool: "todo",
              action: "complete",
              args: { title: todo.title },
            },
          });
        }
      }
    }

    return suggestions;
  }

  function checkEmptyToday(todos: Record<TodoTimeframe, ParsedTodo[]>): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const todayTodos = todos.today.filter(
      (t) => t.state !== "done" && t.state !== "cancelled"
    );

    if (todayTodos.length === 0) {
      const thisWeekPending = todos.this_week.filter(
        (t) => t.state === "pending" || t.state === "in_progress"
      );

      if (thisWeekPending.length > 0) {
        suggestions.push({
          type: "action",
          priority: "medium",
          title: "Plan Your Day",
          message: `No todos for today. Consider moving some items from "This Week" to today's list.`,
        });
      } else {
        suggestions.push({
          type: "insight",
          priority: "low",
          title: "Clear Day",
          message: "No pending todos for today. Great time to work on goals or add new tasks!",
        });
      }
    }

    return suggestions;
  }

  // Weekly review helper
  export async function generateWeeklyReview(): Promise<{
    completed: { goals: number; todos: number };
    inProgress: { goals: number; todos: number };
    suggestions: string[];
  }> {
    if (!(await DadGPTParser.exists())) {
      return {
        completed: { goals: 0, todos: 0 },
        inProgress: { goals: 0, todos: 0 },
        suggestions: ["Run 'dadgpt init' to get started"],
      };
    }

    const data = await DadGPTParser.parse();
    const allGoals = Object.values(data.goals).flat();
    const allTodos = [
      ...data.todos.today,
      ...data.todos.this_week,
      ...data.todos.someday,
    ];

    const completedGoals = allGoals.filter((g) => g.state === "completed").length;
    const inProgressGoals = allGoals.filter((g) => g.state === "in_progress").length;
    const completedTodos = allTodos.filter((t) => t.state === "done").length;
    const inProgressTodos = allTodos.filter((t) => t.state === "in_progress").length;

    const suggestions: string[] = [];

    if (completedTodos === 0) {
      suggestions.push("Consider breaking down your tasks into smaller, completable items");
    }

    if (inProgressGoals > 3) {
      suggestions.push("Focus on fewer goals at a time for better progress");
    }

    const blockedTodos = allTodos.filter((t) => t.state === "blocked").length;
    if (blockedTodos > 0) {
      suggestions.push(`Address ${blockedTodos} blocked todo(s) to maintain momentum`);
    }

    if (suggestions.length === 0) {
      suggestions.push("Keep up the great work!");
    }

    return {
      completed: { goals: completedGoals, todos: completedTodos },
      inProgress: { goals: inProgressGoals, todos: inProgressTodos },
      suggestions,
    };
  }

  // Helper to parse date strings and calculate days until
  function getDaysUntilDate(dateStr: string): number | null {
    const months: Record<string, number> = {
      january: 0, february: 1, march: 2, april: 3,
      may: 4, june: 5, july: 6, august: 7,
      september: 8, october: 9, november: 10, december: 11,
    };

    // Try "Month Day" format
    const monthDayMatch = dateStr.match(/^(\w+)\s+(\d+)/i);
    if (monthDayMatch) {
      const monthName = monthDayMatch[1]?.toLowerCase();
      const day = parseInt(monthDayMatch[2] ?? "1", 10);
      if (monthName && months[monthName] !== undefined) {
        const today = new Date();
        const date = new Date(today.getFullYear(), months[monthName], day);

        // If the date has passed this year, use next year
        if (date < today) {
          date.setFullYear(today.getFullYear() + 1);
        }

        const diffTime = date.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    // Try "MM-DD" format
    const mmddMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})$/);
    if (mmddMatch) {
      const month = parseInt(mmddMatch[1] ?? "1", 10) - 1;
      const day = parseInt(mmddMatch[2] ?? "1", 10);
      const today = new Date();
      const date = new Date(today.getFullYear(), month, day);

      if (date < today) {
        date.setFullYear(today.getFullYear() + 1);
      }

      const diffTime = date.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return null;
  }
}
