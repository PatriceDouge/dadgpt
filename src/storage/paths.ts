import * as path from "node:path"
import * as os from "node:os"

/**
 * Get the base home directory for DadGPT.
 * Can be overridden with DADGPT_HOME environment variable.
 */
function getHome(): string {
  return process.env.DADGPT_HOME ?? path.join(os.homedir(), ".dadgpt")
}

/**
 * Get the data directory for DadGPT.
 * Can be overridden with DADGPT_DATA_DIR environment variable for testing.
 */
function getDataDir(): string {
  return process.env.DADGPT_DATA_DIR ?? path.join(getHome(), "data")
}

/** Default home directory: ~/.dadgpt */
export const DADGPT_HOME = getHome()

/** Data directory: ~/.dadgpt/data (or DADGPT_DATA_DIR if set) */
export const DATA_DIR = getDataDir()

/** Config file path: ~/.dadgpt/config.json */
export const CONFIG_PATH = path.join(getHome(), "config.json")

/** Auth file path: ~/.dadgpt/auth.json */
export const AUTH_PATH = path.join(getHome(), "auth.json")

/**
 * Returns a full path to a data file with .json extension.
 * @param segments - Path segments relative to DATA_DIR
 * @returns Full path with .json extension
 * @example getDataPath("goals", "abc123") => "~/.dadgpt/data/goals/abc123.json"
 */
export function getDataPath(...segments: string[]): string {
  return path.join(getDataDir(), ...segments) + ".json"
}

/**
 * Returns the directory path for a specific session.
 * @param sessionId - The session ID
 * @returns Full path to the session directory
 * @example getSessionPath("01HXY...") => "~/.dadgpt/data/sessions/01HXY..."
 */
export function getSessionPath(sessionId: string): string {
  return path.join(getDataDir(), "sessions", sessionId)
}
