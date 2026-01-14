import { z } from "zod"

/**
 * Configuration schemas for DadGPT
 */

export const ProviderConfigSchema = z.object({
  id: z.string(),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
})

export const ModelConfigSchema = z.object({
  provider: z.string(),
  model: z.string(),
  temperature: z.number().default(0),
  maxTokens: z.number().default(4096),
})

export const PermissionRulesetSchema = z.object({
  allow: z.array(z.string()).default([]),
  deny: z.array(z.string()).default([]),
  ask: z.array(z.string()).default(["*"]),
})

export const FamilyMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  relationship: z.string(),
  birthday: z.string().optional(),
  notes: z.string().optional(),
})

export const ConfigSchema = z.object({
  // Provider settings
  providers: z.record(ProviderConfigSchema).default({}),
  defaultProvider: z.string().default("anthropic"),
  defaultModel: z.string().default("claude-sonnet-4-20250514"),

  // UI settings
  theme: z.enum(["dark", "light"]).default("dark"),

  // Permission settings
  permissions: PermissionRulesetSchema.default({}),

  // Goal categories
  goalCategories: z.array(z.string()).default([
    "Health",
    "Family",
    "Work",
    "Personal",
    "Finance",
  ]),

  // Family members (for family tool)
  family: z.array(FamilyMemberSchema).default([]),
})

// Exported types
export type Config = z.infer<typeof ConfigSchema>
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>
export type FamilyMember = z.infer<typeof FamilyMemberSchema>
export type ModelConfig = z.infer<typeof ModelConfigSchema>
export type PermissionRuleset = z.infer<typeof PermissionRulesetSchema>
