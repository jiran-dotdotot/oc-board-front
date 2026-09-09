# jupiter-board-api — 프론트 연동 API 문서 (v1)

전체 API 72개를 도메인별로 코드 기준 분석한 문서 모음. 각 엔드포인트는 **METHOD/URL · path · query · body · 인증·권한 · response · 주의사항 · 시나리오** 8개 항목으로 정리돼 있음.

## 공통 규약 (모든 문서에 공통 적용)

- **Base URL(로컬)**: `http://localhost:8000` · 모든 v1 경로는 `/api/v1` prefix (단 `GET /api/test`만 예외)
- **인증**: `POST /api/v1/token`, `POST /api/v1/login`, `GET /api/test` 를 제외한 전부 `auth:api` (Passport Bearer)
  - 필수 헤더: `Authorization: Bearer <access_token>`, `lang: ko|en|ja`, `Accept: application/json`
  - 토큰 발급: 로컬은 `OFFICEWAVE_SECRET_KEY`가 비어 `/token` 불가 → `/login`(officenext 경유) 또는 직접 `/oauth/token` password grant
- **에러 형식**: 대부분 `ReturnCode::customResponse(status, {message, ...})`. 단 검증 일부/`firstOrFail`은 프레임워크 기본 404/500이 그대로 나감(상세는 `01-auth-user.md` 상단 참조)
- **목록 필터 공통 규칙** (`app/Http/Filters/Filter.php`):
  - 쿼리 키 == 필터 메서드명일 때만 필터 적용
  - ⚠️ **불리언은 반드시 `1`/`0`** — 문자열 `"false"`도 truthy라 "참"으로 켜짐. (`is_include_comment`만 `->boolean()`이라 안전)
  - ⚠️ **빈 문자열 파라미터 금지** — `board_id=`/`id=` 같은 빈값도 `WHERE = ''`로 전달돼 **0건**. 안 쓰는 키는 아예 빼야 함
  - 페이징: `take`(기본 20) + `page`, 또는 `is_not_paging=1` + `limit`(기본 10)
- **권한**: `BoardController::checkBoardPermission()` — ①타 회사 차단 ②`board.is_public=true`면 즉시 read+write ③비공개는 read/write_permission(`ALL`/`ADMIN`/`MEMBER`) + category/board member·admin·department 조합 ④office 관리자(`isAdminUser`)는 전권. (상세: `04-board.md`)

## 문서 목록

| 파일 | 도메인 | 엔드포인트 |
|---|---|---|
| [01-auth-user.md](01-auth-user.md) | 인증/유저 (token·login·me·test) | 4 |
| [02-management.md](02-management.md) | 관리(관리자·회사설정·유저설정·정렬) | 10 |
| [03-category.md](03-category.md) | 카테고리 | 8 |
| [04-board.md](04-board.md) | 게시판 (+checkBoardPermission 전체 규칙) | 7 |
| [05-post-read.md](05-post-read.md) | 게시글 조회 (목록·상세·main·my·view·badge) | 6 |
| [06-post-write.md](06-post-write.md) | 게시글 작성/수정/삭제/복원/뱃지/북마크 | 9 |
| [07-post-comment-like.md](07-post-comment-like.md) | 댓글·공감(이모지) | 7 |
| [08-drive-folder.md](08-drive-folder.md) | 자료실 폴더·자료실 조회/트리 | 6 |
| [09-drive-file.md](09-drive-file.md) | 자료실 파일 | 9 |
| [10-drive-upload-department-live.md](10-drive-upload-department-live.md) | 업로드(presign 흐름)·부서·라이브 | 6 |

## 전역 함정 Top (프론트 필독)

1. **불리언은 `1`/`0`** — `is_view`, `is_public_only`, `is_not_paging`, `is_bookmark`, `is_drive_root`, `with_category_admin` 등 전부. `"true"/"false"` 문자열 금지.
2. **빈 문자열 파라미터 = 0건** — 안 쓰는 쿼리 키는 생략.
3. **`is_view=1`=읽은 글 / `is_view=0`=안 읽은 글** (0도 정상 동작). 안읽음 배지는 `is_view=0`.
4. **`is_writable`(게시글) = "내 글 여부"**(작성자==나), 쓰기 권한 아님. 실제 쓰기 권한은 `board.write_permission`.
5. **자료실 `start_posted_at`/`end_posted_at`는 실제 `created_at` 필터** (drive엔 posted_at 없음).
6. **삭제 시맨틱 구분**:
   - 게시글: `state=DEL`(휴지통, 복원 가능) ≠ `deleted_at`(영구, `permanent`만). 
   - 댓글 `deleteComment`는 `is_active=false`만 → **comment_count 안 줄어듦**.
   - 자료실 단건삭제=하위 hard delete, 다건삭제=파일 고아처리(로그 미기록).
7. **카운트/알림은 비동기(큐)** — `comment_count`/`like_count`는 응답 즉시 반영 안 됨. 필요시 재조회.
8. **공감 토글은 (유저×대상×`emoji`) 단위** — `emoji` required, 취소해도 soft-delete 레코드가 200으로 옴 → `deleted_at` 유무로 on/off 판정.
9. **이미지/썸네일 URL** — `thumbnail.src`는 URL **배열**(`o`=원본, `s/m/l`=리사이즈). 로컬은 `o`(=`http://localhost:9100/...`) 사용, 리사이즈 서비스는 로컬에 없음.
10. **업로드 다중 presign은 실패해도 HTTP 200** — 원소별 `result.state`로 판정. 파일 다운로드 URL은 목록/상세에 없고 프리사인으로 획득.
11. **정렬 미지정 시 순서 미보장** — 목록은 `sort[by]`/`sort[order]` 명시 권장.
12. **네이밍 트랩** — `PUT /category/member/{category}`·`POST /board/member/{board}`는 "멤버 관리"가 아니라 **본인 알림 설정**. 실제 멤버 변경은 `PUT /category|board/{id}` body.

## ⚠️ 발견된 버그·보안 이슈 (문서화만, 미수정 — 팀 확인 필요)

> 이번 분석 중 코드에서 확인된 실제 결함. 프론트 대응과 별개로 백엔드 티켓 권장.

- **[보안] `GET /category/{category}`(getCategory)** — 권한 가드(`isCategoryMember`)가 쿼리빌더를 `isset()`으로 검사해 항상 true(dead code) → **인증된 아무 유저나 타 회사 카테고리 조회 가능**.
- **[보안] `GET /department/{companyId}`** — 회사 검증이 없어 **임의 companyId 조직도 조회 가능**.
- **[보안] `POST /drive/callback`** — 권한/소유 검증 없음(file_id만 알면 호출).
- **[버그] 공용 board 생성** — 비관리자가 `is_public=true`로 생성 시 `isCategoryAdmin(null)` TypeError로 **500**. 사실상 office 관리자만 정상.
- **[버그] `updateDriveFolder` 소유자 체크 없음** — 게시판 write 권한만 있으면 남의 폴더 수정 가능.
- **[UX] "이미 존재/하위 존재" 류가 409/400이 아닌 500** — `insertCompanySetting` 중복, 폴더 하위 존재 삭제 등. 상태코드로 원인 구분 어려움.
- **[사소] `updateCategoryPosition`** — 오타 컬럼 `positon`으로 저장(기능은 동작).
- **[참고] `.env.*`에 실제 AWS IAM 키 커밋됨** — 유출 위험(별건, 키 회전 권장).

---
생성: 도메인별 서브에이전트 10대가 각 컨트롤러·모델·필터·스키마를 직접 분석 후 작성.
