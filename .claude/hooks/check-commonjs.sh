#!/bin/bash
# Flag CommonJS syntax (require / module.exports) in source files — ES modules only.
# Wired to PostToolUse:Edit|Write. Feedback-only (the write already happened; exit 2 tells Claude).

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FILE_PATH" ]] && exit 0

# Only ts/tsx/js/jsx; skip *.config.*, jest.*, and *.d.ts (declaration files legitimately
# reference `require` types) — M4.
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]] && [[ "$FILE_PATH" != *".config."* ]] && [[ "$FILE_PATH" != *"jest."* ]] && [[ "$FILE_PATH" != *".d.ts" ]]; then
  if [[ -f "$FILE_PATH" ]]; then
    # Strip whole-line comments (// , * , /*) before matching, so comments that merely MENTION
    # require()/module.exports don't trigger a false positive (M4). Method calls like `foo.require(`
    # and `a.module.exports` are excluded via the leading [^.[:alnum:]_] class.
    if grep -vE '^[[:space:]]*(//|\*|/\*)' "$FILE_PATH" \
        | grep -qE '(^|[^.[:alnum:]_])require[[:space:]]*\(|(^|[^.[:alnum:]_])module\.exports'; then
      echo "BLOCKED: CommonJS (require/module.exports) detected. Use ES modules (import/export). File: $FILE_PATH" >&2
      exit 2
    fi
  fi
fi

exit 0
