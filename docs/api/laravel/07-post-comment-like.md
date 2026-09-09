# 07. 게시글 댓글 / 공감(이모지 반응) API

`PostController` 의 댓글·공감 계열 엔드포인트 문서입니다. (프론트엔드 연동용)

> 근거 소스: `routes/api.php`, `app/Http/Controllers/Post/PostController.php`,
> `app/Models/Post/{Comment,PostLike,CommentLike,Post}.php`,
> `app/Http/Response/ReturnCode.php`, `app/Observers/*`, `app/Jobs/Process*Alarm.php`,
> `app/Jobs/ProcessCount*.php`, `doc/v1/post.sql`

---

## 공통 사항

| 항목 | 값 |
| --- | --- |
| Base URL(로컬) | `http://localhost:8000` |
| 공통 prefix | `/api/v1` |
| 미들웨어 | `locale.set` → `auth:api` (Laravel Passport Bearer) |
| 필수 헤더 | `Authorization: Bearer <access_token>` |
| 권장 헤더 | `lang` (다국어 메시지 로케일. 예: `ko`, `en`) |
| 현재 유저 | `UserController::getMe()` = `request()->user()` (Passport 토큰의 유저) |
| 콘텐츠 타입 | JSON (`application/json`) |

### Path 파라미터 바인딩 (Route Model Binding)

| 파라미터 | 바인딩 모델 | 타입 | 없을 때 |
| --- | --- | --- | --- |
| `{post}` | `post.posts.id` | UUID | 404 (모델 미존재) |
| `{comment}` | `post.comments.id` | UUID | 404 (모델 미존재) |

### 에러 응답 형식 (`ReturnCode`)

모든 실패 응답은 아래 형태의 JSON + 해당 HTTP status code 로 내려갑니다.

```json
{ "message": "에러 메시지", "code": 501 }
```

- `message`: 오류 메시지. 대부분 `__('validation.*')` 다국어 문자열(요청 `lang` 헤더 기준).
- `code`: **선택적** 필드. `validationCheck` 실패 시 `env('APP_ERROR_CODE_DEBUG')` 가 켜져 있을 때만 `type` 코드(예: `501`)가 포함됨. `customResponse` 는 명시적으로 넘긴 경우에만 포함.

| 상황 | HTTP status | 발생 지점 |
| --- | --- | --- |
| 유효성 검증 실패 (필수값 누락 등) | `400 BAD_REQUEST` | `validationCheck(VALIDATION_TYPE_REQUIRED)` |
| 댓글 미허용 게시글 | `400 BAD_REQUEST` | `insertComment`, `updateComment` |
| 권한 없음 | `403 FORBIDDEN` | `checkBoardPermission`, 작성자/관리자 체크 |
| 리소스 없음 | `404 NOT_FOUND` | Route Model Binding 실패 |
| 미인증 / 토큰 만료 | `401 UNAUTHORIZED` | `auth:api` 미들웨어 |

### 권한 판정 요약

- `BoardController::checkBoardPermission($board)` → `['read' => bool, 'write' => bool]` 반환.
  - 회사(`company_id`) 불일치 → 전부 false.
  - 공개 게시판(`is_public=true`) → read/write 모두 true.
  - 비공개 → 시스템 관리자 / 카테고리·게시판 관리자 / 멤버 / 부서 권한 및 게시판의 `read_permission`·`write_permission` 조합으로 판정.
- 시스템 관리자: `ManagementController::isAdminUser($companyId)`
- 게시판 관리자: `BoardController::isBoardAdmin($board)`

### 응답에 포함되는 `user` 객체

| 관계 | select 컬럼 |
| --- | --- |
| `Comment.user`, `Post.user` | `id, name, profile_image_id, account, disabled_at, deleted_at` |
| `PostLike.user`, `CommentLike.user` | `id, name, profile_image_id, disabled_at, deleted_at` (※ `account` 없음) |

---

## 1. 댓글 작성 — `insertComment`

### ① METHOD + URL
`POST /api/v1/post/comment/{post}`

### ② Path

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `post` | UUID | ✅ | 댓글을 달 게시글 ID |

### ③ Query
없음

### ④ Body

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `comment` | string | ❌(사실상 필수) | 댓글 내용. **별도 validator 없음** → 미전송 시 빈 문자열(`''`)로 저장됨. 프론트에서 필수 처리 권장 |
| `parent_comment_id` | UUID | ❌ | 대댓글일 때 부모 댓글 ID. 없거나 falsy면 최상위 댓글 |
| `is_active` | boolean | ❌ | fillable. 보통 미전송(기본 true) |

> `comment`, `is_active` 만 `$fillable` 입니다. `depth` / `parent_comment_id` / `user_id` / `post_id` 는 서버가 설정합니다.

### ⑤ 인증 · 권한
- `auth:api` 필수.
- `post.is_allow_comment === true` 여야 함. 아니면 `400` (`validation.not_allow_comment`).
- `checkBoardPermission(post.board)['read'] === true` 여야 함. 아니면 `403`.
- 작성자는 항상 본인(`user_id = 현재 유저`)으로 설정됨.

### ⑥ Response (200)
저장된 댓글 객체(내부적으로 `updateComment` 결과 반환, `user` 관계 포함).

```json
{
  "id": "b1e...uuid",
  "post_id": "a0c...uuid",
  "user_id": 123,
  "parent_comment_id": null,
  "is_active": true,
  "depth": 1,
  "comment": "댓글 내용입니다",
  "created_at": "2026-08-26T10:00:00.000000Z",
  "updated_at": "2026-08-26T10:00:00.000000Z",
  "deleted_at": null,
  "is_mine": true,
  "user": {
    "id": 123, "name": "홍길동", "profile_image_id": 45,
    "account": "hong", "disabled_at": null, "deleted_at": null
  }
}
```

- `is_mine`: 모델 append 속성. 항상 현재 유저 기준으로 계산(작성 직후 true).
- `comment`: **`is_active=false` 이면 항상 `null` 로 내려감** (`getCommentAttribute` accessor).
- `depth`: 최상위=1, 대댓글=부모 depth+1.

### ⑦ 주의사항
- **댓글 수 갱신은 비동기**: 저장 시 `CommentObserver::Saved` → `ProcessCountComment` 큐 잡이 `post.comment_count` 를 갱신. 응답 시점엔 즉시 반영되지 않을 수 있음. 또한 잡은 `post.state === ACT` 일 때만 카운트 갱신.
- **알림 발송**: `ProcessCommentAlarm` 이 항상 dispatch 됨(잡 내부에서 `post.is_comment_alarm` / 유저별 `is_comment_alarm` 설정, 봇/비활성 유저 제외 등을 재확인). 게시글 작성자 + (대댓글이면)부모 댓글 작성자에게 PUSH. 본인 글/본인 댓글엔 미발송.
- **`parent_comment_id` 유효성 미검증**: 존재하지 않는 ID 전송 시 `Comment::find()` 가 null → `depth` 계산에서 서버 오류(500) 가능. 프론트에서 유효한 ID만 보낼 것.
- **깊은 대댓글**: depth 3 이상도 저장은 되지만, 게시글 상세(`getPost`)의 댓글 트리는 최상위(depth 1) + 직속 자식(`childComments`) 2단계만 채워집니다. 대대댓글도 `parent_comment_id` 기준으로 해당 부모의 자식에 붙습니다.

### ⑧ 시나리오

| 시나리오 | 요청 | 결과 |
| --- | --- | --- |
| 정상(최상위) | body `{comment:"안녕"}` | 200, `depth:1`, `parent_comment_id:null` |
| 정상(대댓글) | body `{comment:"답글", parent_comment_id:"<id>"}` | 200, `depth:2` |
| 댓글 미허용 게시글 | `post.is_allow_comment=false` | 400 `not_allow_comment` |
| 권한 실패 | 비공개 게시판 read 권한 없음 | 403 `no_permission` |
| 게시글 없음 | 잘못된 `{post}` | 404 |

---

## 2. 댓글 수정 — `updateComment`

### ① METHOD + URL
`PUT /api/v1/post/comment/{comment}`

### ② Path

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `comment` | UUID | ✅ | 수정할 댓글 ID |

### ③ Query
없음

### ④ Body

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `comment` | string | ❌ | 수정할 내용 (`$fillable`) |
| `is_active` | boolean | ❌ | `$fillable`. 활성/비활성 토글에도 사용 가능 |

### ⑤ 인증 · 권한
- `auth:api` 필수.
- **작성자 본인만 수정 가능**: `현재유저.id !== comment.user_id` 이면 `403`.
- 대상 게시글이 존재하고 `is_allow_comment=true` 이며 `state === ACT` 여야 함. 아니면 `400` (`not_allow_comment`).

### ⑥ Response (200)
수정된 댓글 객체(`user` 포함). 구조는 [1. 댓글 작성 Response](#⑥-response-200) 와 동일.

### ⑦ 주의사항
- 게시판 read 권한(`checkBoardPermission`)은 **재검사하지 않음**. 오직 작성자 본인 여부 + 게시글 상태만 확인.
- `is_active=false` 로 바꾸면 이후 응답에서 `comment` 필드가 `null` 로 마스킹됨.
- 저장 시에도 `ProcessCountComment` 가 다시 돌지만 총 개수는 변하지 않음.
- `insertComment` 가 내부적으로 이 메서드를 호출함(신규 댓글은 user_id가 본인이라 통과).

### ⑧ 시나리오

| 시나리오 | 요청 | 결과 |
| --- | --- | --- |
| 정상 | 본인 댓글, `{comment:"수정"}` | 200 |
| 권한 실패 | 타인 댓글 수정 | 403 `no_permission` |
| 게시글 비활성 | 게시글 `state != ACT` | 400 `not_allow_comment` |
| 댓글 없음 | 잘못된 `{comment}` | 404 |

---

## 3. 댓글 삭제 — `deleteComment`

### ① METHOD + URL
`DELETE /api/v1/post/comment/{comment}`

### ② Path

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `comment` | UUID | ✅ | 삭제할 댓글 ID |

### ③ Query / ④ Body
없음

### ⑤ 인증 · 권한
- `auth:api` 필수.
- 삭제 가능: **작성자 본인 OR 시스템 관리자(`isAdminUser`) OR 게시판 관리자(`isBoardAdmin`)**.
- 셋 다 아니면 `403`.

### ⑥ Response (200)
`is_active=false` 로 변경된 댓글 객체 반환.

```json
{
  "id": "b1e...uuid", "post_id": "a0c...uuid", "user_id": 123,
  "is_active": false, "depth": 1, "comment": null,
  "created_at": "...", "updated_at": "...", "deleted_at": null,
  "is_mine": true
}
```

### ⑦ 주의사항
- **하드/소프트 삭제가 아님**: `deleted_at` 은 그대로 두고 `is_active=false` 로만 변경(논리적 비활성화). 응답의 `comment` 는 `null` 로 마스킹.
- **`comment_count` 는 줄어들지 않음**: `ProcessCountComment` 는 `Comment::where('post_id')->count()` 로 세는데, `is_active=false` 행은 `deleted_at` 이 null 이라 여전히 카운트됨. 즉 삭제해도 게시글 댓글 수는 감소하지 않음. (프론트에서 comment_count 와 실제 표시 댓글 수가 다를 수 있음에 유의)
- 삭제된 댓글의 자식 대댓글은 그대로 유지됨(연쇄 삭제 없음).

### ⑧ 시나리오

| 시나리오 | 요청 | 결과 |
| --- | --- | --- |
| 정상(본인) | 본인 댓글 삭제 | 200, `is_active:false` |
| 정상(관리자) | 관리자가 타인 댓글 삭제 | 200 |
| 권한 실패 | 일반 유저가 타인 댓글 삭제 | 403 `no_permission` |
| 댓글 없음 | 잘못된 `{comment}` | 404 |

---

## 4. 게시글 공감(이모지) 토글 — `likePost`

### ① METHOD + URL
`POST /api/v1/post/like/{post}`

### ② Path

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `post` | UUID | ✅ | 공감할 게시글 ID |

### ③ Query
없음

### ④ Body

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `emoji` | string | ✅ | 이모지 반응 문자(예: `👍`, `❤️`). **미전송 시 400** |

> DB 기본값은 `👍` 이지만 API validator 는 `required` 이므로 **클라이언트가 반드시 emoji 를 명시**해야 함.

### ⑤ 인증 · 권한
- `auth:api` 필수.
- `checkBoardPermission(post.board)['read'] === true` 여야 함. 아니면 `403`.

### ⑥ Response (200)
`PostLike` 레코드 반환. (복합 PK `user_id + post_id + emoji`, 별도 `id` 없음, `user` 관계 미포함)

**공감 추가/재활성 시**
```json
{ "user_id": 123, "post_id": "a0c...uuid", "emoji": "👍",
  "created_at": "...", "updated_at": "...", "deleted_at": null }
```

**공감 취소(토글 OFF) 시** — 소프트 삭제된 레코드가 반환됨 (`deleted_at` 채워짐)
```json
{ "user_id": 123, "post_id": "a0c...uuid", "emoji": "👍",
  "created_at": "...", "updated_at": "...", "deleted_at": "2026-08-26T10:05:00Z" }
```

### ⑦ 주의사항 — **토글 & 이모지 동작 (중요)**
- **토글은 (유저 × 게시글 × 이모지) 단위**. 같은 emoji 로 다시 요청하면 취소(소프트 삭제), 없던 상태면 생성/재활성.
  - 처음 `👍` → 생성. 다시 `👍` → 취소(`deleted_at` set, 즉시 return, **알림 미발송**).
  - 이전에 취소했던 emoji 를 다시 요청 → `deleted_at=null` 로 재활성.
- **한 유저가 여러 이모지를 동시에 보유 가능**: PK 에 emoji 가 포함되므로 `👍` 와 `❤️` 를 각각 켜면 두 행 모두 활성. "유저당 1반응" 제약이 아님.
- **알림**: 공감을 **켤 때만** `ProcessLikeAlarm::dispatch(user_id, post_id)`. 게시글 작성자에게 PUSH(본인 글이면 미발송, 유저별 `is_like_alarm=false` 면 스킵). 취소 시 미발송.
- **`like_count` 는 비동기**: `PostLikeObserver` (saved/deleted) → `ProcessCountPostLike` 가 `PostLike::where('post_id')->count()` 로 갱신(`state===ACT` 일 때만). 응답 시점 즉시 반영 아님. 참고로 이 카운트는 **이모지 구분 없이 활성 반응 행 총합**(소프트삭제 제외).
- 캐시: `PostLike` 저장/삭제 시 `post_like_{post_id}_{user_id}` 캐시 무효화(게시글의 `is_like` append 속성용).

### 이모지 반응 집계 구조 (게시글 상세 `getPost` 기준 — 읽기 참고용)
게시글 상세에서 `post.likes` 는 이모지별로 집계됩니다.
```json
"likes": [
  { "emoji": "👍", "count": 12, "is_reacted": 1 },
  { "emoji": "❤️", "count": 3,  "is_reacted": 0 }
]
```
- `count`: 해당 이모지 활성 반응 수. `is_reacted`: 현재 유저가 그 이모지로 반응했으면 `1`, 아니면 `0`.

### ⑧ 시나리오

| 시나리오 | 요청 | 결과 |
| --- | --- | --- |
| 최초 공감 | `{emoji:"👍"}` (없던 상태) | 200, `deleted_at:null`, 알림 발송 |
| 동일 이모지 재요청(토글 OFF) | `{emoji:"👍"}` (이미 있음) | 200, `deleted_at` 채워짐, 알림 미발송 |
| 취소분 재활성 | `{emoji:"👍"}` (이전 취소) | 200, `deleted_at:null`, 알림 발송 |
| 다중 이모지 | `👍` 후 `❤️` | 두 행 모두 활성(독립) |
| 검증 실패 | emoji 누락 | 400 |
| 권한 실패 | read 권한 없음 | 403 `no_permission` |

---

## 5. 게시글 공감 누른 유저 목록 — `selectPostLikeUser`

### ① METHOD + URL
`GET /api/v1/post/like/{post}`

### ② Path

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `post` | UUID | ✅ | 게시글 ID |

### ③ Query

| 이름 | 타입 | 필수 | 기본 | 설명 |
| --- | --- | --- | --- | --- |
| `emoji` | string | ✅ | - | 조회할 이모지. **미전송 시 400** (이모지별로 분리 조회) |
| `take` | int | ❌ | 20 | 페이지당 개수 |
| `page` | int | ❌ | 1 | 페이지 번호 (Laravel 표준) |

### ④ Body
없음

### ⑤ 인증 · 권한
- `auth:api` 필수.
- **게시판 권한 검사 없음** (emoji validator 만 존재). 게시글 ID + emoji 만 알면 반응 유저 목록 조회 가능 (설계상 참고).

### ⑥ Response (200)
Laravel 페이지네이터. `data[]` 원소는 `{user_id, created_at, user}`.
```json
{
  "current_page": 1,
  "data": [
    { "user_id": 123, "created_at": "...",
      "user": { "id":123, "name":"홍길동", "profile_image_id":45, "disabled_at":null, "deleted_at":null } }
  ],
  "per_page": 20, "total": 12, "last_page": 1,
  "first_page_url": "...", "next_page_url": null, "prev_page_url": null
}
```

### ⑦ 주의사항
- 활성 반응만 조회(소프트 삭제 `deleted_at` 은 SoftDeletes 글로벌 스코프로 자동 제외).
- 이모지별로 따로 호출해야 함(집계된 이모지 목록은 게시글 상세 `post.likes` 참고).

### ⑧ 시나리오

| 시나리오 | 요청 | 결과 |
| --- | --- | --- |
| 정상 | `?emoji=👍&take=20` | 200, 페이지네이터 |
| 검증 실패 | emoji 누락 | 400 |
| 반응 없음 | 해당 emoji 반응 0건 | 200, `data:[]`, `total:0` |

---

## 6. 댓글 공감(이모지) 토글 — `likeComment`

### ① METHOD + URL
`POST /api/v1/post/like/comment/{comment}`

### ② Path

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `comment` | UUID | ✅ | 공감할 댓글 ID |

### ③ Query
없음

### ④ Body

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `emoji` | string | ✅ | 이모지 반응 문자. **미전송 시 400** |

### ⑤ 인증 · 권한
- `auth:api` 필수.
- 댓글이 속한 게시글의 `is_allow_comment=true` **그리고** `checkBoardPermission['read']=true` 여야 함. 하나라도 실패하면 `403`.
  - ⚠️ `likePost` 는 댓글허용 여부와 무관하지만, `likeComment` 는 `is_allow_comment=false` 여도 **403**(`likePost`/`insertComment` 의 400 과 status 가 다름).

### ⑥ Response (200)
`CommentLike` 레코드 반환. (복합 PK `user_id + post_id + comment_id + emoji`)

**추가/재활성**
```json
{ "user_id":123, "post_id":"a0c...uuid", "comment_id":"b1e...uuid", "emoji":"👍",
  "created_at":"...", "updated_at":"...", "deleted_at":null }
```
**취소(토글 OFF)** — `deleted_at` 채워진 레코드 즉시 반환.

### ⑦ 주의사항 — 토글 & 이모지
- 토글 단위는 **(유저 × 게시글 × 댓글 × 이모지)**. 동작 규칙은 `likePost` 와 동일(동일 emoji 재요청=취소, 취소분 재요청=재활성, 이모지별 독립 보유).
- **알림**: 켤 때만 `ProcessCommentLikeAlarm::dispatch(user_id, comment_id)` → 댓글 작성자에게 PUSH(본인 댓글이면 미발송, `is_comment_alarm`/`is_like_alarm` 설정 체크).
- **댓글 공감엔 카운트 컬럼/옵저버 없음**: `comment_likes` 는 별도 count 컬럼이 없고 옵저버도 없음. 집계는 게시글 상세에서 캐시로 계산.
- **캐시 무효화**: 저장/삭제 시 `post_comment_likes_{post_id}` 캐시 `forget`. (이 캐시는 `getPost` 의 댓글별 like 집계에 사용, TTL 300초)

### 댓글 이모지 집계 구조 (게시글 상세 `getPost` — 읽기 참고용)
각 댓글/대댓글에 `likes` 배열이 붙습니다. `Post::getCommentLikesStats()` 결과.
```json
"likes": [
  { "comment_id": "b1e...uuid", "emoji": "👍", "count": 5, "is_reacted": 1 }
]
```
- `is_reacted=1` → 현재 유저가 그 이모지로 반응함. 캐시 TTL 300초라 `likeComment` 직후에도 `forget` 으로 최신화됨.

### ⑧ 시나리오

| 시나리오 | 요청 | 결과 |
| --- | --- | --- |
| 최초 공감 | `{emoji:"👍"}` | 200, `deleted_at:null`, 알림 발송 |
| 동일 이모지 재요청 | `{emoji:"👍"}` | 200, `deleted_at` 채워짐, 알림 미발송 |
| 다중 이모지 | `👍` 후 `😂` | 두 행 모두 활성 |
| 댓글 미허용/권한 실패 | `is_allow_comment=false` 또는 read 없음 | 403 `no_permission` |
| 검증 실패 | emoji 누락 | 400 |
| 댓글 없음 | 잘못된 `{comment}` | 404 |

---

## 7. 댓글 공감 누른 유저 목록 — `selectCommentLikeUser`

### ① METHOD + URL
`GET /api/v1/post/like/comment/{comment}`

### ② Path

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `comment` | UUID | ✅ | 댓글 ID |

### ③ Query

| 이름 | 타입 | 필수 | 기본 | 설명 |
| --- | --- | --- | --- | --- |
| `emoji` | string | ✅ | - | 조회할 이모지. **미전송 시 400** |
| `take` | int | ❌ | 20 | 페이지당 개수 |
| `page` | int | ❌ | 1 | 페이지 번호 |

### ④ Body
없음

### ⑤ 인증 · 권한
- `auth:api` 필수.
- **게시판 권한 검사 없음** (emoji validator 만 존재). `selectPostLikeUser` 와 동일.

### ⑥ Response (200)
Laravel 페이지네이터. `data[]` = `{user_id, created_at, user}`. 구조는 [5. Response](#⑥-response-200-4) 와 동일(내부적으로 `post_id + comment_id + emoji` 로 필터).

### ⑦ 주의사항
- 활성 반응만 조회(소프트 삭제 제외).
- 이모지별 분리 조회.

### ⑧ 시나리오

| 시나리오 | 요청 | 결과 |
| --- | --- | --- |
| 정상 | `?emoji=👍` | 200, 페이지네이터 |
| 검증 실패 | emoji 누락 | 400 |
| 반응 없음 | 0건 | 200, `data:[]` |

---

## 부록 — 핵심 함정(요약)

1. **공감 토글은 이모지 단위**: 같은 emoji 재요청 = 취소, 다른 emoji = 별도 반응. 한 유저가 여러 이모지 동시 보유 가능(유저당 1반응 아님).
2. **공감 API 는 emoji 필수**: 4개 like 엔드포인트 모두 `emoji` 가 `required`. DB 기본값 `👍` 에 의존 불가.
3. **취소(토글 OFF) 시 알림 미발송 & 소프트삭제 레코드 반환**: `deleted_at` 이 채워진 객체가 200 으로 옴 → 프론트는 `deleted_at` 유무로 켜짐/꺼짐 판정.
4. **`comment_count` 는 삭제해도 안 줄어듦**: `deleteComment` 는 `is_active=false` 만 세팅, 카운트 잡은 행 수(삭제 아님)를 세므로 감소하지 않음.
5. **카운트/알림은 큐 비동기**: `comment_count`/`like_count` 는 옵저버→Job 으로 갱신되어 응답에 즉시 반영되지 않을 수 있음. 카운트 잡은 `post.state === ACT` 일 때만 동작.
6. (부가) **like 유저 목록 GET 2종은 게시판 권한 미검사** / `likeComment` 는 `is_allow_comment=false` 에 400 이 아닌 **403** 반환(다른 댓글 API 와 status 상이).
