import React from "react";
import { Box, Text } from "ink";
import { colors } from "../theme.ts";

const ASCII_LOGO = `    ____            _  ____ ____ _____
   |  _ \\  __ _  __| |/ ___|  _ \\_   _|
   | | | |/ _\` |/ _\` | |  _| |_) || |
   | |_| | (_| | (_| | |_| |  __/ | |
   |____/ \\__,_|\\__,_|\\____|_|    |_|`;

interface HeaderProps {
  version: string;
  model: string;
  provider: string;
  cwd: string;
}

export function Header({ version, model, provider, cwd }: HeaderProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={colors.brandAlt}>{ASCII_LOGO}</Text>
      <Box marginTop={1}>
        <Text color={colors.textMuted}>
          Your AI-powered personal command center
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.textMuted}>
          {model}
        </Text>
        <Text color={colors.textDim}> · </Text>
        <Text color={colors.textMuted}>{provider}</Text>
        <Text color={colors.textDim}> · </Text>
        <Text color={colors.textDim}>{cwd}</Text>
      </Box>
    </Box>
  );
}
