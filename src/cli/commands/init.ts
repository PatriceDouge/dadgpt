/**
 * Init command - Initialize DadGPT in the current project.
 *
 * Creates a dadgpt.md file with template content and ensures
 * the ~/.dadgpt directory exists.
 */

import type { CommandModule } from "yargs"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { DADGPT_HOME } from "../../storage/paths"
import { Log } from "../../util/log"
import type { GlobalOptions } from "../index"

/**
 * Options specific to the init command.
 */
export interface InitOptions extends GlobalOptions {
  /** Template type to use */
  template: "default" | "minimal"
  /** Force overwrite if file exists */
  force: boolean
}

/**
 * Default template content for dadgpt.md
 */
const DEFAULT_TEMPLATE = `# DadGPT Configuration

Welcome to DadGPT! This file helps you organize your goals, todos, and family information.

## Goals

Track your long-term objectives here:

- [ ] Example: Read 12 books this year
  - Category: Personal
  - Due: 2024-12-31

## Todos

Your daily and weekly tasks:

- [ ] Example: Review weekly schedule
  - Priority: high
  - Tags: planning, weekly

## Family

Important information about your family:

### Family Members

- **Partner**: [Name]
  - Birthday: MM-DD
  - Notes:

- **Child**: [Name]
  - Birthday: MM-DD
  - Notes:

## Projects

Track multi-step projects:

### Example Project
- Status: planning
- Goal: Personal development
- Milestones:
  - [ ] Research phase
  - [ ] Implementation
  - [ ] Review

---

Edit this file to customize your DadGPT experience!
For more information, run \`dadgpt --help\`.
`

/**
 * Minimal template content for dadgpt.md
 */
const MINIMAL_TEMPLATE = `# DadGPT Configuration

## Goals

## Todos

## Family

## Projects
`

/**
 * Get template content based on template type.
 */
function getTemplateContent(template: "default" | "minimal"): string {
  return template === "minimal" ? MINIMAL_TEMPLATE : DEFAULT_TEMPLATE
}

/**
 * Init command definition.
 */
export const initCommand: CommandModule<GlobalOptions, InitOptions> = {
  command: "init",
  describe: "Initialize DadGPT in the current directory",

  builder: (yargs) =>
    yargs
      .option("template", {
        type: "string",
        alias: "t",
        description: "Template to use (default or minimal)",
        choices: ["default", "minimal"] as const,
        default: "default" as const,
      })
      .option("force", {
        type: "boolean",
        alias: "f",
        description: "Overwrite existing dadgpt.md file",
        default: false,
      }),

  handler: async (argv) => {
    const targetPath = path.join(process.cwd(), "dadgpt.md")
    const templateContent = getTemplateContent(argv.template)

    // Check if file already exists
    try {
      await fs.access(targetPath)
      // File exists
      if (!argv.force) {
        console.log("\x1b[33m⚠\x1b[0m  dadgpt.md already exists.")
        console.log("   Use --force to overwrite the existing file.")
        return
      }
      Log.debug("Overwriting existing dadgpt.md with --force")
    } catch {
      // File doesn't exist, proceed with creation
      Log.debug("dadgpt.md does not exist, creating new file")
    }

    // Ensure ~/.dadgpt directory exists
    try {
      await fs.mkdir(DADGPT_HOME, { recursive: true })
      Log.debug(`Ensured ${DADGPT_HOME} directory exists`)
    } catch (error) {
      Log.error("Failed to create .dadgpt directory:", error)
      console.log("\x1b[31m✗\x1b[0m  Failed to create ~/.dadgpt directory")
      return
    }

    // Write the template file
    try {
      await fs.writeFile(targetPath, templateContent, "utf-8")
      Log.debug(`Created dadgpt.md with ${argv.template} template`)
    } catch (error) {
      Log.error("Failed to create dadgpt.md:", error)
      console.log("\x1b[31m✗\x1b[0m  Failed to create dadgpt.md")
      return
    }

    // Show success message and next steps
    console.log("\x1b[32m✓\x1b[0m  Created dadgpt.md")
    console.log("")
    console.log("\x1b[1mNext steps:\x1b[0m")
    console.log("  1. Edit dadgpt.md to add your goals, todos, and family info")
    console.log("  2. Run \x1b[36mdadgpt auth\x1b[0m to configure your API keys")
    console.log("  3. Run \x1b[36mdadgpt\x1b[0m to start chatting!")
    console.log("")
    console.log("\x1b[90mFor more information, run dadgpt --help\x1b[0m")
  },
}
