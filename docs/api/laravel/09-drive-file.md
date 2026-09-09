# 09. 자료실 파일 API (Drive File)

`App\Http\Controllers\Drive\DriveFileController` 담당 엔드포인트 문서. 코드 직접 확인 기준(추측 없음).

- 소스: `routes/api.php`, `app/Http/Controllers/Drive/DriveFileController.php`, `app/Http/Filters/DriveFileFilter.php`, `app/Http/Filters/Filter.php`, `app/Models/Drive/DriveFile.php`, `app/Models/Drive/DriveFileBookmark.php`, `app/Http/Response/ReturnCode.php`, 스키마 `doc/v1/drive.sql`

---

## 공통 사항

| 항목 | 값 |
|---|---|
| Base URL(로컬) | `http://localhost:8000` |
| Prefix | `/api/v1` |
| 미들웨어 체인 | `v1` → `locale.set` → `auth:api` (Passport Bearer) |
| 필수 헤더 | `Authorization: Bearer <token>`, `lang: ko\|en\|ja`, `Accept: application/json` |
| 현재 유저 | `UserController::getMe()` — 항상 `company_id` 스코프 적용 |

### drive_files 필드 (`drive.drive_files`)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | int | 업로더 |
| `company_id` | int | 회사 스코프 |
| `category_id` | uuid | 카테고리 |
| `board_id` | uuid | 게시판(자료실) |
| `drive_folder_id` | uuid | 폴더(루트면 null) |
| `state` | text | `WAIT`(기본)/`UPLOADING`/`FAIL`/`ACT`(활성)/`DEL`(휴지통) |
| `position` | int | 순서 |
| `src` | text | **S3 오브젝트 키** (다운로드 URL 아님) |
| `origin_file_name` | text | 원본 파일명 (검색 대상) |
| `size` | bigint | 파일 크기(Byte) |
| `extension` | text | 확장자 |
| `delete_user_id` | int | 삭제(또는 복원) 수행자 |
| `upload_expire_at` | timestamptz | 업로드 만료 일시 |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | `deleted_at`=SoftDelete (state=DEL과 별개) |

- **appends**: `is_bookmark` (bool) — 모든 파일 직렬화에 포함. 현재 유저 기준 북마크 여부, 캐시 6000초(`drive_file_bookmark_{fileId}_{userId}`).
- 상수: `MAX_FILE_SIZE = 3221225472` (3GB).
- 관계: `user`(id,name,profile_image_id,disabled_at,deleted_at) / `board`(hasOne) / `deleteUser`(삭제자).

### 에러 응답 형식 (`ReturnCode`)

| 상황 | HTTP | 바디 |
|---|---|---|
| 검증 실패 `validationCheck(REQUIRED)` | `400` | `{ "message": "<첫 검증오류>" }` (+ env `APP_ERROR_CODE_DEBUG` 켜지면 `code:501`) |
| 권한 없음 `customResponse(FORBIDDEN)` | `403` | `{ "message": "..." }` (`validation.no_permission`) |
| 리소스 없음 `customResponse(NOT_FOUND)` | `404` | `{ "message": "..." }` (`validation.not_found`) |

- 모두 `abort(response($json, $status))` — 지정 status의 JSON. `code`/`response` 키는 옵션으로 있을 때만 포함.
- 인증 실패는 `auth:api` 미들웨어가 `401` 처리.

### ⚠️ 불리언 파라미터 함정 (전 엔드포인트 공통)

컨트롤러의 불리언 판단은 전부 `$request->input()` **raw truthiness** (`->boolean()` 아님). 쿼리스트링 값은 문자열이므로 PHP 문자열 truthiness가 그대로 적용됨:

- **끄기(off)**: 파라미터 생략 / `""` / `"0"`
- **켜기(on)**: 그 외 모든 값 — `"1"`, `"true"`, 그리고 **`"false"` 도 켜짐(문자열 "false"는 PHP에서 truthy!)**

대상: `is_drive_root`, `is_public_only`, `is_not_paging`, `is_only_file_search`, `is_bookmark`.

---

## 1. GET `/api/v1/drive/file` — 파일 목록 (selectDriveFile)

**① METHOD + URL**: `GET /api/v1/drive/file`
**② Path**: 없음
**③ Query**

필터 (DriveFileFilter):

| 파라미터 | 타입/기본 | 설명 · 함정 |
|---|---|---|
| `id` | uuid | 특정 파일 |
| `board_id` | uuid | 게시판별 |
| `drive_folder_id` | uuid | 폴더별 |
| `category_id` | uuid | 하위 카테고리 포함(`getChildCategoryTree`) |
| `user_id` | int | 업로더 id |
| `user_name` | string | 업로더명 부분일치(ilike) |
| `search` | string(≥2) | 파일명(`origin_file_name`) OR 업로더명. **2글자 미만이면 조용히 무시** |
| `title` | string(≥2) | 파일명 부분일치. **검증 `string\|min:2` → 1글자면 400** |
| `title_content` | string(≥2) | `title`과 동일(파일명만). 단 검증 없음 → 1글자면 조용히 무시 |
| `start_posted_at` / `end_posted_at` | datetime | ⚠️ 이름과 달리 **`created_at`** 범위 필터 (drive_files엔 posted_at 없음) |
| `limit_day` | int | 최근 N일(`created_at`). ⚠️ 값이 raw로 SQL INTERVAL에 삽입됨(숫자만 전달) |
| `sort` | object | 아래 참고 |
| `more_field` | string(csv) | `board` 또는 `*` 포함 시 응답에 `board` 관계 eager load |

페이징/스코프 (컨트롤러 직접 처리):

| 파라미터 | 기본 | 설명 |
|---|---|---|
| `take` | 20 | 페이지 크기(페이징 모드) |
| `page` | 1 | 페이지 번호(Laravel 표준) |
| `is_not_paging` | off | 켜면 페이징 없이 `limit`개 반환 |
| `limit` | 10 | `is_not_paging` 켰을 때 개수 |
| `is_public_only` | off | 켜면 공용 게시판만 |
| `is_drive_root` | off | 켜면 `drive_folder_id`를 강제 `null`(루트 파일만) |
| `is_only_file_search` | off | `search`/`title` 값이 있을 때만 그 값을 최근검색어로 저장(부수효과 게이트) |

**정렬 `sort`**
- 컬럼: `sort[by]=<컬럼>&sort[order]=asc\|desc` (기본 `created_at desc`). `by`는 `drive.drive_files` 실제 컬럼이어야 하며 아니면 무시.
- 관련도: `sort[by]=relative&sort[value]=<키워드>&sort[order]=desc` — 파일명 내 키워드 매칭수(`search_count`)로 정렬 후 `created_at desc`. `value` 없으면 정렬 미적용.

**④ Body**: 없음(전부 쿼리)
**⑤ 인증·권한**
- `auth:api` 필수. `company_id` + `state=ACT`(업로드 완료)만 조회.
- 일반 사용자: 공용 게시판(`getUserPublicBoardIds`) + (is_public_only 아니면) 소속 게시판(`getUserBoardIds`)의 `board_id`만.
- 관리자(`isAdminUser`): 회사 전체. 단 `is_public_only` 켜면 공용 게시판으로 제한.

**⑥ Response**
- 기본(`is_not_paging` off): Laravel 페이지네이션 객체 `{ data:[...], total, current_page, per_page, ... }`.
- `is_not_paging` on: 파일 배열.
- 각 파일: 위 drive_files 필드 + `is_bookmark`. `user` 항상 포함, `board`는 `more_field` 지정 시.

**⑦ 주의사항**
- `selectDriveFile`은 `public static` — 라우트 외 `PostController`(메인 자료실)에서도 재사용됨.
- `is_only_file_search`+`search`/`title` 조합 시 **최근검색어 저장 부수효과**(`ProcessUpdateUserSearchKeyword` 디스패치).
- `start_posted_at`/`end_posted_at`가 실제 `created_at` 필터라는 점(이름 오해 주의).
- 다운로드 URL 없음 — `src`는 S3 키.

**⑧ 시나리오**
- 정상: `GET /drive/file?board_id=<uuid>&is_drive_root=1&take=20&page=1` → 해당 자료실 루트 ACT 파일 페이지.
- 정상(무페이징): `GET /drive/file?is_not_paging=1&limit=5&more_field=board`.
- 검증실패: `GET /drive/file?title=A` → 400(`title` min:2).
- 엣지: `title_content=A`(1글자) → 400 아님, 필터만 무시. `is_public_only=false`(문자열) → 켜짐(트랩).

---

## 2. GET `/api/v1/drive/file/my` — 내 파일 (selectMyDrive)

**① METHOD + URL**: `GET /api/v1/drive/file/my`
**② Path**: 없음
**③ Query**

| 파라미터 | 타입/기본 | 설명 |
|---|---|---|
| `is_bookmark` | bool/off | 켜면 내 북마크 파일 목록 모드 |
| `state` | string | `is_bookmark` 아닐 때 대상 상태. `WAIT`/`UPLOADING`/`FAIL`/`ACT`/`DEL` |
| `take` | 20 | 페이지 크기 |
| `page` | 1 | 페이지 번호 |

- 검증: `state` => `required_if:is_bookmark,0` — `is_bookmark=0`을 **명시**했을 때만 `state` 필수.

**④ Body**: 없음
**⑤ 인증·권한**: `auth:api`. `company_id` 스코프. 북마크 아닐 땐 `user_id=본인` 파일만.
**⑥ Response**: 페이지네이션 객체. 관계 `user`, `board` 항상 포함. `state=DEL` 조회 시 `deleteUser` 포함.

- `is_bookmark` on: `state=ACT` + 내 북마크 파일, `created_at desc`.
- `is_bookmark` off: `user_id=본인` + `state=<state>`. `DEL`이면 `updated_at desc`, 그 외 `created_at desc`.

**⑦ 주의사항**
- ⚠️ **`is_bookmark`와 `state` 둘 다 생략하면** 검증 통과하지만 컨트롤러가 `state=null`로 조회 → **빈 결과**. 북마크 모드가 아니면 항상 `state` 전달할 것.
- `is_bookmark=0` 명시 + `state` 누락 → 400.

**⑧ 시나리오**
- 정상: `GET /drive/file/my?state=ACT` → 내 활성 파일.
- 정상(휴지통): `GET /drive/file/my?state=DEL` → 내 삭제 파일(삭제자 포함, updated_at desc).
- 정상(북마크): `GET /drive/file/my?is_bookmark=1`.
- 검증실패: `GET /drive/file/my?is_bookmark=0` (state 없음) → 400.
- 엣지: 파라미터 없음 → 200이지만 빈 목록.

---

## 3. GET `/api/v1/drive/file/{driveFile}` — 파일 상세 (getDriveFile)

**① METHOD + URL**: `GET /api/v1/drive/file/{driveFile}`
**② Path**: `driveFile` = 파일 uuid (라우트 모델 바인딩)
**③ Query**: 없음
**④ Body**: 없음
**⑤ 인증·권한**
- `auth:api`. 파일의 `board` 없으면 404.
- `checkBoardPermission(board).read`가 false면 403.

**⑥ Response**: DriveFile 단건(모든 필드 + `is_bookmark`), `user` 포함.
**⑦ 주의사항**
- 라우트 바인딩은 **SoftDelete(`deleted_at`)만** 제외 → `state`가 `WAIT`/`UPLOADING`/`FAIL`/`DEL`인 파일도 상세 조회 가능(state 필터 없음).
- `src`는 S3 키. 즉시 사용 가능한 다운로드 URL은 반환하지 않음(아래 "다운로드" 참고).

**⑧ 시나리오**
- 정상: `GET /drive/file/<uuid>` → 상세.
- 권한실패: 비공개 게시판·미소속 → 403.
- 엣지: 존재하지 않거나 `deleted_at` 설정 파일 → 404(바인딩). board 삭제/누락 → 404.

---

## 4. DELETE `/api/v1/drive/file` — 내 파일 삭제(휴지통) (deleteMyDriveFiles)

**① METHOD + URL**: `DELETE /api/v1/drive/file`
**② Path**: 없음
**③ Query**: 없음
**④ Body**: `{ "id": ["<uuid>", ...] }` — `id` array 필수
**⑤ 인증·권한**: `auth:api`. `user_id=본인` 파일만 대상(관리자 우회 없음).
**⑥ Response**: 정수(업데이트된 행 수).
**⑦ 주의사항**: 물리 삭제 아님 — `state=DEL`, `delete_user_id=본인`으로 이동(휴지통). 내 소유 아닌 id는 조용히 무시(카운트에 안 잡힘).
**⑧ 시나리오**
- 정상: body `{id:[a,b]}` → `2`.
- 검증실패: `id` 누락/비배열 → 400.
- 엣지: 남의 파일 id만 전달 → `0`.

---

## 5. DELETE `/api/v1/drive/file/permanent` — 영구 삭제 (deletePermanentDriveFiles)

**① METHOD + URL**: `DELETE /api/v1/drive/file/permanent`
**② Path**: 없음
**③ Query**: 없음
**④ Body**: `{ "id": ["<uuid>", ...] }` — `id` array 필수
**⑤ 인증·권한**: `auth:api`. `user_id=본인` + `state ∈ {DEL, UPLOADING, FAIL}` 파일만.
**⑥ Response**: 삭제 대상 파일 컬렉션(삭제 직전 스냅샷).
**⑦ 주의사항**
- 각 파일 `->delete()`(SoftDelete: `deleted_at` 설정) + `ProcessDeleteS3File` 디스패치로 **실제 S3 오브젝트 제거**.
- **`ACT` 상태는 대상 아님** — 먼저 휴지통(`DEL`)으로 보낸 뒤 영구삭제 가능. 조건 안 맞는 id는 조용히 제외.

**⑧ 시나리오**
- 정상: 휴지통 파일 id 전달 → 해당 파일 반환 + S3 삭제 잡 등록.
- 검증실패: `id` 누락 → 400.
- 엣지: `ACT` 파일 id → 결과에서 제외(삭제 안 됨).

---

## 6. DELETE `/api/v1/drive/file/{driveFile}` — 단건 삭제(휴지통) (deleteDriveFile)

**① METHOD + URL**: `DELETE /api/v1/drive/file/{driveFile}`
**② Path**: `driveFile` = 파일 uuid
**③ Query**: 없음
**④ Body**: 없음
**⑤ 인증·권한**: 다음 중 하나면 허용, 아니면 403 — **본인 소유** OR `isAdminUser(company)` OR `isBoardAdmin(board)`.
**⑥ Response**: 업데이트된 DriveFile(state=DEL 반영).
**⑦ 주의사항**: `state=DEL`, `delete_user_id=본인` 저장. 물리 삭제 아님.
**⑧ 시나리오**
- 정상(본인/관리자): 200 + 파일.
- 권한실패: 타인 파일 + 비관리자 → 403.
- 엣지: 없는/soft-deleted 파일 → 404(바인딩).

---

## 7. DELETE `/api/v1/drive/file/board/{board}` — 게시판 파일 일괄 삭제 (deleteDriveFiles)

**① METHOD + URL**: `DELETE /api/v1/drive/file/board/{board}`
**② Path**: `board` = 게시판 uuid
**③ Query**: 없음
**④ Body**: `{ "id": ["<uuid>", ...] }` — `id` array 필수
**⑤ 인증·권한**
- 관리자 판정: `isBoardAdmin(board)` OR `isAdminUser(company)` OR `isCategoryAdmin(category)`.
- 관리자면 해당 게시판 내 지정 파일 전부, **비관리자면 `user_id=본인` 것만** 대상.

**⑥ Response**: 정수(업데이트 행 수).
**⑦ 주의사항**: `board_id=path board` 로 항상 스코프. `state=DEL`, `delete_user_id=본인`. 물리 삭제 아님.
**⑧ 시나리오**
- 정상(관리자): 타인 포함 일괄 → N.
- 정상(일반): 본인 것만 → 본인 소유 수.
- 검증실패: `id` 누락 → 400.
- 엣지: 다른 게시판 파일 id → 제외.

---

## 8. POST `/api/v1/drive/file/bookmark/{driveFile}` — 북마크 토글 (bookmarkDriveFile)

**① METHOD + URL**: `POST /api/v1/drive/file/bookmark/{driveFile}`
**② Path**: `driveFile` = 파일 uuid
**③ Query**: 없음
**④ Body**: 없음
**⑤ 인증·권한**: `auth:api`. `checkBoardPermission(board).read` false면 403.
**⑥ Response**: `DriveFileBookmark` 모델(`user_id`, `drive_file_id`, `created_at`, `deleted_at`). (테이블에 `updated_at` 없음 — `timestamps=false`)

동작(토글):
- 북마크 레코드 없음 → 신규 생성(추가).
- 있고 `deleted_at` 설정됨 → `deleted_at=null` 복원(다시 추가).
- 있고 활성 → soft delete(해제) 후 반환.

**⑦ 주의사항**
- 반환값만으로 최종 상태 판단하기 애매 → 이후 파일의 `is_bookmark`(캐시 자동 무효화됨)로 확인 권장.
- 응답 상태코드는 추가/해제 모두 200.

**⑧ 시나리오**
- 정상: 첫 호출 추가 → 다음 호출 해제(토글).
- 권한실패: 읽기 권한 없는 게시판 파일 → 403.

---

## 9. POST `/api/v1/drive/file/restore` — 복원 (restoreDriveFile)

**① METHOD + URL**: `POST /api/v1/drive/file/restore`
**② Path**: 없음
**③ Query**: 없음
**④ Body**: `{ "id": ["<uuid>", ...] }` — `id` array 필수
**⑤ 인증·권한**: `auth:api`. `user_id=본인` + `state=DEL` 파일만 복원 대상.
**⑥ Response**
```json
{
  "success_drive": ["<boardId>", ...],
  "success_count": 3,
  "fail_drive": ["<boardId>", ...],
  "fail_count": 1
}
```
- 게시판별로 묶어 판정. 게시판 `size_limit > 0` 이고 `size_limit < (현재 ACT 총합 + 복원 크기)` 면 **용량 초과로 실패**, 나머지는 성공.
- 성공 게시판의 파일만 `state=ACT`로 업데이트.

**⑦ 주의사항**
- 판정 단위가 **게시판(board)** — 한 게시판이 초과면 그 게시판의 요청 파일 전부 실패 처리.
- 복원 시에도 `delete_user_id=본인`으로 세팅됨(설계상 잔재, 복원자 표기로 남음).
- 본인 소유·`DEL` 아닌 id는 대상 제외.

**⑧ 시나리오**
- 정상: 용량 여유 → `success_drive`에 게시판, 파일 ACT 전환.
- 부분 실패: 특정 게시판 용량 초과 → 해당 게시판 `fail_drive`, 나머지 성공.
- 검증실패: `id` 누락/비배열 → 400.

---

## 다운로드(파일 내려받기)에 관한 사실

- 위 목록/상세 응답은 **다운로드 URL을 포함하지 않음**. `src`는 S3 오브젝트 키일 뿐.
- 프리사인 GET 생성 로직은 `S3UploadController::getTemporaryUrl` 에 존재(만료 5분, 응답 `{ url, origin_file_name }`).
- ⚠️ 단, `getTemporaryUrl`은 **현재 `routes/api.php` 어디에도 라우트로 등록되어 있지 않음**(코드상 미노출). 실제 다운로드 노출 경로는 별도 확인/추가 필요.
- 업로드는 파일 API가 아니라 `POST /drive/pre-signed-url[/multiple]/{board}` → (호스트 PUT) → `POST /drive/callback` 흐름.
