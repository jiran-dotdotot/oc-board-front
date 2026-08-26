# OC Board — 백엔드 API 카탈로그 (전체 72개)

**기능 개발 / 새 페이지를 만들기 전에 여기부터 본다.** 원하는 동작을 서버가 이미 제공하는지 먼저 확인하고,
있으면 "이 API 붙일까요?" 로 제안한 뒤 작업한다.

- **원본 스냅샷**: `docs/api/00-overview.md` ~ `10-*.md` (백엔드 `jupiter-board-api/doc/api/` 복사본, 2026-08-26 기준)
  - 이 카탈로그는 **색인**이고, 파라미터·응답·함정 **전문은 `docs/api/`** 에 있다. 상세가 필요하면 해당 파일을 열 것.
  - 백엔드 문서 갱신 시: `cp <jupiter-board-api>/doc/api/*.md docs/api/` 후 `README.md` → `00-overview.md` 로 rename.
- **프론트 연동 상세**(service/hook/타입/캐싱 정책): `docs/guides/api-reference.md`
- **권한 모델**: `docs/guides/permissions-guide.md`

---

## 0. 30초 요약 — 반드시 지킬 것

| # | 규칙 |
|---|---|
| 1 | **불리언은 `1`/`0`.** 문자열 `"false"` 도 PHP에서 truthy → 켜진다. 끌 때는 **생략**이 가장 안전 (`is_include_comment` 만 예외적으로 안전) |
| 2 | **빈 문자열 파라미터 금지.** `board_id=` 같은 빈값은 `WHERE = ''` 가 되어 **0건**. 안 쓰는 키는 생략 (`serializeParams` 가 처리) |
| 3 | `is_view=**0**` 은 "안 읽은 글" — 생략과 다르다. 안읽음 배지는 `is_view=0` |
| 4 | 게시글의 `is_writable` = **"내 글 여부"**(작성자==나). 쓰기 권한 아님. 쓰기 권한은 `board.write_permission` |
| 5 | 자료실의 `start_posted_at`/`end_posted_at` 는 실제로 **`created_at`** 필터 |
| 6 | 검색어 `search`/`title`/`content` 는 **2글자 미만이면 무시**(일부는 400) |
| 7 | `comment_count`/`like_count` 는 **비동기 큐** — 응답 직후 값이 안 맞는다. 필요하면 재조회 |
| 8 | 공감 토글은 (유저×대상×`emoji`) 단위. `emoji` 필수, 취소해도 200 → **`deleted_at` 유무로 on/off 판정** |
| 9 | 정렬 미지정 시 **순서 미보장** — 목록은 항상 `sort[by]`/`sort[order]` 명시 |
| 10 | 다중 presign 은 실패해도 HTTP **200** — 원소별 `result.state` 로 판정 |
| 11 | **네이밍 트랩**: `PUT /category/member/{id}` · `POST /board/member/{id}` 는 멤버 관리가 아니라 **본인 알림 설정** |
| 12 | 삭제 3종: `state=DEL`(휴지통, 복원 가능) / `permanent`(영구) / 댓글 삭제(= `is_active=false`, **count 안 줄어듦**) |

**공통 헤더**: `Authorization: Bearer <token>` · `lang: ko|en|ja` · `Accept: application/json`
**페이징**: `take`(기본 20) + `page` → 페이지네이터 / `is_not_paging=1` + `limit`(기본 10) → **배열**
**정렬**: `sort[by]=<컬럼>&sort[order]=asc|desc`, 관련도는 `sort[by]=relative&sort[value]=<키워드>`

---

## 1. 인증 · 유저 — `docs/api/01-auth-user.md`

| Method | Path | 하는 일 | 인증 | FE |
|---|---|---|---|:--:|
| POST | `/token` | Jupiter JWT → 액세스 토큰 (로컬은 시크릿 미설정으로 사용 불가) | 불필요 | – |
| POST | `/login` | officenext 계정 로그인 → `access_token`/`refresh_token` | 불필요 | ✅ `authService.login` |
| GET | `/me` | 현재 유저 + 회사/부서/관리자 여부 | Bearer | ✅ `userService.getMe` (localStorage 캐시) |
| GET | `/api/test` | 환경 확인용 (⚠ `/api/v1` prefix 아님) | 불필요 | – |

---

## 2. 관리 (회사설정·관리자·정렬) — `docs/api/02-management.md`

| Method | Path | 하는 일 | 권한 | FE |
|---|---|---|---|:--:|
| POST | `/management/admin` | office 관리자 추가 | office 관리자 | – |
| POST | `/management/company-setting` | 회사 게시판 설정 생성 | office 관리자 | – |
| POST | `/management/company-setting/{companySetting}` | 회사 설정 수정 + **메인 화면 구성 편집** | office 관리자 | – |
| PUT | `/management/user-setting/search-keyword` | 최근 검색어 저장 | 본인 | – |
| POST | `/management/user-setting/{companySetting}` | **개인 알림 설정** 수정 | 본인 | – |
| POST | `/management/category/edit` | 카테고리/게시판 **일괄 편집**(최대 2depth) | office 또는 카테고리 관리자 | – |
| POST | `/management/category` | 1depth 카테고리 순서 변경 | office 관리자 | – |
| POST | `/management/category/{category}` | 하위 카테고리 순서 변경 | office 관리자 | – |
| POST | `/management/board` | 공용 게시판 순서 변경 | office 관리자 | – |
| POST | `/management/board/{category}` | 카테고리 내 게시판 순서 변경 | office 관리자 | – |

> 관리자 화면(`/admin`)을 실제로 채울 때 쓸 API 뭉치. 현재는 `AdminGate` 만 있고 미연동.

---

## 3. 카테고리 — `docs/api/03-category.md`

| Method | Path | 하는 일 | 권한 | FE |
|---|---|---|---|:--:|
| GET | `/category` | **내가 접근 가능한 카테고리 트리 + 전사 공개 게시판** (`with_category_admin=1` 로 관리자 카테고리 포함) | 인증 | – |
| GET | `/category/admin` | office 관리자면 **회사 전체 트리**, 아니면 `/category?with_category_admin=1` 과 동일 | 인증 | – |
| GET | `/category/management` | 내가 **관리자인 대상만** 모은 관리용 트리 (⚠ 래퍼 없이 배열 반환) | 인증 | – |
| POST | `/category` | 카테고리 생성 | 관리자 | – |
| GET | `/category/{category}` | 카테고리 상세 (⚠ 권한 가드 dead code — 백엔드 이슈) | 인증 | – |
| PUT | `/category/{category}` | 카테고리 수정 **+ 멤버/부서/관리자 구성** | 관리자 | – |
| DELETE | `/category/{category}` | 카테고리 삭제 | 관리자 | – |
| PUT | `/category/member/{category}` | ⚠ **본인 알림 설정** (멤버 관리 아님) | 본인 | – |

> **사이드바 게시판 트리는 `GET /category` 다.** 지금 프론트는 상수로 하드코딩 중 → 최우선 연동 후보.

---

## 4. 게시판 (Board) — `docs/api/04-board.md`

| Method | Path | 하는 일 | 권한 | FE |
|---|---|---|---|:--:|
| GET | `/board` | 게시판 목록/검색 (`id`, `is_public`, `is_bookmark`) ⚠ **읽기 권한 필터 없음** | 인증 | – |
| POST | `/board` | 게시판 생성 | office/카테고리 관리자 | – |
| PUT | `/board/{board}` | 게시판 수정 + 멤버/부서/관리자 구성 | 관리자 | – |
| GET | `/board/{board}` | 게시판 상세 (+`is_writable` = **내 쓰기 권한**) | `checkBoardPermission` | – |
| DELETE | `/board/{board}` | 게시판 삭제 | 관리자 | – |
| POST | `/board/bookmark/{board}` | 게시판 북마크 토글 | read 권한 | – |
| POST | `/board/member/{board}` | ⚠ **본인 알림 설정** (멤버 관리 아님) | 본인 | – |

**`checkBoardPermission` 요약** (전문: `docs/api/04-board.md` §2)
1. 회사 불일치 → read/write 둘 다 false
2. `is_public=true` → 즉시 read+write true (**무조건 허용은 이것뿐**)
3. office 관리자 → 전권
4. 비공개 + `ALL` 도 "카테고리멤버 / 게시판멤버·관리자 / 부서배정 중 하나라도" 필요 — **무관한 유저는 `ALL` 이어도 read=false**
5. `is_readable`/`is_writable` 플래그는 **`MEMBER` 모드에서만** 유효
6. 부서 권한은 **상위 부서 배정 → 하위 부서 구성원까지** 확장

---

## 5. 게시글 조회 — `docs/api/05-post-read.md`

| Method | Path | 하는 일 | FE |
|---|---|---|:--:|
| GET | `/post` | **게시글 목록/검색** — 접근 가능한 게시판으로 자동 스코프 | ✅ `postService.selectPost` |
| GET | `/post/main` | **메인 화면 구성 통째로** — 회사 설정 기반 섹션별 `posts` + `drive_files` | – |
| GET | `/post/my` | 내 글 / 임시저장 / 휴지통 / 예약 / **북마크** | – |
| GET | `/post/{post}` | 게시글 상세 | – |
| GET | `/post/view/{post}` | 게시글 조회자 목록 | – |
| GET | `/post/badge/{board}` | 뱃지별 게시글(관리용) | – |

**`GET /post` 주요 필터** (전문: `docs/api/05-post-read.md` §1)

| 목적 | 파라미터 |
|---|---|
| 범위 | `board_id` · `category_id`(하위 포함) · `user_id` · `user_name` · `is_public_only=1` |
| 검색 | `search`(제목+본문+작성자) · `title` · `content` · `title_content` (+`is_include_comment=1` 로 댓글까지) — 모두 **2글자 이상** |
| 뱃지 | `badges[]=NOTICE` · `badges[]=MUST_READ` · `except_badges[]=…` (현재 유효 기간인 것만) |
| 읽음 | `is_view=1`(읽음) / `is_view=0`(안읽음) |
| 기간 | `start_created_at`·`end_created_at` / `start_posted_at`·`end_posted_at` / `limit_day=N` |

**`GET /post/my`**: `state=ACT|SAVE|DEL|HIDE|SCHEDULED` (필수) 또는 `is_bookmark=1`

> `GET /post/main` 은 홈 화면 한 방 API. 현재 홈은 `GET /post` + `GET /drive/file` 2회 호출 중 → 회사 설정 기반 섹션이 필요해지면 갈아탈 후보.

---

## 6. 게시글 작성/수정/삭제 — `docs/api/06-post-write.md`

| Method | Path | 하는 일 | FE |
|---|---|---|:--:|
| POST | `/post/{board}` | 게시글 작성 (`state`: `ACT`/`SAVE`/`SCHEDULED`) | – |
| PUT | `/post/{post}` | 게시글 수정 | – |
| DELETE | `/post/{post}` | 단건 삭제 → **휴지통(`state=DEL`)** | – |
| DELETE | `/post/delete` | 다건 삭제 → 휴지통 | – |
| DELETE | `/post/permanent` | 다건 **영구 삭제** | – |
| POST | `/post/read` | 읽음 처리 | – |
| POST | `/post/restore` | 휴지통에서 **복원** | – |
| POST | `/post/badge` | 뱃지(공지/필독) **기간 수정** | – |
| POST | `/post/bookmark/{post}` | 게시글 북마크 토글 | – |

> 글쓰기 화면(`/write`)이 실제로 저장하려면 여기 + 파일 업로드(§10) 조합이 필요.

---

## 7. 댓글 · 공감(이모지) — `docs/api/07-post-comment-like.md`

| 핸들러 | 하는 일 | FE |
|---|---|:--:|
| `insertComment` | 댓글/대댓글 작성 | – |
| `updateComment` | 댓글 수정 | – |
| `deleteComment` | 댓글 삭제 ⚠ `is_active=false` 만 → **`comment_count` 안 줄어듦** | – |
| `likePost` | 게시글 공감 토글 — `emoji` **필수**, 취소도 200 → `deleted_at` 으로 판정 | – |
| `selectPostLikeUser` | 게시글 공감 유저 목록 | – |
| `likeComment` | 댓글 공감 토글 (규칙 동일) | – |
| `selectCommentLikeUser` | 댓글 공감 유저 목록 | – |

> 정확한 METHOD/URL 은 `docs/api/07-post-comment-like.md` 참조(핸들러명 기준 정리).

---

## 8. 자료실 폴더 — `docs/api/08-drive-folder.md`

| Method | Path | 하는 일 | FE |
|---|---|---|:--:|
| POST | `/drive/folder/{board}` | 폴더 생성 | – |
| PUT | `/drive/folder/{driveFolder}` | 폴더 수정(이름/순서) ⚠ 소유자 체크 없음 | – |
| DELETE | `/drive/folder/{driveFolder}` | 폴더 단건 삭제(**하위 hard delete**) | – |
| DELETE | `/drive/folder/board/{board}` | 폴더 다건 삭제(파일은 고아 처리) | – |
| GET | `/drive/{board}` | **자료실 조회**(폴더 탐색) | – |
| GET | `/drive/tree/{board}` | 폴더 **트리** 조회 | – |

---

## 9. 자료실 파일 — `docs/api/09-drive-file.md`

| Method | Path | 하는 일 | FE |
|---|---|---|:--:|
| GET | `/drive/file` | **파일 목록/검색** | ✅ `driveService.selectDriveFiles` |
| GET | `/drive/file/my` | 내 파일 | – |
| GET | `/drive/file/{driveFile}` | 파일 상세 | – |
| DELETE | `/drive/file` | 내 파일 삭제(휴지통) | – |
| DELETE | `/drive/file/permanent` | 영구 삭제 | – |
| DELETE | `/drive/file/{driveFile}` | 단건 삭제(휴지통) | – |
| DELETE | `/drive/file/board/{board}` | 게시판 파일 일괄 삭제 | – |
| POST | `/drive/file/bookmark/{driveFile}` | 파일 북마크 토글 | – |
| POST | `/drive/file/restore` | 복원 | – |

**`GET /drive/file` 주요 필터**: `board_id` · `drive_folder_id` · `category_id`(하위 포함) · `is_drive_root=1`(루트만) ·
`search`/`title`(≥2글자) · `start_posted_at`/`end_posted_at`(**실제 `created_at`**) · `limit_day` · `more_field=board`

> ⚠ **다운로드 URL은 목록/상세에 없다.** presign(§10)으로 따로 받아야 한다.

---

## 10. 업로드 · 부서 · 라이브 — `docs/api/10-drive-upload-department-live.md`

| Method | Path | 하는 일 | FE |
|---|---|---|:--:|
| POST | `/drive/pre-signed-url/multiple/{board}` | **다중 presign** 발급 ⚠ 실패해도 200 → 원소별 `result.state` 확인 | – |
| POST | `/drive/pre-signed-url/{board}` | 단일 presign 발급 | – |
| POST | `/drive/callback` | 업로드 확정 ⚠ 권한 검증 없음 | – |
| GET | `/department` | 내 회사 조직도 | – |
| GET | `/department/{companyId}` | 특정 회사 조직도 트리 ⚠ 회사 검증 없음 | – |
| GET | `/live` | 라이브 방송 정보 | – |

**업로드 3단계**: presign 발급 → S3 에 직접 `PUT` → `POST /drive/callback` 으로 확정

---

## 11. 화면 ↔ API 매핑 (현재 상태)

| 화면 | 연동됨 | 아직 안 붙인 API (붙일 후보) |
|---|---|---|
| `LoginScreen` | `POST /login` | – |
| `AppShell` (셸/사이드바) | `GET /me` | **`GET /category`** — 사이드바 게시판 트리(현재 하드코딩) |
| `HomeScreen` | `GET /post`(최근5) · `GET /drive/file`(최근4) | `GET /post/main`(회사설정 기반 섹션 한 방) · `GET /live` |
| `BoardListScreen` | `GET /post`(목록/필터) | `GET /board/{board}`(헤더·쓰기권한) · `POST /post/read` · `POST /post/bookmark/{post}` |
| `PostDetailScreen` | – | `GET /post/{post}` · 댓글 CRUD · 공감 토글 · 북마크 · `GET /post/view/{post}` |
| `WriteScreen` | – | `POST /post/{board}` · `PUT /post/{post}` · presign 업로드 3단계 |
| `SearchScreen` | – | `GET /post?search=` · `GET /drive/file?search=` · `PUT /management/user-setting/search-keyword` |
| `DriveScreen` | `GET /drive/file` | `GET /drive/{board}`(폴더 탐색) · `GET /drive/tree/{board}` · 폴더 CRUD · presign 업로드 |
| `MyPageScreen` | – | `GET /post/my?state=ACT\|SAVE\|DEL` · `GET /post/my?is_bookmark=1` · `GET /drive/file/my` |
| `AdminScreen` | `AdminGate`(is_admin) | `/management/*` 전체 · `GET /category/admin` · `GET /category/management` · 게시판 CRUD |

---

## 12. 백엔드 알려진 이슈 (프론트에서 우회/주의)

- **[보안]** `GET /category/{category}` — 권한 가드가 dead code, 타 회사 카테고리 조회 가능
- **[보안]** `GET /department/{companyId}` — 회사 검증 없음
- **[보안]** `POST /drive/callback` — 권한/소유 검증 없음
- **[버그]** 비관리자가 `is_public=true` 로 board 생성 시 **500**(TypeError) → 공용 게시판 생성은 사실상 office 관리자만
- **[버그]** `updateDriveFolder` 소유자 체크 없음
- **[UX]** "이미 존재 / 하위 존재" 류가 409/400이 아닌 **500** → 상태코드로 원인 구분 불가, 메시지로 판단
- **[사소]** `updateCategoryPosition` 이 오타 컬럼 `positon` 에 저장(동작은 함)
