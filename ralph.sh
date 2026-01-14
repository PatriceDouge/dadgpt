#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

for ((i=1; i<=$1; i++)); do
  echo "=== Iteration $i of $1 ==="

  result=$(claude --dangerously-skip-permissions -p "@prompt.md @prd.json @progress.txt @IMPLEMENTATION_PLAN.md")

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "Implementation complete after $i iterations."
    exit 0
  fi
done

echo "Completed $1 iterations."
