#!/bin/bash
# Auto-run Prettier after an edit (style + import-order sorting).
# Wired to PostToolUse:Edit|Write. Always exits 0 (never blocks).

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# No file path -> nothing to format
if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Only format ts/tsx/js/jsx/css/json
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx|css|json)$ ]]; then
  if [[ -f "$FILE_PATH" ]]; then
    npx prettier --write "$FILE_PATH" 2>/dev/null
  fi
fi

exit 0
