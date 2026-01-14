import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        // Entry point - tested via integration tests
        "src/index.ts",
        // CLI commands - tested via integration tests (child process coverage not tracked)
        "src/cli/**/*.ts",
        // TUI components - React components that need special test setup
        "src/tui/**/*.ts",
        "src/tui/**/*.tsx",
      ],
    },
  },
})
