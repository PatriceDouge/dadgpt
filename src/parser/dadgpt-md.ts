import * as fs from "fs/promises";
import * as path from "path";
import type { GoalState } from "../state/goal.machine.ts";
import type { TodoState, TodoTimeframe, TodoPriority } from "../state/todo.machine.ts";
import { generateId } from "../util/id.ts";

export interface ParsedGoal {
  id: string;
  title: string;
  category: string;
  state: GoalState;
  progress: number;
  description?: string;
  dueDate?: string;
  milestones?: Array<{ title: string; completed: boolean }>;
}

export interface ParsedTodo {
  id: string;
  title: string;
  state: TodoState;
  timeframe: TodoTimeframe;
  priority?: TodoPriority;
  dueDate?: string;
  completed: boolean;
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  birthday?: string;
  age?: number;
  notes?: string;
}

export interface ImportantDate {
  id: string;
  title: string;
  date: string;
}

export interface Project {
  id: string;
  title: string;
  status: string;
  description?: string;
  budget?: number;
  nextAction?: string;
  tasks: Array<{ title: string; completed: boolean }>;
}

export interface DadGPTData {
  goals: Record<string, ParsedGoal[]>; // category -> goals
  todos: Record<TodoTimeframe, ParsedTodo[]>;
  family: {
    members: FamilyMember[];
    importantDates: ImportantDate[];
  };
  projects: Project[];
  notes: string;
  raw: string;
}

const DEFAULT_TEMPLATE = `# DadGPT - Personal Command Center

## Goals

### Health
<!-- Add health-related goals here -->

### Family
<!-- Add family-related goals here -->

### Work
<!-- Add work-related goals here -->

### Personal
<!-- Add personal goals here -->

### Finance
<!-- Add finance-related goals here -->

## Todos

### Today
<!-- Add today's tasks here -->

### This Week
<!-- Add this week's tasks here -->

### Someday
<!-- Add future tasks here -->

## Family

### Members
<!-- Add family members here -->
<!-- Format: - **Name**: Relationship (Birthday: Month Day) -->

### Important Dates
<!-- Add important dates here -->
<!-- Format: - Event Name: Month Day -->

## Projects
<!-- Add projects here -->

## Notes

<!-- Quick thoughts and reminders -->
`;

export namespace DadGPTParser {
  export function getDefaultPath(): string {
    return path.join(process.cwd(), "dadgpt.md");
  }

  export async function exists(filePath?: string): Promise<boolean> {
    const p = filePath ?? getDefaultPath();
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  export async function create(
    filePath?: string,
    template?: string
  ): Promise<void> {
    const p = filePath ?? getDefaultPath();
    await fs.writeFile(p, template ?? DEFAULT_TEMPLATE, "utf-8");
  }

  export async function read(filePath?: string): Promise<string> {
    const p = filePath ?? getDefaultPath();
    return fs.readFile(p, "utf-8");
  }

  export async function write(content: string, filePath?: string): Promise<void> {
    const p = filePath ?? getDefaultPath();
    // Backup first
    try {
      const existing = await fs.readFile(p, "utf-8");
      await fs.writeFile(p + ".bak", existing, "utf-8");
    } catch {
      // No existing file to backup
    }
    await fs.writeFile(p, content, "utf-8");
  }

  export async function parse(filePath?: string): Promise<DadGPTData> {
    const content = await read(filePath);
    return parseContent(content);
  }

  export function parseContent(content: string): DadGPTData {
    const data: DadGPTData = {
      goals: {},
      todos: {
        today: [],
        this_week: [],
        someday: [],
      },
      family: {
        members: [],
        importantDates: [],
      },
      projects: [],
      notes: "",
      raw: content,
    };

    const lines = content.split("\n");
    let currentSection = "";
    let currentSubsection = "";
    let currentCategory = "";
    let inGoals = false;
    let inTodos = false;
    let inFamily = false;
    let inProjects = false;
    let inNotes = false;
    let currentProject: Project | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("<!--")) continue;

      // Detect main sections (##)
      if (trimmed.startsWith("## ")) {
        const sectionName = trimmed.slice(3).toLowerCase();
        currentSection = sectionName;
        inGoals = sectionName === "goals";
        inTodos = sectionName === "todos";
        inFamily = sectionName === "family";
        inProjects = sectionName === "projects";
        inNotes = sectionName === "notes";
        currentSubsection = "";
        currentCategory = "";
        continue;
      }

      // Detect subsections (###)
      if (trimmed.startsWith("### ")) {
        currentSubsection = trimmed.slice(4);
        if (inGoals) {
          currentCategory = currentSubsection;
          if (!data.goals[currentCategory]) {
            data.goals[currentCategory] = [];
          }
        }
        continue;
      }

      // Parse goals
      if (inGoals && currentCategory && trimmed.startsWith("- ")) {
        const goal = parseGoalLine(trimmed, currentCategory, lines, i);
        if (goal) {
          data.goals[currentCategory]?.push(goal);
        }
      }

      // Parse todos
      if (inTodos && trimmed.startsWith("- ")) {
        let timeframe: TodoTimeframe = "someday";
        const subsectionLower = currentSubsection.toLowerCase();
        if (subsectionLower === "today") timeframe = "today";
        else if (subsectionLower.includes("week")) timeframe = "this_week";
        else if (subsectionLower === "someday") timeframe = "someday";

        const todo = parseTodoLine(trimmed, timeframe);
        if (todo) {
          data.todos[timeframe].push(todo);
        }
      }

      // Parse family
      if (inFamily) {
        const subsectionLower = currentSubsection.toLowerCase();
        if (subsectionLower === "members" && trimmed.startsWith("- ")) {
          const member = parseFamilyMemberLine(trimmed);
          if (member) {
            data.family.members.push(member);
          }
        } else if (subsectionLower.includes("date") && trimmed.startsWith("- ")) {
          const date = parseImportantDateLine(trimmed);
          if (date) {
            data.family.importantDates.push(date);
          }
        }
      }

      // Parse projects
      if (inProjects && trimmed.startsWith("### ")) {
        if (currentProject) {
          data.projects.push(currentProject);
        }
        currentProject = {
          id: generateId(),
          title: trimmed.slice(4),
          status: "active",
          tasks: [],
        };
      } else if (inProjects && currentProject && trimmed.startsWith("- ")) {
        const isTask = trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]");
        if (isTask) {
          const completed = trimmed.startsWith("- [x]");
          const title = trimmed.slice(6).trim();
          currentProject.tasks.push({ title, completed });
        } else if (trimmed.toLowerCase().startsWith("- status:")) {
          currentProject.status = trimmed.slice(9).trim();
        } else if (trimmed.toLowerCase().startsWith("- budget:")) {
          const budgetStr = trimmed.slice(9).trim().replace(/[$,]/g, "");
          currentProject.budget = parseInt(budgetStr, 10);
        } else if (trimmed.toLowerCase().startsWith("- next:")) {
          currentProject.nextAction = trimmed.slice(7).trim();
        }
      }

      // Parse notes
      if (inNotes && !trimmed.startsWith("#")) {
        data.notes += line + "\n";
      }
    }

    // Add last project if any
    if (currentProject) {
      data.projects.push(currentProject);
    }

    return data;
  }

  function parseGoalLine(
    line: string,
    category: string,
    allLines: string[],
    startIndex: number
  ): ParsedGoal | null {
    // Parse: - [ ] Goal title or - [x] Goal title
    const checkboxMatch = line.match(/^- \[([ x])\] (.+)$/);
    if (!checkboxMatch) return null;

    const completed = checkboxMatch[1] === "x";
    const title = checkboxMatch[2]?.trim() ?? "";

    const goal: ParsedGoal = {
      id: generateId(),
      title,
      category,
      state: completed ? "completed" : "not_started",
      progress: completed ? 100 : 0,
    };

    // Look for indented metadata
    for (let i = startIndex + 1; i < allLines.length; i++) {
      const nextLine = allLines[i] ?? "";
      if (!nextLine.startsWith("  ") && !nextLine.startsWith("\t")) break;

      const trimmedNext = nextLine.trim();
      if (trimmedNext.toLowerCase().startsWith("- state:")) {
        const stateStr = trimmedNext.slice(8).trim().toLowerCase();
        if (isValidGoalState(stateStr)) {
          goal.state = stateStr;
        }
      } else if (trimmedNext.toLowerCase().startsWith("- progress:")) {
        const progressStr = trimmedNext.slice(11).trim().replace("%", "");
        goal.progress = parseInt(progressStr, 10) || 0;
      } else if (trimmedNext.toLowerCase().startsWith("- due:")) {
        goal.dueDate = trimmedNext.slice(6).trim();
      }
    }

    return goal;
  }

  function parseTodoLine(line: string, timeframe: TodoTimeframe): ParsedTodo | null {
    const checkboxMatch = line.match(/^- \[([ x])\] (.+)$/);
    if (!checkboxMatch) return null;

    const completed = checkboxMatch[1] === "x";
    const title = checkboxMatch[2]?.trim() ?? "";

    return {
      id: generateId(),
      title,
      state: completed ? "done" : "pending",
      timeframe,
      completed,
    };
  }

  function parseFamilyMemberLine(line: string): FamilyMember | null {
    // Format: - **Name**: Relationship (Birthday: Month Day) or - **Name** (age) - Birthday: Month Day
    const match = line.match(/^- \*\*(.+?)\*\*[:\s]*(.+)?$/);
    if (!match) return null;

    const name = match[1]?.trim() ?? "";
    const rest = match[2]?.trim() ?? "";

    const member: FamilyMember = {
      id: generateId(),
      name,
      relationship: "family",
    };

    // Try to extract relationship and birthday
    const birthdayMatch = rest.match(/Birthday:\s*(.+?)(?:\)|$)/i);
    if (birthdayMatch) {
      member.birthday = birthdayMatch[1]?.trim();
    }

    // Try to extract age
    const ageMatch = rest.match(/\((\d+)\)/);
    if (ageMatch) {
      member.age = parseInt(ageMatch[1] ?? "0", 10);
    }

    // Extract relationship (before any parentheses)
    const relationshipMatch = rest.match(/^([^(]+)/);
    if (relationshipMatch) {
      member.relationship = relationshipMatch[1]?.trim().replace(/-.*$/, "").trim() || "family";
    }

    return member;
  }

  function parseImportantDateLine(line: string): ImportantDate | null {
    // Format: - Event Name: Month Day or - Event Name: MM-DD
    const match = line.match(/^- (.+?):\s*(.+)$/);
    if (!match) return null;

    return {
      id: generateId(),
      title: match[1]?.trim() ?? "",
      date: match[2]?.trim() ?? "",
    };
  }

  function isValidGoalState(state: string): state is GoalState {
    return ["not_started", "in_progress", "paused", "completed", "abandoned"].includes(
      state
    );
  }

  // Write helpers
  export async function addGoal(
    goal: ParsedGoal,
    filePath?: string
  ): Promise<void> {
    const content = await read(filePath);
    const lines = content.split("\n");

    // Find the category section
    let categoryIndex = -1;
    let insertIndex = -1;
    let inGoalsSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (line.trim() === "## Goals") {
        inGoalsSection = true;
      } else if (line.trim().startsWith("## ") && inGoalsSection) {
        // End of goals section, insert before this if category not found
        if (categoryIndex === -1) {
          insertIndex = i;
        }
        break;
      } else if (inGoalsSection && line.trim() === `### ${goal.category}`) {
        categoryIndex = i;
        // Find end of this category (next ### or ## or end of file)
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j] ?? "";
          if (nextLine.trim().startsWith("##")) {
            insertIndex = j;
            break;
          }
        }
        if (insertIndex === -1) {
          insertIndex = lines.length;
        }
        break;
      }
    }

    // Build the goal entry
    const checkbox = goal.state === "completed" ? "[x]" : "[ ]";
    let goalEntry = `- ${checkbox} ${goal.title}`;
    if (goal.state !== "not_started" && goal.state !== "completed") {
      goalEntry += `\n  - State: ${goal.state}`;
    }
    if (goal.progress > 0 && goal.progress < 100) {
      goalEntry += `\n  - Progress: ${goal.progress}%`;
    }
    if (goal.dueDate) {
      goalEntry += `\n  - Due: ${goal.dueDate}`;
    }

    // Insert the goal
    if (categoryIndex === -1) {
      // Create the category section
      const newSection = `\n### ${goal.category}\n${goalEntry}\n`;
      lines.splice(insertIndex, 0, newSection);
    } else {
      // Insert under existing category
      lines.splice(insertIndex, 0, goalEntry);
    }

    await write(lines.join("\n"), filePath);
  }

  export async function addTodo(
    todo: ParsedTodo,
    filePath?: string
  ): Promise<void> {
    const content = await read(filePath);
    const lines = content.split("\n");

    // Map timeframe to section name
    const sectionNames: Record<TodoTimeframe, string> = {
      today: "Today",
      this_week: "This Week",
      someday: "Someday",
    };
    const targetSection = sectionNames[todo.timeframe];

    let inTodosSection = false;
    let insertIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (line.trim() === "## Todos") {
        inTodosSection = true;
      } else if (line.trim().startsWith("## ") && inTodosSection) {
        break;
      } else if (inTodosSection && line.trim() === `### ${targetSection}`) {
        // Find end of this section
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j] ?? "";
          if (nextLine.trim().startsWith("##")) {
            insertIndex = j;
            break;
          }
        }
        if (insertIndex === -1) {
          insertIndex = lines.length;
        }
        break;
      }
    }

    const checkbox = todo.completed ? "[x]" : "[ ]";
    const todoEntry = `- ${checkbox} ${todo.title}`;

    if (insertIndex !== -1) {
      lines.splice(insertIndex, 0, todoEntry);
      await write(lines.join("\n"), filePath);
    }
  }

  export async function updateGoal(
    id: string,
    updates: Partial<ParsedGoal>,
    filePath?: string
  ): Promise<boolean> {
    // This is a simplified update - for real implementation,
    // we'd need to track line numbers or use a more sophisticated parser
    const data = await parse(filePath);

    for (const category of Object.keys(data.goals)) {
      const goals = data.goals[category] ?? [];
      const goalIndex = goals.findIndex((g) => g.id === id);
      if (goalIndex !== -1) {
        const goal = goals[goalIndex];
        if (goal) {
          Object.assign(goal, updates);
          // Rewrite the file - simplified approach
          await rebuildAndWrite(data, filePath);
          return true;
        }
      }
    }

    return false;
  }

  export async function updateTodo(
    id: string,
    updates: Partial<ParsedTodo>,
    filePath?: string
  ): Promise<boolean> {
    const data = await parse(filePath);

    for (const timeframe of Object.keys(data.todos) as TodoTimeframe[]) {
      const todos = data.todos[timeframe];
      const todoIndex = todos.findIndex((t) => t.id === id);
      if (todoIndex !== -1) {
        const todo = todos[todoIndex];
        if (todo) {
          Object.assign(todo, updates);
          await rebuildAndWrite(data, filePath);
          return true;
        }
      }
    }

    return false;
  }

  async function rebuildAndWrite(
    data: DadGPTData,
    filePath?: string
  ): Promise<void> {
    let content = "# DadGPT - Personal Command Center\n\n## Goals\n";

    // Write goals by category
    for (const [category, goals] of Object.entries(data.goals)) {
      content += `\n### ${category}\n`;
      for (const goal of goals) {
        const checkbox = goal.state === "completed" ? "[x]" : "[ ]";
        content += `- ${checkbox} ${goal.title}\n`;
        if (goal.state !== "not_started" && goal.state !== "completed") {
          content += `  - State: ${goal.state}\n`;
        }
        if (goal.progress > 0 && goal.progress < 100) {
          content += `  - Progress: ${goal.progress}%\n`;
        }
        if (goal.dueDate) {
          content += `  - Due: ${goal.dueDate}\n`;
        }
      }
    }

    // Write todos
    content += "\n## Todos\n";
    const timeframeNames: Record<TodoTimeframe, string> = {
      today: "Today",
      this_week: "This Week",
      someday: "Someday",
    };

    for (const [timeframe, todos] of Object.entries(data.todos)) {
      const name = timeframeNames[timeframe as TodoTimeframe];
      content += `\n### ${name}\n`;
      for (const todo of todos) {
        const checkbox = todo.completed || todo.state === "done" ? "[x]" : "[ ]";
        content += `- ${checkbox} ${todo.title}\n`;
      }
    }

    // Write family
    content += "\n## Family\n\n### Members\n";
    for (const member of data.family.members) {
      let line = `- **${member.name}**: ${member.relationship}`;
      if (member.age) line += ` (${member.age})`;
      if (member.birthday) line += ` - Birthday: ${member.birthday}`;
      content += line + "\n";
    }

    content += "\n### Important Dates\n";
    for (const date of data.family.importantDates) {
      content += `- ${date.title}: ${date.date}\n`;
    }

    // Write projects
    content += "\n## Projects\n";
    for (const project of data.projects) {
      content += `\n### ${project.title}\n`;
      content += `- Status: ${project.status}\n`;
      if (project.budget) content += `- Budget: $${project.budget.toLocaleString()}\n`;
      if (project.nextAction) content += `- Next: ${project.nextAction}\n`;
      for (const task of project.tasks) {
        const checkbox = task.completed ? "[x]" : "[ ]";
        content += `- ${checkbox} ${task.title}\n`;
      }
    }

    // Write notes
    content += "\n## Notes\n\n" + data.notes.trim() + "\n";

    await write(content, filePath);
  }
}
