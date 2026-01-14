import { useInput, useApp } from "ink"

/**
 * Hook for keyboard shortcuts.
 * Handles Ctrl+C and Escape to exit the application.
 * This is a side-effect only hook that returns nothing.
 */
export function useKeyboard(): void {
  const { exit } = useApp()

  useInput((input, key) => {
    // Ctrl+C exits application
    if (key.ctrl && input === "c") {
      exit()
    }

    // Escape exits application
    if (key.escape) {
      exit()
    }
  })
}
