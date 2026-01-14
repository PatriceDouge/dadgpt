/**
 * Logging utility with configurable log levels.
 */

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR"

let currentLevel: LogLevel = "INFO"

export namespace Log {
  /**
   * Initialize the logger with a specific log level.
   */
  export function init(opts: { level: LogLevel }): void {
    currentLevel = opts.level
  }

  /**
   * Log a debug message. Only logs when level is DEBUG.
   */
  export function debug(...args: unknown[]): void {
    if (currentLevel === "DEBUG") {
      console.debug("[DEBUG]", ...args)
    }
  }

  /**
   * Log an info message. Logs when level is DEBUG or INFO.
   */
  export function info(...args: unknown[]): void {
    if (currentLevel === "DEBUG" || currentLevel === "INFO") {
      console.info("[INFO]", ...args)
    }
  }

  /**
   * Log a warning message. Always logs.
   */
  export function warn(...args: unknown[]): void {
    console.warn("[WARN]", ...args)
  }

  /**
   * Log an error message. Always logs.
   */
  export function error(...args: unknown[]): void {
    console.error("[ERROR]", ...args)
  }
}
