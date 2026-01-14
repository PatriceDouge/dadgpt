import React, { useState, useEffect } from "react"
import { Text } from "ink"

/**
 * Braille spinner animation frames
 * These characters create a smooth rotating animation effect
 */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

/**
 * Animation interval in milliseconds (~80ms for smooth animation)
 */
const ANIMATION_INTERVAL = 80

/**
 * Spinner component for showing loading/thinking state
 * Uses animated braille characters with blue color
 */
export function Spinner(): React.ReactElement {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length)
    }, ANIMATION_INTERVAL)

    // Clean up interval on unmount
    return () => clearInterval(timer)
  }, [])

  return <Text color="blueBright">{SPINNER_FRAMES[frame]}</Text>
}
