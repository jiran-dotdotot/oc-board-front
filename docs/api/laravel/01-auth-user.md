# 01. 인증 · 유저 API (Auth / User)

`jupiter-board-api` (Laravel 10 사내 게시판 API) 의 **인증 및 현재 유저 조회** 엔드포인트 문서입니다.
모든 내용은 소스 코드를 직접 읽고 작성했습니다.

- 소스: `app/Http/Controllers/User/UserController.php`, `app/Http/Controllers/test/TestController.php`
- 관련: `app/Models/User.php`, `app/Http/Response/ReturnCode.php`, `app/Http/Middleware/SetLocale.php`, `app/Http/Controllers/Management/ManagementController.php`
- 라우팅: `routes/api.php`, `app/Providers/RouteServiceProvider.php`

---

## 0. 공통 규약

### 0.1 Base URL / 경로 prefix

| 항목 | 값 |
|------|-----|
| 로컬 Base URL | `http://localhost:8000` |
| 전체 라우트 prefix | `/api` (RouteServiceProvider 에서 `routes/api.php` 를 `prefix('api')` 로 로드) |
| v1 그룹 | `/api/v1/...` |

> **함정 ①** — `routes/api.php` 의 `Route::get('test', ...)` 는 `api` prefix 가 붙어 실제 URL 이 **`GET /api/test`** 입니다. (`/test` 아님) `v1` 그룹만 다시 `/v1` 이 붙어 `/api/v1/...` 가 됩니다.

### 0.2 인증

- `/api/v1/*` 는 전부 `auth:api` + `locale.set` 미들웨어 적용.
- **`auth:api` 가드는 Passport 드라이버** 입니다 (`config/auth.php` → `guards.api.driver = 'passport'`, provider `users` = `App\Models\User`).
- 인증 헤더: `Authorization: Bearer <access_token>`
- **인증이 필요 없는 엔드포인트**: `POST /api/v1/token`, `POST /api/v1/login`, `GET /api/test`
  - (단 `token` / `login` 은 `locale.set` 미들웨어는 통과합니다.)

### 0.3 요청 공통 헤더 (`SetLocale` 미들웨어)

`locale.set` 미들웨어(`SetLocale.php`)가 아래 헤더를 읽어 앱 로케일/타임존을 설정합니다. 헤더명은 대소문자 무관.

| 헤더 | 필수 | 기본값 | 설명 |
|------|:----:|--------|------|
| `Authorization` | 인증 라우트 한정 | - | `Bearer <access_token>` |
| `lang` | 선택 | `ko` | 응답/검증 메시지 로케일. `ko` \| `en` \| `ja` (`resources/lang/*`) |
| `Time_zone` | 선택 | `Asia/Seoul` | 앱 타임존 |

> **함정 ②** — `SetLocale` 미들웨어는 **모든 요청마다** 헤더/파라미터/쿼리/서버/파일 전체를 `Log` 모델로 DB 에 저장합니다(`$log->save()`). 즉 `token`/`login` 요청의 원문(비밀번호 포함 가능)이 로그 테이블에 남습니다. 문서화 대상은 아니지만 프론트/보안 관점 참고.

### 0.4 응답 규약 (`ReturnCode`)

- **성공**: 모델/배열을 그대로 JSON 반환 (별도 래핑 없음).
- **실패**: `ReturnCode::customResponse($status, ['message' => ...])` 또는 `ReturnCode::validationCheck(...)` 가 `abort(response($json, $status))` 로 즉시 응답 종료.

에러 응답 JSON 형태:

```json
{ "message": "에러 메시지" }
```

옵션에 따라 `code`, `response` 필드가 추가될 수 있습니다.
- `APP_ERROR_CODE_DEBUG` 가 켜져 있으면 검증 실패 시 `code` (validation type 번호) 가 함께 내려갑니다.

주요 상태 코드 (`ReturnCode.php`):

| 상수 | 코드 | 기본 message | 의미 |
|------|:----:|--------------|------|
| `$SUCCESS` | 200 | - | 성공 |
| `$BAD_REQUEST` | 400 | `invalid input data` | 잘못된 요청 / 검증 실패 |
| `$UNAUTHORIZED` | 401 | `Unauthorized` | 인증 실패 |
| `$FORBIDDEN` | 403 | (직접 지정) | 권한 거부 |
| `$NOT_FOUND` | 404 | `not found` | 리소스 없음 |
| `$CONFLICT` | 409 | `data conflict` | 중복/충돌 |
| `$SERVER_ERROR` | 500 | `Server Error` | 서버 에러 |

검증 타입 (`validationCheck` 의 `$type`):

| 상수 | 값 | 실패 시 status |
|------|:--:|----------------|
| `$VALIDATION_TYPE_REQUIRED` | 501 | 400 (`Validator` 첫 에러 메시지) |
| `$VALIDATION_TYPE_EMPTY` | 502 | 404 (`not found`) |
| `$VALIDATION_TYPE_OVERWRITE` | 504 | 409 (`overwrite`) |
| `$VALIDATION_TYPE_AUTHORITY` | 505 | 401 |

> `auth:api` 인증 자체 실패(토큰 없음/만료)는 Laravel/Passport 기본 응답인 **401 `{"message":"Unauthenticated."}`** 입니다 (ReturnCode 를 거치지 않음).

---

## 1. User 모델 & 토큰 발급 흐름

### 1.1 `App\Models\User` 요약

| 항목 | 값 |
|------|-----|
| `$connection` | `officewave` (외부 O.V 오피스웨이브 DB) |
| `$table` | `public.users` |
| `$primaryKey` | `id` |
| `$fillable` | `id`, `email`, `account` |
| `$appends` | `profile_src` (※ `is_admin` 은 주석 처리되어 자동 append 안 됨) |
| 인증 | `HasApiTokens` (Sanctum trait) + Passport 용 메서드 존재 |

**관계(relations)**

| 관계 | 대상 | 조건 |
|------|------|------|
| `member()` | `Member` (hasOne) | `default = true` 인 멤버 1건, `department`·`rank` eager load |
| `companySetting()` | `CompanySetting` (hasOne) | `company_id` 매칭, `companyMainBoards` eager load |
| `companyUserSetting()` | `CompanyUserSetting` (hasOne) | `user_id` 매칭 + **현재 로그인 유저의 `company_id`** 로 스코프 (`UserController::getMe()` 호출) |

**접근자(accessors)**

| 필드 | 동작 |
|------|------|
| `name` | `deleted_at` 있으면 `이름(퇴사)`, `disabled_at` 있으면 `이름(알수없음)`, 아니면 원본 (`variable.retired`/`variable.unknown` 로케일) |
| `account` | `disabled_at` 있으면 `account(알수없음)`, 아니면 원본 |
| `profile_src` | `profile_image_id` 존재 & `disabled_at` 없음 → `{OFFOCEWAVE_SURVEY_HOST}/image/resize/s?image_url={AWS_FOLDER}/user/profile/{profile_image_id}/profile_image.png`, 아니면 `null` |
| `is_admin` | `ManagementController::isAdminUser(company_id)` — `management.admins` 조회, **10초 캐시** |

> **함정 ③** — `profile_src` 의 host 는 env 키 오타 그대로 **`OFFOCEWAVE_SURVEY_HOST`** (OFFICE 아님) 를 사용합니다. 로컬 `.env` 에서 이 값이 비어 있으면 `profile_src` 가 `/image/resize/...` 처럼 host 없는 깨진 URL 로 내려갑니다.

**Passport 관련 메서드**

- `findForPassport($id)` — `id` 로 유저 조회 (password grant 의 username = user id).
- `validateForPassportPasswordGrant($password)` — **무조건 `true` 반환**.

> **함정 ④** — 아래 `getToken()` 은 password grant 이면서 `password` 를 고정 문자열 `'password'` 로 보내고, 위 검증이 항상 `true` 이므로 **user id 만 알면 비밀번호 검증 없이 토큰이 발급**됩니다. 즉 실제 신원 검증은 상위(`token`=Jupiter JWT 서명 검증, `login`=officenext 로그인)에서만 이뤄집니다. 이 두 진입점을 거치지 않고 `/oauth/token` 을 직접 호출하면 인증이 우회될 수 있는 구조입니다.

### 1.2 `getToken($id)` — 내부 토큰 발급

`token` / `login` 두 엔드포인트가 최종적으로 호출하며, 서버 내부에서 Passport `/oauth/token` 로 서브 요청을 만들어(`app()->handle()`) 결과를 그대로 반환합니다.

password grant 파라미터:

| 필드 | 값 |
|------|-----|
| `grant_type` | `password` |
| `client_id` | `env('CLIENT_ID')` |
| `client_secret` | `env('CLIENT_SECRET')` |
| `username` | 대상 user id (문자열) |
| `password` | `'password'` (고정) |
| `scope` | `''` |

**성공 응답(= Passport 표준)**

```json
{
  "token_type": "Bearer",
  "expires_in": 31536000,
  "access_token": "eyJ0eXAiOiJKV1Qi...",
  "refresh_token": "def50200a1b2c3..."
}
```

이 `access_token` 을 이후 `/api/v1/*` 요청의 `Authorization: Bearer` 로 사용합니다.

---

## 2. `POST /api/v1/token` — Jupiter JWT 로 토큰 발급 (`getJupiterToken`)

O.V(오피스웨이브) 가 발급한 Jupiter JWT 를 검증(dehashing)해 내부 access_token 을 발급합니다. 게시판 SSO 진입용.

### 2.1 요청

- **Method / URL**: `POST http://localhost:8000/api/v1/token`
- **Path 파라미터**: 없음
- **Query 파라미터**: 없음
- **인증**: 불필요 (Bearer 없이 호출)

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| `token` | string | ✅ | O.V 가 발급한 Jupiter JWT. `OFFICEWAVE_SECRET_KEY` (**ES256**) 로 서명 검증/디코딩 |

JWT payload 에서 사용하는 클레임: `company_id`, `user_id`.

### 2.2 처리 흐름

1. `token` 필수 검증 (없으면 400).
2. `dehashing()` — `JWT::decode($token, Key(OFFICEWAVE_SECRET_KEY, 'ES256'))`.
   - `JWT::$leeway = 현재 timestamp` 로 설정(만료 검증이 사실상 매우 관대해짐).
   - 실패 시 `O.V Access Token Decode Error : ...` 예외.
3. `company_id` 로 `companies.grade` 조회 → 회사가 없거나 `grade === 'OFFICE_FREE'` 이면 예외(Free 플랜 차단).
4. `getToken(payload->user_id)` 로 내부 토큰 발급.
5. `ManagementController::checkManager(payload)` — O.V `managers` 테이블(TOP_MANAGER_LEVEL=80) 기준으로 `management.admins` 를 동기화(생성/복구/soft delete).
6. 토큰 응답 반환.

### 2.3 응답

- **성공(200)**: [1.2 getToken 성공 응답](#12-gettokenid--내부-토큰-발급) 과 동일 (`access_token`, `refresh_token`, `expires_in`, `token_type`).
- **실패**: `try/catch` 로 **모든 예외**를 잡아 `Log` 저장 후 **403** 반환.

```json
{ "message": "<예외 메시지>" }
```

### 2.4 주의사항

- **함정 ⑤** — 실패 원인(JWT 서명오류/만료, 회사 없음, Free 플랜, 토큰발급 실패)이 무엇이든 전부 **403** 으로 뭉뚱그려 내려갑니다. 원인 구분은 `message` 문자열로만 가능.
- 로컬 환경에서는 `OFFICEWAVE_SECRET_KEY` 가 **비어 있을 수 있어**(`.env.local` 확인) 실제 JWT 검증이 불가 → 로컬에서 이 엔드포인트 테스트는 어렵습니다. 로컬은 `POST /login` 을 사용.
- `JWT::$leeway` 를 현재 timestamp 로 잡아 만료 검증이 사실상 무력화되는 점 유의.

### 2.5 시나리오

| 상황 | 결과 |
|------|------|
| 정상 JWT + 유료 회사 | 200, 토큰 발급 |
| `token` 누락 | 400, `The token field is required.` (로케일별) |
| 서명/디코드 실패 | 403, `O.V Access Token Decode Error : ...` |
| 회사 없음 / `OFFICE_FREE` | 403, `Free 플랜은 게시판/자료실을 이용하실 수 없습니다.` |

---

## 3. `POST /api/v1/login` — officenext 계정 로그인 (`loginWithOfficeNext`)

officenext(외부 인증 서버, 로컬 `:8080`) 아이디/비번으로 로그인 → officenext 유저를 조회 → `sync_id` 로 officewave 유저를 매칭 → **내부(jupiter-board) access_token** 을 발급합니다. 로컬 개발 시 주 로그인 경로.

### 3.1 요청

- **Method / URL**: `POST http://localhost:8000/api/v1/login`
- **Path / Query 파라미터**: 없음
- **인증**: 불필요

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| `username` | string | ✅ | officenext 로그인 아이디 |
| `password` | string | ✅ | officenext 비밀번호 |

### 3.2 처리 흐름

1. `username`, `password` 필수 검증 (없으면 400).
2. `getOfficeNextToken()` → `POST {OFFICENEXT_API_URL}/oauth/token` (form) 로 officenext 토큰 요청.
   - grant: `password`, `client_id/secret` = `OFFICENEXT_CLIENT_ID/SECRET`, `scope=web`.
3. 성공 시 `GET {OFFICENEXT_API_URL}/api/user` (officenext access_token 으로) 호출해 유저 정보 획득.
4. officewave `users` 에서 `sync_id = officenext.user.id` 로 유저 매칭 (`firstOrFail`).
5. 매칭 유저의 `company_id` 로 `companies.grade` 확인 → 없거나 `OFFICE_FREE` 면 **403**.
6. `ManagementController::checkManager()` 로 admin 동기화.
7. `getToken(user->id)` 로 **내부 토큰** 발급 후 반환.

> **함정 ⑥** — 반환되는 것은 **officenext 토큰이 아니라 jupiter-board 내부 access_token** 입니다. officenext 토큰은 유저 조회·매칭에만 쓰이고 응답에 포함되지 않습니다.

### 3.3 응답

- **성공(200)**: [1.2 getToken 성공 응답](#12-gettokenid--내부-토큰-발급) 과 동일.
- **실패**: 단계별로 상태 코드가 달라짐 (아래 표).

### 3.4 실패 케이스 (상세)

| 단계 | 조건 | status | message 출처 |
|------|------|:------:|--------------|
| 입력 검증 | `username`/`password` 누락 | 400 | Validator 첫 메시지 |
| officenext `/oauth/token` | 로그인 실패(비번 오류 등) | officenext 응답 status 그대로 | `message` \| `error_description` \| 원문 body |
| officenext `/api/user` | 유저 조회 실패 | 해당 응답 status 그대로 | `message` \| `error_description` \| 원문 body |
| 유저 매칭 | `sync_id` 매칭 실패 (`firstOrFail`) | **404** | Laravel 기본 핸들러 (ReturnCode 형식 아님) |
| 회사 검증 | 회사 없음 / `OFFICE_FREE` | 403 | `Free 플랜은 게시판/자료실을 이용하실 수 없습니다.` |

> **함정 ⑦** — `sync_id` 매칭 실패는 `firstOrFail()` 의 `ModelNotFoundException` 이 그대로 프레임워크로 전파되어 **404** 로 응답됩니다. 이 경우만 `customResponse` 를 안 거쳐 응답 형태가 다를 수 있습니다(디버그 설정에 따라 message 상이). "officenext 로그인은 됐는데 게시판 유저가 없음" 상황을 프론트에서 404 로 구분 처리 필요.

### 3.5 시나리오

| 상황 | 결과 |
|------|------|
| 정상 (officenext OK + 매칭 유저 + 유료 회사) | 200, 내부 토큰 |
| `username`/`password` 누락 | 400 |
| officenext 비번 오류 | officenext status(주로 400/401) + 그 메시지 |
| officenext 는 성공했으나 officewave 매칭 유저 없음 | 404 |
| 매칭됐으나 회사 Free/없음 | 403 |
| `OFFICENEXT_API_URL` 미설정/서버 다운 | HTTP 연결 예외(500대) |

---

## 4. `GET /api/v1/me` — 현재 유저 + 부가정보 (`getMeWithMember`)

로그인 유저 본인 정보와 관계 데이터, 관리자 권한 플래그를 반환합니다.

### 4.1 요청

- **Method / URL**: `GET http://localhost:8000/api/v1/me`
- **Path / Query 파라미터**: 없음
- **Request Body**: 없음
- **인증**: **필요** (`Authorization: Bearer <access_token>`)

### 4.2 처리 흐름

1. `request()->user()` 로 현재 유저 획득.
2. `User::with(['member', 'companySetting', 'companyUserSetting'])->find(id)`.
3. 원시 SQL(PostgreSQL, `id::INTEGER`)로 `management.admins` / `category_admins`(유효 카테고리 존재) / `board_admins`(유효 게시판 존재) 존재 여부를 `leftJoinSub` 로 각각 1건씩 조회.
4. 존재 여부를 `is_admin` / `is_category_admin` / `is_board_admin` 불리언으로 세팅 후 반환.

### 4.3 응답 (200) 구조

`User` 모델 JSON + 관계 + 권한 플래그. 주요 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | int | 유저 id (officewave) |
| `company_id` | int | 소속 회사 id (모든 스코프 기준) |
| `name` | string | 접근자 적용 (`(퇴사)`/`(알수없음)` 접미사 가능) |
| `account` | string | 접근자 적용 |
| `email` | string | 이메일 |
| `profile_src` | string\|null | 프로필 이미지 URL (§1.1, 함정 ③) |
| `member` | object\|null | `default=true` 멤버 + `department`(id,parent_id,name,path,position) + `rank`(id,name) |
| `companySetting` | object\|null | 회사 게시판 설정 + `companyMainBoards[]` |
| `companyUserSetting` | object\|null | 개인 알림/검색어 설정 (아래) |
| `is_admin` | bool | 기능(회사) 관리자 여부 |
| `is_category_admin` | bool | 카테고리 관리자 여부(유효 카테고리 기준) |
| `is_board_admin` | bool | 게시판 관리자 여부(유효 게시판 기준) |

**`companySetting` 주요 필드** (`management.company_settings`)

| 필드 | 타입 | 설명 |
|------|------|------|
| `is_post_alarm` / `is_comment_alarm` | bool | 게시글/댓글 알림 |
| `latest_post_day` | int | 최신글 노출일(기본 30) |
| `latest_post_type` | string | `BOARD`\|`PREVIEW`\|`ALBUM` |
| `latest_post_description` | string | 최신글 설명 |
| `post_badge_type` | json | 뱃지 정의 배열 |
| `companyMainBoards` | array | 메인 게시판 목록(`position` asc) |

**`companyUserSetting` 주요 필드** (`management.company_user_settings`)

| 필드 | 타입 | 설명 |
|------|------|------|
| `is_post_alarm` / `is_notice_alarm` / `is_public_post_alarm` / `is_comment_alarm` / `is_like_alarm` | bool | 개인 알림 설정 |
| `recent_search_keyword` | string[] | 최근 검색어 (커스텀 접근자로 PG `TEXT[]` ↔ 배열 변환) |

### 4.4 주의사항

- **함정 ⑧** — `is_admin` 은 쿼리로 계산해 세팅하지만, `User` 모델에 `getIsAdminAttribute()` 접근자가 존재하여 **JSON 직렬화 시 접근자가 값을 다시 계산**합니다(`management.admins` 조회, **10초 캐시**). 즉 응답의 `is_admin` 은 접근자 기준이며, `is_category_admin`/`is_board_admin` 은 접근자가 없어 쿼리 결과 그대로입니다. (두 경로 모두 admins 존재 여부라 값은 동일)
- `is_category_admin` / `is_board_admin` 은 각각 **삭제되지 않고 실존하는** 카테고리/게시판에 연결된 관리자만 `true` (join 서브쿼리에서 `whereNotNull` 로 필터).
- `member` 는 회사가 여러 개여도 `default=true` 인 1건만 옵니다. default 멤버가 없으면 `null`.
- `companyUserSetting` 관계는 정의 내부에서 `UserController::getMe()` 로 현재 유저 `company_id` 를 참조하므로, 인증 컨텍스트가 있는 요청에서만 의미가 있습니다.

### 4.5 시나리오

| 상황 | 결과 |
|------|------|
| 정상 (유효 토큰) | 200, 위 구조 |
| 토큰 없음/만료 | 401 `{"message":"Unauthenticated."}` (Passport 기본) |
| 관리자 아님 | 200, 세 플래그 모두 `false` |
| 설정/멤버 미생성 | 200, `companySetting`/`companyUserSetting`/`member` 가 `null` |

---

## 5. `GET /api/test` — 환경 확인용 (`TestController@test`)

DB 호스트 확인용 공개 디버그 엔드포인트. (실제 URL 은 `/api/test` — 함정 ① 참고)

### 5.1 요청

- **Method / URL**: `GET http://localhost:8000/api/test`
- **인증**: 불필요 (완전 공개)
- **Path 파라미터**: 없음

**Query 파라미터**

| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| `secret` | string | ✅(사실상) | `sjwiq200` 또는 `chogeonhee` 여야 DB 정보 반환 |

### 5.2 응답 (항상 200)

- `secret` 이 `sjwiq200` 또는 `chogeonhee` 인 경우:

```json
{
  "DB_HOST": "<env DB_HOST>",
  "DB_HOST_OFFICEWAVE": "<env DB_HOST_OFFICEWAVE>"
}
```

- 그 외(누락/오타 포함): 문자열 `"check secret"` 반환.

### 5.3 주의사항

- **함정 ⑨** — 인증 없이 하드코딩된 secret 두 개(`sjwiq200`, `chogeonhee`)로 **DB 호스트가 그대로 노출**됩니다. 운영 환경에서는 제거/차단 권장. 프론트 개발용으로만 참고.

---

## 부록 — 발견한 함정 요약

1. `/test` 의 실제 경로는 **`/api/test`** (전체 라우트에 `api` prefix 적용).
2. `SetLocale` 미들웨어가 **모든 요청 원문을 DB(Log)에 저장** — 로그인 자격증명 포함 가능.
3. `profile_src` host env 키 오타 `OFFOCEWAVE_SURVEY_HOST`, 로컬 미설정 시 깨진 URL.
4. password grant + `validateForPassportPasswordGrant`=항상 true + 고정 password → user id 만으로 토큰 발급 가능 (`/oauth/token` 직접 호출 시 인증 우회 소지).
5. `POST /token` 은 모든 실패를 **403 하나로** 반환 (원인은 message 로만 구분).
6. `POST /login` 응답 토큰은 officenext 가 아니라 **내부 jupiter-board 토큰**.
7. `POST /login` 의 `sync_id` 매칭 실패는 `firstOrFail` → **404**(ReturnCode 형식 아님).
8. `/me` 의 `is_admin` 은 직렬화 시 접근자(10초 캐시)로 재계산; `is_category_admin`/`is_board_admin` 은 쿼리 결과 그대로.
9. `GET /api/test` 는 하드코딩 secret 로 DB 호스트 노출 — 운영 차단 권장.
