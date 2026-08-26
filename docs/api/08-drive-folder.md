# 08. 자료실(Drive) - 폴더 API

Laravel 10 사내 게시판 API의 **자료실 폴더** 관련 엔드포인트 문서입니다.
자료실은 `board.is_drive = true` 인 게시판을 의미하며, 폴더는 `parent_drive_folder_id` 로 트리를 구성합니다.

> 이 문서는 코드(`DriveFolderController`, `DriveController`, `DriveFolder` 모델, `drive.sql`, 권한 헬퍼)를 직접 읽고 작성했습니다.
> 파일(업로드/다운로드/삭제) 관련 API는 별도 문서(`drive/file/*`)를 참고하세요. 이 문서는 **폴더 CRUD + 자료실 조회/트리**만 다룹니다.

---

## 공통 사항

### Base URL
- 로컬: `http://localhost:8000`
- 공통 prefix: `/api/v1`

### 인증 / 미들웨어
모든 엔드포인트는 `locale.set` → `auth:api` 미들웨어를 거칩니다.

| 헤더 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `Authorization` | O | - | `Bearer <access_token>` (Passport OAuth) |
| `Lang` | X | `ko` | 응답 메시지 언어. `ko` / `en` / `ja` 지원 |
| `Time_zone` | X | `Asia/Seoul` | 타임존 |

- 인증 실패(토큰 없음/만료) → `401`
- `Lang` 헤더 값에 따라 아래 에러 메시지 문구가 바뀝니다 (`resources/lang/{ko,en,ja}/validation.php`).

### 사용자 / 권한 모델
- **현재 사용자**: `UserController::getMe()` = `request()->user()` (Passport 토큰의 사용자). `company_id` 로 스코프됩니다.
- **게시판 접근 권한**: `BoardController::checkBoardPermission($board)` → `['read' => bool, 'write' => bool]` 반환.
  - `board.company_id !== user.company_id` 이면 read/write 모두 false (타사 게시판 차단).
  - `board.is_public = true` 이면 무조건 read/write 모두 true.
  - 시스템 관리자(`admins`)이면 read/write 모두 true.
  - 그 외에는 `read_permission` / `write_permission`(ALL / ADMIN / MEMBER) 값과 카테고리·게시판 관리자/멤버/부서 매핑을 조합해 판정.
- **게시판 관리자 여부**: `BoardController::isBoardAdmin($board)` = 게시판 관리자 이거나 상위 카테고리 관리자.
- **회사(시스템) 관리자 여부**: `ManagementController::isAdminUser($companyId)` = `admins` 테이블에 사용자 존재 여부(10초 캐시).

### Route Model Binding
| 바인딩 | 대상 모델 | 키 | 미존재 시 |
|--------|-----------|----|-----------|
| `{board}` | `Board` (`board.boards`) | `id` (UUID) | `404` |
| `{driveFolder}` | `DriveFolder` (`drive.drive_folders`) | `id` (UUID) | `404` |

> `DriveFolder` 는 SoftDeletes 를 사용합니다. **이미 삭제된(soft delete) 폴더 id 로 접근하면 라우트 바인딩 단계에서 404** 가 납니다.

### 에러 응답 형식
실패 시 `ReturnCode::customResponse` / `ReturnCode::validationCheck` 로 응답하며, 공통 형식은 다음과 같습니다.

```json
{ "message": "에러 메시지" }
```

- HTTP status code 는 상황에 따라 `400 / 403 / 404 / 500`.
- 검증 실패(`validationCheck`, `VALIDATION_TYPE_REQUIRED`)는 기본 `400` + `message` 에 첫 번째 검증 오류 문구.
- 환경변수 `APP_ERROR_CODE_DEBUG=true` 인 경우 `code` 필드가 추가로 붙습니다.

### 폴더 로그
폴더 등록/수정/삭제 시 `drive.drive_folder_logs` 에 이력이 남습니다(`type`: `INSERT` / `UPDATE` / `DELETE`, `data` = 폴더 스냅샷 JSON).
단, **다건 삭제(`deleteDriveFolders`)만 로그를 남기지 않습니다** (아래 주의사항 참고).

### drive_folders 테이블 (응답 필드 참고)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | 폴더 ID |
| `user_id` | INT | 생성자 |
| `company_id` | INT | 회사 |
| `category_id` | UUID | 게시판의 카테고리 (서버가 board 에서 세팅) |
| `board_id` | UUID | 게시판(자료실) |
| `parent_drive_folder_id` | UUID \| null | 부모 폴더 (null = 최상위) |
| `position` | INT | 같은 부모 내 정렬 순서 (기본 1) |
| `title` | TEXT | 폴더명 |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | 생성/수정/삭제 시각 |

---

## 엔드포인트 목록

| # | Method | URL | 컨트롤러 메서드 | 설명 |
|---|--------|-----|-----------------|------|
| 1 | POST | `/api/v1/drive/folder/{board}` | `insertDriveFolder` | 폴더 생성 |
| 2 | PUT | `/api/v1/drive/folder/{driveFolder}` | `updateDriveFolder` | 폴더 수정(이름/순서) |
| 3 | DELETE | `/api/v1/drive/folder/{driveFolder}` | `deleteDriveFolder` | 폴더 단건 삭제 |
| 4 | DELETE | `/api/v1/drive/folder/board/{board}` | `deleteDriveFolders` | 폴더 다건 삭제 |
| 5 | GET | `/api/v1/drive/{board}` | `getDrive` | 자료실 조회(폴더 탐색) |
| 6 | GET | `/api/v1/drive/tree/{board}` | `getDriveForTree` | 폴더 트리 조회 |

> **라우트 순서 주의**: `folder/board/{board}` (다건 삭제)가 `folder/{driveFolder}` (단건 삭제)보다 먼저 선언되어 있어, `/drive/folder/board/...` 는 항상 다건 삭제로 매칭됩니다. 폴더 id 는 UUID 이므로 `board` 리터럴과 충돌하지 않습니다.

---

## 1. 폴더 생성

### ① Method + URL
`POST /api/v1/drive/folder/{board}`

### ② Path 파라미터
| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `board` | UUID | O | 자료실 게시판 ID |

### ③ Query 파라미터
없음

### ④ Body payload
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `title` | string | **O** | 폴더명 |
| `parent_drive_folder_id` | UUID | X | 부모 폴더 ID. 없으면 최상위 폴더로 생성 |

> `company_id`, `category_id`, `board_id`, `user_id`, `position` 은 **서버가 계산/세팅**합니다. 클라이언트가 보내도 무시됩니다.
> `position` 은 같은 부모(또는 최상위) 내 `max(position) + 1` 로 자동 부여됩니다.

### ⑤ 인증 / 권한
- `auth:api` 필요.
- `board.is_drive = true` 여야 함. 아니면 `400`.
- `checkBoardPermission($board)['write'] = true` 필요. 아니면 `403`.

### ⑥ Response (200)
생성된 폴더 객체를 그대로 반환.

```json
{
  "id": "a1b2c3d4-...",
  "parent_drive_folder_id": null,
  "company_id": 12,
  "category_id": "cat-uuid-...",
  "board_id": "board-uuid-...",
  "user_id": 34,
  "position": 3,
  "title": "새 폴더",
  "updated_at": "2026-08-26T05:00:00.000000Z",
  "created_at": "2026-08-26T05:00:00.000000Z",
  "id_type": "..."
}
```
(`deleted_at` = null. 폴더 로그는 응답에 포함되지 않음)

### ⑦ 주의사항
- `title` 은 `required` 검증만 있음. **길이/공백 제한 없음** (빈 문자열 `""` 은 required 통과 못 함, 공백만 있는 문자열은 통과).
- `parent_drive_folder_id` 는 **존재 여부/같은 게시판 소속 여부를 검증하지 않습니다.** 잘못된 부모 id 를 보내도 그대로 저장됩니다(고아 폴더 생성 가능). 프론트에서 유효한 부모 id 를 보장할 것.
- 트랜잭션 안에서 폴더 저장 + `INSERT` 로그 기록. 실패 시 롤백 후 `500`.

### ⑧ 시나리오
| 상황 | 결과 |
|------|------|
| 정상 (title 있음, write 권한) | `200` + 폴더 객체 |
| `title` 누락/빈 문자열 | `400` (검증 실패 메시지) |
| 자료실이 아닌 게시판 | `400` `자료실이 아닙니다.` |
| write 권한 없음 | `403` `권한이 없습니다.` |
| 존재하지 않는 board id | `404` |

---

## 2. 폴더 수정

### ① Method + URL
`PUT /api/v1/drive/folder/{driveFolder}`

### ② Path 파라미터
| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `driveFolder` | UUID | O | 수정할 폴더 ID |

### ③ Query 파라미터
없음

### ④ Body payload
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `title` | string | X | 변경할 폴더명 |
| `position` | int | X | 변경할 정렬 순서 |

> **`fillable` 은 `title`, `position` 뿐입니다.** `$driveFolder->fill($request->all())` 로 채우므로 그 외 필드(`parent_drive_folder_id`, `board_id` 등)를 보내도 **무시**됩니다.
> ⚠️ 따라서 이 API 로는 **폴더 이동(부모 변경) 불가**. 이름 변경/순서 변경만 가능.

### ⑤ 인증 / 권한
- `auth:api` 필요.
- 폴더의 `board_id` 로 게시판을 조회(`findOrFail`, 없으면 404).
- `checkBoardPermission($board)['write'] = true` 필요. 아니면 `403`.
- ⚠️ **소유자 체크 없음.** 게시판 write 권한만 있으면 **다른 사람이 만든 폴더도 수정 가능**. (`is_drive` 체크도 없음)

### ⑥ Response (200)
수정된 폴더 객체(1번과 동일한 형태, 값만 갱신).

### ⑦ 주의사항
- 아무 필드도 안 보내도 `200` (변경 없이 저장 + `UPDATE` 로그 기록됨).
- `UPDATE` 로그가 매 호출마다 남으므로, `getDrive`/트리의 `last_drive_folder_log`(최근 수정 이력)에 반영됨.

### ⑧ 시나리오
| 상황 | 결과 |
|------|------|
| 정상 (write 권한) | `200` + 수정된 폴더 |
| write 권한 없음 | `403` `권한이 없습니다.` |
| 존재하지 않는/이미 삭제된 폴더 | `404` |
| `parent_drive_folder_id` 를 보냄 | 무시됨(이동 안 됨), 나머지만 반영 |

---

## 3. 폴더 단건 삭제

### ① Method + URL
`DELETE /api/v1/drive/folder/{driveFolder}`

### ② Path 파라미터
| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `driveFolder` | UUID | O | 삭제할 폴더 ID |

### ③ Query / ④ Body
없음

### ⑤ 인증 / 권한
- `auth:api` 필요.
- 삭제 권한: **폴더 소유자(`driveFolder.user_id === user.id`) 이거나, 게시판 관리자, 또는 회사 관리자** 중 하나. 아니면 `403`.

### ⑥ Response (200)
삭제된 폴더 객체(soft delete 되어 `deleted_at` 이 채워진 상태) 반환.

### ⑦ 주의사항 (하위 처리 방식)
- **하위 폴더가 1개라도 있으면 삭제 불가** → `500` `자식 파일 또는 자식 폴더가 존재합니다.`
- **하위 파일 중 `state = UPLOADING` 또는 `ACT` 가 있으면 삭제 불가** → `500` 동일 메시지.
- 위 두 조건을 통과하면:
  - 해당 폴더 하위의 `state = FAIL` / `DEL` 파일 행을 **DB에서 hard delete** (완전 삭제).
  - 폴더 자신은 **soft delete** (`deleted_at` 세팅).
  - `DELETE` 로그 기록.
- ⚠️ **S3 실제 객체는 이 엔드포인트에서 삭제하지 않습니다.** (활성 파일이 없어야만 폴더 삭제가 되므로, S3 정리는 파일 삭제 흐름에서 처리)
- ⚠️ "하위 존재" 에러가 `400/409` 가 아니라 **`500`** 으로 내려옵니다(코드상 `SERVER_ERROR` 사용). 프론트는 status 500 + 메시지로 구분하거나 사전에 비어있는지 확인 후 호출 권장.

### ⑧ 시나리오
| 상황 | 결과 |
|------|------|
| 정상 (빈 폴더, 권한 있음) | `200` + 삭제된 폴더 |
| 권한 없음(비소유자·비관리자) | `403` `권한이 없습니다.` |
| 하위 폴더 존재 | `500` `자식 파일 또는 자식 폴더가 존재합니다.` |
| 하위 활성/업로드중 파일 존재 | `500` `자식 파일 또는 자식 폴더가 존재합니다.` |
| 존재하지 않는/이미 삭제된 폴더 | `404` |

---

## 4. 폴더 다건 삭제

### ① Method + URL
`DELETE /api/v1/drive/folder/board/{board}`

### ② Path 파라미터
| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `board` | UUID | O | 대상 자료실 게시판 ID |

### ③ Query 파라미터
없음

### ④ Body payload
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | array(UUID) | **O** | 삭제할 폴더 ID 목록 |

```json
{ "id": ["folder-uuid-1", "folder-uuid-2"] }
```

### ⑤ 인증 / 권한
- `auth:api` 필요.
- 관리자(`isBoardAdmin || isAdminUser`)면 대상 게시판 내 지정 폴더 모두 대상.
- **관리자가 아니면 본인(`user_id = user.id`)이 만든 폴더만** 삭제 대상으로 필터링됨.
- 대상은 `company_id = 내 회사`, `board_id = {board}` 로도 한 번 더 스코프됨(타 게시판/타 회사 id 는 무시).

### ⑥ Response (200)
**실제로 삭제된 폴더 id 배열** 반환.

```json
["folder-uuid-1"]
```

### ⑦ 주의사항 (부분 성공 / 하위 처리)
- 삭제 대상은 다음 조건을 **모두 만족하는 폴더만** 선별됩니다:
  - 지정한 `id` 목록 중 **하위 폴더가 없고**(`id` 중 누군가의 부모가 아님),
  - 하위에 `state = ACT` / `UPLOADING` **파일이 없는** 폴더.
- 조건 미충족 폴더는 **조용히 스킵**(에러 없음). 응답 배열로 실제 삭제된 것만 확인 가능.
- 선별된 폴더 처리:
  - 폴더 **soft delete**.
  - 하위 `FAIL` / `DEL` 파일은 **삭제가 아니라 `drive_folder_id = null` 로 업데이트**(고아 처리). ← **단건 삭제(3번)는 hard delete 하는 것과 다름**.
- ⚠️ **폴더 로그(`DELETE`)를 남기지 않습니다** (단건 삭제와의 차이점).
- ⚠️ 삭제 가능한 폴더가 하나도 없으면 `[]` (빈 배열) + `200`. 실패로 취급되지 않음.
- ⚠️ 하위 폴더 판정은 "**요청한 `id` 목록 안에** 자식이 있는지"만 봅니다. 즉 목록에 부모+자식을 함께 넣으면 자식이 먼저 걸려 부모가 스킵될 수 있으니, 프론트는 리프(말단)부터 삭제하거나 관리자 UI 흐름을 고려할 것.

### ⑧ 시나리오
| 상황 | 결과 |
|------|------|
| 정상 (조건 만족 폴더들) | `200` + 삭제된 id 배열 |
| `id` 누락/배열 아님 | `400` (검증 실패) |
| 일부만 조건 만족 | `200` + 삭제된 것만 배열에 포함(부분 성공) |
| 전부 조건 미충족 | `200` + `[]` |
| 비관리자가 타인 폴더 id 지정 | 해당 id 스킵 → 배열에서 제외 |

---

## 5. 자료실 조회 (폴더 탐색)

### ① Method + URL
`GET /api/v1/drive/{board}`

### ② Path 파라미터
| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `board` | UUID | O | 자료실 게시판 ID |

### ③ Query 파라미터
| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `drive_folder_id` | UUID | X | 특정 폴더 내부로 진입. 없으면 최상위 목록 반환 |

### ④ Body
없음

### ⑤ 인증 / 권한
- `auth:api` 필요.
- `checkBoardPermission($board)['read'] = true` 필요. 아니면 `403`.

### ⑥ Response (200)
게시판 객체 + 자료실 전용 필드가 추가되어 반환됩니다. (게시판 기본 컬럼은 게시판 문서 참고)

| 추가 필드 | 타입 | 설명 |
|-----------|------|------|
| `total_usage_size` | int | 게시판 내 `ACT` 파일 크기 합계(byte). 없으면 `0` |
| `is_writable` | bool | 현재 사용자의 쓰기 권한 |
| `is_admin` | bool | 현재 사용자의 게시판 관리자 여부 |
| `child_drive_folders` | array | **전체 폴더 트리**(최상위 + 모든 하위 재귀). 사이드바/트리용 |
| `drive_folders` | array | **현재 레벨의 폴더 목록**(리스트 뷰용) |
| `path` | array | 브레드크럼(현재 폴더까지의 경로). `drive_folder_id` 있을 때만 채워짐 |

- `child_drive_folders[]` 노드 필드: `id`, `user_id`, `parent_drive_folder_id`, `title`, `created_at`, `user`(`{id,name,profile_image_id,disabled_at,deleted_at}`), `last_drive_folder_log`(최근 UPDATE 로그 `{drive_folder_id,user_id,created_at,user}`), `child_drive_folders`(재귀).
- `drive_folders[]` 노드 필드: `id`, `user_id`, `parent_drive_folder_id`, `title`, `created_at`, `user`, `last_drive_folder_log`.
  - `drive_folder_id` **미지정** → 최상위 폴더 목록.
  - `drive_folder_id` **지정** → 해당 폴더의 **직속 자식 폴더 목록**. 폴더를 못 찾으면 `[]`.
- `path[]` 노드: `{ id, title }` (최상위 → 현재 폴더 순서).

```json
{
  "id": "board-uuid",
  "title": "팀 자료실",
  "is_drive": true,
  "total_usage_size": 10485760,
  "is_writable": true,
  "is_admin": false,
  "child_drive_folders": [
    {
      "id": "f1", "user_id": 34, "parent_drive_folder_id": null,
      "title": "기획", "created_at": "...",
      "user": { "id": 34, "name": "홍길동", "profile_image_id": null, "disabled_at": null, "deleted_at": null },
      "last_drive_folder_log": { "drive_folder_id": "f1", "user_id": 34, "created_at": "...", "user": { } },
      "child_drive_folders": [ { "id": "f1-1", "...": "..." } ]
    }
  ],
  "drive_folders": [ { "id": "f1", "user_id": 34, "parent_drive_folder_id": null, "title": "기획", "created_at": "...", "user": {}, "last_drive_folder_log": {} } ],
  "path": []
}
```

### ⑦ 주의사항
- 이 엔드포인트는 **폴더만** 반환합니다. **파일 목록은 포함되지 않음** → 파일은 `/api/v1/drive/file?...` 계열 API로 별도 조회.
- `child_drive_folders`(전체 트리)와 `drive_folders`(현재 레벨)는 **용도가 다릅니다.** 트리 UI = `child_drive_folders`, 현재 폴더 내용 = `drive_folders`.
- `drive_folder_id` 로 진입 시, `child_drive_folders` 트리에서 **열린 경로상의 노드에 `is_open: true` 속성이 추가**됩니다(대상 폴더 + 모든 조상). 트리 자동 펼침에 활용 가능.
- 존재하지 않는 `drive_folder_id` 를 주면 `drive_folders = []`, `path = []` (에러 아님).
- `total_usage_size` 는 `ACT` 상태 파일만 합산(업로드 중/실패/삭제 제외).

### ⑧ 시나리오
| 상황 | 결과 |
|------|------|
| 정상 (read 권한, 최상위) | `200` + 최상위 `drive_folders`, 빈 `path` |
| 정상 (`drive_folder_id` 지정) | `200` + 직속 자식 `drive_folders`, `path` 채워짐, 트리에 `is_open` |
| read 권한 없음 | `403` `권한이 없습니다.` |
| 존재하지 않는 board id | `404` |
| 잘못된 `drive_folder_id` | `200` + `drive_folders=[]`, `path=[]` |

---

## 6. 폴더 트리 조회

### ① Method + URL
`GET /api/v1/drive/tree/{board}`

### ② Path 파라미터
| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `board` | UUID | O | 자료실 게시판 ID |

### ③ Query / ④ Body
없음

### ⑤ 인증 / 권한
- `auth:api` 필요.
- `checkBoardPermission($board)['read'] = true` 필요. 아니면 `403`.

### ⑥ Response (200)
게시판 객체 + 트리 필드.

| 추가 필드 | 타입 | 설명 |
|-----------|------|------|
| `is_writable` | bool | 현재 사용자의 쓰기 권한 |
| `child_drive_folders` | array | 최상위 폴더 + 하위 재귀 트리 |

- 최상위 노드는 **경량 필드**만: `id`, `parent_drive_folder_id`, `title`, `child_drive_folders`.

```json
{
  "id": "board-uuid",
  "title": "팀 자료실",
  "is_writable": true,
  "child_drive_folders": [
    { "id": "f1", "parent_drive_folder_id": null, "title": "기획",
      "child_drive_folders": [ { "id": "f1-1", "parent_drive_folder_id": "f1", "title": "2026" } ] }
  ]
}
```

### ⑦ 주의사항
- `getDrive`(5번)의 트리보다 **가볍게** 최상위는 `id/parent_drive_folder_id/title` 만 내려옵니다. 폴더 이동 대상 선택 등 **순수 트리 렌더링용**.
- ⚠️ **레벨별 필드 불균일 주의**: `childDriveFolders` 관계 정의 자체가 `lastDriveFolderLog`, `user` 를 eager load 하도록 되어 있어, **중첩(하위) 노드에는 `last_drive_folder_log` 등 추가 필드가 함께 실릴 수 있고**, 하위 노드의 `user` 는 `user_id` 미조회로 `null` 이 될 수 있습니다. **트리에서는 `id` / `parent_drive_folder_id` / `title` / `child_drive_folders` 만 신뢰**하세요.
- 파일은 포함하지 않음(폴더 트리만).

### ⑧ 시나리오
| 상황 | 결과 |
|------|------|
| 정상 (read 권한) | `200` + `child_drive_folders` 트리 |
| read 권한 없음 | `403` `권한이 없습니다.` |
| 존재하지 않는 board id | `404` |
| 폴더 0개 | `200` + `child_drive_folders: []` |

---

## 부록: 에러 메시지 (언어별)

| 키 | ko | en | ja |
|----|----|----|----|
| `no_permission` | 권한이 없습니다. | no permission. | 許可なし。 |
| `is_not_drive` | 자료실이 아닙니다. | It's not a data Drive. | It's not a data Drive. |
| `exist_child_content` | 자식 파일 또는 자식 폴더가 존재합니다. | A child file or child folder exists. | A child file or child folder exists. |
