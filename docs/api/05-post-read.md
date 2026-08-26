# 05. 게시글 조회 API (Post 조회 계열)

`PostController`의 **읽기(GET)** 엔드포인트 6종 프론트엔드 문서.
소스: `app/Http/Controllers/Post/PostController.php` · `app/Http/Filters/PostFilter.php` · `app/Http/Filters/Filter.php` · `app/Models/Post/Post.php` · `app/Http/Response/ReturnCode.php` · 스키마 `doc/v1/post.sql`(+v3/v4)

---

## 공통 규약

| 항목 | 내용 |
|---|---|
| Base URL(로컬) | `http://localhost:8000` |
| Prefix | `/api/v1` |
| 인증 | `auth:api` (Passport Bearer) — 미들웨어 그룹 `locale.set` + `auth:api` |
| 필수 헤더 | `Authorization: Bearer <token>`, `lang: ko\|en\|ja`, `Accept: application/json` |
| 현재 유저 | `UserController::getMe()` = `request()->user()` (전 엔드포인트 `company_id` 스코프) |
| 성공 응답 | 별도 envelope 없음. Eloquent 모델/컬렉션/페이지네이터를 그대로 JSON 직렬화, HTTP 200 |

### 에러 응답 형식 (`ReturnCode`)

| 상황 | HTTP | Body |
|---|---|---|
| 유효성 검사 실패 (`validationCheck`, `VALIDATION_TYPE_REQUIRED`) | `400` | `{ "message": "<첫 번째 검증 에러 메시지>" }` · `APP_ERROR_CODE_DEBUG` 켜지면 `code:501` 추가 |
| 권한 없음 (`customResponse $FORBIDDEN`) | `403` | `{ "message": "..." }` (보통 `validation.no_permission`) |
| 리소스 없음 (`customResponse $NOT_FOUND`) | `404` | `{ "message": "..." }` (보통 `validation.not_found`) |
| 인증 실패 | `401` | Passport 기본 |

> 에러 body는 `message`(+선택적 `code`, `response`)만 담긴다. 실제 판단은 **HTTP status code**로.

### ⚠️ 필터 엔진 공통 함정 (`Filter::apply`)

목록 필터는 `request()->all()`의 각 키를 `PostFilter`의 동명 메서드와 매칭해 호출한다.

1. **값 제거 조건이 매우 좁다.** `array_filter([$value], fn => $value !== false && !is_null($value))` — 실제 `boolean false` / `null`만 제거. 쿼리스트링 값은 항상 문자열이라 **`"0"`, `""`(빈 문자열)도 그대로 필터로 전달**된다.
   - → `board_id=`(빈값), `id=`, `user_id=`, `category_id=`, `user_name=` 처럼 **빈 문자열을 보내면 `WHERE 컬럼 = ''`가 걸려 결과가 0건**이 될 수 있다. **안 쓰는 파라미터는 키 자체를 생략**할 것.
   - `search/title/title_content/content`는 길이 `< 2`면 no-op이라 빈값이 안전.
2. **불리언은 대부분 raw truthiness.** `is_include_comment`만 `$request->boolean()`(안전). 나머지(`is_view`, `is_public_only`, `is_not_paging`, `is_bookmark`)는 PHP truthiness → **문자열 `"false"`는 참!** 켤 땐 `1`, 끌 땐 `0` 또는 생략.
3. **정렬 기본값 없음.** `sort` 파라미터를 안 주면 `selectPost`는 `ORDER BY`를 아예 걸지 않는다(Postgres 순서 미정). 목록은 항상 `sort`를 명시할 것.

### Post 모델 공통 필드 (`$appends`)

`Post` 모델은 직렬화될 때마다 아래 계산 필드가 **항상 붙는다** (목록/상세 공통). 각각 현재 유저 기준으로 계산되며 목록에서는 행마다 쿼리가 돈다(N+1 주의).

| 필드 | 의미 | 비고 |
|---|---|---|
| `is_writable` | **내 글 여부** (작성자 == 나) | 이름과 달리 "쓰기 권한"이 아님 |
| `is_view` | **내가 읽었는지** (읽음=true) | 내가 작성자면 항상 true, 아니면 `view_logs` 존재 여부 |
| `is_bookmark` | 내 북마크 여부 | `Cache` 6000초 |
| `is_like` | 내 공감 여부 | `Cache` 6000초 |
| `schedule_at_tz` | 예약 게시 일시(앱 타임존 변환) | `schedule_at` 없으면 null |

---

## 1. 게시글 목록 — `GET /api/v1/post`

- **핸들러**: `selectPost` · **필터**: `PostFilter`
- **Path 파라미터**: 없음
- **Body**: 없음 (전부 쿼리 파라미터)

### 인증 · 권한 (게시판 접근 범위)

`state = ACT` + 내 `company_id` + **접근 가능한 게시판**으로 자동 스코프.

| 유저 | `is_public_only` 미지정 | `is_public_only` 지정 |
|---|---|---|
| 회사 관리자(`isAdminUser`) | 회사 전체 게시판 | 공용(public·카테고리 없음) 게시판만 |
| 일반 사용자 | 공용 게시판 + 내 소속 게시판(`getUserBoardIds`) | 공용 게시판만 |

- 공용 게시판 = `is_public=true`, `is_active=true`, `category_id IS NULL`
- 소속 게시판 = 카테고리 관리자 권한 트리 + 부서 게시판 + 카테고리멤버 + 게시판 admin/member (read_permission 반영)

### 쿼리 파라미터 — 필터 (`PostFilter`)

| 파라미터 | 타입 | 함정/설명 |
|---|---|---|
| `id` | uuid | `posts.id` 정확히 일치 |
| `board_id` | uuid | 게시판별 |
| `category_id` | uuid | **하위 카테고리 전체 포함**(`getChildCategoryTree`) |
| `user_id` | int | 작성자 id |
| `user_name` | string | 작성자 이름 부분일치(`ilike`) → 해당 user_id들로 필터 |
| `is_view` | bool(raw) | **`1`=읽은 글 / `0`=안 읽은 글**. `0`도 무시되지 않고 실제로 "안 읽음" 필터 적용됨. `view_logs` LEFT JOIN 후 `whereNotNull`/`whereNull` |
| `badges` | array | **현재 유효한**(`NOW` ∈ start~end) 뱃지 보유 글만. 예: `badges[]=NOTICE`. 값: `NOTICE`(공지), `MUST_READ`(필독) |
| `except_badges` | array | 현재 유효한 해당 뱃지 보유 글 **제외** |
| `search` | string(≥2) | 제목 OR 본문(`text_content`) OR 작성자명 통합(`ilike`). `<2`면 no-op. (검증 validator에는 없음) |
| `title_content` | string(≥2) | 제목 OR 본문 |
| `title` | string(≥2) | 제목만 |
| `content` | string(≥2) | 본문(`text_content`)만 |
| `is_include_comment` | bool(**safe**, `$request->boolean()`) | `title_content`/`title`/`content` 검색 시 **활성 댓글 내용까지** 포함. 이 파라미터만 `true/1/on/yes` 허용 |
| `start_created_at` / `end_created_at` | datetime | 작성일(`created_at`) 범위 (setTimezone 변환) |
| `start_posted_at` / `end_posted_at` | datetime | 게시일(`posted_at`) 범위 |
| `limit_day` | int | 최근 N일 이내 게시글 (`posted_at >= NOW() - INTERVAL 'N DAYS'`) |
| `sort` | object | 아래 정렬 참조. **미지정 시 정렬 없음** |
| `more_field` | string | 사실상 no-op (미구현) |

**정렬 `sort`**
- 컬럼 정렬: `sort[by]=<컬럼>&sort[order]=asc\|desc` — `by`는 `post.posts`의 실제 컬럼이어야 하며 아니면 no-op. `order` 기본 `desc`.
- 관련도 정렬: `sort[by]=relative&sort[value]=<키워드>&sort[order]=desc` — 본문 내 키워드 매칭 수(`search_count`)로 정렬 후 `created_at desc`. `value` 없으면 no-op.

> `search/title/title_content/content`는 **검증 규칙 `string|min:2`** (있을 때만) — 위반 시 400. `search`는 validator에 없지만 필터 자체가 `<2`를 무시한다.

### 쿼리 파라미터 — 페이징/기타

| 파라미터 | 기본값 | 설명 |
|---|---|---|
| `take` | 20 | 페이지 크기(페이징 모드) |
| `page` | 1 | 페이지 번호(Laravel 표준) |
| `is_not_paging` | false(raw) | `1`이면 페이징 없이 `limit`개 반환 |
| `limit` | 10 | `is_not_paging=1`일 때 개수 |
| `is_public_only` | false(raw) | `1`이면 공용 게시판만 (위 권한 표 참조) |

### 부수효과

`search` / `title` / `title_content` / `content`에 **빈 값이 아닌** 값을 주면 그 값이 내 **최근 검색어로 저장**됨(`ProcessUpdateUserSearchKeyword` 큐).

### 응답

- `is_not_paging` 미지정(기본): **Laravel 페이지네이터** — `{ current_page, data:[…], per_page, total, last_page, from, to, next_page_url, prev_page_url, path, links }`
- `is_not_paging=1`: **게시글 배열**

각 게시글 `select` 컬럼:
`id, seq, category_id, board_id, user_id, state, title, comment_count, text_content(앞 300자, SUBSTRING), view_count, like_count, created_at, updated_at, deleted_at, posted_at, delete_user_id`
\+ 공통 `$appends`(`is_writable, is_view, is_bookmark, is_like, schedule_at_tz`)
\+ 관계: `board`, `badges`(각 `is_active` 포함), `files`, `user`(`id, name, profile_image_id, account, disabled_at, deleted_at`), `thumbnail`

### 시나리오

```
# 특정 게시판 최신순 1페이지
GET /api/v1/post?board_id=<uuid>&sort[by]=posted_at&sort[order]=desc&take=20&page=1

# 제목+본문+댓글 통합 검색(공지 뱃지 보유만)
GET /api/v1/post?title_content=회의&is_include_comment=1&badges[]=NOTICE

# 안 읽은 글만
GET /api/v1/post?is_view=0

# 공용 게시판만, 페이징 없이 5건
GET /api/v1/post?is_not_paging=1&limit=5&is_public_only=1

# 작성자명 + 게시일 범위
GET /api/v1/post?user_name=홍길동&start_posted_at=2026-01-01&end_posted_at=2026-12-31
```

---

## 2. 메인 노출 게시글 — `GET /api/v1/post/main`

- **핸들러**: `selectMainPosts`
- **Path/Body**: 없음. **클라이언트 쿼리 파라미터는 내부에서 대부분 덮어씀**(무의미).

### 동작

1. 내 회사 `CompanySetting`(+`companyMainBoards`) 조회 → `latest_post_day`, 메인 보드 목록 확보.
2. 공통으로 `sort = posted_at desc`, `is_not_paging = true` 강제.
3. 각 `companyMainBoard`마다 `limit`을 타입별 상한으로 설정 후, `board_type`에 따라 필터 지정:

| `board_type` | 적용 필터 |
|---|---|
| `NEW` | `limit_day = latest_post_day` (최근 N일) |
| `PUBLIC` | `is_public_only = true` |
| `CUSTOM` | `board_id = companyMainBoard.board_id` |
| 그 외(예: `NOTICE`) | `badges = [board_type]` |

- `limit` 상한(`COMPANY_MAIN_BOARD_TYPE_LIMIT`, 키는 `type`): `BOARD=10`, `PREVIEW=6`, `ALBUM=8`, `DRIVE=10`
- 보드별로 `selectPost()` + `DriveFileController::selectDriveFile()` 호출해 결과를 각 보드에 첨부.

### 응답

`companyMainBoards` **배열**. 각 원소 = 메인 보드 설정 + `posts`(게시글 배열, selectPost 구조) + `drive_files`(드라이브 파일 배열).

> 프론트는 파라미터를 신경 쓸 필요 없음 — 회사 설정 기반으로 섹션들을 통째로 내려주는 "메인 화면 구성" 용도.

---

## 3. 내 게시글 / 북마크 — `GET /api/v1/post/my`

- **핸들러**: `selectMyPost` (필터 미사용)
- **Path/Body**: 없음

### 쿼리 파라미터

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `is_bookmark` | bool(raw) | `1`이면 **내가 북마크한 글**(state=ACT, 타인 글 포함). `is_view`/권한 검사 없음 |
| `state` | string | `is_bookmark`가 꺼졌을 때 **필수**. `SAVE`(임시저장)/`ACT`(게시중)/`HIDE`/`DEL`(삭제)/`SCHEDULED`(예약). `user_id=나` 로 필터 |
| `take` | int(기본 20) | 페이지 크기 |
| `page` | int | 페이지 번호 |

- 검증: `state` = `required_if:is_bookmark,0` (즉 `is_bookmark`를 안 켰으면 `state` 필요).
- 정렬: `state=DEL`→`updated_at desc`(+`deleteUser` 포함) / `state=SAVE`→`created_at desc` / 그 외→`posted_at desc`. 북마크 모드→`posted_at desc`.

### 응답

**Laravel 페이지네이터**. 게시글 필드는 목록과 동일 + **`schedule_at`** 컬럼 추가 select. 관계 `board, badges, files, user, thumbnail`(+ `state=DEL`이면 `deleteUser`).

### 시나리오

```
GET /api/v1/post/my?state=ACT           # 내가 쓴 게시중 글
GET /api/v1/post/my?state=DEL           # 내 휴지통(삭제 글)
GET /api/v1/post/my?state=SAVE          # 내 임시저장
GET /api/v1/post/my?is_bookmark=1       # 내 북마크
```

---

## 4. 게시글 상세 — `GET /api/v1/post/{post}`

- **핸들러**: `getPost`
- **Path**: `{post}` = 게시글 uuid (라우트 모델 바인딩 — 없거나 soft-delete면 404)

### 인증 · 권한

1. `post->board` 없으면 **404** (`validation.not_found`).
2. `checkBoardPermission(board)['read']` 이 false면 **403** (`validation.no_permission`).
   - 공용 게시판은 무조건 read=true. 아니면 관리자/카테고리·게시판 admin·member·부서 권한 + `read_permission`(`ALL`/`ADMIN`/`MEMBER`) 조합으로 판정.

### ⚠️ 부수효과 (조회 로그 = 조회수)

`state = ACT`이면 **매 호출마다 `view_logs` 행을 1건 insert**한다(내 것도 기록). 상세 진입 = 조회 1회로 집계됨.

### 응답 (단일 게시글 객체)

기본 컬럼 전체 + `content`(본문 원문) + 공통 `$appends` + 추가 필드:

| 필드 | 설명 |
|---|---|
| `is_mine` | 작성자 == 나 |
| `is_admin` | 회사 관리자(`isAdminUser`) 또는 게시판 관리자(`isBoardAdmin`) |
| `user` | 작성자 (`id, name, profile_image_id, account, disabled_at, deleted_at`) |
| `files` | 첨부 파일 배열 |
| `badges` | 뱃지 배열(각 `is_active`) |
| `thumbnail` | 썸네일 |
| `comments` | **depth=1(최상위) 댓글**. 각 댓글: `user`, `is_mine`, `likes[]`, `childComments[]`(대댓글, 각 `user`·`likes[]`) 포함. 비활성 댓글(`is_active=false`)은 `comment` 필드가 null |
| `likes` | 게시글 공감 통계: `[{ emoji, count, is_reacted }]` (내 반응 여부 포함, count desc) |
| `prev_post_id` / `next_post_id` | 같은 게시판 내 `posted_at` 기준 이전/다음 글 id. **공지글이면 공지끼리, 일반글이면 일반글끼리** 탐색. 없으면 null |
| `row_num` | 게시판 내 일반글 `posted_at desc` 기준 순번(번호). 공지글이면 1 |

- 댓글 공감 통계(`getCommentLikesStats`)는 `Cache` 300초.
- `state != ACT`(임시저장/삭제 등)이면 `prev_post_id/next_post_id/row_num` 모두 `null`, view_log 미기록.

> 권한만 있으면 `state`가 `ACT`가 아닌 글(DEL/SAVE/HIDE/SCHEDULED)도 조회 가능(soft-delete=`deleted_at`만 404).

---

## 5. 게시글 조회자 목록 — `GET /api/v1/post/view/{post}`

- **핸들러**: `selectPostViewLog`
- **Path**: `{post}` = 게시글 uuid
- **쿼리**: `take`(기본 20), `page`

> 이 핸들러에는 **별도 권한 체크가 없다** (auth만 통과하면 조회 가능).

### 응답

**Laravel 페이지네이터**. `view_logs`를 `user_id`로 그룹핑, `last_visit_at desc` 정렬:

| 필드 | 설명 |
|---|---|
| `user_id` | 조회한 유저 id |
| `count` | 해당 유저의 총 조회 횟수 |
| `last_visit_at` | 마지막 조회 시각(`MAX(created_at)`) |
| `user` | 유저 정보 관계 |

---

## 6. 뱃지별 게시글 (관리) — `GET /api/v1/post/badge/{board}`

- **핸들러**: `selectBadgePost`
- **Path**: `{board}` = 게시판 uuid
- **쿼리 파라미터**: `type` = **필수, 배열**. 예: `type[]=NOTICE&type[]=MUST_READ`

### 인증 · 권한

다음 중 하나여야 함, 아니면 **403**:
- 해당 게시판의 게시판 관리자(`BoardAdmin`)
- 회사 관리자(`isAdminUser`)
- 해당 게시판 카테고리의 카테고리 관리자(`isCategoryAdmin`)

### 응답

```json
{
  "in_posts":  [ /* 현재 적용중(NOW ∈ start~end) 뱃지 게시글 */ ],
  "out_posts": [ /* 기간 만료/미도래 뱃지 게시글 */ ]
}
```

- 각 게시글 = `posts.*` + `post_badges.type`, `start_date`, `end_date` + `is_processing`(bool, 현재 적용 여부) + 관계 `badges, files, user`.
- `is_processing`으로 `in_posts`/`out_posts` 분기, 게시글 id 기준 중복 제거.

### 시나리오

```
GET /api/v1/post/badge/<boardId>?type[]=NOTICE&type[]=MUST_READ
```

---

## 부록: 값 상수

| 구분 | 값 |
|---|---|
| `state` | `SAVE`(임시저장) · `ACT`(게시중) · `HIDE`(숨김) · `DEL`(삭제) · `SCHEDULED`(예약) |
| 뱃지 `type` | `NOTICE`(공지) · `MUST_READ`(필독) |
| `read_permission` | `ALL` · `ADMIN` · `MEMBER` |
| 메인보드 `board_type` | `NEW` · `PUBLIC` · `NOTICE` · `CUSTOM` |
