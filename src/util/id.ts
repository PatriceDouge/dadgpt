import { ulid } from "ulid"

/**
 * Creates a new ULID (Universally Unique Lexicographically Sortable Identifier).
 * ULIDs are sortable by creation time.
 */
export function createId(): string {
  return ulid()
}

/**
 * Creates a prefixed ULID for categorized identifiers.
 * Example: createTimestampedId("goal") => "goal_01HXYZ..."
 */
export function createTimestampedId(prefix: string): string {
  return `${prefix}_${ulid()}`
}
