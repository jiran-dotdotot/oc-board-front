# OC Board — Codex

Read `CLAUDE.md` in full before working in this repository. It is the shared source of truth for
project rules, API contracts, design workflow, protected files, and required checks. Follow it
together with the global Codex instructions; do not maintain a second copy of those rules here.

## Codex equivalents

- For Claude's `EnterPlanMode`, use Plan mode when available. If this runtime cannot switch modes,
  present the plan and required source comparison before editing UI. Preserve the source-reading
  and clarification requirements in `CLAUDE.md`.
- For `AskUserQuestion`, use the available Codex clarification tool or a concise question. Existing
  user authorization still applies.
- `DesignSync` and `/design-login` refer to the existing design service. If it is unavailable, report
  the missing connection; do not invent design content or claim authentication succeeded.
- Use the `adv` skill for `/adv` or `$adv`; it reads `.claude/commands/adv.md` and adapts its review
  workflow to Codex agents.
- Project MCP servers live in `.codex/config.toml`. Context7, Ponytail, codebase-memory, and
  claude-mem use the existing user-level Codex installation.
- `.codex/hooks.json` adapts Codex shell/edit events to the existing `.claude/settings.json` hooks.
  Prefer `apply_patch` for edits so the formatter and checks receive each changed file. Editing
  through a shell is not covered by the edit hook; run the same checks explicitly in that case.
- The Claude dev-server preset uses port **5174** with `--strictPort`. Keep the existing tmux or
  Conductor requirement when starting it. Run E2E with `npm run test:e2e` and no base-URL override.

Setup details and checks: `docs/guides/codex-setup-guide.md`.
