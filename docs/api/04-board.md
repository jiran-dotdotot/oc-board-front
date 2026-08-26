# Board API (게시판)

`BoardController` 담당 엔드포인트 문서. 코드 기준(`app/Http/Controllers/Board/BoardController.php`, `app/Models/Board/**`, `routes/api.php`, `doc/v1~v3/board.sql`, `app/Http/Response/ReturnCode.php`)으로 작성되었습니다. `/management` 하위 position API는 제외합니다.

---

## 0. 공통 사항

### Base URL / 인증
- Base URL(로컬): `http://localhost:8000`, prefix `/api/v1`
- 모든 board 라우트: `auth:api`(Passport Bearer) + `locale.set` 미들웨어 적용
- 필수 헤더
  | 헤더 | 값 | 기본값 | 설명 |
  |---|---|---|---|
  | `Authorization` | `Bearer <token>` | (필수) | Passport 액세스 토큰 |
  | `Lang` | `ko` / `en` / `ja` | `ko` | 응답 메시지 로케일 (HTTP 헤더라 대소문자 무관, `lang` 도 동일) |
  | `Time_zone` | 예: `Asia/Seoul` | `Asia/Seoul` | 타임존 |
- 현재 유저: `UserController::getMe()` = `request()->user()`. 대부분의 조회/판정은 `company_id` 로 스코프됩니다.

### 회사 스코프
- 게시판 목록/권한은 **로그인 유저의 `company_id`** 기준으로만 노출됩니다. 타 회사 board 는 `checkBoardPermission` 최상단에서 즉시 차단됩니다.

### Route Model Binding
- `{board}` 는 `board.boards.id`(UUID, 문자열 PK)로 바인딩됩니다. 존재하지 않으면 **404**(Laravel `ModelNotFoundException`).

### 응답/에러 규약 (`ReturnCode.php`)
- **성공**: 모델/배열/페이지네이터 JSON 을 그대로 반환 (HTTP 200).
- **권한 실패**: `ReturnCode::customResponse($FORBIDDEN, ['message' => ...])` → HTTP **403**, body `{"message": "권한이 없습니다."}` (로케일별 번역).
- **검증 실패**: `ReturnCode::validationCheck($VALIDATION_TYPE_REQUIRED, ...)` → HTTP **400**, body `{"message": "<첫 번째 검증 오류 메시지>"}`.
  - 환경변수 `APP_ERROR_CODE_DEBUG` 가 truthy 이면 `"code": 501` 필드가 추가됨.
- **404**: route model binding 실패 / `findOrFail` 실패 시 Laravel 기본 404.
- **500**: `customResponse($SERVER_ERROR, ['message' => $e->getMessage()])` → HTTP 500, body `{"message": "<예외 메시지>"}`.
- 공통 에러 body 형태: `{ "message": string, "code"?: number, "response"?: any }`.

### HTTP status 상수 요약
| 상수 | 코드 | 용도 |
|---|---|---|
| `$SUCCESS` | 200 | 성공 |
| `$BAD_REQUEST` | 400 | 잘못된 요청 / 검증 실패 |
| `$UNAUTHORIZED` | 401 | 인증 실패 |
| `$FORBIDDEN` | 403 | 권한 없음 |
| `$NOT_FOUND` | 404 | 리소스 없음 |
| `$CONFLICT` | 409 | 충돌/중복 |
| `$SERVER_ERROR` | 500 | 서버 오류 |

---

## 1. 데이터 모델 (스키마)

### `board.boards` (Board)
| 필드 | 타입 | 기본값 | fillable | cast | 의미 |
|---|---|---|---|---|---|
| `id` | UUID | `uuid_generate_v1()` | - | string | PK |
| `company_id` | INT | - | - | - | 회사 ID (insert 시 서버가 현재 유저로 설정) |
| `user_id` | INT | - | - | - | 생성자 ID (insert 시 서버 설정) |
| `category_id` | UUID | null | - | - | 소속 카테고리. **공용(public) 게시판이면 null**. fill 불가 → 수정 API 로 변경 불가 |
| `is_active` | BOOL | `true` | O | boolean | 활성화 여부 |
| `is_drive` | BOOL | `false` | - | - | 자료실 여부. insert 시에만 직접 설정, fill 불가 → 수정 불가 |
| `is_public` | BOOL | `false` | - | boolean | 공용 게시판 여부. insert 시에만 설정, fill 불가 → 수정 불가 |
| `is_post_alarm` | BOOL | `true` | O | boolean | 게시글 알림 |
| `is_notice_alarm` | BOOL | `true` | O | boolean | 게시글 공지 |
| `is_comment_alarm` | BOOL | `true` | O | boolean | 댓글 알림 |
| `read_permission` | TEXT | `ALL` | O | - | 읽기 권한: `ALL`/`ADMIN`/`MEMBER` (§2 참고) |
| `write_permission` | TEXT | `ALL` | O | - | 쓰기 권한: `ALL`/`ADMIN`/`MEMBER` |
| `type` | TEXT | `BOARD` | O | - | `BOARD`(게시판)/`PREVIEW`(미리보기)/`ALBUM`(앨범)/`DRIVE`(자료실) |
| `position` | INT | 1 | O | - | 정렬 순서 |
| `title` | TEXT | `''` | O | - | 게시판명 |
| `description` | TEXT | `''` | O | - | 게시판 설명 |
| `size_limit` | BIGINT | 0 | O | - | 자료실 전체 용량 제한 (Byte) |
| `size_limit_per_file` | BIGINT | 0 | O | - | 파일별 용량 제한 (Byte) |
| `except_extension` | TEXT[] | `{}` | O | (accessor) | 업로드 불가 확장자. **읽을 때 배열로, 저장 시 대문자 배열로** 변환됨 |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | - | - | - | 생성/수정/soft delete |

> `except_extension` 접근자: 저장 시 `setExceptExtensionAttribute` 가 값을 대문자화하여 PostgreSQL 배열(`{PDF,EXE}`) 형태로 저장, 조회 시 `getExceptExtensionAttribute` 가 빈 값 제거 후 배열로 반환.

### 연관 테이블
| 모델 | 테이블 | PK | 주요 필드 | 의미 |
|---|---|---|---|---|
| `BoardAdmin` | `board.board_admins` | (board_id, user_id) | category_id | 게시판 관리자(마스터). `user` 관계로 유저 정보 eager load. `timestamps=false` |
| `BoardMember` | `board.board_members` | (board_id, user_id) | is_readable, is_writable, category_id, is_post_alarm, is_comment_alarm | 게시판 멤버. `is_readable`/`is_writable` 캐스트 boolean |
| `BoardDepartment` | `board.board_departments` | (board_id, department_id) | is_readable, is_writable, category_id | 게시판 부서. `department` 관계로 부서(id,name,path) load. `timestamps=false` |
| `BoardBookmark` | `board.board_bookmarks` | (user_id, board_id) | position | 게시판 즐겨찾기 (soft delete 토글) |
| `UserBoardSetting` | `management.user_board_settings` | (board_id, user_id) | is_post_alarm, is_notice_alarm, is_comment_alarm | 유저별 게시판 알림 설정 (member API 대상) |

---

## 2. checkBoardPermission (권한 판정 로직) — 핵심

`BoardController::checkBoardPermission(Board $board)` 은 `{read: bool, write: bool}` 를 반환합니다. `getBoard`, `bookmarkBoard` 에서 read 판정에 사용되고, `getBoard` 응답의 `is_writable` 값으로도 노출됩니다.

### 판정 순서 (위에서부터 단락 평가)
1. **회사 불일치**: `board.company_id !== 유저.company_id` → `{read:false, write:false}` 즉시 반환.
2. **공용 게시판**: `board.is_public === true` → `{read:true, write:true}` 즉시 반환. (회사 구성원 누구나 읽기/쓰기)
3. 그 외(비공개) → 아래 연관관계를 한 번의 SQL(LEFT JOIN 서브쿼리)로 조회:
   - **부서 매칭**: 유저의 소속 부서 + `getParentDepartmentTree`(상위 부서 체인). 즉, 게시판이 **상위 부서**에 배정되면 그 하위 부서 구성원도 매칭됨.
   - **카테고리 상위 체인**: `getParentCategoryTree([board.category_id])` (카테고리 + 상위 카테고리들).
   - 서브쿼리별 존재 여부:
     | 키 | 조건 |
     |---|---|
     | `admin_user_id` | 유저가 오피스(최고) 관리자 (`management.admins`) |
     | `category_admin_user_id` | 유저가 board 카테고리 **또는 상위 카테고리**의 관리자 |
     | `category_member_user_id` | 유저가 board 카테고리(정확히 그 카테고리)의 멤버 |
     | `board_admin_user_id` | 유저가 이 게시판의 관리자 |
     | `board_member_user_id` (+ is_readable/is_writable) | 유저가 이 게시판의 멤버 |
     | `board_department_board_id` (+ is_readable/is_writable) | 유저 부서(상위 포함)가 이 게시판에 배정됨 (부서 여러 개면 `BOOL_OR` 로 집계) |
4. **오피스 관리자면** (`admin_user_id` 존재) → `{read:true, write:true}` 즉시 반환 (권한 모드 무시).
5. `read_permission` 별 read 판정:
   | 모드 | read = true 조건 |
   |---|---|
   | `ALL` | category_member **또는** board_admin **또는** board_member **또는** category_admin **또는** board_department 중 하나라도 존재 |
   | `ADMIN` | board_admin **또는** category_admin |
   | `MEMBER` | board_admin **또는** (board_member **AND** `is_readable`) **또는** category_admin **또는** (board_department **AND** `is_readable`) |
6. `write_permission` 별 write 판정 (구조 동일):
   | 모드 | write = true 조건 |
   |---|---|
   | `ALL` | category_member/board_admin/board_member/category_admin/board_department 중 하나라도 존재 |
   | `ADMIN` | board_admin **또는** category_admin |
   | `MEMBER` | board_admin **또는** (board_member **AND** `is_writable`) **또는** category_admin **또는** (board_department **AND** `is_writable`) |

### 프론트가 반드시 알아야 할 요점
- **`ALL` ≠ 무조건 허용.** 비공개 게시판의 `ALL` 은 "카테고리 멤버/게시판 멤버·관리자/부서 배정 중 하나라도 있으면"입니다. **아무 연관이 없는 유저는 `ALL` 이어도 read=false.** 무조건 허용은 오직 `is_public=true` 뿐.
- **오피스 관리자 / 카테고리 관리자 / 게시판 관리자는 모든 모드에서 read·write 통과** (사실상 풀 액세스).
- **`is_readable`/`is_writable` 플래그는 `MEMBER` 모드에서만 유효.** `ALL` 모드에서는 멤버/부서 존재만으로 통과(플래그 무시), `ADMIN` 모드에서는 멤버/부서 자체를 보지 않음.
- 부서 권한은 **상위 부서 배정 → 하위 부서 구성원까지** 확장됩니다.

---

## 3. 엔드포인트

### 3.1 GET `/api/v1/board` — selectBoard (목록/검색)

- **path**: 없음
- **query**:
  | 파라미터 | 타입 | 설명 |
  |---|---|---|
  | `take` | int | 페이지당 개수 (기본 20) |
  | `page` | int | Laravel 표준 페이지 번호 |
  | `id` | uuid | 특정 board id 로 필터 (사실상 단건 상세 조회) |
  | `is_public` | any | **파라미터가 존재하기만 하면** `is_public=true` 로 필터 (값 무관, §주의) |
  | `is_bookmark` | any | 현재 유저가 북마크한 board 만, 북마크 `updated_at asc` 정렬 |
  | `sort[by]` / `sort[order]` | string | 정렬 컬럼/방향. `by` 가 실제 컬럼이 아니면 정렬 미적용. 기본 `created_at desc` |
  | `more_field` | string | 현재 사실상 무효(no-op) |
- **인증·권한**: `auth:api` 만. **개별 board 읽기 권한 검사 없음.**
- **response**: Laravel 페이지네이터 JSON. `data[]` 에 Board 객체 배열 + `current_page`, `last_page`, `per_page`, `total`, `first_page_url`, `next_page_url` 등.
- **주의사항**:
  - **권한 필터링이 없습니다.** 회사(`company_id`) 스코프만 적용되어, 읽기 권한이 없는 비공개 게시판도 목록에 포함될 수 있습니다(해당 board 를 `getBoard` 하면 403). `is_active=false` 인 board 도 포함.
  - `is_public` 필터는 **키 존재 여부로 동작**합니다. `is_public=0`, `is_public=false` 같은 문자열도 값이 truthy 로 취급되어 결국 `is_public=true` 필터가 걸립니다. "공용 게시판만" 을 원할 때만 이 키를 붙이세요.
  - 필터는 쿼리 파라미터명이 `BoardFilter` 의 메서드명(`id`,`is_public`,`is_bookmark`,`sort`,`more_field`)과 일치할 때만 적용됩니다.
- **시나리오**:
  - 정상: `GET /board?take=10&page=1` → 회사 board 최대 10개.
  - 북마크: `GET /board?is_bookmark=1` → 내가 북마크한 board.
  - 단건: `GET /board?id=<uuid>` → 해당 board 만 (페이지네이터로 감싸짐).
  - 엣지: `GET /board?is_public=0` → 의도와 달리 공용 board 만 반환됨.

---

### 3.2 POST `/api/v1/board` — insertBoard (생성)

- **path**: 없음
- **body payload**:
  | 필드 | 타입 | 필수 | 검증 | 저장 |
  |---|---|---|---|---|
  | `is_public` | boolean | O | `required|boolean` | boards.is_public |
  | `category_id` | uuid | 조건부 | `required_if:is_public,0` (비공개면 필수) | boards.category_id (비공개 & 값 존재 시) |
  | `type` | string | O | `required|in:BOARD,PREVIEW,ALBUM,DRIVE` | boards.type |
  | `title` | string | O | `required|string|min:1` | boards.title |
  | `read_permission` | string | X | `in:ALL,ADMIN,MEMBER` | boards.read_permission |
  | `write_permission` | string | X | `in:ALL,ADMIN,MEMBER` | boards.write_permission |
  | `is_drive` | boolean | X | (검증 없음) | boards.is_drive |
  | `size_limit` | number | X | `numeric|lt:9223372036854775808` | boards.size_limit |
  | `size_limit_per_file` | number | X | `numeric|lt:9223372036854775808` | boards.size_limit_per_file |
  | `except_extension` | array | X | `array` | boards.except_extension (대문자화 저장) |
  | `description`, `is_active`, `is_post_alarm`, `is_notice_alarm`, `is_comment_alarm`, `position` | - | X | - | fill 로 저장(§3.3 updateBoard 와 동일) |
  | `insert_board_admin_user_id[]` 등 멤버/부서/관리자 배열 | array | X | - | updateBoard 로직으로 처리 (§3.3) |
- **인증·권한**:
  - `is_public=false`(비공개): `category_id` 로 카테고리 조회(`findOrFail`, 없으면 404). **오피스 관리자 또는 해당 카테고리 관리자만** 생성 가능, 아니면 403.
  - 이후 내부적으로 `updateBoard` 를 호출하므로, 거기서도 `오피스관리자 || 카테고리관리자 || 게시판관리자` 검사를 통과해야 함(신규 board 라 실질적으로 위와 동일).
- **response**: 생성된 Board 객체 JSON (updateBoard 반환값).
- **주의사항**:
  - `company_id`, `user_id`, `is_public`, `is_drive`, `category_id` 는 서버가 직접 설정(요청으로 위조 불가). `read/write_permission`, `type` 미지정 시 DB 기본값 `ALL`/`BOARD`.
  - **비공개 board 생성은 관리자 권한 필수** (오피스 or 카테고리 관리자).
  - ⚠️ **공용(is_public=true) board 를 비관리자가 생성하면 500 에러 가능**: 공용 board 는 카테고리 권한 블록을 건너뛰고 바로 `updateBoard` 로 가는데, 거기서 `CategoryController::isCategoryAdmin($category)` 가 호출되고 `$category` 가 null 이면 타입힌트(`Category $category`) 위반으로 `TypeError`(500)가 납니다. 즉 **공용 board 생성은 사실상 오피스 관리자만** 정상 동작(관리자면 단락 평가로 isCategoryAdmin 미호출).
- **시나리오**:
  - 정상(비공개): 카테고리 관리자가 `{is_public:false, category_id, type:"BOARD", title:"팀 게시판"}` → 201/200 Board.
  - 권한 실패: 일반 유저가 비공개 board 생성 → 403.
  - 검증 실패: `title` 누락 → 400.
  - 엣지: 일반 유저가 `{is_public:true, type, title}` → 500(TypeError).

---

### 3.3 PUT `/api/v1/board/{board}` — updateBoard (수정 + 멤버/부서/관리자 구성)

- **path**: `{board}` = board id
- **body payload**:
  | 필드 | 타입 | 검증 | 처리 |
  |---|---|---|---|
  | `title`, `description`, `type`, `read_permission`, `write_permission`, `position`, `is_active`, `is_post_alarm`, `is_notice_alarm`, `is_comment_alarm`, `size_limit`, `size_limit_per_file`, `except_extension` | 스칼라/배열 | `size_limit*` 만 numeric 검증 | `$board->fill()` 로 저장 (fillable 만) |
  | `insert_board_department_id` | int[] | array | 부서 배정 추가 (비공개 board 만) |
  | `delete_board_department_id` | int[] | array | 부서 배정 삭제 (비공개 board 만) |
  | `insert_board_member_user_id` | int[] | array | 멤버 추가 (비공개 board 만) |
  | `delete_board_member_user_id` | int[] | array | 멤버 삭제 (+해당 유저 게시판관리자도 삭제) (비공개 board 만) |
  | `insert_board_admin_user_id` | int[] | array | 게시판 관리자 추가 (**공개/비공개 무관**) |
  | `delete_board_admin_user_id` | int[] | array | 게시판 관리자 삭제 (**공개/비공개 무관**) |
- **인증·권한**: `오피스 관리자 || 카테고리 관리자(board 카테고리) || 게시판 관리자` 중 하나. 아니면 403.
- **response**: 갱신된 Board 객체 JSON.
- **처리 규칙**:
  - board 에 `category_id` 가 있으면, insert 대상은 **카테고리 허용 풀** 안에 있어야 반영됨(아니면 조용히 skip):
    - 허용 부서 = 카테고리 부서 + 그 하위 부서 트리(`getChildDepartmentTree`).
    - 허용 유저 = 카테고리 멤버 + 위 허용 부서 소속 활성 유저.
  - 멤버/부서 변경은 `is_public=false` 인 board 에서만 동작. 공용 board 는 멤버/부서 배열이 무시됨(관리자 배열만 처리).
  - 전체 로직은 트랜잭션. 중간 예외 시 롤백 + 500.
- **주의사항**:
  - **`is_public`, `is_drive`, `category_id` 는 fillable 이 아니라 수정 불가** — 생성 이후 변경하려면 별도 수단 필요.
  - **`read_permission`/`write_permission`/`type` 은 updateBoard 에서 enum 검증이 없습니다.** insert 와 달리 임의 문자열이 저장될 수 있음(프론트에서 값 보증 필요).
  - **멤버 추가 시 `is_readable`/`is_writable` 를 지정할 수 없습니다.** upsert 가 `user_id, board_id, category_id, deleted_at` 만 설정하고 플래그는 건드리지 않아 신규 멤버는 DB 기본값(둘 다 true)으로 들어갑니다. 부서도 동일. → 세밀한 읽기/쓰기 플래그 제어는 이 API 로 불가.
  - upsert 는 soft delete 된 행을 되살립니다(`deleted_at=null`). 재추가 시 과거 설정이 복구될 수 있음.
- **시나리오**:
  - 정상: 게시판 관리자가 `{title:"변경", insert_board_member_user_id:[10,11]}` → Board.
  - 권한 실패: 일반 멤버가 수정 → 403.
  - 카테고리 필터: 카테고리 밖 유저를 `insert_board_member_user_id` 로 추가 → 조용히 무시(에러 아님).
  - 엣지: 공용 board 에 `insert_board_member_user_id` → 멤버는 무시, `insert_board_admin_user_id` 만 반영.

---

### 3.4 GET `/api/v1/board/{board}` — getBoard (상세)

- **path**: `{board}` = board id
- **query**: 없음
- **인증·권한**: `checkBoardPermission(board).read === true` 필요. 아니면 403.
- **response**: Board 객체 + 아래 부가 필드
  | 필드 | 의미 |
  |---|---|
  | `is_writable` | `checkBoardPermission` 의 write 결과 (글쓰기 가능 여부) |
  | `is_admin` | `isBoardAdmin`: 게시판 관리자 **또는** 카테고리 관리자 여부 (설정/멤버 관리 가능 여부) |
  | `boardAdmins[]` | 게시판 관리자 목록, 각 항목에 `user`(id,name,profile_image_id,disabled_at,deleted_at,member) |
  | `boardMembers[]` | 게시판 멤버 목록(+is_readable/is_writable/알림 플래그, `user`) |
  | `boardDepartments[]` | 게시판 부서 목록(+is_readable/is_writable, `department`(id,name,path)) |
  | `total_usage_size` | `is_drive=true` 일 때 활성 파일 크기 합계(Byte), 아니면 0 |
  | `except_extension` | 배열(대문자)로 반환 |
- **주의사항**:
  - `is_writable`(글쓰기)와 `is_admin`(게시판 관리)은 **의미가 다릅니다.** 관리 UI 노출은 `is_admin`, 글쓰기 버튼은 `is_writable` 로 판단.
  - `total_usage_size` 는 자료실(`is_drive=true`)에서만 계산됩니다.
- **시나리오**:
  - 정상: 멤버가 조회 → Board(+is_writable/is_admin/관계).
  - 권한 실패: 연관 없는 유저가 비공개 board 조회 → 403.
  - 엣지: 타 회사 board → 403(회사 불일치).

---

### 3.5 DELETE `/api/v1/board/{board}` — deleteBoard (삭제)

- **path**: `{board}` = board id
- **query/body**: 없음
- **인증·권한**: **오피스 관리자 또는 카테고리 관리자만.** (게시판 관리자는 삭제 불가.) 아니면 403.
- **response**: soft delete 된 Board 객체 JSON.
- **처리**: board 하위 전체 정리 후 board soft delete.
  - 모든 Post 의 thumbnail/files/post 삭제
  - 해당 board 의 DriveFolder 삭제
  - 해당 board 의 DriveFile 삭제 + `ProcessDeleteS3File` 잡 디스패치(S3 실제 파일 삭제)
- **주의사항**:
  - **게시판 관리자(board admin)는 삭제 권한이 없습니다** — 읽기/수정과 다름.
  - 게시글/자료실 파일이 함께 삭제되고 S3 삭제 잡이 큐잉되므로 되돌리기 어려움(파괴적).
- **시나리오**:
  - 정상: 카테고리 관리자가 삭제 → 삭제된 Board 반환.
  - 권한 실패: 게시판 관리자/일반 유저 → 403.

---

### 3.6 POST `/api/v1/board/bookmark/{board}` — bookmarkBoard (북마크 토글)

- **path**: `{board}` = board id
- **query/body**: 없음
- **인증·권한**: `checkBoardPermission(board).read === true` 필요. 아니면 403.
- **동작**: **토글**. (`withTrashed` 로 기존 북마크 조회)
  | 상태 | 결과 |
  |---|---|
  | 북마크 없음 | 새로 생성(활성) |
  | soft delete 상태 | 복구(`deleted_at=null`) |
  | 활성 상태 | soft delete(해제) 후 즉시 반환 |
- **response**: BoardBookmark 객체 JSON. (생성/복구 시 저장된 객체, 해제 시 삭제된 객체)
- **주의사항**:
  - 같은 엔드포인트를 반복 호출하면 등록↔해제가 번갈아 일어납니다. 응답의 `deleted_at` 유무로 현재 상태 판별 가능.
  - 읽기 권한 없으면 북마크도 불가(403).
- **시나리오**:
  - 정상 등록 → 다시 호출 시 해제 → 다시 호출 시 재등록.
  - 권한 실패: 읽기 불가 board 북마크 → 403.

---

### 3.7 POST `/api/v1/board/member/{board}` — updateBoardMember (내 알림 설정)

> ⚠️ 이름은 "member" 지만 **다른 멤버를 관리하는 API 가 아니라, 현재 유저 본인의 게시판 알림 설정**을 저장하는 API 입니다. (멤버/부서 구성은 §3.3 updateBoard 사용)

- **path**: `{board}` = board id
- **body payload**:
  | 필드 | 타입 | 필수 | 저장 |
  |---|---|---|---|
  | `is_post_alarm` | boolean | X | user_board_settings.is_post_alarm |
  | `is_notice_alarm` | boolean | X | user_board_settings.is_notice_alarm |
  | `is_comment_alarm` | boolean | X | user_board_settings.is_comment_alarm |
- **인증·권한**: `auth:api` 만. **별도 권한 검사 없음** (읽기 권한도 확인하지 않음). 로그인 유저 본인 설정만 대상이라 위험은 낮음.
- **처리**: `(board_id, user_id)` 로 `UserBoardSetting` 을 `firstOrNew`. 신규면 `user_id/board_id/category_id`(board 의 category_id) 설정 후 `fill()` → save.
- **response**: `UserBoardSetting` 객체 JSON.
- **주의사항**:
  - fillable 은 위 3개 알림 플래그뿐. 다른 필드는 무시됨.
  - 권한 체크가 없으므로, 읽기 권한 없는 board 에 대해서도 설정 레코드가 생성될 수 있음(기능상 큰 문제는 없음).
- **시나리오**:
  - 정상: `{is_post_alarm:false}` → 내 설정 upsert 후 반환.
  - 엣지: 최초 호출이면 새 설정 생성, 재호출이면 갱신.

---

## 4. 공통 함정 요약 (프론트 체크리스트)

1. **목록은 권한 필터가 없다** — `GET /board` 는 회사 스코프만. 읽을 수 없는 board 도 목록에 나오고, 열면 403. 접근 가능 여부는 각 board `getBoard` 결과(또는 별도 로직)로 판단.
2. **`is_public` 쿼리는 값이 아니라 존재로 동작** — 붙이면 무조건 공용 board 필터. 전체를 원하면 빼야 함.
3. **`ALL` 권한도 무연관 유저는 접근 불가** — 무조건 허용은 `is_public=true` 뿐. `is_readable`/`is_writable` 플래그는 `MEMBER` 모드에서만 유효.
4. **수정 API 로 못 바꾸는 것** — `is_public`, `is_drive`, `category_id` (fillable 아님). 멤버의 `is_readable`/`is_writable` 도 이 API 로 설정 불가(항상 기본 true 로 생성).
5. **권한 주체별 가능 동작이 다름** — 삭제: 오피스/카테고리 관리자만(게시판 관리자 불가). 수정: 오피스/카테고리/게시판 관리자. 생성(비공개): 오피스/카테고리 관리자. 공용 board 생성은 사실상 오피스 관리자만(비관리자는 500 위험).
6. **`board/member/{board}` 는 본인 알림 설정 API** — 멤버 구성과 혼동 금지.
