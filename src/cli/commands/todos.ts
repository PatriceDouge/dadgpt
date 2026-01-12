import type { CommandModule } from "yargs";
import { UI } from "../ui.ts";
import { DadGPTParser } from "../../parser/dadgpt-md.ts";
import type { TodoState, TodoTimeframe } from "../../state/todo.machine.ts";

interface TodosArgs {
  timeframe?: string;
  state?: string;
  add?: string;
  done?: string;
}

export const todosCommand: CommandModule<object, TodosArgs> = {
  command: "todos",
  describe: "List and manage todos",
  builder: (yargs) =>
    yargs
      .option("timeframe", {
        type: "string",
        alias: "t",
        choices: ["today", "this_week", "someday"],
        describe: "Filter by timeframe",
      })
      .option("state", {
        type: "string",
        alias: "s",
        choices: ["pending", "in_progress", "blocked", "deferred", "done", "cancelled"],
        describe: "Filter by state",
      })
      .option("add", {
        type: "string",
        alias: "a",
        describe: "Add a new todo",
      })
      .option("done", {
        type: "string",
        alias: "d",
        describe: "Mark a todo as done (by title match)",
      }),

  handler: async (args) => {
    if (!(await DadGPTParser.exists())) {
      UI.error("No dadgpt.md found. Run 'dadgpt init' first.");
      return;
    }

    if (args.add) {
      await addTodo(args.add, args.timeframe as TodoTimeframe | undefined);
      return;
    }

    if (args.done) {
      await markDone(args.done);
      return;
    }

    await listTodos(
      args.timeframe as TodoTimeframe | undefined,
      args.state as TodoState | undefined
    );
  },
};

async function listTodos(
  timeframe?: TodoTimeframe,
  state?: TodoState
): Promise<void> {
  const data = await DadGPTParser.parse();

  UI.header("Todos");

  const timeframes: TodoTimeframe[] = timeframe
    ? [timeframe]
    : ["today", "this_week", "someday"];

  const timeframeNames: Record<TodoTimeframe, string> = {
    today: "Today",
    this_week: "This Week",
    someday: "Someday",
  };

  let totalTodos = 0;
  let displayedTodos = 0;
  let completedTodos = 0;

  for (const tf of timeframes) {
    let todos = data.todos[tf] ?? [];
    totalTodos += todos.length;

    // Filter by state
    if (state) {
      todos = todos.filter((t) => t.state === state);
    }

    displayedTodos += todos.length;
    completedTodos += todos.filter((t) => t.state === "done").length;

    if (todos.length === 0) continue;

    UI.println(`\n  ${timeframeNames[tf]}:`);

    for (const todo of todos) {
      const statusIcon = getStatusIcon(todo.state);
      let line = `    ${statusIcon} ${todo.title}`;

      if (todo.priority) {
        const priorityIcon = {
          high: "!!!",
          medium: "!!",
          low: "!",
        }[todo.priority];
        line += ` ${priorityIcon}`;
      }

      if (todo.state === "blocked") {
        line += " [blocked]";
      } else if (todo.state === "deferred") {
        line += " [deferred]";
      }

      UI.println(line);
    }
  }

  UI.println();

  if (displayedTodos === 0) {
    if (timeframe || state) {
      UI.dim("No todos matching the filter.");
    } else {
      UI.dim("No todos found. Add some with 'dadgpt todos --add \"Your task\"'");
    }
  } else {
    const pendingTodos = displayedTodos - completedTodos;
    UI.dim(
      `${pendingTodos} pending, ${completedTodos} completed (${totalTodos} total)`
    );
  }

  UI.println();
}

async function addTodo(title: string, timeframe?: TodoTimeframe): Promise<void> {
  const tf = timeframe ?? "today";

  await DadGPTParser.addTodo({
    id: Date.now().toString(),
    title,
    state: "pending",
    timeframe: tf,
    completed: false,
  });

  const timeframeName = {
    today: "Today",
    this_week: "This Week",
    someday: "Someday",
  }[tf];

  UI.success(`Added todo: "${title}" to ${timeframeName}`);
}

async function markDone(titleMatch: string): Promise<void> {
  const data = await DadGPTParser.parse();

  // Find matching todo
  for (const timeframe of ["today", "this_week", "someday"] as TodoTimeframe[]) {
    const todos = data.todos[timeframe];
    const found = todos.find((t) =>
      t.title.toLowerCase().includes(titleMatch.toLowerCase())
    );

    if (found) {
      await DadGPTParser.updateTodo(found.id, {
        state: "done",
        completed: true,
      });
      UI.success(`Marked as done: "${found.title}"`);
      return;
    }
  }

  UI.error(`No todo found matching: "${titleMatch}"`);
}

function getStatusIcon(state: TodoState): string {
  switch (state) {
    case "done":
      return "✓";
    case "in_progress":
      return "→";
    case "blocked":
      return "✗";
    case "deferred":
      return "⏸";
    case "cancelled":
      return "⊘";
    default:
      return "○";
  }
}
