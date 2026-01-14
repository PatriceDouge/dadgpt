import { describe, test, expect } from "vitest"
import {
  DADGPT_HOME,
  DATA_DIR,
  CONFIG_PATH,
  AUTH_PATH,
  getDataPath,
  getSessionPath,
} from "../../src/storage/paths"

describe("Storage Paths", () => {
  describe("Constants", () => {
    test("DADGPT_HOME is a string path", () => {
      expect(typeof DADGPT_HOME).toBe("string")
      expect(DADGPT_HOME.length).toBeGreaterThan(0)
    })

    test("DATA_DIR is a string path", () => {
      expect(typeof DATA_DIR).toBe("string")
      expect(DATA_DIR.length).toBeGreaterThan(0)
    })

    test("CONFIG_PATH ends with config.json", () => {
      expect(CONFIG_PATH.endsWith("config.json")).toBe(true)
    })

    test("AUTH_PATH ends with auth.json", () => {
      expect(AUTH_PATH.endsWith("auth.json")).toBe(true)
    })
  })

  describe("getDataPath()", () => {
    test("returns path with .json extension", () => {
      const result = getDataPath("goals", "goal_123")
      expect(result.endsWith("goal_123.json")).toBe(true)
      expect(result).toContain("goals")
    })

    test("handles single segment", () => {
      const result = getDataPath("config")
      expect(result.endsWith("config.json")).toBe(true)
    })

    test("handles multiple segments", () => {
      const result = getDataPath("sessions", "sess_123", "messages", "msg_1")
      expect(result.endsWith("msg_1.json")).toBe(true)
      expect(result).toContain("sessions")
      expect(result).toContain("sess_123")
      expect(result).toContain("messages")
    })
  })

  describe("getSessionPath()", () => {
    test("returns session directory path", () => {
      const result = getSessionPath("sess_123")
      expect(result.endsWith("sess_123")).toBe(true)
      expect(result).toContain("sessions")
    })

    test("does not add .json extension", () => {
      const result = getSessionPath("sess_456")
      expect(result.endsWith(".json")).toBe(false)
    })
  })
})
