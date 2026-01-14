import { z } from "zod"
import type { Tool, ToolContext, ToolResult } from "./types"
import { Config } from "../config/config"
import { Bus } from "../bus/bus"
import { createTimestampedId } from "../util/id"
import type { FamilyMember } from "../config/schema"

/**
 * Parameters schema for the family tool
 */
const FamilyToolParams = z.object({
  action: z.enum(["list", "add", "get", "update", "remove", "upcoming"]),
  // For add
  name: z.string().optional(),
  relationship: z.string().optional(),
  birthday: z.string().optional(),
  notes: z.string().optional(),
  // For get, update, remove
  id: z.string().optional(),
  // For upcoming
  days: z.number().optional(),
})

type FamilyToolArgs = z.infer<typeof FamilyToolParams>

/**
 * Parse a date string (MM-DD or YYYY-MM-DD) and get the month/day
 */
function parseBirthday(dateStr: string): { month: number; day: number } | null {
  // Try YYYY-MM-DD format
  const fullMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (fullMatch) {
    return {
      month: parseInt(fullMatch[2]!, 10),
      day: parseInt(fullMatch[3]!, 10),
    }
  }

  // Try MM-DD format
  const shortMatch = dateStr.match(/^(\d{2})-(\d{2})$/)
  if (shortMatch) {
    return {
      month: parseInt(shortMatch[1]!, 10),
      day: parseInt(shortMatch[2]!, 10),
    }
  }

  return null
}

/**
 * Calculate days until a birthday/anniversary from today
 */
function daysUntil(month: number, day: number): number {
  const today = new Date()
  const thisYear = today.getFullYear()

  // Create date for this year
  let nextOccurrence = new Date(thisYear, month - 1, day)

  // If already passed this year, use next year
  if (nextOccurrence < today) {
    nextOccurrence = new Date(thisYear + 1, month - 1, day)
  }

  // Calculate days difference
  const diffTime = nextOccurrence.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Execute the family tool actions
 */
async function executeFamilyTool(
  args: FamilyToolArgs,
  _ctx: ToolContext
): Promise<ToolResult> {
  switch (args.action) {
    case "list":
      return handleList()
    case "add":
      return handleAdd(args)
    case "get":
      return handleGet(args)
    case "update":
      return handleUpdate(args)
    case "remove":
      return handleRemove(args)
    case "upcoming":
      return handleUpcoming(args)
    default:
      return {
        title: "Error",
        output: `Unknown action: ${args.action}`,
      }
  }
}

/**
 * Handle list action - list all family members
 */
async function handleList(): Promise<ToolResult> {
  const config = await Config.get()
  const family = config.family

  if (family.length === 0) {
    return {
      title: "Family Members",
      output: "No family members found.",
      metadata: { count: 0 },
    }
  }

  const output = family
    .map((member) => {
      const birthdayInfo = member.birthday ? ` | Birthday: ${member.birthday}` : ""
      const notesInfo = member.notes ? ` | Notes: ${member.notes}` : ""
      return `- ${member.name} (${member.relationship})${birthdayInfo}${notesInfo}`
    })
    .join("\n")

  return {
    title: "Family Members",
    output,
    metadata: { count: family.length },
  }
}

/**
 * Handle add action - add a new family member
 */
async function handleAdd(args: FamilyToolArgs): Promise<ToolResult> {
  if (!args.name) {
    return {
      title: "Error",
      output: "Name is required to add a family member.",
    }
  }

  if (!args.relationship) {
    return {
      title: "Error",
      output: "Relationship is required to add a family member.",
    }
  }

  // Validate birthday format if provided
  if (args.birthday) {
    const parsed = parseBirthday(args.birthday)
    if (!parsed) {
      return {
        title: "Error",
        output: "Invalid birthday format. Use MM-DD or YYYY-MM-DD.",
      }
    }
  }

  const id = createTimestampedId("family")
  const newMember: FamilyMember = {
    id,
    name: args.name,
    relationship: args.relationship,
    birthday: args.birthday,
    notes: args.notes,
  }

  // Get current config and add new member
  const config = await Config.get()
  const updatedFamily = [...config.family, newMember]

  // Save to config
  await Config.save({ family: updatedFamily })
  Bus.publish("family.added", { memberId: id })

  return {
    title: "Family Member Added",
    output: `Added ${args.name} (${args.relationship}) to family${args.birthday ? ` with birthday ${args.birthday}` : ""}.`,
    metadata: { memberId: id },
  }
}

/**
 * Handle get action - get a family member by ID
 */
async function handleGet(args: FamilyToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to get a family member.",
    }
  }

  const config = await Config.get()
  const member = config.family.find((m) => m.id === args.id)

  if (!member) {
    return {
      title: "Error",
      output: `Family member not found: ${args.id}`,
    }
  }

  const output = `
Name: ${member.name}
Relationship: ${member.relationship}
Birthday: ${member.birthday || "(none)"}
Notes: ${member.notes || "(none)"}
`.trim()

  return {
    title: `Family Member: ${member.name}`,
    output,
    metadata: { member },
  }
}

/**
 * Handle update action - update a family member
 */
async function handleUpdate(args: FamilyToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to update a family member.",
    }
  }

  const config = await Config.get()
  const memberIndex = config.family.findIndex((m) => m.id === args.id)

  if (memberIndex === -1) {
    return {
      title: "Error",
      output: `Family member not found: ${args.id}`,
    }
  }

  const member = config.family[memberIndex]!
  const changes: Record<string, unknown> = {}

  if (args.name !== undefined) {
    member.name = args.name
    changes.name = args.name
  }

  if (args.relationship !== undefined) {
    member.relationship = args.relationship
    changes.relationship = args.relationship
  }

  if (args.birthday !== undefined) {
    // Validate birthday format
    if (args.birthday !== "") {
      const parsed = parseBirthday(args.birthday)
      if (!parsed) {
        return {
          title: "Error",
          output: "Invalid birthday format. Use MM-DD or YYYY-MM-DD.",
        }
      }
    }
    member.birthday = args.birthday || undefined
    changes.birthday = args.birthday
  }

  if (args.notes !== undefined) {
    member.notes = args.notes || undefined
    changes.notes = args.notes
  }

  if (Object.keys(changes).length === 0) {
    return {
      title: "No Changes",
      output: "No fields were specified to update.",
    }
  }

  // Save updated config
  const updatedFamily = [...config.family]
  updatedFamily[memberIndex] = member
  await Config.save({ family: updatedFamily })
  Bus.publish("family.updated", { memberId: args.id, changes })

  return {
    title: "Family Member Updated",
    output: `Updated ${member.name}: ${Object.keys(changes).join(", ")}`,
    metadata: { memberId: args.id, changes },
  }
}

/**
 * Handle remove action - remove a family member
 */
async function handleRemove(args: FamilyToolArgs): Promise<ToolResult> {
  if (!args.id) {
    return {
      title: "Error",
      output: "ID is required to remove a family member.",
    }
  }

  const config = await Config.get()
  const member = config.family.find((m) => m.id === args.id)

  if (!member) {
    return {
      title: "Error",
      output: `Family member not found: ${args.id}`,
    }
  }

  const updatedFamily = config.family.filter((m) => m.id !== args.id)
  await Config.save({ family: updatedFamily })
  Bus.publish("family.removed", { memberId: args.id })

  return {
    title: "Family Member Removed",
    output: `Removed ${member.name} (${member.relationship}) from family.`,
    metadata: { memberId: args.id },
  }
}

/**
 * Handle upcoming action - list upcoming birthdays/anniversaries
 */
async function handleUpcoming(args: FamilyToolArgs): Promise<ToolResult> {
  const config = await Config.get()
  const family = config.family

  // Default to 30 days if not specified
  const daysLimit = args.days ?? 30

  // Filter members with birthdays and calculate days until
  const upcoming: Array<{
    member: FamilyMember
    daysUntilBirthday: number
  }> = []

  for (const member of family) {
    if (member.birthday) {
      const parsed = parseBirthday(member.birthday)
      if (parsed) {
        const days = daysUntil(parsed.month, parsed.day)
        if (days <= daysLimit) {
          upcoming.push({
            member,
            daysUntilBirthday: days,
          })
        }
      }
    }
  }

  if (upcoming.length === 0) {
    return {
      title: "Upcoming Birthdays",
      output: `No birthdays in the next ${daysLimit} days.`,
      metadata: { count: 0 },
    }
  }

  // Sort by days until birthday
  upcoming.sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday)

  const output = upcoming
    .map((item) => {
      const daysText =
        item.daysUntilBirthday === 0
          ? "TODAY!"
          : item.daysUntilBirthday === 1
            ? "Tomorrow"
            : `in ${item.daysUntilBirthday} days`
      return `- ${item.member.name} (${item.member.relationship}): ${item.member.birthday} - ${daysText}`
    })
    .join("\n")

  return {
    title: "Upcoming Birthdays",
    output,
    metadata: { count: upcoming.length },
  }
}

/**
 * Family Tool - Manages family member information
 */
export const FamilyTool: Tool<typeof FamilyToolParams> = {
  id: "family",
  description: `Manage family member information. Actions:
- list: List all family members
- add: Add a new family member (required: name, relationship; optional: birthday (MM-DD or YYYY-MM-DD), notes)
- get: Get family member details by ID
- update: Update family member fields (name, relationship, birthday, notes)
- remove: Remove a family member by ID
- upcoming: List upcoming birthdays/anniversaries (optional: days - defaults to 30)`,
  parameters: FamilyToolParams,
  execute: executeFamilyTool,
}
