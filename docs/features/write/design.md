# 글쓰기(`/write`) 데모 → Go API 실연동 — 설계·결정 기록

- 작업일: 2026-09-10 · 브랜치 `feat/drive-renewal`
- 범위: `src/routes/write.tsx` · `src/components/board/WriteScreen.tsx` · `writePayload.ts` · `NamoEditor.tsx` ·
  `src/components/common/{DatePicker,Radio}.tsx` · `postService.createPost/updatePost` · `usePostWriteMutations`
- 세 소스의 역할: 레거시(`../jupiter-board-web`) = 사실 확인 · 디자인 정본(`개선안 통합 앱[ mobile].dc.html`) = 목표 UI ·
  `docs/api/go/` = 유일한 구현 계약. 갭은 [`design-change-requests.md`](design-change-requests.md)(디자인) ·
  [`backend-requests.md`](../../api/backend-requests.md)(API, BR-037 보강 · BR-042 · BR-043) 에 누적했다.

## ⚠️ 발명한 값·규칙 (정본·Go 계약·지시 어디에도 근거가 없다)

| #   | 가정                                                                                                                       | 근거로 삼은 것                                                                                                                                                  | 위치                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A1  | 「항상 고정」 공지 종료 = 로컬 `2999-12-31T23:59:59`(오프셋 포함)                                                          | Go 는 「명시적 2999년 종료값」만 지시(`06-post-write.md:67`), 복원은 연도 2999 판정(`05-post-read.md:104`). 레거시 `'2999-12-31 23:59:59'`(AddPostView.vue:338) | `constants.ts NOTICE_FOREVER_YEAR`    |
| A2  | 날짜 전송 = RFC3339 + 로컬 오프셋                                                                                          | 공통 파서 3종 중 하나(`06:15`). `YYYY-MM-DD HH:mm:ss` 는 `Time_zone` 헤더 의존                                                                                  | `writePayload.ts toRfc3339Local`      |
| A3  | 기간 공지 = 시작일 00:00:00 ~ 종료일 23:59:59                                                                              | 정본은 시작~종료 두 칩(web:770-774), 레거시는 시작=now·종료=23:59:59(:334-336). Go 는 둘 다 필수(`06:64-65`)                                                    | `writePayload.ts noticeBadge`         |
| A4  | 이탈 확인 = dirty(폼 변경 또는 에디터에 초점을 준 적 있음)일 때만                                                          | 레거시는 무조건(:495). 정본 스크립트는 256KiB 밖이라 조건 불명. docs/03_write.md 「저장하지 않고 나가려 하면」                                                  | `WriteScreen.tsx useBlocker`          |
| A5  | 발행·수정 후 `['post', id]` 를 removeQueries 하고 상세가 1회 fetch(ACT 글 조회수 +1)                                       | write 응답에 관계가 없어(`06:90`) 패치로 화면을 완성할 수 없다. 레거시도 저장 후 상세 1회 조회(:383)                                                            | `WriteScreen.tsx save` · BR-042       |
| A6  | 에디터 무응답 15초 → 저장 중단 + 오류 안내                                                                                 | 레거시는 25초 뒤 «예전 본문»을 저장(:428-441) — 조용한 데이터 손실                                                                                              | `constants.ts NAMO_EDITOR_TIMEOUT_MS` |
| A7  | 나모 호스트 URL 은 상수(`VITE_NAMO_EDITOR_URL` 이 있으면 우선), `.env*` 미편집                                             | `.env*` 편집은 확인 대상(CLAUDE.md)                                                                                                                             | `constants.ts NAMO_EDITOR_URL`        |
| A8  | 예약 시각 = 정본 달력 + 시간 칩 4개 + `<input type="time" step=300>`                                                       | 정본 문구 「5분 단위」와 칩 4개(09/10/14/18)가 모순. 칩만이면 레거시(임의 시각) 대비 회귀                                                                       | `DatePicker.tsx` · 디자인 요청 #6     |
| A9  | 게시판 라벨 = 공용은 `title`, 카테고리 소속은 `카테고리 › 게시판`                                                          | 정본 옵션은 평면 라벨(web:637-643). 동명 게시판 구분 필요                                                                                                       | `utils/writeBoards.ts`                |
| A10 | 첨부·대표이미지 «업로드» 게이트(`POST_ATTACHMENT_UPLOAD_ENABLED=false`) — UI 는 그리고 호출은 막음                         | Go 에 업로드 계약 없음(BR-037). 삭제(`delete_file_id`·`delete_thumbnail_id`, `06:283-284`)는 계약이 있어 구현                                                   | `constants.ts` · BR-037               |
| A11 | 저장 성공 토스트를 history state 로 상세 화면에 넘긴다                                                                     | 정본은 토스트 뒤 상세 이동(A05). URL 에 남기지 않기 위해 `HistoryState.toast`                                                                                   | `main.tsx` · `PostDetailScreen.tsx`   |
| A12 | 수정 저장 때 공지가 켜져 있으면 `badges` 를 매번 다시 보낸다(upsert). 「항상 고정」은 start_date 가 저장 시각으로 갱신된다 | Go 는 upsert(`06:300`)라 무해하고 코드가 가장 짧다. 실측: 15:37 → 15:38 → 15:39 로 갱신, 노출엔 영향 없음                                                       | `writePayload.ts buildUpdateBody`     |

## 사용자 결정 (코드 쓰기 전 질의, 2026-09-10)

1. **본문 에디터 = 나모(Namo) iframe 재사용.** 실측: `https://namo-editor.jupiterstudio.co.kr/editor` 200, `X-Frame-Options`/`frame-ancestors`
   없음, 에디터 postMessage 대상 `'*'`, 인라인 이미지는 에디터 호스트가 저장. 새 npm 패키지 0개. (대안 TipTap 은 채택 안 함)
2. **공개 범위(전체/조직 지정 + 조직도 피커) 제거.** 정본(web:624-815 전수)·레거시(AddPostView.vue:92 만 `is_public` 읽음)·Go body(`06:212-222`) 셋 다 없음. 아트보드 05 에만 있음 → 디자인 요청 #1.
3. **수정 모드 포함, 라우트 `/write?postId=`.** `validateSearch` 로 `boardId`·`postId`(UUID 만 통과).
4. **날짜 입력 = 정본대로 커스텀 달력**(`common/DatePicker.tsx` 신설).

## 대조표 (레거시 · 디자인 · 데모 · Go · 조치)

L = `AddPostView.vue`, W = 정본 웹(scratchpad 줄), M = 모바일 정본, A05 = `화면 05_글쓰기.dc.html`, Go = `docs/api/go/`

| 항목           | 레거시                                                                                              | 디자인                                                                  | 데모(전)                    | Go 계약                                                                                   | 조치                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 게시판 소스    | 내비 전역 상태(L:44-45)                                                                             | 평면 드롭다운 h40·w280(W:631-645)                                       | 한글 상수 3개               | `GET {S}/categories` public+categories+child(`03:180-183`)                                | `useCategories()` → `writableBoards()`                                   |
| 게시판 필터    | `is_writable && !is_drive`(L:648·700·748)                                                           | —                                                                       | 없음                        | `is_writable`(`04:102`)·`is_drive`(`04:108`); 트리는 Read 기준(`03:189`)                  | 동일 필터, 자료실 제외                                                   |
| 프리셋         | `?boardId=`(L:483-491), 진입 4곳                                                                    | —                                                                       | 없음                        | —                                                                                         | `validateSearch`; 목록 빈 상태·`/my` 임시저장/예약 행 연결               |
| 제목           | maxlength 200·카운터(L:860-863)                                                                     | `{{ wTitleLen }}/200` h44(W:661-664)                                    | 동일                        | 상한 없음(`06:215`)                                                                       | zod `max(200)`, `TITLE_MAX`                                              |
| 본문 에디터    | Namo iframe(L:443-475), 25초 폴백(L:428-441), 살균 없음                                             | 툴바+편집/HTML/미리보기 탭(W:688-720)                                   | textarea                    | HTML 무살균 저장(`06:39`)                                                                 | `NamoEditor.tsx`, 탭 편집/미리보기, 저장 전 `sanitizePostHtml`           |
| 본문 이미지    | 에디터 호스트 처리                                                                                  | —                                                                       | —                           | 업로드 경로 없음(`10:329` resize 만)                                                      | Namo 처리 → BR-043                                                       |
| 첨부 업로드    | FormData `file[i]`(L:344), 10개/100MB                                                               | 내 PC·전체 삭제·드롭존·목록(W:665-690)                                  | 더미 2건·45%                | **계약 없음**(`06:224`, `10:177` DRIVE 전용, BR-037)                                      | UI 비활성 + 안내, 게이트 상수 1곳                                        |
| 첨부 삭제      | `delete_file_id[i]`(L:240-244), 전체 삭제 미반영 버그(L:886)                                        | 행 X                                                                    | —                           | `delete_file_id`(`06:283`)                                                                | 수정 모드에서 구현, 전체 삭제도 id 수집                                  |
| 대표 이미지    | 2MB·EXIF·`delete_thumbnail_id`(L:107·256)                                                           | 96px 박스·2MB 안내(W:721-735)                                           | 없음                        | 업로드 없음(BR-037), 삭제 `06:284`, 표시 `05:204`                                         | 박스 UI, 업로드 게이트, 기존 썸네일 표시·삭제                            |
| 공개 범위      | 없음(게시판 단위, L:92)                                                                             | 정본 없음, A05 만                                                       | 있음                        | 없음(`06:212-222`·`:272-286`)                                                             | 제거(결정 2)                                                             |
| 공지 게이트    | UI `isPossibleNotice`(L:83-97) vs 요청 `post.is_admin`(L:218) 불일치                                | `wIsAdmin`, 「게시판 관리자에게만」(W:753-780)                          | 항상 노출                   | badges 있고 CanManage 아니면 403(`06:228`); `can_manage`(`04:105`)                        | 선택 게시판 `can_manage`(수정 중 트리에 없으면 상세 `is_admin`)          |
| 공지 기간      | start=now·end=23:59:59/2999(L:224-238), 끄기=end 덮어쓰기(L:231-236)                                | 항상/기간 라디오 + 시작~종료 칩(W:757-777)                              | 라디오+칩(정적)             | `badges[≤1]{start_date,end_date}`(`06:58-67`), `delete_badge_id`(`06:285`)                | A1·A3, 끄기=`delete_badge_id`                                            |
| 예약 발행      | SCHEDULED+`YYYY-MM-DD HH:mm:ss`(L:363), now+1h(L:103), `delete_schedule_at='1'`(L:284), ACT 시 숨김 | 현재/예약 라디오 + 일시 칩 + 「5분 단위」(W:786-800), 달력(W:1625-1660) | 토글만                      | `POST_SCHEDULE_REQUIRED`(`06:171`), SCHEDULED 에서 `delete_schedule_at` 단독 400(`06:46`) | A2·A8, 해제 = `state`+`delete_schedule_at`, 원본 ACT 면 섹션 숨김        |
| 댓글 허용/알림 | 둘 다 기본 true, 허용 off → 알림 off(L:985)                                                         | 체크박스 + 토글(W:738-748)                                              | 허용만                      | legacy.Bool(`06:54`) 기본 true                                                            | 둘 다, JSON boolean                                                      |
| 수정 알림      | `not_send_alarm` 반전(L:267-272)                                                                    | A05 모달(보내지 않음/알림 보내기)                                       | 없음                        | 요청 일회성(`06:219`)                                                                     | 원본 ACT 수정 저장 시 ConfirmModal                                       |
| 임시저장       | POST→모달→`/post/edit/{id}` replace(L:378-379·1110), 개수 표시 없음                                 | 「임시 저장」 + 토스트(A05)                                             | 버튼+카운트 3               | `state:'SAVE'`, 이후 `PUT`(`06:252`)                                                      | POST → `?postId=` replace → PUT, 토스트, 카운트 배지 제거                |
| 저장 후 이동   | 등록→상세 replace(L:383), 수정→`go(-1)`(L:304)                                                      | 토스트 + 상세(A05)                                                      | 토스트만                    | 응답 관계 없음(`06:90`)                                                                   | 모두 `/post/$postId` replace + history-state 토스트(A11)                 |
| 이탈 확인      | 무조건 가드(L:495), 저장 실패 후 가드 소멸(L:199·313)                                               | A05 「작성을 취소하시겠습니까?」                                        | 인라인 모달(초점 트랩 없음) | —                                                                                         | `useBlocker` + `ConfirmModal`, dirty 기준(A4)                            |
| 수정 진입      | 연필 `is_mine`(PostView.vue:383), 마이페이지 행(mypage.vue:427)                                     | 「글 수정」·「수정」(A05), 잠금 문구(W:648-652)                         | 없음                        | 작성자 전용 403(`06:40`), 이동은 원본 SAVE 만(`06:274`)                                   | 상세 연필 복원(`is_mine`), `/my` 행 → `?postId=`, 잠금 = 원본 state≠SAVE |
| 비작성자·404   | `!is_mine` 모달 후 back(L:541-545), 404 미처리                                                      | —                                                                       | —                           | 타인 SAVE/SCHEDULED 404, Read 없음 403(`05:466`)                                          | 안내 카드 + 확인 → 목록                                                  |
| 에러 매핑      | `.catch` 없음(L:295-305)                                                                            | 필드 인라인 에러(W:657·665)                                             | 없음                        | 순서 `06:228`·`:292`, code 로 분기(README:95)                                             | `mapWriteError` → 게시판/예약/공지 필드 + 상단 배너                      |
| 모바일         | 헤더 「다음」→ 설정 전체화면(L:1168-1180), 하단 버튼 없음                                           | **정본 모바일 = 인라인 구조**, 3버튼 flex:1 h46(M:751-753)              | max-w-820                   | —                                                                                         | 인라인, 취소는 데스크톱만(모바일은 뒤로가기 → blocker)                   |

레거시에서 **답습하지 않은 것**(실측된 버그): 전체 삭제 서버 미반영(L:886) · 25초 후 예전 본문 저장 · 저장 실패 후 가드 소멸 · 404 미처리 · 임시저장 모달 배경 클릭 시 초안 중복(DefaultModal.vue:33) · 공지 끄기를 `end_date` 덮어쓰기로 처리 · 모바일 `?boardId=` 진입 시 공지 메뉴 미노출(L:174-180 vs :483-491).

## Go 배선 ({S} = /api/v1/board/companies/{cid}/users/{uid})

| 동작                      | 호출                                                                | 비고                                                                                      |
| ------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 게시판 후보               | `GET {S}/categories`(`useCategories`)                               | `is_writable && !is_drive` 재필터(트리는 Read 기준)                                       |
| 수정 프리필               | `GET {S}/posts/{id}`(`usePostDetail`)                               | SAVE/SCHEDULED 는 열람 미기록(`05:474`), ACT 수정 진입은 +1(레거시 동일)                  |
| 새 글                     | `POST {S}/boards/{id}/posts` → 201 `PostWriteResult`                | `createPost`. `{}` 도 유효, 추가 키 무시(`06:224`)                                        |
| 임시저장 재저장·발행·수정 | `PUT {S}/posts/{id}` → 200                                          | `updatePost`. `board_id` 는 원본 SAVE·변경 시만. 예약 해제 = `state`+`delete_schedule_at` |
| 첨부 삭제                 | 위 PUT 의 `delete_file_id[]`·`delete_thumbnail_id[]`                | 업로드는 없음(BR-037)                                                                     |
| 성공 후 캐시              | `['posts']`·`['notices']` invalidate, 상세는 remove 또는 invalidate | 상세 invalidate 금지 규칙은 «발행 후 이동» 에서만 예외(A5)                                |

## 구조

- `writePayload.ts` — 순수 함수만(`resolveState`·`buildCreateBody`·`buildUpdateBody`·`noticeBadge`·`prefillFromPost`·`mapWriteError`). 짝 테스트 `tests/writePayload.test.ts`(15건).
- `utils/writeBoards.ts` — 트리 평면화(A9).
- `NamoEditor.tsx` — iframe + postMessage(`saveEditor` ↔ `onInitCompleted`/`saveEditor`), 출처 검사, 15초 타임아웃, 초점 감지(`onTouch`).
- `common/DatePicker.tsx`(정본 달력) · `common/Radio.tsx`(신설) · `common/Dropdown`(size `md` 변형 추가) · 기존 `Switch`·`Checkbox`·`Modal`·`ConfirmModal`·`Toast` 재사용 — 데모의 로컬 사본 3종(Toggle·Checkbox·인라인 모달)은 삭제해 초점 트랩·aria 를 복구했다.
- 삭제: `writeData.ts`(더미 전부), i18n `write-scope*`·`write-pick-org`·`write-org-modal-title`·`write-apply`·`write-schedule-on`·`write-dropzone`(300MB 근거 없음)·`write-comment`.

## 검증

- `npm run build` · `npm run lint` · `npm run test`(16 파일 225건) · `npm run test:e2e` 그린 (2026-09-10).
- 단위: 상태 결정 · RFC3339 형식 · 예약 기본값/과거 거절 · badges(always=2999/period) · CanManage 없으면 badges 없음 · `board_id` 조건 · 예약 해제 조합 · `delete_badge_id` · `not_send_alarm` 반전 · 첨부 삭제 id · 프리필 · 오류 매핑.
- E2E `tests/e2e/write.spec.ts`(나모 iframe 은 같은 프로토콜의 스텁, API 는 Go wire fixture): ① 임시저장 POST SAVE → `?postId=` → 공지 ON 등록 PUT ACT(살균된 본문 · `files` 미전송 · `badges[0].end_date` 2999) → 상세 이동 + 토스트 ② 예약 과거 시각 → 인라인 에러 · 쓰기 요청 0건 ③ 취소 → 이탈 모달 → 계속 작성/나가기.
- 살균은 실브라우저에서만 검증한다(happy-dom 은 DOMPurify 가 조용히 실패) — E2E ① 이 `<script>`·`onerror` 제거를 요청 body 로 확인한다.
- 실서버 실호출: 아래 표.

## 접근성 (후퇴 금지)

- 라디오 `role="radiogroup"/"radio"`+`aria-checked`, 스위치 `role="switch"`, 체크박스 `role="checkbox"`, 탭 `role="tablist"/"tab"`+`aria-selected`, 오류 `role="alert"`, 달력 오늘 `aria-current="date"`.
- 모든 모달(달력·이탈·수정 알림·저장 중)은 공용 `Modal` 위 — 스크림·초점 트랩·초점 반환·스크롤 잠금.

## 실서버 실호출 (2026-09-10, localhost:8090, 회사 관리자 계정, 공용게시판)

| 단계                  | 요청                                                                                                                              | 응답                                                                                                                            | 판정                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 임시저장(신규)        | `POST …/boards/{id}/posts` `{title, content, is_allow_comment, is_comment_alarm, state:'SAVE'}`                                   | 201 `PostWriteBody`(관계 없음) → URL `?postId=` replace → `GET /posts/{id}` 1회(SAVE 라 열람 미기록)                            | 문서대로                                    |
| 임시저장(재저장)      | `PUT …/posts/{id}` 같은 body                                                                                                      | 200, `updated_at` 만 변경                                                                                                       | 문서대로                                    |
| 예약 + 공지(항상)     | `PUT` `{state:'SCHEDULED', schedule_at:'2026-09-10T16:40:00+09:00', badges:[{start_date, end_date:'2999-12-31T23:59:59+09:00'}]}` | 200 `schedule_at_tz:'2026-09-10 16:40:00'`; 상세 `badges[0].end_date:'2999-12-31T14:59:59Z'`(연도 2999 유지 → 「항상」 복원 OK) | 문서대로. RFC3339+오프셋 파서 통과(A2 확정) |
| 수정 진입             | 상세 연필(`is_mine`) → `/write?postId=`                                                                                           | 상세 캐시 재사용(추가 GET 0건), 예약 16:40·공지 항상·게시판 잠금 프리필                                                         | OK                                          |
| 예약 해제 → 즉시 발행 | `PUT` `{state:'ACT', delete_schedule_at:true, badges:[…]}`                                                                        | 200 `state:'ACT'`, `schedule_at:null`, `posted_at` 채워짐                                                                       | 문서대로(`06:46` 단독 400 회피)             |
| 발행 후 상세          | `GET /posts/{id}`                                                                                                                 | `view_count` 0 → 1 → 2(수정 저장마다 +1)                                                                                        | **A5·BR-042 실측 확인**                     |
| ACT 수정              | 「알림」 모달 → 보내지 않음 → `PUT` `{…, state:'ACT', not_send_alarm:true}`                                                       | 200                                                                                                                             | 문서대로                                    |
| 삭제(정리)            | 상세 삭제 → 목록 이동                                                                                                             | 검증 글 휴지통 이동                                                                                                             | —                                           |

- 부수 관찰: 나모 에디터는 `saveEditor` 마다 자기 호스트 `POST /api/v1/upload/save` 에 본문 HTML 을 보낸다(BR-043 에 추가). 첨부·자료실 게시판은 드롭다운에서 빠졌다(`is_drive` 필터 실측).
- 이 과정에서 잡은 결함 1건: 모바일(≤630px)에서 「취소」 버튼이 노출됐다 — 공용 버튼 클래스의 `inline-flex` 와 `hidden` 이 충돌. `max-[630px]:hidden` 으로 교체 후 `display:none` 확인.

## chrome-devtools 계산 스타일 (localhost:5174, 라이트·다크·600px)

| 항목                           | 라이트                                           | 다크                                    | 정본                   |
| ------------------------------ | ------------------------------------------------ | --------------------------------------- | ---------------------- |
| `<main>` / 카드(`<form>`) 배경 | `#FFFFFF` / `#FFFFFF`(border gray-200 `#E5E7EB`) | `#26262A` / `#26262A`(border `#3C3C43`) | `--color-bg` 표면 규칙 |
| 카드 radius · padding          | 12px · 24/26px                                   | 동일                                    | 정본 24/26             |
| 게시판 드롭다운                | 280×40                                           | 동일                                    | W:631-645              |
| 제목 입력                      | h44                                              | 동일                                    | W:661                  |
| 에디터 프레임                  | 580px(데스크톱) / 356px(600px)                   | 동일                                    | 레거시 949             |
| 옵션 라벨 폭                   | 96px                                             | 동일                                    | W:755                  |
| 버튼(데스크톱)                 | h40, 등록 `#3362FF`                              | 등록 `#4B79FF`                          | 정본 h40               |
| 버튼(600px)                    | 3개 flex:1 h48, 취소 `display:none`              | 동일                                    | M:751-753              |
| 첨부 비활성                    | opacity .4 · not-allowed                         | 동일                                    | 디자인 요청 #5         |
| 가로 스크롤                    | 없음                                             | 없음                                    | —                      |

## 남은 것

- 첨부·대표이미지 업로드(BR-037 계약 확정 후 `POST_ATTACHMENT_UPLOAD_ENABLED=true` + 업로드 호출 연결).
- 디자인 수정 요청 9건 반영 여부 확인 → 정본이 바뀌면 이 문서의 대조표를 갱신한다.
- BR-042 답에 따라 발행 후 상세를 캐시 패치로 전환(조회수 +1 제거).
