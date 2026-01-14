/**
 * Run command - Default command for DadGPT.
 *
 * Running 'dadgpt' or 'dadgpt [message..]' opens the interactive TUI.
 * Supports continuing an existing session or starting a new one.
 */

import type { CommandModule } from "yargs"
import { render } from "ink"
import React from "react"
import { App } from "../../tui/App"
import type { GlobalOptions } from "../index"

/**
 * Options specific to the run command.
 */
export interface RunOptions extends GlobalOptions {
  /** Continue the most recent session */
  continue?: boolean
  /** Continue a specific session by ID */
  session?: string
  /** Message to send (variadic positional argument) */
  message?: string[]
}

/**
 * Run command definition.
 * This is the default command ($0) that opens the interactive TUI.
 */
export const runCommand: CommandModule<GlobalOptions, RunOptions> = {
  command: "$0 [message..]",
  describe: "Start the interactive chat interface",

  builder: (yargs) =>
    yargs
      .positional("message", {
        type: "string",
        array: true,
        description: "Initial message to send",
      })
      .option("continue", {
        type: "boolean",
        alias: "c",
        description: "Continue the most recent session",
        default: false,
      })
      .option("session", {
        type: "string",
        alias: "s",
        description: "Continue a specific session by ID",
      }),

  handler: async (argv) => {
    // Combine message array into a single string if provided
    const initialMessage = argv.message?.length ? argv.message.join(" ") : undefined

    // Determine session ID to use
    let sessionId: string | undefined = argv.session

    // If --continue is specified without --session, we could load the most recent session
    // For now, we'll leave this as undefined and let useSession create a new session
    // TODO: Implement loading most recent session when --continue is specified

    // Render the Ink App
    const { waitUntilExit } = render(
      React.createElement(App, {
        initialMessage,
        sessionId,
      })
    )

    // Wait for the app to exit (Ctrl+C or Escape)
    await waitUntilExit()
  },
}
