import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const BASE_DIR = path.join(os.homedir(), ".dadgpt");
const DATA_DIR = path.join(BASE_DIR, "data");

export namespace Storage {
  export function getBasePath(): string {
    return BASE_DIR;
  }

  export function getDataPath(): string {
    return DATA_DIR;
  }

  export async function ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  export async function init(): Promise<void> {
    await ensureDir(BASE_DIR);
    await ensureDir(DATA_DIR);
    await ensureDir(path.join(DATA_DIR, "sessions"));
    await ensureDir(path.join(DATA_DIR, "goals"));
    await ensureDir(path.join(DATA_DIR, "todos"));
  }

  export async function read<T>(key: string[]): Promise<T | undefined> {
    const filePath = path.join(DATA_DIR, ...key) + ".json";
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw err;
    }
  }

  export async function write<T>(key: string[], data: T): Promise<void> {
    const filePath = path.join(DATA_DIR, ...key) + ".json";
    const dirPath = path.dirname(filePath);

    await ensureDir(dirPath);

    // Atomic write: write to temp file, then rename
    const tempPath = filePath + ".tmp";
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
    await fs.rename(tempPath, filePath);
  }

  export async function update<T>(
    key: string[],
    fn: (prev: T | undefined) => T
  ): Promise<T> {
    const prev = await read<T>(key);
    const next = fn(prev);
    await write(key, next);
    return next;
  }

  export async function remove(key: string[]): Promise<boolean> {
    const filePath = path.join(DATA_DIR, ...key) + ".json";
    try {
      await fs.unlink(filePath);
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw err;
    }
  }

  export async function list(prefix: string[]): Promise<string[]> {
    const dirPath = path.join(DATA_DIR, ...prefix);
    try {
      const entries = await fs.readdir(dirPath);
      return entries
        .filter((e) => e.endsWith(".json"))
        .map((e) => e.slice(0, -5));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw err;
    }
  }

  export async function exists(key: string[]): Promise<boolean> {
    const filePath = path.join(DATA_DIR, ...key) + ".json";
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Config-specific helpers
  export async function readConfig<T>(name: string): Promise<T | undefined> {
    const filePath = path.join(BASE_DIR, name + ".json");
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as T;
    } catch {
      return undefined;
    }
  }

  export async function writeConfig<T>(name: string, data: T): Promise<void> {
    await ensureDir(BASE_DIR);
    const filePath = path.join(BASE_DIR, name + ".json");
    const tempPath = filePath + ".tmp";
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
    await fs.rename(tempPath, filePath);
  }

  // Secure auth storage with restricted permissions
  export async function writeAuth<T>(data: T): Promise<void> {
    await ensureDir(BASE_DIR);
    const filePath = path.join(BASE_DIR, "auth.json");
    const tempPath = filePath + ".tmp";
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), { mode: 0o600 });
    await fs.rename(tempPath, filePath);
  }

  export async function readAuth<T>(): Promise<T | undefined> {
    const filePath = path.join(BASE_DIR, "auth.json");
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as T;
    } catch {
      return undefined;
    }
  }
}
