/**
 * Logging utility with configurable log levels.
 */

import { DadGPTError } from "./errors"

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR"

let currentLevel: LogLevel = "INFO"

/**
 * Check if debug mode is enabled
 */
export function isDebugMode(): boolean {
  return currentLevel === "DEBUG"
}

/**
 * Format an error for display.
 * Shows stack traces only in debug mode.
 */
export function formatError(err: unknown): string {
  if (err instanceof DadGPTError) {
    const base = `[${err.code}] ${err.message}`
    if (isDebugMode() && err.stack) {
      return `${base}\n${err.stack}`
    }
    return base
  }

  if (err instanceof Error) {
    if (isDebugMode() && err.stack) {
      return err.stack
    }
    return err.message
  }

  return String(err)
}

/**
 * Convert an unknown error to an Error instance
 */
export function toError(err: unknown): Error {
  if (err instanceof Error) return err
  return new Error(String(err))
}

export namespace Log {
  /**
   * Initialize the logger with a specific log level.
   */
  export function init(opts: { level: LogLevel }): void {
    currentLevel = opts.level
  }

  /**
   * Get the current log level
   */
  export function getLevel(): LogLevel {
    return currentLevel
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

  /**
   * Log a formatted error with appropriate detail level.
   * Shows stack traces only in debug mode.
   */
  export function formatAndLogError(prefix: string, err: unknown): void {
    console.error(`[ERROR] ${prefix}: ${formatError(err)}`)
  }
}
