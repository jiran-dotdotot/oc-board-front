# 카테고리 API (Category)

`App\Http\Controllers\Category\CategoryController` — 카테고리 트리 조회/생성/수정/삭제 및 개인 알림 설정.

> 코드 근거: `routes/api.php`, `app/Http/Controllers/Category/CategoryController.php`, `app/Models/Category/*`, `app/Http/Response/ReturnCode.php`, `doc/v1/category.sql`.

---

## 0. 공통 사항

| 항목 | 값 |
|---|---|
| Base URL (로컬) | `http://localhost:8000` |
| Prefix | `/api/v1` |
| 인증 | `auth:api` (Passport Bearer) + `locale.set` |
| 필수 헤더 | `Authorization: Bearer <token>`, `lang: ko\|en\|ja`, `Accept: application/json` |
| 현재 유저 | `UserController::getMe()` = `request()->user()` (토큰 소유자). 모든 조회는 `company_id` 스코프 |

### 라우트 목록 (담당 8개)

| METHOD | URL | 핸들러 | 용도 |
|---|---|---|---|
| GET | `/api/v1/category` | `selectCategory` | 내 카테고리 트리 + 전사 공개 게시판 |
| GET | `/api/v1/category/admin` | `selectAdminCategory` | 관리자 뷰(역할 분기) |
| GET | `/api/v1/category/management` | `selectManagerCategory` | 카테고리/게시판 관리자 대상 트리 |
| POST | `/api/v1/category` | `insertCategory` | 카테고리 생성 |
| GET | `/api/v1/category/{category}` | `getCategory` | 카테고리 단건 + 멤버/부서/관리자 |
| PUT | `/api/v1/category/{category}` | `updateCategory` | 카테고리 수정 + 멤버/관리자/부서 일괄 반영 |
| DELETE | `/api/v1/category/{category}` | `deleteCategory` | 카테고리 삭제(하위 전체 캐스케이드) |
| PUT | `/api/v1/category/member/{category}` | `updateCategoryMember` | **개인 알림 설정** 수정 (멤버십 아님) |

> 라우트 등록 순서상 `admin`, `management` 는 `{category}` 보다 먼저 매칭되므로 충돌 없음.
> 참고(본 문서 범위 밖, `management` prefix): `POST /management/category/edit`(editCategoryPosition), `POST /management/category`(updateTopCategoryPosition), `POST /management/category/{category}`(updateCategoryPosition) — 순서 변경/일괄 삭제용.

### 권한 개념

| 개념 | 판별 | 코드 |
|---|---|---|
| office 관리자 | `management.admins` 에 `(company_id, user_id)` 존재 | `ManagementController::isAdminUser($companyId)` (10초 캐시) |
| 카테고리 관리자 | `category.category_admins` 에 내 `user_id` 존재 (+ 하위 카테고리 재귀 포함) | `CategoryController::isCategoryAdmin` |
| 카테고리 멤버 | `category.category_members` 또는 `category.category_departments`(부서) 소속 | `CategoryController::isCategoryMember` (⚠ 버그, 아래 참조) |

### 에러 응답 형식 (`ReturnCode`)

| 상황 | HTTP | 바디 |
|---|---|---|
| 유효성 실패 (`validationCheck`) | `400` | `{ "message": "<첫 번째 검증 오류>" }` (+ `APP_ERROR_CODE_DEBUG` 시 `code`) |
| 권한 없음 (`customResponse` FORBIDDEN) | `403` | `{ "message": "<validation.no_permission 번역>" }` |
| 서버 오류 (트랜잭션 롤백) | `500` | `{ "message": "<예외 메시지>" }` |
| 인증 실패 (Passport) | `401` | Passport 기본 |

- 성공 응답은 모델/배열 JSON을 그대로 반환(공통 래퍼 없음). 조회 3종의 최상위 형태만 아래처럼 다르다.
- `message` 는 `lang` 헤더에 따라 번역됨.

---

## 1. GET /api/v1/category — selectCategory

내가 접근 가능한(멤버/부서/선택적 관리자) 카테고리 트리 + 전사 공개 게시판.

**① METHOD + URL** `GET /api/v1/category`
**② Path** 없음
**③ Query**

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `with_category_admin` | bool* | X | truthy 이면 내가 **카테고리 관리자**인 카테고리(+하위 재귀)도 포함. 게시판 `is_category_admin` 및 `is_writable` 계산에 반영 |

> ⚠ `with_category_admin` 은 `$request->input()` **raw truthiness** 로 평가. 켜려면 `1`, 끄려면 **생략 또는 `0`**. 문자열 `"false"` 는 PHP에서 truthy → 참으로 동작하니 주의.

**④ Body** 없음
**⑤ 인증·권한** `auth:api`. 별도 권한 체크 없음 — 결과가 멤버십/부서/관리자 스코프로 필터됨.

**⑥ Response** — `{ public_boards: [], categories: [] }`

- `public_boards`: `category_id IS NULL` + `is_public=true` + `is_active=true` 인 전사 공개 게시판 (`position` asc).
- `categories`: 트리(아래 §9). 포함 조건은 **OR**:
  - 내가 멤버(`category_members`)인 카테고리
  - 내 부서(또는 **상위 부서**)에 권한이 있는 카테고리(`category_departments`, `getParentDepartmentTree` 로 상위 부서 소급)
  - `with_category_admin` truthy 시 내가 관리자인 카테고리(+하위)
  - 공통 필터: `company_id` 일치 + `is_active=true`

카테고리 노드 추가 필드: `is_post_alarm`, `is_comment_alarm` = `COALESCE(user_category_settings.<개인설정>, true)` (**카테고리 컬럼값이 아니라 현재 유저의 개인 설정값**, 없으면 `true`. `PUT /category/member/{category}` 로 설정).

각 카테고리의 `boards[]` 필드:

| 필드 | 의미 |
|---|---|
| `is_writable` | `NOT(카테고리관리자아님 AND 게시판관리자아님 AND read_permission='ADMIN')`. 즉 ADMIN 전용 게시판은 관리자만 `true` |
| `is_bookmark` | 내 북마크 존재 여부 |
| `is_admin` | 내가 **게시판 관리자**(`board_admins`) 여부 |
| `is_category_admin` | 게시판의 카테고리가 내 관리 카테고리 목록에 포함되는지 (`with_category_admin` 필요) |
| `is_board_member_post_alarm` / `_notice_alarm` / `_comment_alarm` | `COALESCE(user_board_settings.<개인설정>, true)` |

게시판 노출 조건(OR): 카테고리 관리자 · 관리 카테고리 소속 · `read_permission=ALL` · (`MEMBER` & 게시판 멤버) · (`MEMBER` & 내 부서 게시판) · 게시판 관리자. → **`read_permission=ADMIN` 게시판은 관리자에게만** 노출.

**⑦ 주의사항**
- `categories[]` 에는 `category_member` 관계가 **포함되지 않음** (admin/management 조회와 다름).
- `is_post_alarm`/`is_comment_alarm` 는 모델 캐스팅(boolean)되어 `true/false` 로 내려감. 게시판의 computed 플래그들은 raw SQL alias(모델 캐스팅 미적용)이므로 truthy/falsy 로 방어적으로 처리 권장.
- 트리는 사실상 2뎁스까지만 안정적으로 중첩됨 (§9 참조).

**⑧ 시나리오**

| 상황 | 결과 |
|---|---|
| 정상(멤버) | 내 멤버/부서 카테고리 + 공개 게시판 |
| `?with_category_admin=1` | 위 + 내가 관리자인 카테고리(+하위) |
| 엣지 — 접근 가능 카테고리 없음 | `categories: []`, `public_boards` 는 공개 게시판대로 |
| 엣지 — 하위 카테고리만 멤버(부모 미포함) | 해당 하위가 트리에서 누락될 수 있음 (§9 함정) |

---

## 2. GET /api/v1/category/admin — selectAdminCategory

**역할에 따라 동작이 갈림.**

**① METHOD + URL** `GET /api/v1/category/admin`
**② Path** 없음  **③ Query** 없음 (일반 유저 분기 시 내부적으로 `with_category_admin=true` 강제)  **④ Body** 없음
**⑤ 인증·권한** `auth:api`. office 관리자 여부로 분기.

- **office 관리자가 아님** → `with_category_admin=true` 를 주입하고 `selectCategory()` 를 그대로 호출. **즉 `GET /category?with_category_admin=1` 과 동일**.
- **office 관리자** → 회사 전체 뷰:
  - `public_boards`: 공개 게시판 + `is_writable=true` + `is_bookmark`.
  - `categories`: **회사의 모든 카테고리** (멤버십 필터 없음). 각 게시판 `is_writable=true`, `is_admin=true`, `is_bookmark`. 카테고리에 `category_member` 관계 포함.

**⑥ Response** `{ public_boards, categories }` (트리).

**⑦ 주의사항**
- ⚠ office 관리자 분기는 **`is_active` 필터가 없음** → 비활성 카테고리/게시판도 반환. (일반 유저 분기는 `is_active=true`.)
- 게시판 select 가 단순화되어 있어 **알림 설정 필드(`is_board_member_*_alarm`)와 `is_category_admin` 이 없음** (관리자 분기 한정).
- 일반 유저에게는 `/category/admin` ≡ `/category?with_category_admin=1`. **차이는 office 관리자에게만** 나타남(전사 뷰).

**⑧ 시나리오**

| 유저 | 결과 |
|---|---|
| office 관리자 | 회사 전체 카테고리/게시판(비활성 포함), 전부 writable |
| 일반 유저 | `selectCategory(with_category_admin=1)` 과 동일 |

---

## 3. GET /api/v1/category/management — selectManagerCategory

내가 **카테고리 관리자 / 게시판 관리자**인 대상만 모은 관리용 트리.

**① METHOD + URL** `GET /api/v1/category/management`
**② Path** 없음  **③ Query** 없음  **④ Body** 없음
**⑤ 인증·권한** `auth:api`. 결과가 관리 권한 스코프로 필터됨(권한 없으면 빈 배열).

**⑥ Response** — ⚠ **트리 배열을 그대로 반환** (`{public_boards, categories}` 래퍼 없음, `public_boards` 없음).

포함 카테고리:
- 내가 `category_admins` 인 카테고리 → 하위(`getChildCategoryTree`) + **상위(`getParentCategoryTree`)** 까지 포함(트리 루트 구성용).
- 내가 `board_admins` 인 게시판의 카테고리(+상위).
- 공통 필터: `company_id` + `is_active=true`.

카테고리 노드 추가 필드: `is_admin` = 내가 그 **카테고리**의 관리자인지(`category_admins` 존재). `category_member` 관계 포함.
`boards[]` 는 `boards.*` 만(추가 computed 플래그 없음). 게시판 노출 조건: 카테고리 관리자 · 관리 카테고리(하위) 소속 · 내가 게시판 관리자.

**⑦ 주의사항**
- 응답 최상위 형태가 다른 두 조회와 **다름**(배열). 프론트 파싱 분기 필요.
- 상위 카테고리는 트리 구성을 위해 포함되지만, 그 상위의 `boards` 는 내가 관리자가 아니면 비어 있을 수 있음.
- `is_admin` 이 **게시판이 아니라 카테고리 레벨** 플래그임(다른 조회의 board `is_admin` 과 의미 다름).

**⑧ 시나리오**

| 상황 | 결과 |
|---|---|
| 카테고리/게시판 관리자 | 관리 대상 트리(+상위 루트) |
| 관리 권한 전무 | `[]` |

---

## 4. POST /api/v1/category — insertCategory

카테고리 생성 후 곧바로 `updateCategory` 를 호출(멤버/관리자/부서 반영까지 한 번에).

**① METHOD + URL** `POST /api/v1/category`
**② Path** 없음  **③ Query** 없음
**④ Body**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `name` | string(min 1) | ✅ | 카테고리명 |
| `parent_category_id` | UUID | 조건부 | 상위 카테고리. **office 관리자가 아니면 필수** + 그 상위의 카테고리 관리자여야 함 |
| (그 외) | — | X | `updateCategory` 의 모든 body 필드(멤버/관리자/부서 insert·delete, `is_active`, `position` 등) 동시 적용 가능 (§6) |

- `parent_category_id` 있으면 `depth = 부모.depth + 1`, 없으면 `depth=1`(최상위).
- 생성 시 `company_id`, `user_id`(생성자)는 서버가 세팅.

**⑤ 인증·권한**
- office 관리자: 최상위(depth 1) 포함 자유 생성.
- 일반 유저: `parent_category_id` **필수**이고 그 부모의 **카테고리 관리자**여야 함. 아니면 `403`. → 일반 유저는 최상위 카테고리 생성 불가.

**⑥ Response** 생성된 `Category` 모델(= `updateCategory` 반환값).

**⑦ 주의사항**
- `name` 누락 시 `400`.
- 하위 카테고리에 멤버/부서를 넣을 때는 부모 허용 범위로 제한됨(§6 게이팅).

**⑧ 시나리오**

| 상황 | 결과 |
|---|---|
| office 관리자 + name | 최상위 카테고리 생성 |
| 일반 유저 + 내가 관리하는 parent | 하위 카테고리 생성 |
| 일반 유저 + parent 없음 | `403` |
| 일반 유저 + 관리 권한 없는 parent | `403` |
| name 누락 | `400` |

---

## 5. GET /api/v1/category/{category} — getCategory

카테고리 단건 + 멤버/부서/관리자 목록.

**① METHOD + URL** `GET /api/v1/category/{category}`
**② Path** `{category}` = 카테고리 UUID (route-model binding, **company 스코프 없음** — 전역 PK 조회)
**③ Query** 없음  **④ Body** 없음
**⑤ 인증·권한** (코드상) 멤버/ office 관리자 / 카테고리 관리자가 아니면 `403`. **단, 아래 버그로 실제로는 항상 통과** ⚠.

**⑥ Response** `Category` + 관계:
- `category_members[]` (각 `user`: id·name·profile_image_id·상태 + member)
- `category_departments[]` (각 `department`: id·name·path)
- `category_admins[]` (각 `user`)

**⑦ 주의사항 (⚠ 중요 버그)**
- `isCategoryMember()` 가 쿼리 빌더를 `isset()` 로 검사해 **항상 `true`** 반환(부서 판별 로직은 dead code). 결과적으로 권한 가드가 무력화되어 **인증된 아무 유저나(타 회사 카테고리 포함) 조회 가능**.
- 권한 체크에서 office 관리자 판별을 `isAdminUser($user->id)` 로 호출 — 정상은 `$user->company_id`. user id를 company id로 넘겨 사실상 무효(위 버그로 어차피 도달 안 함).
- `{category}` 는 company 스코프가 없어 존재하지 않으면 `404`(모델 바인딩), 소프트삭제 건은 제외.

**⑧ 시나리오**

| 상황 | 결과 |
|---|---|
| 멤버/관리자 | 카테고리 + 멤버/부서/관리자 |
| (설계상) 권한 없음 | 원래 `403` 이어야 하나 버그로 `200` |
| 없는 id | `404` |

---

## 6. PUT /api/v1/category/{category} — updateCategory

카테고리 속성 수정 + 멤버/관리자/부서를 **하위 전체로 캐스케이드** 반영. 전 과정 트랜잭션.

**① METHOD + URL** `PUT /api/v1/category/{category}`
**② Path** `{category}` = 카테고리 UUID
**③ Query** 없음
**④ Body**

| 필드 | 타입 | 설명 |
|---|---|---|
| `name` | string(min 1) | 카테고리명 |
| `is_active` / `is_post_alarm` / `is_comment_alarm` / `position` | — | `Category` fillable → `fill()` 로 반영 |
| `insert_category_member_user_id` | array | 멤버 추가. 이 카테고리 + **모든 하위 카테고리 + 하위 게시판**에 upsert |
| `delete_category_member_user_id` | array | 멤버 제거. 하위 카테고리 멤버·**관리자**·게시판 멤버·게시판 관리자까지 삭제 |
| `insert_category_admin_user_id` | array | 카테고리 관리자 추가(upsert) |
| `delete_category_admin_user_id` | array | 카테고리 관리자 제거(하위 포함) |
| `insert_category_department_id` | array | 부서 권한 추가. 하위 카테고리/게시판까지 반영 |
| `delete_category_department_id` | array | 부서 권한 제거. 하위 카테고리·게시판 부서까지 삭제 |

- array 필드에 배열이 아닌 값 → `400`.

**⑤ 인증·권한** office 관리자 또는 해당 카테고리의 **카테고리 관리자**. 아니면 `403`.

**⑥ Response** 수정된 `Category` 모델(관계 미포함).

**⑦ 주의사항**
- **캐스케이드 광범위**: insert/delete 대상은 `getChildCategoryTree` 로 구한 하위 트리 전체 + 관련 게시판에 반영됨. 부분 실패 시 전체 롤백(`500`).
- **하위 카테고리 게이팅**: 대상 카테고리에 부모가 있으면, 추가하는 멤버/관리자/부서는 **부모의 허용 범위**(부모 `category_members` + 부모 부서 소속 유저 / 부모 `category_departments` 의 하위 부서)에 있어야 하며, 벗어난 항목은 **에러 없이 조용히 스킵**(`continue`).
- `delete_category_member_user_id` 는 멤버뿐 아니라 관리자·게시판 멤버/관리자까지 함께 제거하므로 영향 큼.

**⑧ 시나리오**

| 상황 | 결과 |
|---|---|
| 관리자 + name 변경 | 반영, 카테고리 반환 |
| 멤버 대량 추가 | 하위 카테고리/게시판까지 upsert |
| 하위에 부모 허용 밖 멤버 추가 | 해당 항목만 스킵(그 외 정상) |
| 권한 없음 | `403` |
| array 필드에 문자열 전달 | `400` |
| 트랜잭션 중 예외 | 롤백 + `500` |

---

## 7. DELETE /api/v1/category/{category} — deleteCategory

카테고리 + **하위 트리 전체 및 연관 데이터** 삭제(소프트 삭제, 매우 파괴적).

**① METHOD + URL** `DELETE /api/v1/category/{category}`
**② Path** `{category}` = 카테고리 UUID  **③ Query** 없음  **④ Body** 없음
**⑤ 인증·권한** office 관리자(대상 카테고리 `company_id` 기준) 또는 카테고리 관리자. 아니면 `403`.

**⑥ Response** 삭제된 `Category` 모델.

삭제 범위(`getChildCategoryTree` 하위 전체):
- 카테고리들, 그 하위 게시판들
- 해당 게시판의 게시글(+썸네일, 첨부 파일 레코드)
- 드라이브 폴더, 드라이브 파일(+ `ProcessDeleteS3File` 잡으로 S3 실제 삭제 디스패치)

**⑦ 주의사항**
- ⚠ **캐스케이드가 게시글·파일·S3까지** 미침. 복구 난이도 높음(S3 삭제는 잡으로 비동기 실행).
- `updateCategory`/`deleteCategory` 와 달리 트랜잭션으로 묶여 있지 않음 — 중간 단계별로 삭제 진행.
- 권한 판별에 `$category->company_id` 사용(정상).

**⑧ 시나리오**

| 상황 | 결과 |
|---|---|
| 관리자 | 카테고리+하위+게시판+게시글+파일 삭제, 카테고리 반환 |
| 권한 없음 | `403` |
| 없는 id | `404` |

---

## 8. PUT /api/v1/category/member/{category} — updateCategoryMember

⚠ **이름과 달리 멤버십 관리가 아님.** 현재 유저의 **카테고리별 개인 알림 설정**(`management.user_category_settings`)을 수정한다. 멤버 추가/삭제는 §6(`updateCategory`)에서 처리.

**① METHOD + URL** `PUT /api/v1/category/member/{category}`
**② Path** `{category}` = 카테고리 UUID
**③ Query** 없음
**④ Body**

| 필드 | 타입 | 설명 |
|---|---|---|
| `is_post_alarm` | bool | 게시글 알림 (UserCategorySetting fillable) |
| `is_comment_alarm` | bool | 댓글 알림 |

**⑤ 인증·권한** `auth:api`. ⚠ **별도 권한/회사 스코프 체크 없음** — 인증만 되면 임의 카테고리 id로 개인 설정 레코드 생성/수정 가능.

**⑥ Response** 저장된 `UserCategorySetting` (`user_id`, `category_id`, `parent_category_id`, `is_post_alarm`, `is_comment_alarm`). 없으면 새로 생성.

**⑦ 주의사항**
- 여기서 저장한 값이 `selectCategory` 응답의 카테고리 `is_post_alarm`/`is_comment_alarm`(개인 설정 반영값)에 나타남.
- 검증 규칙 없음 — 필드 미전달 시 기존/기본값 유지.

**⑧ 시나리오**

| 상황 | 결과 |
|---|---|
| 최초 설정 | 레코드 생성 후 반환 |
| 재설정 | 기존 레코드 갱신 |

---

## 9. 트리 구조 (`makeCategoryTree`)

조회 3종 모두 flat 목록을 `makeCategoryTree` 로 트리화한다.

- 각 노드에 `child_categories[]` 배열이 붙는다.
- `depth === 1` 인 노드만 최상위(루트)로 반환.
- 정렬은 `depth desc, position asc` 로 조회 후 처리(깊은 노드 먼저).

응답 최상위 형태:

| 엔드포인트 | 최상위 형태 |
|---|---|
| `selectCategory`, `selectAdminCategory` | `{ public_boards: [...], categories: [ <루트 트리> ] }` |
| `selectManagerCategory` | `[ <루트 트리> ]` (배열 직접) |

각 카테고리 노드 공통 필드(§0 SQL 기준): `id`(UUID), `company_id`, `user_id`(생성자), `parent_category_id`, `is_active`, `is_post_alarm`, `is_comment_alarm`, `depth`, `name`, `position`, `created_at`, `updated_at`, `deleted_at`, `child_categories[]` (+ 조회별 추가 필드/관계는 각 절 참조).

**⚠ 함정 — 3뎁스 이상 누락**: `makeCategoryTree` 는 노드를 부모 버킷에 넣는 시점이 자기 자식을 채우기 **전**이라(PHP 배열 값복사), 안정적으로 **2뎁스(depth 1 → depth 2)까지만** 중첩된다. depth 3+ 손자 노드는 루트 트리에서 누락될 수 있음. (앱은 `editCategoryPosition` 주석 "2depth 까지" 처럼 2단 구조를 전제.)

---

## 10. 전체 함정 요약

1. **`getCategory` 권한 무력화(보안)**: `isCategoryMember()` 가 `isset(빌더)` 로 항상 `true` → 인증된 누구나 타 회사 포함 임의 카테고리 조회 가능. 부가로 `isAdminUser($user->id)`(→ `company_id` 여야 함) 오용.
2. **`with_category_admin` raw truthiness**: 켜기 `1`, 끄기 생략/`0`. 문자열 `"false"` 는 truthy라 참으로 동작.
3. **응답 형태 불일치**: `selectManagerCategory` 만 배열 반환(`{public_boards, categories}` 아님). 프론트 분기 필요.
4. **`updateCategoryMember` 네이밍/권한**: 멤버십이 아니라 개인 알림 설정 수정, 권한/회사 스코프 체크 없음.
5. **캐스케이드 부작용**: `updateCategory` 멤버/부서 변경과 `deleteCategory` 는 하위 카테고리·게시판(및 게시글·파일·S3)까지 광범위 반영/삭제.
6. **트리 2뎁스 한계**: `makeCategoryTree` 는 3뎁스+ 손자를 누락(§9).
7. **`is_admin` 의미 상이**: selectCategory=게시판 관리자 / selectAdminCategory=항상 true / selectManagerCategory=카테고리 관리자(카테고리 레벨).
8. **`selectAdminCategory` office 관리자 분기**: `is_active` 미필터 → 비활성 카테고리/게시판 포함, 알림 필드 없음.
9. **개인 알림값 오버라이드**: 카테고리 `is_post_alarm`/`is_comment_alarm` 는 저장 컬럼이 아니라 현재 유저의 `user_category_settings`(없으면 true).
10. **하위 카테고리 게이팅**: 부모 허용 밖 멤버/부서 추가는 조용히 스킵.
