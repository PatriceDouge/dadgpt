import { describe, test, expect, beforeEach } from "vitest"
import { Agents, type Agent } from "../../src/agent/agent"
import type { Tool } from "../../src/tool/types"
import { z } from "zod"

describe("Agents namespace", () => {
  beforeEach(() => {
    Agents.clear()
  })

  const mockAgent: Agent = {
    id: "test-agent",
    name: "Test Agent",
    description: "A test agent",
    systemPrompt: "You are a test assistant.",
    toolIds: ["tool1", "tool2"],
  }

  describe("register()", () => {
    test("registers an agent", () => {
      Agents.register(mockAgent)
      expect(Agents.get("test-agent")).toBeDefined()
    })

    test("overwrites existing agent with same id", () => {
      Agents.register(mockAgent)
      const updatedAgent = { ...mockAgent, name: "Updated Agent" }
      Agents.register(updatedAgent)
      expect(Agents.get("test-agent")?.name).toBe("Updated Agent")
    })
  })

  describe("get()", () => {
    test("returns agent by ID", () => {
      Agents.register(mockAgent)
      const agent = Agents.get("test-agent")
      expect(agent).toEqual(mockAgent)
    })

    test("returns undefined for unknown ID", () => {
      const agent = Agents.get("unknown")
      expect(agent).toBeUndefined()
    })
  })

  describe("getAll()", () => {
    test("returns empty array when no agents", () => {
      const agents = Agents.getAll()
      expect(agents).toEqual([])
    })

    test("returns all registered agents", () => {
      Agents.register(mockAgent)
      Agents.register({ ...mockAgent, id: "agent2" })
      const agents = Agents.getAll()
      expect(agents).toHaveLength(2)
    })
  })

  describe("getTools()", () => {
    const mockTool1: Tool = {
      id: "tool1",
      description: "Tool 1",
      parameters: z.object({}),
      execute: async () => ({ title: "Done", output: "" }),
    }

    const mockTool2: Tool = {
      id: "tool2",
      description: "Tool 2",
      parameters: z.object({}),
      execute: async () => ({ title: "Done", output: "" }),
    }

    const mockTool3: Tool = {
      id: "tool3",
      description: "Tool 3",
      parameters: z.object({}),
      execute: async () => ({ title: "Done", output: "" }),
    }

    test("returns tools matching agent toolIds", () => {
      const allTools = [mockTool1, mockTool2, mockTool3]
      const agentTools = Agents.getTools(mockAgent, allTools)

      expect(agentTools).toHaveLength(2)
      expect(agentTools.map((t) => t.id)).toContain("tool1")
      expect(agentTools.map((t) => t.id)).toContain("tool2")
      expect(agentTools.map((t) => t.id)).not.toContain("tool3")
    })

    test("returns empty array when no tools match", () => {
      const agentWithNoTools = { ...mockAgent, toolIds: [] }
      const agentTools = Agents.getTools(agentWithNoTools, [mockTool1])
      expect(agentTools).toEqual([])
    })
  })

  describe("clear()", () => {
    test("removes all registered agents", () => {
      Agents.register(mockAgent)
      Agents.register({ ...mockAgent, id: "agent2" })
      expect(Agents.getAll()).toHaveLength(2)

      Agents.clear()
      expect(Agents.getAll()).toHaveLength(0)
    })
  })
})
