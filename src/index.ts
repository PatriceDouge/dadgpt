// DadGPT - AI-powered personal command center
// Main entry point

import { runCli } from "./cli/index"
import { Log, formatError } from "./util/log"
import { DadGPTError } from "./util/errors"

/**
 * Handle unhandled promise rejections.
 * Logs the error and exits with code 1.
 */
process.on("unhandledRejection", (reason: unknown) => {
  Log.formatAndLogError("Unhandled promise rejection", reason)
  process.exit(1)
})

/**
 * Handle uncaught exceptions.
 * Logs the error and exits with code 1.
 */
process.on("uncaughtException", (err: Error) => {
  Log.formatAndLogError("Uncaught exception", err)
  process.exit(1)
})

/**
 * Handle SIGINT (Ctrl+C) gracefully.
 */
process.on("SIGINT", () => {
  // Clean exit on Ctrl+C
  process.exit(0)
})

/**
 * Handle SIGTERM gracefully.
 */
process.on("SIGTERM", () => {
  // Clean exit on termination signal
  process.exit(0)
})

// Run the CLI with proper error handling
runCli().catch((err: unknown) => {
  // Format error appropriately based on type
  const message = formatError(err)

  // Use error code if available
  const exitCode = err instanceof DadGPTError ? 1 : 1

  console.error(`\x1b[31mFatal error:\x1b[0m ${message}`)
  process.exit(exitCode)
})
