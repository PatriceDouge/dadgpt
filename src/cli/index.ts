import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { runCommand } from "./commands/run.ts";
import { initCommand } from "./commands/init.ts";
import { authCommand } from "./commands/auth.ts";
import { syncCommand } from "./commands/sync.ts";
import { goalsCommand } from "./commands/goals.ts";
import { todosCommand } from "./commands/todos.ts";
import * as reviewCommand from "./commands/review.ts";
import { Log } from "../util/log.ts";

export async function main(): Promise<void> {
  await yargs(hideBin(process.argv))
    .scriptName("dadgpt")
    .usage("$0 [message..] - Chat with your personal AI assistant")

    // Commands
    .command(runCommand)
    .command(initCommand)
    .command(authCommand)
    .command(syncCommand)
    .command(goalsCommand)
    .command(todosCommand)
    .command(reviewCommand)

    // Global options
    .option("debug", {
      type: "boolean",
      alias: "d",
      global: true,
      describe: "Enable debug output",
    })

    // Middleware
    .middleware((args) => {
      // Initialize logging
      Log.init({ level: args.debug ? "DEBUG" : "INFO" });

      // Set environment flag
      process.env.DADGPT = "1";
    })

    // Help and version
    .help()
    .alias("help", "h")
    .version()
    .alias("version", "v")

    // Error handling
    .fail((msg, err, yargs) => {
      if (err) {
        console.error("Error:", err.message);
        if (process.env.DADGPT_DEBUG === "1") {
          console.error(err.stack);
        }
      } else if (msg) {
        console.error(msg);
        console.log();
        yargs.showHelp();
      }
      process.exit(1);
    })

    // Examples
    .example([
      ["$0 \"what are my goals?\"", "Ask about your goals"],
      ["$0", "Start interactive mode"],
      ["$0 --continue", "Continue last session"],
      ["$0 init", "Create dadgpt.md"],
      ["$0 auth", "Configure API keys"],
      ["$0 goals", "List your goals"],
      ["$0 todos", "List your todos"],
      ["$0 sync", "Sync Gmail and Calendar"],
      ["$0 review", "Get suggestions and insights"],
    ])

    // Strict mode
    .strict()

    // Parse
    .parse();
}
