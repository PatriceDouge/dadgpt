#!/usr/bin/env bun

import { main } from "./cli/index.ts";

main().catch((err) => {
  console.error("Fatal error:", err.message);
  if (process.env.DADGPT_DEBUG === "1") {
    console.error(err.stack);
  }
  process.exit(1);
});
