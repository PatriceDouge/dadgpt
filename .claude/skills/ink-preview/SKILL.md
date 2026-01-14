# Ink TUI Preview Skill

Preview and verify React Ink terminal UI changes visually.

## Setup Requirements

Ensure these are installed in the project:

```bash
pnpm add -D ink-testing-library
```

For visual screenshots (optional but recommended):

```bash
# Install vhs (Charmbracelet)
brew install vhs  # or: go install github.com/charmbracelet/vhs@latest
```

## Verification Methods

### Method 1: String Render (Fast, No Screenshot)

Create/use a preview script at `scripts/preview.tsx`:

```tsx
import { render } from "ink-testing-library";
import App from "../src/App";

const { lastFrame } = render(<App />);
console.log(lastFrame());
```

Run with: `pnpm tsx scripts/preview.tsx`

This outputs the rendered TUI as text. Good for quick iteration.

### Method 2: Visual Screenshot (Recommended for Complex UIs)

Create a `preview.tape` file in the project root:

```tape
Output preview.png
Set Width 120
Set Height 40

Type "pnpm tsx src/index.tsx"
Enter
Sleep 1s
Screenshot preview.png
```

Run with: `vhs preview.tape`

This produces an actual screenshot at `preview.png` that can be viewed.

## Workflow

1. After making changes, run the string preview first for quick feedback
2. Use vhs screenshot when you need to verify visual layout, colors, or complex formatting
3. View the generated `preview.png` to confirm changes look correct

## Tips

- For interactive TUIs, add `Sleep` commands in the tape file and `Type` to simulate input
- Adjust `Set Width` and `Set Height` to match target terminal size
- If the app doesn't exit automatically, add `Ctrl+C` in the tape file after screenshot
