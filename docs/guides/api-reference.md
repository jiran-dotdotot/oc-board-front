# OC Board — API 레퍼런스

프론트가 연동하는 백엔드 API 정리. **유저가 준 스펙 기반**이며, 새 API를 받을 때마다 여기에 추가한다.
> "이 컬럼 뭐지?" 싶을 때 보는 문서. (요청: 받은 API는 전부 여기 정리)
>
> **"관련 API가 뭐 있지?" 는 → [`api-catalog.md`](api-catalog.md)** (전체 72개 색인) · 전문은 [`docs/api/`](../api/00-overview.md).
> 이 파일은 그중 **실제로 연동한 것**의 프론트 쪽 상세(payload·타입·service/hook·캐싱)를 다룬다.

- **Base URL**: `import.meta.env.VITE_API_URL` — 예: `http://localhost:8000/api/v1` (`.env.local`)
- **HTTP 클라이언트**: `src/lib/apiClient.ts` (axios). 서버 상태: `@tanstack/react-query`.
- **쿼리 직렬화**: `src/lib/queryParams.ts` (`serializeParams`)

---

## 공통 규약

### 인증
- `Authorization: Bearer <access_token>` 필수 (`auth:api`). `/login` 만 예외.
- 토큰 저장: `localStorage` — `oc-board-token`(access) · `oc-board-refresh`(refresh). `src/lib/authStorage.ts`.
- **401 처리**: `apiClient` 응답 인터셉터가 토큰 삭제 후 `/login`으로 이동(`/login` 요청 자체는 제외).

### 헤더
- `lang: ko|en|ja` — 현재 i18n 언어(`i18n.language`)를 각 요청에 실어 보냄.
- `Accept: application/json`

### 불리언 파라미터 ⚠️
쿼리스트링 값은 항상 문자열 → 백엔드가 대부분 **raw truthiness**(`if($value)`)로 평가.
문자열 `"false"`도 truthy라 `true`처럼 동작하는 함정이 있음.
- **원칙: 켤 때 `1`, 끌 때 `0` 또는 생략.** `true`/`false` 문자열 금지.
- 예외 1 — `is_include_comment`: `$request->boolean()`(안전) → `true/1/on/yes` 허용.
- 예외 2 — `is_view`: **`0`도 유효**(생략과 다름). 생략=전체 · `0`=안읽음(안 본 글) · `1`=읽음(본 글).
- `serializeParams`는 `undefined/null/''`만 생략하고 **`0`은 보존**한다(그래서 `is_view=0`이 정상 전송됨).

### 정렬 `sort`
- 컬럼 정렬: `sort[by]=<컬럼명>&sort[order]=asc|desc` (기본 `created_at desc`). `by`는 해당 테이블의 실제 컬럼.
- 관련도 정렬: `sort[by]=relative&sort[value]=<키워드>&sort[order]=desc` — 본문 키워드 매칭수 기준.
- 프론트: `sort: { by, order, value? }` 객체 → `sort[by]`/`sort[order]`/`sort[value]` 플랫 브래킷 키로 직렬화.

### 페이징
- `take`(기본 20) + `page`(기본 1, Laravel 표준) → 페이지네이션 객체 반환.
- `is_not_paging=1` → 페이징 없이 `limit`(기본 10)개 **배열** 반환.

### 프론트 매핑
| API | service | hook | 사용처 |
|---|---|---|---|
| `POST /login` | `authService.login` | `useLogin` | `LoginScreen`(폼 제출) |
| `GET /me` | `userService.getMe` | `useMe` | `AppShell`(셸 진입 — 사용자 정보·역할) |
| `GET /post` | `postService.selectPost` | `usePosts` | `HomeScreen`(최근 5) · `BoardListScreen`(목록/필터) |
| `GET /drive/file` | `driveService.selectDriveFiles` | `useDriveFiles` | `DriveScreen` · `HomeScreen`(최근 4) |

---

## 1. 인증 (Auth)

### POST /api/v1/login — 로그인
- **Auth**: 불필요.
- **Payload** (JSON body):

| 필드 | 타입 | 설명 |
|---|---|---|
| `username` | string | 로그인 아이디(이메일) |
| `password` | string | 비밀번호 |

- **Response** (Laravel Passport / OAuth2):

| 필드 | 타입 | 설명 |
|---|---|---|
| `token_type` | string | `Bearer` |
| `expires_in` | int | 만료(초) |
| `access_token` | string(JWT) | 액세스 토큰. `sub` 클레임 = user id (`authStorage.getCurrentUserId`) |
| `refresh_token` | string | 리프레시 토큰 |

- **타입**: `src/types/auth.ts` (`LoginRequest`, `LoginResponse`)
- **참고**: 자격증명 오류 시 400 + `"Unable to authenticate the provided username and password credentials"`.

### GET /api/v1/me — 로그인 사용자 정보
- **Method**: GET · **Auth**: `Bearer` 필수
- **호출 시점**: 로그인 후 **1회**. 응답을 `localStorage`(`oc-board-me`)에 캐시하고 `useMe`가 시드로 사용 → **새로고침·페이지 이동 시 재호출 없음**(`staleTime: Infinity`). 로그인(`setTokens`)·로그아웃(`clearTokens`) 시 캐시 무효화, 로그인 성공 시 `['me']` 쿼리 제거로 사용자 전환 반영.
- **Payload**: 없음.
- **주요 응답 필드**

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | int | 사용자 id |
| `company_id` | int | 회사 id |
| `name` | string | 표시 이름 (예: 오피스웨이브A) |
| `account` | string | 로그인 아이디 |
| `email` | string | 이메일 |
| `profile_src` | string\|null | 프로필 이미지 URL |
| `working_status` | string | 'Online' 등 |
| **`is_admin`** | bool | **슈퍼관리자** |
| **`is_category_admin`** | bool | **카테고리 관리자** |
| **`is_board_admin`** | bool | **게시판 관리자** |
| `company_setting` | object | 회사 설정(최근글 기준일 `latest_post_day`, 뱃지 정의 `post_badge_type`(JSON 문자열) 등) |
| `company_user_setting` | object | 사용자 설정(알림 on/off, `recent_search_keyword`(최근 검색어 배열) 등) |

> `mobile`/`phone`은 암호화 문자열, `password`는 항상 null → 타입에서 제외.

#### 역할(role) 사용
- 관리자 판정: `is_admin || is_category_admin || is_board_admin` → `isAnyAdmin(me)` (`src/types/user.ts`).
- **현재 적용**:
  - 사이드바 "관리자 설정" 메뉴를 **관리자에게만 노출**
  - **`/admin` 화면 자체도 `is_admin` 트리거로 제어** — 비관리자 접근 시 "권한 없음" 화면 (라우트 가드 아님, `src/components/admin/AdminGate.tsx`에서 `useMe`로 판단)
  - 프로필(이름·이메일·이니셜)도 이 응답 사용
- **미적용(추후)**: 게시판별 글쓰기 권한(`is_writable`) · AdminScreen 슈퍼/게시판 뷰를 실제 역할로 결정.
- **타입**: `src/types/user.ts` (`Me`, `CompanySetting`, `CompanyUserSetting`, `isAnyAdmin`)
- **전체 권한 모델**: 세 종류 관리자 · 콘텐츠 플래그(`post.is_admin`) · 영역별 규칙 · 우리 구현 현황은 [permissions-guide.md](./permissions-guide.md) 참조.

---

## 2. 게시글 (Post)

### GET /api/v1/post — 목록 (selectPost)
- **Method**: GET (바디 없음 — 전부 쿼리 파라미터)
- **Auth**: `Bearer` 필수. **Scope**: 항상 내 회사(`company_id`) + `state=ACT` + 내가 접근 가능한 게시판만. 관리자는 전체, 일반 사용자는 공용 + 소속 게시판.
- **Handler**: `App\Http\Controllers\Post\PostController::selectPost` / 필터 `App\Http\Filters\PostFilter`

#### 필터 파라미터
| 파라미터 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | 특정 게시글 |
| `board_id` | uuid | 게시판별 |
| `category_id` | uuid | 카테고리별 (하위 카테고리 포함) |
| `user_id` | int | 작성자 id |
| `user_name` | string | 작성자 이름 부분일치(ilike) |
| `is_view` | bool | 읽음 필터 — **생략=전체 · `0`=안읽음(안 본 글) · `1`=읽음(본 글)** |
| `badges` | array | 유효 뱃지 보유 글만 (`NOTICE`, `MUST_READ`). 예: `badges[]=NOTICE` |
| `except_badges` | array | 해당 뱃지 타입 제외 |
| `search` | string(≥2) | 제목·본문·작성자명 통합 검색 |
| `title_content` | string(≥2) | 제목 OR 본문 |
| `title` | string(≥2) | 제목만 |
| `content` | string(≥2) | 본문만 |
| `is_include_comment` | bool | `title_content/title/content` 검색 시 댓글 내용까지 포함 (`$request->boolean()`) |
| `start_created_at` / `end_created_at` | datetime | 작성일 범위 |
| `start_posted_at` / `end_posted_at` | datetime | 게시일 범위 |
| `limit_day` | int | 최근 N일 이내 게시글 |
| `sort` | object | 정렬 (공통 규약 참조) |
| `more_field` | string | 거의 no-op |

#### 페이징/기타
| 파라미터 | 기본값 | 설명 |
|---|---|---|
| `take` | 20 | 페이지 크기 |
| `page` | 1 | 페이지 번호 |
| `is_not_paging` | false | `1`이면 페이징 없이 `limit`개 반환 |
| `limit` | 10 | `is_not_paging=1`일 때 개수 |
| `is_public_only` | false | `1`이면 공용 게시판만 |

#### 프론트 필터 매핑 (전체/안읽음/읽음 탭)
| 탭 | 보낼 값 |
|---|---|
| 전체 | `is_view` 생략 |
| 안읽음 | `is_view=0` |
| 읽음 | `is_view=1` |
> 현재 UI(`BoardListScreen`)는 **전체/안읽음** 2탭만 사용 → 전체=생략, 안읽음=`0`. 안읽음 개수 배지는 `take=1&is_view=0`의 `total`로 집계.

#### 부수효과
- `search`/`title`/`content`/`title_content`에 값을 주면 **내 최근 검색어로 저장**됨 (`ProcessUpdateUserSearchKeyword`).

#### 응답
- `is_not_paging=false`(기본): Laravel 페이지네이션 객체 — `data, total, current_page, per_page, last_page, from, to`.
- `is_not_paging=true`: 게시글 **배열**.
- 각 게시글 필드: `id, seq, category_id, board_id, user_id, state, title, comment_count, text_content`(앞 300자)`, view_count, like_count, created_at, updated_at, deleted_at, posted_at, delete_user_id`
- 관계 포함: `board, badges, files, user, thumbnail`
- **타입**: `src/types/post.ts` (`Post`, `Paginated<T>`, `PostListParams`, `PostSort`)

#### 예시
```
GET /api/v1/post?board_id=1ca25680-...&take=20&page=1&sort[by]=posted_at&sort[order]=desc
GET /api/v1/post?title_content=회의&is_include_comment=1&badges[]=NOTICE
GET /api/v1/post?is_not_paging=1&limit=5&is_public_only=1
GET /api/v1/post?user_name=홍길동&start_posted_at=2026-01-01&end_posted_at=2026-12-31
GET /api/v1/post?take=20&page=1&is_view=0&sort[by]=posted_at&sort[order]=desc   ← 안읽음 목록
```

### 관련 엔드포인트 (바디 payload 있음)
| 라우트 | 핸들러 | 용도 | 상태 |
|---|---|---|---|
| `GET /api/v1/post/{post}` | `getPost` | 상세 (이전/다음글·row_num 포함) | 미연동 |
| `GET /api/v1/post/main` | `selectMainPosts` | 메인 노출용 | 미연동 |
| `GET /api/v1/post/my` | `selectMyPost` | 내 글 | 미연동 |
| `POST /api/v1/post/{board}` | `insertPost` | 작성 (JSON 바디) | 미연동 |
| `PUT /api/v1/post/{post}` | `updatePost` | 수정 (JSON 바디) | 미연동 |
| `DELETE /api/v1/post/{post}` | `deletePost` | 삭제 | 미연동 |
> 상세 스펙 받으면 이 아래에 하위 섹션으로 추가.

---

## 3. 자료실 (Drive)

### GET /api/v1/drive/file — 파일 목록 (selectDriveFile)
- **Method**: GET (쿼리 파라미터)
- **Auth**: `Bearer` 필수.
- 프론트는 플랫 목록으로 사용 → `is_not_paging=1`(배열 반환) + `more_field=board`(게시판 관계 포함) 강제. `src/services/driveService.ts`.

#### 파라미터
| 파라미터 | 타입 | 설명 |
|---|---|---|
| `board_id` | uuid | 게시판별 |
| `drive_folder_id` | uuid | 폴더별 |
| `category_id` | uuid | 카테고리별 |
| `user_id` | int | 업로더 id |
| `user_name` | string | 업로더 이름 |
| `search` | string | 통합 검색 |
| `title` | string | 파일명 검색 |
| `start_posted_at` / `end_posted_at` | datetime | (실제로는 `created_at`) 기간 필터 |
| `limit_day` | int | 최근 N일 |
| `sort` | object | 정렬 (기본 `created_at desc`) |
| `more_field` | string | `board`/`*` 이면 board 관계 포함 |
| `take` / `page` | | 페이징 모드 |
| `is_not_paging` | bool | `1`이면 배열 반환 |
| `limit` | int | `is_not_paging=1`일 때 개수 (프론트 기본 100) |
| `is_public_only` | bool | 공용만 |
| `is_drive_root` | bool | 루트만 |

#### 응답 (파일 필드)
`id, user_id, company_id, category_id, board_id, drive_folder_id, state, position, src`(S3 오브젝트 키)`, origin_file_name, size`(bytes)`, extension, delete_user_id, upload_expire_at, created_at, updated_at, deleted_at`
- 관계: `user`(항상), `board`(`more_field=board`일 때)
- **타입**: `src/types/drive.ts` (`ApiDriveFile`, `DriveFileListParams`, `DriveFilePage`)

#### 예시
```
GET /api/v1/drive/file?is_not_paging=1&more_field=board&limit=100&sort[by]=created_at&sort[order]=desc
GET /api/v1/drive/file?is_not_paging=1&more_field=board&limit=4&sort[by]=created_at&sort[order]=desc   ← 홈 최근 자료
```

#### 관련 엔드포인트 (미연동)
- 업로드(pre-signed) · 다운로드(`getDriveFile` presign) · 삭제 — 스펙 받으면 추가.

---

## 변경 이력
- 게시글/자료실/로그인 최초 정리. `is_view` 방향 확정(생략=전체 · 0=안읽음 · 1=읽음).
