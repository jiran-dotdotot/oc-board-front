# 03. 카테고리

등록 엔드포인트 **8개**. 정렬/일괄 삭제 API는 [02 관리](02-management.md)에 별도로 있다. `internal/transport/httpapi/board/routes.go:112`, `internal/transport/httpapi/board/routes.go:198`, `internal/transport/httpapi/board/routes.go:405`

## 공통 사항

응답 DTO·에러 봉투에는 [Huma 자동 특수필드](README.md#schema-field)를 함께 적용한다. 등록된 최상위 struct 응답에만 `$schema:string`(null 불가, 계산된 URL)와 `Link`가 추가되며 배열·map·빈Body·gin 직접응답에는 없다. 아래 업무 필드 표에 반복하지 않는다. 입력의 추가 키 불허도 framework의 readonly `$schema` 특수키는 예외다. [Huma transforms.go:157](https://github.com/danielgtaylor/huma/blob/v2.39.0/transforms.go#L157)

이 파일의 공통 오류표에406이 열거되어도 현재 router의 기본 format fallback에서는 미지원 Accept가 JSON으로 처리되어 일반적인406 분기가 생기지 않는다. Content-Type 누락·빈값은 JSON 기본이다. [Huma api.go:355](https://github.com/danielgtaylor/huma/blob/v2.39.0/api.go#L355), [defaults.go:79](https://github.com/danielgtaylor/huma/blob/v2.39.0/defaults.go#L79)

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

`company_id`와 `user_id` 경로 규칙은 모든 API에 적용된다. 리소스 `id`/body UUID는 Huma UUID 파싱, 문자열 길이·범위·enum 검증은 400이다. 생성의 도메인 오류만 별도 422가 있다. 배열은 JSON `[...]`로 전송한다. 날짜는 UTC `YYYY-MM-DDTHH:mm:ss.ffffffZ`; 빈 관계/ignored 배열은 `[]`다. `internal/transport/httpapi/board/categorycrud.go:46`, `internal/transport/httpapi/board/dto.go:27`, `internal/transport/httpapi/board/categorybody.go:130`, `internal/transport/httpapi/board/categorybody.go:296`

`legacy.Bool`: JSON `true`, `false`, `0`, `1`, 문자열 `"0"`, `"1"`, `"true"`, `"false"`, `null`만 통과한다. `"True"`, `"FALSE"`, `"yes"`, `2`, 공백이 붙은 문자열은 `400 INVALID_PAYLOAD`. optional 포인터의 null은 생략처럼 처리한다. `internal/transport/httpapi/legacy/bool.go:110`

성공 봉투는 트리 사용자/관리자 `{public_boards,categories}`, 관리 대상 트리 `CategoryView[]`, 상세/쓰기/알림 직접 객체, 삭제 204 빈 body로 구분한다. 오류는 `{"error":{"code":"…","message":"…","details":…}}`이며 details는 생략 가능하다. `internal/transport/httpapi/board/category.go:76`, `internal/transport/httpapi/board/category.go:117`, `internal/transport/httpapi/board/categorybody.go:30`, `internal/transport/httpapi/humaerr/humaerr.go:18`

| status | error.code | 조건 |
| --- | --- | --- |
| 400 | `INVALID_PAYLOAD` | 타입/UUID/스키마/알림 query enum 검증 실패 |
| 401 | `UNAUTHORIZED` | board 인증 실패 |
| 403 | `FORBIDDEN` | 경로 범위/가시성/관리 권한 부족 |
| 404 | `NOT_FOUND` | 대상 또는 부모 카테고리 부재·soft-delete·타 회사 |
| 422 | `CATEGORY_PARENT_IS_CHILD` | 새 카테고리의 부모가 이미 2단계 |
| 500 | `INTERNAL_ERROR` | DB 오류/동시 변경 중 불완전한 부모 연결 |
| 503 | `SERVICE_UNAVAILABLE` | deadline/cancel |

근거: `internal/transport/httpapi/board/categorycrud.go:119`, `internal/transport/httpapi/board/categorycrud.go:179`, `internal/domain/board/categorywrite.go:495`, `internal/transport/httpapi/board/notification.go:252`, `internal/transport/httpapi/humaerr/humaerr.go:42`, `internal/transport/httpapi/humaerr/humaerr.go:188`. 전역 요청 크기·콘텐츠 타입 오류는 [README](README.md)를 따른다.

```bash
BASE_URL=${BASE_URL:-http://localhost:8080}
: "${COMPANY_ID:?회사 ID}" "${USER_ID:?사용자 ID}" "${BOARD_TOKEN:?board 토큰}"
SCOPE="$BASE_URL/api/v1/board/companies/$COMPANY_ID/users/$USER_ID"
# ID가 필요한 예제는 실제 접근 가능한 카테고리 UUID를 설정한다.
: "${CATEGORY_ID:?카테고리 UUID}"
```

## 공유 DTO 필드 표

<a id="category-columns"></a>
### CategoryColumns — 트리·상세·쓰기 공통

| 필드 | 타입 | null | 저장/계산·포맷 |
| --- | --- | --- | --- |
| id | string(UUID) | 아니오 | 저장 |
| company_id | number(int64) | 아니오 | 저장 |
| user_id | number(int64) | 예 | 저장; 생성자, 삭제된 사용자일 수 있음 |
| parent_category_id | string(UUID) | 예 | 저장 parent_id의 API 별칭; root null |
| depth | number(integer) | 아니오 | 계산: parent null이면1, 아니면2 |
| name | string | 아니오 | 저장 |
| position | number(integer) | 아니오 | 저장 int32 >=0 |
| is_active | boolean | 아니오 | 저장 |
| created_at | string | 아니오 | 저장 UTC |
| updated_at | string | 아니오 | 저장 UTC |
| deleted_at | string | 예 | 저장 UTC; live 응답 null |

근거: `internal/transport/httpapi/board/category.go:49`, `internal/transport/httpapi/board/category.go:210`, `internal/transport/httpapi/board/categorybody.go:41`, `migrations/board/000001_initial_schema.sql:150`. 공통 필드 자체에 eager 관계는 없음.

<a id="category-view"></a>
### CategoryView — CategoryColumns + 아래 필드

| 필드 | 타입 | null | 저장/계산·기본 관계 |
| --- | --- | --- | --- |
| is_admin | boolean | 아니오 | 계산: 이 카테고리 직접 관리자 여부; 부모/회사 관리자 대체 아님 |
| is_post_alarm | boolean | 아니오 | 본인 category_user_settings 저장값; 행 없으면 계산 기본 true |
| is_comment_alarm | boolean | 아니오 | 같음 |
| boards | [BoardView](04-board.md#board-view)[] | 아니오 | 기본 포함; 각 트리의 board 노출 규칙 적용 |
| child_categories | CategoryView[] | 아니오 | 기본 포함; 직속 자식만, 자식의 child_categories=[] |

근거: `internal/transport/httpapi/board/category.go:49`, `internal/transport/httpapi/board/category.go:182`, `internal/domain/board/categorytree.go:209`, `internal/domain/board/categorytreequery.go:120`. 트리는 카테고리/게시판 모두 position 오름차순 후 UUID byte 오름차순이다. 두 목록을 순서대로 조회하므로 하나의 DB 스냅샷으로 읽지 않는다. `internal/domain/board/categorytree.go:471`, `internal/domain/board/categorytreequery.go:120`

<a id="category-detail"></a>
### CategoryDetail — CategoryColumns + 아래 필드

| 필드 | 타입 | null | 저장/계산·기본 관계 |
| --- | --- | --- | --- |
| is_admin | boolean | 아니오 | 계산: 직접 카테고리 관리자 |
| can_manage | boolean | 아니오 | 계산: 회사 관리자 또는 본인/부모 카테고리 관리자 |
| category_members | CategoryUserGrant[] | 아니오 | 기본 eager; live grant, user_id 오름차순 |
| category_admins | CategoryUserGrant[] | 아니오 | 기본 eager; live grant, user_id 오름차순 |
| category_departments | CategoryDepartmentGrant[] | 아니오 | 기본 eager; live grant, department_id 오름차순 |

`boards`, `child_categories`, 개인 알림 플래그는 상세 응답에 없다. 근거: `internal/transport/httpapi/board/categorybody.go:41`, `internal/domain/board/categoryrepo.go:140`, `internal/domain/board/categoryrepo.go:201`.

### CategoryUserGrant

| 필드 | 타입 | null | 저장/계산·관계 |
| --- | --- | --- | --- |
| category_id | string(UUID) | 아니오 | 저장 |
| company_id | number(int64) | 아니오 | 저장 |
| user_id | number(int64) | 아니오 | 저장 |
| created_at | string | 아니오 | 저장 UTC |
| updated_at | string | 예 | member 저장 UTC; admin은 해당 컬럼이 없어 null |
| deleted_at | string | 예 | 저장 UTC; 반환 live grant null |
| user | [GrantUser](04-board.md#grant-user) | 예 | 기본 eager; 부재/타회사 사용자 null, 퇴사자는 포함 |

### CategoryDepartmentGrant

| 필드 | 타입 | null | 저장/계산·관계 |
| --- | --- | --- | --- |
| category_id | string(UUID) | 아니오 | 저장 |
| department_id | number(int64) | 아니오 | 저장 |
| created_at | string | 아니오 | 저장 UTC |
| updated_at | string | 아니오 | 저장 UTC |
| deleted_at | string | 예 | 저장 UTC; live grant null |
| department | [GrantDepartment](04-board.md#grant-department) | 예 | 기본 eager; 부재/삭제/타회사 부서 null |

grant에 surrogate `id`는 없다. nullable user/member와 퇴사·비활성 표시/프로필 URL 규칙은 [공유 GrantUser](04-board.md#grant-user)를 적용한다. 근거: `internal/transport/httpapi/board/categorybody.go:76`, `internal/transport/httpapi/board/categorybody.go:90`, `internal/domain/board/grantuser.go:134`.

<a id="category-write"></a>
### CategoryWrite — CategoryColumns + 아래 필드

| 필드 | 타입 | null | 저장/계산 |
| --- | --- | --- | --- |
| ignored_user_ids | number(int64)[] | 아니오 | 계산: 추가가 거부된 멤버/관리자 사용자 ID 합집합, 중복 제거 후 오름차순 |
| ignored_department_ids | number(int64)[] | 아니오 | 계산: 추가가 거부된 부서 ID, 중복 제거 후 오름차순 |

관계 eager load 없음, `is_admin`/`can_manage`도 없음. 200이어도 ignored 배열이 비어 있지 않으면 일부 권한 지정이 저장되지 않은 것이다. 거부 사유(부재/타회사/상위 허용집합 밖)는 분리하지 않는다. `internal/transport/httpapi/board/categorybody.go:296`, `internal/domain/board/categorygrants.go:399`

<a id="category-permission"></a>
## 카테고리 권한·허용 대상·트리 규칙

권한 조회는 먼저 live 동일 회사 카테고리를 찾는다(부재/삭제/타회사 모두404). `Visible = 회사 관리자 OR 카테고리 관리자(본인 또는 live 부모 1홉) OR 직접 카테고리 멤버 OR 지정 부서 일치`. `CanManage = 회사 관리자 OR 카테고리 관리자(본인/부모 1홉)`. `is_admin` 응답은 직접 관리자만 표시한다. `is_active`는 이 권한 게이트의 조건이 아니다. `internal/domain/board/categoryrepo.go:220`, `internal/domain/board/categorywrite.go:429`

부서는 사용자의 동일 회사 live·활성 소속(public.members)에서 출발하여 closure의 모든 조상 부서까지 비교한다. 부서 자체는 live·동일 회사만 필요하며 disabled_at 필터는 없다. 게시판의 읽기/쓰기 전문은 [04 권한 규칙](04-board.md#permission)과 같다. `internal/domain/board/permissionquery.go:66`

카테고리 생성/수정의 추가 대상 집합은 **부모 카테고리**를 기준으로 한다. root는 동일 회사에 존재하는 사용자/부서면 허용한다(이 회사 검사만으로는 퇴사·삭제 여부를 배제하지 않음). 자식은 부모의 직접 카테고리 멤버 + 부모 지정 부서와 그 자손의 live·활성 소속 사용자만 허용하고, 부서는 부모 지정 부서와 그 자손 중 live 동일 회사만 허용한다. 부모 허용집합이 비면 누구도 추가할 수 없다. 부모 관리자라는 이유만으로 대상 사용자 허용집합에 들어가지는 않는다. `internal/domain/board/allowedtargets.go:66`, `internal/domain/board/allowedtargets.go:103`, `internal/domain/board/categorygrants.go:387`

권한 변경 전파 범위는 대상 카테고리와 **직속 자식**, 그 아래 게시판이다. 멤버/부서 추가·삭제는 전파하며 새 board grant의 read/write 기본 true, 기존 grant의 방향 플래그는 보존한다. 관리자 **추가**는 대상 카테고리 하나에만 적용하며 멤버십을 자동으로 만들지 않는다. 관리자 **삭제**는 대상/자식 카테고리 관리자에 적용하지만 board_admins를 직접 지우지 않는다. 멤버 삭제는 해당 범위의 카테고리/게시판 관리자 권한도 제거한다. 삭제 전파는 soft-delete 게시판의 grant도 포함하고 추가는 live 게시판만 포함한다. `internal/domain/board/categorygrants.go:98`, `internal/domain/board/categorygrants.go:135`, `internal/domain/board/categorygrants.go:315`, `internal/domain/board/categorygrants.go:462`

같은 ID를 추가·삭제에 함께 보내면 해당 멤버/부서 grant는 추가가 이긴다. 그러나 처리 순서가 board_members 삭제→추가→board_admins의 멤버 연동 삭제, category_members 삭제→추가→category_admins의 멤버 연동 삭제→명시 관리자 삭제→명시 관리자 추가이므로 **멤버 재추가만으로 관리자 권한은 복구되지 않는다**. 관리자 재추가가 필요하면 명시적인 insert_category_admin_user_id를 보낸다(현재 카테고리만 복원). 모든 쓰기와 전파는 하나의 트랜잭션이다. `internal/domain/board/categorygrants.go:462`, `internal/domain/board/categorywrite.go:151`, `internal/domain/board/categorywrite.go:362`


트리 도메인 조회는 회사의 live 카테고리/게시판을2 SQL로 읽고 Go에서 필터하므로 서버 비용은 회사 규모에 비례한다. 권한 게이트와 BEGIN/COMMIT을 제외한 쓰기 SQL 수는 카테고리 생성 최대7, 수정1~15, 삭제7~17(종속 board 없으면7), 게시판 삭제10이다. 빈 grant 목록의 SQL은 생략한다. `internal/domain/board/categorytreequery.go:56`, `internal/domain/board/categorytreequery.go:109`, `internal/domain/board/categorywrite.go:404`, `internal/domain/board/categorywrite.go:469`, `internal/domain/board/categorygrants.go:375`, `internal/domain/board/categorygrants.go:462`, `internal/domain/board/allowedtargets.go:134`, `internal/domain/board/allowedtargets.go:151`, `internal/domain/board/categorydelete.go:215`, `internal/domain/board/boardstore.go:214`

## ⚠️ 이 도메인의 함정

- `with_category_admin=false`도 **true**다. 비활성 값은 빈 문자열과 `0`뿐이다. `internal/transport/httpapi/board/category.go:129`
- `/categories/admin`은 일반 회원도200, `/categories/management`는 회사 관리자라고 회사 전체 트리를 주지 않는다. `internal/transport/httpapi/board/category.go:145`, `internal/transport/httpapi/board/category.go:166`
- 사용자 트리의 자식이 조건을 충족해도 root가 노출되지 않으면 자식을 붙일 곳이 없어 결과에 나오지 않는다. 가시 board 때문에 트리에 등장한 category라도 카테고리 상세 권한은403일 수 있다. `internal/domain/board/categorytree.go:235`, `internal/domain/board/categorytree.go:305`, `internal/domain/board/categorywrite.go:429`
- 카테고리 수정 body의 `parent_category_id`, `is_post_alarm`, `is_comment_alarm`은 추가 키로 허용되지만 무시된다. 이동 API로 해석하지 않는다. 개인 알림은 전용 my-notification 경로를 쓴다. `internal/transport/httpapi/board/categorybody.go:257`
- 알림 body를 안 보내도200이다. 단 flags를 전혀 안 보내면 설정 행을 기본값으로 생성하거나 기존 행의 updated_at을 갱신할 수 있다. `internal/transport/httpapi/board/notification_test.go:213`, `internal/domain/board/notification.go:118`


## GET /api/v1/board/companies/{company_id}/users/{user_id}/categories

### 1. 경로

OperationID: `board-list-categories`. [`internal/transport/httpapi/board/routes.go:113`](../../internal/transport/httpapi/board/routes.go#L113)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:112`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

### 3. Query

| 이름 | 타입/필수 | 기본값 | 허용값·파싱·상한 |
| --- | --- | --- | --- |
| with_category_admin | string / 선택 | "" → false | 모든 문자열 허용, ""와 "0"만 false; 나머지 true. 길이 상한 없음. 배열 파라미터 아님 |

`true/false` boolean 파싱이 아니다. 잘못된 문자열이라는 이유로400이 되지 않는다. 페이징·take/limit 없음. `internal/transport/httpapi/board/category.go:98` `internal/transport/httpapi/board/category.go:129`

### 4. Body

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/category.go:98`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

회원 트리 필터 적용. 회사 관리자도 이 엔드포인트에서는 회원 트리 규칙을 따른다. live·활성 category이며 읽을 수 있는 활성 board 보유 OR 직접 멤버 OR 지정 부서 OR (with_category_admin && 본인/부모 관리자)일 때 노출한다. 부모 root가 빠지면 자식도 출력되지 않는다. 권한 없는 개별 ID에 대해 오류를 주지 않고 배열에서 제외한다. `internal/domain/board/categorytree.go:235` `internal/domain/board/categorytree.go:288`

### 6. Response

200: 아래 봉투, 비어 있으면 두 배열 모두[].

| 필드 | 타입 | null | 계산/기본 관계 |
| --- | --- | --- | --- |
| public_boards | [BoardView](04-board.md#board-view)[] | 아니오 | 계산/기본 포함; category_id=null 게시판 |
| categories | [CategoryView](#category-view)[] | 아니오 | 계산/기본 포함; root와 노출 자식 |

공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

public_boards는 활성 공용 게시판이다. trees의 board는 Read=true+활성만 포함된다. 원본 권한은 활성 여부와 독립이므로 트리에서 빠졌다는 이유로 상세 접근 불가라고 단정하지 않는다. 서버 캐시/최근검색어 저장/읽음 처리는 이 핸들러에 없다. `internal/domain/board/categorytree.go:316` `internal/transport/httpapi/board/category.go:129`

### 8. 시나리오

```bash
# 정상: 관리자 카테고리 추가 안 함
curl -i "$SCOPE/categories?with_category_admin=0" -H "Authorization: Bearer $BOARD_TOKEN"
# 경계: false 문자열은 관리자 카테고리 포함(true로 평가)
curl -i "$SCOPE/categories?with_category_admin=false" -H "Authorization: Bearer $BOARD_TOKEN"
```


## GET /api/v1/board/companies/{company_id}/users/{user_id}/categories/admin

### 1. 경로

OperationID: `board-list-admin-categories`. [`internal/transport/httpapi/board/routes.go:125`](../../internal/transport/httpapi/board/routes.go#L125)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:124`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. with_category_admin을 해석하지 않는다. `internal/transport/httpapi/board/category.go:145`

### 4. Body

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/category.go:145`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

회사 관리자 여부 조회 → true면 ScopeSuper(비활성 category·분류된 board까지 포함), false면 with_category_admin=true인 회원 트리. 관리자 아닌 호출도200이다. `internal/transport/httpapi/board/category.go:145` `internal/domain/board/categorytree.go:292`

### 6. Response

200:

| 필드 | 타입 | null | 계산/기본 관계 |
| --- | --- | --- | --- |
| public_boards | [BoardView](04-board.md#board-view)[] | 아니오 | 계산/기본 포함; category_id=null 게시판 |
| categories | [CategoryView](#category-view)[] | 아니오 | 계산/기본 포함; root와 노출 자식 |

공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

최고관리자여도 **비활성 공용 board는 제외**한다. 분류된 비활성 board는 포함한다. soft-delete 행은 모든 분기에서 제외. 결과 정렬은 공통 DTO 규칙, 읽음/검색어 부수효과 없음. `internal/domain/board/categorytree.go:350` `internal/domain/board/categorytreequery.go:120`

### 8. 시나리오

```bash
# 정상: 회사 관리자 토큰이면 전체 회사 트리
curl -i "$SCOPE/categories/admin" -H "Authorization: Bearer $BOARD_TOKEN"
# 경계: Authorization이 없으면401 UNAUTHORIZED
curl -i "$SCOPE/categories/admin"
```


## GET /api/v1/board/companies/{company_id}/users/{user_id}/categories/management

### 1. 경로

OperationID: `board-list-management-categories`. [`internal/transport/httpapi/board/routes.go:136`](../../internal/transport/httpapi/board/routes.go#L136)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:135`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/category.go:166`

### 4. Body

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/category.go:166`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

ScopeAdmin 고정. 직접 관리 category와 그 자식, 직접 board 관리자의 category, 이들을 붙일 부모가 후보이고 활성 category만 노출한다. 최고관리자 우회 없음. 관리 대상이 없어도200 []. `internal/domain/board/categorytree.go:209` `internal/domain/board/categorytree.go:299`

### 6. Response

200: **[CategoryView](#category-view)[] 직접 배열**. 공용 게시판 필드/봉투 없음. 나머지 공통 오류. `internal/transport/httpapi/board/category.go:117` `internal/transport/httpapi/board/category.go:166`

| 필드 | 타입 | null | 저장/계산·기본 관계 |
| --- | --- | --- | --- |
| (응답 루트) | CategoryView[] | 아니오 | 계산 트리; 공통 CategoryView 관계 기본 포함 |

공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

비활성 board의 관리자도 그 category를 후보로 만들 수 있지만 board 자체는 노출하지 않는다. 활성 board 중 관리 category 소속 또는 직접 board 관리자 대상만 포함한다. 공용 board를 관리해도 이 배열에 공용 board는 없다. `internal/domain/board/categorytree.go:325` `internal/domain/board/categorytree.go:366`

### 8. 시나리오

```bash
# 정상: 관리 대상 직접 배열
curl -i "$SCOPE/categories/management" -H "Authorization: Bearer $BOARD_TOKEN"
# 경계: 토큰 없는 호출401 UNAUTHORIZED
curl -i "$SCOPE/categories/management"
```


## GET /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}

### 1. 경로

OperationID: `board-get-category`. [`internal/transport/httpapi/board/routes.go:147`](../../internal/transport/httpapi/board/routes.go#L147)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:146`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

`id`: UUID, 필수. 잘못된 UUID는 Huma에서 `400 INVALID_PAYLOAD`; 잘 형식화된 부재·삭제·타 회사 ID는 핸들러에서 `404 NOT_FOUND`. `internal/transport/httpapi/board/categorycrud.go:46`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/categorycrud.go:46`

### 4. Body

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/categorycrud.go:46`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

live 동일회사 대상 조회404 → Visible 검사403 → 세 grant 관계 조회. 같은 회사에서 부재와 존재하지만 권한 없음은404/403으로 구분되지만 거부된 응답에는 name/멤버 등 상세가 없다. 타 회사 대상과 부재는404로 합친다. `internal/domain/board/categoryrepo.go:220`

### 6. Response

200: [CategoryDetail](#category-detail) 직접 객체, 세 grant 관계 기본 포함. 404 `NOT_FOUND`,403 `FORBIDDEN` 및 공통 오류. `internal/transport/httpapi/board/categorycrud.go:64` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

트리 조회의 가시성 규칙과 다르다. 부모/회사 관리자여서 can_manage=true여도 is_admin=false일 수 있다. 조회에 알림 upsert·읽음·최근검색어 저장은 없음. `internal/transport/httpapi/board/categorybody.go:118` `internal/domain/board/categoryrepo.go:220`

### 8. 시나리오

```bash
# 정상
curl -i "$SCOPE/categories/$CATEGORY_ID" -H "Authorization: Bearer $BOARD_TOKEN"
# 경계: 정상 UUID 형식의 부재 대상404 NOT_FOUND
curl -i "$SCOPE/categories/00000000-0000-0000-0000-000000000000" -H "Authorization: Bearer $BOARD_TOKEN"
# UUID 문법 오류400 INVALID_PAYLOAD
curl -i "$SCOPE/categories/not-a-uuid" -H "Authorization: Bearer $BOARD_TOKEN"
```


## POST /api/v1/board/companies/{company_id}/users/{user_id}/categories

### 1. 경로

OperationID: `board-create-category`. [`internal/transport/httpapi/board/routes.go:162`](../../internal/transport/httpapi/board/routes.go#L162)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:161`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/categorycrud.go:89`

### 4. Body

| 필드 | 타입/필수 | 기본값 | 검증·상한 |
| --- | --- | --- | --- |
| name | string / 필수 | 없음 | 길이>=1, 비공백 문자 최소1; 최대 길이 없음 |
| parent_category_id | UUID/null / 선택 | null=최상위 | 부재/타회사404, 이미 자식인 부모422 |
| is_active | legacy.Bool / 선택 | true | 공통 Bool; 길이·개수 해당 없음 |
| position | integer/null / 선택 | 동일 부모 live 형제 max+1; 처음1 | 0..2147483647 |
| insert_category_member_user_id | int64[] / 선택 | 추가 없음 | 각 배열 최대20000; 양수 검증 없음 |
| insert_category_admin_user_id | int64[] / 선택 | 추가 없음 | 최대20000; 멤버십 자동 생성 안 함 |
| insert_category_department_id | int64[] / 선택 | 추가 없음 | 최대20000 |

body 필수. 배열은 JSON 숫자 배열이며 숫자 문자열은400, null/[]는 추가 없음. 추가 키는 허용·무시하므로 delete_*와 카테고리 전체 알림 필드를 보내도 효과 없다. `internal/transport/httpapi/board/categorybody.go:213`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

root 생성: 회사 관리자 아니면403. 자식 생성: 부모 부재/삭제/타회사404 → 부모 CanManage false403 → 트랜잭션에서 부모 재조회/잠금 및 2단계 제한422 → grant 대상 필터·생성. 권한 없는 사람은 부모가 이미 자식인지422로 알아낼 수 없다. `internal/transport/httpapi/board/categorycrud.go:119` `internal/domain/board/categorywrite.go:151`

### 6. Response

200(201 아님): [CategoryWrite](#category-write). 422 `CATEGORY_PARENT_IS_CHILD`;404 `NOT_FOUND`;403 `FORBIDDEN`; 그 외 공통 오류. `internal/transport/httpapi/board/categorycrud.go:152` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

UUID는 서버에서 생성한다. name은 trim하지 않으며 비공백 문자만 있으면 앞뒤 공백 저장 가능. 허용집합 밖 grant는200 ignored_*로 보고하므로 저장 완료 UI에서 이를 별도 표시한다. 자동 position 할당은 동시 생성 시 같은 값이 될 수 있고 tree UUID 정렬이 동률을 정리한다. `internal/domain/board/categorywrite.go:151` `internal/domain/board/categorywrite.go:427` `internal/domain/board/categorytree.go:471`

### 8. 시나리오

```bash
# 정상: 회사 관리자 토큰의 root 생성
curl -i -X POST "$SCOPE/categories" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"name":"프론트 테스트","is_active":"1"}'
# 경계: 공백 이름400 INVALID_PAYLOAD
curl -i -X POST "$SCOPE/categories" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"name":"   "}'
# 이미 자식인 CATEGORY_ID를 부모로 지정: 관리권한 통과 후422
curl -i -X POST "$SCOPE/categories" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data "{\"name\":\"3단 시도\",\"parent_category_id\":\"$CATEGORY_ID\"}"
```


## PUT /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}

### 1. 경로

OperationID: `board-update-category`. [`internal/transport/httpapi/board/routes.go:181`](../../internal/transport/httpapi/board/routes.go#L181)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:180`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

`id`: UUID, 필수. 잘못된 UUID는 Huma에서 `400 INVALID_PAYLOAD`; 잘 형식화된 부재·삭제·타 회사 ID는 핸들러에서 `404 NOT_FOUND`. `internal/transport/httpapi/board/categorycrud.go:46`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/categorycrud.go:95`

### 4. Body

| 필드 | 타입/필수 | 생략/null | 검증·상한 |
| --- | --- | --- | --- |
| name | string/null / 선택 | 유지 | 길이>=1, pattern \S; 최대 없음 |
| is_active | legacy.Bool / 선택 | 유지 | 공통 Bool |
| position | integer/null / 선택 | 유지 | 0..2147483647 |
| insert_category_member_user_id | int64[] / 선택 | 아무 변경 없음 | JSON 배열, 각각 최대20000; 양수 검증 없음 |
| delete_category_member_user_id | int64[] / 선택 | 아무 변경 없음 | JSON 배열, 각각 최대20000; 양수 검증 없음 |
| insert_category_admin_user_id | int64[] / 선택 | 아무 변경 없음 | JSON 배열, 각각 최대20000; 양수 검증 없음 |
| delete_category_admin_user_id | int64[] / 선택 | 아무 변경 없음 | JSON 배열, 각각 최대20000; 양수 검증 없음 |
| insert_category_department_id | int64[] / 선택 | 아무 변경 없음 | JSON 배열, 각각 최대20000; 양수 검증 없음 |
| delete_category_department_id | int64[] / 선택 | 아무 변경 없음 | JSON 배열, 각각 최대20000; 양수 검증 없음 |

body 필수, `{}` 허용. 추가 키 허용·무시(`parent_category_id`도 무시되어 이동 안 됨). 배열의 숫자 문자열은400. `internal/transport/httpapi/board/categorybody.go:257`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

대상404 → CanManage403 → 쓰기 트랜잭션의 대상 재조회404 → 부모 유효성·허용집합 검사 → scalar/grant 변경. 부재·타회사404/동일회사 권한 없음403을 구분하고 본문 상세는 반환하지 않는다. `internal/transport/httpapi/board/categorycrud.go:179` `internal/domain/board/categorywrite.go:495`

### 6. Response

200: [CategoryWrite](#category-write). 404 `NOT_FOUND`,403 `FORBIDDEN` 및 공통 오류. 부모 연결이 DB에서 이미 깨진 경우500. `internal/transport/httpapi/board/categorycrud.go:201` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

[권한 전파 규칙](#category-permission)을 반드시 적용한다. scalar가 실제 달라질 때만 category.updated_at 변경, grant-only 변경은 카테고리 updated_at을 바꾸지 않는다. `{}`는 관계 추가/삭제도 하지 않는다. `internal/domain/board/categorywrite.go:362` `internal/domain/board/categorygrants.go:462`

### 8. 시나리오

```bash
# 정상
curl -i -X PUT "$SCOPE/categories/$CATEGORY_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"name":"수정된 이름","position":0}'
# 경계: 알려지지 않은 parent_category_id는200/무시(이동 안 됨)
curl -i -X PUT "$SCOPE/categories/$CATEGORY_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"parent_category_id":"not-a-uuid"}'
# 실제 position 필드의 음수는400
curl -i -X PUT "$SCOPE/categories/$CATEGORY_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"position":-1}'
```


## DELETE /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}

### 1. 경로

OperationID: `board-delete-category`. [`internal/transport/httpapi/board/routes.go:199`](../../internal/transport/httpapi/board/routes.go#L199)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:198`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

`id`: UUID, 필수. 잘못된 UUID는 Huma에서 `400 INVALID_PAYLOAD`; 잘 형식화된 부재·삭제·타 회사 ID는 핸들러에서 `404 NOT_FOUND`. `internal/transport/httpapi/board/categorycrud.go:46`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/categorycrud.go:243`

### 4. Body

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/categorycrud.go:243`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

대상404 → CanManage403 → 트랜잭션 삭제(경쟁으로 없어졌으면404). 삭제 권한은 본인/부모 category 관리자 또는 회사 관리자. 권한 없는 호출자는 동일회사 존재 여부까지만404/403으로 구별하고 내용은 받지 못한다. `internal/transport/httpapi/board/categorycrud.go:249`

### 6. Response

204: body 없음, 성공 필드·관계 없음. 404 `NOT_FOUND`,403 `FORBIDDEN` 및 공통 오류. `internal/transport/httpapi/board/routes.go:202` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

자식 생성이 부모 FOR SHARE를 잡은 뒤 삭제 T1이 대기하면, T1의 기존 statement snapshot에 새 자식이 없어 삭제된 부모 아래 live 자식이 남을 수 있다. 부모 삭제 성공이 동시 생성까지 원자적으로 정리했다는 보장은 아니다. `internal/domain/board/categorydelete.go:92`, `internal/domain/board/categorywrite.go:151`

현재 카테고리+직속 자식, 그 소속 board를 soft-delete한다. board의 멤버/관리자/부서/bookmark/개인설정, live 게시글 및 첨부, 자료실 폴더/파일을 함께 soft-delete하고 게시글·파일에는 delete_user_id를 남긴다. 카테고리 멤버/관리자/부서/개인설정도 삭제한다. 댓글/공감/읽음 등의 모든 하위 테이블을 이 시점에 직접 지우는 것은 아니다. 파일 bytes를 동기 삭제하지 않는다. 카테고리 복원 등록 경로는 없다([전수표](README.md)). `internal/domain/board/categorydelete.go:215` `internal/domain/board/boardstore.go:214`

### 8. 시나리오

```bash
# 삭제해도 되는 테스트 category ID로 실행; 정상204
curl -i -X DELETE "$SCOPE/categories/$CATEGORY_ID" -H "Authorization: Bearer $BOARD_TOKEN"
# 동일 ID 재삭제404 NOT_FOUND
curl -i -X DELETE "$SCOPE/categories/$CATEGORY_ID" -H "Authorization: Bearer $BOARD_TOKEN"
```


## PUT /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}/my-notification

### 1. 경로

OperationID: `board-update-category-notification`. [`internal/transport/httpapi/board/routes.go:494`](../../internal/transport/httpapi/board/routes.go#L494)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:405`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

`id`: UUID, 필수. 잘못된 UUID는 Huma에서 `400 INVALID_PAYLOAD`; 잘 형식화된 부재·삭제·타 회사 ID는 핸들러에서 `404 NOT_FOUND`. `internal/transport/httpapi/board/categorycrud.go:46`

### 3. Query

| 이름 | 타입/필수 | 기본값 | 허용값·파싱·상한 |
| --- | --- | --- | --- |
| is_post_alarm | string / 선택 | ""=미지정 | 정확히 0,1,true,false; 대문자/공백/yes/2는400; 단일값, 배열 아님; 길이 상한 별도 없음 |
| is_comment_alarm | string / 선택 | ""=미지정 | 정확히 0,1,true,false; 대문자/공백/yes/2는400; 단일값, 배열 아님; 길이 상한 별도 없음 |

query가 미지정이면 기존 저장값 유지, 신규 행이면true. 같은 필드에 non-null body가 있으면 body 우선. 잘못된 query는 body로 덮어도 스키마400. `internal/transport/httpapi/board/notification.go:69` `internal/transport/httpapi/board/notification.go:81`

### 4. Body

| 필드 | 타입/필수 | 생략/null | 상한 |
| --- | --- | --- | --- |
| is_post_alarm | legacy.Bool / 선택 | 해당 query로 fallback; 그것도 없으면 기존값/신규true | 공통 Bool, 길이·개수 해당 없음 |
| is_comment_alarm | legacy.Bool / 선택 | 해당 query로 fallback; 그것도 없으면 기존값/신규true | 공통 Bool, 길이·개수 해당 없음 |

body 자체 선택; body 없음/{} 허용. 추가 키는400. `internal/transport/httpapi/board/notification.go:69` `internal/transport/httpapi/board/notification.go:138`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

대상404 → Visible403 → query/body 병합 → 본인 설정 upsert. 카테고리 관리자는 필요 없다. 본인 설정만 갱신하고 타인의 설정이나 리소스 상세를 반환하지 않는다. `internal/transport/httpapi/board/notification.go:252`

### 6. Response

200: 아래 객체. 404 `NOT_FOUND`,403 `FORBIDDEN` 및 공통 오류. `internal/transport/httpapi/board/notification.go:280`

| 필드 | 타입 | null | 저장/계산·관계 |
| --- | --- | --- | --- |
| category_id | string(UUID) | 아니오 | 저장 키 |
| user_id | number(int64) | 아니오 | 저장 키/호출자 |
| is_post_alarm | boolean | 아니오 | 저장된 최종값, 신규true |
| is_comment_alarm | boolean | 아니오 | 저장된 최종값, 신규true |

관계/타임스탬프 필드 없음. 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

부모/자식/게시판 개인 알림으로 전파하지 않는다. UPSERT는 생략 필드를 기존값 유지, 신규는true; soft-delete된 설정도 기존 플래그를 보존하여 복원한다. 빈 요청도 updated_at now. 따라서 bodyless가400이라는 routes.go 설명은 실제 동작과 다르다. `internal/domain/board/notification.go:118` `internal/transport/httpapi/board/notification_test.go:213`

### 8. 시나리오

```bash
# 정상: query-only/bodyless도200
curl -i -X PUT "$SCOPE/categories/$CATEGORY_ID/my-notification?is_post_alarm=0" -H "Authorization: Bearer $BOARD_TOKEN"
# 같은 flag의 body가 query보다 우선: 결과 is_post_alarm=true
curl -i -X PUT "$SCOPE/categories/$CATEGORY_ID/my-notification?is_post_alarm=0" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"is_post_alarm":1}'
# 대문자 query는400 INVALID_PAYLOAD
curl -i -X PUT "$SCOPE/categories/$CATEGORY_ID/my-notification?is_post_alarm=True" -H "Authorization: Bearer $BOARD_TOKEN"
```
