#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

for ((i=1; i<=$1; i++)); do
  echo "=== Iteration $i of $1 ==="

  result=$(claude --dangerously-skip-permissions -p "@IMPLEMENTATION_PLAN.md @progress.txt \
  1. Find the highest-priority task and implement it. \
  2. Run your tests and type checks. \
  3. Update the prd.json to set `passes: true` for the completed story. \
  4. Append your progress to progress.txt. \
  5. Commit your changes. \
  ONLY WORK ON A SINGLE TASK. \
  If the implementation plan is complete, output <promise>COMPLETE</promise>.")

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "Implementation complete after $i iterations."
    exit 0
  fi
done

echo "Completed $1 iterations."
