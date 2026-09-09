# 로그인 직후 메인 조회 — Go 전환 전달 자료

2026-09-08. 대상은 로그인 후 홈·사이드바의 목록 조회다. 백엔드가 전달한17:50:10~11 KST 요청에서 login·me는200, 기존4개 목록 경로는 bearer 추출 단계에서401이었다. 근거는 [백엔드 진단 원본](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/backend-replies/main-page-api-failures.md)이며, 프론트에서 같은 실계정 요청을 재현했다고 주장하는 기록이 아니다.

## 전달 파일과 계약 기준

- 이 파일: `/Users/dotdotot/Documents/Workspace/ov/oc-board-front/docs/features/auth/go-main-backend-handoff.md`
- 누적 대장: [backend-requests.md](/Users/dotdotot/Documents/Workspace/ov/oc-board-front/docs/api/backend-requests.md)
- 프론트: `/Users/dotdotot/Documents/Workspace/ov/oc-board-front`
- 백엔드 원본: `/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/`
- 코드 조사·실행 기준: `feat/settings` · `65b7f49f34b0b934e274437a764455af045b99d3`
- 로컬 API Base URL: `http://localhost:8090/api/v1`. 프론트 복사본은 [docs/api/go/](../../api/go/README.md)이며, 원본 계약과 백엔드 코드는 이번 프론트 작업에서 수정하지 않는다.

## 전환 경로와 응답

아래 `S`는 `/api/v1/board/companies/{company_id}/users/{user_id}`다. Axios baseURL이 이미 `/api/v1`을 포함하므로 서비스에는 `/board/companies/{company_id}/users/{user_id}/...`를 전달한다.

| 기존 전체 경로                             | Go 전체 경로               | 호출·응답 구분                                                                                                | 원문 근거                                                                                  |
| ------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| GET `/api/v1/board?is_bookmark=1&take=100` | GET `S/bookmarks?take=100` | 사이드바 북마크. `is_bookmark` 제거, `data` 배열이 있는 페이지 봉투. 각 행은 BoardView와 `board_id` 별칭이다. | [04:297](../../api/go/04-board.md#L297), [04:330](../../api/go/04-board.md#L330)           |
| GET `/api/v1/post`                         | GET `S/posts`              | 일반 게시글은 페이지 봉투, 공지 등 `is_not_paging=1` 조회는 직접 배열. 함수별 반환 형태를 유지한다.           | [05:241](../../api/go/05-post-read.md#L241), [05:307](../../api/go/05-post-read.md#L307)   |
| GET `/api/v1/drive/file`                   | GET `S/drive-files`        | 홈의 최근 자료는 `is_not_paging=1` 직접 배열. 페이지 조회 함수는 페이지 봉투로 분리한다.                      | [09:187](../../api/go/09-drive-file.md#L187), [09:215](../../api/go/09-drive-file.md#L215) |
| GET `/api/v1/category`                     | GET `S/categories`         | 일반 사용자 트리, `{public_boards,categories}`.                                                               | [03:146](../../api/go/03-category.md#L146), [03:182](../../api/go/03-category.md#L182)     |
| GET `/api/v1/category/admin`               | GET `S/categories/admin`   | 관리자용 트리, `{public_boards,categories}`. 회사관리자 여부와 카테고리 권한의 서버 분기를 따른다.            | [03:201](../../api/go/03-category.md#L201), [03:233](../../api/go/03-category.md#L233)     |

전환한 파일은 [boardService.ts](/Users/dotdotot/Documents/Workspace/ov/oc-board-front/src/services/boardService.ts)·[postService.ts](/Users/dotdotot/Documents/Workspace/ov/oc-board-front/src/services/postService.ts)·[driveService.ts](/Users/dotdotot/Documents/Workspace/ov/oc-board-front/src/services/driveService.ts)·[categoryService.ts](/Users/dotdotot/Documents/Workspace/ov/oc-board-front/src/services/categoryService.ts)의7개 목록 함수다. 일반 카테고리는 신고된4개 경로의 사용자 권한 분기에 해당하므로 함께 전환했다. [boardApi.ts](/Users/dotdotot/Documents/Workspace/ov/oc-board-front/src/lib/boardApi.ts)에서 JWT scope와 요청 세션 ID를 묶고, 계정 변경 시 기존 interceptor가 요청을 취소하게 연결했다.

## 인증·DTO 처리

- 회사·사용자 경로는 현재 board JWT의 identity로 만든다. `/me` 응답이나 화면 선택값으로 다른 스코프를 만들지 않는다. 클레임과 정규10진 문자열이 일치해야 하며, 실제 인증·권한 판정은 서버가 수행한다. [03:156](../../api/go/03-category.md#L156)
- board 토큰은 기존 `/board/` 경계에서 첨부한다. member·미전환 경로까지 전역으로 토큰을 붙이지 않는다. 네트워크 호출 순서 변경으로 우회하지 않고 기존 병렬 조회를 유지한다.
- Go 응답의 null과 조건부 필드는 DTO·표시 변환에서 보존한다. 게시글의 nullable 제목과 뱃지의 `is_active` 판정을 원문에 맞춘다. Laravel 필드·기본값을 보충하지 않는다. [게시글 DTO](../../api/go/05-post-read.md#postview)
- Go 파일 DTO에는 `src`·`position`이 없다. 목록 DTO·표시 변환에서 이 필드 의존을 제거하며, 기존 URL 없음 처리로 다운로드·미리보기 불가를 표시한다. **다운로드·미리보기의 Go 연결은 남아 있다.** 전용 download-url API가 있으므로 새 `src` 필드 요청이나 계약 누락으로 분류하지 않는다. [09:57](../../api/go/09-drive-file.md#L57), [09:575](../../api/go/09-drive-file.md#L575), [BR-014](../../api/backend-requests.md#br-014)

## 백엔드 확인 사항과 남은 범위

[BR-013](../../api/backend-requests.md#br-013)은 프론트 미전환으로 유지한다. 이 다섯 목록 경로의 신규 API 추가는 필요하지 않다. 상세·쓰기·삭제/복원·업로드·다운로드·설정의 남은 호출은 이번 목록 전환으로 완료된 것으로 계산하지 않는다. 설정용 member 자격 공급은 [BR-012](../../api/backend-requests.md#br-012)로 별도 관리한다.

[BR-030·031 회신](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/backend-replies/BR-030-BR-031.md)에 따른 후속 상태:

- 로컬 인증 면제·설정·DB 스키마 차단 해소와 실제 사용자 login·me200: 백엔드 작성자가 확인했다.
- localhost:5174·5188에서 Lang·Time_zone 포함 preflight 허용: 백엔드 작성자가 확인했다. [BR-031](../../api/backend-requests.md#br-031)은 개발 환경 해결이며 운영 Origin은 [BR-028](../../api/backend-requests.md#br-028)에 남긴다.
- 실제 발급 refresh의 HTTP 회전과 동일 refresh 재사용401: 아직 미검증이다. Repository/DB 롤백 검사를 이 결과로 대체하지 않는다. [BR-030](../../api/backend-requests.md#br-030)
- 전환 후 실제 계정으로 목록 응답·권한 분기가 성공하는지 확인해야 한다. 실패가 남으면 METHOD·전체 경로·시각·status·error.code·request ID를 전달한다. 비밀번호·bearer·refresh·사용자 응답 본문은 전달하지 않는다.

## 검증 기록

2026-09-08 18:04 KST 프론트에서 직접 수행했다.

- `npm run build`·`npm run lint`: 통과. 기존 CSS 예시의 `|` 관련 경고2개와 큰 번들 경고는 유지됐다.
- `npm run test`: 11파일·129개 통과. [goMainApi.test.ts](/Users/dotdotot/Documents/Workspace/ov/oc-board-front/tests/goMainApi.test.ts)의5개 검사는7개 목록 함수의 scope·bearer·Lang·쿼리·응답 분리와 잘못된 토큰/계정 변경 시 요청 취소를 확인한다.
- `npm run test:e2e`: 7개 통과. [go-main.spec.ts](/Users/dotdotot/Documents/Workspace/ov/oc-board-front/tests/e2e/go-main.spec.ts)는 관리자·일반 사용자 로그인 후 홈/사이드바의 데이터·공지 활성 여부·nullable 필드 처리를 확인한다. **모의 Go 계약 응답**을 사용하며 실계정 API 성공 검증이 아니다.
- 18:04:12 KST `localhost:8090`에 자격정보 없이 수행한 대조 검사: POST login/refresh JSON `{}`는400 `INVALID_PAYLOAD`, GET me는401 `UNAUTHORIZED`. GET me용 OPTIONS는 Origin `http://localhost:5174`·`http://localhost:5188` 각각204이며 Authorization·Content-Type·Lang·Time_zone을 허용했다. 실제 토큰 발급·목록 조회·refresh 회전은 수행하지 않았다.
- 최종 문서 대조: 백엔드 README에 추가된 refresh DDL 이슈를 원문 재복사로 반영했다. Go11파일의 목록·바이트 일치, 변경 문서의 로컬 링크·인용 범위 오류0, BR31개 요약·본문·7필드 일치를 확인했다. 훅·전역 apiClient·Laravel 원문은 이번 메인 연결 작업에서 변경하지 않았다.

백엔드에 필요한 다음 확인은 실계정으로 위4개 메인 조회의200과 올바른 회사·사용자 범위, 그리고 실제 refresh 회전·재사용401이다. 프론트의 모의 응답 검사를 이 결과로 대체하지 않는다.
