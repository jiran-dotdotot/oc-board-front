# 08. 자료실 폴더

이 파일은 등록 라우트 **5개**를 다룬다. 파일 목록·다운로드·휴지통은 [09](09-drive-file.md), 업로드는 [10](10-upload-department-client.md), 게시판 권한 전문은 [04](04-board.md)를 함께 사용한다. 근거: `internal/transport/httpapi/board/routes.go:538`, `internal/transport/httpapi/board/routes.go:560`, `internal/transport/httpapi/board/routes.go:580`, `internal/transport/httpapi/board/routes.go:981`, `internal/transport/httpapi/board/routes.go:1002`.

## 공통 사항

응답 DTO·에러 봉투에는 [Huma 자동 특수필드](README.md#schema-field)를 함께 적용한다. 등록된 최상위 struct 응답에만 `$schema:string`(null 불가, 계산된 URL)와 `Link`가 추가되며 배열·map·빈Body·gin 직접응답에는 없다. 아래 업무 필드 표에 반복하지 않는다. 입력의 추가 키 불허도 framework의 readonly `$schema` 특수키는 예외다. [Huma transforms.go:157](https://github.com/danielgtaylor/huma/blob/v2.39.0/transforms.go#L157)

이 파일의 공통 오류표에406이 열거되어도 현재 router의 기본 format fallback에서는 미지원 Accept가 JSON으로 처리되어 일반적인406 분기가 생기지 않는다. Content-Type 누락·빈값은 JSON 기본이다. [Huma api.go:355](https://github.com/danielgtaylor/huma/blob/v2.39.0/api.go#L355), [defaults.go:79](https://github.com/danielgtaylor/huma/blob/v2.39.0/defaults.go#L79)

- 모든 요청은 board 계약의 `Authorization: Bearer <board access token>`을 사용한다. 헤더 이름·Bearer 대소문자는 무관하고 Bearer 뒤에는 ASCII 공백이 필요하다. 없거나 잘못된 토큰은 `401/UNAUTHORIZED`; OfficeWave 원본 토큰을 대신 보내면 안 된다. 근거: `internal/transport/httpapi/middleware/auth.go:95`, `internal/transport/httpapi/middleware/auth.go:150`.
- 모든 URL의 `company_id`, `user_id`는 토큰 정수 ID의 **표준 십진 문자열**과 같아야 한다. `42`에 대해 `042`, `+42`, 타인 ID는 `403/FORBIDDEN`; handler 이전에 검사한다. 아래 Path 절에서 “공통 scope”는 이 두 필드를 모두 뜻한다. 근거: `internal/transport/httpapi/middleware/auth.go:212`, `internal/transport/httpapi/middleware/auth.go:261`.
- JSON Body가 있는 요청은 `Content-Type: application/json`. 필드 검증은 저장소 권한 검사보다 먼저 `400/INVALID_PAYLOAD`를 내며, 도메인이 직접 선택한 422는 유지된다. Body 기본 상한은 **1,048,576 bytes**이며 개별 문자열·배열 상한과 별개다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:106`, 설치된 `github.com/danielgtaylor/huma/v2@v2.39.0/huma.go:1491`.
- `Lang`은 표시 사용자 이름의 언어에 사용한다. 생략은 `ko`, `ko/en/ja` 이외는 영어 접미사로 표시한다. 날짜는 저장소의 `timestamptz(3)`을 **UTC, 소수점 여섯 자리** `2026-09-08T03:04:05.123000Z`로 출력한다. 근거: `internal/transport/httpapi/board/me.go:172`, `internal/transport/httpapi/board/me.go:213`, `internal/transport/httpapi/middleware/locale.go:26`, `internal/transport/httpapi/board/dto.go:25`, `migrations/board/000001_initial_schema.sql:743`.
- 생성·수정은 폴더 객체, 삭제는 UUID 문자열 배열, 자료실 조회·트리는 각각 아래 객체를 직접 반환한다. `data` 페이징 봉투는 없다. 근거: `internal/transport/httpapi/board/foldersbody.go:242`, `internal/transport/httpapi/board/foldersbody.go:263`, `internal/transport/httpapi/board/driveview.go:273`.

| status/code | 발생 조건 | 근거 |
| --- | --- | --- |
| 400 `INVALID_PAYLOAD` | UUID/타입/길이/범위/추가 키 검증 실패, JSON 파싱 실패 | `internal/transport/httpapi/humaerr/humaerr.go:106`, `internal/transport/httpapi/humaerr/humaerr.go:188` |
| 401 `UNAUTHORIZED` | board 인증 실패 | `internal/transport/httpapi/middleware/auth.go:184` |
| 403 `FORBIDDEN` | scope 불일치 또는 단건 자원 권한 거절 | `internal/transport/httpapi/middleware/auth.go:212`, `internal/transport/httpapi/board/drivefiles.go:68` |
| 404 `NOT_FOUND` | 허용된 회사 범위에 단건 대상 없음 | `internal/transport/httpapi/board/drivefiles.go:66` |
| 422 `BOARD_NOT_DRIVE` | 생성·자료실 조회·트리의 대상이 DRIVE가 아님 | `internal/transport/httpapi/board/drivefiles.go:74` |
| 422 `FOLDER_PARENT_INVALID` | 같은 게시판의 적절한 부모가 아님; 생성과 수정의 삭제 부모 취급은 다름 | `internal/transport/httpapi/board/folders.go:62`, `internal/domain/board/folderquery.go:112`, `internal/domain/board/folderquery.go:207` |
| 422 `FOLDER_CYCLE` | 자신 또는 자신의 자손 안으로 이동 | `internal/transport/httpapi/board/folders.go:67`, `internal/domain/board/folder.go:179` |
| 500 `INTERNAL_ERROR` | DB/예상하지 못한 내부 오류; 내부 원문은 응답하지 않음 | `internal/transport/httpapi/board/drivefiles.go:77`, `internal/transport/httpapi/humaerr/humaerr.go:42` |
| 503 `SERVICE_UNAVAILABLE` | 요청 context 취소/기한 만료로 작업 중단 | `internal/transport/httpapi/humaerr/humaerr.go:42` |
| 406 `NOT_ACCEPTABLE` / 408 `REQUEST_TIMEOUT` / 413 `REQUEST_ENTITY_TOO_LARGE` / 415 `UNSUPPORTED_MEDIA_TYPE` | 공통 응답 협상/Body 읽기/크기/콘텐츠 타입 오류 | `internal/transport/httpapi/humaerr/humaerr.go:198` |

에러 봉투는 `{"error":{"code":"...","message":"...","details":["..."]}}`; `details`는 없을 수 있다. `code`로 분기한다. 권한 없음과 존재하지 않음을 일괄 작업의 제외 결과만으로 구분할 수 없다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:19`, `internal/domain/board/folder.go:251`.

Huma 오류의 카탈로그 message는 `?lang=` → `Lang` → `Accept-Language` → 영어 순으로 선택한다. 표시 사용자 이름의 기본 언어 ko와 별개다. JWTAuth의 401은 `Authentication required.`와 `WWW-Authenticate: Bearer`, PathScope의 403은 `You do not have permission.`이며 gin 직접 응답이라 번역되지 않는다. 근거: `internal/transport/httpapi/humaerr/lang.go:127`, `internal/transport/httpapi/humaerr/lang.go:157`, `internal/transport/httpapi/middleware/auth.go:174`, `internal/transport/httpapi/middleware/auth.go:270`.

| 422 code | 카탈로그에 없어 언어와 무관하게 유지되는 message | 근거 |
| --- | --- | --- |
| BOARD_NOT_DRIVE | `The board is not a drive.` | `internal/transport/httpapi/board/drivefiles.go:74`, `internal/transport/httpapi/humaerr/lang.go:27` |
| FOLDER_PARENT_INVALID | `The parent folder is not a live folder of this board.` | `internal/transport/httpapi/board/folders.go:64`, `internal/transport/httpapi/humaerr/lang.go:27` |
| FOLDER_CYCLE | `A folder cannot be moved inside itself.` | `internal/transport/httpapi/board/folders.go:67`, `internal/transport/httpapi/humaerr/lang.go:27` |

### curl 준비

각 endpoint의 예시는 서로 독립된 시작 상태를 가정한다. 쓰기 예시를 실행한 뒤에는 다음 예시의 파일·폴더 변수를 설명된 상태의 실제 ID로 다시 설정한다.

[01의 인증](01-auth-user.md)에서 얻은 토큰과 실제 자료실·폴더 ID를 다음 변수에 넣는다. 아래 모든 호출은 동일한 scope를 사용한다. `OTHER_FOLDER_ID`는 같은 자료실의 별도 부모 폴더에 사용한다. 토큰의 회사·사용자와 URL이 일치해야 하는 근거: `internal/transport/httpapi/middleware/auth.go:212`.

```sh
export BASE_URL='http://localhost:8080'
export BOARD_TOKEN='발급받은-board-access-token'
export COMPANY_ID='42' USER_ID='7'
export BOARD_ID='11111111-1111-4111-8111-111111111111'
export FOLDER_ID='22222222-2222-4222-8222-222222222222'
export OTHER_FOLDER_ID='33333333-3333-4333-8333-333333333333'
export SCOPE="$BASE_URL/api/v1/board/companies/$COMPANY_ID/users/$USER_ID"
```

## 공유 DTO 필드 표

<a id="folderview"></a>
### FolderView

아래 필드는 항상 키가 존재한다. 생성·수정의 `user`는 **null**, 자료실 조회와 트리는 회사가 같은 생성자를 LEFT JOIN한다. 사용자 hard delete·다른 회사 참조이면 null이며 disabled/soft-deleted 사용자도 관계에서 지우지 않는다. 근거: `internal/transport/httpapi/board/foldersbody.go:174`, `internal/transport/httpapi/board/foldersbody.go:218`, `internal/domain/board/driveviewquery.go:113`, `internal/domain/board/signaluser.go:89`.

| 필드 | JSON 타입 | null | 저장/계산·관계·포맷 | 근거 |
| --- | --- | --- | --- | --- |
| id | string | 아니오 | 저장 UUID, 생성 시 서버 발급 | `internal/domain/board/folderwrite.go:75` |
| company_id | integer(int64) | 아니오 | 저장, 인증 회사 | `internal/domain/board/folderwrite.go:76` |
| board_id | string | 아니오 | 저장 UUID | `internal/transport/httpapi/board/foldersbody.go:223` |
| parent_id | string | 가능 | 저장 UUID, null=루트 | `migrations/board/000001_initial_schema.sql:738` |
| parent_drive_folder_id | string | 가능 | parent_id의 계산 별칭, 항상 같은 값 | `internal/transport/httpapi/board/foldersbody.go:233` |
| user_id | integer(int64) | 가능 | 저장 생성자 ID | `migrations/board/000001_initial_schema.sql:739` |
| title | string | 아니오 | 저장 text, 빈 문자열 금지, 길이 상한 없음 | `migrations/board/000001_initial_schema.sql:740`, `migrations/board/000001_initial_schema.sql:749` |
| position | integer(int32) | 아니오 | 저장, 0 이상; 생성은 살아 있는 동일 부모 형제의 max+1 | `migrations/board/000001_initial_schema.sql:741`, `internal/domain/board/folderquery.go:152` |
| updated_by | integer(int64) | 가능 | 저장 최종 수정자; 생성 시 null, 수정자 삭제 시 시각만 남을 수 있음 | `migrations/board/000001_initial_schema.sql:742`, `migrations/board/000001_initial_schema.sql:757` |
| updated_by_at | string(timestamp) | 가능 | 저장 최종 수정 시각, 생성 시 null | `internal/domain/board/folderquery.go:256` |
| created_at | string(timestamp) | 아니오 | 저장, 공통 UTC 포맷 | `internal/transport/httpapi/board/foldersbody.go:229` |
| updated_at | string(timestamp) | 아니오 | 저장, 공통 UTC 포맷 | `internal/transport/httpapi/board/foldersbody.go:230` |
| deleted_at | string(timestamp) | 가능 | 저장; 이 파일의 응답은 살아 있는 폴더라 null | `internal/domain/board/folderquery.go:259`, `internal/domain/board/driveviewquery.go:117` |
| user | object | 가능 | [SignalUserView](09-drive-file.md#signaluserview); 생성/수정 null, 조회/트리 기본 포함 | `internal/transport/httpapi/board/foldersbody.go:210`, `internal/domain/board/driveviewquery.go:156` |


`id_type`과 `last_drive_folder_log`는 Go 응답 필드에 없다. 폴더 최종 수정 정보는 `updated_by`/`updated_by_at`을 사용한다. 생성자 관계와 최종 수정자는 다른 값이다. `internal/transport/httpapi/board/foldersbody.go:174`, `internal/transport/httpapi/board/foldersbody.go:218`, `migrations/board/000001_initial_schema.sql:742`

`updated_at`과 `updated_by_at`은 별개 저장 컬럼이다. 현재 수정 API는 같은 시각을 쓰지만 생성 응답부터 앞은 시각, 뒤는 null이므로 두 필드를 같은 값으로 간주하지 않는다. 근거: `migrations/board/000001_initial_schema.sql:743`, `migrations/board/000001_initial_schema.sql:745`, `internal/domain/board/folderquery.go:145`, `internal/domain/board/folderquery.go:256`.

<a id="foldernode"></a>
### FolderNode

[FolderView](#folderview)의 **모든 필드**에 다음 2개를 추가한다. 깊이 상한은 없다. 루트에서 도달하지 못하는 고아 폴더·사이클은 전체 트리에 나오지 않는다. 근거: `internal/transport/httpapi/board/driveview.go:250`, `internal/domain/board/driveview.go:131`.

| 필드 | 타입 | null | 계산/관계 | 근거 |
| --- | --- | --- | --- | --- |
| is_open | boolean | 아니오 | 자료실 조회에서는 path에 포함된 노드만 true(현재 폴더 포함); 트리 전용 조회에서는 전부 false | `internal/transport/httpapi/board/driveview.go:298`, `internal/transport/httpapi/board/driveview.go:316`, `internal/transport/httpapi/board/driveview.go:390` |
| child_drive_folders | FolderNode[] | 아니오 | 전체 자식 관계, 빈 잎은 []; position ASC, id ASC | `internal/transport/httpapi/board/driveview.go:301`, `internal/domain/board/driveviewquery.go:118` |

## ⚠️ 이 도메인의 함정

1. 생성은 201이 아닌 **200**이다. 삭제 성공은 객체가 아닌 **삭제된 ID의 배열**이다. `[]`도 200이며 전부 거절되었거나 빈 요청일 수 있다. 근거: `internal/transport/httpapi/board/routes.go:538`, `internal/transport/httpapi/board/folders.go:147`.
2. 부모 입력은 생성에서 `parent_id`·`parent_drive_folder_id`를 받지만 수정은 `parent_id`만 받는다. 수정에서 `parent_id:null`은 유지이므로 루트로 옮길 수 없다. 근거: `internal/transport/httpapi/board/foldersbody.go:55`, `internal/transport/httpapi/board/foldersbody.go:99`, `internal/domain/board/folderquery.go:255`.
3. 생성은 soft-deleted 부모를 받아들인다. 응답은 200이어도 새 폴더는 루트 기반 트리에서 보이지 않을 수 있다. 수정은 살아 있는 부모만 받는다. 근거: `internal/domain/board/folderquery.go:112`, `internal/domain/board/folderquery.go:215`, `internal/domain/board/driveview.go:131`, `internal/domain/board/folder_integration_test.go:284`.
4. 폴더 삭제는 재귀 삭제가 아니다. 살아 있는 하위 폴더 또는 FAIL 외 상태의 살아 있는 파일이 있으면 그 폴더를 제외한다. 부모·자식을 함께 보내도 검사 시점에 자식이 살아 있으면 부모는 남는다. 근거: `internal/domain/board/folderquery.go:342`, `internal/domain/board/folder.go:263`.
5. `/boards/{id}/drive`의 `drive_folder_id=garbage`는 400이 아니라 빈 위치의 200이다. `/drive-files?drive_folder_id=garbage`는 UUID 검증 400이다. 근거: `internal/transport/httpapi/board/driveview.go:71`, `internal/transport/httpapi/board/drivefilesbody.go:98`.
6. `/drive`에는 파일이 없다. [파일 목록](09-drive-file.md)을 별도로 조회한다. 표시 사용량 ACT 합계와 업로드·복원 제한 판정 ACT+UPLOADING 합계가 다르다. 근거: `internal/transport/httpapi/board/driveview.go:106`, `internal/domain/board/boardstore.go:64`, `internal/domain/board/drivefilewritequery.go:458`.

## POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/folders

### 1. 경로

OperationID: `board-create-drive-folder`. [`internal/transport/httpapi/board/routes.go:538`](../../internal/transport/httpapi/board/routes.go#L538)

`POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/folders` — 폴더 생성. 등록 근거: `internal/transport/httpapi/board/routes.go:538`.

### 2. Path

공통 scope 두 필드 + `id:string(UUID)` 필수, 대상 자료실 게시판. UUID 파싱 실패는 400 `INVALID_PAYLOAD`; 같은 회사의 살아 있는 게시판이 아니면 404 `NOT_FOUND`. 근거: `internal/transport/httpapi/board/foldersbody.go:35`, `internal/domain/board/folderquery.go:121`.

### 3. Query

없음. Query 배열·기본값·enum·상한: 해당 없음. 근거: `internal/transport/httpapi/board/foldersbody.go:35`.

### 4. Body

JSON 객체 필수. 추가 키는 **허용하되 무시**한다(`position`을 보내도 지정되지 않음). 근거: `internal/transport/httpapi/board/foldersbody.go:55`, `internal/transport/httpapi/board/folders_test.go:194`.

| 필드 | 타입·필수 | 기본값 | 검증/길이·개수 상한 | 근거 |
| --- | --- | --- | --- | --- |
| title | string, 필수 | 없음 | 최소 1문자, 최대 없음; 공백만도 허용, trim 없음 | `internal/transport/httpapi/board/foldersbody.go:56`, `internal/transport/httpapi/board/folders_test.go:417` |
| parent_id | UUID string 또는 null, 선택 | null(루트) | 같은 회사·게시판의 기존 폴더; soft-delete 여부는 검사하지 않음 | `internal/transport/httpapi/board/foldersbody.go:57`, `internal/domain/board/folderquery.go:115` |
| parent_drive_folder_id | UUID string 또는 null, 선택 | null | parent_id가 non-null이면 parent_id 우선, 아니면 이 값; 별도 길이/개수 상한 없음 | `internal/transport/httpapi/board/foldersbody.go:64`, `internal/transport/httpapi/board/foldersbody.go:70` |

### 5. 인증·권한

공통 board 인증 401 → scope 403 → 입력 검증 400 → 게시판 존재/회사/soft-delete 404 → 게시판 **Write** false 403 → DRIVE 아님 422 `BOARD_NOT_DRIVE` → 부모 부적합 422 `FOLDER_PARENT_INVALID`. 권한 없는 호출자는 게시판의 종류·부모 적합성 결과를 볼 수 없다. 소유자·관리자 전용은 아니다. 근거: `internal/domain/board/folderwrite.go:45`, `internal/domain/board/folderwrite.go:65`, `internal/domain/board/permission.go:128`.

### 6. Response

아래 status 외에도 DB·서명 등의 작업이 request context 취소/기한 만료로 중단되면 **503 `SERVICE_UNAVAILABLE`**이다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:42`.

200: [FolderView 필드 표](#folderview), 봉투 없음. `updated_by`, `updated_by_at`, `user`, `deleted_at`은 null. 에러: 공통 400/401/403/404/500 및 위 422 두 code, Body 전송 공통 406/408/413/415. 근거: `internal/transport/httpapi/board/folders.go:86`, `internal/domain/board/folderquery.go:145`, `internal/transport/httpapi/board/foldersbody.go:218`.

### 7. 주의사항

첫 형제 position은 1, 이후 살아 있는 형제 max+1이며 같은 제목·position에 유일성 제약은 없다. 동시 생성의 position 중복 가능성이 있으므로 정렬 결과는 position 다음 id로 안정화된다. 두 SQL은 transaction이지만 부모/형제에 행 잠금을 잡지 않는다. 이벤트·큐 작업은 없다. 근거: `internal/domain/board/folderquery.go:112`, `internal/domain/board/folderquery.go:145`, `migrations/board/000001_initial_schema.sql:748`, `internal/domain/board/driveviewquery.go:118`, `internal/domain/board/folderwrite.go:45`.

### 8. 시나리오

정상 200, 빈 제목 400, 공백 제목 200을 나란히 확인한다. 근거: `internal/transport/httpapi/board/folders_test.go:177`, `internal/transport/httpapi/board/folders_test.go:417`.

```sh
curl -i -X POST "$SCOPE/boards/$BOARD_ID/folders" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data '{"title":"개발 문서"}'
curl -i -X POST "$SCOPE/boards/$BOARD_ID/folders" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data '{"title":""}'
curl -i -X POST "$SCOPE/boards/$BOARD_ID/folders" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data '{"title":"   "}'
```

## PUT /api/v1/board/companies/{company_id}/users/{user_id}/folders/{id}

### 1. 경로

OperationID: `board-update-drive-folder`. [`internal/transport/httpapi/board/routes.go:560`](../../internal/transport/httpapi/board/routes.go#L560)

`PUT /api/v1/board/companies/{company_id}/users/{user_id}/folders/{id}` — 부분 수정·이동. 근거: `internal/transport/httpapi/board/routes.go:560`.

### 2. Path

공통 scope + `id:string(UUID)` 폴더 ID 필수. 형식 오류 400 `INVALID_PAYLOAD`; 타 회사·삭제된 폴더·삭제된 게시판·없는 대상은 404 `NOT_FOUND`. 근거: `internal/transport/httpapi/board/foldersbody.go:75`, `internal/domain/board/folderquery.go:207`.

### 3. Query

없음. 기본값·enum·배열·상한: 해당 없음. 근거: `internal/transport/httpapi/board/foldersbody.go:75`.

### 4. Body

객체 필수, `{}` 가능. **추가 키 불허**: `parent_drive_folder_id`는 생성과 달리 선언되어 있지 않아 400 `INVALID_PAYLOAD`. 근거: `internal/transport/httpapi/board/foldersbody.go:99`, 설치된 `github.com/danielgtaylor/huma/v2@v2.39.0/registry.go:216`.

| 필드 | 타입·필수 | 기본값/생략/null | 검증/상한 | 근거 |
| --- | --- | --- | --- | --- |
| title | string 또는 null, 선택 | 기존 값 유지 | 최소 1, 최대 없음; 공백 허용 | `internal/transport/httpapi/board/foldersbody.go:100` |
| position | integer 또는 null, 선택 | 기존 값 유지 | 0~2147483647 | `internal/transport/httpapi/board/foldersbody.go:101` |
| parent_id | UUID string 또는 null, 선택 | 기존 값 유지, null도 유지 | 같은 회사·게시판의 살아 있는 폴더; 자기 자신/자손 불가, 깊이 상한 없음 | `internal/transport/httpapi/board/foldersbody.go:102`, `internal/domain/board/folder.go:179`, `internal/domain/board/folderquery.go:255` |

### 5. 인증·권한

공통 인증/scope/입력 검증 뒤 404 → 게시판 Write 403 → 부모 422 `FOLDER_PARENT_INVALID` → 순환 422 `FOLDER_CYCLE`. 소유자·관리자가 아닌 Write 사용자도 남의 폴더를 수정한다. 생성과 달리 별도 DRIVE 종류 검사는 없다. UPDATE 직전 동시 삭제는 다시 404다. 근거: `internal/domain/board/folderwrite.go:110`.

### 6. Response

아래 status 외에도 DB·서명 등의 작업이 request context 취소/기한 만료로 중단되면 **503 `SERVICE_UNAVAILABLE`**이다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:42`.

200 [FolderView](#folderview). `updated_by`=현재 사용자, `updated_by_at`·`updated_at` 갱신; 관계 `user:null`. 에러: 공통 400/401/403/404/500, 해당 부모·순환 422, 공통 406/408/413/415. 근거: `internal/domain/board/folderquery.go:251`, `internal/transport/httpapi/board/folders.go:112`.

### 7. 주의사항

PUT지만 누락값을 지우지 않는다. `{}`도 수정 이력을 갱신한다. 부모 null로 루트 이동은 불가하다. 사이클 검사는 첫 SELECT snapshot이고 UPDATE 사이에 공유 tree 잠금은 없어 동시 이동까지 직렬화하지 않는다. 큐·알림·이력 배열은 없고 최종 수정자 두 컬럼만 갱신한다. 근거: `internal/domain/board/folderquery.go:207`, `internal/domain/board/folderquery.go:251`, `internal/domain/board/folderwrite.go:115`.

부모를 지정할 때만 부모 링크를 위로 따라가 자신에 도달하는지 검사한다. 자신의 자손 안으로 이동은 거절하지만 기존의 조상 폴더 아래로 옮기는 것은 허용한다. 근거: `internal/domain/board/folderwrite.go:132`, `internal/domain/board/folder.go:179`.

### 8. 시나리오

position 0은 정상, -1은 400, 자기 자신을 부모로 하면 422 `FOLDER_CYCLE`. 근거: `internal/transport/httpapi/board/folders_test.go:234`, `internal/transport/httpapi/board/folders_test.go:246`, `internal/domain/board/folder.go:192`.

```sh
curl -i -X PUT "$SCOPE/folders/$FOLDER_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data '{"title":"변경한 문서","position":0}'
curl -i -X PUT "$SCOPE/folders/$FOLDER_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data '{"position":-1}'
curl -i -X PUT "$SCOPE/folders/$FOLDER_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data "{\"parent_id\":\"$FOLDER_ID\"}"
```

## DELETE /api/v1/board/companies/{company_id}/users/{user_id}/folders

### 1. 경로

OperationID: `board-delete-drive-folders`. [`internal/transport/httpapi/board/routes.go:580`](../../internal/transport/httpapi/board/routes.go#L580)

`DELETE /api/v1/board/companies/{company_id}/users/{user_id}/folders` — 일괄 삭제. 근거: `internal/transport/httpapi/board/routes.go:580`.

### 2. Path

공통 scope만 있다. 별도 폴더 path 없음, 불일치는 403 `FORBIDDEN`. 근거: `internal/transport/httpapi/board/foldersbody.go:111`, `internal/transport/httpapi/middleware/auth.go:212`.

### 3. Query

없음. 대상 배열을 Query에 넣지 않는다. 근거: `internal/transport/httpapi/board/foldersbody.go:111`.

### 4. Body

JSON 객체 필수. `ids?: UUID[]|null`, `id?: UUID[]|null`, 기본 모두 빈 목록, 최소·최대 개수 없음, 중복 허용 후 제거. `id` 길이가 1 이상이면 `ids`보다 우선한다. 둘 다 없거나 빈 배열이면 삭제 없음. UUID 아닌 원소는 400 `INVALID_PAYLOAD`. 추가 키 허용·무시, 전체 Body 1MiB 제한. 근거: `internal/transport/httpapi/board/foldersbody.go:133`, `internal/transport/httpapi/board/foldersbody.go:148`, `internal/domain/board/folder.go:244`, 설치된 `github.com/danielgtaylor/huma/v2@v2.39.0/schema.go:29`.

### 5. 인증·권한

인증/scope/입력 검증 후 각 ID에 회사와 살아 있는 폴더·게시판 검사 → **소유자 또는 CanManage(게시판/카테고리/회사 관리자)** → 하위 콘텐츠 검사. 거절·없는 ID·이미 삭제는 전부 결과에서 제외되며 별도 403/404/422가 아니다. 제외만으로 존재 여부·부모 안의 내용은 구분 불가하다. 근거: `internal/domain/board/folderquery.go:342`, `internal/domain/board/folder.go:236`, `internal/domain/board/permission.go:24`.

### 6. Response

아래 status 외에도 DB·서명 등의 작업이 request context 취소/기한 만료로 중단되면 **503 `SERVICE_UNAVAILABLE`**이다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:42`.

200 최상위 배열, 봉투 없음. 에러: 공통 인증 401/scope403/입력400/내부500, Body 공통406/408/413/415. **부분 실패도 200**. 근거: `internal/transport/httpapi/board/folders.go:147`, `internal/transport/httpapi/board/foldersbody.go:272`.

| 필드/형태 | 타입 | null | 저장/계산·관계·포맷 | 근거 |
| --- | --- | --- | --- | --- |
| 응답 자체 `[]` | string(UUID)[] | 아니오 | 요청에서 제외 ID를 뺀 계산 목록, 요청 순서 유지·중복 제거; 관계 없음 | `internal/transport/httpapi/board/foldersbody.go:272` |

### 7. 주의사항

폴더 soft-delete와 그 안의 살아 있는 FAIL 파일 soft-delete 및 해당 파일 북마크 soft-delete는 한 transaction이다. FAIL 파일의 `delete_user_id`도 기록한다. 부모 게시판 행을 잠가 업로드 예약과 충돌을 조율하지만 하위 폴더를 재귀 삭제하지 않는다. 클라이언트는 **중복 제거한 요청 ID 수와 반환 수**를 비교하고 남은 항목을 다시 조회한다. 근거: `internal/domain/board/folderquery.go:360`, `internal/domain/board/folderquery.go:383`, `internal/domain/board/folderwrite.go:206`.

여러 게시판은 `b.id` 순서로 `FOR NO KEY UPDATE` 잠금을 잡는다. 첫 조회에서 허용된 ID가 하나도 없으면 쓰기를 실행하지 않고 200 `[]`를 반환한다. S3 객체 삭제는 이 API에서 실행하지 않으며 동반 soft-delete된 FAIL 파일도 [파일 정리 배치](09-drive-file.md#lifecycle)의 보존 조건을 따른다. 근거: `internal/domain/board/folderquery.go:360`, `internal/domain/board/folderwrite.go:219`, `internal/domain/board/drivepurge.go:121`.

### 8. 시나리오

첫 호출은 비어 있는 본인 폴더를 삭제한다. 빈 배열은 200 `[]`; 잘못된 UUID는 400. 근거: `internal/transport/httpapi/board/folders_test.go:479`, `internal/transport/httpapi/board/foldersbody.go:134`.

```sh
curl -i -X DELETE "$SCOPE/folders" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data "{\"ids\":[\"$FOLDER_ID\"]}"
curl -i -X DELETE "$SCOPE/folders" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data '{"ids":[]}'
curl -i -X DELETE "$SCOPE/folders" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data '{"ids":["not-a-uuid"]}'
```

## GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive

### 1. 경로

OperationID: `board-get-drive-listing`. [`internal/transport/httpapi/board/routes.go:981`](../../internal/transport/httpapi/board/routes.go#L981)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive` — 자료실 상단정보·현재 위치·전체 폴더 트리. 근거: `internal/transport/httpapi/board/routes.go:981`.

### 2. Path

공통 scope + 필수 `id:string(UUID)` 게시판. UUID 오류 400 `INVALID_PAYLOAD`; 타 회사·없는/삭제된 게시판 404 `NOT_FOUND`. 근거: `internal/transport/httpapi/board/driveview.go:60`, `internal/domain/board/driveviewquery.go:52`.

### 3. Query

| 이름 | 타입·필수 | 기본값·허용값 | 파싱/오류·상한 | 근거 |
| --- | --- | --- | --- | --- |
| drive_folder_id | string, 선택 | 생략/빈 문자열=루트, 그 외 UUID 위치 | uuid.Parse 실패는 nil UUID로 치환하여 **200 빈 path·drive_folders**; 다른 게시판·삭제·없는 폴더도 동일. 문자열 길이 상한·배열 표기 없음 | `internal/transport/httpapi/board/driveview.go:60`, `internal/transport/httpapi/board/driveview.go:71`, `internal/domain/board/driveviewquery.go:234` |

### 4. Body

없음. 필드·추가 키·기본값·상한: 해당 없음. 근거: `internal/transport/httpapi/board/driveview.go:60`.

### 5. 인증·권한

인증/scope/입력 검증 후 게시판 404 → **Read** false 403 → DRIVE 아님 422 `BOARD_NOT_DRIVE` → 위치 해석 200. 비활성 게시판도 읽기 권한이 있으면 열리며 통합 파일 목록의 활성 필터와 다르다. 근거: `internal/domain/board/driveviewquery.go:52`, `internal/domain/board/driveview_integration_test.go:149`.

### 6. Response

아래 status 외에도 DB·서명 등의 작업이 request context 취소/기한 만료로 중단되면 **503 `SERVICE_UNAVAILABLE`**이다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:42`.

200 아래 최상위 객체. 에러 400/401/403/404/422 `BOARD_NOT_DRIVE`/500, 공통 응답협상406. 근거: `internal/transport/httpapi/board/driveview.go:335`.

| 필드 | 타입 | null | 저장/계산·관계·포맷 | 근거 |
| --- | --- | --- | --- | --- |
| id, title | string(UUID), string | 아니오 | 저장 게시판 ID·제목 | `internal/transport/httpapi/board/driveview.go:350` |
| is_admin | boolean | 아니오 | 계산, 게시판 또는 카테고리 관리자; 회사 관리자만인 경우와 CanManage는 다름 | `internal/transport/httpapi/board/driveview.go:352`, `internal/transport/httpapi/board/boardsbody.go:140` |
| board | [BoardView](04-board.md) | 아니오 | 게시판 저장값·권한 계산값, 기본 포함 | `internal/transport/httpapi/board/driveview.go:353` |
| total_usage_size | integer(int64 bytes) | 아니오 | 계산, 살아 있는 ACT 파일 size 합계, 없으면0 | `internal/domain/board/boardstore.go:64`, `internal/transport/httpapi/board/driveview.go:354` |
| size_limit | integer(int64 bytes) | 가능 | 저장 게시판 할당량; null=무제한 | `internal/transport/httpapi/board/driveview.go:355`, `migrations/board/000001_initial_schema.sql:287` |
| path | [FolderView](#folderview)[] | 아니오 | 현재 위치까지 조상→자신 순, 루트/잘못된 위치=[] | `internal/domain/board/driveview.go:175` |
| drive_folders | [FolderView](#folderview)[] | 아니오 | 위치 바로 아래 살아 있는 폴더, 기본 user 포함, position/id ASC | `internal/domain/board/driveviewquery.go:113`, `internal/domain/board/driveview.go:205` |
| child_drive_folders | [FolderNode](#foldernode)[] | 아니오 | 전체 루트 트리, 위치가 잘못돼도 전체 트리는 유지 | `internal/domain/board/driveviewquery.go:234`, `internal/transport/httpapi/board/driveview.go:358` |

### 7. 주의사항

권한→사용량→전체 폴더의 3 SELECT에 별도 snapshot transaction은 없다. 조회 중 변경으로 상단 용량·폴더가 같은 순간을 반영하지 않을 수 있다. 읽음 처리·최근검색어 저장·큐·캐시는 이 경로에 없다. 파일은 반환하지 않으므로 `/drive-files?board_id=...&is_root=1` 또는 `drive_folder_id=...`로 별도 조회한다. 근거: `internal/domain/board/driveviewquery.go:193`, `internal/transport/httpapi/board/driveview.go:335`.

### 8. 시나리오

루트와 하위 폴더는 200; 깨진 위치 문자열도 200이며 `path`·`drive_folders`만 빈 배열이다. 근거: `internal/transport/httpapi/board/drivefiles_test.go:840`, `internal/transport/httpapi/board/drivefiles_test.go:855`.

```sh
curl -i "$SCOPE/boards/$BOARD_ID/drive" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i --get "$SCOPE/boards/$BOARD_ID/drive" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode "drive_folder_id=$FOLDER_ID"
curl -i --get "$SCOPE/boards/$BOARD_ID/drive" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'drive_folder_id=not-a-uuid'
```

## GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive/folder-tree

### 1. 경로

OperationID: `board-get-drive-folder-tree`. [`internal/transport/httpapi/board/routes.go:1002`](../../internal/transport/httpapi/board/routes.go#L1002)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive/folder-tree` — 업로드 폴더 선택기. 근거: `internal/transport/httpapi/board/routes.go:1002`.

### 2. Path

공통 scope + 필수 `id:string(UUID)` 게시판. 잘못된 UUID 400 `INVALID_PAYLOAD`, 다른 회사·없는/삭제된 게시판 404 `NOT_FOUND`. 근거: `internal/transport/httpapi/board/driveview.go:84`, `internal/domain/board/driveviewquery.go:52`.

### 3. Query

없음. 위치 선택·페이징·배열 파라미터 없음. 근거: `internal/transport/httpapi/board/driveview.go:84`.

### 4. Body

없음. 필드·추가 키·기본값·상한: 해당 없음. 근거: `internal/transport/httpapi/board/driveview.go:84`.

### 5. 인증·권한

공통 인증/scope/입력검증 → 게시판 404 → Read 403 → DRIVE 검사 422 `BOARD_NOT_DRIVE`. **선택기를 열 권한은 Read**이며 실제 업로드 Write 권한과 별개다. 존재하지만 Read가 없는 대상의 종류는 공개하지 않는다. 근거: `internal/domain/board/driveviewquery.go:52`, `internal/domain/board/driveviewquery.go:267`.

### 6. Response

아래 status 외에도 DB·서명 등의 작업이 request context 취소/기한 만료로 중단되면 **503 `SERVICE_UNAVAILABLE`**이다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:42`.

200 아래 객체; 에러 400/401/403/404/422 `BOARD_NOT_DRIVE`/500, 공통406. 근거: `internal/transport/httpapi/board/driveview.go:369`.

| 필드 | 타입 | null | 저장/계산·관계·포맷 | 근거 |
| --- | --- | --- | --- | --- |
| id | string(UUID) | 아니오 | 저장 게시판 ID | `internal/transport/httpapi/board/driveview.go:385` |
| title | string | 아니오 | 저장 게시판 제목 | `internal/transport/httpapi/board/driveview.go:386` |
| except_extension | string[] | 아니오 | 저장 제외 확장자 목록, 빈 목록=[] | `internal/transport/httpapi/board/driveview.go:387`, `internal/transport/httpapi/board/boardsbody.go:178` |
| size_limit | integer(int64 bytes) | 가능 | 저장 게시판 용량 한도, null=무제한 | `internal/transport/httpapi/board/driveview.go:388`, `migrations/board/000001_initial_schema.sql:287` |
| size_limit_per_file | integer(int64 bytes) | 가능 | 저장 개별 파일 한도; null은 업로드 시 서버 기본 3GiB 적용 | `internal/transport/httpapi/board/driveview.go:389`, `internal/domain/board/driveupload.go:105` |
| child_drive_folders | [FolderNode](#foldernode)[] | 아니오 | 전체 트리 기본 포함, 모든 is_open=false; 모든 폴더의 user 기본 JOIN | `internal/transport/httpapi/board/driveview.go:390`, `internal/domain/board/driveviewquery.go:274` |

### 7. 주의사항

`board` 하위 객체나 사용량·path·파일은 없다. 위 다섯 게시판 설정이 **최상위**에 있다. 앞의 자료실 조회에 이미 전체 트리가 있어 페이지 탐색을 위한 중복 요청은 불필요하지만, 이 전용 응답은 사용량 집계를 하지 않는다. 근거: `internal/transport/httpapi/board/driveview.go:202`, `internal/domain/board/driveviewquery.go:267`.

### 8. 시나리오

정상 조회 200, 잘못된 UUID는 400 `INVALID_PAYLOAD`; 유효한 토큰이어도 다른 사용자 scope는 403이다. 근거: `internal/transport/httpapi/board/driveview.go:85`, `internal/transport/httpapi/middleware/auth.go:232`.

```sh
curl -i "$SCOPE/boards/$BOARD_ID/drive/folder-tree" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i "$SCOPE/boards/not-a-uuid/drive/folder-tree" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i "$BASE_URL/api/v1/board/companies/$COMPANY_ID/users/not-a-number/boards/$BOARD_ID/drive/folder-tree" -H "Authorization: Bearer $BOARD_TOKEN"
```
