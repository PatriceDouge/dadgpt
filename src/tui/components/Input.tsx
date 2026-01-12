import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { colors } from "../theme.ts";

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function Input({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Type a message...",
}: InputProps) {
  return (
    <Box marginTop={1}>
      <Box
        borderStyle="single"
        borderColor={disabled ? colors.textDim : colors.border}
        paddingX={1}
        flexGrow={1}
      >
        <Text color={colors.prompt}>{"> "}</Text>
        {disabled ? (
          <Text color={colors.textDim}>{placeholder}</Text>
        ) : (
          <TextInput
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            placeholder={placeholder}
          />
        )}
      </Box>
    </Box>
  );
}
