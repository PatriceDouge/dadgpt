import chalk from "chalk"

/**
 * Grayscale theme system for DadGPT TUI
 * Inspired by OpenCode's clean monochrome aesthetic
 */

// Text colors - grayscale palette
export const text = {
  primary: chalk.white,        // #ffffff - main text
  secondary: chalk.gray,       // #888888 - secondary text
  muted: chalk.dim,            // dimmed - subtle text
  accent: chalk.blueBright,    // accent for highlights
}

// Status colors for feedback
export const status = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
}

// UI element styling
export const ui = {
  border: chalk.gray("─"),
  borderLight: chalk.dim("─"),
  bullet: chalk.gray("•"),
  arrow: chalk.gray("›"),
  prompt: chalk.blueBright(">"),
}

// Semantic text styles
export const styles = {
  header: chalk.bold.white,
  subheader: chalk.gray,
  label: chalk.dim,
  value: chalk.white,
  link: chalk.underline.blueBright,
  code: chalk.cyan,
  timestamp: chalk.dim,
}

// Box drawing characters for borders
export const box = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
  leftT: "├",
  rightT: "┤",
  topT: "┬",
  bottomT: "┴",
  cross: "┼",
}

// Dimmed box for less emphasis
export const dimBox = {
  topLeft: chalk.dim("┌"),
  topRight: chalk.dim("┐"),
  bottomLeft: chalk.dim("└"),
  bottomRight: chalk.dim("┘"),
  horizontal: chalk.dim("─"),
  vertical: chalk.dim("│"),
  leftT: chalk.dim("├"),
  rightT: chalk.dim("┤"),
  topT: chalk.dim("┬"),
  bottomT: chalk.dim("┴"),
  cross: chalk.dim("┼"),
}

// Combined theme object for convenient imports
export const theme = {
  text,
  status,
  ui,
  styles,
  box,
  dimBox,
}
