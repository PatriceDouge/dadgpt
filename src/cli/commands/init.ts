import type { CommandModule } from "yargs";
import { DadGPTParser } from "../../parser/dadgpt-md.ts";
import { Storage } from "../../storage/storage.ts";
import { UI } from "../ui.ts";

interface InitArgs {
  template?: string;
  force?: boolean;
}

export const initCommand: CommandModule<object, InitArgs> = {
  command: "init",
  describe: "Initialize DadGPT in the current directory",
  builder: (yargs) =>
    yargs
      .option("template", {
        type: "string",
        choices: ["default", "minimal", "family"],
        default: "default",
        describe: "Template to use for dadgpt.md",
      })
      .option("force", {
        type: "boolean",
        default: false,
        describe: "Overwrite existing dadgpt.md",
      }),

  handler: async (args) => {
    UI.header("DadGPT Initialization");

    // Check if already exists
    if (await DadGPTParser.exists()) {
      if (!args.force) {
        UI.warn("dadgpt.md already exists. Use --force to overwrite.");
        return;
      }
      UI.info("Overwriting existing dadgpt.md...");
    }

    // Ensure storage directories exist
    await Storage.init();

    // Get template content
    const template = getTemplate(args.template ?? "default");

    // Create the file
    await DadGPTParser.create(undefined, template);

    UI.success("Created dadgpt.md");
    UI.println();
    UI.info("Next steps:");
    UI.println("  1. Edit dadgpt.md to add your goals and todos");
    UI.println("  2. Run 'dadgpt auth' to set up your API key");
    UI.println("  3. Start chatting with 'dadgpt \"your message\"'");
    UI.println();
  },
};

function getTemplate(templateName: string): string {
  switch (templateName) {
    case "minimal":
      return MINIMAL_TEMPLATE;
    case "family":
      return FAMILY_TEMPLATE;
    default:
      return DEFAULT_TEMPLATE;
  }
}

const DEFAULT_TEMPLATE = `# DadGPT - Personal Command Center

## Goals

### Health
- [ ] Establish consistent exercise routine
  - State: not_started
  - Progress: 0%

### Family
<!-- Add family goals here -->

### Work
<!-- Add work goals here -->

### Personal
<!-- Add personal goals here -->

### Finance
<!-- Add finance goals here -->

## Todos

### Today
<!-- Add today's tasks here -->

### This Week
<!-- Add this week's tasks here -->

### Someday
<!-- Add future tasks here -->

## Family

### Members
<!-- Add family members here -->
<!-- Format: - **Name**: Relationship - Birthday: Month Day -->

### Important Dates
<!-- Add important dates here -->
<!-- Format: - Event Name: Month Day -->

## Projects
<!-- Add projects here -->

## Notes

<!-- Quick thoughts and reminders -->
`;

const MINIMAL_TEMPLATE = `# DadGPT

## Goals

### Personal
<!-- Add goals here -->

## Todos

### Today
<!-- Add today's tasks -->

### Later
<!-- Add future tasks -->

## Notes

<!-- Quick notes -->
`;

const FAMILY_TEMPLATE = `# DadGPT - Family Command Center

## Goals

### Health
- [ ] Family walks after dinner
  - State: not_started
  - Progress: 0%

### Family
- [ ] Weekly family game night
  - State: not_started
  - Progress: 0%

- [ ] Monthly date night with partner
  - State: not_started
  - Progress: 0%

### Kids
<!-- Add goals related to kids here -->

## Todos

### Today
<!-- Today's family tasks -->

### This Week
- [ ] Plan weekend activity
- [ ] Review kids' school updates

### Someday
<!-- Future family projects -->

## Family

### Members
- **Partner**: Spouse
- **Child 1**: Son/Daughter - Birthday: Month Day
- **Child 2**: Son/Daughter - Birthday: Month Day

### Important Dates
- Wedding Anniversary: Month Day
- Partner's Birthday: Month Day

### Schedules
<!-- Regular family schedules -->
<!-- - Soccer practice: Tuesdays 4pm -->
<!-- - Piano lessons: Wednesdays 5pm -->

## Projects

### Family Vacation
- Status: planning
- Next: Research destinations

## Notes

<!-- Family reminders and notes -->
`;
