/**
 * Parser for dadgpt.md files.
 *
 * Extracts goals, todos, family members, and projects from markdown format.
 */

/**
 * Parsed goal from markdown.
 */
export interface ParsedGoal {
  title: string
  completed: boolean
  category?: string
  dueDate?: string
  description?: string
}

/**
 * Parsed todo from markdown.
 */
export interface ParsedTodo {
  title: string
  completed: boolean
  priority?: "low" | "medium" | "high"
  tags?: string[]
  dueDate?: string
  description?: string
}

/**
 * Parsed family member from markdown.
 */
export interface ParsedFamilyMember {
  name: string
  relationship: string
  birthday?: string
  notes?: string
}

/**
 * Parsed project milestone from markdown.
 */
export interface ParsedMilestone {
  title: string
  completed: boolean
}

/**
 * Parsed project from markdown.
 */
export interface ParsedProject {
  name: string
  status?: string
  goal?: string
  description?: string
  milestones: ParsedMilestone[]
}

/**
 * Result of parsing a dadgpt.md file.
 */
export interface ParsedDadGPTMd {
  goals: ParsedGoal[]
  todos: ParsedTodo[]
  family: ParsedFamilyMember[]
  projects: ParsedProject[]
}

/**
 * Parse a dadgpt.md file content and extract structured data.
 *
 * @param content - The raw markdown content
 * @returns Parsed structured data
 */
export function parseDadGPTMd(content: string): ParsedDadGPTMd {
  const result: ParsedDadGPTMd = {
    goals: [],
    todos: [],
    family: [],
    projects: [],
  }

  const lines = content.split("\n")
  let currentSection: "goals" | "todos" | "family" | "projects" | null = null
  let currentItem: ParsedGoal | ParsedTodo | ParsedFamilyMember | ParsedProject | null = null
  let currentProject: ParsedProject | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ""
    const trimmedLine = line.trim()

    // Detect section headers (## Goals, ## Todos, etc.)
    if (trimmedLine.match(/^##\s+Goals?$/i)) {
      saveCurrentItem(result, currentSection, currentItem)
      currentSection = "goals"
      currentItem = null
      currentProject = null
      continue
    }

    if (trimmedLine.match(/^##\s+Todos?$/i)) {
      saveCurrentItem(result, currentSection, currentItem)
      currentSection = "todos"
      currentItem = null
      currentProject = null
      continue
    }

    if (trimmedLine.match(/^##\s+Family$/i)) {
      saveCurrentItem(result, currentSection, currentItem)
      currentSection = "family"
      currentItem = null
      currentProject = null
      continue
    }

    if (trimmedLine.match(/^##\s+Projects?$/i)) {
      saveCurrentItem(result, currentSection, currentItem)
      currentSection = "projects"
      currentItem = null
      currentProject = null
      continue
    }

    // New section detected - save current item and reset
    if (trimmedLine.match(/^##\s+/)) {
      saveCurrentItem(result, currentSection, currentItem)
      currentSection = null
      currentItem = null
      currentProject = null
      continue
    }

    // Parse based on current section
    if (currentSection === "goals") {
      const parsed = parseGoalLine(trimmedLine, currentItem as ParsedGoal | null)
      if (parsed.newItem) {
        saveCurrentItem(result, currentSection, currentItem)
        currentItem = parsed.newItem
      } else if (parsed.metadata && currentItem) {
        Object.assign(currentItem, parsed.metadata)
      }
    } else if (currentSection === "todos") {
      const parsed = parseTodoLine(trimmedLine, currentItem as ParsedTodo | null)
      if (parsed.newItem) {
        saveCurrentItem(result, currentSection, currentItem)
        currentItem = parsed.newItem
      } else if (parsed.metadata && currentItem) {
        Object.assign(currentItem, parsed.metadata)
      }
    } else if (currentSection === "family") {
      const parsed = parseFamilyLine(trimmedLine, currentItem as ParsedFamilyMember | null)
      if (parsed.newItem) {
        saveCurrentItem(result, currentSection, currentItem)
        currentItem = parsed.newItem
      } else if (parsed.metadata && currentItem) {
        Object.assign(currentItem, parsed.metadata)
      }
    } else if (currentSection === "projects") {
      const parsed = parseProjectLine(trimmedLine, currentProject)
      if (parsed.newProject) {
        if (currentProject) {
          result.projects.push(currentProject)
        }
        currentProject = parsed.newProject
      } else if (parsed.metadata && currentProject) {
        Object.assign(currentProject, parsed.metadata)
      } else if (parsed.milestone && currentProject) {
        currentProject.milestones.push(parsed.milestone)
      }
    }
  }

  // Save final items
  saveCurrentItem(result, currentSection, currentItem)
  if (currentProject) {
    result.projects.push(currentProject)
  }

  return result
}

/**
 * Save current item to result based on section.
 */
function saveCurrentItem(
  result: ParsedDadGPTMd,
  section: "goals" | "todos" | "family" | "projects" | null,
  item: ParsedGoal | ParsedTodo | ParsedFamilyMember | ParsedProject | null
): void {
  if (!item || !section) return

  if (section === "goals") {
    result.goals.push(item as ParsedGoal)
  } else if (section === "todos") {
    result.todos.push(item as ParsedTodo)
  } else if (section === "family") {
    result.family.push(item as ParsedFamilyMember)
  }
  // Projects are saved separately via currentProject
}

/**
 * Parse a goal line and return new item or metadata.
 */
function parseGoalLine(
  line: string,
  _currentItem: ParsedGoal | null
): { newItem?: ParsedGoal; metadata?: Partial<ParsedGoal> } {
  // Check for checkbox line: - [ ] Title or - [x] Title
  const checkboxMatch = line.match(/^-\s*\[([ xX])\]\s*(.+)$/)
  if (checkboxMatch) {
    const completed = checkboxMatch[1]?.toLowerCase() === "x"
    const title = checkboxMatch[2]?.trim() ?? ""
    return {
      newItem: {
        title,
        completed,
      },
    }
  }

  // Check for metadata lines (indented with - Key: Value)
  const metadataMatch = line.match(/^-\s*(\w+):\s*(.*)$/)
  if (metadataMatch) {
    const key = metadataMatch[1]?.toLowerCase() ?? ""
    const value = metadataMatch[2]?.trim() ?? ""

    if (key === "category") {
      return { metadata: { category: value } }
    }
    if (key === "due" || key === "duedate") {
      return { metadata: { dueDate: value } }
    }
    if (key === "description") {
      return { metadata: { description: value } }
    }
  }

  return {}
}

/**
 * Parse a todo line and return new item or metadata.
 */
function parseTodoLine(
  line: string,
  _currentItem: ParsedTodo | null
): { newItem?: ParsedTodo; metadata?: Partial<ParsedTodo> } {
  // Check for checkbox line: - [ ] Title or - [x] Title
  const checkboxMatch = line.match(/^-\s*\[([ xX])\]\s*(.+)$/)
  if (checkboxMatch) {
    const completed = checkboxMatch[1]?.toLowerCase() === "x"
    const title = checkboxMatch[2]?.trim() ?? ""
    return {
      newItem: {
        title,
        completed,
      },
    }
  }

  // Check for metadata lines (indented with - Key: Value)
  const metadataMatch = line.match(/^-\s*(\w+):\s*(.*)$/)
  if (metadataMatch) {
    const key = metadataMatch[1]?.toLowerCase() ?? ""
    const value = metadataMatch[2]?.trim() ?? ""

    if (key === "priority") {
      const priority = value.toLowerCase()
      if (priority === "high" || priority === "medium" || priority === "low") {
        return { metadata: { priority } }
      }
    }
    if (key === "tags") {
      // Parse comma-separated tags
      const tags = value
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
      return { metadata: { tags } }
    }
    if (key === "due" || key === "duedate") {
      return { metadata: { dueDate: value } }
    }
    if (key === "description") {
      return { metadata: { description: value } }
    }
  }

  return {}
}

/**
 * Parse a family line and return new item or metadata.
 */
function parseFamilyLine(
  line: string,
  _currentItem: ParsedFamilyMember | null
): { newItem?: ParsedFamilyMember; metadata?: Partial<ParsedFamilyMember> } {
  // Check for family member header: - **Relationship**: Name or ### Name
  // Pattern 1: - **Relationship**: Name
  const memberMatch = line.match(/^-\s*\*\*(\w+)\*\*:\s*(.+)$/)
  if (memberMatch) {
    const relationship = memberMatch[1]?.trim() ?? ""
    let name = memberMatch[2]?.trim() ?? ""
    // Remove brackets if present: [Name] -> Name
    if (name.startsWith("[") && name.endsWith("]")) {
      name = name.slice(1, -1)
    }
    return {
      newItem: {
        name,
        relationship,
      },
    }
  }

  // Pattern 2: ### Family Members subsection header (ignore)
  if (line.match(/^###\s+Family\s+Members?$/i)) {
    return {}
  }

  // Pattern 3: ### Name (name as header with no relationship)
  const headerMatch = line.match(/^###\s+(.+)$/)
  if (headerMatch) {
    const name = headerMatch[1]?.trim() ?? ""
    return {
      newItem: {
        name,
        relationship: "Unknown",
      },
    }
  }

  // Check for metadata lines (indented with - Key: Value)
  const metadataMatch = line.match(/^-\s*(\w+):\s*(.*)$/)
  if (metadataMatch) {
    const key = metadataMatch[1]?.toLowerCase() ?? ""
    const value = metadataMatch[2]?.trim() ?? ""

    if (key === "birthday") {
      return { metadata: { birthday: value } }
    }
    if (key === "notes") {
      return { metadata: { notes: value } }
    }
  }

  return {}
}

/**
 * Parse a project line and return new project, metadata, or milestone.
 */
function parseProjectLine(
  line: string,
  _currentProject: ParsedProject | null
): {
  newProject?: ParsedProject
  metadata?: Partial<ParsedProject>
  milestone?: ParsedMilestone
} {
  // Check for project header: ### Project Name
  const projectMatch = line.match(/^###\s+(.+)$/)
  if (projectMatch) {
    const name = projectMatch[1]?.trim() ?? ""
    return {
      newProject: {
        name,
        milestones: [],
      },
    }
  }

  // Check for milestone checkbox line (under Milestones:)
  const milestoneMatch = line.match(/^-\s*\[([ xX])\]\s*(.+)$/)
  if (milestoneMatch) {
    const completed = milestoneMatch[1]?.toLowerCase() === "x"
    const title = milestoneMatch[2]?.trim() ?? ""
    return {
      milestone: {
        title,
        completed,
      },
    }
  }

  // Check for metadata lines (- Key: Value)
  const metadataMatch = line.match(/^-\s*(\w+):\s*(.*)$/)
  if (metadataMatch) {
    const key = metadataMatch[1]?.toLowerCase() ?? ""
    const value = metadataMatch[2]?.trim() ?? ""

    if (key === "status") {
      return { metadata: { status: value } }
    }
    if (key === "goal") {
      return { metadata: { goal: value } }
    }
    if (key === "description") {
      return { metadata: { description: value } }
    }
    // Ignore "Milestones:" header
    if (key === "milestones") {
      return {}
    }
  }

  return {}
}
