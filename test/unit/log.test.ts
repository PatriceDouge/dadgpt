import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import {
  Log,
  formatError,
  toError,
  isDebugMode,
  type LogLevel,
} from "../../src/util/log"
import { DadGPTError, ConfigError } from "../../src/util/errors"

describe("Log utility", () => {
  let originalLevel: LogLevel

  beforeEach(() => {
    originalLevel = Log.getLevel()
  })

  afterEach(() => {
    Log.init({ level: originalLevel })
    vi.restoreAllMocks()
  })

  describe("init()", () => {
    test("sets log level", () => {
      Log.init({ level: "DEBUG" })
      expect(Log.getLevel()).toBe("DEBUG")

      Log.init({ level: "WARN" })
      expect(Log.getLevel()).toBe("WARN")
    })
  })

  describe("getLevel()", () => {
    test("returns current log level", () => {
      Log.init({ level: "ERROR" })
      expect(Log.getLevel()).toBe("ERROR")
    })
  })

  describe("debug()", () => {
    test("logs when level is DEBUG", () => {
      Log.init({ level: "DEBUG" })
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {})

      Log.debug("test message", { data: 123 })

      expect(spy).toHaveBeenCalledWith("[DEBUG]", "test message", { data: 123 })
    })

    test("does not log when level is INFO", () => {
      Log.init({ level: "INFO" })
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {})

      Log.debug("test message")

      expect(spy).not.toHaveBeenCalled()
    })

    test("does not log when level is WARN", () => {
      Log.init({ level: "WARN" })
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {})

      Log.debug("test message")

      expect(spy).not.toHaveBeenCalled()
    })

    test("does not log when level is ERROR", () => {
      Log.init({ level: "ERROR" })
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {})

      Log.debug("test message")

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe("info()", () => {
    test("logs when level is DEBUG", () => {
      Log.init({ level: "DEBUG" })
      const spy = vi.spyOn(console, "info").mockImplementation(() => {})

      Log.info("test message")

      expect(spy).toHaveBeenCalledWith("[INFO]", "test message")
    })

    test("logs when level is INFO", () => {
      Log.init({ level: "INFO" })
      const spy = vi.spyOn(console, "info").mockImplementation(() => {})

      Log.info("test message")

      expect(spy).toHaveBeenCalledWith("[INFO]", "test message")
    })

    test("does not log when level is WARN", () => {
      Log.init({ level: "WARN" })
      const spy = vi.spyOn(console, "info").mockImplementation(() => {})

      Log.info("test message")

      expect(spy).not.toHaveBeenCalled()
    })

    test("does not log when level is ERROR", () => {
      Log.init({ level: "ERROR" })
      const spy = vi.spyOn(console, "info").mockImplementation(() => {})

      Log.info("test message")

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe("warn()", () => {
    test("always logs", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {})

      const levels: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR"]
      for (const level of levels) {
        spy.mockClear()
        Log.init({ level })
        Log.warn("test message")
        expect(spy).toHaveBeenCalledWith("[WARN]", "test message")
      }
    })
  })

  describe("error()", () => {
    test("always logs", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})

      const levels: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR"]
      for (const level of levels) {
        spy.mockClear()
        Log.init({ level })
        Log.error("test message")
        expect(spy).toHaveBeenCalledWith("[ERROR]", "test message")
      }
    })
  })

  describe("formatAndLogError()", () => {
    test("logs formatted error with prefix", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})

      Log.formatAndLogError("Test Prefix", new Error("Something went wrong"))

      expect(spy).toHaveBeenCalledWith(
        "[ERROR] Test Prefix: Something went wrong"
      )
    })
  })
})

describe("isDebugMode()", () => {
  let originalLevel: LogLevel

  beforeEach(() => {
    originalLevel = Log.getLevel()
  })

  afterEach(() => {
    Log.init({ level: originalLevel })
  })

  test("returns true when level is DEBUG", () => {
    Log.init({ level: "DEBUG" })
    expect(isDebugMode()).toBe(true)
  })

  test("returns false when level is not DEBUG", () => {
    Log.init({ level: "INFO" })
    expect(isDebugMode()).toBe(false)

    Log.init({ level: "WARN" })
    expect(isDebugMode()).toBe(false)

    Log.init({ level: "ERROR" })
    expect(isDebugMode()).toBe(false)
  })
})

describe("formatError()", () => {
  let originalLevel: LogLevel

  beforeEach(() => {
    originalLevel = Log.getLevel()
  })

  afterEach(() => {
    Log.init({ level: originalLevel })
  })

  test("formats DadGPTError with code", () => {
    Log.init({ level: "INFO" }) // Not debug mode
    const error = new ConfigError("Config not found", "CONFIG_NOT_FOUND")

    const formatted = formatError(error)

    expect(formatted).toBe("[CONFIG_NOT_FOUND] Config not found")
    expect(formatted).not.toContain("\n") // No stack trace
  })

  test("includes stack trace for DadGPTError in debug mode", () => {
    Log.init({ level: "DEBUG" })
    const error = new ConfigError("Config not found", "CONFIG_NOT_FOUND")

    const formatted = formatError(error)

    expect(formatted).toContain("[CONFIG_NOT_FOUND] Config not found")
    expect(formatted).toContain("\n") // Has stack trace
  })

  test("formats regular Error", () => {
    Log.init({ level: "INFO" }) // Not debug mode
    const error = new Error("Something went wrong")

    const formatted = formatError(error)

    expect(formatted).toBe("Something went wrong")
  })

  test("includes stack trace for Error in debug mode", () => {
    Log.init({ level: "DEBUG" })
    const error = new Error("Something went wrong")

    const formatted = formatError(error)

    expect(formatted).toContain("Something went wrong")
    expect(formatted).toContain("\n") // Has stack trace
  })

  test("converts non-error to string", () => {
    expect(formatError("string error")).toBe("string error")
    expect(formatError(42)).toBe("42")
    expect(formatError(null)).toBe("null")
    expect(formatError(undefined)).toBe("undefined")
  })
})

describe("toError()", () => {
  test("returns Error instance as-is", () => {
    const error = new Error("test")
    expect(toError(error)).toBe(error)
  })

  test("wraps DadGPTError as-is", () => {
    const error = new ConfigError("test", "TEST")
    expect(toError(error)).toBe(error)
  })

  test("converts string to Error", () => {
    const result = toError("string error")
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe("string error")
  })

  test("converts number to Error", () => {
    const result = toError(42)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe("42")
  })

  test("converts null to Error", () => {
    const result = toError(null)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe("null")
  })

  test("converts object to Error", () => {
    const result = toError({ foo: "bar" })
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe("[object Object]")
  })
})
