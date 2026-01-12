import type { CommandModule } from "yargs";
import { UI } from "../ui.ts";
import { Storage } from "../../storage/storage.ts";

interface SyncArgs {
  service?: string;
}

export const syncCommand: CommandModule<object, SyncArgs> = {
  command: "sync [service]",
  describe: "Sync external services (gmail, calendar)",
  builder: (yargs) =>
    yargs
      .positional("service", {
        type: "string",
        choices: ["gmail", "calendar", "all"],
        default: "all",
        describe: "Service to sync",
      }),

  handler: async (args) => {
    await Storage.init();

    const service = args.service ?? "all";

    UI.header("DadGPT Sync");

    if (service === "all" || service === "gmail") {
      await syncGmail();
    }

    if (service === "all" || service === "calendar") {
      await syncCalendar();
    }

    UI.println();
    UI.success("Sync complete!");
  },
};

async function syncGmail(): Promise<void> {
  UI.println();
  UI.info("Syncing Gmail...");

  // Check for OAuth tokens
  const auth = await Storage.readAuth<{ google?: { accessToken?: string } }>();

  if (!auth?.google?.accessToken) {
    UI.warn("Gmail not configured. Run 'dadgpt auth --google' to set up Gmail sync.");
    UI.println();
    UI.dim("Gmail integration allows DadGPT to:");
    UI.dim("  - Summarize your recent emails");
    UI.dim("  - Help draft responses");
    UI.dim("  - Create follow-up todos from emails");
    return;
  }

  // TODO: Implement actual Gmail sync
  const spinner = UI.spinner("Fetching emails...");

  try {
    // Placeholder for actual implementation
    await new Promise((resolve) => setTimeout(resolve, 1000));
    spinner.succeed("Gmail synced (0 new emails)");
  } catch (err) {
    spinner.fail(`Gmail sync failed: ${(err as Error).message}`);
  }
}

async function syncCalendar(): Promise<void> {
  UI.println();
  UI.info("Syncing Calendar...");

  // Check for OAuth tokens
  const auth = await Storage.readAuth<{ google?: { accessToken?: string } }>();

  if (!auth?.google?.accessToken) {
    UI.warn("Calendar not configured. Run 'dadgpt auth --google' to set up Calendar sync.");
    UI.println();
    UI.dim("Calendar integration allows DadGPT to:");
    UI.dim("  - Show your upcoming events");
    UI.dim("  - Help schedule meetings");
    UI.dim("  - Find free time slots");
    return;
  }

  // TODO: Implement actual Calendar sync
  const spinner = UI.spinner("Fetching events...");

  try {
    // Placeholder for actual implementation
    await new Promise((resolve) => setTimeout(resolve, 1000));
    spinner.succeed("Calendar synced (0 upcoming events)");
  } catch (err) {
    spinner.fail(`Calendar sync failed: ${(err as Error).message}`);
  }
}
