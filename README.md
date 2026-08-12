# OC Board

기존 게시판을 React로 리뉴얼하는 프론트엔드 프로젝트.

## 기술 스택

- **React 19** + **TypeScript** + **Vite 8**
- **Tailwind CSS v4** + **shadcn/ui** (Radix primitives, `radix-nova` 스타일, lucide 아이콘)
- **i18next** / react-i18next — ko·en·ja, 브라우저 언어 자동감지
- **ESLint** (flat config) + **Prettier** (import 자동 정렬)
- **Vitest** (happy-dom) + Testing Library / **Playwright** (E2E)
- Git hooks: **Husky** — pre-commit(lint+typecheck), pre-push(test)

## 요구 사항

- Node `>=22.12` (`.nvmrc` = 22.12.0) — `nvm use`
- 패키지 매니저: npm (`.npmrc`의 `legacy-peer-deps=true`)

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (http://localhost:5173) |
| `npm run build` | 타입체크 + 프로덕션 빌드 (`tsc -b && vite build`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run test` | 단위 테스트 (Vitest) |
| `npm run test:watch` | 테스트 watch 모드 |
| `npm run test:coverage` | 커버리지 리포트 |
| `npm run test:e2e` | E2E (Playwright, 스펙 위치 `tests/e2e/`) |

> ⚠️ **E2E 포트**: Playwright 기본 `baseURL`은 `http://localhost:3000`, Vite dev는 5173입니다.
> 실행 시 `PLAYWRIGHT_BASE_URL=http://localhost:5173`을 지정하거나 vite 포트를 3000으로 맞추세요.

## 디렉터리 구조

```
src/
  components/ui/   shadcn/ui 컴포넌트 (npx shadcn@latest add <c>)
  lib/             i18n·utils 등 공용 모듈
  locales/         ko/en/ja 로케일 (flat kebab-case 키)
tests/             Vitest 단위 테스트 (+ e2e/ Playwright 스펙)
```

프로젝트 규칙·아키텍처 컨벤션은 [`CLAUDE.md`](CLAUDE.md)를 참고하세요.
