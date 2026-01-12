import { z } from "zod";
import { defineTool } from "./types.ts";
import { DadGPTParser, type ParsedTodo } from "../parser/dadgpt-md.ts";
import { generateId } from "../util/id.ts";
import type { TodoState, TodoTimeframe, TodoPriority } from "../state/todo.machine.ts";
import { Storage } from "../storage/storage.ts";
import { Bus } from "../bus/bus.ts";

const TodoActionSchema = z.enum([
  "create",
  "list",
  "update",
  "complete",
  "start",
  "block",
  "unblock",
  "defer",
  "cancel",
]);

export const todoTool = defineTool({
  name: "todo",
  description: `Manage todos in dadgpt.md. Actions:
- create: Create a new todo
- list: List all todos (optionally filter by state or timeframe)
- update: Update a todo
- start: Start working on a todo
- complete: Mark a todo as done
- block: Mark a todo as blocked (with reason)
- unblock: Unblock a blocked todo
- defer: Defer a todo to a later timeframe
- cancel: Cancel a todo`,

  parameters: z.object({
    action: TodoActionSchema,
    id: z.string().optional().describe("Todo ID (for update/complete/etc.)"),
    title: z.string().optional().describe("Todo title (for create, or to find by title)"),
    timeframe: z.enum(["today", "this_week", "someday"]).optional().describe("Timeframe for the todo"),
    priority: z.enum(["high", "medium", "low"]).optional().describe("Priority level"),
    dueDate: z.string().optional().describe("Due date"),
    goalId: z.string().optional().describe("Associated goal ID"),
    blockedReason: z.string().optional().describe("Reason for blocking"),
    filter: z.object({
      state: z.string().optional(),
      timeframe: z.string().optional(),
    }).optional().describe("Filter for list action"),
  }),

  async execute(args, _ctx) {
    switch (args.action) {
      case "create":
        return await createTodo(args);
      case "list":
        return await listTodos(args.filter);
      case "update":
        return await updateTodo(args);
      case "start":
        return await transitionTodo(args, "in_progress");
      case "complete":
        return await transitionTodo(args, "done");
      case "block":
        return await transitionTodo(args, "blocked", args.blockedReason);
      case "unblock":
        return await transitionTodo(args, "in_progress");
      case "defer":
        return await deferTodo(args);
      case "cancel":
        return await transitionTodo(args, "cancelled", args.blockedReason);
      default:
        return {
          title: "Error",
          output: `Unknown action: ${args.action}`,
          error: true,
        };
    }
  },
});

async function findTodoByTitle(title: string): Promise<{ todo: ParsedTodo; timeframe: TodoTimeframe } | null> {
  const data = await DadGPTParser.parse();
  for (const timeframe of ["today", "this_week", "someday"] as TodoTimeframe[]) {
    const todos = data.todos[timeframe];
    const found = todos.find((t) =>
      t.title.toLowerCase().includes(title.toLowerCase())
    );
    if (found) {
      return { todo: found, timeframe };
    }
  }
  return null;
}

async function createTodo(args: {
  title?: string;
  timeframe?: TodoTimeframe;
  priority?: TodoPriority;
  dueDate?: string;
  goalId?: string;
}) {
  if (!args.title) {
    return {
      title: "Error",
      output: "Todo title is required",
      error: true,
    };
  }

  const todo: ParsedTodo = {
    id: generateId(),
    title: args.title,
    state: "pending",
    timeframe: args.timeframe ?? "today",
    priority: args.priority,
    dueDate: args.dueDate,
    completed: false,
  };

  // Check if dadgpt.md exists
  if (!(await DadGPTParser.exists())) {
    await DadGPTParser.create();
  }

  await DadGPTParser.addTodo(todo);

  // Also store in JSON for state tracking
  await Storage.write(["todos", todo.id], {
    ...todo,
    goalId: args.goalId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stateHistory: [],
  });

  Bus.publish("todo.created", { todo });

  return {
    title: "Todo Created",
    output: `Created todo "${todo.title}" for ${todo.timeframe.replace("_", " ")} (ID: ${todo.id})`,
    metadata: { todo },
  };
}

async function listTodos(filter?: { state?: string; timeframe?: string }) {
  if (!(await DadGPTParser.exists())) {
    return {
      title: "No Todos",
      output: "No dadgpt.md file found. Run 'dadgpt init' to create one.",
    };
  }

  const data = await DadGPTParser.parse();
  let output = "";
  let totalCount = 0;

  const timeframes: TodoTimeframe[] = filter?.timeframe
    ? [filter.timeframe as TodoTimeframe]
    : ["today", "this_week", "someday"];

  for (const timeframe of timeframes) {
    let todos = data.todos[timeframe] ?? [];

    // Apply state filter
    if (filter?.state) {
      todos = todos.filter((t) => t.state === filter.state);
    }

    if (todos.length === 0) continue;

    const timeframeName = {
      today: "Today",
      this_week: "This Week",
      someday: "Someday",
    }[timeframe];

    output += `\n${timeframeName}:\n`;
    for (const todo of todos) {
      const status = todo.state === "done" ? "✓" :
        todo.state === "in_progress" ? "→" :
        todo.state === "blocked" ? "✗" :
        todo.state === "deferred" ? "⏸" :
        "○";
      let line = `  ${status} ${todo.title}`;
      if (todo.priority) {
        line += ` [${todo.priority}]`;
      }
      if (todo.state === "blocked") {
        line += " (blocked)";
      }
      output += line + "\n";
      totalCount++;
    }
  }

  if (totalCount === 0) {
    return {
      title: "Todos",
      output: "No todos found" + (filter ? " matching the filter" : ""),
    };
  }

  return {
    title: `Todos (${totalCount})`,
    output: output.trim(),
    metadata: { count: totalCount },
  };
}

async function updateTodo(args: {
  id?: string;
  title?: string;
  priority?: TodoPriority;
  dueDate?: string;
  goalId?: string;
}) {
  let todoId = args.id;

  if (!todoId && args.title) {
    const found = await findTodoByTitle(args.title);
    if (found) {
      todoId = found.todo.id;
    }
  }

  if (!todoId) {
    return {
      title: "Error",
      output: "Todo ID or title is required to update",
      error: true,
    };
  }

  const updates: Partial<ParsedTodo> = {};
  if (args.priority !== undefined) updates.priority = args.priority;
  if (args.dueDate !== undefined) updates.dueDate = args.dueDate;

  const updated = await DadGPTParser.updateTodo(todoId, updates);

  if (!updated) {
    return {
      title: "Error",
      output: `Todo with ID ${todoId} not found`,
      error: true,
    };
  }

  await Storage.update(["todos", todoId], (prev: unknown) => ({
    ...(prev as object),
    ...updates,
    goalId: args.goalId ?? (prev as { goalId?: string })?.goalId,
    updatedAt: new Date().toISOString(),
  }));

  return {
    title: "Todo Updated",
    output: `Updated todo ${todoId}`,
    metadata: { id: todoId, updates },
  };
}

async function transitionTodo(
  args: { id?: string; title?: string },
  targetState: TodoState,
  reason?: string
) {
  let todoId = args.id;

  if (!todoId && args.title) {
    const found = await findTodoByTitle(args.title);
    if (found) {
      todoId = found.todo.id;
    }
  }

  if (!todoId) {
    return {
      title: "Error",
      output: "Todo ID or title is required",
      error: true,
    };
  }

  const updates: Partial<ParsedTodo> = {
    state: targetState,
    completed: targetState === "done",
  };

  const updated = await DadGPTParser.updateTodo(todoId, updates);

  if (!updated) {
    return {
      title: "Error",
      output: `Todo with ID ${todoId} not found`,
      error: true,
    };
  }

  await Storage.update(["todos", todoId], (prev: unknown) => {
    const prevTodo = prev as {
      state?: TodoState;
      blockedReason?: string;
      stateHistory?: Array<{ from: TodoState; to: TodoState; at: string; reason?: string }>;
    } | undefined;
    return {
      ...prevTodo,
      state: targetState,
      completed: targetState === "done",
      completedAt: targetState === "done" ? new Date().toISOString() : undefined,
      blockedReason: targetState === "blocked" ? reason : undefined,
      updatedAt: new Date().toISOString(),
      stateHistory: [
        ...(prevTodo?.stateHistory ?? []),
        {
          from: prevTodo?.state ?? "pending",
          to: targetState,
          at: new Date().toISOString(),
          reason,
        },
      ],
    };
  });

  const actionWord = {
    pending: "reset to pending",
    in_progress: "started",
    done: "completed",
    blocked: "blocked",
    deferred: "deferred",
    cancelled: "cancelled",
  }[targetState];

  if (targetState === "done") {
    Bus.publish("todo.completed", { id: todoId });
  }

  return {
    title: `Todo ${actionWord.charAt(0).toUpperCase() + actionWord.slice(1)}`,
    output: `Todo has been ${actionWord}` + (reason ? ` (${reason})` : ""),
    metadata: { id: todoId, state: targetState },
  };
}

async function deferTodo(args: { id?: string; title?: string; timeframe?: TodoTimeframe }) {
  let todoId = args.id;
  let currentTimeframe: TodoTimeframe | undefined;

  if (!todoId && args.title) {
    const found = await findTodoByTitle(args.title);
    if (found) {
      todoId = found.todo.id;
      currentTimeframe = found.timeframe;
    }
  }

  if (!todoId) {
    return {
      title: "Error",
      output: "Todo ID or title is required",
      error: true,
    };
  }

  // Determine new timeframe
  let newTimeframe: TodoTimeframe = args.timeframe ?? "this_week";
  if (!args.timeframe && currentTimeframe) {
    // Auto-progression: today -> this_week -> someday
    const progression: Record<TodoTimeframe, TodoTimeframe> = {
      today: "this_week",
      this_week: "someday",
      someday: "someday",
    };
    newTimeframe = progression[currentTimeframe];
  }

  const updates: Partial<ParsedTodo> = {
    state: "deferred",
    timeframe: newTimeframe,
  };

  const updated = await DadGPTParser.updateTodo(todoId, updates);

  if (!updated) {
    return {
      title: "Error",
      output: `Todo with ID ${todoId} not found`,
      error: true,
    };
  }

  await Storage.update(["todos", todoId], (prev: unknown) => {
    const prevTodo = prev as {
      state?: TodoState;
      timeframe?: TodoTimeframe;
      stateHistory?: Array<{ from: TodoState; to: TodoState; at: string; reason?: string }>;
    } | undefined;
    return {
      ...prevTodo,
      state: "deferred",
      timeframe: newTimeframe,
      updatedAt: new Date().toISOString(),
      stateHistory: [
        ...(prevTodo?.stateHistory ?? []),
        {
          from: prevTodo?.state ?? "pending",
          to: "deferred",
          at: new Date().toISOString(),
          reason: `Deferred to ${newTimeframe.replace("_", " ")}`,
        },
      ],
    };
  });

  return {
    title: "Todo Deferred",
    output: `Todo has been deferred to ${newTimeframe.replace("_", " ")}`,
    metadata: { id: todoId, timeframe: newTimeframe },
  };
}
