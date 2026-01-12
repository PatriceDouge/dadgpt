import { z } from "zod";

export const ProviderConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string().optional(),
});

export const PermissionRulesetSchema = z.object({
  allow: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
  ask: z.array(z.string()).optional(),
});

export const AgentConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().optional(),
  permission: PermissionRulesetSchema.optional(),
});

export const IntegrationConfigSchema = z.object({
  gmail: z
    .object({
      enabled: z.boolean().default(false),
      syncCount: z.number().default(50),
    })
    .optional(),
  calendar: z
    .object({
      enabled: z.boolean().default(false),
      calendars: z.array(z.string()).default(["primary"]),
    })
    .optional(),
});

export const ConfigSchema = z.object({
  provider: z.record(z.string(), ProviderConfigSchema).optional(),
  defaultProvider: z.string().default("openai"),
  defaultModel: z.string().optional(),
  agents: z.record(z.string(), AgentConfigSchema).optional(),
  permission: PermissionRulesetSchema.optional(),
  integrations: IntegrationConfigSchema.optional(),
  goalCategories: z
    .array(z.string())
    .default(["Health", "Family", "Work", "Personal", "Finance"]),
});

export type Config = z.infer<typeof ConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type PermissionRuleset = z.infer<typeof PermissionRulesetSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const AuthSchema = z.object({
  providers: z
    .record(
      z.string(),
      z.object({
        apiKey: z.string(),
      })
    )
    .optional(),
  google: z
    .object({
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      expiresAt: z.number().optional(),
    })
    .optional(),
});

export type Auth = z.infer<typeof AuthSchema>;
