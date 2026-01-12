import { z } from "zod";
import { Storage } from "../storage/storage.ts";
import { UI } from "../cli/ui.ts";
import { generateId } from "../util/id.ts";

export const PermissionRulesetSchema = z.object({
  allow: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
  ask: z.array(z.string()).optional(),
});

export type PermissionRuleset = z.infer<typeof PermissionRulesetSchema>;

export type PermissionDecision = "allow" | "deny" | "ask";

interface GrantedPermission {
  id: string;
  tool: string;
  resource: string;
  grantedAt: string;
}

export namespace Permission {
  // In-memory cache of pending permission requests
  const pending = new Map<
    string,
    {
      resolve: (granted: boolean) => void;
      reject: (err: Error) => void;
    }
  >();

  // Default ruleset - be conservative by default
  const defaultRuleset: PermissionRuleset = {
    allow: [
      "goal:*",      // Allow all goal operations
      "todo:*",      // Allow all todo operations
      "family:*",    // Allow all family operations
      "read:dadgpt.md",  // Allow reading dadgpt.md
    ],
    deny: [
      "write:/etc/*",     // Never write to system files
      "write:/usr/*",
      "bash:rm -rf *",    // Never allow destructive commands
    ],
    ask: [
      "write:*",    // Ask before writing other files
      "bash:*",     // Ask before running shell commands
    ],
  };

  export async function check(
    tool: string,
    resource: string,
    ruleset?: PermissionRuleset
  ): Promise<PermissionDecision> {
    const rules = ruleset ?? defaultRuleset;
    const pattern = `${tool}:${resource}`;

    // Check deny first
    if (rules.deny && matchesAny(pattern, rules.deny)) {
      return "deny";
    }

    // Check allow
    if (rules.allow && matchesAny(pattern, rules.allow)) {
      return "allow";
    }

    // Check previously granted permissions
    const granted = await getGrantedPermissions();
    if (granted.some((g) => matches(`${g.tool}:${g.resource}`, pattern))) {
      return "allow";
    }

    // Check ask patterns
    if (rules.ask && matchesAny(pattern, rules.ask)) {
      return "ask";
    }

    // Default to ask for unknown operations
    return "ask";
  }

  export async function ask(
    tool: string,
    resource: string
  ): Promise<boolean> {
    const decision = await check(tool, resource);

    if (decision === "allow") {
      return true;
    }

    if (decision === "deny") {
      return false;
    }

    // Interactive mode - ask the user
    return await promptUser(tool, resource);
  }

  async function promptUser(tool: string, resource: string): Promise<boolean> {
    UI.println();
    UI.warn(`Permission requested: ${tool} on ${resource}`);

    const choice = await UI.select("Allow this action?", [
      "Allow once",
      "Always allow",
      "Deny",
    ]);

    switch (choice) {
      case 0: // Allow once
        return true;
      case 1: // Always allow
        await grantPermission(tool, resource);
        return true;
      case 2: // Deny
      default:
        return false;
    }
  }

  export async function grantPermission(
    tool: string,
    resource: string
  ): Promise<void> {
    const granted = await getGrantedPermissions();

    granted.push({
      id: generateId(),
      tool,
      resource,
      grantedAt: new Date().toISOString(),
    });

    await Storage.write(["permissions"], granted);
  }

  export async function revokePermission(id: string): Promise<boolean> {
    const granted = await getGrantedPermissions();
    const index = granted.findIndex((g) => g.id === id);

    if (index === -1) {
      return false;
    }

    granted.splice(index, 1);
    await Storage.write(["permissions"], granted);
    return true;
  }

  export async function getGrantedPermissions(): Promise<GrantedPermission[]> {
    return (await Storage.read<GrantedPermission[]>(["permissions"])) ?? [];
  }

  export async function clearAllPermissions(): Promise<void> {
    await Storage.write(["permissions"], []);
  }

  // Pattern matching utilities
  function matchesAny(value: string, patterns: string[]): boolean {
    return patterns.some((pattern) => matches(pattern, value));
  }

  function matches(pattern: string, value: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special chars
      .replace(/\*/g, ".*")                  // * matches anything
      .replace(/\?/g, ".");                  // ? matches single char

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(value);
  }

  // Promise-based permission handling (for async tool calls)
  export function createRequest(
    tool: string,
    resource: string
  ): { id: string; promise: Promise<boolean> } {
    const id = generateId();

    const promise = new Promise<boolean>((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });

    return { id, promise };
  }

  export function resolveRequest(
    id: string,
    granted: boolean,
    remember?: boolean
  ): void {
    const request = pending.get(id);
    if (!request) return;

    pending.delete(id);

    if (remember && granted) {
      // Would need tool/resource info here - simplified for now
    }

    request.resolve(granted);
  }

  export function rejectRequest(id: string, error: Error): void {
    const request = pending.get(id);
    if (!request) return;

    pending.delete(id);
    request.reject(error);
  }
}
