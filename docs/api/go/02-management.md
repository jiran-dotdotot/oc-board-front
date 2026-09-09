# 02. 관리 — 회사·사용자 설정, 관리자, 정렬

등록 엔드포인트 **6개**. 회사 관리 5개는 member 계약, category-tree 1개는 board 계약이다. 경로 등록: `internal/transport/httpapi/management/handler.go:48`, `internal/transport/httpapi/board/routes.go:383`; prefix: `internal/transport/httpapi/router.go:114`, `internal/transport/httpapi/router.go:122`.

## 공통 사항

응답 DTO·에러 봉투에는 [Huma 자동 특수필드](README.md#schema-field)를 함께 적용한다. 등록된 최상위 struct 응답에만 `$schema:string`(null 불가, 계산된 URL)와 `Link`가 추가되며 배열·map·빈Body·gin 직접응답에는 없다. 아래 업무 필드 표에 반복하지 않는다. 입력의 추가 키 불허도 framework의 readonly `$schema` 특수키는 예외다. [Huma transforms.go:157](https://github.com/danielgtaylor/huma/blob/v2.39.0/transforms.go#L157)

이 파일의 공통 오류표에406이 열거되어도 현재 router의 기본 format fallback에서는 미지원 Accept가 JSON으로 처리되어 일반적인406 분기가 생기지 않는다. Content-Type 누락·빈값은 JSON 기본이다. [Huma api.go:355](https://github.com/danielgtaylor/huma/blob/v2.39.0/api.go#L355), [defaults.go:79](https://github.com/danielgtaylor/huma/blob/v2.39.0/defaults.go#L79)

`Authorization: Bearer $MEMBER_TOKEN` 필수(OfficeWave member 계약). member 토큰 검증(401) → 회사 경로 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정. board 토큰을 이 경로에 재사용하지 않는다. `internal/transport/httpapi/router.go:440` `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/humaerr/humaerr.go:106`

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

`Authorization` 헤더 이름은 HTTP의 대소문자 비구분 규칙을 따르며 스킴은 대소문자를 구분하지 않는 `Bearer` 뒤 **공백** 구분자다. 토큰이 없거나 다른 계약 토큰이면 401이다. `Lang`, `Time_zone` 등 전역 규약은 [README](README.md)를 따른다. `internal/transport/httpapi/middleware/auth.go:150`

성공은 각 표의 **직접 객체**이며 `data` 봉투는 없다. 정렬만 `{reordered:{categories,boards}}`이다. 오류는 `{"error":{"code":"…","message":"…","details":…}}`; details는 생략될 수 있다. 날짜는 UTC `YYYY-MM-DDTHH:mm:ss.ffffffZ` 문자열(예: `2026-09-08T06:00:00.000000Z`), 수치 ID는 JSON number(int64)이므로 프론트에서 정밀도 손실에 유의한다. `internal/transport/httpapi/management/setting.go:28`, `internal/transport/httpapi/management/usersetting.go:39`, `internal/transport/httpapi/board/reorder.go:161`, `internal/transport/httpapi/humaerr/humaerr.go:18`

`legacy.Bool`: JSON `true`, `false`, `0`, `1`, 문자열 `"0"`, `"1"`, `"true"`, `"false"`, `null`만 통과한다. `"True"`, `"FALSE"`, `"yes"`, `2`, 공백이 붙은 문자열은 `400 INVALID_PAYLOAD`. optional 포인터의 null은 생략처럼 처리한다. `internal/transport/httpapi/legacy/bool.go:110`

| status | error.code | 발생 조건 |
| --- | --- | --- |
| 400 | `INVALID_PAYLOAD` | JSON/타입/UUID/범위/엄격 body 추가 키 검증 실패 |
| 401 | `UNAUTHORIZED` | 인증 실패 |
| 403 | `FORBIDDEN` | 경로 스코프 또는 관리자 권한 실패 |
| 403 | `USER_NOT_IN_COMPANY` | 관리자 추가 대상이 해당 회사에 없음 |
| 403 | `ALREADY_EXIST_ADMIN` | 이미 살아 있는 관리자 |
| 404 | `NOT_FOUND` | 필요한 회사/사용자 설정 또는 편집할 위젯 없음 |
| 500 | `ALREADY_EXIST_COMPANY_SETTING` | 회사 설정 중복 생성 |
| 500 | `INTERNAL_ERROR` | DB 오류·제약 위반 |
| 503 | `SERVICE_UNAVAILABLE` | deadline/cancel |

근거: `internal/transport/httpapi/management/setting.go:134`, `internal/transport/httpapi/management/setting.go:246`, `internal/transport/httpapi/management/usersetting.go:69`, `internal/transport/httpapi/humaerr/humaerr.go:42`, `internal/transport/httpapi/humaerr/humaerr.go:188`. 본문 전송 크기·콘텐츠 타입 등 전역 HTTP 오류는 [README](README.md)도 적용된다.

curl 준비: 실행 환경의 실제 토큰과 ID를 지정한다. `MEMBER_TOKEN`과 `BOARD_TOKEN`은 서로 다른 토큰이다. 이후 예시는 아래 변수들을 사용한다.

```bash
BASE_URL=${BASE_URL:-http://localhost:8080}
: "${COMPANY_ID:?회사 ID}" "${USER_ID:?사용자 ID}" "${MEMBER_TOKEN:?member 토큰}" "${BOARD_TOKEN:?board 토큰}"
MANAGEMENT="$BASE_URL/api/v1/companies/$COMPANY_ID"
SCOPE="$BASE_URL/api/v1/board/companies/$COMPANY_ID/users/$USER_ID"
```


위3개 관리 전용 code는 번역 카탈로그에 없어 영문 literal을 유지한다: USER_NOT_IN_COMPANY=`User not found in this company.`, ALREADY_EXIST_ADMIN=`User is already an administrator.`, ALREADY_EXIST_COMPANY_SETTING=`Company setting already exists.` `internal/transport/httpapi/management/setting.go:147`, `internal/transport/httpapi/management/setting.go:150`, `internal/transport/httpapi/management/setting.go:255`

수동 관리자(is_manager=false)는 최고관리자가 아닐 때 동기화에서 유지된다. 다만 OfficeWave 최고관리자가 되면 is_manager=true로 소유권을 가져가므로, 이후 최고관리자 해제 시 회수된다. [인증의 관리자 동기화 상태표](01-auth-user.md#admin-sync)를 따른다. `internal/domain/board/adminsync.go:85`, `internal/domain/board/adminsync.go:98`

## 공유 DTO 필드 표

<a id="company-setting"></a>
### CompanySetting

모든 필드는 기본 포함되며 별도 include 쿼리는 없다. 기본값은 신규 생성 기준이다. 저장 타입·제약은 `migrations/board/000001_initial_schema.sql:898`, `migrations/board/000002_management_compat.sql:9`; 직렬화는 `internal/transport/httpapi/management/setting.go:166`, `internal/transport/httpapi/management/setting.go:225`.

| 필드 | 타입 | null | 출처 | 값/포맷 |
| --- | --- | --- | --- | --- |
| id | string(UUID) | 아니오 | 저장 | 생성 UUID |
| company_id | number(int64) | 아니오 | 저장 | 토큰 회사 |
| is_post_alarm | boolean | 아니오 | 저장 | true |
| is_comment_alarm | boolean | 아니오 | 저장 | true |
| latest_post_day | number(integer) | 아니오 | 저장 | 30; DB >0/int32 |
| latest_post_type | string | 아니오 | 저장 | BOARD; DB BOARD/PREVIEW/ALBUM/DRIVE |
| latest_post_description | string | 예 | 저장 | 신규 "" |
| post_badge_type | string | 아니오 | 저장 jsonb의 JSON 문자열화 | 배열 자체가 아님 |
| created_at | string | 아니오 | 저장 | UTC 6자리 소수초 |
| updated_at | string | 아니오 | 저장 | UTC 6자리 소수초 |
| deleted_at | string | 예 | 저장 | UTC; 살아 있는 행 null |
| company_main_boards | Widget[] | 아니오 | 기본 로드 관계 | position,id 오름차순; 없으면 [] |
| company_main_board | Widget[] | 아니오 | 계산 별칭 | company_main_boards와 같은 배열 |

`post_badge_type` 신규 기본값은 문자열로 인코딩된 `[{"type":"NOTICE","ko":"공지","en":"Notice","ja":"お知らせ","background_color":"#E8EFFF","text_color":"#3362FF"}]`이다. `migrations/board/000002_management_compat.sql:14`

<a id="widget"></a>
### Widget

| 필드 | 타입 | null | 저장/계산 및 포맷 |
| --- | --- | --- | --- |
| id | string(UUID) | 아니오 | 저장 |
| company_setting_id | string(UUID) | 아니오 | 저장 |
| company_id | number(int64) | 아니오 | 계산: 부모 설정의 회사 |
| is_drive | string | 아니오 | 계산: 항상 문자열 "false" |
| board_type | string | 아니오 | 저장; HTTP/DB enum 없음 |
| type | string | 아니오 | 저장; HTTP/DB enum 없음 |
| position | number(integer) | 아니오 | 저장 int32; 음수도 DB 허용 |
| board_id | string(UUID) | 예 | 저장; 실제 게시판 관계는 로드하지 않음 |
| created_at | string | 아니오 | 저장 UTC |
| updated_at | string | 아니오 | 저장 UTC |
| deleted_at | string | 예 | 저장 UTC |

근거: `internal/transport/httpapi/management/setting.go:195`, `internal/transport/httpapi/management/setting.go:211`, `migrations/board/000002_management_compat.sql:19`.

<a id="user-setting"></a>
### UserSetting

| 필드 | 타입 | null | 저장/계산 및 기본값 |
| --- | --- | --- | --- |
| company_id | number(int64) | 아니오 | 저장 |
| user_id | number(int64) | 아니오 | 저장; 호출자 |
| is_post_alarm | boolean | 아니오 | 저장; true |
| is_notice_alarm | boolean | 아니오 | 저장; true |
| is_public_post_alarm | boolean | 아니오 | 저장; true |
| is_comment_alarm | boolean | 아니오 | 저장; true |
| is_like_alarm | boolean | 아니오 | 저장; true |
| recent_search_keyword | string[] | 아니오 | 저장 후 &quot;→" 변환; 신규 [] |
| created_at | string | 아니오 | 저장 UTC |
| updated_at | string | 아니오 | 저장 UTC |
| deleted_at | string | 예 | 저장 UTC; 응답 live 행 null |

관계 eager load 없음. `id`, `company_setting_id`, `is_upload_alarm` 필드는 없다. 근거: `internal/transport/httpapi/management/usersetting.go:39`, `internal/domain/board/usersetting.go:46`, `migrations/board/000001_initial_schema.sql:921`.

## ⚠️ 이 도메인의 함정

- 경로 계약이 섞여 있다. 회사 설정은 member 토큰, 정렬은 board 토큰으로 호출한다. `internal/transport/httpapi/router.go:440`
- 최근검색어 누락/null은 no-op이 아니라 전체 삭제, 9개 이상은 오류가 아니라 앞 8개만 저장이다. `internal/domain/board/management.go:316`
- 회사 설정 PATCH의 `edit_company_main_board`는 **배열을 JSON 인코딩한 문자열**, `post_badge_type` 응답도 **문자열**이다. `internal/transport/httpapi/management/setting.go:166`, `internal/transport/httpapi/management/setting.go:263`
- 회사 설정 `latest_post_day`, `latest_post_type`은 HTTP enum/양수 검증 없이 DB에 간다. DB 위반은 500이다. `internal/transport/httpapi/management/setting.go:263`, `migrations/board/000001_initial_schema.sql:903`
- 정렬에는 삭제도 포함된다. 권한 밖/없는 ID는 조용히 무시되므로 200의 숫자를 요청 개수나 삭제 개수로 해석하지 않는다. `internal/domain/board/reorder.go:277`, `internal/domain/board/reorder.go:409`


## POST /api/v1/companies/{company_id}/admins

### 1. 경로

OperationID: `create-company-admin`. [`internal/transport/httpapi/management/handler.go:50`](../../internal/transport/httpapi/management/handler.go#L50)

전체 URL은 제목과 같다. `internal/transport/httpapi/management/handler.go:49`

### 2. Path

`company_id`: int64 회사 ID. 토큰 클레임의 정규 10진 문자열과 완전히 같아야 한다. 누락은 다른 경로이고, `001`/`+1`/잘못된 문자열/타 회사는 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음.

### 4. Body

| 필드 | 타입/필수 | 기본값 | 상한·검증 |
| --- | --- | --- | --- |
| user_id | integer 또는 10진 정수 문자열 / 필수 | 없음 | int64 범위; 양수 검증 없음; 숫자 1.5/"+1"/" 1"/boolean 불허400 |

추가 키는 허용하고 무시한다. 문자열은 `^-?\d+$`와 int64 파싱을 모두 통과해야 한다. `internal/transport/httpapi/management/setting.go:59` `internal/transport/httpapi/management/setting.go:105`

### 5. 인증·권한

`Authorization: Bearer $MEMBER_TOKEN` 필수(OfficeWave member 계약). member 토큰 검증(401) → 회사 경로 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정. board 토큰을 이 경로에 재사용하지 않는다. `internal/transport/httpapi/router.go:440` `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/humaerr/humaerr.go:106`

회사 관리자 검사(403) → 추가 대상 회사 소속 조회(403 USER_NOT_IN_COMPANY) → 기존 live 관리자 검사(403 ALREADY_EXIST_ADMIN) → 저장. 권한 없는 일반 회원은 대상 사용자 존재 여부를 이 API로 알 수 없다. `internal/transport/httpapi/management/handler.go:72` `internal/domain/board/management.go:22`

### 6. Response

200: 직접 객체. `internal/transport/httpapi/management/setting.go:155`

| 필드 | 타입 | null | 저장/계산·포맷 |
| --- | --- | --- | --- |
| company_id | number(int64) | 아니오 | 입력/저장 회사 |
| user_id | number(int64) | 아니오 | 입력/저장 사용자 |
| is_manager | boolean | 아니오 | false; 수동 관리자 |
| created_at | string | 아니오 | 계산: 이번 요청 now, UTC 6자리 소수초 |
| updated_at | string | 아니오 | 계산: 이번 요청 now, UTC 6자리 소수초 |

관계 없음. 403 `USER_NOT_IN_COMPANY`/`ALREADY_EXIST_ADMIN` 및 공통 오류. `internal/transport/httpapi/management/setting.go:146` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

이미 삭제된 관리자 행은 복원하고 is_manager=false로 변경한다. public.users는 회사/ID만 검사하므로 퇴사·비활성 사용자도 후보가 된다. 복원 시 DB created_at은 보존되지만 응답 created_at은 현재 시각이다. 생성 경쟁으로 UNIQUE 위반이 나면 500일 수 있다. `internal/domain/board/management.go:22` `internal/transport/httpapi/management/setting.go:139`

### 8. 시나리오

```bash
# 정상: 해당 회사의 아직 관리자가 아닌 실제 사용자 ID
: "${TARGET_USER_ID:?추가할 사용자 ID}"
curl -i -X POST "$MANAGEMENT/admins" -H "Authorization: Bearer $MEMBER_TOKEN" -H "Content-Type: application/json" --data "{\"user_id\":$TARGET_USER_ID}"
# 동일 대상 재호출: 403 ALREADY_EXIST_ADMIN
curl -i -X POST "$MANAGEMENT/admins" -H "Authorization: Bearer $MEMBER_TOKEN" -H "Content-Type: application/json" --data "{\"user_id\":$TARGET_USER_ID}"
```


## POST /api/v1/companies/{company_id}/settings

### 1. 경로

OperationID: `create-company-setting`. [`internal/transport/httpapi/management/handler.go:51`](../../internal/transport/httpapi/management/handler.go#L51)

전체 URL은 제목과 같다. `internal/transport/httpapi/management/handler.go:50`

### 2. Path

`company_id`: int64 회사 ID. 토큰 클레임의 정규 10진 문자열과 완전히 같아야 한다. 누락은 다른 경로이고, `001`/`+1`/잘못된 문자열/타 회사는 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음.

### 4. Body

없음. 요청 body 필드/필수/기본값/상한/추가 키 계약 없음. `internal/transport/httpapi/management/setting.go:246`

### 5. 인증·권한

`Authorization: Bearer $MEMBER_TOKEN` 필수(OfficeWave member 계약). member 토큰 검증(401) → 회사 경로 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정. board 토큰을 이 경로에 재사용하지 않는다. `internal/transport/httpapi/router.go:440` `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/humaerr/humaerr.go:106`

회사 관리자 검사(403) → live 설정 중복 검사(500 ALREADY_EXIST_COMPANY_SETTING) → 설정/사용자 설정 생성. 일반 회원은 기존 설정 존재 여부를 확인하기 전에 차단된다. `internal/transport/httpapi/management/setting.go:246` `internal/domain/board/management.go:65`

### 6. Response

200: [CompanySetting](#company-setting), 두 위젯 배열 모두 `[]`. 500 `ALREADY_EXIST_COMPANY_SETTING`; 그 외 공통 오류. `internal/transport/httpapi/management/setting.go:246` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

회사별 UNIQUE는 deleted_at IS NULL인 행만 대상으로 한다. 설정행이 soft-delete된 뒤에는 새 UUID로 재생성할 수 있다. `migrations/board/000001_initial_schema.sql:914`

설정과 해당 회사 모든 public.users의 기본 UserSetting을 같은 트랜잭션에서 생성한다. 사용자 soft-delete 필터가 없고 기존 사용자 설정은 ON CONFLICT DO NOTHING으로 보존한다. 재호출은 멱등 성공이 아니다. `internal/domain/board/management.go:65`

### 8. 시나리오

```bash
# 정상: 아직 회사 설정이 없는 회사의 관리자
curl -i -X POST "$MANAGEMENT/settings" -H "Authorization: Bearer $MEMBER_TOKEN"
# 이미 생성된 뒤 동일 호출: 500 ALREADY_EXIST_COMPANY_SETTING
curl -i -X POST "$MANAGEMENT/settings" -H "Authorization: Bearer $MEMBER_TOKEN"
```


## PATCH /api/v1/companies/{company_id}/settings

### 1. 경로

OperationID: `update-company-setting`. [`internal/transport/httpapi/management/handler.go:52`](../../internal/transport/httpapi/management/handler.go#L52)

전체 URL은 제목과 같다. `internal/transport/httpapi/management/handler.go:51`

### 2. Path

`company_id`: int64 회사 ID. 토큰 클레임의 정규 10진 문자열과 완전히 같아야 한다. 누락은 다른 경로이고, `001`/`+1`/잘못된 문자열/타 회사는 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음.

### 4. Body

| 필드 | 타입/필수 | 생략/null 기본 동작 | 상한·허용값 |
| --- | --- | --- | --- |
| is_post_alarm | legacy.Bool / 선택 | 유지 | 공통 Bool; 길이 해당 없음 |
| is_comment_alarm | legacy.Bool / 선택 | 유지 | 공통 Bool |
| latest_post_day | integer 또는 정수문자열 / 선택 | 유지 | HTTP int64, 양수·상한 태그 없음; DB int32 및 >0 |
| latest_post_type | string / 선택 | 유지 | HTTP enum·길이 상한 없음; DB BOARD/PREVIEW/ALBUM/DRIVE |
| latest_post_description | string / 선택 | 유지; ""는 비움 | 길이 상한 없음 |
| post_badge_type | 임의 JSON / 선택 | 생략 유지; null은 JSON null 저장 | shape/길이/개수 상한 없음 |
| delete_company_main_board_id | UUID[] / 선택 | 삭제 없음 | JSON 배열; 개수 상한 없음 |
| edit_company_main_board | string / 선택 | 생략/null 유지 | JSON 배열을 인코딩한 문자열; 길이·개수 상한 없음 |

추가 body 키는 허용하고 무시한다. `internal/transport/httpapi/management/setting.go:263`

문자열 내부 위젯 배열 원소의 필드(추가 키 무시):

| 필드 | 타입/필수 | 기본값 | 검증/상한 |
| --- | --- | --- | --- |
| id | UUID string 또는 0/"0"/""/false/null / 선택 | 생략은 신규 | UUID면 기존 위젯 편집; 그 외 명시한 값은 신규; true/다른 숫자/잘못된 UUID400 |
| board_type | string / 선택 | "" | 길이/enum 상한 없음 |
| type | string / 선택 | "" | 길이/enum 상한 없음 |
| position | integer / 선택 | 0 | Go int 파싱, DB int32; 양수 검증 없음 |
| board_id | UUID string/null / 선택 | null | board_type이 CUSTOM일 때만 적용; 대상 존재·회사 검사 없음 |

`edit_company_main_board:"null"`은 편집 없음, `"{}"`은 400이다. JSON 배열 자체를 전송하면 string 타입 검증400. `internal/transport/httpapi/management/setting.go:297` `internal/transport/httpapi/management/setting.go:345` `internal/domain/board/management.go:254`

### 5. 인증·권한

`Authorization: Bearer $MEMBER_TOKEN` 필수(OfficeWave member 계약). member 토큰 검증(401) → 회사 경로 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정. board 토큰을 이 경로에 재사용하지 않는다. `internal/transport/httpapi/router.go:440` `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/humaerr/humaerr.go:106`

회사 관리자 검사(403) → 내부 위젯 JSON/ID 파싱(400) → live 회사 설정 조회(404) → 트랜잭션에서 설정 갱신·위젯 삭제·편집(편집 대상 부재404). 권한 없는 회원에게 회사 설정/위젯 존재는 노출하지 않는다. `internal/transport/httpapi/management/setting.go:279` `internal/domain/board/management.go:210`

### 6. Response

200: [CompanySetting](#company-setting), live 위젯 두 별칭 배열 기본 로드. 404 `NOT_FOUND`: 설정 부재 또는 편집 UUID가 해당 설정의 live 위젯이 아님(전체 롤백). DB 검증은 500 `INTERNAL_ERROR`, 나머지 공통 오류. `internal/transport/httpapi/management/setting.go:307` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

위젯 삭제 ID 부재는 무시한다. 삭제와 같은 UUID 편집을 함께 보내면 삭제 후 편집404로 전체 롤백. CUSTOM 이외 board_type이면 board_id는 강제로 null. widget board_id는 FK/소속 검증이 없으므로 프론트에서 실제 선택 목록의 ID만 보낸다. 기존 설정 scalar를 하나라도 보내면 값이 같아도 updated_at 갱신. `internal/domain/board/management.go:225` `internal/domain/board/management.go:246` `migrations/board/000002_management_compat.sql:21`

### 8. 시나리오

```bash
# 정상: 위젯 배열을 문자열로 인코딩
curl -i -X PATCH "$MANAGEMENT/settings" -H "Authorization: Bearer $MEMBER_TOKEN" -H "Content-Type: application/json" --data '{"is_post_alarm":"0","edit_company_main_board":"[{\"id\":0,\"board_type\":\"LATEST\",\"type\":\"BOARD\",\"position\":0}]"}'
# 경계: 같은 키를 실제 배열로 보내면 400 INVALID_PAYLOAD
curl -i -X PATCH "$MANAGEMENT/settings" -H "Authorization: Bearer $MEMBER_TOKEN" -H "Content-Type: application/json" --data '{"edit_company_main_board":[]}'
# DB 제약 경계: 관리자이며 설정이 존재할 때 500 INTERNAL_ERROR
curl -i -X PATCH "$MANAGEMENT/settings" -H "Authorization: Bearer $MEMBER_TOKEN" -H "Content-Type: application/json" --data '{"latest_post_day":0}'
```


## PATCH /api/v1/companies/{company_id}/settings/users/me

### 1. 경로

OperationID: `update-my-company-setting`. [`internal/transport/httpapi/management/handler.go:53`](../../internal/transport/httpapi/management/handler.go#L53)

전체 URL은 제목과 같다. `internal/transport/httpapi/management/handler.go:52`

### 2. Path

`company_id`: int64 회사 ID. 토큰 클레임의 정규 10진 문자열과 완전히 같아야 한다. 누락은 다른 경로이고, `001`/`+1`/잘못된 문자열/타 회사는 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음.

### 4. Body

| 필드 | 타입/필수 | 생략/null | 상한 |
| --- | --- | --- | --- |
| is_post_alarm | legacy.Bool / 선택 | 기존 유지, 새/복원 행 true | 공통 Bool; 길이·개수 해당 없음 |
| is_notice_alarm | legacy.Bool / 선택 | 기존 유지, 새/복원 행 true | 공통 Bool; 길이·개수 해당 없음 |
| is_public_post_alarm | legacy.Bool / 선택 | 기존 유지, 새/복원 행 true | 공통 Bool; 길이·개수 해당 없음 |
| is_comment_alarm | legacy.Bool / 선택 | 기존 유지, 새/복원 행 true | 공통 Bool; 길이·개수 해당 없음 |
| is_like_alarm | legacy.Bool / 선택 | 기존 유지, 새/복원 행 true | 공통 Bool; 길이·개수 해당 없음 |

body 필수, `{}` 허용. 추가 키는 허용하고 무시한다. `internal/transport/httpapi/management/usersetting.go:24`

### 5. 인증·권한

`Authorization: Bearer $MEMBER_TOKEN` 필수(OfficeWave member 계약). member 토큰 검증(401) → 회사 경로 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정. board 토큰을 이 경로에 재사용하지 않는다. `internal/transport/httpapi/router.go:440` `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/humaerr/humaerr.go:106`

회사 설정 존재 조회(404) → 본인 사용자 설정 upsert. 회사 관리자일 필요 없다. user_id는 body로 바꿀 수 없으며 principal에서 취한다. `internal/transport/httpapi/management/usersetting.go:69`

### 6. Response

200: [UserSetting](#user-setting). 404 `NOT_FOUND`: 회사 설정 없음. 나머지 공통 오류. `internal/transport/httpapi/management/usersetting.go:74` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

기존 live 행에서 `{}`는 값과 시각을 유지한다. 없는 행은 기본값으로 생성; soft-delete된 행은 모든 알림 true·검색어 []·created_at now로 초기화하여 복원한 뒤 요청 필드를 반영한다. 쓰기 후 재조회는 같은 트랜잭션이 아니므로 동시 요청의 값이 응답에 반영될 수 있다. `internal/domain/board/management.go:120`

### 8. 시나리오

```bash
# 정상: 숫자 문자열 0/1 허용
curl -i -X PATCH "$MANAGEMENT/settings/users/me" -H "Authorization: Bearer $MEMBER_TOKEN" -H "Content-Type: application/json" --data '{"is_post_alarm":"0","is_like_alarm":1}'
# 경계: 대문자 문자열은 400 INVALID_PAYLOAD
curl -i -X PATCH "$MANAGEMENT/settings/users/me" -H "Authorization: Bearer $MEMBER_TOKEN" -H "Content-Type: application/json" --data '{"is_post_alarm":"False"}'
```


## PUT /api/v1/companies/{company_id}/settings/users/me/recent-search-keywords

### 1. 경로

OperationID: `update-my-recent-search-keywords`. [`internal/transport/httpapi/management/handler.go:54`](../../internal/transport/httpapi/management/handler.go#L54)

전체 URL은 제목과 같다. `internal/transport/httpapi/management/handler.go:53`

### 2. Path

`company_id`: int64 회사 ID. 토큰 클레임의 정규 10진 문자열과 완전히 같아야 한다. 누락은 다른 경로이고, `001`/`+1`/잘못된 문자열/타 회사는 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음.

### 4. Body

| 필드 | 타입/필수 | 기본값 | 상한·파싱 |
| --- | --- | --- | --- |
| recent_search_keyword | scalar[] / 선택 | 생략/null은 [] | JSON 배열. HTTP 개수·문자열 길이 상한 없음; 저장은 앞 8개 |

body 필수, `{}` 허용. 배열 원소는 string/number/bool/null만 허용한다. 문자열 그대로, true→"1", false/null→"", 숫자→Go 문자열(실수는 최단 g 포맷)로 저장; 객체/중첩 배열은400. 추가 키 허용·무시. `internal/transport/httpapi/management/usersetting.go:101` `internal/transport/httpapi/management/usersetting.go:120`

### 5. 인증·권한

`Authorization: Bearer $MEMBER_TOKEN` 필수(OfficeWave member 계약). member 토큰 검증(401) → 회사 경로 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정. board 토큰을 이 경로에 재사용하지 않는다. `internal/transport/httpapi/router.go:440` `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/humaerr/humaerr.go:106`

본인 live 사용자 설정 UPDATE → 영향 행 없으면404. 회사 설정 조회나 관리자 검사는 없음. 본인 외 설정을 지정할 방법도 없음. `internal/transport/httpapi/management/usersetting.go:179` `internal/domain/board/management.go:316`

### 6. Response

200: [UserSetting](#user-setting). 404 `NOT_FOUND`: live 사용자 설정 없음(먼저 PATCH users/me로 생성 가능). 나머지 공통 오류. `internal/transport/httpapi/management/usersetting.go:179` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

전체 목록 교체다. 9개 이상은 첫 8개만 저장하고 성공200. 순서·중복·빈 문자열을 보존하고 trim하지 않는다. 읽을 때 `&quot;`만 `"`로 디코딩되므로 저장 문자열과 응답이 다를 수 있다. 검색어 저장 자체가 updated_at을 갱신한다. `internal/domain/board/management.go:316` `internal/domain/board/usersetting.go:46`

### 8. 시나리오

```bash
# 정상/경계: 9개 송신, 응답에는 앞 8개
curl -i -X PUT "$MANAGEMENT/settings/users/me/recent-search-keywords" -H "Authorization: Bearer $MEMBER_TOKEN" -H "Content-Type: application/json" --data '{"recent_search_keyword":["1","2","3","4","5","6","7","8","9"]}'
# 키를 생략하면 검색어 전체 삭제200
curl -i -X PUT "$MANAGEMENT/settings/users/me/recent-search-keywords" -H "Authorization: Bearer $MEMBER_TOKEN" -H "Content-Type: application/json" --data '{}'
# 중첩 객체 원소는400
curl -i -X PUT "$MANAGEMENT/settings/users/me/recent-search-keywords" -H "Authorization: Bearer $MEMBER_TOKEN" -H "Content-Type: application/json" --data '{"recent_search_keyword":[{"text":"x"}]}'
```


## PUT /api/v1/board/companies/{company_id}/users/{user_id}/category-tree

### 1. 경로

OperationID: `board-reorder-category-tree`. [`internal/transport/httpapi/board/routes.go:365`](../../internal/transport/httpapi/board/routes.go#L365)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:383`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음.

### 4. Body

이 경로만 multipart/form-data 및 application/x-www-form-urlencoded를 JSON으로 변환한다. `boards[UUID]=1`처럼 bracket **1단계** 중첩을 지원하고, 10진 정수 ParseInt에 성공한 form 값만 숫자로 변환한다. `category_positions[0][id]` 같은 2단계는 지원하지 않으므로 배열은 JSON으로 보낸다. `internal/transport/httpapi/middleware/formbody.go:65`, `internal/transport/httpapi/middleware/formbody.go:93`, `internal/transport/httpapi/middleware/formbody.go:184`, `internal/transport/httpapi/middleware/formbody.go:211`

| 필드 | 타입/필수 | 기본값 | 상한·배열 표기 |
| --- | --- | --- | --- |
| category_positions | Position[] / 선택 | [] | JSON 배열, 개수 상한 없음 |
| board_positions | Position[] / 선택 | [] | JSON 배열, 개수 상한 없음 |
| update_category_position | object UUID→integer / 선택 | {} | 개수 상한 없음; 모든 값 0..2147483647 |
| update_board_position | object UUID→integer / 선택 | {} | 같음 |
| boards | object UUID→integer / 선택 | {} | 같음; 원소가 있으면 회사 관리자 전용 분기 |
| delete_category_id | UUID[] / 선택 | [] | 개수 상한 없음 |
| delete_board_id | UUID[] / 선택 | [] | 개수 상한 없음 |

body 필수; 빈 객체 허용, 추가 키는400. Position 원소는 `{id: UUID, position: integer}` 두 필드 모두 필수, position은 `0..2147483647`, 추가 키400. map의 잘못된 UUID 키·음수·상한 초과도400. 숫자 문자열은 integer가 아니므로400. `internal/transport/httpapi/board/reorder.go:58` `internal/transport/httpapi/board/reorder.go:110` `internal/transport/httpapi/board/reorder.go:279`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

map 파싱(400) → 회사 관리자 확인 → `boards`가 비어 있지 않고 회사 관리자가 아니면403 → 비관리자의 관리 카테고리(직접 관리자+직속 자식) 조회 → 관리 카테고리 0개면403 → 대상 범위 내 삭제/정렬. 게시판 관리자만으로는 이 API를 쓸 수 없다. 권한 밖 ID는404/403으로 구분하지 않고 무시하므로 해당 ID의 존재를 추론할 수 없다. `internal/transport/httpapi/board/reorder.go:198` `internal/domain/board/reorder.go:277`

### 6. Response

200: 아래 직접 객체. 400/401/403/500/503은 공통 오류. 대상 ID 부재는404가 아니다. `internal/transport/httpapi/board/reorder.go:161` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

| 필드 | 타입 | null | 저장/계산·관계 |
| --- | --- | --- | --- |
| reordered | object | 아니오 | 계산; 관계 없음 |
| reordered.categories | number(integer) | 아니오 | UPDATE에 매치된 카테고리 행 수; 0 포함 |
| reordered.boards | number(integer) | 아니오 | UPDATE에 매치된 게시판 행 수; 0 포함 |

### 7. 주의사항

순서(position)만 변경하며 parent_id/category_id를 통한 부모·소속 이동은 수행하지 않는다. 값이 달라질 때만 updated_at을 바꾼다. `internal/domain/board/reorder.go:197` `internal/domain/board/reorder.go:205`

동일 ID는 마지막 position이 이긴다: category 배열→category map, board 배열→update_board_position→boards 순. 같은 위치도 응답 count에는 포함하지만 updated_at은 실제 위치가 바뀔 때만 갱신한다. 삭제를 먼저 수행하므로 같이 삭제된 행은 정렬 count에 포함되지 않는다. 삭제는 [카테고리 삭제](03-category.md)·[게시판 삭제](04-board.md)의 종속 행 처리와 동일하며 전체 트랜잭션이다. `internal/transport/httpapi/board/reorder.go:198` `internal/transport/httpapi/board/reorder.go:308` `internal/domain/board/reorder.go:197` `internal/domain/board/reorder.go:329`

### 8. 시나리오

```bash
# 정상: 관리 권한 있는 실제 카테고리
: "${CATEGORY_ID:?카테고리 UUID}"
curl -i -X PUT "$SCOPE/category-tree" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data "{\"category_positions\":[{\"id\":\"$CATEGORY_ID\",\"position\":0}]}"
# 같은 ID라도 음수 위치는400 INVALID_PAYLOAD
curl -i -X PUT "$SCOPE/category-tree" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data "{\"category_positions\":[{\"id\":\"$CATEGORY_ID\",\"position\":-1}]}"
# 회사 관리자라면 없는 UUID는 무시되어200/count0
curl -i -X PUT "$SCOPE/category-tree" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"board_positions":[{"id":"00000000-0000-0000-0000-000000000000","position":0}]}'
# 정상 form 호환: 회사 관리자 및 실제 게시판 ID
: "${BOARD_ID:?게시판 UUID}"
curl -i -X PUT "$SCOPE/category-tree" -H "Authorization: Bearer $BOARD_TOKEN" --form "boards[$BOARD_ID]=1"
```
