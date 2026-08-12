# OC Board

기존 게시판을 React로 리뉴얼하는 프론트엔드 프로젝트.
> 프로젝트명 `OC Board`는 폴더명 `oc-board-front` 기반 임시값입니다 — 원하는 이름으로 바꾸세요.

## Commands

- Dev server: `npm run dev` (Vite dev server → http://localhost:5173)
- Build: `npm run build` (`tsc -b && vite build`)
- Lint: `npm run lint` (`eslint .`)
- Typecheck: `npx tsc -b --noEmit`
- Test: `npm run test` (Vitest, happy-dom; watch: `npm run test:watch`)
- Single test: `npx vitest <path>`
- E2E: `npm run test:e2e` (Playwright; specs in `tests/e2e/`)
  - ⚠️ Playwright `baseURL` 기본값은 `http://localhost:3000`이지만 Vite dev 서버는 5173입니다.
    E2E 실행 시 `PLAYWRIGHT_BASE_URL=http://localhost:5173`을 지정하거나 vite 포트를 3000으로 맞추세요.

## Deployment

- 타깃: **S3** (정적 빌드 업로드 예정). ⚠️ 배포 파이프라인/스크립트는 아직 구성하지 않음 — **현재 배포 관련 파일은 건드리지 말 것.**
- 환경 선택 방식: 미정 (배포 구성 시 결정).

## Git workflow

- Main branch: `develop`
- Branch naming: `feat/<topic>`, `fix/<topic>`
- Hosting: 원격 저장소 없음 — 로컬 커밋만 유지 (원격 추가 시 여기에 기재).
- Commit/PR messages in **한국어 (Korean)**
- Commit format: `<branch> <summary>`

## Path alias

- `@/*` → `src/*`  (mirror this in tsconfig(s) AND vite/vitest config)

## Code style

- Prettier: single quotes, no semicolons, printWidth 100, tabWidth 2 (see `.prettierrc`)
- ESLint: react-hooks rules
- ES modules only (import/export). CommonJS (`require`) is forbidden (enforced by a hook).
- IMPORTANT: import order is auto-sorted by `@trivago/prettier-plugin-sort-imports`.
  Never reorder imports by hand — only add/remove; Prettier fixes order on save.

## Architecture rules

### File structure
- `src/routes/` — (라우터 미도입) 라우터 도입 시 사용. 예: TanStack Router file-based routes.
- `src/components/ui/` — shadcn/ui components. Check here first; add with `npx shadcn@latest add <c>`.
- `src/components/common/` — shared custom components. Check before creating a new one (avoid dupes).
- `src/components/<domain>/` — per-domain components, each with `components/ hooks/ types/ constants/`.
- `src/hooks/` `src/services/` `src/utils/` `src/types/` `src/constants/` `src/atoms/` — 도메인 규모에 맞게 생성.
- `src/lib/apiClient.ts` — HTTP instance with interceptors (auth/error). HTTP 레이어 도입 시 추가.

## Constants / utils / types rules
- Constants live in a domain `constants` file (no inline literals in components).
- Extract pure functions to `src/utils/` (prefer over private helpers in hook files).
- Shared types in `src/types/` (reuse first); domain-only types in the domain's `types/`.

## i18n rules
- Locale files: `src/locales/{ko,en,ja}.json` (flat keys). Source language: **ko**(원본), targets: **en, ja**.
  (i18next는 아직 미설치 — 다국어 구현 시 설치. `.claude/hooks/i18n-check.sh`가 키 동기화를 강제합니다.)
- Add a key to the source language first, then to every other locale (a hook checks this).
- Key naming: kebab-case. Reuse common keys; prefix domain keys.

## lodash rule
- No `import _ from 'lodash'` (breaks tree-shaking, ~70KB). Use named imports: `import { orderBy } from 'lodash'`.
- Prefer native JS when equivalent (`Array.find`, `String.toUpperCase`, …).

## Dependency rule
- IMPORTANT: confirm with the user before adding any new npm package. Check existing deps first.

## Files requiring confirmation before editing
Ask the user before touching:
- `.env*`, `Dockerfile`, `.github/workflows/*.yml` — deploy pipeline
- `src/lib/apiClient.ts` — global auth/error interceptors
- test infra configs (`playwright.config.ts`, `vitest.config.ts`)
- `.claude/settings.json`, `.claude/hooks/*`, `.mcp.json` — Claude Code hooks / MCP wiring

## Definition of Done
Every code change must pass all of these before it's "done":
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:e2e` [if applicable]

## API type policy
- Generate response types from the actual API source (don't guess). If unknown, read the source or ask.
- Save generated types in `src/types/`; reuse existing ones.
- (HTTP/API 레이어 도입 후 적용.)

## Golden Reference
- 아직 기준 예시 도메인이 없습니다(신규 프로젝트). 첫 도메인 구현 후 그 경로를 여기에 지정하세요:
  per-domain `components/ hooks/ types/ constants/`, one service file per domain in `src/services/`.
  (참고: shadcn/ui 컴포넌트 예시는 `src/components/ui/`.)

## Refactoring principles
- IMPORTANT: in behavior-preserving refactors, preserving behavior is the top priority.
- Don't change external API/routes/props contracts during a refactor.
- Verify with build/lint; report pre-existing issues separately from your changes.

## UI verb-unification principle
When a UI change involves a verb (delete/remove/move/add/rename/exclude), BEFORE writing a new
modal/handler: grep every surface for that verb across the domain. If ≥2 implementations exist,
propose unifying them first (unify is the default unless the user says "only fix this one").
[Why: the same verb tends to get re-implemented in multiple places, drifting apart.]

## Doc routing
| Trigger | Destination |
|---|---|
| Feature design/plan | `docs/features/<feature>/design.md` |
| In-feature technical decision | `docs/features/<feature>/decision.md` |
| Cross-cutting ADR | `docs/decisions/NNN-<title>.md` |
| Dev guide / onboarding | `docs/guides/<topic>-guide.md` |
- 위 표를 이 프로젝트의 문서 컨벤션으로 채택 (`docs/` 디렉터리는 첫 문서 작성 시 생성).

## Tech stack
- TypeScript + React 19, Vite 8, Tailwind CSS v4, shadcn/ui (Radix primitives · `radix-nova` style, lucide icons).
- Lint/format: ESLint (flat config) + Prettier (+ import sort). Unit: Vitest + Testing Library (happy-dom).
  E2E: Playwright. Git hooks: Husky. Package manager: npm (`legacy-peer-deps=true`, React 19).
- 상태관리 / 라우터 / HTTP 클라이언트: 미도입 — 필요 시 추가(예: Jotai / TanStack Router / axios).
