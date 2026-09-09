# 게시글 작성/상태 API (PostController — write 계열)

프론트엔드용 게시글 **작성 · 수정 · 삭제 · 복원 · 읽음 · 뱃지 · 북마크** 엔드포인트 명세.
모든 내용은 `app/Http/Controllers/Post/PostController.php` 코드를 직접 읽고 작성함.

## 공통 규약

| 항목 | 값 |
|---|---|
| Base URL(로컬) | `http://localhost:8000` |
| Prefix | `/api/v1` |
| 인증 | `auth:api` (Passport) — `Authorization: Bearer <token>` **필수** |
| 로케일 | `locale.set` 미들웨어 — 헤더 `lang: ko \| en \| ja` (에러 메시지 언어) |
| 현재 유저 | `UserController::getMe()` = `request()->user()`. 모든 조회는 내 `company_id`로 스코프됨 |
| 성공 응답 | HTTP `200` + 반환값(JSON). 별도 래핑 없음 (`201` 안 씀) |

### 에러 응답 형식

실패는 전부 `ReturnCode`로 `abort` 처리되며 바디는 `{ "message": "..." }` (필요시 `code`, `response` 추가).

| 상황 | HTTP | 바디 | 트리거 |
|---|---|---|---|
| 검증 실패 | `400` | `{ "message": <첫 검증 에러> }` | `validationCheck(REQUIRED)`. `env('APP_ERROR_CODE_DEBUG')` 시 `code:501` 추가 |
| 권한 없음 | `403` | `{ "message": "<validation.no_permission>" }` | `checkBoardPermission` 실패 / 작성자·관리자 아님 |
| 리소스 없음 | `404` | Laravel 기본 | 라우트 모델 바인딩 실패(`{board}`/`{post}` UUID 없음) |
| 서버/트랜잭션 에러 | `500` | `{ "message": <예외 메시지> }` | `updatePost` try/catch 내부 예외 (board 못 찾음, 뱃지 권한 등) |

> 에러 메시지 텍스트는 `__('validation.*')` 로케일 키라서 `lang` 헤더에 따라 번역됨. 아래 문서에서는 키(`validation.no_permission` 등)로 표기.

### 권한 모델 요약 (`BoardController::checkBoardPermission`)

`['read' => bool, 'write' => bool]` 반환.

1. board `company_id` ≠ 내 `company_id` → 둘 다 `false`.
2. board `is_public = true` → 둘 다 `true` (공용 게시판은 전원 읽기/쓰기).
3. 회사 관리자(`Admin`) → 둘 다 `true`.
4. 그 외 → board의 `read_permission` / `write_permission` (`ALL`/`ADMIN`/`MEMBER`)와 카테고리·게시판 멤버십/부서 권한 조합으로 결정.

`isAdminUser($companyId)` = 회사 `Admin` 여부 (10초 캐시). `isBoardAdmin($board)` = 게시판 admin 또는 상위 카테고리 admin.

### 상태값(`post.posts.state`)

| 값 | 의미 |
|---|---|
| `SAVE` | 임시저장(초안) |
| `ACT` | 게시중(공개) |
| `HIDE` | 숨김 |
| `DEL` | 삭제(상태만 DEL, `deleted_at`은 그대로 → 복원 가능) |
| `SCHEDULED` | 예약 게시 |

> ⚠️ **`state=DEL` ≠ DB soft delete.** `deletePost`/`deletePosts`는 `state`만 `DEL`로 바꾸고 `deleted_at`은 건드리지 않음 → 라우트 모델 바인딩(`{post}`)으로 여전히 조회됨. 실제 `deleted_at`을 채우는 건 `deletePermanentPosts` 뿐.

### 날짜 처리

`schedule_at`, 뱃지 `start_date`/`end_date`는 `Controller::setTimezone()`로 `config('app.timezone')`(현재 **`UTC`**) → UTC 변환 후 `Y-m-d H:i:s`로 저장. 현재 앱 타임존이 UTC이므로 입력값은 **UTC 기준 datetime 문자열**로 보낼 것 (예: `2026-08-26 10:00:00`).

---

## 1. 게시글 작성 — `POST /api/v1/post/{board}`

핸들러: `insertPost` → 내부에서 `updatePost` 위임.

### ① Method + URL
`POST /api/v1/post/{board}`

### ② Path

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `board` | UUID | 작성 대상 게시판 id (라우트 모델 바인딩, 없으면 404) |

### ③ Query
없음.

### ④ Body payload
**작성은 빈 Post row를 만든 뒤 곧바로 `updatePost`에 위임**하므로, **body 스펙은 아래 [2. 게시글 수정]과 완전히 동일**하다. `title`/`content`/`state` 등 전체 필드를 이 한 번의 요청에 실어 보내면 생성+채우기가 한 번에 처리됨.

insertPost가 자동 세팅하는 값(요청에서 못 바꿈):

| 필드 | 값 |
|---|---|
| `user_id` | 나 |
| `company_id` | 내 회사 |
| `board_id` / `category_id` | path의 `{board}` 및 그 board의 `category_id` |
| `is_send_alarm` | `false` |
| `seq` | 회사 내 `max(seq)+1` (트랜잭션 + `lockForUpdate` + `withTrashed` — 회사별 유니크 일련번호) |
| `state` | 요청에 없으면 DB 기본 `SAVE` |

### ⑤ 인증·권한
`checkBoardPermission($board)['write'] === true` 필요. 실패 시 `403 validation.no_permission`.
(공용 게시판이면 통과, 아니면 회사/게시판/카테고리 관리자·멤버 + `write_permission` 조합.)

### ⑥ Response
`updatePost` 결과와 동일 — 생성된 Post 객체(아래 [2] 응답 참조). state에 따라 알림 job이 dispatch될 수 있음.

### ⑦ 주의사항
- `{board}`는 **게시판 UUID**. 작성 후 게시판 이동은 `state=SAVE`일 때만 body의 `board_id`로 가능(→ [2] 참조).
- **알림**: `state=ACT` 이고 `not_send_alarm`이 없으면 `ProcessPostAlarm`(게시 알림) + `ProcessNoticeAlarm`(공지 알림)이 dispatch됨.
- `state`를 안 보내면 초안(`SAVE`)으로 저장되고 `posted_at`/알림 없음. **의도한 상태를 항상 명시할 것.**

### ⑧ 시나리오
- 정상(초안): `{ "state": "SAVE", "title": "회의록", "content": "<p>...</p>" }` → 201 아님, 200 + 초안 Post.
- 정상(즉시 게시): `{ "state": "ACT", "title": "...", "content": "..." }` → `posted_at` 세팅 + 알림 dispatch.
- 권한 실패: 비공개 board에 쓰기 권한 없음 → `403`.
- 없는 board: `POST /post/<존재X UUID>` → `404`.

---

## 2. 게시글 수정 — `PUT /api/v1/post/{post}`

핸들러: `updatePost`. **작성/수정 공통 바디 로직의 본체.**

### ① Method + URL
`PUT /api/v1/post/{post}`

### ② Path

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `post` | UUID | 대상 게시글 id (없으면 404) |

### ③ Query
없음.

### ④ Body payload

**Content-Type**: 파일(`file`/`thumbnail`)을 포함하면 반드시 `multipart/form-data`, 파일이 없으면 `application/json` 가능. 배열/객체 필드는 multipart일 때 bracket 표기(`badges[0][type]=...`, `delete_file_id[0]=...`)로 전송.

검증 규칙(`validationCheck`):
```
state              in:SAVE,ACT,HIDE,DEL,SCHEDULED
file               array
delete_file_id     array
delete_badge_id    array
delete_thumbnail_id array
schedule_at        required_if:state,SCHEDULED
```

| 필드 | 타입 | 필수 | 저장/동작 |
|---|---|---|---|
| `state` | enum(위 5종) | 선택 | `posts.state`에 fill. `ACT`이고 `posted_at` 없으면 `posted_at=now` 세팅 |
| `title` | string | 선택 | `posts.title` |
| `content` | string(HTML) | 선택 | `posts.content`. 동시에 `text_content = strip_tags(content)` 자동 저장(HTML 제거 본문) |
| `is_allow_comment` | bool | 선택 | `posts.is_allow_comment` (댓글 허용) |
| `is_comment_alarm` | bool | 선택 | `posts.is_comment_alarm` (댓글 알림) |
| `schedule_at` | datetime(UTC) | `state=SCHEDULED`일 때 필수 | `state`가 `SCHEDULED` 또는 `SAVE`이고 값이 truthy일 때만 `posts.schedule_at`(UTC 변환)에 저장 |
| `delete_schedule_at` | truthy | 선택 | `state ≠ SCHEDULED`이고 truthy면 `schedule_at = null` (예약 해제) |
| `board_id` | UUID | 선택 | **현재 post.state가 `SAVE`일 때만** 반영 → 초안을 다른 게시판으로 이동(`board_id`/`category_id` 교체). board 없으면 500 |
| `file` | file[] | 선택 | 업로드 파일들. 각각 S3 `{AWS_FOLDER}/post/{post_id}` 에 저장 후 `post_files` 생성(`src`, `origin_file_name`, `extension`, `size`, `company_id`) |
| `delete_file_id` | UUID[] | 선택 | 해당 `post_files` soft delete |
| `thumbnail` | file(단일) | 선택 | 기존 썸네일 있으면 삭제 후, S3 `{AWS_FOLDER}/post/{post_id}/thumbnail`에 저장. `getimagesize`로 `width`/`height` 계산해 `post_thumbnails` 생성 |
| `delete_thumbnail_id` | UUID[] | 선택 | 해당 `post_thumbnails` soft delete |
| `badges` | object[] | 선택 | **관리자 전용**(아래 ⚠️). 각 원소 `{ id?, type, start_date, end_date }`. `id` 없으면 신규(`company_id`/`board_id`/`post_id` 자동), 있으면 해당 뱃지 갱신. `type`(예: `NOTICE`/`MUST_READ`), 날짜는 UTC 변환 저장 |
| `delete_badge_id` | UUID[] | 선택 | **관리자 전용**. 해당 `post_badges` soft delete |
| `not_send_alarm` | truthy | 선택 | truthy면 `state=ACT`여도 게시/공지 알림 **미발송** |

**fill 대상은 `state, title, content, is_allow_comment, is_comment_alarm, schedule_at` 6개뿐** (`Post::$fillable`). 나머지(`file`, `thumbnail`, `badges`, `delete_*`, `board_id`, `not_send_alarm` 등)는 개별 로직으로 처리되며, 그 외 임의 필드는 무시됨.

`badges` 원소 구조:

| 키 | 타입 | 설명 |
|---|---|---|
| `id` | UUID | 있으면 기존 뱃지 수정, 없으면 신규 생성 |
| `type` | string | 뱃지 타입. `NOTICE`(공지), `MUST_READ`(필독) — 검증 미적용(자유 문자열) |
| `start_date` | datetime(UTC) | 뱃지 적용 시작 |
| `end_date` | datetime(UTC) | 뱃지 적용 종료 |

### ⑤ 인증·권한
- **작성자 본인만** 수정 가능: `getMe()->id !== post.user_id` → `403 validation.no_permission`. (게시판 관리자라도 작성자가 아니면 이 API 호출 불가.)
- `badges`/`delete_badge_id`를 보내려면 **작성자이면서 동시에 회사 관리자 또는 게시판 관리자**여야 함. 아니면 트랜잭션 내 예외 → `500 validation.no_permission`.

### ⑥ Response
저장된 **Post 객체**(HTTP 200). 직렬화 시 DB 컬럼 + append 속성 포함:

- DB 컬럼: `id, seq, company_id, category_id, board_id, user_id, state, title, content, text_content, is_allow_comment(bool), is_comment_alarm(bool), comment_count, view_count, like_count, delete_user_id, is_send_alarm, is_notice_alarm, schedule_at, posted_at, created_at, updated_at, deleted_at`
- append: `is_writable`(내 글 여부), `is_view`(내가 봤는지), `is_bookmark`, `is_like`, `schedule_at_tz`
- ⚠️ `board`/`files`/`badges`/`thumbnail` 관계는 **eager-load하지 않음** → 응답에 안 나올 수 있음. 상세는 `GET /api/v1/post/{post}`로 재조회 권장.

### ⑦ 주의사항
- **`text_content`는 서버가 `strip_tags(content)`로 자동 생성** — 클라이언트가 보내지 말 것.
- `file`/`thumbnail` 있으면 요청 전체가 multipart여야 함. 실제 S3 업로드(`->store(...,'s3')`)가 트랜잭션 안에서 일어남.
- 뱃지 **생성/삭제는 updatePost에서만** 가능(작성자+관리자). 비작성자 관리자는 [8. 뱃지 날짜 수정]으로 기간만 조정.
- `board_id` 이동은 **초안(SAVE) 상태에서만** 동작. ACT/HIDE 등에서 보내면 무시됨.
- 알림은 커밋 후 `state=ACT` && `!not_send_alarm`일 때만. 게시판의 `is_post_alarm`/`is_notice_alarm` 설정에 따라 job 내부에서 다시 걸러짐.
- 예외 발생 시 전부 rollback되고 `500`+예외 메시지 반환.

### ⑧ 시나리오
- 정상(초안→게시): `{ "state": "ACT", "title": "...", "content": "..." }` → `posted_at` 세팅, 알림 dispatch.
- 정상(예약): `{ "state": "SCHEDULED", "schedule_at": "2026-09-01 09:00:00" }` → schedule_at 저장.
- 정상(예약 취소): `{ "state": "SAVE", "delete_schedule_at": 1 }` → schedule_at null.
- 검증 실패: `state=SCHEDULED`인데 `schedule_at` 없음 → `400`. / `state=FOO` → `400`.
- 권한 실패: 남의 글 수정 → `403`. / 비관리자가 `badges` 포함 → `500 validation.no_permission`.
- 엣지: `board_id`가 없는 UUID인데 state=SAVE → `500 validation.not_found`.

---

## 3. 게시글 삭제(단건) — `DELETE /api/v1/post/{post}`

핸들러: `deletePost`.

- **① Method+URL**: `DELETE /api/v1/post/{post}`
- **② Path**: `post` UUID.
- **③ Query / ④ Body**: 없음.
- **⑤ 권한**: 작성자 **또는** 회사 관리자 **또는** 게시판 관리자. 아니면 `403 validation.no_permission`.
- **동작**: `state=DEL`, `delete_user_id=나`로 저장. **soft delete 아님**(`deleted_at` 유지) → 복원 가능.
- **⑥ Response**: 갱신된 Post 객체(200).
- **⑦ 주의**: 실제 파괴가 아니라 상태 전환. 완전 삭제는 [5]. 관리자가 삭제하면 `delete_user_id`가 관리자 id가 됨 → 복원([7])도 그 관리자만 가능.
- **⑧ 시나리오**: 정상 → 200 DEL Post / 타인 글+비관리자 → 403 / 없는 post → 404.

---

## 4. 게시글 삭제(다건) — `DELETE /api/v1/post/delete`

핸들러: `deletePosts`.

- **① Method+URL**: `DELETE /api/v1/post/delete`
- **② Path**: 없음.
- **③ Query**: 없음.
- **④ Body**:

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | UUID[] | 사실상 필수 | 삭제할 게시글 id 목록 (검증은 `array`만, `required` 아님) |

- **⑤ 권한**: 별도 권한 체크 없음. 단, **내가 작성한 글(`user_id=나`)만** 대상. 다른 조건 불충족 id는 무시.
- **동작**: `Post::where(user_id=나)->whereIn(id, ids)->update(state=DEL, delete_user_id=나)`.
- **⑥ Response**: 영향받은 행 수(정수).
- **⑦ 주의**: `id` 미전송 시 `whereIn('id', null)`로 에러/0건 → **항상 비어있지 않은 배열 전송**. 관리자 권한으로 남의 글 일괄 삭제 불가(본인 글만). 상태만 DEL(복원 가능).
- **⑧ 시나리오**: `{ "id": ["uuid1","uuid2"] }` → `2`. / 남의 글 id만 → `0`. / `id` 누락 → 에러.

---

## 5. 게시글 완전 삭제(다건) — `DELETE /api/v1/post/permanent`

핸들러: `deletePermanentPosts`.

- **① Method+URL**: `DELETE /api/v1/post/permanent`
- **②③ Path/Query**: 없음.
- **④ Body**: `id` UUID[] (검증 `array`).
- **⑤ 권한**: **내 글(`user_id=나`)** + **`state`가 `DEL` 또는 `SAVE`인 것만**. (ACT/HIDE/SCHEDULED는 대상 아님.)
- **동작**: 대상 조회 후 각 post에 대해 `thumbnail()->delete()`, `files()->delete()`, `post->delete()` 실행. → **여기서 `deleted_at` 채워지는 실제(soft) 삭제.**
- **⑥ Response**: 삭제된 Post 컬렉션(배열).
- **⑦ 주의**: 이름은 "permanent"지만 Eloquent soft delete(`deleted_at` 설정)임. DEL(휴지통) 또는 SAVE(초안)만 비움. 첨부/썸네일도 함께 soft delete.
- **⑧ 시나리오**: 휴지통 비우기 `{ "id": [...] }` → 해당 posts. / ACT 글 id → 조건 불일치로 제외.

---

## 6. 읽음 처리 — `POST /api/v1/post/read`

핸들러: `readPosts`. (조회 로그 `view_logs` 벌크 생성)

- **① Method+URL**: `POST /api/v1/post/read`
- **②③ Path/Query**: 없음.
- **④ Body**: `id` UUID[] (검증 `array`) — 읽음 처리할 게시글 id 목록.
- **⑤ 권한**: 로그인만. 내부에서 접근 가능 게시판만 필터.
- **동작**:
  1. `id` 중 `company_id=나`, `state=ACT`인 것만 추림.
  2. 비관리자는 접근 가능 board(공용 + 카테고리/게시판 멤버십·부서 권한 만족)로 추가 필터. 관리자는 전체.
  3. 남은 각 post에 대해 `view_logs`에 `{post_id, user_id}` 벌크 insert.
- **⑥ Response**: insert한 `[{post_id, user_id}, ...]` 배열.
- **⑦ 주의**: `view_logs` PK가 `(user_id, post_id, created_at)`이라 **중복 호출 시 로그가 계속 쌓임**(조회수 부풀려짐) → 실제 열람 시 1회만 호출 권장. 접근 불가/비ACT id는 조용히 스킵됨(에러 없음).
- **⑧ 시나리오**: 목록에서 보이는 글 일괄 읽음 `{ "id": [...] }` → 처리된 목록. / 권한 없는 board 글 → 결과에서 빠짐.

---

## 7. 게시글 복원(다건) — `POST /api/v1/post/restore`

핸들러: `restorePosts`.

- **① Method+URL**: `POST /api/v1/post/restore`
- **②③ Path/Query**: 없음.
- **④ Body**: `id` UUID[] (검증 `array`) — 복원할(휴지통) 게시글 id.
- **⑤ 권한**: **`delete_user_id=나`인 것만** (= 내가 삭제한 글). `user_id` 기준 아님.
- **동작**: `update(state=ACT, delete_user_id=null)`.
- **⑥ Response**: 영향받은 행 수(정수).
- **⑦ 주의**: 복원 시 무조건 `ACT`로 되돌아감(이전 상태 SCHEDULED/HIDE 보존 안 됨). 삭제를 관리자가 했다면(delete_user_id=관리자) 그 관리자만 복원 가능.
- **⑧ 시나리오**: `{ "id": [...] }` → 복원 건수. / 내가 안 지운 글 id → `0`.

---

## 8. 뱃지 기간 수정 — `POST /api/v1/post/badge`

핸들러: `updatePostBadges`. (기존 뱃지의 노출 기간 갱신 — 생성은 [2] updatePost)

- **① Method+URL**: `POST /api/v1/post/badge`
- **②③ Path/Query**: 없음.
- **④ Body**:

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `badge_id` | UUID[] | ✅ required | 수정할 `post_badges` id 목록 |
| `end_date` | datetime(UTC) | ✅ required | 종료일 (모든 권한 공통 갱신) |
| `start_date` | datetime(UTC) | 선택 | 시작일 — **회사 관리자만** 반영됨 |

- **⑤ 권한 / 동작**:
  - **회사 관리자**(`isAdminUser`): 내 회사의 해당 뱃지들의 `start_date` + `end_date` 모두 갱신.
  - **그 외**: 내가 **게시판 관리자**인 board의 뱃지에 한해 `end_date`만 갱신(`start_date` 무시).
- **⑥ Response**: 영향받은 행 수(정수).
- **⑦ 주의**: 명시적 403 없음 — 권한 없거나 대상 없으면 join 결과 0건 → `0` 반환(무음 실패). 뱃지 **생성/삭제는 여기서 못 함**([2] 참조). 날짜는 UTC 변환 저장.
- **⑧ 시나리오**: 관리자 기간 연장 `{ "badge_id": [...], "start_date": "...", "end_date": "..." }` → 건수. / `end_date` 누락 → `400`. / 권한 없는 뱃지 → `0`.

---

## 9. 게시글 북마크 토글 — `POST /api/v1/post/bookmark/{post}`

핸들러: `bookmarkPost`.

- **① Method+URL**: `POST /api/v1/post/bookmark/{post}`
- **② Path**: `post` UUID.
- **③ Query / ④ Body**: 없음.
- **⑤ 권한**: `checkBoardPermission($post->board)['read'] === true`. 실패 시 `403 validation.no_permission`.
- **동작(토글)**: `post_bookmarks(user_id, post_id)`를 `withTrashed`로 조회 →
  - 없음 → 신규 생성(북마크 ON).
  - 있고 `deleted_at` 있음 → 복구(`deleted_at=null`, 북마크 ON).
  - 있고 활성 → `delete()`(soft delete, 북마크 OFF) 후 즉시 반환.
- **⑥ Response**: `PostBookmark` 객체(`user_id`, `post_id`; timestamps 없음). OFF일 땐 삭제된 객체 반환.
- **⑦ 주의**: **명시적 파라미터 없는 토글** — 같은 API 반복 호출로 ON/OFF 전환. 저장/삭제 시 `post_bookmark_{post}_{user}` 캐시 무효화(모델 booted 훅). 응답만으로 현재 ON/OFF 판별 어려우니 목록의 `is_bookmark` append로 확인.
- **⑧ 시나리오**: 첫 호출 → 북마크 생성 / 재호출 → 해제 / 읽기 권한 없는 비공개 글 → `403` / 없는 post → `404`.

---

## 라우트 등록 순서 참고

`routes/api.php`의 `post` prefix 내에서 리터럴 경로가 `{board}`/`{post}` 와일드카드보다 **먼저** 선언됨:

```
POST   post/read          (readPosts)      ┐ {board}보다 위 → 정상 매칭
POST   post/restore       (restorePosts)   ┘
POST   post/{board}       (insertPost)
PUT    post/{post}        (updatePost)
DELETE post/delete        (deletePosts)    ┐ {post}보다 위 → 정상 매칭
DELETE post/permanent     (deletePermanentPosts) ┘
DELETE post/{post}        (deletePost)
POST   post/badge         (updatePostBadges)   — badge prefix, 최상단
POST   post/bookmark/{post} (bookmarkPost)
```

따라서 `read`/`restore`/`delete`/`permanent`/`badge`는 와일드카드에 잡아먹히지 않고 각 핸들러로 정확히 라우팅됨.
