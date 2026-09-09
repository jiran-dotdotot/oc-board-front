# 02. 관리(Management) API

사내 게시판 관리 기능(관리자 지정 / 회사 설정 / 개인 설정 / 카테고리·게시판 정렬) 엔드포인트 문서입니다.
모든 내용은 컨트롤러 소스를 직접 확인해 작성했습니다.

- 컨트롤러
  - `app/Http/Controllers/Management/ManagementController.php`
  - `app/Http/Controllers/Category/CategoryController.php`
  - `app/Http/Controllers/Board/BoardController.php`
- 라우트: `routes/api.php` (`v1` → `locale.set` → `auth:api` → `management` prefix)
- 스키마: `doc/v1/management.sql`, `doc/v1/category.sql`, `doc/v1/board.sql`

---

## 공통 사항

### Base URL / 공통 prefix
- 로컬 Base URL: `http://localhost:8000`
- 모든 경로 prefix: `/api/v1`
- 이 문서의 엔드포인트는 추가로 `/management` prefix 안에 있습니다.

### 인증 / 로케일
- 미들웨어: `auth:api` (Laravel Passport, Bearer 토큰) + `locale.set`
- 필수 헤더

| 헤더 | 필수 | 설명 |
|------|------|------|
| `Authorization` | O | `Bearer <access_token>` |
| `Lang` | X | `ko`(기본) / `en` / `ja`. 에러 메시지 로케일. 미지정 시 `ko` |
| `Time_zone` | X | 기본 `Asia/Seoul` |

- 토큰이 없거나 유효하지 않으면 Passport 가 `401 Unauthorized` 를 반환합니다.
- `locale.set`(`SetLocale`) 미들웨어는 매 요청을 `logs` 테이블에 기록합니다(헤더/파라미터 포함).

### 현재 유저 / 회사 스코프
- 현재 유저: `UserController::getMe()` = `request()->user()` (Passport 인증 유저). 주요 필드: `id`(int), `company_id`(int).
- 거의 모든 데이터는 `company_id` 로 스코프됩니다.

### 관리자(office 관리자) 판별 — `ManagementController::isAdminUser($companyId)`
- `management.admins` 테이블에 `company_id = $companyId AND user_id = 현재 유저 id` 행이 있으면 관리자(`true`).
- 결과는 **10초간 캐시**됩니다. 캐시 키: `user_admin_check_{companyId}_{userId}`. (관리자 추가/삭제 시 해당 키는 자동 무효화)
- 주의: 이 값은 "office 최고 관리자(admins 등록 여부)"이며, 카테고리 관리자(`category_admins`)와는 별개입니다.

### 응답 규약
- **성공**: 해당 Eloquent 모델 또는 배열을 그대로 JSON 으로 반환 (별도 래핑 없음). 상태코드 `200`.
- **실패**: `ReturnCode` 를 통해 반환. 본문은 아래 형태.

```json
{ "message": "에러 메시지", "code": 501, "response": { } }
```

| 키 | 설명 |
|----|------|
| `message` | 에러 메시지. 권한/검증 실패 시 로케일 번역 문자열 |
| `code` | 선택. `env('APP_ERROR_CODE_DEBUG')` 가 켜져 있거나 옵션으로 지정한 경우에만 포함 (validation type 코드 등) |
| `response` | 선택. 추가 데이터가 있을 때만 포함 |

주요 상태코드 (`app/Http/Response/ReturnCode.php`)

| HTTP | 사용 상황 | 기본 message |
|------|-----------|--------------|
| `200` | 성공 | - |
| `400` | 유효성 검증 실패(`VALIDATION_TYPE_REQUIRED`) | validator 첫 번째 오류 메시지 |
| `403` | 권한 없음 / 대상 없음(FORBIDDEN 으로 처리) | `권한이 없습니다.` 등 |
| `404` | route model binding 실패, `firstOrFail` 실패 | `No query results...` / not found |
| `500` | 트랜잭션 예외(`catch`) | 예외 메시지 그대로 |

로케일별 주요 메시지 (`resources/lang/{ko,en,ja}/validation.php`)

| 키 | ko | en | ja |
|----|----|----|----|
| `no_permission` | 권한이 없습니다. | no permission. | 許可なし。 |
| `not_found` | 찾을 수 없습니다. | not found. | 見つかりません。 |
| `already_exist_admin` | already exist admin. | already exist admin. | already exist admin. |
| `already_exist_company_setting` | already exist company setting. | already exist company setting. | already exist company setting. |

> route model binding(`{companySetting}`, `{category}`)에 존재하지 않거나 soft-delete 된 UUID 를 넘기면 컨트롤러 진입 전에 `404` 가 발생합니다.

---

## 엔드포인트 목록

| # | Method | URL | 컨트롤러 메서드 | 권한 |
|---|--------|-----|-----------------|------|
| 1 | POST | `/api/v1/management/admin` | `ManagementController::insertAdmin` | office 관리자 |
| 2 | POST | `/api/v1/management/company-setting` | `ManagementController::insertCompanySetting` | office 관리자 |
| 3 | POST | `/api/v1/management/company-setting/{companySetting}` | `ManagementController::updateCompanySetting` | office 관리자(+회사 일치) |
| 4 | PUT | `/api/v1/management/user-setting/search-keyword` | `ManagementController::updateUserRecentSearchKeyword` | 인증 유저 본인 |
| 5 | POST | `/api/v1/management/user-setting/{companySetting}` | `ManagementController::updateCompanyUserSetting` | 인증 유저 본인 |
| 6 | POST | `/api/v1/management/category/edit` | `CategoryController::editCategoryPosition` | office 관리자 **또는** 카테고리 관리자 |
| 7 | POST | `/api/v1/management/category` | `CategoryController::updateTopCategoryPosition` | office 관리자 |
| 8 | POST | `/api/v1/management/category/{category}` | `CategoryController::updateCategoryPosition` | office 관리자 |
| 9 | POST | `/api/v1/management/board` | `BoardController::updatePublicBoardPosition` | office 관리자 |
| 10 | POST | `/api/v1/management/board/{category}` | `BoardController::updateBoardPosition` | office 관리자 |

> 라우트 등록 순서상 `POST /management/category/edit` 는 `edit` 이 `{category}` 보다 먼저 정의되어 있어 6번(editCategoryPosition)으로 매칭됩니다.

---

## 1. POST `/api/v1/management/admin` — 관리자 추가

특정 유저를 현재 회사의 office 관리자(`management.admins`)로 등록합니다.

### Path 파라미터
없음

### Query 파라미터
없음

### Request Body

| 필드 | 타입 | 필수 | 저장 값 / 설명 |
|------|------|------|----------------|
| `user_id` | int | O | 관리자로 지정할 대상 유저 id. 같은 회사(`company_id`) 소속이어야 함 |

- 검증 규칙: `user_id => 'required:int'`
- ⚠️ `required:int` 은 Laravel 규칙으로는 `required` 만 적용됩니다(`:int` 는 무시됨). 즉 **존재 여부만 검증하고 정수 타입 검증은 하지 않습니다.**

### 인증 / 권한
- `auth:api` 필요.
- 현재 유저가 자기 회사의 office 관리자여야 함(`isAdminUser(user->company_id)`). 아니면 `403 no_permission`.

### Response (200)
`management.admins` 신규 행(모델) 반환.

```json
{
  "user_id": 123,
  "company_id": 45,
  "is_manager": false,
  "updated_at": "2026-08-26T05:00:00.000000Z",
  "created_at": "2026-08-26T05:00:00.000000Z",
  "id": "d1f8...-uuid"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | admin id |
| `user_id` | int | 대상 유저 |
| `company_id` | int | 회사 id (현재 유저 회사) |
| `is_manager` | bool | office Manager 여부. 이 API 로 생성 시 항상 `false` (top manager 승격은 로그인 시 `checkManager` 가 별도 처리) |

### 주의사항
- 대상 유저가 같은 회사에 없으면 `403` + `not_found`(`찾을 수 없습니다.`).
- 이미 (활성) 관리자면 `403` + `already_exist_admin`.
- 중복 체크는 soft-delete 를 제외한 활성 행만 봅니다(`withTrashed` 미사용). 과거에 삭제된 관리자를 다시 추가하면 **새 행**이 생성됩니다(테이블에 (company_id,user_id) unique 없음).
- 저장 시 해당 유저의 관리자 캐시가 무효화됩니다.

### 시나리오

| 상황 | 결과 |
|------|------|
| 정상 (관리자 + 같은 회사 유저 + 미등록) | `200`, admin 행 |
| `user_id` 누락 | `400`, validator 메시지 |
| 요청자가 관리자가 아님 | `403`, `권한이 없습니다.` |
| 대상 유저가 타 회사/없음 | `403`, `찾을 수 없습니다.` |
| 이미 관리자 | `403`, `already exist admin.` |

---

## 2. POST `/api/v1/management/company-setting` — 회사 게시판 설정 생성

회사(`company_id`)의 게시판 전역 설정(`company_settings`)을 최초 1회 생성하고, 회사 전체 유저의 개인 설정(`company_user_settings`)을 함께 초기화합니다.

### Path 파라미터
없음

### Query 파라미터
없음

### Request Body
없음 (검증 없음). 전송 값은 무시되며, 기본값으로 생성됩니다.

### 인증 / 권한
- 현재 유저가 office 관리자여야 함(`isAdminUser(user->company_id)`). 아니면 `403 no_permission`.

### 처리
1. 회사에 이미 `company_settings` 가 있으면 예외 → **트랜잭션 catch 로 `500`** (message = `already exist company setting.`).
2. `company_settings` 1행 생성(모든 컬럼 DB 기본값).
3. 회사 소속 전체 유저 수만큼 `company_user_settings` 를 bulk 생성.

### Response (200)
생성된 `company_settings` 모델 반환. (연결된 user settings 는 응답에 포함되지 않음)

```json
{
  "company_id": 45,
  "id": "uuid",
  "is_post_alarm": true,
  "is_comment_alarm": true,
  "latest_post_day": 30,
  "latest_post_type": "BOARD",
  "latest_post_description": "",
  "post_badge_type": [{"type":"NOTICE","en":"Notice","ko":"공지","ja":"お知らせ","background_color":"#E8EFFF","text_color":"#3362FF"}],
  "created_at": "...",
  "updated_at": "..."
}
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `is_post_alarm` | bool | true | 게시글 알림 |
| `is_comment_alarm` | bool | true | 댓글 알림 |
| `latest_post_day` | int | 30 | 최신글 노출일 |
| `latest_post_type` | text | `BOARD` | 최신글 게시판 타입 |
| `latest_post_description` | text | `''` | 최신글 설명 |
| `post_badge_type` | jsonb | 공지 뱃지 1개 | 뱃지 종류 |

### 주의사항
- ⚠️ **이미 설정이 존재하면 `409`가 아니라 `500`** 을 반환합니다(예외를 try 안에서 던지고 catch 에서 SERVER_ERROR 처리). 프론트는 500 + 특정 message 로 "이미 존재" 를 구분해야 합니다.
- 회사 유저가 많으면 유저 수만큼 insert 가 발생합니다(트랜잭션).

### 시나리오

| 상황 | 결과 |
|------|------|
| 정상(관리자, 설정 미존재) | `200`, company_settings |
| 관리자 아님 | `403`, `권한이 없습니다.` |
| 이미 설정 존재 | `500`, `already exist company setting.` |

---

## 3. POST `/api/v1/management/company-setting/{companySetting}` — 회사 설정 수정 + 메인 게시판 편집

회사 게시판 설정을 수정하고, 메인 화면 게시판 구성(`company_main_boards`)을 추가/수정/삭제합니다.

### Path 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `companySetting` | UUID | `company_settings.id` (route model binding). 없으면 `404` |

### Query 파라미터
없음

### Request Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `is_post_alarm` | bool | X | 게시글 알림 |
| `is_comment_alarm` | bool | X | 댓글 알림 |
| `latest_post_day` | int | X | 최신글 노출일 |
| `latest_post_type` | string | X | 최신글 게시판 타입 |
| `latest_post_description` | string | X | 최신글 설명 |
| `post_badge_type` | jsonb | X | 뱃지 종류 |
| `delete_company_main_board_id` | array(UUID) | X | 삭제할 메인 게시판 id 배열 |
| `edit_company_main_board` | **JSON string** | X | 추가/수정할 메인 게시판 목록(아래 참고) |

- 검증 규칙: `delete_company_main_board_id => 'array'`
- ⚠️ `edit_company_main_board` 은 **JSON 으로 인코딩된 문자열**입니다(`json_decode` 로 파싱). 네이티브 배열이 아니라 문자열로 보내야 합니다. 반면 `delete_company_main_board_id` 는 일반 배열입니다.

`edit_company_main_board` 각 요소 구조

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | UUID/null | 있으면 수정, `null`/falsy 면 신규 |
| `board_type` | string | `NEW` / `PUBLIC` / `NOTICE` / `CUSTOM` |
| `type` | string | `BOARD` / `PREVIEW` / `ALBUM` / `DRIVE` |
| `position` | int/string | 순서 |
| `board_id` | UUID | `board_type === 'CUSTOM'` 일 때만 저장, 그 외 `null` 로 강제 |

### 인증 / 권한
- 현재 유저 `company_id` 가 `companySetting->company_id` 와 **일치**하고, 동시에 office 관리자여야 함. 아니면 `403 no_permission`.

### Response (200)
수정된 `company_settings` 모델 + `companyMainBoards` 관계(position asc) 포함.

```json
{
  "id": "uuid",
  "company_id": 45,
  "is_post_alarm": true,
  "...": "...",
  "company_main_boards": [
    { "id": "uuid", "company_setting_id": "uuid", "company_id": 45,
      "board_type": "NOTICE", "type": "BOARD", "board_id": null, "position": "0" }
  ]
}
```

### 주의사항
- 본문 스칼라 필드는 `fill()` 로 채워지므로 `CompanySetting` 의 `fillable` 만 반영됩니다.
- `edit_company_main_board` 는 JSON 문자열 파싱 실패 시 예외 → `500`.
- 수정 대상 `id` 가 실제 존재하지 않으면 `CompanyMainBoard::find()` 가 null → 속성 접근에서 예외 → `500`.

### 시나리오

| 상황 | 결과 |
|------|------|
| 정상 | `200`, company_settings + company_main_boards |
| `{companySetting}` 미존재 | `404` |
| 회사 불일치 또는 관리자 아님 | `403`, `권한이 없습니다.` |
| `edit_company_main_board` 형식 오류 | `500` |

---

## 4. PUT `/api/v1/management/user-setting/search-keyword` — 최근 검색어 저장

현재 유저의 최근 검색어(`company_user_settings.recent_search_keyword`)를 갱신합니다.

### Path 파라미터
없음

### Query 파라미터
없음

### Request Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `recent_search_keyword` | array(string) | X | 최근 검색어 목록. 미전송 시 빈 배열 `[]` 로 저장(초기화) |

- 검증 규칙: `recent_search_keyword => 'array'`

### 인증 / 권한
- `auth:api` 만 필요. 관리자 권한 불필요(본인 설정 갱신).

### 처리
- `company_user_settings` 에서 (현재 유저 `company_id`, `user_id`) 행을 `firstOrFail` 로 조회 → 없으면 `404`.
- `recent_search_keyword` 를 통째로 덮어씀. 저장 시 Postgres 배열 리터럴(`{a,b,c}`) 로 변환, 조회 시 배열로 파싱.

### Response (200)
갱신된 `company_user_settings` 모델. `recent_search_keyword` 는 배열로 반환.

### 주의사항
- ⚠️ 해당 유저의 `company_user_settings` 행이 없으면 `404`. (회사 설정이 2번 API 로 초기화되어 있어야 행이 존재)
- ⚠️ 모델에 `$RECENT_SEARCH_KEYWORD_LIMIT = 8` 상수가 있으나 **이 메서드에서 개수 제한을 적용하지 않습니다.** 보낸 만큼 그대로 저장되므로 개수 제한이 필요하면 클라이언트에서 잘라 보내야 합니다.
- 전달 배열을 append 가 아니라 **전체 교체**합니다.

### 시나리오

| 상황 | 결과 |
|------|------|
| 정상 | `200`, company_user_settings |
| 유저 설정 행 없음 | `404` |
| `recent_search_keyword` 가 배열 아님 | `400` |

---

## 5. POST `/api/v1/management/user-setting/{companySetting}` — 개인 알림 설정 수정

현재 유저 본인의 개인 알림 설정(`company_user_settings`)을 수정합니다. 없으면 생성합니다.

### Path 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `companySetting` | UUID | `company_settings.id` (route model binding). `company_id`/연결용으로 사용. 없으면 `404` |

### Query 파라미터
없음

### Request Body (검증 없음, `fillable` 만 반영)

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `is_post_alarm` | bool | true | 게시글 알림 |
| `is_notice_alarm` | bool | true | 공지 알림 |
| `is_public_post_alarm` | bool | true | 공용 게시판 게시글 알림 |
| `is_comment_alarm` | bool | true | 댓글 알림 |
| `is_like_alarm` | bool | true | 좋아요 알림 |

### 인증 / 권한
- `auth:api` 만 필요. **관리자 권한 불필요** — 항상 "요청자 본인(user->id)" 의 설정만 다룹니다.

### 처리
- (`companySetting->company_id`, 현재 `user->id`) 로 `company_user_settings` 조회.
- 없으면 새로 생성(`company_id`, `user_id` 세팅).
- 본문을 `fill()` 후 `companySetting` 관계로 저장(`company_setting_id` 연결).

### Response (200)
갱신/생성된 `company_user_settings` 모델.

### 주의사항
- Path 의 `{companySetting}` 은 회사 스코프/연결용일 뿐, **다른 사람의 설정을 바꿀 수는 없습니다**(항상 본인).
- 3번(회사 설정 수정)과 URL prefix 가 비슷하지만 여기(user-setting)는 **관리자 체크가 전혀 없습니다.** 혼동 주의.

### 시나리오

| 상황 | 결과 |
|------|------|
| 정상(설정 존재) | `200`, 갱신된 설정 |
| 정상(설정 없음) | `200`, 신규 생성된 설정 |
| `{companySetting}` 미존재 | `404` |

---

## 6. POST `/api/v1/management/category/edit` — 카테고리/게시판 일괄 편집(최대 2depth)

카테고리·게시판을 한 번에 삭제하고 순서를 갱신합니다. (주석상 "2depth 까지 한번에 수정")

### Path 파라미터
없음

### Query 파라미터
없음

### Request Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `delete_category_id` | array(UUID) | X | 삭제할 카테고리 id (하위 트리 포함 삭제) |
| `delete_board_id` | array(UUID) | X | 삭제할 게시판 id |
| `update_category_position` | object `{categoryId: position}` | X | 카테고리 순서 맵 |
| `update_board_position` | object `{boardId: position}` | X | 게시판 순서 맵 |

- 검증: 위 4개 모두 `'array'`.
- ⚠️ `update_category_position` / `update_board_position` 은 **id 를 key, position(int) 을 value 로 하는 맵(object)** 입니다. (배열 아님)

### 인증 / 권한
- office 관리자면 전체 회사 범위로 처리.
- 관리자가 아니면 본인이 **카테고리 관리자(`category_admins`)** 인 카테고리(및 하위 트리)와 그 하위 게시판으로만 범위가 제한됩니다.
  - 카테고리 관리자 카테고리가 하나도 없으면 `403 no_permission`.
  - 삭제/순서변경 대상은 `array_intersect` 로 본인 권한 범위와 교집합만 반영.

### 처리(트랜잭션)
1. `delete_category_id`: 하위 카테고리 트리까지 삭제 → 그 안의 게시판/게시글/썸네일/첨부/드라이브 폴더/드라이브 파일 삭제 + S3 삭제 Job dispatch.
2. `delete_board_id`: 게시판 및 관련 게시글/파일/드라이브/ S3 삭제.
3. `update_category_position`: 맵대로 `position` 갱신.
4. `update_board_position`: 맵대로 `position` 갱신.

### Response (200)
⚠️ **`true` (boolean)** 만 반환합니다. 갱신/삭제된 엔티티는 반환하지 않으므로, 프론트는 성공 후 목록을 재조회해야 합니다.

### 주의사항
- ⚠️ **파괴적 작업**: 카테고리/게시판 삭제 시 게시글·첨부·썸네일·드라이브 파일이 함께 삭제되고 S3 파일 삭제 Job 이 큐잉됩니다. 되돌릴 수 없습니다.
- 삭제·순서변경이 한 트랜잭션에서 처리됩니다. 중간 예외 시 전체 롤백 + `500`.
- 10개 엔드포인트 중 유일하게 카테고리 관리자(비 office 관리자)도 호출 가능.

### 시나리오

| 상황 | 결과 |
|------|------|
| 관리자 정상 | `200`, `true` |
| 카테고리 관리자(본인 범위) 정상 | `200`, `true` (본인 범위만 반영) |
| 비관리자 + 카테고리 관리자도 아님 | `403`, `권한이 없습니다.` |
| 본문 필드가 배열 아님 | `400` |
| 처리 중 예외 | `500` (롤백) |

---

## 7. POST `/api/v1/management/category` — 최상위(1depth) 카테고리 순서 변경

`depth = 1` 인 최상위 카테고리들의 순서를 변경합니다.

### Path 파라미터
없음

### Query 파라미터
없음

### Request Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `categories` | object `{categoryId: position}` | O | 카테고리 id → position(int) 맵 |

- 검증: `categories => 'required|array'`.

### 인증 / 권한
- office 관리자만(`isAdminUser`). 아니면 `403 no_permission`.

### 처리
- 회사의 `depth = 1` 카테고리 전체를 조회 → 맵에 있는 id 만 `position` 갱신.

### Response (200)
회사의 `depth=1` 카테고리 컬렉션(갱신 후 값 반영).

### 주의사항
- **1depth(최상위) 카테고리에만** 적용됩니다. 하위 카테고리 순서는 8번을 사용.
- 맵에 없는 카테고리는 변경되지 않습니다.

### 시나리오

| 상황 | 결과 |
|------|------|
| 관리자 정상 | `200`, categories |
| `categories` 누락 | `400` |
| 관리자 아님 | `403` |

---

## 8. POST `/api/v1/management/category/{category}` — 하위 카테고리 순서 변경

특정 카테고리의 **직속 하위 카테고리** 순서를 변경합니다.

### Path 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `category` | UUID | `category.categories.id` (부모 카테고리, route model binding). 없으면 `404` |

### Query 파라미터
없음

### Request Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `categories` | object `{categoryId: position}` | O | 하위 카테고리 id → position 맵 |

- 검증: `categories => 'required|array'`.

### 인증 / 권한
- office 관리자만. 아니면 `403 no_permission`.

### 처리
- `$category->childCategoriesForAdmin` (직속 하위 카테고리, position asc, 하위 트리+게시판 eager load) 을 대상으로 맵의 id 순서 갱신.

### Response (200)
`childCategoriesForAdmin` 컬렉션(중첩 트리 + boards 포함).

### 주의사항
- ⚠️ 소스에 오타(`$saveCategory->positon`)가 있어 "변경 여부 비교" 가 항상 참이 됩니다. 결과적으로 대상 카테고리는 매번 저장되지만 position 값 자체는 정상 반영됩니다(기능상 문제 없음, 불필요한 write 발생).
- 대상은 `{category}` 의 **직속 자식**입니다.

### 시나리오

| 상황 | 결과 |
|------|------|
| 관리자 정상 | `200`, 하위 카테고리 트리 |
| `{category}` 미존재 | `404` |
| `categories` 누락 | `400` |
| 관리자 아님 | `403` |

---

## 9. POST `/api/v1/management/board` — 공용 게시판 순서 변경

회사의 공용 게시판(`is_public = true`, 카테고리 미소속) 순서를 변경합니다.

### Path 파라미터
없음

### Query 파라미터
없음

### Request Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `boards` | object `{boardId: position}` | O | 게시판 id → position(int) 맵 |

- 검증: `boards => 'required|array'`.

### 인증 / 권한
- office 관리자만. 아니면 `403 no_permission`.

### 처리
- (`company_id`, `is_public = true`) 게시판 전체 조회 → 맵의 id 만 `position` 갱신.

### Response (200)
공용 게시판 컬렉션(갱신 후).

### 주의사항
- 공용 게시판(`is_public = true`) 만 대상입니다. 카테고리 소속 게시판은 10번을 사용.

### 시나리오

| 상황 | 결과 |
|------|------|
| 관리자 정상 | `200`, boards |
| `boards` 누락 | `400` |
| 관리자 아님 | `403` |

---

## 10. POST `/api/v1/management/board/{category}` — 카테고리 내 게시판 순서 변경

특정 카테고리에 속한 게시판들의 순서를 변경합니다.

### Path 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `category` | UUID | `category.categories.id` (route model binding). 없으면 `404` |

> ⚠️ Path 파라미터가 board id 가 아니라 **category id** 입니다.

### Query 파라미터
없음

### Request Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `boards` | object `{boardId: position}` | O | 게시판 id → position(int) 맵 |

- 검증: `boards => 'required|array'`.

### 인증 / 권한
- office 관리자만. 아니면 `403 no_permission`.

### 처리
- `$category->boards` (해당 카테고리 소속 게시판, position asc) 대상으로 맵의 id 순서 갱신.

### Response (200)
해당 카테고리의 게시판 컬렉션(갱신 후).

### 주의사항
- 대상은 `{category}` 에 직접 속한 게시판입니다.
- 맵에 없는 게시판은 변경되지 않습니다.

### 시나리오

| 상황 | 결과 |
|------|------|
| 관리자 정상 | `200`, boards |
| `{category}` 미존재 | `404` |
| `boards` 누락 | `400` |
| 관리자 아님 | `403` |

---

## 부록: position 변경 요청 예시

7~10번 순서 변경 API 는 모두 **`{id: position}` 맵** 형태를 사용합니다.

```http
POST /api/v1/management/category
Authorization: Bearer <token>
Content-Type: application/json

{
  "categories": {
    "3f2a...-uuid-A": 1,
    "9b7c...-uuid-B": 2,
    "c1d4...-uuid-C": 3
  }
}
```

6번(`/category/edit`)의 순서 필드도 동일한 맵 형태이며, 삭제 필드만 배열입니다.

```json
{
  "delete_category_id": ["uuid1", "uuid2"],
  "delete_board_id": ["uuid3"],
  "update_category_position": { "uuidA": 1, "uuidB": 2 },
  "update_board_position": { "uuidC": 1 }
}
```
