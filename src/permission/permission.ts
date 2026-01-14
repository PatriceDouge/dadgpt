import { Config } from "../config/config"
import type { PermissionRuleset } from "../config/schema"
import {
  type PermissionDecision,
  DEFAULT_RULES,
  evaluateRules,
} from "./rules"

/**
 * Permission namespace for checking tool access permissions
 */
export namespace Permission {
  /**
   * Check if a tool is allowed to access a resource
   *
   * @param tool - The tool identifier (e.g., "goal", "write", "bash")
   * @param resource - Optional resource being accessed (e.g., file path)
   * @param ruleset - Optional ruleset override (uses config if not provided)
   * @returns The permission decision: "allow", "deny", or "ask"
   *
   * @example
   * ```typescript
   * // Using default config rules
   * const decision = await Permission.check("goal", undefined)
   * // Returns "allow" if goal is in the allow list
   *
   * // Using custom ruleset
   * const decision = await Permission.check("bash", "/usr/bin/rm", {
   *   allow: [],
   *   deny: ["bash"],
   *   ask: ["*"]
   * })
   * // Returns "deny" since bash is in the deny list
   * ```
   */
  export async function check(
    tool: string,
    resource: string | undefined,
    ruleset?: PermissionRuleset
  ): Promise<PermissionDecision> {
    // If ruleset provided, use it directly
    if (ruleset) {
      return evaluateRules(tool, resource, ruleset)
    }

    // Otherwise, load from config
    try {
      const config = await Config.get()
      const configRuleset = config.permissions ?? DEFAULT_RULES
      return evaluateRules(tool, resource, configRuleset)
    } catch {
      // If config fails to load, use default rules
      return evaluateRules(tool, resource, DEFAULT_RULES)
    }
  }

  /**
   * Synchronous version of check for when config is already loaded
   *
   * @param tool - The tool identifier
   * @param resource - Optional resource being accessed
   * @param ruleset - The ruleset to evaluate against
   * @returns The permission decision
   */
  export function checkSync(
    tool: string,
    resource: string | undefined,
    ruleset: PermissionRuleset
  ): PermissionDecision {
    return evaluateRules(tool, resource, ruleset)
  }

  /**
   * Check if a tool is allowed (returns true only if decision is "allow")
   */
  export async function isAllowed(
    tool: string,
    resource?: string
  ): Promise<boolean> {
    const decision = await check(tool, resource)
    return decision === "allow"
  }

  /**
   * Check if a tool is denied (returns true only if decision is "deny")
   */
  export async function isDenied(
    tool: string,
    resource?: string
  ): Promise<boolean> {
    const decision = await check(tool, resource)
    return decision === "deny"
  }

  /**
   * Check if a tool requires user permission (returns true if decision is "ask")
   */
  export async function requiresPermission(
    tool: string,
    resource?: string
  ): Promise<boolean> {
    const decision = await check(tool, resource)
    return decision === "ask"
  }
}

// Re-export types for convenience
export type { PermissionDecision } from "./rules"
