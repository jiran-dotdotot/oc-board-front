# 04. 게시판과 권한 판정

등록 엔드포인트 **7개**. 게시판 목록 탐색은 [카테고리 트리](03-category.md), 순서 변경은 [02 관리](02-management.md), 게시글 공지는 [06 게시글 쓰기](06-post-write.md)를 사용한다. `internal/transport/httpapi/board/routes.go:216`, `internal/transport/httpapi/board/routes.go:236`, `internal/transport/httpapi/board/routes.go:251`, `internal/transport/httpapi/board/routes.go:515`

## 공통 사항

응답 DTO·에러 봉투에는 [Huma 자동 특수필드](README.md#schema-field)를 함께 적용한다. 등록된 최상위 struct 응답에만 `$schema:string`(null 불가, 계산된 URL)와 `Link`가 추가되며 배열·map·빈Body·gin 직접응답에는 없다. 아래 업무 필드 표에 반복하지 않는다. 입력의 추가 키 불허도 framework의 readonly `$schema` 특수키는 예외다. [Huma transforms.go:157](https://github.com/danielgtaylor/huma/blob/v2.39.0/transforms.go#L157)

이 파일의 공통 오류표에406이 열거되어도 현재 router의 기본 format fallback에서는 미지원 Accept가 JSON으로 처리되어 일반적인406 분기가 생기지 않는다. Content-Type 누락·빈값은 JSON 기본이다. [Huma api.go:355](https://github.com/danielgtaylor/huma/blob/v2.39.0/api.go#L355), [defaults.go:79](https://github.com/danielgtaylor/huma/blob/v2.39.0/defaults.go#L79)

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

UUID 형식 오류와 body/query 검증은400이고, 실제 타입/자료실 설정 모순은 handler의422이다. 응답은 상세·쓰기·토글·알림의 직접 객체, 북마크 목록의 페이지 봉투, 삭제204 빈 body로 나뉜다. 오류는 `{"error":{"code":"…","message":"…","details":…}}`(details 생략 가능). `internal/transport/httpapi/board/boards.go:61`, `internal/transport/httpapi/board/boards.go:144`, `internal/transport/httpapi/board/bookmarks.go:82`, `internal/transport/httpapi/humaerr/humaerr.go:18`

`legacy.Bool`: JSON `true`, `false`, `0`, `1`, 문자열 `"0"`, `"1"`, `"true"`, `"false"`, `null`만 통과한다. `"True"`, `"FALSE"`, `"yes"`, `2`, 공백이 붙은 문자열은 `400 INVALID_PAYLOAD`. optional 포인터의 null은 생략처럼 처리한다. `internal/transport/httpapi/legacy/bool.go:110`

날짜는 기본 UTC `YYYY-MM-DDTHH:mm:ss.ffffffZ` 문자열이다. **중첩 Member.disabled_at만 예외**로 KST `YYYY-MM-DD HH:mm:ss[.소수]+09`이며 소수의 뒤쪽 0은 제거한다. board 스키마 날짜 저장 정밀도는 timestamptz(3)이다. 수치 ID는 int64 JSON number, 용량은 byte 정수다. `internal/transport/httpapi/board/dto.go:27`, `internal/transport/httpapi/board/me.go:271`, `internal/transport/httpapi/board/me.go:347`, `migrations/board/000001_initial_schema.sql:290`

| status | error.code | 조건 |
| --- | --- | --- |
| 400 | `INVALID_PAYLOAD` | Huma UUID/query/body/enum/추가 키 검증 실패 |
| 401 | `UNAUTHORIZED` | board 토큰 인증 실패 |
| 403 | `FORBIDDEN` | 경로 범위 또는 읽기/관리/삭제 권한 부족 |
| 404 | `NOT_FOUND` | board 또는 지정 category 부재·soft-delete·타회사 |
| 422 | `BOARD_DRIVE_BOUNDARY` | 최종 non-DRIVE에 자료실 설정을 지정하는 규칙 위반 |
| 500 | `INTERNAL_ERROR` | DB 오류, 기존 category 연결이 깨짐 |
| 503 | `SERVICE_UNAVAILABLE` | deadline/cancel |

근거: `internal/transport/httpapi/board/boards.go:112`, `internal/transport/httpapi/board/boards.go:180`, `internal/transport/httpapi/board/errcode.go:50`, `internal/transport/httpapi/humaerr/humaerr.go:42`, `internal/transport/httpapi/humaerr/humaerr.go:188`. 공통 요청 크기·콘텐츠 타입 오류는 [README](README.md)도 적용된다.

```bash
BASE_URL=${BASE_URL:-http://localhost:8080}
: "${COMPANY_ID:?회사 ID}" "${USER_ID:?사용자 ID}" "${BOARD_TOKEN:?board 토큰}"
SCOPE="$BASE_URL/api/v1/board/companies/$COMPANY_ID/users/$USER_ID"
# 실제 접근 가능한 게시판 UUID를 지정한다.
: "${BOARD_ID:?게시판 UUID}"
```

<a id="permission"></a>
## 권한 판정 규칙 전문

1. 동일 회사의 live 게시판을 먼저 조회한다. UUID가 존재해도 타 회사/soft-delete면 부재와 동일한404다. 성공적으로 찾은 뒤 읽기/관리 조건을 평가하므로 동일 회사에 존재하지만 권한이 없으면403이다. 거절 시 게시판 이름·타입·grant 목록·사용 용량은 반환하지 않는다. `internal/domain/board/permissionquery.go:139`, `internal/domain/board/boarddetail.go:143`
2. 권한 신호를 계산한다. 회사 관리자는 live `board.company_admins`; 게시판 관리자는 live `board.board_admins`; 카테고리 관리자는 게시판의 live 카테고리 또는 그 live 부모 카테고리의 관리자(1홉). 직접 카테고리 멤버는 게시판 자신의 category_id에 있는 live grant만 인정하고 부모 멤버를 자동 상속하지 않는다. board 멤버·부서 grant는 live 행만 사용한다. 신호의 회사 범위는 모두 호출자 회사다. `internal/domain/board/permissionquery.go:81`, `internal/domain/board/permissionquery.go:105`
3. 부서 신호는 호출자의 live·활성 `public.members` 소속에서 closure의 조상(자기 자신 포함)을 모아 live·동일회사 부서와 교차한다. 여러 부서가 일치하면 존재 여부와 read/write 값 각각을 OR한다. 부서 `disabled_at`은 필터하지 않는다. `internal/domain/board/permissionquery.go:66`, `internal/domain/board/permissionquery.go:115`
4. `category_id=null`인 공용 게시판 **또는** 회사 관리자이면 Read=true, Write=true다. 관리자 표시 플래그는 별도로 계산하므로 공용 게시판 접근권이 관리자 권한을 뜻하지 않는다. `internal/domain/board/permission.go:128`
5. 나머지는 아래 표를 읽기와 쓰기에 각각 적용한다. `read_permission`과 `write_permission`은 독립이므로 read=false/write=true 조합도 계산 가능하다. `internal/domain/board/permission.go:142`

| 모드 | Read 조건 | Write 조건 |
| --- | --- | --- |
| `ALL` | 직접 category 멤버 OR board 관리자 OR board 멤버 행 존재 OR category 관리자 OR board 부서 grant 존재 | 같은 존재 조건; writable=false여도 행 존재면 통과 |
| `ADMIN` | board 관리자 OR category 관리자 | 같은 조건 |
| `MEMBER` | board 관리자 OR category 관리자 OR (board 멤버 존재 AND is_readable) OR (일치 부서 존재 AND bool_or(is_readable)) | 같은 구조에서 is_writable 사용 |
| 기타 값 | false | false |

근거: `internal/domain/board/permission.go:154`; 허용 DB enum은 `migrations/board/000001_initial_schema.sql:294`. `ALL`은 전사 공개가 아니며 MEMBER와 달리 멤버/부서 방향 플래그를 무시한다. 카테고리 멤버라는 사실만으로 MEMBER 모드는 통과하지 않는다.

6. 일반 관리(게시판 PUT)는 `CanManage = board 관리자 OR category 관리자 OR 회사 관리자`. **삭제는 더 좁게 category 관리자 OR 회사 관리자**다. 따라서 `can_manage=true`는 삭제 가능의 충분조건이 아니다. 공용 게시판은 category 관리자가 없으므로 회사 관리자만 삭제한다. `internal/domain/board/permission.go:24`, `internal/transport/httpapi/board/boards.go:239`
7. 게시판 생성은 공용이면 회사 관리자, category가 있으면 그 category의 CanManage(직접/부모 category 관리자 또는 회사 관리자)다. 리소스 생성자 `user_id`는 특별 권한을 만들지 않는다. `internal/transport/httpapi/board/boards.go:112`, `internal/domain/board/permission.go:128`
8. `is_active`는 권한 게이트에 포함되지 않는다. 목록·트리가 노출을 걸러낼 뿐, 비활성 board도 권한을 갖고 ID를 알면 상세/편집/토글/알림을 호출할 수 있다. category가 삭제된 비정상 연결에서는 board의 원래 category_id를 참조하는 직접 멤버 신호와 live category가 필요한 관리자 신호가 다를 수 있다. `internal/domain/board/permissionquery.go:81`, `internal/domain/board/permissionquery.go:105`, `internal/domain/board/permission.go:128`

<a id="grant-rules"></a>
## 게시판 권한 지정(쓰기 body) 규칙

분류된 board의 멤버/관리자 추가는 **자신의 category**를 기준으로: 직접 category 멤버 + category 지정 부서와 자손 부서의 live·활성 소속 사용자 중 동일회사 존재 사용자만 허용한다. 부서 추가는 category 지정 부서와 자손 중 live 동일회사만 허용한다. 허용집합이 비어 있으면 추가 허용 대상도 없다. category 관리자라는 사실만으로 추가 대상에 자동 포함되지 않는다. 공용 board의 사용자 관리자 추가는 동일 회사 존재 여부만 확인하고, 멤버/부서 추가·삭제 목록은 아예 무시하며 ignored에도 보고하지 않는다. `internal/domain/board/allowedtargets.go:66`, `internal/domain/board/allowedtargets.go:103`, `internal/domain/board/boardgrants.go:235`

순서는 멤버 삭제→멤버 추가→관리자 삭제(멤버 삭제 대상 ∪ 명시 관리자 삭제 대상)→관리자 추가→부서 삭제→부서 추가다. 멤버/부서 각각은 추가가 이기지만 멤버 재추가가 관리자 권한까지 복원하지는 않는다. 관리자를 유지하려면 명시 관리자 추가도 보내야 한다. 관리자 추가는 멤버십을 자동 생성하지 않는다. 신규 board 멤버/부서의 is_readable/is_writable은 true이고 기존 grant를 갱신하면 기존 방향 플래그를 유지한다. 부재/권한 범위 밖 삭제 ID는 무시, 거부된 **추가**만 ignored_*에 중복 제거·정렬하여 보고한다. `internal/domain/board/boardgrants.go:235`, `internal/domain/board/boardgrants.go:315`, `migrations/board/000001_initial_schema.sql:323`, `migrations/board/000001_initial_schema.sql:363`

## 공유 DTO 필드 표

<a id="board-columns"></a>
### BoardColumns — 조회·쓰기 공통 저장 필드

| 필드 | 타입 | null | 저장/계산·값 |
| --- | --- | --- | --- |
| id | string(UUID) | 아니오 | 저장; 생성 서버 UUID |
| company_id | number(int64) | 아니오 | 저장 |
| category_id | string(UUID) | 예 | 저장; null이면 공용 |
| user_id | number(int64) | 예 | 저장; 생성자 |
| type | string | 아니오 | 저장; BOARD/PREVIEW/ALBUM/DRIVE |
| title | string | 아니오 | 저장 |
| description | string | 아니오 | 저장; 기본 "" |
| position | number(integer) | 아니오 | 저장; int32 >=0 |
| is_active | boolean | 아니오 | 저장; 기본true |
| read_permission | string | 아니오 | 저장; ALL/ADMIN/MEMBER, 기본ALL |
| write_permission | string | 아니오 | 저장; ALL/ADMIN/MEMBER, 기본ALL |
| is_post_alarm | boolean | 아니오 | 저장; 게시판 전체 글 알림, 기본true |
| is_notice_alarm | boolean | 아니오 | 저장; 게시판 전체 공지 알림, 기본true |
| size_limit | number(int64) | 예 | 저장 byte; null은 전체 한도 없음 |
| size_limit_per_file | number(int64) | 예 | 저장 byte; null은 업로드 앱 기본 한도 사용([09](09-drive-file.md)) |
| except_extension | string[] | 아니오 | 저장; 기본 []; 대문자 정규화 |
| created_at | string | 아니오 | 저장 UTC |
| updated_at | string | 아니오 | 저장 UTC |
| deleted_at | string | 예 | 저장 UTC; live board null |

근거: `internal/transport/httpapi/board/boardsbody.go:35`, `internal/transport/httpapi/board/boardwritebody.go:308`, `migrations/board/000001_initial_schema.sql:267`. `is_comment_alarm`이라는 게시판 전체 컬럼/응답 키는 없다. 업로드 한도의 실제 적용은 [자료실 파일](09-drive-file.md)을 함께 적용한다. `internal/transport/httpapi/board/boardsbody.go:53`

<a id="board-view"></a>
### BoardView — BoardColumns + 아래 필드

| 필드 | 타입 | null | 저장/계산·기본값 |
| --- | --- | --- | --- |
| is_writable | boolean | 아니오 | 계산: 권한 규칙 Write |
| is_board_admin | boolean | 아니오 | 계산: 직접 board 관리자 |
| is_category_admin | boolean | 아니오 | 계산: board의 category 또는 부모 category 관리자 |
| can_manage | boolean | 아니오 | 계산: board/category/회사 관리자 OR |
| is_bookmark | boolean | 아니오 | 계산: 본인 live 북마크 존재 |
| is_public | boolean | 아니오 | 계산: category_id=null |
| is_drive | boolean | 아니오 | 계산: type=DRIVE |
| is_admin | boolean | 아니오 | 계산: board 관리자 OR category 관리자; 회사 관리자만이면false |
| is_board_member_post_alarm | boolean | 아니오 | 본인 board_user_settings 저장값; 행 없으면true |
| is_board_member_notice_alarm | boolean | 아니오 | 같음 |
| is_board_member_comment_alarm | boolean | 아니오 | 같음 |

BoardView 자체는 중첩 category/user/관리자/멤버 관계를 포함하지 않는다. `is_readable`/`is_company_admin`도 없다. category 트리, 북마크, 상세의 공통 뷰이고 grant 관계는 상세에만 추가된다. `internal/transport/httpapi/board/boardsbody.go:71`, `internal/transport/httpapi/board/boardsbody.go:121`

<a id="board-detail"></a>
### BoardDetail — BoardView + 아래 필드

| 필드 | 타입 | null | 저장/계산·기본 관계 |
| --- | --- | --- | --- |
| board_admins | BoardUserGrant[] | 아니오 | 기본 eager; live grant, user_id 오름차순 |
| board_members | BoardUserGrant[] | 아니오 | 기본 eager; live grant, user_id 오름차순 |
| board_departments | BoardDepartmentGrant[] | 아니오 | 기본 eager; live grant, department_id 오름차순 |
| total_usage_size | number(int64) | 아니오 | 계산 byte; DRIVE의 live ACT 파일 size 합계, non-DRIVE=0 |

근거: `internal/transport/httpapi/board/boardsbody.go:232`, `internal/domain/board/boarddetail.go:143`, `internal/domain/board/boardstore.go:64`. 파일 bytes를 저장소에서 재측정하지 않고 DB size를 합산한다.

### BoardUserGrant

| 필드 | 타입 | null | 저장/계산·포맷 |
| --- | --- | --- | --- |
| board_id | string(UUID) | 아니오 | 저장 |
| company_id | number(int64) | 아니오 | 저장 |
| user_id | number(int64) | 아니오 | 저장 |
| is_readable | boolean | 예 | 멤버 저장값; 관리자 행은 컬럼이 없어null |
| is_writable | boolean | 예 | 같음 |
| created_at | string | 아니오 | 저장 UTC |
| updated_at | string | 예 | 멤버 저장 UTC; 관리자 컬럼 없어null |
| deleted_at | string | 예 | 저장 UTC; 반환 live grant null |
| user | [GrantUser](#grant-user) | 예 | 기본 eager; 부재/타회사 user null |

### BoardDepartmentGrant

| 필드 | 타입 | null | 저장/계산·포맷 |
| --- | --- | --- | --- |
| board_id | string(UUID) | 아니오 | 저장 |
| department_id | number(int64) | 아니오 | 저장 |
| is_readable | boolean | 아니오 | 저장 |
| is_writable | boolean | 아니오 | 저장 |
| created_at | string | 아니오 | 저장 UTC |
| updated_at | string | 아니오 | 저장 UTC |
| deleted_at | string | 예 | 저장 UTC; 반환 live grant null |
| department | [GrantDepartment](#grant-department) | 예 | 기본 eager; 부재/삭제/타회사 department null |

두 grant 타입에 surrogate `id`는 없고 부서 grant에는 company_id도 없다. nullable 관계여도 grant 자체는 응답에 남아 권한 철회 대상으로 쓸 수 있다. `internal/transport/httpapi/board/boardsbody.go:265`, `internal/transport/httpapi/board/boardsbody.go:288`

<a id="grant-user"></a>
### GrantUser — 카테고리·게시판 grant의 공통 사용자

| 필드 | 타입 | null | 저장/계산·관계/포맷 |
| --- | --- | --- | --- |
| id | number(int64) | 아니오 | public.users 저장 |
| name | string | 예 | 저장 이름 + 상태 접미사 계산 |
| profile_image_id | string | 예 | 저장 |
| disabled_at | string | 예 | 저장 UTC; /me 최상위 disabled_at과 형식 다름 |
| deleted_at | string | 예 | 저장 UTC |
| profile_src | string | 예 | 설정과 profile_image_id로 계산한 URL |
| member | [Member](#member) | 예 | 기본 eager; live 기본 소속 첫 id, 없으면null |

user는 동일회사만 join하고 퇴사(soft-delete) 사용자는 제외하지 않는다. name은 퇴사 시 `(퇴직)`/`(Retired)`/`(退職)`, 중지 시 `(중지)`/`(Suspended)`/`(中止)` 접미사(ko/en/ja)를 붙인다. 둘 다 있으면 퇴사 우선; 원래 name=null이라도 접미사는 반환한다. profile_src는 host 없거나 image ID가 없거나 빈 값/중지 사용자면 null. 그렇지 않으면 `host + /image/resize/s?image_url= + folder + /user/profile/ + imageID + /profile_image.png`이며 URL 인코딩은 추가하지 않는다. 퇴사만으로 profile_src를 없애지는 않는다. `internal/domain/board/grantuser.go:134`, `internal/transport/httpapi/board/grantview.go:53`, `internal/transport/httpapi/board/me.go:172`, `internal/transport/httpapi/board/me.go:213`, `internal/transport/httpapi/board/me.go:323`

<a id="member"></a>
### Member

| 필드 | 타입 | null | 저장/계산·관계/포맷 |
| --- | --- | --- | --- |
| id | number(int64) | 아니오 | public.members 저장 |
| company_id | number(int64) | 아니오 | 저장 |
| department_id | number(int64) | 아니오 | 저장 |
| user_id | number(int64) | 아니오 | 저장 |
| rank_id | number(int64) | 예 | 저장 |
| role_id | number(int64) | 예 | 저장; role 관계 없음 |
| position | number(integer) | 아니오 | 저장 |
| default | boolean | 아니오 | 저장; 선택된 기본 소속 true |
| leader | boolean | 아니오 | 저장 |
| disabled_at | string | 예 | 저장 → KST rawTime: YYYY-MM-DD HH:mm:ss[.소수]+09 |
| sync_id | number(int64) | 예 | 저장 |
| created_at | string | 예 | 저장 UTC |
| updated_at | string | 예 | 저장 UTC |
| deleted_at | string | 예 | 저장 UTC; live 소속만 선택 |
| department | MemberDepartment | 예 | 기본 eager; 동일회사 live 부서 |
| rank | Rank | 예 | 기본 eager; 동일회사 live 직급 |

기본 소속 조회는 disabled_at을 배제하지 않는다. 여러 기본 소속이면 live 중 id 오름차순 첫 행이다. `internal/domain/board/grantuser.go:134`, `internal/transport/httpapi/board/dto.go:187`, `internal/transport/httpapi/board/me.go:333`

### MemberDepartment / Rank

| 객체.필드 | 타입 | null | 저장/계산·관계 |
| --- | --- | --- | --- |
| MemberDepartment.id | number(int64) | 아니오 | 저장 |
| MemberDepartment.parent_id | number(int64) | 예 | 저장 |
| MemberDepartment.name | string | 아니오 | 저장 |
| MemberDepartment.path | string | 예 | 저장 |
| MemberDepartment.position | number(integer) | 아니오 | 저장 |
| Rank.id | number(int64) | 아니오 | 저장 |
| Rank.name | string | 아니오 | 저장 |

더 깊은 eager 관계 없음. `internal/transport/httpapi/board/dto.go:209`, `internal/transport/httpapi/board/me.go:353`

<a id="grant-department"></a>
### GrantDepartment

| 필드 | 타입 | null | 저장/계산·관계 |
| --- | --- | --- | --- |
| id | number(int64) | 아니오 | public.departments 저장 |
| name | string | 아니오 | 저장 |
| path | string | 예 | 저장 |

추가 eager 관계 없음. `internal/transport/httpapi/board/grantview.go:39`

<a id="board-write"></a>
### BoardWrite — BoardColumns + 아래 필드

| 필드 | 타입 | null | 저장/계산 |
| --- | --- | --- | --- |
| is_public | boolean | 아니오 | 계산 category_id=null |
| is_drive | boolean | 아니오 | 계산 type=DRIVE |
| is_admin | boolean | 아니오 | 계산이지만 쓰기 응답에서는 zero Permission을 넣어 항상false |
| ignored_user_ids | number(int64)[] | 아니오 | 계산; 거부된 추가 멤버/관리자 ID 합집합, 중복 제거·오름차순 |
| ignored_department_ids | number(int64)[] | 아니오 | 계산; 거부된 추가 부서 ID, 중복 제거·오름차순 |

관계 eager load/권한·북마크·개인 알림 플래그 없음. 저장 후 권한 UI를 업데이트할 때 BoardWrite로 기존 BoardView를 통째로 교체하지 말고 상세를 다시 읽는다. `internal/transport/httpapi/board/boardwritebody.go:308`, `internal/transport/httpapi/board/boardwritebody.go:490`

BoardView.is_writable은 게시판 Write 권한이고 게시글 is_writable/is_mine은 작성자 여부다. 새 글 작성 버튼과 기존 글 편집 버튼의 판정을 섞지 않는다. `internal/transport/httpapi/board/boardsbody.go:184`, `internal/domain/board/postdetailquery.go:233`, `internal/transport/httpapi/board/postdetailbody.go:314`


`BOARD_DRIVE_BOUNDARY`의 현재 영문 메시지는 `A drive-only setting requires a drive board, and the drive type cannot be changed.`다. 실제 구현에서는 유형 전환을 허용하는 경우가 있으므로 `cannot be changed` 문구는 현재 판정과 맞지 않는다. 메시지 문장으로 분기하지 않고 code와 이 문서의 조건을 따른다. `internal/transport/httpapi/board/boards.go:141`, `internal/transport/httpapi/board/boards.go:188`, `internal/domain/board/boardwrite.go:353`

## ⚠️ 이 도메인의 함정

- `ALL`은 전사 공개가 아니다. 공용은 category_id=null이고 `is_public`을 보내는 것으로 바뀌지 않는다. `internal/domain/board/permission.go:154`, `internal/transport/httpapi/board/boardwritebody.go:136`
- 읽기 응답 `is_admin`은 회사 관리자를 포함하지 않는다. 쓰기 응답 is_admin은 항상false다. 편집은 can_manage, 삭제는 별도 좁은 규칙을 적용한다. `internal/transport/httpapi/board/boardsbody.go:121`, `internal/transport/httpapi/board/boardwritebody.go:490`, `internal/transport/httpapi/board/boards.go:239`
- PUT type은 DRIVE를 포함하여 네 타입 사이 변경 가능하다. routes.go:278의 DRIVE 경계 변경 불허 설명은 구현과 다르다. non-DRIVE로 바꾸면 자료실 설정을 비우며 기존 파일을 변환·삭제하지 않는다. `internal/domain/board/boardwrite.go:353`, `internal/domain/board/boardwritequery.go:329`
- POST에서는 non-DRIVE + size_limit:null/0/-1이 통과하지만 PUT에서는 해당 key를 명시한 것만으로422다. `internal/transport/httpapi/board/boardwritebody.go:412`, `internal/domain/board/boardwrite.go:353`
- is_post_alarm/is_notice_alarm은 board 전체 설정, is_board_member_*는 본인 설정이다. plain is_comment_alarm은 생성에서 무시, PUT에서400이며 개인 알림 endpoint에는 유효하다. `internal/transport/httpapi/board/boardwritebody.go:105`, `internal/transport/httpapi/board/boardwritebody.go:184`, `internal/transport/httpapi/board/notification.go:215`
- 북마크는 토글이라 재시도가 상태를 되돌린다. 목록은 페이지당20 기본, 상한 없으며 전체 북마크를 메모리에 읽고 페이지를 자른다. `internal/domain/board/bookmark.go:145`, `internal/transport/httpapi/board/bookmarks.go:140`


## GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}

### 1. 경로

OperationID: `board-get-board`. [`internal/transport/httpapi/board/routes.go:217`](../../internal/transport/httpapi/board/routes.go#L217)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:216`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

`id`: UUID, 필수. 잘못된 UUID는 Huma에서 `400 INVALID_PAYLOAD`; 잘 형식화된 부재·삭제·타 회사 ID는 핸들러에서 `404 NOT_FOUND`. `internal/transport/httpapi/board/boards.go:37`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/boards.go:37`

### 4. Body

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/boards.go:37`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

대상404 → Read403 → grant 세 관계 + DRIVE 사용용량 조회. 거절되면 관계와 용량을 계산/공개하지 않는다. 회사 외 ID는 부재와 구분할 수 없다. `internal/domain/board/boarddetail.go:143`

### 6. Response

200: [BoardDetail](#board-detail) 직접 객체. 404 `NOT_FOUND`,403 `FORBIDDEN`, 나머지 공통 오류. `internal/transport/httpapi/board/boards.go:61` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

Read 조건만 사용하므로 비활성 board도 읽을 수 있다. 용량은 ACT/live 파일 DB 합계이며 UPLOADING/FAIL/휴지통은 제외된다. 읽음·최근검색어·개인 알림 저장 부수효과/핸들러 캐시는 없다. 관계 조회가 여러 statement여서 동시 권한 변경 사이 결과 차이는 가능하다. `internal/domain/board/boarddetail.go:143` `internal/domain/board/boardstore.go:64`

### 8. 시나리오

```bash
# 정상
curl -i "$SCOPE/boards/$BOARD_ID" -H "Authorization: Bearer $BOARD_TOKEN"
# 정상 UUID지만 부재이면404
curl -i "$SCOPE/boards/00000000-0000-0000-0000-000000000000" -H "Authorization: Bearer $BOARD_TOKEN"
# 형식부터 틀리면400
curl -i "$SCOPE/boards/not-a-uuid" -H "Authorization: Bearer $BOARD_TOKEN"
```


## GET /api/v1/board/companies/{company_id}/users/{user_id}/bookmarks

### 1. 경로

OperationID: `board-list-bookmarks`. [`internal/transport/httpapi/board/routes.go:237`](../../internal/transport/httpapi/board/routes.go#L237)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:236`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

### 3. Query

| 이름 | 타입/필수 | 기본값 | 허용값·파싱·상한 |
| --- | --- | --- | --- |
| take | integer / 선택 | 20 | >=1; 최대값 태그 없음(Go int 파싱 범위). 0/음수/소수/문자400 |
| page | integer / 선택 | 1 | >=1; 최대값 태그 없음(Go int 파싱 범위). 0/음수/소수/문자400 |

단일 값이며 배열 표기 없음. int 파라미터는 정수 파싱이고 enum 없음; limit 필드는 없음. `internal/transport/httpapi/board/bookmarks.go:43`

### 4. Body

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/bookmarks.go:43`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

본인 live 북마크 중 동일 회사 live·활성 board를 조회하고 각 BoardPermission.Read로 필터한 뒤 페이징한다. 권한 없는 board는 개별403이 아니라 data/total 모두에서 제외된다. `internal/domain/board/bookmark.go:71` `internal/domain/board/bookmark.go:165`

### 6. Response

200: 아래 페이지 봉투. data 원소는 [BoardView](#board-view)에 `board_id`(string UUID, non-null, 계산 별칭 id와 동일)를 더한다. eager grant 목록 없음. `internal/transport/httpapi/board/bookmarks.go:62`

| 필드 | 타입 | null | 계산/포맷 |
| --- | --- | --- | --- |
| data | BookmarkedBoardView[] | 아니오 | 접근 가능한 페이지 결과; 없으면[] |
| current_page | number(integer) | 아니오 | 요청 page |
| last_page | number(integer) | 아니오 | ceil(total/per_page), 최소1 |
| per_page | number(integer) | 아니오 | 요청 take |
| total | number(int64) | 아니오 | 권한/활성 필터 후 전체 개수 |

공통 오류만 있으며 per-resource404 없음. `internal/transport/httpapi/board/bookmarks.go:169` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

bookmark.updated_at 오름차순, 동률 board_id 오름차순. 껐다 켜면 마지막으로 이동하며 board.position 정렬이 아니다. 전체를 DB에서 읽고 메모리 페이징한다. 마지막 페이지 뒤는200 data[]. 상한 검증이 없고 `(page-1)*take`의 int overflow 방어가 없으므로 프론트는 실제 last_page 범위의 작은 정수만 사용한다. `internal/domain/board/bookmark.go:71` `internal/transport/httpapi/board/bookmarks.go:161`

### 8. 시나리오

```bash
# 정상/경계: 첫 페이지 1개
curl -i "$SCOPE/bookmarks?take=1&page=1" -H "Authorization: Bearer $BOARD_TOKEN"
# 허용 최소 바로 아래400 INVALID_PAYLOAD
curl -i "$SCOPE/bookmarks?take=0&page=1" -H "Authorization: Bearer $BOARD_TOKEN"
# 범위 밖 페이지(해당 사용자의 북마크가 충분히 적다면)200 data[]
curl -i "$SCOPE/bookmarks?take=20&page=9999" -H "Authorization: Bearer $BOARD_TOKEN"
```


## POST /api/v1/board/companies/{company_id}/users/{user_id}/boards

### 1. 경로

OperationID: `board-create-board`. [`internal/transport/httpapi/board/routes.go:252`](../../internal/transport/httpapi/board/routes.go#L252)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:251`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/boards.go:90`

### 4. Body

| 필드 | 타입/필수 | 생략/null 기본값 | 검증·상한 |
| --- | --- | --- | --- |
| type | string / 필수 | 없음 | BOARD/PREVIEW/ALBUM/DRIVE 전수; 대소문자 구분 |
| title | string / 필수 | 없음 | 길이>=1, pattern \S; 최대 없음 |
| category_id | UUID/null / 선택 | null=공용 | 공용은 회사 관리자만 생성 |
| read_permission | string/null / 선택 | ALL | ALL/ADMIN/MEMBER |
| write_permission | string/null / 선택 | ALL | ALL/ADMIN/MEMBER |
| description | string/null / 선택 | "" | 길이 상한 없음 |
| is_active | legacy.Bool / 선택 | true | 공통 Bool |
| is_post_alarm | legacy.Bool / 선택 | true | 공통 Bool |
| is_notice_alarm | legacy.Bool / 선택 | true | 공통 Bool |
| position | integer/null / 선택 | 동일category live형제 max+1, 처음1 | 0..2147483647 |
| size_limit | int64/null / 선택 | null=전체 한도 없음 | <=0은 전부null; 양수 byte; int64 최대 |
| size_limit_per_file | int64/null / 선택 | null=업로드 앱 기본값 | <=0은 전부null; 양수 byte; int64 최대 |
| except_extension | string[] / 선택 | [] | 길이/개수 상한 없음; 각 문자열 대문자화 |
| is_public | legacy.Bool / 선택 | 효과 없음 | 공통 Bool 검증만 수행 |
| is_drive | legacy.Bool / 선택 | 효과 없음 | 공통 Bool 검증만 수행 |
| insert_board_member_user_id | int64[] / 선택 | 추가 없음 | 각 배열 최대20000; 양수 검증 없음 |
| insert_board_admin_user_id | int64[] / 선택 | 추가 없음 | 각 배열 최대20000; 양수 검증 없음 |
| insert_board_department_id | int64[] / 선택 | 추가 없음 | 각 배열 최대20000; 양수 검증 없음 |

body 필수. grant 배열은 JSON 숫자 배열(숫자 문자열400), null/[]는 추가 없음. unknown 키는 허용·무시한다. delete_*와 is_comment_alarm도 무시하며 is_public/is_drive는 선언되어 있으므로 값이 잘못되면400이다. 크기 필드의 숫자 문자열은400. `internal/transport/httpapi/board/boardwritebody.go:105` `internal/transport/httpapi/board/boardwritebody.go:412`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

공용이면 회사 관리자403; 분류된 board면 category404 → category CanManage403 → 트랜잭션 생성/자료실 설정 규칙422/허용집합 필터. non-DRIVE에 **정규화 뒤 양수 limit 또는 nonempty except_extension**이 남으면422. 권한 없는 호출자에게 자료실 규칙 위반 여부를422로 먼저 노출하지 않는다. `internal/transport/httpapi/board/boards.go:112` `internal/domain/board/boardwrite.go:158`

### 6. Response

200(201 아님): [BoardWrite](#board-write). 422 `BOARD_DRIVE_BOUNDARY`,404 `NOT_FOUND`,403 `FORBIDDEN`, 그 외 공통 오류. `internal/transport/httpapi/board/boards.go:144` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

[권한 지정 규칙](#grant-rules)을 적용한다. title/description은 trim하지 않는다. except_extension은 대문자화만 하므로 `.exe`→`.EXE`, ` exe `→` EXE `이며 점/공백 제거·중복 제거 없음. 부분 grant 거부도200이므로 ignored_*를 읽는다. 자동position은 동시 생성 시 동률 가능. `internal/domain/board/boards.go:135` `internal/domain/board/boardwrite.go:158`

### 8. 시나리오

```bash
# 정상: 회사 관리자 공용 BOARD. 기본 read/write ALL
curl -i -X POST "$SCOPE/boards" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"type":"BOARD","title":"프론트 테스트","size_limit":-1}'
# 경계: 같은 non-DRIVE에 양수 limit은 권한 통과 후422 BOARD_DRIVE_BOUNDARY
curl -i -X POST "$SCOPE/boards" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"type":"BOARD","title":"잘못된 한도","size_limit":1}'
# 필수 type 누락은 권한 검사 이전400
curl -i -X POST "$SCOPE/boards" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"title":"타입 없음"}'
```


## PUT /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}

### 1. 경로

OperationID: `board-update-board`. [`internal/transport/httpapi/board/routes.go:271`](../../internal/transport/httpapi/board/routes.go#L271)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:270`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

`id`: UUID, 필수. 잘못된 UUID는 Huma에서 `400 INVALID_PAYLOAD`; 잘 형식화된 부재·삭제·타 회사 ID는 핸들러에서 `404 NOT_FOUND`. `internal/transport/httpapi/board/boards.go:37`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/boards.go:95`

### 4. Body

| 필드 | 타입/필수 | 생략/null 기본 동작 | 검증·상한 |
| --- | --- | --- | --- |
| title | string/null / 선택 | 유지 | 길이>=1, pattern \S; 최대 없음 |
| description | string/null / 선택 | 유지; ""는 지움 | 길이 상한 없음 |
| is_active | legacy.Bool / 선택 | 유지 | 공통 Bool |
| is_post_alarm | legacy.Bool / 선택 | 유지 | 공통 Bool |
| is_notice_alarm | legacy.Bool / 선택 | 유지 | 공통 Bool |
| read_permission | string/null / 선택 | 유지 | ALL/ADMIN/MEMBER |
| write_permission | string/null / 선택 | 유지 | ALL/ADMIN/MEMBER |
| position | integer/null / 선택 | 유지 | 0..2147483647 |
| type | string/null / 선택 | 유지 | BOARD/PREVIEW/ALBUM/DRIVE |
| size_limit | int64/null / 선택 | 생략 유지; null/<=0은 한도 초기화 | 양수 byte, int64 범위 |
| size_limit_per_file | int64/null / 선택 | 생략 유지; null/<=0은 앱 기본값 | 양수 byte, int64 범위 |
| except_extension | string[]/null / 선택 | 생략/null 유지; []는 지움 | 길이/개수 상한 없음; 대문자화만 |
| is_public | legacy.Bool / 선택 | 무시 | 공통 Bool 검증만 |
| is_drive | legacy.Bool / 선택 | 무시 | 공통 Bool 검증만 |
| insert_board_member_user_id | int64[] / 선택 | 변경 없음 | 각 배열 최대20000; JSON 숫자 배열 |
| delete_board_member_user_id | int64[] / 선택 | 변경 없음 | 각 배열 최대20000; JSON 숫자 배열 |
| insert_board_admin_user_id | int64[] / 선택 | 변경 없음 | 각 배열 최대20000; JSON 숫자 배열 |
| delete_board_admin_user_id | int64[] / 선택 | 변경 없음 | 각 배열 최대20000; JSON 숫자 배열 |
| insert_board_department_id | int64[] / 선택 | 변경 없음 | 각 배열 최대20000; JSON 숫자 배열 |
| delete_board_department_id | int64[] / 선택 | 변경 없음 | 각 배열 최대20000; JSON 숫자 배열 |

body 필수, `{}` 허용. **추가 키 불허400**, category_id/is_comment_alarm도400. 배열 상한 외 전체개수 제한 없음. 타입·enum·숫자 문자열 잘못된 값은400. `internal/transport/httpapi/board/boardwritebody.go:184`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

대상404 → CanManage403 → 트랜잭션 대상 재조회404 → category 연결 검사/자료실 설정 규칙422 → 갱신/권한 지정. board 관리자는 편집 가능하다. non-DRIVE가 최종 type이면 **limit key를 null/0/-1로라도 명시**하거나 nonempty except_extension을 보내면422. 최종 DRIVE이면 정상 한도를 반영한다. `internal/transport/httpapi/board/boards.go:180` `internal/domain/board/boardwrite.go:353`

### 6. Response

200: [BoardWrite](#board-write). 422 `BOARD_DRIVE_BOUNDARY`,404 `NOT_FOUND`,403 `FORBIDDEN` 및 공통 오류. 깨진 기존 category 연결은500. `internal/transport/httpapi/board/boards.go:202` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

type을 DRIVE로/DRIVE에서 변경할 수 있다. DRIVE를 벗어나면 저장 limit 두 개=null, except_extension=[]로 정리하지만 이미 저장된 파일/폴더·게시글을 옮기거나 지우지 않는다. scalar가 실제 바뀔 때만 board.updated_at 갱신, grant-only 변경은 board 시각을 바꾸지 않는다. [권한 지정 순서](#grant-rules)의 멤버/관리자 재추가 차이를 적용한다. `internal/domain/board/boardwritequery.go:329` `internal/domain/board/boardwritequery.go:356` `internal/domain/board/boardgrants.go:315`

### 8. 시나리오

```bash
# 정상: 실제 테스트 게시판을 DRIVE로 변경(타입 변경 가능)
curl -i -X PUT "$SCOPE/boards/$BOARD_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"type":"DRIVE","size_limit":null}'
# 같은 한도 key를 최종 BOARD에 보내면422, 변경 전체 롤백
curl -i -X PUT "$SCOPE/boards/$BOARD_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"type":"BOARD","size_limit":null}'
# 한도 key 생략하고 BOARD로 바꾸면200/저장 한도 초기화
curl -i -X PUT "$SCOPE/boards/$BOARD_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"type":"BOARD"}'
# category 이동 key는400
curl -i -X PUT "$SCOPE/boards/$BOARD_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"category_id":null}'
```


## DELETE /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}

### 1. 경로

OperationID: `board-delete-board`. [`internal/transport/httpapi/board/routes.go:291`](../../internal/transport/httpapi/board/routes.go#L291)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:290`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

`id`: UUID, 필수. 잘못된 UUID는 Huma에서 `400 INVALID_PAYLOAD`; 잘 형식화된 부재·삭제·타 회사 ID는 핸들러에서 `404 NOT_FOUND`. `internal/transport/httpapi/board/boards.go:37`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/boards.go:227`

### 4. Body

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/boards.go:227`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

대상404 → 회사 관리자 OR category 관리자 여부403 → 트랜잭션 삭제404(경쟁). board 관리자 단독으로는403이다. 존재한 동일회사 board를 알 수 있지만 거절 시 상세는 반환하지 않는다. `internal/transport/httpapi/board/boards.go:227`

### 6. Response

204: body/성공 필드/관계 없음. 404 `NOT_FOUND`,403 `FORBIDDEN` 및 공통 오류. `internal/transport/httpapi/board/routes.go:294` 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

이 요청은 S3 삭제 잡을 발행하지 않고 purged_at도 설정하지 않는다. board_admins에는 updated_at 컬럼이 없어 deleted_at만 갱신한다. `internal/domain/board/boardstore.go:138`, `internal/domain/board/boardstore.go:214`

board 먼저 잠가 soft-delete하고 멤버/관리자/부서/bookmark/개인알림을 soft-delete한다. 게시글·첨부·자료실 폴더·파일도 soft-delete하며 게시글/파일 delete_user_id=호출자. 이미 삭제된 게시글의 첨부는 live 게시글 첨부 대상 쿼리에서 빠진다. 댓글/공감/뷰 등 모든 종속 표를 즉시 직접 지우지는 않는다. 파일 bytes 동기삭제/게시판 복원 API는 없음([전수표](README.md)); 후속 영구 정리는 [09 자료실](09-drive-file.md)과 README의 배치를 따른다. `internal/domain/board/boardstore.go:214`

### 8. 시나리오

```bash
# 삭제 가능한 테스트 board에서 정상204
curl -i -X DELETE "$SCOPE/boards/$BOARD_ID" -H "Authorization: Bearer $BOARD_TOKEN"
# 동일 ID 재호출404 NOT_FOUND
curl -i -X DELETE "$SCOPE/boards/$BOARD_ID" -H "Authorization: Bearer $BOARD_TOKEN"
```


## POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/bookmark

### 1. 경로

OperationID: `board-toggle-bookmark`. [`internal/transport/httpapi/board/routes.go:310`](../../internal/transport/httpapi/board/routes.go#L310)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:309`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

`id`: UUID, 필수. 잘못된 UUID는 Huma에서 `400 INVALID_PAYLOAD`; 잘 형식화된 부재·삭제·타 회사 ID는 핸들러에서 `404 NOT_FOUND`. `internal/transport/httpapi/board/bookmarks.go:87`

### 3. Query

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. `internal/transport/httpapi/board/bookmarks.go:87`

### 4. Body

없음. 기본값·필수 여부·허용값·배열 표기·상한은 해당 없음. 목표 상태 body는 정의되어 있지 않다. `internal/transport/httpapi/board/bookmarks.go:87`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

대상404 → Read403 → 원자적 북마크 UPSERT/토글. 본인의 북마크만 변경하고 권한 없는 사람에게 board 내용은 공개하지 않는다. `internal/transport/httpapi/board/bookmarks.go:196` `internal/domain/board/bookmark.go:145`

### 6. Response

200: 아래 직접 객체;404 `NOT_FOUND`,403 `FORBIDDEN` 및 공통 오류. `internal/transport/httpapi/board/bookmarks.go:111`

| 필드 | 타입 | null | 저장/계산·포맷 |
| --- | --- | --- | --- |
| is_bookmarked | boolean | 아니오 | 저장 결과로 계산한 최종 on/off |
| board_id | string(UUID) | 아니오 | 계산: 요청 리소스 |
| user_id | number(int64) | 아니오 | 계산: 호출자 |
| deleted_at | string | 예 | 계산: on이면null, off이면 요청now UTC |

관계 및 created_at/updated_at/id 없음. 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

DB의 최초 created_at은 재토글·복원해도 유지한다. off의 deleted_at은 한 번 읽은 h.clock()을 DB와 응답에 사용하지만 DB timestamptz(3) 정밀도와 응답 문자열 정밀도는 다를 수 있다. `internal/transport/httpapi/board/bookmarks.go:219`, `internal/transport/httpapi/board/bookmarks.go:229`, `internal/domain/board/bookmark.go:90`

없는 행은on, live행은off, soft-delete행은on이다. 같은 요청을 두 번 성공시키면 두 번 뒤집힌다. 네트워크 timeout 뒤 무조건 재시도하지 말고 상세의 is_bookmark나 북마크 목록으로 먼저 확인한다. 응답 필드 이름은 상세 is_bookmark와 달리 **is_bookmarked**다. `internal/domain/board/bookmark.go:145` `internal/transport/httpapi/board/bookmarks.go:111`

### 8. 시나리오

```bash
# 정상: 현재 반대 상태로200
curl -i -X POST "$SCOPE/boards/$BOARD_ID/bookmark" -H "Authorization: Bearer $BOARD_TOKEN"
# 경계: 동일 호출도200이지만 다시 반대 상태로 되돌아감
curl -i -X POST "$SCOPE/boards/$BOARD_ID/bookmark" -H "Authorization: Bearer $BOARD_TOKEN"
```


## PUT /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/my-notification

### 1. 경로

OperationID: `board-update-board-notification`. [`internal/transport/httpapi/board/routes.go:513`](../../internal/transport/httpapi/board/routes.go#L513)

전체 URL은 제목과 같다. `internal/transport/httpapi/board/routes.go:515`

### 2. Path

`company_id`, `user_id`: 토큰의 int64 ID를 정규 10진 문자열로 전송. 클레임과 **문자열까지 동일**해야 하며 `001`, `+1`, `1.0`, 타 사용자/회사 값은 핸들러 이전 `403 FORBIDDEN`. `internal/transport/httpapi/middleware/auth.go:212` `internal/transport/httpapi/middleware/auth.go:261`

`id`: UUID, 필수. 잘못된 UUID는 Huma에서 `400 INVALID_PAYLOAD`; 잘 형식화된 부재·삭제·타 회사 ID는 핸들러에서 `404 NOT_FOUND`. `internal/transport/httpapi/board/boards.go:37`

### 3. Query

| 이름 | 타입/필수 | 기본값 | 허용값·파싱·상한 |
| --- | --- | --- | --- |
| is_post_alarm | string / 선택 | ""=미지정 | 정확히 0,1,true,false; 대문자/공백/yes/2는400. 배열 아님; 추가 길이 상한 없음 |
| is_notice_alarm | string / 선택 | ""=미지정 | 정확히 0,1,true,false; 대문자/공백/yes/2는400. 배열 아님; 추가 길이 상한 없음 |
| is_comment_alarm | string / 선택 | ""=미지정 | 정확히 0,1,true,false; 대문자/공백/yes/2는400. 배열 아님; 추가 길이 상한 없음 |

같은 key의 non-null body가 query보다 우선한다. query가 잘못되면 body로 덮어도 Huma400. 미지정 최종값은 기존 유지/신규true. `internal/transport/httpapi/board/notification.go:180`

### 4. Body

| 필드 | 타입/필수 | 생략/null | 상한 |
| --- | --- | --- | --- |
| is_post_alarm | legacy.Bool / 선택 | query fallback; query도 없으면 유지/신규true | 공통 Bool; 길이·개수 해당 없음 |
| is_notice_alarm | legacy.Bool / 선택 | query fallback; query도 없으면 유지/신규true | 공통 Bool; 길이·개수 해당 없음 |
| is_comment_alarm | legacy.Bool / 선택 | query fallback; query도 없으면 유지/신규true | 공통 Bool; 길이·개수 해당 없음 |

body 자체 선택, body 없음/{} 허용; 추가 키400. `internal/transport/httpapi/board/notification.go:180` `internal/transport/httpapi/board/notification.go:215`

### 5. 인증·권한

`Authorization: Bearer $BOARD_TOKEN` 필수. board 전용 토큰 검증(401) → 경로 회사/사용자 일치(403) → Huma 입력 검증(400) → 아래 도메인 판정 순서. `internal/transport/httpapi/middleware/auth.go:95` `internal/transport/httpapi/router.go:342` `internal/transport/httpapi/humaerr/humaerr.go:106`

대상404 → Read403 → query/body 병합 → 본인 설정 upsert. board 관리자 불필요하며 타인의 설정을 수정할 수 없다. `internal/transport/httpapi/board/notification.go:294`

### 6. Response

200: 아래 직접 객체.404 `NOT_FOUND`,403 `FORBIDDEN` 및 공통 오류. `internal/transport/httpapi/board/notification.go:322`

| 필드 | 타입 | null | 저장/계산·관계 |
| --- | --- | --- | --- |
| board_id | string(UUID) | 아니오 | 저장 키 |
| user_id | number(int64) | 아니오 | 저장 키/호출자 |
| is_post_alarm | boolean | 아니오 | 저장 최종 플래그; 신규true |
| is_notice_alarm | boolean | 아니오 | 저장 최종 플래그; 신규true |
| is_comment_alarm | boolean | 아니오 | 저장 최종 플래그; 신규true |

타임스탬프/관계 없음. 공통 `401 UNAUTHORIZED`, 경로 범위 `403 FORBIDDEN`, 요청 파싱 `400 INVALID_PAYLOAD`, 저장소 장애 `500 INTERNAL_ERROR`, deadline/cancel `503 SERVICE_UNAVAILABLE`가 적용된다. `internal/transport/httpapi/humaerr/humaerr.go:42` `internal/transport/httpapi/humaerr/humaerr.go:188`

### 7. 주의사항

board 전체 is_post_alarm/is_notice_alarm과 별개 본인 설정이다. 삽입은 생략 flag=true, 기존 행은 유지, soft-delete행 복원도 미지정 플래그를 보존한다. 아무 flag 없는 호출도200이며 updated_at을 갱신한다. 카테고리나 다른 사용자에 전파하지 않는다. `internal/domain/board/notification.go:135` `internal/transport/httpapi/board/notification_test.go:213`

### 8. 시나리오

```bash
# 정상: body 없이 query만으로200
curl -i -X PUT "$SCOPE/boards/$BOARD_ID/my-notification?is_notice_alarm=0" -H "Authorization: Bearer $BOARD_TOKEN"
# body가 같은 query보다 우선하여 notice=true
curl -i -X PUT "$SCOPE/boards/$BOARD_ID/my-notification?is_notice_alarm=0" -H "Authorization: Bearer $BOARD_TOKEN" -H "Content-Type: application/json" --data '{"is_notice_alarm":true}'
# 대문자 문자열 query는400
curl -i -X PUT "$SCOPE/boards/$BOARD_ID/my-notification?is_notice_alarm=False" -H "Authorization: Bearer $BOARD_TOKEN"
```
