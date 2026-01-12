import chalk from "chalk";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

let currentLevel: LogLevel = "INFO";

const levels: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

export namespace Log {
  export function init(opts: { level?: LogLevel }) {
    if (opts.level) {
      currentLevel = opts.level;
    }
  }

  export function debug(...args: unknown[]) {
    if (levels[currentLevel] <= levels.DEBUG) {
      console.log(chalk.gray("[DEBUG]"), ...args);
    }
  }

  export function info(...args: unknown[]) {
    if (levels[currentLevel] <= levels.INFO) {
      console.log(chalk.blue("[INFO]"), ...args);
    }
  }

  export function warn(...args: unknown[]) {
    if (levels[currentLevel] <= levels.WARN) {
      console.warn(chalk.yellow("[WARN]"), ...args);
    }
  }

  export function error(...args: unknown[]) {
    if (levels[currentLevel] <= levels.ERROR) {
      console.error(chalk.red("[ERROR]"), ...args);
    }
  }

  export function getLevel(): LogLevel {
    return currentLevel;
  }
}
