import type { PermissionRuleset } from "../config/schema"

/**
 * Permission decision result
 */
export type PermissionDecision = "allow" | "deny" | "ask"

/**
 * Default permission rules for tools
 * These are used when no config is provided
 */
export const DEFAULT_RULES: PermissionRuleset = {
  allow: ["read", "goal", "todo", "project", "family"],
  deny: [],
  ask: ["write", "bash"],
}

/**
 * Check if a tool matches a pattern
 * Patterns can be:
 * - Exact match: "goal" matches "goal"
 * - Wildcard: "*" matches everything
 * - Prefix wildcard: "file.*" matches "file.read", "file.write"
 */
export function matchesPattern(tool: string, pattern: string): boolean {
  if (pattern === "*") {
    return true
  }

  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2)
    return tool.startsWith(prefix + ".") || tool === prefix
  }

  return tool === pattern
}

/**
 * Check if a tool matches any pattern in a list
 */
export function matchesAnyPattern(tool: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesPattern(tool, pattern))
}

/**
 * Evaluate permission rules for a tool
 * Priority: deny > allow > ask
 *
 * @param tool - The tool identifier (e.g., "goal", "write", "bash")
 * @param resource - Optional resource being accessed (for future use)
 * @param ruleset - The permission ruleset to evaluate against
 * @returns The permission decision
 */
export function evaluateRules(
  tool: string,
  _resource: string | undefined,
  ruleset: PermissionRuleset
): PermissionDecision {
  // Deny takes highest priority
  if (matchesAnyPattern(tool, ruleset.deny)) {
    return "deny"
  }

  // Allow takes second priority
  if (matchesAnyPattern(tool, ruleset.allow)) {
    return "allow"
  }

  // Ask takes third priority (default is to ask)
  if (matchesAnyPattern(tool, ruleset.ask)) {
    return "ask"
  }

  // If nothing matches and ask doesn't have "*", default to ask
  return "ask"
}
