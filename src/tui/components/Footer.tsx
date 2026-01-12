import React from "react";
import { Box, Text } from "ink";
import { colors } from "../theme.ts";

interface FooterProps {
  cwd: string;
  sessionName?: string;
}

export function Footer({ cwd, sessionName }: FooterProps) {
  // Get just the last part of the path
  const shortPath = cwd.split("/").slice(-2).join("/");

  return (
    <Box justifyContent="space-between" marginTop={1}>
      <Box>
        <Text color={colors.textMuted}>{shortPath}</Text>
        {sessionName && (
          <Text color={colors.brand}> ({sessionName})</Text>
        )}
      </Box>
      <Box>
        <Text color={colors.textDim}>/help </Text>
        <Text color={colors.textMuted}>for commands</Text>
      </Box>
    </Box>
  );
}
