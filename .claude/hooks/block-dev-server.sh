#!/bin/bash
# Block dev-server starts outside tmux/Conductor to prevent orphan processes.
# Wired to PreToolUse:Bash. Portable ERE only (no `grep -P` — macOS BSD grep lacks it).
#
# Detects: `npm/yarn/pnpm/bun run dev`, and direct `vite` invocations (bare, npx, yarn/pnpm,
# and `node_modules/.bin/vite` — M2). Does NOT block: `vitest`, `npm run develop`, or non-dev vite
# subcommands `vite build|preview|optimize|--version|--help` (M1).

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

is_dev=0

# 1) package-manager "dev" script: npm run dev / yarn dev / pnpm run dev / bun dev
#    ([^[:alnum:]]|$) after "dev" prevents matching "develop"; ":" is a boundary so "dev:foo" still blocks.
if echo "$COMMAND" | grep -qE '(npm|pnpm|yarn|bun)( +run)? +dev([^[:alnum:]]|$)'; then
  is_dev=1
fi

# 2) direct `vite` invocation. Non-alnum/start before + non-alnum/end after excludes "vitest"/"invite";
#    a leading "/" is allowed so node_modules/.bin/vite is caught. Then exclude non-dev subcommands.
if echo "$COMMAND" | grep -qE '(^|[^[:alnum:]])vite([^[:alnum:]]|$)'; then
  if echo "$COMMAND" | grep -qE 'vite +(build|preview|optimize|-v|--version|-h|--help)'; then
    :  # non-dev vite subcommand -> allow
  else
    is_dev=1
  fi
fi

if [ "$is_dev" -eq 1 ]; then
  [ -n "$TMUX" ] && exit 0
  [ -n "$CONDUCTOR_WORKSPACE" ] && exit 0
  echo "BLOCKED: run the dev server only inside tmux or Conductor." >&2
  echo "Use tmux, or run 'npm run build' if you just need a build check." >&2
  exit 2
fi

exit 0
