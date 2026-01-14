import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import { getDataPath } from "./paths"
import { Log } from "../util/log"

/**
 * Get the data directory, supporting DADGPT_DATA_DIR override for testing.
 */
function getDataDir(): string {
  if (process.env.DADGPT_DATA_DIR) {
    return process.env.DADGPT_DATA_DIR
  }
  const homedir = process.env.DADGPT_HOME ?? path.join(os.homedir(), ".dadgpt")
  return path.join(homedir, "data")
}

/**
 * Storage namespace for JSON file persistence operations.
 * All operations use node:fs/promises for cross-platform compatibility.
 */
export namespace Storage {
  /**
   * Read and parse JSON data from storage.
   * Handles invalid JSON gracefully by returning undefined and logging a warning.
   * @param key - Path segments relative to data directory
   * @returns Parsed data or undefined if not found or invalid JSON
   */
  export async function read<T>(key: string[]): Promise<T | undefined> {
    const filePath = getDataPath(...key)
    try {
      const content = await fs.readFile(filePath, "utf-8")

      // Handle empty file gracefully
      const trimmed = content.trim()
      if (!trimmed) {
        Log.debug(`Storage file is empty: ${filePath}`)
        return undefined
      }

      try {
        return JSON.parse(trimmed) as T
      } catch (parseErr) {
        // Invalid JSON - log warning and return undefined
        Log.warn(
          `Invalid JSON in storage file ${filePath}: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
        )
        return undefined
      }
    } catch {
      // File doesn't exist or can't be read
      return undefined
    }
  }

  /**
   * Write JSON data to storage with pretty printing.
   * Creates parent directories if they don't exist.
   * @param key - Path segments relative to data directory
   * @param data - Data to serialize and write
   */
  export async function write<T>(key: string[], data: T): Promise<void> {
    const filePath = getDataPath(...key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
  }

  /**
   * Delete a file from storage.
   * @param key - Path segments relative to data directory
   * @returns true if file was deleted, false if it didn't exist
   */
  export async function remove(key: string[]): Promise<boolean> {
    const filePath = getDataPath(...key)
    try {
      await fs.unlink(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Atomically update data in storage.
   * Reads current value, applies update function, writes result.
   * Creates the file if it doesn't exist.
   * @param key - Path segments relative to data directory
   * @param fn - Function that receives previous value and returns new value
   * @returns The new value after update
   */
  export async function update<T>(
    key: string[],
    fn: (prev: T | undefined) => T
  ): Promise<T> {
    const prev = await read<T>(key)
    const next = fn(prev)
    await write(key, next)
    return next
  }

  /**
   * List all JSON files in a directory.
   * @param prefix - Path segments for the directory to list
   * @returns Array of file names without .json extension
   */
  export async function list(prefix: string[]): Promise<string[]> {
    const dir = path.join(getDataDir(), ...prefix)
    try {
      const entries = await fs.readdir(dir)
      return entries
        .filter((e) => e.endsWith(".json"))
        .map((e) => e.slice(0, -5))
    } catch {
      return []
    }
  }

  /**
   * Check if a file exists in storage.
   * @param key - Path segments relative to data directory
   * @returns true if file exists, false otherwise
   */
  export async function exists(key: string[]): Promise<boolean> {
    const filePath = getDataPath(...key)
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Ensure the data directory exists.
   * Creates it recursively if it doesn't exist.
   */
  export async function ensureDir(): Promise<void> {
    await fs.mkdir(getDataDir(), { recursive: true })
  }
}
