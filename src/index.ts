// DadGPT - AI-powered personal command center
// Main entry point

import { runCli } from "./cli/index"

// Run the CLI
runCli().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
