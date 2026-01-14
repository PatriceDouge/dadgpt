import React, { useState } from "react"
import { Box, Text } from "ink"
import TextInput from "ink-text-input"

/**
 * Input box component props
 */
export interface InputBoxProps {
  /** Callback when user submits text (presses Enter) */
  onSubmit: (value: string) => void
  /** Whether input is disabled (e.g., while waiting for AI response) */
  disabled?: boolean
  /** Placeholder text shown when input is empty */
  placeholder?: string
}

/**
 * Input box component for user text entry
 * Features rounded border, blue prompt indicator, and ink-text-input integration
 */
export function InputBox({
  onSubmit,
  disabled = false,
  placeholder = "Type a message...",
}: InputBoxProps): React.ReactElement {
  const [value, setValue] = useState("")

  const handleSubmit = (submittedValue: string): void => {
    const trimmed = submittedValue.trim()
    if (trimmed && !disabled) {
      onSubmit(trimmed)
      setValue("")
    }
  }

  return (
    <Box borderStyle="round" borderColor="gray" paddingX={1}>
      <Text color="blueBright">{"> "}</Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder={disabled ? "Waiting..." : placeholder}
        focus={!disabled}
      />
    </Box>
  )
}
