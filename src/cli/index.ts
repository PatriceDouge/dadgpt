/**
 * CLI entry point using Yargs.
 *
 * This module sets up the main CLI interface for DadGPT with:
 * - Global options: --debug, --model, --provider
 * - Middleware for logging initialization
 * - Command registration for all subcommands
 */

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { Log, type LogLevel } from "../util/log"
import { runCommand } from "./commands/run"

/**
 * Global CLI options available to all commands.
 */
export interface GlobalOptions {
  /** Enable debug logging */
  debug: boolean
  /** Override the default model */
  model?: string
  /** Override the default provider */
  provider?: string
}

/**
 * Build and configure the CLI.
 * Returns the configured yargs instance.
 */
export function buildCli() {
  return (
    yargs(hideBin(process.argv))
      .scriptName("dadgpt")
      .usage("$0 [command] [options]")

      // Global options
      .option("debug", {
        type: "boolean",
        description: "Enable debug logging",
        default: false,
        global: true,
      })
      .option("model", {
        type: "string",
        alias: "m",
        description: "Override the default model",
        global: true,
      })
      .option("provider", {
        type: "string",
        alias: "p",
        description: "Override the default provider",
        global: true,
      })

      // Middleware to initialize logging
      .middleware((argv) => {
        const level: LogLevel = argv.debug ? "DEBUG" : "INFO"
        Log.init({ level })
        Log.debug("Debug logging enabled")
        Log.debug("CLI args:", argv)
      })

      // Help configuration
      .help("help")
      .alias("help", "h")
      .version("0.1.0")
      .alias("version", "v")

      // Register commands
      .command(runCommand)

      // Strict mode - fail on unknown commands/options
      .strict()

      // Show help when no command is provided
      .demandCommand(0)

      // Epilog
      .epilog("Run 'dadgpt <command> --help' for more information on a command.")
  )
}

/**
 * Run the CLI.
 * Parses arguments and executes the appropriate command.
 */
export async function runCli(): Promise<void> {
  await buildCli().parseAsync()
}
