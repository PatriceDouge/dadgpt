import type { CommandModule } from "yargs";
import { Configuration } from "../../config/config.ts";
import { Storage } from "../../storage/storage.ts";
import { Provider, type ProviderID, PROVIDERS } from "../../provider/provider.ts";
import { UI } from "../ui.ts";

interface AuthArgs {
  provider?: string;
  key?: string;
  list?: boolean;
}

export const authCommand: CommandModule<object, AuthArgs> = {
  command: "auth",
  describe: "Configure API keys for LLM providers",
  builder: (yargs) =>
    yargs
      .option("provider", {
        type: "string",
        alias: "p",
        describe: "Provider to configure (openai, anthropic)",
      })
      .option("key", {
        type: "string",
        alias: "k",
        describe: "API key to set",
      })
      .option("list", {
        type: "boolean",
        alias: "l",
        describe: "List configured providers",
      }),

  handler: async (args) => {
    await Storage.init();

    if (args.list) {
      await listProviders();
      return;
    }

    if (args.provider && args.key) {
      // Direct key set
      await setApiKey(args.provider, args.key);
      return;
    }

    // Interactive mode
    await interactiveAuth(args.provider);
  },
};

async function listProviders(): Promise<void> {
  UI.header("Configured Providers");

  for (const provider of Provider.listProviders()) {
    const key = await Configuration.getApiKey(provider.id);
    const status = key ? "✓ Configured" : "○ Not configured";
    const statusColor = key ? "green" : "dim";

    UI.println(`  ${provider.name}: ${status}`);

    if (key) {
      // Show masked key
      const masked = key.slice(0, 7) + "..." + key.slice(-4);
      UI.dim(`    Key: ${masked}`);
    }
  }

  UI.println();
}

async function setApiKey(providerName: string, key: string): Promise<void> {
  if (!Provider.isValidProvider(providerName)) {
    UI.error(`Unknown provider: ${providerName}`);
    UI.println(`Available providers: ${Object.keys(PROVIDERS).join(", ")}`);
    return;
  }

  // Validate key format (basic check)
  if (key.length < 10) {
    UI.error("API key seems too short. Please check and try again.");
    return;
  }

  // Save to auth file
  const auth = await Configuration.loadAuth();
  await Configuration.saveAuth({
    ...auth,
    providers: {
      ...auth.providers,
      [providerName]: { apiKey: key },
    },
  });

  UI.success(`API key saved for ${providerName}`);

  // Verify the key works
  UI.info("Verifying API key...");
  try {
    const { model } = await Provider.getModel(providerName);
    UI.success(`Key verified! Ready to use ${providerName}.`);
  } catch (err) {
    UI.warn("Key saved but verification failed. It may still work.");
    UI.dim(`Error: ${(err as Error).message}`);
  }
}

async function interactiveAuth(preselectedProvider?: string): Promise<void> {
  UI.header("API Key Configuration");

  let providerName = preselectedProvider;

  if (!providerName) {
    // Ask which provider to configure
    const providers = Provider.listProviders();
    const choice = await UI.select(
      "Which provider do you want to configure?",
      providers.map((p) => p.name)
    );

    if (choice < 0) return;

    providerName = providers[choice]?.id;
  }

  if (!providerName || !Provider.isValidProvider(providerName)) {
    UI.error("Invalid provider selection");
    return;
  }

  const providerInfo = PROVIDERS[providerName as ProviderID];

  UI.println();
  UI.info(`Configuring ${providerInfo.name}`);
  UI.println();

  // Show instructions based on provider
  switch (providerName) {
    case "openai":
      UI.println("Get your API key from: https://platform.openai.com/api-keys");
      break;
    case "anthropic":
      UI.println("Get your API key from: https://console.anthropic.com/settings/keys");
      break;
  }

  UI.println();

  // Get the key
  const key = await UI.prompt("Enter your API key: ");

  if (!key.trim()) {
    UI.warn("No key provided. Cancelled.");
    return;
  }

  await setApiKey(providerName, key.trim());
}
