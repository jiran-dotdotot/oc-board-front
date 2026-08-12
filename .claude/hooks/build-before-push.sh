#!/bin/bash
# Run `npm run build` before any `git push` Claude issues; block the push on failure.
# Wired to PreToolUse:Bash. (Human-initiated pushes are guarded by .husky/pre-push.)

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Detect `git push` as an actual command — at the start or after a shell separator (; && || |) —
# so strings like `echo "git push"` or `git log | grep 'git push'` don't trigger a build (L4).
if echo "$COMMAND" | grep -qE '(^|[;&|])[[:space:]]*git[[:space:]]+push([[:space:]]|$)'; then
  echo "git push detected: verifying build..."
  # L3: guard against an unset project dir (cd "" would silently succeed and build the wrong tree).
  if [ -z "$CLAUDE_PROJECT_DIR" ]; then
    echo "BLOCKED: CLAUDE_PROJECT_DIR is unset; refusing to run build from an unknown directory." >&2
    exit 2
  fi
  cd "$CLAUDE_PROJECT_DIR" || { echo "BLOCKED: cannot cd to CLAUDE_PROJECT_DIR." >&2; exit 2; }

  if ! npm run build > /dev/null 2>&1; then
    echo "BLOCKED: 'npm run build' failed. Fix build errors before pushing." >&2
    exit 2
  fi

  echo "Build OK. Proceeding with push."
fi

exit 0
