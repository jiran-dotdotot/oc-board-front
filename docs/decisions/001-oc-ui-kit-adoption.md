# 001 — `@jiransoft/oc-ui-kit` 도입 검토

- 상태: **제안 · 미결정** (구현 전, 아래 §12 결정 대기)
- 대상: `@jiransoft/oc-ui-kit@0.1.5` (`git@github.com:jiransoft/oc-ui-kit.git`, `develop` @ `51b9011`)
- 소비처: `oc-board-front` (React 19 · Vite 8 · Tailwind v4 · shadcn/ui · TanStack Router)
- 조사일: 2026-09-03
- 방법: 에이전트 18대 병렬 조사 + **실측**(킷 빌드·팩·소비처 복제 설치·브라우저 렌더 대조)

---

## ⚠️ 가정 원장

이 문서에서 근거 없이 만들어 쓴 값·판단은 아래가 전부다. 코드로 옮기기 전에 확인해야 한다.

| # | 가정 | 근거 상태 |
|---|---|---|
| A-1 | 킷 문서 「소비처 현황」표의 **"신규 프로젝트 / React 19 / Tailwind v4 / 1차 적용 대상"이 우리다** | 이름이 명시돼 있지 않다. org 전체 소비처가 0곳이고 스택이 정확히 일치해 추론했다 |
| A-2 | `0.1.5`가 GitHub Packages에 실제 publish 되어 있다 | **미검증** — 토큰이 없어 레지스트리 조회 401. 이번 실증은 로컬 `npm pack` tarball로 우회했다 |
| A-3 | 원격 `v0.1.6`도 `0.1.5`와 같은 성격의 변경이다 | **미검증** — 로컬 클론은 `v0.1.5`까지다. 원격에 태그 `v0.1.6`이 있다 |
| A-4 | 킷 `--oc-secondary`에 대응할 우리 값은 `gray-200`이다 | 정본은 `secondary`와 `muted`를 **같은 `gray-100`**으로 두는데 킷은 둘이 달라야 한다. 값 하나를 발명했다 |
| A-5 | 킷 `success`/`warning`의 전경색을 어둡게 해 AA를 맞춘다 | 정본 「필 위 글자 = white」와 어긋난다. §6-2 결정 대기 |
| A-6 | 킷 아이콘 151종은 우리 리뉴얼 디자인 정본과 **다른 브랜드 세대**다 | 킷은 `client-web` 자산 포팅(브랜드 블루 `#3362ff`), 우리 정본은 `#4B79FF`. 디자인 소스로 교차 확인 안 했다 |

---

## 1. 한 줄 결론

**기술적으로 도입 가능하다. 실측으로 확인했다.** 단 지금 당장은 **레지스트리 인증이 없어 설치 자체가 안 되고**, 설치 후에는 **킷 문서대로 배선하면 이 프로젝트에서는 깨진다**(우리 Prettier가 되돌린다). 그리고 킷은 **생후 6일 · 기여자 1명 · 실사용 소비처 0곳**이라 개척 리스크를 우리가 전부 진다.

권고는 «전면 교체»도 «보류»도 아니라 **범위를 좁힌 조건부 채택**이다 (§11).

---

## 2. 이 킷의 «의도» — 문서에서 읽은 것

킷은 「컴포넌트가 없어서」 만든 게 아니다. `docs/README.md`가 설계를 제약 4개로 못 박는다.

| 제약 | 결과 |
|---|---|
| 소비처에 React 18과 19가 공존 | `peerDependencies: ">=18"`, React는 번들에서 제외 |
| 소비처에 Tailwind v3와 v4가 공존 | Tailwind를 **CSS로 컴파일해서 배포**. 소비처는 Tailwind 설정 불필요 |
| 소비처마다 Tailwind 테마가 다름 | 유틸리티에 **`oc:` 프리픽스**, `@layer oc-ui`로 격리 |
| 소비처가 킷 빌드 툴체인을 갖고 있지 않음 | 레지스트리 배포. 배포자만 빌드 |

즉 **「우리 브랜드 컴포넌트 킷」이 아니라 「테마 계약을 노출한 중립 킷」이다.** 실제로 `tokens.css`는 통째로 Tailwind slate/blue 기본값(`#2563eb`·`#f1f5f9`·`#0f172a`)이다. 브랜드는 소비처가 `--oc-*`를 덮어서 넣는 구조다.

**공개 계약**은 문서상 `--oc-*` 토큰 하나("유일한 공개 계약")지만, `CLAUDE.md`가 `data-slot` 값·variant 값·prop 기본값 변경도 파괴적 변경으로 규정하므로 **실질 계약면은 4개**다.

**의도대로 동작하는가 — 그렇다.** 격리 설계 4가지(`oc:` 프리픽스 · `@layer oc-ui` · preflight 미배포 · 스코프 리셋 `:where([class*="oc:"])`)가 실제로 작동한다. 실측 근거는 §3.

---

## 3. 판정 ①: 라이브러리처럼 설치해서 쓸 수 있는가 — **된다 (실증)**

로컬 `npm pack` tarball을 우리 앱 복제본에 실제로 설치하고, 컴포넌트를 갈아끼우고, 프로덕션 빌드를 브라우저로 렌더해서 확인했다.

### 통과한 게이트 (전부 EXIT 0)

| 항목 | 결과 |
|---|---|
| 킷 `npm run build` | 경고 0 · 에러 0 (ESM 285KB · CJS 305KB · d.ts 133KB · CSS 32.8KB) |
| 킷 `npm run smoke` | ✅ tarball → 임시 소비처 설치 → ESM/CJS/CSS 서브패스/`tsc` 전부 통과 |
| 킷 `npm test` / `typecheck` / `lint` | **1086 tests passed** · exit 0 · exit 0 |
| 우리 앱 `npm run build` · `lint` · `test` · `tsc -b` | 전부 EXIT 0 |
| `npm run check:tokens` · `check:scale` | EXIT 0 (`check:scale`은 1줄 수정 후 — §5-3) |
| peer dependency | **경고 0** (`legacy-peer-deps` 없이도 만족) |
| 의존성 중복 | **0건.** 킷 Radix 15개 전부 우리 트리와 버전 일치. 신규는 `cmdk` 하나 |
| 타입 | 우리 `tsconfig.app.json` 옵션 + `skipLibCheck:false` + `--strict`에서 **에러 0** |
| happy-dom 호환 | 킷 컴포넌트 **15/15 통과, 스텁 0개** — jsdom 전환 불필요 |

### ⭐ 기존 화면 회귀 0건

손대지 않은 앱과 킷 도입 앱을 **각각 프로덕션 빌드해 두 포트에 띄우고**, 보이는 엘리먼트 143개의 계산된 스타일 30속성 + 기하를 다이제스트로 대조했다.

| 모드 | 기준선 | 킷 도입 | |
|---|---|---|---|
| 라이트 | `b42f6ebc` (143) | `b42f6ebc` (143) | ✅ **픽셀 동일** |
| 다크 (`html.dark`) | `89b8a07d` (143) | `89b8a07d` (143) | ✅ **픽셀 동일** |

**킷을 설치하고 CSS를 불러오는 것만으로는 기존 화면이 1픽셀도 바뀌지 않는다.** preflight를 배포하지 않고(`box-sizing`조차 `:where([class*="oc:"])`로만 스코프), 커스텀 프로퍼티 121개가 전부 `--oc-*` 접두라 우리 토큰과 기계적 충돌이 0건이기 때문이다.

### 번들 비용

| | 증가 |
|---|---|
| JS — `Button` 하나만 | **+2.95 KB** (트리셰이킹 작동. 전체 대비 9.4%) |
| CSS — 컴포넌트 개수 무관 | **+31.3 KB** raw / **gzip +6.4 KB** (트리셰이킹 **안 됨**, 항상 통째로) |

CSS는 트리셰이킹이 안 되지만 고정비가 gzip 6.4KB라 최적화할 가치가 없다.

---

## 4. 판정 ②: 지금 막고 있는 것 — **레지스트리 인증 (유일한 하드 블로커)**

```
$ npm view @jiransoft/oc-ui-kit version
npm error 404 Not Found - GET https://registry.npmjs.org/@jiransoft%2foc-ui-kit
```

`~/.npmrc`가 아예 없고, `oc-board-front/.npmrc`는 `legacy-peer-deps=true` 한 줄뿐이라 npm이 npmjs.com을 본다. GitHub Packages는 **패키지가 public이어도 읽기에 인증을 요구**한다.

**권한은 이미 있다** — 계정 `jiran-dotdotot`은 `jiransoft` 조직 멤버이고 킷 레포에 `maintain`. 발급만 하면 통과한다.

### 필요한 조치 (3분 + 커밋 1건)

1. **classic PAT 발급** — <https://github.com/settings/tokens/new>
   - 스코프 **`read:packages`만**
   - **만료 ≤ 90일 필수** (조직 정책이 90일 초과 classic PAT를 403 차단)
   - ⚠️ **fine-grained 토큰 미지원**. `gh` CLI 토큰(`gho_*`)도 `read:packages`가 없어 사용 불가
2. `npm config set //npm.pkg.github.com/:_authToken ghp_...` + `chmod 600 ~/.npmrc`
3. `oc-board-front/.npmrc`에 한 줄 추가 후 **커밋**:
   ```
   @jiransoft:registry=https://npm.pkg.github.com
   ```
   ⚠️ **토큰 줄은 레포 `.npmrc`에 넣지 마라** — 프로젝트 `.npmrc`가 사용자 설정을 이겨서 CI의 `setup-node` 주입을 덮어쓴다.

### 구조적 부담

- **90일 만료가 구조적이다.** 킷 문서가 "그게 정상 운영 상태"라고 인정한다. 팀원별로 다른 날 `npm i`가 터진다.
- **`oc-board-front`는 개인 레포**(`jiran-dotdotot/…`)이고 패키지는 조직 소유다. 문서 권장 방식(패키지 Actions access에 레포 등록)이 조직 밖 개인 레포에 적용되는지 **확인 못 했다**. 불가하면 90일마다 갱신하는 PAT를 레포 시크릿에 둬야 한다 → **CI 붙이기 전에 조직 이전 여부를 결정하는 게 싸다.**
- 현재 `oc-board-front`에 `.github/`가 없어 지금은 CI 리스크 0이다.
- ⚠️ 인증 없이 `npm ci`가 401이면 `build-before-push.sh`가 **모든 push를 차단**한다.

---

## 5. 판정 ③: 배선 — **문서대로 하면 이 프로젝트에서는 깨진다**

여기가 이번 조사에서 가장 값진 발견이다. 셋 다 **빌드는 성공하고 린트·타입체크도 통과한다.**

### 5-1. F-1 (심각도 높음) — 우리 Prettier가 문서 지시를 되돌린다

킷 README와 `consumer.md`는 `main.tsx`에서 앱 CSS **뒤**에 킷 CSS를 import하라고 한다. 그렇게 넣고 저장하면:

```
# before                                    # after prettier --write
import './index.css'                        import '@jiransoft/oc-ui-kit/styles.css'
import '@jiransoft/oc-ui-kit/styles.css'    import './index.css'
```

원인은 `.prettierrc`의 `importOrder` 5번째 항목 `".*styles.css$"`가 마지막 그룹 `"\\.css$"`보다 **먼저**라서다. 그리고 우리 `CLAUDE.md`는 **"Never reorder imports by hand"**라고 못 박고 있어 손으로 되돌리는 것도 금지다.

→ **문서대로 배선하면 저장할 때마다 깨진다.** 킷 문서에도, 우리 문서에도 안 적혀 있다.

### 5-2. 실제로 동작한 배선 (검증됨)

배선을 **전부 CSS 안에** 넣는다. Prettier의 JS import 정렬기는 CSS `@import`를 건드리지 않는다. **`main.tsx`는 손대지 않는다.**

```css
/* src/index.css — 파일 맨 위 */
@layer theme, base, oc-ui, components, utilities;

@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css');
@import 'tailwindcss';
@import 'tw-animate-css';
@import 'shadcn/tailwind.css';
@import '@jiransoft/oc-ui-kit/styles.css';   /* ← 킷을 여기서 */
```

`@layer` 문장을 `@import url()` **앞**에 두는 것은 CSS 규격상 적법하다(cascade-layers 스펙이 허용). Tailwind v4 · lightningcss · Vite 8 전부 경고 0으로 처리했다. `prettier --write` 후 순서 유지 확인.

### F-2 — `@layer` 선언 누락의 증상이 **문서와 다르다**

산출 CSS의 레이어 바이트 오프셋으로 실제 등록 순서를 측정했다.

| 배선 | 실측 순서 | 판정 |
|---|---|---|
| **① 선언 O + 앱CSS→킷CSS** | `properties · theme · base · `**`oc-ui`**` · components · utilities` | ✅ **정답** |
| ② 선언 X + 앱CSS→킷CSS | `components · properties · theme · base · utilities · `**`oc-ui`** | ❌ `oc-ui`가 맨 뒤 |
| ③ 선언 O + 킷CSS→앱CSS | `properties · `**`oc-ui`**` · theme · base · components · utilities` | ❌ `oc-ui`가 `base` 앞 |

- **②의 증상은 문서가 적은 것과 다르다.** 컴포넌트가 「모양 없이」 렌더되는 게 아니라, `oc-ui`가 맨 뒤로 가서 **우리 `className` 오버라이드가 조용히 무시된다**(킷이 이긴다). 우리는 킷 CSS를 나중에 import하므로 ②가 우리 기본 실패 모드다. 문서는 ③만 설명한다.
- ③이 문서가 적은 그 증상(배경·패딩·모서리 없이 렌더)이다. `index.css`에 선언이 있어도 **무력**하다 — 레이어 이름은 처음 등장할 때 순서가 굳는다.
- Tailwind v4/lightningcss는 최종 산출물에서 **`@layer` 문장 자체를 지우고** 블록을 물리적으로 재배치한다. 즉 선언은 먹지만 **산출물에서 눈으로 확인할 수 없다** — 오프셋이나 브라우저 `document.adoptedStyleSheets`로 봐야 한다.
- 브라우저 실측 최종: `["properties","theme","base","oc-ui","components","utilities"]` ✅
- 오버라이드 계약도 실증했다 — 킷 버튼에 우리 `w-full`을 얹으면 실제로 이긴다(`1429px`). `cn()`이 병합하지 못해도 레이어 순서가 해결한다.

### 5-3. F-6 — `check:scale`이 킷 클래스를 오탐한다

`scripts/check-scale.mjs`의 정규식이 `oc:` 프리픽스를 모른다. `\b`가 `:`와 `r` 사이에서 매칭돼 `oc:rounded-sm`이 그대로 걸린다. 실측 3건 오탐(`oc:text-[13px]`·`oc:rounded-sm`·`oc:bg-blue-600`).

**1줄 수정으로 해결 확인** (검사 전 `oc:` 클래스 제거):

```js
const lines = readFileSync(file, 'utf8')
  .replace(/\boc:[^\s"'`]+/g, '')   // 킷 유틸리티는 킷의 스케일 — 정본표 대상 아님
  .split('\n')
```

### 5-4. 충돌하지 않은 검사기

`check-design-tokens.mjs` · `theme-token-check.sh` · `i18n-check.sh` · `check-commonjs.sh` · `eslint` 전부 EXIT 0.

⚠️ 다만 **안 걸리는 게 좋은 뜻이 아닌 것 두 개**:
- **F-5** — `check-design-tokens.mjs`가 `--oc-*`를 **전혀 모른다.** 킷 토큰 매핑을 빼먹거나 정본이 바뀌어 어긋나도 검사기는 계속 `✅`를 낸다. 정확히 우리 CLAUDE.md가 경고한 "폴백 경고 없이 조용히 틀린 색" 유형이다.
- `i18n-check.sh`는 `locales/*.json` 키만 본다 → 킷의 하드코딩 한국어(§8)를 **CI가 절대 못 잡는다.**
- `theme-token-check.sh`의 awk가 `^\.dark ?\{`라 킷식 다중 셀렉터(`.dark, [data-theme="dark"] {`)를 쓰면 검사가 **가짜 통과**한다.

### 5-5. 그 밖에 실제로 걸린 것

- **F-7** — TanStack 라우트를 추가하면 `npx vite build`를 한 번 먼저 돌려야 한다(`npm run build` = `tsc -b && vite build`라 `routeTree.gen.ts` 없이 tsc가 먼저 실패). 킷과 무관하지만 킷으로 새 화면 만들 때 반드시 만난다.
- 개발 서버는 `block-dev-server.sh`가 막는다 → `vite preview`로 검증했다(허용됨). 킷 문서의 검증 절차는 dev 서버를 전제한다.
- README가 링크하는 `docs/guides/consumer.md`는 `files:["dist"]` 때문에 **tarball에 없다** — 가장 중요한 CSS 배선 지침의 "유일한 출처"가 설치한 소비처에게 **끊긴 링크**다.

---

## 6. 판정 ④: 어색한 부분 — 브랜드·치수 정합

### 6-1. 킷 기본값은 우리 정본과 눈에 보이게 다르다 (브라우저 실측)

| | 우리 정본 | 킷 기본 | |
|---|---|---|---|
| primary (라이트) | `#3362ff` | `#2563eb` | ❌ |
| primary (다크) | `#4b79ff` | `#2563eb` (다크에서도 같은 값) | ❌ |
| card/표면 (다크) | `#26262a` | `#0f172a` (slate-900, 검고 파랗다) | ❌ |
| border (라이트) | 중성 gray 램프 | `#e2e8f0` (slate-200, 푸른 기운) | ❌ |
| success | **`#10bf79`** | **`#15803d`** | ❌ |
| radius | `.5rem` (8px) | `.375rem` (6px) | ❌ |

→ **`--oc-*` 매핑은 「커스터마이즈」(선택)가 아니라 도입 필수 단계다.** 킷 문서는 이것을 선택 절에 둔다.

**다행히 오버라이드는 실제로 동작한다** — 색 18개 + radius 6 + 타이포 10을 전부 재정의해 Chrome에서 라이트/다크 실측 반전 성공. 킷 컴포넌트 색은 **100% 토큰 경유**(하드코딩 팔레트 클래스 0건)라 색이 새는 곳이 없다. 동작 확인된 override CSS는 조사 산출물로 남겨뒀다.

**다크 셀렉터는 배선 0** — 킷은 `.dark, [data-theme="dark"]` 둘 다 보고 `oc:dark:*` 유틸을 **하나도 쓰지 않는다**(전부 토큰 값 뒤집기). 우리 `html.dark`와 그대로 맞는다.

### 6-2. 그대로 넣으면 어색한 곳 — 상위 8개

| # | 증상 | 원인 | 해결 |
|---|---|---|---|
| 1 | **배지가 캡슐 모양** | 킷 `rounded-full` 고정 | 정본은 4px 사각 → `data-slot` CSS |
| 2 | **모든 컨트롤 반경 6px** | 킷은 단일 `--oc-radius` | 정본은 뱃지4/컨트롤8/카드12/모달16 **4단** → 토큰 하나로는 불가 |
| 3 | **버튼·인풋 높이 36px** | 킷 md=36 | 정본 컨트롤 40, 로그인 48. **킷에 48이 없다** → cva PR 필요 |
| 4 | **테이블 행 36px** | 킷 기본 | 우리 목록 44~48. 밀도가 확 바뀐다 |
| 5 | **선택행 = hover 색** | 킷은 둘 다 `--oc-muted` | 정본 hover `gray-100` / 선택 `ov-blue-50`. **다중선택이 안 보인다** |
| 6 | **라이트 hover가 거의 안 보임** | `--oc-muted: #f8fafc`, 흰 카드 대비 **1.02** | 토큰 재정의 |
| 7 | **Dialog·Sheet가 헤더 아래로 깔림** | 킷 `z-50` 하드코딩 vs 우리 `--z-shell` 900 | 실제로 가려진다. `data-slot` CSS |
| 8 | **다크 표면이 검고 파랗다** | `#0f172a` vs 정본 `#26262a` | 토큰 재정의 |

### 6-3. 고칠 수 있는 범위 3분류

| 분류 | 항목 |
|---|---|
| ✅ **`--oc-*` 20줄 한 블록으로 해결** | 색 전부 · 스크롤바 · 딤 · 컨트롤 반경 1단 · press 세기 |
| ⭕ **`data-slot` CSS 심으로 가능** | 반경 4단 · 선택/hover 3단 · z-index · 그림자 · 행 높이 · 배지 모양 |
| ❌ **킷 cva PR 필요** | 컨트롤 높이 32/40/48 · 13px 글자 · primary hover 방향 · 웨이트 700/800 |

**아예 불가능한 항목은 없다.** 다만 ⭕는 킷 문서가 「내부 클래스 의존 금지」라고 하므로 `data-slot` 안정성 보장을 킷 쪽에 요구해야 한다(`CLAUDE.md`가 `data-slot` 변경을 파괴적 변경으로 규정하고 있어 근거는 있다).

### 6-4. 못 메우는 «구조적» 항목

1. **그림자** — `--oc-shadow-*`가 배포 CSS에 **없다**(빌드 시 인라인). 다크 분기도 없다.
2. **`data-size` 미노출** — 사이즈별 CSS 교정이 불가능하다.
3. **z-index** — `z-50`/`z-[100]` 하드코딩. 시트<모달 순서도 킷은 둘 다 `z-50`.
4. **hover/press 토큰 부재** — 정본 `*-hover` 3종을 적용할 곳이 없다. press는 색이 아니라 `filter: brightness()`.
5. **우리 전용 개념 전부** — `l-*` 파스텔 10종 · `on-pastel` · `ov-blue` 알파 틴트 램프 · `*-bg` 상태 세트 · `--scrim-sheet` · `--input` 분리. 킷에 개념 자체가 없다.

### 6-5. 🔴 접근성 — 우리 브랜드가 킷의 AA 계약을 깬다

킷 `tokens.test.ts`는 WCAG 4.5:1을 강제한다. 우리 정본 값을 그대로 덮으면:

| 조합 | 대비 | |
|---|---|---|
| white / success `#10bf79` | **2.40** | ❌ |
| white / warning | **2.25** | ❌ |
| white / danger `#fd4c45` | **3.34** | ❌ |
| white / primary (다크) | **3.83** | ❌ |

**킷 테스트는 자기 파일만 읽으므로 실패시키지 않고 조용히 무효화된다.** 킷은 이 문제를 알고 있어서 success를 `#15803d`로 낮췄다(주석에 대비값 기록).

- success·warning은 **전경만 어둡게** 하면 6.12/6.52로 해결된다(브랜드 색 유지) — 단 정본 「필 위 = white」와 어긋난다 → **A-5, 결정 필요**
- **danger와 다크 primary는 전경색으로 안 된다** → **결정 필요**

### 6-6. 이름 충돌 — 세 체계가 된다

우리 CLAUDE.md가 이미 「두 체계가 같은 이름을 다르게 쓴다」고 경고하는데, 킷이 **세 번째**를 들여온다.

| 이름 | shadcn | OfficeWave 디자인 | 킷 | 위험 |
|---|---|---|---|---|
| **`secondary`** | 회색 배경 | 진한 파랑 `#2341E2` | 회색 표면 | **3파 충돌** |
| **`bg`** | — | 표면(카드·헤더) | 표면 | 우리 `--background`는 **캔버스** — 이름만 보고 매핑하면 정본이 경고한 그 사고 재현 |
| `accent` | 연한 배경 | **초록 = 성공** | — | 기존 함정 유지 |
| `danger` ↔ `destructive` | destructive | `danger` | `danger` | 이름이 달라 오히려 안전 |

킷은 전 토큰을 `--oc-`로 네임스페이스해 **기계적 충돌은 0건**이다(설계 미덕). 위험은 **사람이 매핑을 잘못 적는 것**이고, §5-4의 F-5 때문에 검사기가 못 잡는다.

---

## 7. 컴포넌트별 대체 판정

우리 `src/components/ui/`는 **4개뿐**(Button·Input·Label·Textarea, 총 122줄)이고 그중 런타임에 살아 있는 건 **Button 하나**다. 실제 UI는 도메인 화면 9개 파일 안 **로컬 함수 55개**에 하드코딩돼 있다.

### ✅ 바로 대체 권장 7개 — 이득이 명확하다

`Checkbox` · `Switch` · `RadioGroup` · `Skeleton` · `Spinner` · `Avatar` · `Progress`

근거: 우리 쪽에 **Checkbox 5벌**(크기 18/15/16/18/16px 뒤죽박죽, 2벌은 `CheckIcon` 대신 SVG 인라인) · **Switch 4벌** · **Radio 3벌**이 있다. 12벌 → 3벌로 줄고 접근성도 개선된다(`role="progressbar"` 0곳, `aria-checked`/`aria-pressed` 뒤섞임).

### 🟡 조건부 11개

| 컴포넌트 | 조건 |
|---|---|
| **Dialog / Sheet** | 우리 `fixed inset-0` 14회/8파일, **`role="dialog"` 0곳 · 포커스 트랩 없음 · Escape 핸들러 7파일 복붙.** 접근성 이득이 가장 크다. 단 §10-2 Radix 중복 리스크의 진원지 |
| Badge (46회) · Card (29회) | 모양 차이(§6-2 #1)를 먼저 해결 |
| Tabs | `role="tablist"` 0곳 → 이득 있음 |
| Select · DropdownMenu · Popover | RHF는 `Controller` 필수. **`Select`는 forwardRef조차 아니라** `field.ref`·`onBlur`를 붙일 곳이 없다 |
| Tooltip | 순증(현재 `role="tooltip"`·`title=` 0곳) |
| **Toast** | §9 — 디자인 확정과 충돌 |

### 🔴 대체 부적합 3개

| 컴포넌트 | 이유 |
|---|---|
| **Table** | 우리는 `<table>`/`<thead>` **0곳**, 전부 `grid-cols-[...]` div다. `min-[631px]:grid` ↔ 모바일 flex 한 줄로 **구조가 바뀐다**. `<tr>`에 `display:grid`를 주면 킷 sticky 열이 전제하는 `border-collapse` 격자가 무너진다. 킷이 **안 주는 것**: 체크박스 열 · 공지 고정 · 행 선택 상태 · 3뷰(BOARD/PREVIEW/ALBUM) · 무한스크롤. → **후보는 자료실(DriveScreen) 같은 진짜 표** |
| **Pagination** | 레거시 파리티(10칸 고정 윈도우 · localStorage 영속 · URL 동기화)를 깬다. 킷은 `siblingCount` 기반 «첫·마지막 항상 + 생략»이고 10칸 모드가 없다. 현재 페이지 모양도 다르다(우리 `rounded-full` 테두리+bold / 킷 채운 `bg-primary`). **단 모바일 무한스크롤 병행은 가능하고**(킷이 상태를 안 가짐) `getPageItems()`가 순수 함수로 export돼 있어 계산만 빌려올 수 있다 |
| **ScrollArea** | 직전 커밋 `bed15cb`에서 스크롤바 거터를 손으로 맞췄다 — 되돌리게 된다 |

### 킷에 **없는** 것 — shadcn 전량 대체는 불가

`Textarea`(우리가 쓰고 있다) · `Form*` 래퍼 · Accordion · Command · Calendar · Separator · Slider · Sidebar. `PostForm`에서 킷 Input(36px/`rounded-oc`)과 로컬 Textarea(`rounded-md`)가 나란히 어긋난다.

### Button 실측 — import 교체만으로는 안 된다 (F-3)

| | 우리 | 킷 |
|---|---|---|
| variant | `default` `outline` `secondary` `ghost` `destructive` `link` | `primary` `secondary` `outline` `ghost` `danger` |
| size | `default` `xs` `sm` `lg` `icon` `icon-xs` `icon-sm` `icon-lg` | `xs` `sm` `md` `lg` + `iconOnly` |
| 기본 높이 | `default` = **32px** | `md` = **36px** |

- `default`→`primary`, `destructive`→`danger` **이름 변경 필요**(타입 에러로 잡힌다)
- **`link` variant는 킷에 없다**
- 아이콘 버튼은 `size="icon"` → `iconOnly` + `size`로 **API 모양이 다르다**. 킷엔 `[&_svg]:size-4` 자동 크기가 없어 크기 클래스 없는 아이콘이 원본 크기로 커진다
- ⚠️ **같은 이름 `sm`이 우리 28px ↔ 킷 32px** — 이름이 통과해도 높이가 4px 바뀌고 **타입이 못 잡는다**
- **킷 Button은 `type` 기본값이 `"button"`** — 폼 안의 `type` 없는 `<Button>`이 submit을 멈춘다

실측으로는 `'default'` → `'primary'` **한 단어 수정 후 EXIT 0**이었다(호출부가 5곳뿐이라 실제 비용은 작다).

### 그 밖의 API 함정

- **`Input`** — addon(`icon`/`startLabel`)을 주면 **테두리가 래퍼로 옮겨가 `className`이 상자에 안 닿는다** → `fieldClassName` 필수. `text-base md:text-sm`→`text-sm` 고정이라 **iOS 모바일 자동 줌이 재발**한다
- **`Label`** — 킷은 네이티브 `<label>`(Radix 아님). `flex items-center gap-2`와 `peer-disabled:`가 없다
- **`--oc-control-lh`** — Checkbox/Switch/RadioGroup 라벨 정렬이 `styles/index.css`의 이 변수에만 의존. `tokens.css`만 import하면 **높이 0으로 붕괴**
- **컴파운드 루트 이름이 shadcn과 다르다** — `SelectRoot`/`TabsRoot`/`RadioGroupRoot`. 같은 이름 `Select`/`Tabs`/`RadioGroup`은 `options`/`items` spec 컴포넌트라 shadcn 예제를 붙이면 타입 에러가 난다
- **`cn` 두 벌** — 킷 `cn('p-2','p-4')` = `"p-2 p-4"`(병합 죽음). **킷 `cn` import 금지를 규칙으로 못박을 것**
- ⚠️ **`className`에 `oc:` 금지** — `oc:size-[100px]`은 배포 CSS에 없는데 병합기가 기본 크기를 지워 **컴포넌트가 0×0으로 사라진다**. 안전망은 `Icon`·`Spinner`뿐

---

## 8. 아이콘 — **전면 교체 불가**

전제 정정: **우리는 lucide-react를 쓰지 않는다.** `src/` 안 import 0건, `package.json`에만 있는 **죽은 의존성**이다. 실제 체계는 「자체 svg 55종, 147회 사용, 미사용 0개」 단일이다.

| 블로커 | 내용 |
|---|---|
| **없는 것 13종 = 호출부 28곳** | `BookmarkIcon`(6) `DriveIcon`(4) `HeartIcon`(3) `Person/Org/ScopedIcon`(5) `HomeIcon`(2) `ArrowIcon`(2) `Menu` `Logout` `Folder` `Filter` `Building` `Zoom`. `home`/`bookmark`/`filter`/`menu`/`logout`/`building`은 킷 전체 grep **0건** |
| **크기 스케일 충돌** | 킷 `{sm:16, md:20, lg:24}` vs 우리 정본 `12/14/16/20/24`. 우리 기본값 26/49(53%)·호출부 20/28(71%)이 **12·14px** → 킷 `size` prop으로 표현 불가 |
| **우회도 안 된다 (실측)** | `extendTailwindMerge({prefix:'oc'})`는 프리픽스 없는 `size-3`을 인식 못해 `oc:size-5 size-3`을 **둘 다 남긴다**. 명시도 동일 → CSS 로드 순서가 크기를 결정. `oc:size-3.5`를 쓰면 `oc:size-5`는 지워지는데 대체 규칙이 배포 CSS에 없어 **0×0으로 사라진다**. 킷 `create-icon.tsx` JSDoc의 「`size-*`는 병합된다」 주장은 **틀렸다** |
| **동명이물** | **`BoardIcon`** — 우리=접힌 문서, 킷=게시판+화살표. 동명 21종 중 유일한 실제 충돌이고 **타입 에러가 안 난다** |
| **시각 불일치** | 킷 20종은 **채움 전용**(stroke 없음), 18종은 stroke 비율이 정본 밖. 우리 55종은 전부 24-box 아웃라인 |
| **세대 차이** | 킷은 `client-web` 자산 포팅(브랜드 블루 `#3362ff`), 우리 정본 `#4B79FF`. 킷에 `LICENSE` 파일 없음 → **A-6** |
| **검사 공백** | `check-scale.mjs`는 `walk('src')`라 킷 아이콘을 검사하지 않는다 → **정본 위반이 CI를 통과한다** |

### 권고

**`multicolor` 61종만 부분 도입** (`File*` 32 + `Category*` 29). 우리에게 대체물이 없고, 색 고정이 여기서는 **의도된 동작**이라 토큰 충돌이 없다. 단색 90종은 도입하지 않는다.

⚠️ `BookmarkIcon` 교체는 직전 커밋 `bed15cb`「즐겨찾기 아이콘 통일」을 **되돌린다** → 사용자 확인 대상.
부수: **`lucide-react` 제거 후보**(`components.json`의 `iconLibrary` 참조 확인 필요).

---

## 9. i18n · 접근성

### i18n — 블로커는 아니지만 조용한 회귀가 있다

화면에 **보이는** 문자열은 100% prop 주입 가능하고 `changeLanguage`에도 정상 반응한다. 다만 기본값이 전부 한국어라 **모든 호출부가 `t()`를 넘겨야** 한다.

| 항목 | 상태 |
|---|---|
| prop으로 덮을 수 있음 | `labels`(Pagination) · `confirmLabel`/`cancelLabel` · `emptyText`/`searchPlaceholder` · Toaster `label` · TableEmpty children |
| ❌ **주입 불가 4건** | `aria-label="닫기"` (Dialog · Sheet · Toast) + Toast action 폴백 `'작업 실행'`. `grep closeLabel` → **0건** |
| 우회 | Dialog/Sheet는 `hideCloseButton` + `DialogClose`로 가능. **Toast는 우회 불가** |
| `<nav aria-label="페이지 이동">` | `labels`에 키가 없다 |

**핵심 비대칭**: 못 고치는 게 전부 `aria-label`이라 **스크린샷·Playwright·사이티드 QA에 안 잡히고** en/ja 스크린리더 사용자만 맞는다. 우리는 `common-close: "닫기"`를 이미 3로케일로 갖고 있는데 주입 경로가 없다. `i18n-check.sh`는 `locales/*`만 보므로 **CI가 절대 못 잡는다.**

→ **대응**: 앱 래퍼 한 겹에서 기본 prop을 `t()`로 채운다. 나머지 4건은 **킷 PR 대상**(`closeLabel` prop 추가).

부수 이득: **`lib/hangul.ts`의 `hangulMatch()`**(초성 검색, `'ㄷㅈ'`→`'디자인'`)는 우리 조직도/게시판 검색에 바로 쓸 만하다. ja/en은 대소문자무시 substring으로 degrade — 퇴행 없음.

### 접근성 — 이득이 크지만 **후퇴 3건**을 막아야 한다

**얻는 것** (우리 쪽 현황이 나쁘다): `role="dialog"` 0곳 · 포커스 트랩 없음 · `role="tablist"` 0곳 · `role="progressbar"` 0곳 → Radix 위임으로 전부 해결. 포커스 링은 킷이 전 조합 3:1 초과(라이트 4.72~5.17, 다크 5.75~7.02)로 라이트/다크 짝까지 정의돼 있다. `Icon` role/aria-hidden/focusable 3종, `Tabs iconOnly` sr-only 라벨, **Toast variant별 아이콘 형태 차이**(1.4.1 통과), `aria-current`/`aria-sort` 자동.

**후퇴 위험** (우리 규칙: 「접근성은 어느 소스가 뭐라 하든 후퇴시키지 않는다」):

| # | 항목 | 실측 |
|---|---|---|
| 1 | **`prefers-reduced-motion` 전무** | 킷 배포물에 0건. Skeleton 1.6s · Spinner · Progress 무한 애니메이션이 계속 돈다(2.2.2). **우리 `Toast.tsx:22`는 이미 `motion-reduce:animate-none`을 달고 있어 명확한 후퇴다.** → 앱 **레이어 밖** CSS 한 벌로 막을 수 있다(킷이 `index.css`에서 계약으로 보장) |
| 2 | **`--oc-border` 대비 1.23:1** (다크 1.72) | Input/Select 테두리가 컴포넌트 경계의 유일한 시각 정보인데 **1.4.11 미달** → 토큰 재정의로 해결 |
| 3 | **표 선택행 1.046:1** (다크 1.22) | `[data-selected]`와 `:hover`가 **같은 `--oc-muted`** → 선택/hover 구분 불가. 다중선택 파괴적 작업 화면에 직결 → **Checkbox 열 동반 필수** |
| 4 (경미) | `TableEmpty` 라이브 리전 없음 | N건→0건 전환이 SR에 무음(우리 4화면). `role="status"` 주입 가능 |

**소비처 책임으로 남는 것**: `Badge` variant는 순수 색상(icon prop 없음), `Input`/`Select` 오류는 시각적으로 색만 — `aria-invalid`로 프로그램적 전달은 되나 **오류 문구를 강제하는 `error` prop·FormField가 킷에 없다.**

### Toast — 디자인 확정과 충돌한다

`useToast.ts:13-16`에 「하단중앙 · 성공 3s/에러 5s · 스택 없이 1개 교체」가 **갤러리 4 확정**으로 박혀 있다. 킷 기본은 bottom-right · 5000ms · limit 3 스택이다.

- 규약은 어댑터로 지킬 수 있다(고정 `id` = 갈아끼움 + 톤별 duration)
- 그러나 **카드 모양이 다르다** — 킷은 variant마다 배경 전체가 색, 우리는 중립 어두운 카드 + 아이콘만 색 → **결정 필요**
- 이득은 크다: `toast()`가 훅이 아니라 **함수**라 `apiClient` 인터셉터에서 바로 부를 수 있다(현재 prop 드릴링보다 확실히 낫다). Toaster 중복은 방어돼 있고(먼저 마운트된 하나만 + `console.warn`) SSR도 안전

---

## 10. 걸리는 부분 — 리스크

### 10-1. 성숙도: 코드 4.5 / 운영 1.5 → **종합 3/5**

유능한 저자 + 규율 있는 코드지만 **3일차 · 소비처 0곳** 라이브러리다.

| 지표 | 실측 |
|---|---|
| 저장소 생성 | **2026-08-28 (조사 시점 생후 6일)** |
| 커밋 | 34개, 그중 **26개가 하루(09-01)에** |
| 기여자 | **1명** (bus factor 1) |
| 역대 PR | **0건** — 전량 셀프 머지, 브랜치 `develop` 하나 |
| 역대 이슈 | **0건** |
| 실사용 소비처 | **org 전체 0곳** (로컬 13 클론 + `gh api search/code` 확인. 히트 1건은 킷 자신의 package.json) |
| 릴리스 노트 | 없음 (Draft `0.0.1` 하나뿐) · CHANGELOG 없음 |
| PR 게이트 CI | **없음** — 트리거가 `tags: ['v*']`뿐. 로드맵에 미완으로 적혀 있고 사실이다 |
| 코드 품질 | 컴포넌트 24개 **전부 테스트 있음**(누락 0) · `src` TODO/FIXME **0건** · TSDoc `@default` vs 실제 기본값 불일치 **0건** |

**로드맵의 마이그레이션 대상도 미시작이다** — `oc-web-backoffice`는 자체 shadcn ui 18개를 갖고 킷 의존 0, 최근 커밋 12건 전부 무관. 그리고 **`admin_react`는 org에 없는 레포명**이다(전 레포 목록 확인).

「사내 공용」은 다소 과장이다. 사내 프론트 9개 중 **Vue 2개는 원리적 불가**, `oc-web-messenger`는 React지만 Radix 의존 0·headlessui·Next 14로 실질 제외 → 실사용 후보 **6/9**. 다만 「React 18/19 · Tailwind v3/v4 모두」 주장은 **사실이고 실제로 필요하다**(React 19×4/18×3, v4×5/v3×4).

### 10-2. 🔴 Radix 중복 — 시한폭탄 (실측 재현됨)

우리 앱은 **우산 패키지** `radix-ui@1.6.7`을 쓰고, 그 우산은 하위 Radix를 **정확 버전**으로 박는다. 킷은 **캐럿**(`^1.1.23`)을 쓴다.

오늘은 최신이 정확히 1.1.23이라 두 요구가 한 점에서 만나 **dedupe 된다(중복 0건 확인)**. 그런데 `radix-ui@1.6.6`으로 미래 시나리오를 **실제로 재현했더니**:

```
$ npm ls @radix-ui/react-dialog
├─┬ @jiransoft/oc-ui-kit@0.1.5
│ └── @radix-ui/react-dialog@1.1.23      ← 킷의 ^1.1.23
└─┬ radix-ui@1.6.6
  └── @radix-ui/react-dialog@1.1.22      ← 우산의 정확 핀
→ 물리적 복사본 2개
```

**발생 조건**: Radix가 패치를 하나 내거나, 우리가 `radix-ui`를 올리거나 킷이 안 올리거나 — 즉 **lockfile을 새로 뽑는 아무 날**에 터진다.

**깨지는 방식**: Radix는 컴포넌트 간 통신을 React context로 한다(`createContextScope`). 복사본이 2개면 context identity가 갈라져서 —
1. **런타임 크래시** — 킷 `<DialogContent>`를 앱 `<Dialog.Root>` 안에 넣으면 `must be used within <Dialog.Root>`. **타입도 빌드도 통과하고 그 화면 열 때만 터진다**
2. **조용한 오작동** — `react-focus-guards`/`react-dismissable-layer`가 모듈 스코프 카운터를 쓰므로 포커스 트랩이 안 풀리거나 ESC가 바깥 레이어를 안 닫는다
3. 번들에 Radix 트리가 두 벌

**완화 (전부 우리 몫)**:
- **오버레이를 섞어 쓰지 않는다** — 모달·드롭다운·툴팁은 전부 킷에서만. 섞지 않으면 1·2는 발생하지 않는다
- 앱 `package.json`에 `overrides`로 Radix를 한 벌 고정
- 또는 킷이 Radix를 `peerDependencies`로 내린다(킷 수정 필요)

**참고**: 킷은 Radix를 번들하지 **않는다**(tsup이 자동 외부화, 산출물로 확인 — `grep createContextScope dist/index.js` → 0). 이건 올바른 선택이고, 번들했다면 시한폭탄이 아니라 **상시 버그**였을 것이다.

### 10-3. 🔴 자체 semver 정책을 **2회 위반**, 둘 다 patch로

`release.md §2`는 "prop 이름 변경 = major, 절대 minor로 넘기지 마라"인데:

| 버전 | 커밋 | 위반 | 마이그레이션 노트 |
|---|---|---|---|
| **0.1.5** (patch) | `fe5a64b` | `closeOnOutsideClick` → `dismissableMask` **별칭 없이 rename** | 있음 |
| **0.1.1** (patch) | `14b99bb` | Button `size="icon"` **제거** + `sm`의 `text-xs`→`text-sm` | **없음** |

그리고 README 권장 핀이 바로 `^0.1.0`이다 → **자동 수신.** 문서가 스스로 경고한 "말없이 깨짐" 조건이 그대로 성립한다.

→ **`0.1.5` 정확히 핀. `^` 금지.**

### 10-4. 오버레이 + 다크 토큰이 반복 파손 영역

0.1.2 이후 15커밋 중 **6개(40%)가 오버레이**, 그중 4개가 화살표·hover 수정(`83b7617` 화살표 흔들림, `bec6cae` 다크에서 메뉴 hover 안 보임). Radix 15개를 `^`로 고정하는데 **`dependabot.yml` 없음** + Radix 업그레이드 정책 문서 부재.

→ **버전 업마다 다크 · 오버레이 화살표 육안 확인이 필요하다.**

### 10-5. 문서 사실오류 — 우리도 같은 실수를 한 적이 있다

| 항목 | 실태 |
|---|---|
| `Introduction.mdx:124` | AlertDialog 닫힘을 "**버튼만**"이라 적었으나 실제로 Esc로 닫히고(`alert-dialog.tsx:338`) `dismissableMask`도 있다. **0.1.5 README가 "고쳤다"고 한 그 오류가 첫 페이지에 잔존** |
| 컴포넌트 개수 | mdx 20 · README 21 · 표 나열 22 · **실측 24**. `Pagination`·`Toast`가 **어느 목록에도 없는데** `src/index.ts`는 export한다 |
| "git dependency" 서술 | `AGENTS.md:4`·`CLAUDE.md:3`에 살아 있으나 `docs/AGENTS.md:50`은 "검토 후 탈락, 되살리지 마세요". **`CLAUDE.md` 자기모순** |
| "Tailwind 없어도 된다" | ↔ "크기·여백은 앱 Tailwind로 쓰세요"(`Introduction.mdx:11` vs `:188`). 우리는 v4라 실질 영향 없음 |
| README 토큰 목록 링크 | `src/styles/tokens.css`를 가리키는데 `files:["dist"]`+private라 소비처에서 안 열린다. 정답은 `@jiransoft/oc-ui-kit/tokens.css` |
| `@source` 밖 스캔 | CLI 자동 탐지가 `docs/**/*.md`까지 훑어, `development.md`가 «하면 안 되는 예»로 적어둔 `oc:bg-blue-600`·`oc:bg-[#2563eb]`가 **실제로 배포 CSS에 들어간다** |

→ 정본은 **카탈로그(<https://oc-ui.jiransoft.app>)와 `src/index.ts`**로 봐야 한다.

### 10-6. 우리가 필요한 게 킷에 없을 때

**기계적으로는 빠르다** — 실측 태그 간격 `v0.1.3`→`v0.1.4` **13분**, 3일간 태그 6개. variant 1개 추가면 당일, 새 컴포넌트는 0.5~1일.

**병목은 사람과 러너다**:
- 커밋 34개 전부 1인
- 릴리스가 **셀프호스티드 러너(`dev-ec2`) 1대**에서 돌고, 문서에 「러너가 꺼져 있으면 잡이 실패가 아니라 **큐에 쌓인 채 대기**」
- **우리가 직접 PR 하는 절차가 문서에 없다** — `CONTRIBUTING`·이슈/PR 템플릿 없음, PR 게이트 워크플로 자체가 TODO
- `0.x` 특례로 `^0.1.5`는 `0.1.x`만 받는다. 컴포넌트/prop 추가는 정책상 minor → **매번 range 수동 bump**

**기다리는 동안 막히지는 않는다**: 컴파운드 export + `cn` + `*Variants`로 자체 조립, `npm link`/`npm pack` 선반영이 문서화돼 있다. 그리고 우리가 **1차 적용 대상**이라 요구 반영 여지가 크다 — 반대로 그래서 **API가 움직인다**.

### 10-7. 잡다한 것

- 라이선스 **`UNLICENSED`** (LICENSE 파일 없음) — 사내 전용, 외부 배포 불가. SCA 게이트를 붙일 계획이면 예외 등록 필요
- tarball unpacked 2.1MB 중 **57%(1.19MB)가 소스맵**. 런타임 비용은 아니라 낮은 우선순위
- `overrides: { esbuild }`는 소비처에 **전파되지 않는다** — 좋은 쪽으로는 킷이 우리 트리에 간섭 못 하고, 나쁜 쪽으로는 그게 취약점 패치였다면 **우리는 보호받지 못한다**
- `legacy-peer-deps=true`가 켜져 있어 peer 충돌 **경고조차 안 난다**. 지금은 무해하지만 안전망이 꺼진 상태다
- `check-scale.mjs`/`check-design-tokens.mjs`는 **어떤 게이트에도 배선돼 있지 않다**(수동 실행 전용)
- `AppShell.tsx`의 `<header`/`<aside`/`<main`에 `bg-card`를 **정규식으로 요구**하는 하드코딩 검사가 있다 → 셸을 킷으로 재구성하면 깨진다

---

## 11. 권고

### 반대 방향 근거도 함께 봐야 한다

이 조사에서 **킷을 옹호하는 사실**이 두 개 나왔다.

1. **우리 쪽 중복이 심각하다** — Checkbox 5벌 · Switch 4벌 · Radio 3벌 · `FieldError` 2벌 · `CommentCount`/`DateChip`/`EmptyState` 각 2벌. `role="dialog"` 0곳 · 포커스 트랩 없음 · Escape 핸들러 7파일 복붙.
2. **정본 규율은 킷이 우리보다 낫다** — 임의 px이 **킷 3건 vs 우리 앱 413건**. 컨트롤 높이도 우리 쪽이 정본 32/40/48을 더 많이 벗어난다(`h-9` 17곳 · `h-[38px]` · `h-[46px]`).

즉 도입의 가장 강한 근거는 «디자인 통일»이 아니라 **«중복 제거 + 접근성»**이다.

### 단계별 채택 (권고)

**0단계 — 배선 (반나절)**
1. classic PAT 발급 + `~/.npmrc` (§4)
2. `.npmrc`에 `@jiransoft:registry` 한 줄 커밋
3. `npm i @jiransoft/oc-ui-kit@0.1.5` — **정확 핀, `^` 금지** (§10-3)
4. `src/index.css` 맨 위 `@layer` 선언 + 킷 CSS를 CSS 안에서 `@import` (§5-2)
5. `--oc-*` 매핑 블록 작성 (§6-1) — **필수 단계다**
6. `check-scale.mjs`에 `oc:` 제외 1줄 (§5-3)
7. `package.json`에 Radix `overrides` 한 벌 고정 (§10-2)
8. `prefers-reduced-motion` 보정 CSS 한 벌 (레이어 밖) (§9)
9. `check-design-tokens.mjs`를 `--oc-*`까지 검사하게 확장 (§5-4 F-5) — **이게 없으면 5번이 조용히 썩는다**
10. ⚠️ **그 검사기를 실제 게이트에 배선** — `check:tokens`/`check:scale`은 현재 **hook·husky·CI 어느 경로에도 걸려 있지 않다**(수동 실행 전용, `.github/workflows` 자체가 없다). 배선 없이 확장만 하면 아무것도 막지 못한다 (§14-2)

**1단계 — 이득이 명확한 7개만 (1~2일)**
Checkbox · Switch · RadioGroup · Skeleton · Spinner · Avatar · Progress
→ 중복 12벌 → 3벌. 접근성 개선. 디자인 리스크 최소.

**2단계 — 오버레이 (접근성 이득 최대)**
Dialog · Sheet · Popover · DropdownMenu · Tooltip
→ 규칙: **오버레이는 전부 킷에서만.** 앱 Radix와 섞지 않는다(§10-2).
→ 자작 `OrgPickerModal` + `useBodyScrollLock`을 여기서 정리한다.

**3단계 — 조건부**
Badge/Card(모양 결정 후) · Tabs · Select(Controller 배선) · Toast(디자인 결정 후) · Table(자료실 한정)

**도입하지 않는다**
Pagination(레거시 파리티) · ScrollArea(직전 커밋 되돌림) · 게시판 목록 Table · 단색 아이콘 90종

**킷에 요청할 것 (PR 또는 이슈)**
- `closeLabel` prop (Dialog/Sheet/Toast) — i18n 결함 (§9)
- `prefers-reduced-motion` 대응
- `--oc-border` 대비 (1.4.11)
- 표 선택행 ≠ hover 토큰 분리
- Button `size` 48px · `link` variant
- Radix를 `peerDependencies`로
- `data-slot` 안정성 보장 명문화
- Textarea 추가

### 반대로 «보류»가 맞는 경우

- CI를 곧 붙일 계획이고 조직 이전이 어렵다면 → 토큰 운영 부담이 이득보다 클 수 있다 (§4)
- 리뉴얼 화면 작업이 급하다면 → 0단계 9개가 반나절이고 1·2단계가 며칠이다. 지금 화면이 정본과 안 맞는 게 더 급하면 순서를 뒤로

---

## 12. 결정 필요 (코드 쓰기 전에)

| # | 결정 | 왜 물어야 하나 |
|---|---|---|
| D-1 | **도입 범위** — 0+1단계만? 2단계까지? 전면? | 되돌리기 비용이 단계마다 다르다 |
| D-2 | **`success` 대비** — 정본 `#10bf79` + white는 **2.40:1로 AA 미달**. 전경을 어둡게(6.12, 브랜드 유지) vs 킷 `#15803d` 채택 vs 현행 유지 | **접근성 후퇴 여부** — 어느 소스가 뭐라 하든 후퇴 금지 규칙 대상. A-5 |
| D-3 | **`danger` / 다크 `primary` 대비** — 전경색으로 해결 안 된다 | 같은 이유 |
| D-4 | **Toast** — 갤러리 4 확정(하단중앙·3s/5s·1개 교체)을 킷 카드 모양으로 바꾸나? | **사용자가 직접 정한 값을 되돌리는 변경** |
| D-5 | **Pagination** — 레거시 파리티(10칸·localStorage·URL 동기화)를 킷 방식으로 바꾸나? | **레거시 동작과 킷이 어긋난다** |
| D-6 | **`BookmarkIcon`** — 킷엔 없다. 자체 유지 확정? | 직전 커밋 `bed15cb`를 되돌리게 된다 |
| D-7 | **`--oc-secondary` 값** — 정본은 `secondary`=`muted`=`gray-100` 동일인데 킷은 달라야 한다 | **서버/정본에 근거가 없어 값을 발명해야 한다.** A-4 |
| D-8 | **배지 모양** — 킷 캡슐 vs 정본 4px 사각 | 디자인에 있는 UI를 바꾸는 결정 |
| D-9 | **`lucide-react` 제거** | 죽은 의존성이지만 `components.json`이 참조한다 |
| D-10 | **조직 이전** — `oc-board-front`를 `jiransoft` org로? | CI 인증 구조가 여기서 갈린다 (§4) |

---

## 13. 근거

에이전트 18대의 상세 보고서 (세션 스크래치패드, 총 8,293줄):

| # | 담당 | 파일 |
|---|---|---|
| 01 | 킷 의도·문서 계약 | `01-intent-docs.md` |
| 02 | 소비처 가이드 전문 | `02-consumer-guide.md` |
| 03 | 인증·릴리스·CI | `03-auth-ci.md` |
| 04 | 킷 토큰·CSS 체계 | `04-kit-tokens.md` |
| 05 | 우리 토큰 체계 | `05-app-tokens.md` |
| 06 | 토큰 값 대조 + override 실측 | `06-token-conflict.md` |
| 07 | 우리 컴포넌트 현황 | `07-app-ui-inventory.md` |
| 08 | 킷 입력 컴포넌트 API | `08-kit-api-forms.md` |
| 09 | 킷 오버레이·데이터 API | `09-kit-api-overlays.md` |
| 10 | 패키징·번들·의존성 | `10-packaging.md` |
| 11 | 아이콘 대조 | `11-icons.md` |
| 12 | 접근성·다국어 | `12-a11y-i18n.md` |
| 13 | 성숙도·리스크 감사 | `13-maturity-risk.md` |
| **14** | **실증 통합 테스트** | **`14-empirical.md`** |
| 15 | 스택·툴링 마찰 | `15-app-stack.md` |
| 16 | 디자인 정합 | `16-design-align.md` |
| 17 | 사내 소비처 현황 | `17-other-consumers.md` |
| 18 | 킷 개발 가이드 | `18-dev-guide.md` |

**우리 저장소는 읽기만 했다.** 모든 실험은 스크래치패드 복제본에서 했고, 조사 종료 시 `git status`가 세션 시작 스냅샷(`M src/components/home/HomeScreen.tsx`)과 동일함을 확인했다. `node_modules` 447개 · `package.json`/`package-lock.json` 변경 0건.

⚠️ 조사 중 발견: 킷 클론의 `node_modules`가 **우리 앱 `node_modules`로 걸린 심볼릭 링크**였다. 거기서 `npm ci`를 그냥 돌리면 우리 의존성 447개가 날아갈 수 있었다 — 링크만 끊고 앞뒤 개수를 확인한 뒤 진행했다.

---

## 14. 보강 — 보고서 전문 재독 후 추가

§1~§13은 에이전트 요약을 근거로 먼저 작성했다. 이후 `15-app-stack.md`·`05-app-tokens.md` **전문을 다시 읽어** 아래를 추가했다. 요약 단계에서 누락됐거나(§14-1~5) 요약이 잘려 못 본(§14-2, 14-6) 항목이다.

### 14-1. `verbatimModuleSyntax` — 타입 import 형태가 강제된다

우리 `tsconfig.app.json`의 `"verbatimModuleSyntax": true` 때문에 킷 타입을 값으로 import하면 컴파일 에러다 (실측):

```
error TS1484: 'ButtonProps' is a type and must be imported
  using a type-only import when 'verbatimModuleSyntax' is enabled.
```

→ **반드시 `import { Button, type ButtonProps } from '@jiransoft/oc-ui-kit'` 형태.**
`pre-commit`이 `tsc -b --noEmit`을 돌리므로 커밋이 막히고, **자동 수정 장치가 없다**(ESLint `consistent-type-imports` 미설정). 소비 가이드에 명시해야 한다.

참고로 `npm run lint`(ESLint)는 킷 사용 코드에서 실패할 요인이 없다 — import order를 강제하는 ESLint 규칙이 없고(정렬은 Prettier 담당), `@jiransoft/*`는 `<THIRD_PARTY_MODULES>`로 정상 분류된다. **빌드를 막는 건 ESLint가 아니라 tsc다.**

### 14-2. ⚠️ 우리 검사기 2개는 어떤 자동 실행 경로에도 없다

`scripts/check-design-tokens.mjs`와 `scripts/check-scale.mjs`는 **hook·husky·CI 어디에도 배선돼 있지 않다.** `.github/workflows` 디렉터리 자체가 없고, `Definition of Done` 목록에도 없다.

→ §11 0단계의 「검사기 확장」은 **배선까지 해야 의미가 있다.** 이걸 빼면 §6-1의 색 매핑을 지켜주는 장치가 실질적으로 0이 된다.

덧붙여 두 검사기의 기존 사각지대:
- **`.ts` 파일은 `check-scale` 스캔 밖이다**(`.tsx`만). `constants.ts`에 색·px를 넣으면 통과한다
- **`check-scale.mjs`가 `AppShell.tsx` 경로를 하드코딩**한다 — 셸을 킷으로 재구성하며 파일을 옮기거나 개명하면 `readFileSync`가 throw해서 **검사기가 크래시한다**
- **`--control-h-sm/md/lg`는 토큰이 아니다** — 정본 가이드에만 있고 CSS에 없어서 `h-8/h-10/h-12` 관례에 의존한다. 즉 §6-2 #3(컨트롤 높이)을 맞췄는지 검사할 근거가 애초에 없다

### 14-3. `dark:` 신호가 우리와 킷이 다르다 — 지금은 무해, 나중에 갈라진다

| | `@custom-variant dark` 정의 |
|---|---|
| 우리 | `(&:is(.dark *))` — `.dark`의 **자손만** |
| 킷 | `(&:where(.dark, .dark *, [data-theme="dark"], [data-theme="dark"] *))` — 자기 자신 + `[data-theme]`도 |

`html.dark` 토글 방식이면 **둘 다 동작한다**(현재 실사용 경로). 다만 우리가 나중에 `[data-theme="dark"]` 방식으로 갈아타면 **킷만 다크가 되고 우리는 라이트로 남는다.**

→ 우리 variant를 킷과 같은 형태로 넓혀두는 것이 안전하다. 지금 하면 1줄이다.

### 14-4. `.npmrc` 토큰 줄 — 에이전트 2명의 결론이 갈렸다

두 조사가 서로 다른 권고를 냈다. 내가 임의로 한쪽을 고르지 않고 그대로 남긴다.

| 출처 | 권고 |
|---|---|
| `03-auth-ci.md` | 레포 `.npmrc`에 **토큰 줄을 넣지 마라** — 프로젝트 `.npmrc`가 사용자 설정을 이겨서 CI의 `setup-node` 주입을 덮어쓴다 (킷 문서에 실측 표가 있다고 보고) |
| `15-app-stack.md` | `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}` **환경변수 보간 형태로 넣으면** 토큰이 커밋되지 않고 CI에서도 주입된다 |

두 권고가 양립할 가능성이 높다(리터럴 토큰은 금지, `${ENV}` 보간은 허용). **다만 검증하지 않았다** — 0단계에서 실제로 확인할 항목이다.

또한 `.npmrc`는 `CLAUDE.md`의 「편집 전 확인 필요」 목록에 **없다.** 성격이 `.env*`와 같으므로 **목록에 추가할 것을 권한다.**

### 14-5. `shadcn`이 런타임 의존성으로 남는다

`package.json`에 `"shadcn": "^4.17.0"`이 **dependencies**로 들어 있다. `src/index.css`가 `@import 'shadcn/tailwind.css'`를 하기 때문이고, **킷을 도입해도 이건 남는다.** 킷이 shadcn을 대체한다고 정리할 때 이 항목을 빼먹으면 안 된다.

### 14-6. CSS 페이로드 — 측정값이 두 개다

킷 `dist/styles.css`(32.8KB) 안에 Tailwind theme 변수 블록이 한 벌 더 들어 있다(`--oc-color-*` 등 **397개**). 우리 Tailwind theme과 **「내용은 겹치고 이름은 다른」 중복**이라 dedupe가 불가능하다.

gzip 후 크기는 두 조사가 다르게 보고했다 — `10-packaging.md` **6,417 B**(킷 CSS 단독 측정), `15-app-stack.md` **8KB대**(앱 CSS에 합친 뒤 측정). **어느 쪽이든 수용 가능한 범위**이므로 판정을 바꾸지 않지만, §3의 「gzip 6.4KB」는 단독 측정치임을 밝혀둔다.

### 14-7. 킷 CI가 우리 통제 밖이다

킷 릴리스는 셀프호스티드 러너 `[self-hosted, linux, x64, dev-ec2]`에서 돈다. **우리가 킷에 PR을 낼 경우 그 러너가 살아 있어야 게이트가 돈다.** 꺼져 있으면 실패가 아니라 큐에 쌓인 채 대기한다(§10-6).

### 14-8. `CLAUDE.md`에서 갱신해야 하는 규칙 — 전수

킷을 도입하면 아래 규칙들이 현재 문장 그대로는 틀리게 된다.

| 현행 규칙 | 필요한 변경 |
|---|---|
| `src/components/ui/` — "Check here first; add with `npx shadcn@latest add <c>`" | ⚠️ **직접 충돌.** 「킷 먼저 확인 → 없으면 shadcn」 순서로 재작성. `npx shadcn add`는 킷에 없는 것에만 허용 |
| 색 토큰 — 「두 체계가 같은 이름을 다르게 쓴다」 | **세 체계**로 갱신 (킷 `--oc-secondary`=연회색, `--oc-success`=`#15803d` ↔ 우리 `#10BF79`) |
| 「색·치수 정본은 `design-tokens-guide.md` 하나뿐」 | 킷 `tokens.css`가 「공개 계약」을 자칭한다 → **「킷 토큰은 정본이 아니라 매핑 대상」**이라고 못박고 매핑 레이어(`--oc-*: var(--앱토큰)`)를 정본에 명시 |
| Golden Reference (`src/components/board/` + shadcn 폼) | 폼 요소가 킷으로 바뀌면 갱신. react-hook-form + zod 조합은 유지(킷은 폼 상태를 갖지 않음) |
| Files requiring confirmation | **`.npmrc` 추가** (§14-4) |
| Definition of Done | `check:tokens`/`check:scale` 추가 검토 (§14-2) |
| Dependency rule (새 패키지 전 확인) | 킷 도입 자체가 이 규칙의 대상 — 전이 의존성 `cmdk` 1개 + `@radix-ui/*` 15종 동반 |

### 14-9. 조사 방법의 한계 (밝혀둠)

- **파일 전문을 읽은 보고서는 3개**다 — `10-packaging.md` · `14-empirical.md` · `15-app-stack.md`, 그리고 `05-app-tokens.md`의 검사기·리스크 절. 나머지 14개는 **에이전트 요약을 근거로 했다.**
- 즉 §1~§13에는 **위와 같은 누락이 더 있을 수 있다.** 특정 항목을 근거로 코드를 쓰기 전에는 해당 보고서 전문을 확인할 것.
- 우리 프로젝트 자체의 기존 토큰 드리프트 15건이 `05-app-tokens.md` §8에 별도로 정리돼 있다(스크롤바 정본 내부 모순, `--chart-2`가 DS 원본 success 값, 죽은 토큰 3개, 폰트 CDN 의존 등). **킷과 무관한 우리 쪽 숙제**이므로 이 문서에 옮기지 않았다.
