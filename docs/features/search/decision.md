# 통합 검색(/search) — 구현 결정과 정본 편차

작성: 2026-09-09 · 대상: `src/components/search/*` · `src/routes/search.tsx` ·
`src/components/common/{AppShell,Highlight}.tsx` · `src/hooks/useRecentSearch.ts` ·
`src/utils/recentSearch.ts`

## 배경

`/search` 라우트와 `SearchScreen.tsx`(342줄)는 있었지만 **디자인 목업 그대로의 정적 화면**이었다.
`searchData.ts` 하드코딩 데이터를 렌더하고 API·URL 쿼리·핸들러가 하나도 없었다. `AppShell` 헤더의
검색 input 도 `value`/`onChange`/submit 이 없는 죽은 마크업이고, 「검색」 버튼은 `<Link to="/search">`
라 **입력값을 버리고** 이동했다.

Go 에는 **통합 검색 엔드포인트가 없다**(`docs/api/go/**` 전수 확인 — 경로에 `search` 가 들어가는
엔드포인트는 최근검색어 PUT 하나뿐). 게시글·자료 목록을 각각 호출해 탭으로 합친다.

## ⚠️ 1차 구현은 «틀린 디자인 보고» 위에 세워졌다

첫 라운드의 디자인 조사를 서브에이전트에 맡겼는데, 그 에이전트는 `DesignSync` 를 로드할 수 없어
(서브에이전트에는 그 MCP 툴이 노출되지 않는다) **같은 날 11:36~11:37 의 캐시된 tool-result 파일**을
읽고 보고했다. 그 결과 「통합 앱 mobile 에는 상세 필터가 아예 없다」는 **사실오류**가 결정 근거로
들어갔고, 사용자 결정 1건(모바일 = 칩 + 바텀시트)이 그 오류 위에서 내려졌다.

사용자 지적(「클로드 디자인보면 검색 디자인을 이렇게 진행하지 않았는데?」) 후 내가 직접 두 정본
파일을 받아 `jq -r '.content'` 로 scratchpad 에 풀고 grep 해 다시 확인했다. **실제 정본:**

| 항목 | 실제 정본 (웹·모바일 둘 다) |
| --- | --- |
| 상세 필터 | 모바일에도 **있다**. 바텀시트가 아니라 **인라인 아코디언** |
| 필터 토글(⚙) | **검색바 «안»**. 지우기 X 다음, 「검색」 버튼 앞 |
| 필드 라벨 | 컨트롤 **위** (12px / 600 / gray-500 · gap 6) |
| 웹 그리드 | `repeat(auto-fit, minmax(230px, 1fr))` · `gap: 14px 24px` |
| 모바일 그리드 | 1열, 하단 버튼 풀폭 40px (초기화 `flex:1` : 적용 `flex:2`) |
| 적용된 필터 칩줄 | 「모두 지우기」와 함께 **양쪽 정본에 있다** (→ 미구현, 아래 참고) |

교훈은 메모리(`oc-board-design-source`)에 기록했다 — **디자인 정본 확인은 위임하지 않는다.**

## 디자인 소스 대조

| 소스 | 필터 패널 | 비고 |
| --- | --- | --- |
| `개선안 통합 앱.dc.html` | 검색바 내 ⚙ → 인라인 아코디언. 위치·작성자·검색대상칩·기간칩 + 직접입력. 라벨 위, auto-fit 2열 | **정본**. 옵션 문자열이 전부 `sc-for` 바인딩이라 **리터럴이 없다** |
| `개선안 통합 앱 mobile.dc.html` | 같은 아코디언, 1열 + 풀폭 버튼 | 래퍼가 아니라 구조가 다르다. 이 파일에만 `data-dc-script` 블록이 있다 |
| `화면 06_검색.dc.html` | 기간 프리셋5 + 커스텀 레인지 · 게시판 드롭다운 · 작성자 | per-screen 아트보드 — 리터럴·기본 state 가 여기 있다. 단 통합 앱보다 이전 안일 수 있다 |

## 사용자 결정

1차(구현 전 질의):

| # | 결정 |
| --- | --- |
| 1 | 필터 패널 = **두 디자인의 합집합** (검색대상·댓글포함·위치·작성자 + 기간 프리셋·직접입력) |
| 2 | **페이지네이션 유지 + 정렬만** 추가. 「개수」·「안읽음」 드롭다운 생략(개수는 데스크톱 10 / 모바일 20 고정) |
| 3 | ~~모바일 = 칩 + 바텀시트~~ → **2차에서 폐기**(틀린 디자인 보고에 근거했다) |
| 4 | 최근 검색어 = **localStorage 전용 · 서버값 최초 시드** |
| 5 | 필터 버튼(⚙)을 **헤더에도** 둔다 |
| 6 | 검색 트리거 = **Enter·버튼만** (debounce 자동검색 없음) |
| 7 | 필터는 **「적용」을 눌렀을 때만** URL 에 반영 |
| 8 | URL 쿼리 키는 **새로 정리** (레거시 키 재사용 안 함) |

2차(정본 재확인 후 재질의):

| # | 결정 |
| --- | --- |
| 9 | 모바일 필터 = **정본 인라인 아코디언** (바텀시트·칩줄 폐기 → `Modal` 의 `align` prop 도 되돌렸다) |
| 10 | ⚙ = **검색바 안** + 헤더 ⚙ 도 유지 (결정 5 유지) |
| 11 | 패널 레이아웃 = **정본** (라벨 위 · auto-fit 2열 · 모바일 1열 + 풀폭 버튼) |
| 12 | 기간 **직접입력 유지** (정본 칩에는 없지만 화면 06 과 레거시에 있다) |

## 발명한 값·정본 편차 (근거 없이 내가 정한 것)

| # | 항목 |
| --- | --- |
| 1 | **디자인의 「유형」 칩3(전체/게시글/자료)을 제거하고 결과 탭으로 통합.** 통합앱 정본에 유형칩과 결과탭이 둘 다 있는데 같은 개념이다. 레거시는 이걸 `selectedTypeScope`(초기 조회)와 `type`(탭·페이징) 두 키로 갈라 놔 서로 어긋나는 버그가 있었다(`search.vue:143` vs `:73`) |
| 2 | **기간 기본값 = 「전체」.** 화면 06 목업의 `preset:'1m'` 은 `filterOpen:true` 와 같은 데모 초기 상태값으로 판단했다. 기본 1개월이면 결과가 조용히 좁혀진다. 레거시 기본도 `all` |
| 3 | **최근 검색어 상한 8.** 화면 06 화면노트는 「localStorage 최대 10개」, 같은 프로젝트 `docs/05_search.md` 와 서버 저장 상한은 8 → 다수·서버에 맞췄다 |
| 4 | **「댓글 내용 포함」 칩은 검색 대상이 제목·본문일 때만 렌더.** Go 는 `is_include_comment` 를 `title`/`content`/`title_content` 만 확장하고 `search` 에는 쓰지 않는다([05:279](../../api/go/05-post-read.md#L279)) → 「전체」에서는 효력 없는 컨트롤이 된다 |
| 5 | **커스텀 기간은 브라우저 기본 `<input type="date">`.** 「시작 max=종료 · 종료 min=시작 · 오늘 이후 불가」가 `min`/`max` 로 그대로 표현되고 키보드 접근성이 공짜다 |
| 6 | **하이라이트를 `<span>` 대신 `<mark className="bg-transparent text-primary">`.** 정본은 배경 없는 색 강조인데 그러면 강조가 색 하나로만 전달돼 스크린리더에 아무 정보가 없다. 배경만 지우고 시맨틱은 남겼다 |
| 7 | **「1년」 프리셋 제거.** 레거시 데스크톱에만 있던 옵션이고 정본 칩은 4개다. 직접입력으로 도달할 수 있어 뺐다 |
| 8 | **적용된 필터 칩줄 + 「모두 지우기」 미구현.** 정본 양쪽에 있는 UI 다 — 결정 9 에서 사용자가 칩줄을 «묶은» 선택지 대신 순수 「인라인 아코디언」을 골라 의도적으로 뺐다. 활성 필터 개수는 ⚙ 배지로만 보인다. **정본에 있는 UI 를 뺀 것이므로 되돌릴 후보 1순위** |
| 9 | **자료 행 meta 의 폴더 경로를 게시판 이름으로 대체** → [BR-033](../../api/backend-requests.md#br-033) |
| 10 | **검색어의 `%`·`_` 를 그대로 전송** → [BR-034](../../api/backend-requests.md#br-034) |
| 11 | **최근 검색어 로컬/서버 분기(서버 목록은 계속 누적되고 갈라진다)** → [BR-035](../../api/backend-requests.md#br-035) · [BR-012](../../api/backend-requests.md#br-012) |
| 12 | radius: 정본 아트보드의 8px 패널·카드를 **정본 토큰표의 램프로 정규화**(카드·패널·드롭다운 `rounded-lg`=12, 컨트롤 `rounded-md`=8). 값은 [design-tokens-guide](../../guides/design-tokens-guide.md#L183) 가 이긴다 |

## URL 쿼리 = 상태 정본

`?q=&tab=files&target=title|content&board=&cat=1&writer=&from=&to=&comment=1&filter=1&order=new&page=`

기본값은 URL 에 쓰지 않는다(`tab=posts`·`order=relative`·`page=1`·`target=all` 생략).
탭 전환·정렬·필터 적용 시 `page` 리셋. 파서는 `parseSearchQuery`(`searchParams.ts`).

## Go 파라미터 매핑 — 탭마다 별개의 객체

레거시는 파라미터 객체 하나를 두 스토어에 넘겨, 자료 스토어가 `sort[by]` 를 덮어쓰면 axios 직렬화
전이라 **게시글 요청까지 오염**됐다(`search.vue:158-160` + `stores/drive.ts:188-190`).
`buildPostParams`/`buildFileParams` 는 각각 새 객체를 만든다.

| 조건 | 게시글 | 자료 |
| --- | --- | --- |
| `target` 미지정 | `search` (제목·평문·**작성자** OR) | `search` (파일명·**업로더** OR) |
| `target=title` | `title` | `title` (파일명만) |
| `target=content` | `content` | **조회하지 않음** (파일에 본문 없음) |
| 정렬 relative | `sort[by]=relative` + `sort[value]=q` | 동일 (단 relative = **파일명 분할 수**) |
| 정렬 new | `sort[by]=posted_at` | `sort[by]=created_at` |
| 기간 | `start_posted_at` `00:00:00` / `end_posted_at` **`23:59:59`** — 날짜만 보내면 종료일 하루가 통째로 빠진다([09:140](../../api/go/09-drive-file.md#L140)) | 동일 |
| 절대 안 보냄 | — | `is_only_file_search`(서버 최근검색어 저장 스위치) · `is_not_paging`([BR-032](../../api/backend-requests.md#br-032)) |

**「전체」가 `title_content` 가 아니라 `search` 인 이유**: `search` 는 제목·평문에 **작성자**까지 OR 로
묶은 상위집합이다([05:275](../../api/go/05-post-read.md#L275) vs [:276](../../api/go/05-post-read.md#L276)).

**2자 미만 차단**: Go 는 `search` 1자를 200 + **필터 무시(전체 목록)** 로, `title`/`content` 1자를
**400** 으로 처리한다 — 서로 다르게 실패하므로 요청 자체를 프론트에서 막는다(`isQueryReady`).

**두 탭 모두 조회한다**(정본의 라이브 카운트). 활성 탭만 페이지·모바일 누적을 따르고 비활성 탭은
1페이지만 받는다. 사용자가 실제로 검색을 눌렀을 때만 실행되므로 speculative prefetch 가 아니다.

## 레거시에서 답습하지 않은 것 (전부 확인된 버그·죽은 코드)

- `search.vue:439` 최근어 개별 삭제가 **인덱스**를 넘겨 `indexOf` → `-1` → `splice(-1,1)` → **항상 마지막 항목이 지워졌다**(모바일)
- 공유 파라미터 객체의 `sort[by]` 오염(위 표)
- `SearchInput.vue:265` `writer && writer.length <= 0` — 불가능한 조건이라 **필터 모드의 2자 검증이 무력**
- `selectedTypeScope`(초기 조회) vs `type`(탭·페이징) 이원화
- `new RegExp(userInput,'gi')` **escape 없이** + `v-html` (`SearchPost.vue:24`)
- 모바일 바텀시트에서 `category.boards` 미렌더 → 최상위 카테고리 직하 게시판 **도달 불가**
- 데스크톱 트리의 `is_writable` 필터 → **읽기 전용 게시판을 검색 범위로 고를 수 없었다**
- 데스크톱 헤더 카운트가 `posts.total + files.total`(한 탭만 보이는데 합계)
- `watchEffect` 가 `isChangResultType` 을 항상 true 로 만들어 `onUnmounted` 정리가 **도달 불가**

## 검증

- `npx tsc -b --noEmit` · `npm run lint` · `npm run build` · `npm run test`(147) · `npm run test:e2e`(9) 전부 통과
- 단위: `tests/searchParams.test.ts` — 파라미터 매핑·프리셋 역산·2자 차단·`is_only_file_search` 미전송·객체 분리·최근어 8개 상한
- E2E: `tests/e2e/search.spec.ts` — 헤더 검색 → URL, 탭·필터·정렬의 URL 반영, 새로고침 복원, 1자 차단, 0건 화면
- 실브라우저(`chrome-devtools` MCP, :5174) `getComputedStyle` 실측 — **정본 수정판 기준**:
  - 검색바 48px · `padding: 0 8px 0 14px` · 자녀 순서 `아이콘 → input → 지우기 X → ⚙(36×34) → 검색`
  - ⚙ 열림: 라이트 `bg #f7faff`(ov-blue-50) + `border/text #3362ff`, 다크 `rgba(75,121,255,.16)` + `#4b79ff`. 개수 배지 16px `bg primary` `top/right -6px`
  - 패널: radius 12 · 라이트 `#fff`+`#e5e7eb`, 다크 `#26262a`+`#3c3c43`. 데스크톱 `padding 16px 18px`, 그리드 `349px 349px`(auto-fit) `gap 14/24`
  - 필드 라벨 12px / 600 / 라이트 `#6b7280` · 다크 `#a4a4af`, 컨트롤보다 22px 위
  - 조상 배경 체인: `#search-filter-panel` → `main` 이 둘 다 `--card`, 캔버스(`#f9fafb` / `#1c1c1f`)는 `body` 에서만 나온다
  - 모바일(≤630): 그리드 1열 · `padding 14px` · 하단 버튼 풀폭 40px(초기화 146px : 적용 265px ≈ 1:2) · 검색바와 ⚙ 그대로 노출 · 가로 스크롤 없음
  - 콘솔 error/warn 0건
