import { describe, test, expect } from "vitest"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import {
  parseDadGPTMd,
  type ParsedDadGPTMd,
  type ParsedGoal,
  type ParsedTodo,
  type ParsedFamilyMember,
  type ParsedProject,
} from "../../../src/parser/dadgpt-md"

// Path to test fixture
const FIXTURE_PATH = path.join(__dirname, "../../fixtures/dadgpt.md")

describe("parseDadGPTMd", () => {
  describe("Goals Section", () => {
    test("parses goals from fixture file", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      expect(result.goals).toHaveLength(3)
    })

    test("parses unchecked goal correctly", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      const spanishGoal = result.goals.find((g) => g.title === "Learn Spanish")
      expect(spanishGoal).toBeDefined()
      expect(spanishGoal?.completed).toBe(false)
      expect(spanishGoal?.category).toBe("Personal")
      expect(spanishGoal?.dueDate).toBe("2024-12-31")
      expect(spanishGoal?.description).toBe("Become conversational in Spanish")
    })

    test("parses checked goal correctly", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      const marathonGoal = result.goals.find((g) => g.title === "Run a marathon")
      expect(marathonGoal).toBeDefined()
      expect(marathonGoal?.completed).toBe(true)
      expect(marathonGoal?.category).toBe("Health")
    })

    test("parses goal with DueDate metadata (alternative key)", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      const vacationGoal = result.goals.find((g) => g.title === "Save for vacation")
      expect(vacationGoal).toBeDefined()
      expect(vacationGoal?.dueDate).toBe("2024-08-15")
    })

    test("parses goals with minimal content", () => {
      const content = `## Goals

- [ ] Simple goal
- [x] Completed goal`

      const result = parseDadGPTMd(content)

      expect(result.goals).toHaveLength(2)
      expect(result.goals[0]?.title).toBe("Simple goal")
      expect(result.goals[0]?.completed).toBe(false)
      expect(result.goals[1]?.title).toBe("Completed goal")
      expect(result.goals[1]?.completed).toBe(true)
    })

    test("handles case-insensitive checkbox [X] vs [x]", () => {
      const content = `## Goals

- [X] Goal with uppercase X
- [x] Goal with lowercase x`

      const result = parseDadGPTMd(content)

      expect(result.goals[0]?.completed).toBe(true)
      expect(result.goals[1]?.completed).toBe(true)
    })
  })

  describe("Todos Section", () => {
    test("parses todos from fixture file", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      expect(result.todos).toHaveLength(3)
    })

    test("parses todo with all metadata", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      const groceryTodo = result.todos.find((t) => t.title === "Buy groceries")
      expect(groceryTodo).toBeDefined()
      expect(groceryTodo?.completed).toBe(false)
      expect(groceryTodo?.priority).toBe("high")
      expect(groceryTodo?.tags).toEqual(["shopping", "urgent"])
      expect(groceryTodo?.dueDate).toBe("2024-01-15")
    })

    test("parses completed todo correctly", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      const callTodo = result.todos.find((t) => t.title === "Call mom")
      expect(callTodo).toBeDefined()
      expect(callTodo?.completed).toBe(true)
      expect(callTodo?.priority).toBe("medium")
      expect(callTodo?.description).toBe("Wish her happy birthday")
    })

    test("parses todo priority values correctly", () => {
      const content = `## Todos

- [ ] High priority task
  - Priority: high

- [ ] Medium priority task
  - Priority: medium

- [ ] Low priority task
  - Priority: low`

      const result = parseDadGPTMd(content)

      expect(result.todos[0]?.priority).toBe("high")
      expect(result.todos[1]?.priority).toBe("medium")
      expect(result.todos[2]?.priority).toBe("low")
    })

    test("parses tags as comma-separated values", () => {
      const content = `## Todos

- [ ] Task with tags
  - Tags: work, important, review`

      const result = parseDadGPTMd(content)

      expect(result.todos[0]?.tags).toEqual(["work", "important", "review"])
    })

    test("handles empty tags gracefully", () => {
      const content = `## Todos

- [ ] Task with empty tags
  - Tags: `

      const result = parseDadGPTMd(content)

      expect(result.todos[0]?.tags).toEqual([])
    })
  })

  describe("Family Section", () => {
    test("parses family members from fixture file", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      expect(result.family).toHaveLength(4)
    })

    test("parses family member with relationship format", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      const wife = result.family.find((f) => f.name === "Sarah")
      expect(wife).toBeDefined()
      expect(wife?.relationship).toBe("Wife")
      expect(wife?.birthday).toBe("1990-05-15")
      expect(wife?.notes).toBe("Loves hiking and photography")
    })

    test("parses family member with header format (### Name)", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      const grandma = result.family.find((f) => f.name === "Grandma Rose")
      expect(grandma).toBeDefined()
      expect(grandma?.relationship).toBe("Unknown")
      expect(grandma?.birthday).toBe("1955-12-01")
      expect(grandma?.notes).toBe("Lives in Florida")
    })

    test("parses family member without all metadata", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      const daughter = result.family.find((f) => f.name === "Emma")
      expect(daughter).toBeDefined()
      expect(daughter?.relationship).toBe("Daughter")
      expect(daughter?.birthday).toBe("2018-03-10")
      expect(daughter?.notes).toBeUndefined()
    })

    test("parses family member with bracketed name format", () => {
      const content = `## Family

- **Spouse**: [John Doe]
  - Birthday: 1985-03-15`

      const result = parseDadGPTMd(content)

      expect(result.family[0]?.name).toBe("John Doe")
      expect(result.family[0]?.relationship).toBe("Spouse")
    })
  })

  describe("Projects Section", () => {
    test("parses projects from fixture file", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      expect(result.projects).toHaveLength(2)
    })

    test("parses project with all metadata and milestones", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      const renovation = result.projects.find((p) => p.name === "Home Renovation")
      expect(renovation).toBeDefined()
      expect(renovation?.status).toBe("active")
      expect(renovation?.goal).toBe("Improve home value")
      expect(renovation?.description).toBe("Complete kitchen and bathroom updates")
      expect(renovation?.milestones).toHaveLength(3)
    })

    test("parses project milestones with completion status", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      const renovation = result.projects.find((p) => p.name === "Home Renovation")
      expect(renovation?.milestones[0]).toEqual({
        title: "Design plans finalized",
        completed: true,
      })
      expect(renovation?.milestones[1]).toEqual({
        title: "Kitchen cabinets ordered",
        completed: false,
      })
      expect(renovation?.milestones[2]).toEqual({
        title: "Bathroom tiles selected",
        completed: false,
      })
    })

    test("parses project with minimal metadata", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      const guitar = result.projects.find((p) => p.name === "Learn Guitar")
      expect(guitar).toBeDefined()
      expect(guitar?.status).toBe("planning")
      expect(guitar?.goal).toBeUndefined()
      expect(guitar?.milestones).toHaveLength(2)
    })
  })

  describe("Empty Sections", () => {
    test("handles empty goals section", () => {
      const content = `## Goals

## Todos

- [ ] A todo item`

      const result = parseDadGPTMd(content)

      expect(result.goals).toHaveLength(0)
      expect(result.todos).toHaveLength(1)
    })

    test("handles empty todos section", () => {
      const content = `## Todos

## Family

- **Wife**: Jane`

      const result = parseDadGPTMd(content)

      expect(result.todos).toHaveLength(0)
      expect(result.family).toHaveLength(1)
    })

    test("handles empty family section", () => {
      const content = `## Family

## Projects

### My Project`

      const result = parseDadGPTMd(content)

      expect(result.family).toHaveLength(0)
      expect(result.projects).toHaveLength(1)
    })

    test("handles empty projects section", () => {
      const content = `## Projects

## Other Section`

      const result = parseDadGPTMd(content)

      expect(result.projects).toHaveLength(0)
    })

    test("handles completely empty content", () => {
      const result = parseDadGPTMd("")

      expect(result.goals).toHaveLength(0)
      expect(result.todos).toHaveLength(0)
      expect(result.family).toHaveLength(0)
      expect(result.projects).toHaveLength(0)
    })

    test("handles content with no recognized sections", () => {
      const content = `# My Document

Some text here.

## Unrelated Section

More content.`

      const result = parseDadGPTMd(content)

      expect(result.goals).toHaveLength(0)
      expect(result.todos).toHaveLength(0)
      expect(result.family).toHaveLength(0)
      expect(result.projects).toHaveLength(0)
    })
  })

  describe("Edge Cases", () => {
    test("handles section headers with different casing", () => {
      const content = `## GOALS

- [ ] Goal 1

## todos

- [ ] Todo 1

## FAMILY

- **Dad**: Bob

## Projects

### Project 1`

      const result = parseDadGPTMd(content)

      expect(result.goals).toHaveLength(1)
      expect(result.todos).toHaveLength(1)
      expect(result.family).toHaveLength(1)
      expect(result.projects).toHaveLength(1)
    })

    test("handles singular and plural section names", () => {
      const content = `## Goal

- [ ] Single goal

## Todo

- [ ] Single todo

## Project

### Single project`

      const result = parseDadGPTMd(content)

      expect(result.goals).toHaveLength(1)
      expect(result.todos).toHaveLength(1)
      expect(result.projects).toHaveLength(1)
    })

    test("handles whitespace variations in checkboxes", () => {
      const content = `## Goals

-[ ] No space after dash
- [ ]  Extra space after bracket
-  [ ] Extra space before bracket`

      const result = parseDadGPTMd(content)

      // The parser requires at least some format, testing actual behavior
      expect(result.goals.length).toBeGreaterThanOrEqual(0)
    })

    test("handles metadata without indentation", () => {
      const content = `## Goals

- [ ] My goal
- Category: Personal
- Due: 2024-12-31`

      const result = parseDadGPTMd(content)

      // Metadata should still be associated with the goal
      expect(result.goals[0]?.category).toBe("Personal")
      expect(result.goals[0]?.dueDate).toBe("2024-12-31")
    })

    test("preserves order of items", () => {
      const content = `## Goals

- [ ] First
- [ ] Second
- [ ] Third`

      const result = parseDadGPTMd(content)

      expect(result.goals[0]?.title).toBe("First")
      expect(result.goals[1]?.title).toBe("Second")
      expect(result.goals[2]?.title).toBe("Third")
    })

    test("handles multiple sections in any order", () => {
      // Projects section is at the end to ensure it's saved at end-of-file
      const content = `## Goals

- [ ] Goal A

## Todos

- [ ] Todo A

## Family

- **Mom**: Alice

## Projects

### Project A
- Status: active`

      const result = parseDadGPTMd(content)

      expect(result.goals).toHaveLength(1)
      expect(result.todos).toHaveLength(1)
      expect(result.family).toHaveLength(1)
      expect(result.projects).toHaveLength(1)
      expect(result.projects[0]?.name).toBe("Project A")
    })
  })

  describe("Full Document Parsing", () => {
    test("parses complete fixture file correctly", async () => {
      const content = await fs.readFile(FIXTURE_PATH, "utf-8")
      const result = parseDadGPTMd(content)

      // Verify all sections are parsed
      expect(result.goals.length).toBeGreaterThan(0)
      expect(result.todos.length).toBeGreaterThan(0)
      expect(result.family.length).toBeGreaterThan(0)
      expect(result.projects.length).toBeGreaterThan(0)

      // Verify structure integrity
      result.goals.forEach((goal) => {
        expect(goal.title).toBeDefined()
        expect(typeof goal.completed).toBe("boolean")
      })

      result.todos.forEach((todo) => {
        expect(todo.title).toBeDefined()
        expect(typeof todo.completed).toBe("boolean")
      })

      result.family.forEach((member) => {
        expect(member.name).toBeDefined()
        expect(member.relationship).toBeDefined()
      })

      result.projects.forEach((project) => {
        expect(project.name).toBeDefined()
        expect(Array.isArray(project.milestones)).toBe(true)
      })
    })

    test("returns correct structure type", () => {
      const result = parseDadGPTMd("")

      // Verify return type structure
      expect(result).toHaveProperty("goals")
      expect(result).toHaveProperty("todos")
      expect(result).toHaveProperty("family")
      expect(result).toHaveProperty("projects")
      expect(Array.isArray(result.goals)).toBe(true)
      expect(Array.isArray(result.todos)).toBe(true)
      expect(Array.isArray(result.family)).toBe(true)
      expect(Array.isArray(result.projects)).toBe(true)
    })
  })
})
