import { ulid } from "ulid";

export function generateId(): string {
  return ulid();
}

export function isValidId(id: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id);
}
