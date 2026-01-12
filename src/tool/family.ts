import { z } from "zod";
import { defineTool } from "./types.ts";
import { DadGPTParser, type FamilyMember, type ImportantDate } from "../parser/dadgpt-md.ts";
import { generateId } from "../util/id.ts";

export const familyTool = defineTool({
  name: "family",
  description: `Query and manage family information from dadgpt.md. Actions:
- list: List all family members
- birthdays: Show upcoming birthdays
- dates: Show important dates
- add_member: Add a family member
- add_date: Add an important date`,

  parameters: z.object({
    action: z.enum(["list", "birthdays", "dates", "add_member", "add_date"]),
    name: z.string().optional().describe("Name of family member"),
    relationship: z.string().optional().describe("Relationship (partner, child, parent, etc.)"),
    birthday: z.string().optional().describe("Birthday (Month Day format, e.g., 'March 15')"),
    age: z.number().optional().describe("Age"),
    title: z.string().optional().describe("Event title for important dates"),
    date: z.string().optional().describe("Date for important dates (Month Day format)"),
  }),

  async execute(args, _ctx) {
    if (!(await DadGPTParser.exists())) {
      return {
        title: "No Data",
        output: "No dadgpt.md file found. Run 'dadgpt init' to create one.",
        error: true,
      };
    }

    switch (args.action) {
      case "list":
        return await listFamily();
      case "birthdays":
        return await showBirthdays();
      case "dates":
        return await showDates();
      case "add_member":
        return await addMember(args);
      case "add_date":
        return await addDate(args);
      default:
        return {
          title: "Error",
          output: `Unknown action: ${args.action}`,
          error: true,
        };
    }
  },
});

async function listFamily() {
  const data = await DadGPTParser.parse();
  const members = data.family.members;

  if (members.length === 0) {
    return {
      title: "Family Members",
      output: "No family members found. Add some using the family tool.",
    };
  }

  const output = members
    .map((m) => {
      let line = `• ${m.name}`;
      if (m.relationship) line += ` (${m.relationship})`;
      if (m.age) line += `, age ${m.age}`;
      if (m.birthday) line += ` - Birthday: ${m.birthday}`;
      return line;
    })
    .join("\n");

  return {
    title: `Family Members (${members.length})`,
    output,
    metadata: { members },
  };
}

async function showBirthdays() {
  const data = await DadGPTParser.parse();
  const members = data.family.members.filter((m) => m.birthday);

  if (members.length === 0) {
    return {
      title: "Birthdays",
      output: "No birthdays recorded. Add family members with birthdays.",
    };
  }

  // Sort by upcoming birthday
  const today = new Date();
  const sortedMembers = members
    .map((m) => {
      const birthday = parseDateString(m.birthday!);
      if (!birthday) return { member: m, daysUntil: 999 };

      // Set birthday to current year
      birthday.setFullYear(today.getFullYear());
      if (birthday < today) {
        birthday.setFullYear(today.getFullYear() + 1);
      }

      const daysUntil = Math.ceil(
        (birthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { member: m, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const output = sortedMembers
    .map(({ member, daysUntil }) => {
      let line = `• ${member.name}: ${member.birthday}`;
      if (daysUntil === 0) {
        line += " 🎂 TODAY!";
      } else if (daysUntil === 1) {
        line += " (tomorrow!)";
      } else if (daysUntil <= 7) {
        line += ` (in ${daysUntil} days)`;
      } else if (daysUntil <= 30) {
        line += ` (in ${Math.floor(daysUntil / 7)} weeks)`;
      }
      return line;
    })
    .join("\n");

  return {
    title: "Upcoming Birthdays",
    output,
    metadata: { birthdays: sortedMembers },
  };
}

async function showDates() {
  const data = await DadGPTParser.parse();
  const dates = data.family.importantDates;

  if (dates.length === 0) {
    return {
      title: "Important Dates",
      output: "No important dates recorded. Add some using the family tool.",
    };
  }

  // Sort by upcoming date
  const today = new Date();
  const sortedDates = dates
    .map((d) => {
      const date = parseDateString(d.date);
      if (!date) return { date: d, daysUntil: 999 };

      date.setFullYear(today.getFullYear());
      if (date < today) {
        date.setFullYear(today.getFullYear() + 1);
      }

      const daysUntil = Math.ceil(
        (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { date: d, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const output = sortedDates
    .map(({ date, daysUntil }) => {
      let line = `• ${date.title}: ${date.date}`;
      if (daysUntil === 0) {
        line += " ⭐ TODAY!";
      } else if (daysUntil <= 7) {
        line += ` (in ${daysUntil} days)`;
      } else if (daysUntil <= 30) {
        line += ` (in ${Math.floor(daysUntil / 7)} weeks)`;
      }
      return line;
    })
    .join("\n");

  return {
    title: "Important Dates",
    output,
    metadata: { dates: sortedDates },
  };
}

async function addMember(args: {
  name?: string;
  relationship?: string;
  birthday?: string;
  age?: number;
}) {
  if (!args.name) {
    return {
      title: "Error",
      output: "Name is required to add a family member",
      error: true,
    };
  }

  const member: FamilyMember = {
    id: generateId(),
    name: args.name,
    relationship: args.relationship ?? "family",
    birthday: args.birthday,
    age: args.age,
  };

  // Add to dadgpt.md
  const content = await DadGPTParser.read();
  const lines = content.split("\n");

  // Find the Members section
  let insertIndex = -1;
  let inFamily = false;
  let inMembers = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "## Family") {
      inFamily = true;
    } else if (line.trim().startsWith("## ") && inFamily) {
      if (insertIndex === -1) insertIndex = i;
      break;
    } else if (inFamily && line.trim() === "### Members") {
      inMembers = true;
    } else if (inFamily && inMembers && line.trim().startsWith("### ")) {
      insertIndex = i;
      break;
    }
  }

  if (insertIndex === -1) {
    insertIndex = lines.length;
  }

  // Build member line
  let memberLine = `- **${member.name}**: ${member.relationship}`;
  if (member.age) memberLine += ` (${member.age})`;
  if (member.birthday) memberLine += ` - Birthday: ${member.birthday}`;

  lines.splice(insertIndex, 0, memberLine);
  await DadGPTParser.write(lines.join("\n"));

  return {
    title: "Family Member Added",
    output: `Added ${member.name} (${member.relationship})` +
      (member.birthday ? ` - Birthday: ${member.birthday}` : ""),
    metadata: { member },
  };
}

async function addDate(args: { title?: string; date?: string }) {
  if (!args.title || !args.date) {
    return {
      title: "Error",
      output: "Title and date are required to add an important date",
      error: true,
    };
  }

  const importantDate: ImportantDate = {
    id: generateId(),
    title: args.title,
    date: args.date,
  };

  // Add to dadgpt.md
  const content = await DadGPTParser.read();
  const lines = content.split("\n");

  // Find the Important Dates section
  let insertIndex = -1;
  let inFamily = false;
  let inDates = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "## Family") {
      inFamily = true;
    } else if (line.trim().startsWith("## ") && inFamily) {
      if (insertIndex === -1) insertIndex = i;
      break;
    } else if (inFamily && line.trim().toLowerCase().includes("important dates")) {
      inDates = true;
    } else if (inFamily && inDates && line.trim().startsWith("##")) {
      insertIndex = i;
      break;
    }
  }

  if (insertIndex === -1) {
    insertIndex = lines.length;
  }

  const dateLine = `- ${importantDate.title}: ${importantDate.date}`;
  lines.splice(insertIndex, 0, dateLine);
  await DadGPTParser.write(lines.join("\n"));

  return {
    title: "Important Date Added",
    output: `Added "${importantDate.title}" on ${importantDate.date}`,
    metadata: { date: importantDate },
  };
}

function parseDateString(dateStr: string): Date | null {
  // Try to parse various date formats
  // "March 15", "3-15", "03-15", "March 15, 2024"
  const months: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3,
    may: 4, june: 5, july: 6, august: 7,
    september: 8, october: 9, november: 10, december: 11,
  };

  // Try "Month Day" format
  const monthDayMatch = dateStr.match(/^(\w+)\s+(\d+)/i);
  if (monthDayMatch) {
    const monthName = monthDayMatch[1]?.toLowerCase();
    const day = parseInt(monthDayMatch[2] ?? "1", 10);
    if (monthName && months[monthName] !== undefined) {
      return new Date(2024, months[monthName], day);
    }
  }

  // Try "MM-DD" format
  const mmddMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})$/);
  if (mmddMatch) {
    const month = parseInt(mmddMatch[1] ?? "1", 10) - 1;
    const day = parseInt(mmddMatch[2] ?? "1", 10);
    return new Date(2024, month, day);
  }

  return null;
}
