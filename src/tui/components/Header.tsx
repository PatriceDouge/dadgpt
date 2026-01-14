import React from "react"
import { Box, Text } from "ink"

/**
 * ASCII art logo for DadGPT header
 */
const ASCII_LOGO = `
 ___   _   ___   ___ ___ _____
|   \\ /_\\ |   \\ / __| _ \\_   _|
| |) / _ \\| |) | (_ |  _/ | |
|___/_/ \\_\\___/ \\___|_|   |_|
`.trim()

/**
 * Header component props
 */
export interface HeaderProps {
  /** Current model name (e.g., "claude-sonnet-4-20250514") */
  model: string
  /** Current provider name (e.g., "anthropic") */
  provider: string
  /** Current working directory */
  cwd: string
}

/**
 * Header component displaying ASCII art logo, tagline, and status bar
 */
export function Header({ model, provider, cwd }: HeaderProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* ASCII Art Logo */}
      <Box>
        <Text color="blueBright">{ASCII_LOGO}</Text>
      </Box>

      {/* Tagline */}
      <Box marginTop={1}>
        <Text color="gray">Your AI-powered personal command center</Text>
      </Box>

      {/* Status Bar */}
      <Box marginTop={1}>
        <Text color="gray">
          {model}
          <Text color="gray"> · </Text>
          {provider}
          <Text color="gray"> · </Text>
          {cwd}
        </Text>
      </Box>
    </Box>
  )
}
