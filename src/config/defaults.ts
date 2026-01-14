import type { Config } from "./schema"

/**
 * Default configuration values for DadGPT
 */
export const DEFAULT_CONFIG: Config = {
  providers: {},
  defaultProvider: "anthropic",
  defaultModel: "claude-sonnet-4-20250514",
  theme: "dark",
  permissions: {
    allow: ["read", "goal", "todo", "project", "family"],
    deny: [],
    ask: ["write", "bash"],
  },
  goalCategories: ["Health", "Family", "Work", "Personal", "Finance"],
  family: [],
}
