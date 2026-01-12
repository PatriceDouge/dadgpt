import chalk from "chalk";
import ora, { type Ora } from "ora";
import * as readline from "readline";

export namespace UI {
  export function print(text: string): void {
    process.stdout.write(text);
  }

  export function println(text: string = ""): void {
    console.log(text);
  }

  export function success(text: string): void {
    console.log(chalk.green("✓ " + text));
  }

  export function error(text: string): void {
    console.error(chalk.red("✗ " + text));
  }

  export function warn(text: string): void {
    console.warn(chalk.yellow("⚠ " + text));
  }

  export function info(text: string): void {
    console.log(chalk.blue("ℹ " + text));
  }

  export function dim(text: string): void {
    console.log(chalk.dim(text));
  }

  export function bold(text: string): string {
    return chalk.bold(text);
  }

  export function spinner(text: string): Ora {
    return ora(text).start();
  }

  export function header(text: string): void {
    println();
    println(chalk.bold.blue(text));
    println(chalk.dim("─".repeat(Math.min(text.length + 4, 60))));
  }

  export function divider(): void {
    println(chalk.dim("─".repeat(60)));
  }

  export async function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(chalk.cyan(question), (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  export async function confirm(question: string): Promise<boolean> {
    const answer = await prompt(`${question} (y/n): `);
    return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
  }

  export async function select(
    question: string,
    options: string[]
  ): Promise<number> {
    println(chalk.cyan(question));
    options.forEach((opt, i) => {
      println(`  ${chalk.yellow(String(i + 1))}. ${opt}`);
    });

    const answer = await prompt("Enter number: ");
    const num = parseInt(answer, 10);

    if (isNaN(num) || num < 1 || num > options.length) {
      error("Invalid selection");
      return -1;
    }

    return num - 1;
  }

  export function formatToolCall(name: string, _args: unknown): string {
    return chalk.dim(`[Calling ${name}...]`);
  }

  export function formatToolResult(name: string, success: boolean): string {
    if (success) {
      return chalk.dim(`[${name} completed]`);
    }
    return chalk.dim.red(`[${name} failed]`);
  }

  export function logo(): void {
    println(chalk.bold.cyan(`
    ____            _  ____ ____ _____
   |  _ \\  __ _  __| |/ ___|  _ \\_   _|
   | | | |/ _\` |/ _\` | |  _| |_) || |
   | |_| | (_| | (_| | |_| |  __/ | |
   |____/ \\__,_|\\__,_|\\____|_|    |_|
    `));
    println(chalk.dim("  Your AI-powered personal command center"));
    println();
  }

  // REPL mode helpers
  export function replPrompt(): string {
    return chalk.cyan("dadgpt> ");
  }

  export function formatAssistantStart(): void {
    println();
    print(chalk.green("Assistant: "));
  }

  export function formatUserMessage(message: string): void {
    println(chalk.blue("You: ") + message);
  }
}
