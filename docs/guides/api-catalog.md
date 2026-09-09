# OC Board — Go API 카탈로그

**기능·페이지 개발 전에 확인하는 Go 전용 색인이다.** 구현 계약은 [현재 Go 문서](../api/go/README.md)와
아래 도메인 본문만 사용한다. 원하는 동작이 이미 제공되면 연동을 먼저 제안한다.

- 원본: `oc-api-go/doc/api/`, `feat/settings`, 기준 커밋 `65b7f49f34b0b934e274437a764455af045b99d3`.
  현재 로컬 원본 11개를 기준으로 문서의 METHOD+전체 경로를 새로 추출했다. 과거 프론트 요약이나 Laravel 개수에서 계산하지 않았다.
- 아래는 **등록된 Go 67개**다. onpremise DB까지 있는 조립은 **89 = 67 + 제외 22**이며,
  onpremise DB가 없는 설정에서는 해당 15개가 등록되지 않아 **74개**다. 이는 배포별 설정 조건이지 67개 업무 색인이 바뀐다는 뜻이 아니다.
  [원문 범위·등록표](../api/go/README.md#등록-라우트-전수-대조표)
- backend `doc/api/`의 현재 로컬 파일은 미추적 상태여서 기준 커밋에서 `git show`로 읽은 문서가 아니다.
  복사본의 출처·원문 코드 링크 해석은 [스냅샷 안내](../api/README.md)를 따른다.
- Laravel 문서는 기본적으로 열지 않는다. Go 계약만으로 구현이 불가능하거나 오류가 나는 구간에서만
  과거 백엔드를 역방향으로 확인하고 [백엔드 요청 대장](../api/backend-requests.md)에 누적한다.
  Laravel에만 있는 필드·타입·기본값을 만들어 쓰지 않는다. 기존 대장의 항목도 새 Go 근거로 재판정한다.
- 레거시 Vue 프론트 `../jupiter-board-web`을 화면 작업 전에 읽는 규칙은 그대로다.
  백엔드 `jupiter-board-api`의 API 문서 열람 정책과 구분한다.
- [프론트 연동 가이드](api-reference.md) · [Vue 권한 흐름 문서](permissions-guide.md)

## 0. 공통 계약을 찾는 순서

상세 파라미터·응답 DTO·생략/null의 효과는 각 행의 원문으로 이동해 확인한다. 표의 기능 이름만으로
다른 엔드포인트의 body나 DTO를 재사용하지 않는다.

| 항목 | 현재 Go 계약·확인 위치 |
|---|---|
| 인증 | `board`는 자체 HS256 board bearer, `member`는 OfficeWave ES256 + 정확한 `ROLE_MEMBER`; 서로 교환해 쓰지 않는다. `exempt`도 토큰 교환·로그인·refresh body의 자격증명 검증은 수행한다. [인증 계약](../api/go/README.md#auth-contracts) |
| 경로 스코프 | 인증401 → token 회사/사용자 문자열 비교403 → 입력검증 순서. `01`·`+1` 같은 비정규 표기는 거절된다. [인증 계약](../api/go/README.md#auth-contracts) |
| 에러 | Huma 봉투의 `error.code`·status로 분기한다. board/관리/이미지 스키마400, 도메인별400·409·422, 버전 스키마422를 구분한다. gin 인증·스코프 오류는 영어 고정이며 미등록 경로·panic은 Huma 봉투를 보장하지 않는다. [입력·오류](../api/go/README.md#huma-common) |
| Body·null | 전체 Body 기본1MiB, 읽기 제한5초. optional null의 실제 처리는 decoder·도메인별로 다르고 추가 키도 엔드포인트별 허용/거부가 다르다. `null`을 일괄 금지하거나 생략과 일괄 동치로 처리하지 않는다. [입력·오류](../api/go/README.md#huma-common) |
| 불리언·배열 쿼리 | 진짜 bool의 ParseBool, 문자열의 엄격 파싱, PHP truthiness, 알림 enum을 구분한다. `is_` 이름만으로 파서를 정하지 않는다. 배열은 반복키 또는 문서의 bracket 표기; `%5b`만 있는 인코딩은 전처리를 우회할 수 있다. [입력·오류](../api/go/README.md#huma-common) |
| 성공 봉투 | 직접 객체·배열·페이지·빈 Body가 공존한다. 등록 struct 응답은 본문 최상위에 `$schema`, 헤더에 `Link`가 붙을 수 있고 배열·map·빈 Body·gin 응답에는 없다. [Huma 특수필드](../api/go/README.md#schema-field) |
| 목록·조회 부수효과 | 게시글 검색 GET은 최근검색어를 기록할 수 있고, 상세 GET은 미삭제 ACT 글의 열람 이벤트를 호출마다 동기 추가한다. prefetch·재시도 전에 확인한다. [게시글 조회](../api/go/05-post-read.md) |
| 부분 성공·토글 | `200`만으로 전건 성공을 판정하지 않는다. 일괄 `ignored_ids`, 폴더 삭제의 실제 삭제 ID 배열, 업로드 `result.state`·완료 파일 `state`를 읽는다. 북마크·공감 재시도는 다시 반전한다. [전역 함정](../api/go/README.md#전역-함정-top-12) |
| 삭제·복원 | 게시글 삭제자/작성자, 파일 업로더/관리자, 폴더 소유자/CanManage 규칙은 서로 다르다. 파일의 휴지통은 `deleted_at`, 댓글은 `is_active`. purge200은 즉시 S3 삭제 완료가 아니다. [게시글 쓰기](../api/go/06-post-write.md) · [자료실 파일](../api/go/09-drive-file.md) |
| 다운로드·업로드 | 첨부·파일 URL은 별도 API로 발급한다. URL 발급200은 S3 객체 존재를 보장하지 않는다. 업로드는 예약·presigned PUT·완료3단계를 수행하고 ACT 여부로 판정한다. [업로드](../api/go/10-upload-department-client.md) |
| 날짜·언어 | `Time_zone`은 밑줄이며 잘못된 zone도 Asia/Seoul로 폴백한다. UTC 소수6자리·일부 `/me` KST 고정 PG형·부서 RFC3339를 구분한다. 표시명 Lang와 에러 언어 매칭 규칙도 다르다. [헤더·시각](../api/go/README.md#헤더로케일) |
| 운영 확인 | 공개 origin·활성 설정/TTL, S3/CDN/CORS, 외부 인증/알림 가용성과 실제 worker 실행은 코드 기본값으로 확정하지 않는다. [코드 밖의3개 항목](../api/go/README.md#코드-밖에서-결정되는-값) |

## 1. 문서화 대상 67개

전체 경로는 `Base URL` 뒤에 그대로 붙인다. `{company_id}`·`{user_id}`는 해당 토큰의 정규 숫자 ID,
나머지 리소스 `{id}`는 각 본문의 UUID를 넣는다. 원문 링크는 복사한 Go 도메인의 해당 엔드포인트 절이다.

### 01. 인증·유저 — 4개

| 도메인 | METHOD · 전체 경로 | 기능 | 인증 | 주의 | 원문 |
|---|---|---|---|---|---|
| 01 인증·유저 | `POST /api/v1/board/token` | OfficeWave 토큰 교환 | `exempt` | 본문 member JWT 검증; 관리자 동기화·refresh 저장도 수행 | [01:218](../api/go/01-auth-user.md#post-apiv1boardtoken) |
| 01 인증·유저 | `POST /api/v1/board/login` | OfficeNext 계정 로그인 | `exempt` | board 토큰만 반환; 상위 status와 로컬 오류를 구분 | [01:274](../api/go/01-auth-user.md#post-apiv1boardlogin) |
| 01 인증·유저 | `POST /api/v1/board/refresh` | board 토큰 갱신 | `exempt` | refresh 일회 소비 후 새 발급; 응답유실·후속 실패에도 재사용 불가 | [01:334](../api/go/01-auth-user.md#post-apiv1boardrefresh) |
| 01 인증·유저 | `GET /api/v1/board/me` | 내 프로필·기본 소속·설정 조회 | `board` | 없는 관계는 null; 일부 시각은 KST PG형, 토큰 회사와 현재 소속이 다를 수 있음 | [01:391](../api/go/01-auth-user.md#get-apiv1boardme) |

### 02. 관리·설정·정렬 — 6개

| 도메인 | METHOD · 전체 경로 | 기능 | 인증 | 주의 | 원문 |
|---|---|---|---|---|---|
| 02 관리·설정·정렬 | `POST /api/v1/companies/{company_id}/admins` | 회사 관리자 추가 | `member` | 회사 관리자만; 중복403, 삭제 관리자 복원 응답 created_at은 현재시각 | [02:121](../api/go/02-management.md#post-apiv1companiescompany_idadmins) |
| 02 관리·설정·정렬 | `POST /api/v1/companies/{company_id}/settings` | 회사 설정 생성 | `member` | 회사 관리자만; 중복은500, 기본 사용자 설정도 함께 생성 | [02:180](../api/go/02-management.md#post-apiv1companiescompany_idsettings) |
| 02 관리·설정·정렬 | `PATCH /api/v1/companies/{company_id}/settings` | 회사 설정·메인 위젯 수정 | `member` | 회사 관리자만; edit_company_main_board는 JSON 배열을 인코딩한 문자열 | [02:226](../api/go/02-management.md#patch-apiv1companiescompany_idsettings) |
| 02 관리·설정·정렬 | `PATCH /api/v1/companies/{company_id}/settings/users/me` | 본인 알림 설정 수정 | `member` | 회사 설정 없으면404; {}도 설정 생성·복원 가능 | [02:295](../api/go/02-management.md#patch-apiv1companiescompany_idsettingsusersme) |
| 02 관리·설정·정렬 | `PUT /api/v1/companies/{company_id}/settings/users/me/recent-search-keywords` | 최근 검색어 전체 교체 | `member` | 키 생략/null은 전체 삭제; 앞8개만 저장, live 사용자 설정 없으면404 | [02:347](../api/go/02-management.md#put-apiv1companiescompany_idsettingsusersmerecent-search-keywords) |
| 02 관리·설정·정렬 | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/category-tree` | 카테고리·게시판 정렬·삭제 | `board` | 위치 변경만; 권한 밖 ID 무시, reordered는 삭제 개수가 아님 | [02:397](../api/go/02-management.md#put-apiv1boardcompaniescompany_idusersuser_idcategory-tree) |

### 03. 카테고리 — 8개

| 도메인 | METHOD · 전체 경로 | 기능 | 인증 | 주의 | 원문 |
|---|---|---|---|---|---|
| 03 카테고리 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/categories` | 사용자 카테고리 트리·공용 게시판 | `board` | with_category_admin=false도 참; 트리 노출이 상세 접근권 보장은 아님 | [03:146](../api/go/03-category.md#get-apiv1boardcompaniescompany_idusersuser_idcategories) |
| 03 카테고리 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/categories/admin` | 관리자용 전체 트리 | `board` | 회사 관리자만 전체 범위; 일반 사용자도200 회원 트리 | [03:201](../api/go/03-category.md#get-apiv1boardcompaniescompany_idusersuser_idcategoriesadmin) |
| 03 카테고리 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/categories/management` | 본인 관리 대상 트리 | `board` | 직접 배열; 회사 관리자라는 이유로 전체 트리를 주지 않음 | [03:252](../api/go/03-category.md#get-apiv1boardcompaniescompany_idusersuser_idcategoriesmanagement) |
| 03 카테고리 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}` | 카테고리 상세·권한 지정 목록 | `board` | 대상404 → Visible403; 트리와 DTO·가시성 다름 | [03:302](../api/go/03-category.md#get-apiv1boardcompaniescompany_idusersuser_idcategoriesid) |
| 03 카테고리 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/categories` | 카테고리 생성 | `board` | 200; 2단계 제한, 거부된 추가 권한은 ignored_*로 보고 | [03:350](../api/go/03-category.md#post-apiv1boardcompaniescompany_idusersuser_idcategories) |
| 03 카테고리 | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}` | 카테고리·권한 지정 수정 | `board` | parent_category_id는 무시; 권한 전파·추가/삭제 순서 확인 | [03:406](../api/go/03-category.md#put-apiv1boardcompaniescompany_idusersuser_idcategoriesid) |
| 03 카테고리 | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}` | 카테고리·하위 게시판 삭제 | `board` | 204 빈 Body; soft-delete이며 파일 bytes 동기 삭제 아님 | [03:466](../api/go/03-category.md#delete-apiv1boardcompaniescompany_idusersuser_idcategoriesid) |
| 03 카테고리 | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}/my-notification` | 본인 카테고리 알림 수정 | `board` | body 없이 query도 가능; non-null body 우선, 빈 요청도 시각 갱신 | [03:514](../api/go/03-category.md#put-apiv1boardcompaniescompany_idusersuser_idcategoriesidmy-notification) |

### 04. 게시판 — 7개

| 도메인 | METHOD · 전체 경로 | 기능 | 인증 | 주의 | 원문 |
|---|---|---|---|---|---|
| 04 게시판 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}` | 게시판 상세·권한·용량 조회 | `board` | Read 필요; BoardDetail의 grant 관계, is_admin과 can_manage 구분 | [04:249](../api/go/04-board.md#get-apiv1boardcompaniescompany_idusersuser_idboardsid) |
| 04 게시판 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/bookmarks` | 본인 북마크 게시판 목록 | `board` | Read·활성 필터 후 페이지; 북마크 시각순, 일반 게시판 목록 아님 | [04:297](../api/go/04-board.md#get-apiv1boardcompaniescompany_idusersuser_idbookmarks) |
| 04 게시판 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards` | 게시판 생성 | `board` | 200; 공용은 category_id=null, is_public/is_drive 입력은 판정에 영향 없음 | [04:358](../api/go/04-board.md#post-apiv1boardcompaniescompany_idusersuser_idboards) |
| 04 게시판 | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}` | 게시판·권한 지정 수정 | `board` | DRIVE 전환 가능; 최종 non-DRIVE에 limit 키를 null로 보내도422 | [04:425](../api/go/04-board.md#put-apiv1boardcompaniescompany_idusersuser_idboardsid) |
| 04 게시판 | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}` | 게시판 삭제 | `board` | 204 빈 Body; 회사/카테고리 관리자만, can_manage만으로 판단 금지 | [04:498](../api/go/04-board.md#delete-apiv1boardcompaniescompany_idusersuser_idboardsid) |
| 04 게시판 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/bookmark` | 게시판 북마크 토글 | `board` | 응답 is_bookmarked; 동일 요청 재시도는 다시 반전 | [04:546](../api/go/04-board.md#post-apiv1boardcompaniescompany_idusersuser_idboardsidbookmark) |
| 04 게시판 | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/my-notification` | 본인 게시판 알림 수정 | `board` | Read 필요; query/body 병합, 본인 설정이며 게시판 전체 알림과 별개 | [04:603](../api/go/04-board.md#put-apiv1boardcompaniescompany_idusersuser_idboardsidmy-notification) |

### 05. 게시글 조회 — 5개

| 도메인 | METHOD · 전체 경로 | 기능 | 인증 | 주의 | 원문 |
|---|---|---|---|---|---|
| 05 게시글 조회 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts` | 게시글 목록·검색 | `board` | 일반은 페이지·is_not_paging=true면 배열; 검색 GET도 최근검색어 기록 | [05:241](../api/go/05-post-read.md#get-apiv1boardcompaniescompany_idusersuser_idposts) |
| 05 게시글 조회 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/mine` | 내 글·임시저장·예약·휴지통 목록 | `board` | 항상 페이지; is_bookmark 빈값/0인 내 글 분기에서 state 미지정/미지값은 빈 페이지. 그 외는 state를 무시하는 북마크 분기; Read gate 없음 | [05:332](../api/go/05-post-read.md#get-apiv1boardcompaniescompany_idusersuser_idpostsmine) |
| 05 게시글 조회 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/bookmarks` | 북마크 게시글 목록 | `board` | 항상 페이지; Read·게시판 활성 gate 없어 상세403 가능 | [05:389](../api/go/05-post-read.md#get-apiv1boardcompaniescompany_idusersuser_idpostsbookmarks) |
| 05 게시글 조회 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}` | 게시글 상세 | `board` | ACT 미삭제 글은 호출마다 동기 열람 추가; 응답은 기록 전 스냅샷 | [05:442](../api/go/05-post-read.md#get-apiv1boardcompaniescompany_idusersuser_idpostsid) |
| 05 게시글 조회 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/attachments/{id}/download-url` | 첨부 다운로드 URL 발급 | `board` | 5분 URL; ACT/HIDE만, HEAD 없음·발급200이 객체 존재 보장 아님 | [05:489](../api/go/05-post-read.md#get-apiv1boardcompaniescompany_idusersuser_idattachmentsiddownload-url) |

### 06. 게시글 쓰기·신호·공지 — 9개

| 도메인 | METHOD · 전체 경로 | 기능 | 인증 | 주의 | 원문 |
|---|---|---|---|---|---|
| 06 게시글 쓰기·신호·공지 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/posts` | 게시글 작성 | `board` | 201; board Write 필요, HTML을 sanitize하지 않음 | [06:192](../api/go/06-post-write.md#post-apiv1boardcompaniescompany_idusersuser_idboardsidposts) |
| 06 게시글 쓰기·신호·공지 | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}` | 게시글 수정 | `board` | 작성자만; board_id가 있으면 원본 확인 전에 목적지 권한 확인 | [06:252](../api/go/06-post-write.md#put-apiv1boardcompaniescompany_idusersuser_idpostsid) |
| 06 게시글 쓰기·신호·공지 | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/posts` | 게시글 일괄 휴지통 | `board` | 작성자만; 개별 거부도200 ignored_ids, state는 저장값 유지 | [06:316](../api/go/06-post-write.md#delete-apiv1boardcompaniescompany_idusersuser_idposts) |
| 06 게시글 쓰기·신호·공지 | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/posts/purge` | 게시글 일괄 영구삭제 표시 | `board` | 작성자·휴지통만; purged_at 표식, 즉시 row·객체 삭제 아님 | [06:362](../api/go/06-post-write.md#delete-apiv1boardcompaniescompany_idusersuser_idpostspurge) |
| 06 게시글 쓰기·신호·공지 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/restore` | 게시글 일괄 복원 | `board` | 삭제자 기준; 기존에 별도 삭제한 댓글까지 활성화할 수 있음 | [06:408](../api/go/06-post-write.md#post-apiv1boardcompaniescompany_idusersuser_idpostsrestore) |
| 06 게시글 쓰기·신호·공지 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/post-views` | 게시글 일괄 읽음 기록 | `board` | ACT·미삭제·살아 있는 게시판·Read 대상만; 이미 읽었어도 호출마다 이벤트 추가 | [06:454](../api/go/06-post-write.md#post-apiv1boardcompaniescompany_idusersuser_idpost-views) |
| 06 게시글 쓰기·신호·공지 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/bookmark` | 게시글 북마크 토글 | `board` | ACT/HIDE·Read 필요; 목표 상태 지정 API 아님 | [06:500](../api/go/06-post-write.md#post-apiv1boardcompaniescompany_idusersuser_idpostsidbookmark) |
| 06 게시글 쓰기·신호·공지 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/notices` | 게시판 공지 목록 | `board` | in_posts/out_posts; 미시작·만료 포함, 페이지 없음 | [06:546](../api/go/06-post-write.md#get-apiv1boardcompaniescompany_idusersuser_idboardsidnotices) |
| 06 게시글 쓰기·신호·공지 | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/notices` | 게시판 공지 기간 지정·해제 | `board` | 회사/게시판 관리자만; 역할 부족도200 no-op, ignored_ids 확인 | [06:592](../api/go/06-post-write.md#put-apiv1boardcompaniescompany_idusersuser_idboardsidnotices) |

### 07. 댓글·공감·열람자 — 8개

| 도메인 | METHOD · 전체 경로 | 기능 | 인증 | 주의 | 원문 |
|---|---|---|---|---|---|
| 07 댓글·공감·열람자 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/comments` | 댓글·답글 작성 | `board` | 201; ACT·댓글 허용·Read 필요, root/답글 2단계 | [07:178](../api/go/07-post-comment-like.md#post-apiv1boardcompaniescompany_idusersuser_idpostsidcomments) |
| 07 댓글·공감·열람자 | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}` | 댓글 수정 | `board` | 작성자만, Read·댓글 active 검사 없음; body 빈값은 지움·query 빈값은 유지 | [07:230](../api/go/07-post-comment-like.md#put-apiv1boardcompaniescompany_idusersuser_idcommentsid) |
| 07 댓글·공감·열람자 | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}` | 댓글 삭제 표시 | `board` | 200 is_active=false; count 감소·답글 연쇄삭제 없음 | [07:282](../api/go/07-post-comment-like.md#delete-apiv1boardcompaniescompany_idusersuser_idcommentsid) |
| 07 댓글·공감·열람자 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}/like` | 댓글 공감 토글 | `board` | emoji별 토글; 공감자 조회보다 넓은 대상 상태 허용 | [07:332](../api/go/07-post-comment-like.md#post-apiv1boardcompaniescompany_idusersuser_idcommentsidlike) |
| 07 댓글·공감·열람자 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}/likes` | 댓글 공감자 목록 | `board` | active 댓글·ACT/HIDE·Read 필요; emoji별 사용자 페이지 | [07:380](../api/go/07-post-comment-like.md#get-apiv1boardcompaniescompany_idusersuser_idcommentsidlikes) |
| 07 댓글·공감·열람자 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/like` | 게시글 공감 토글 | `board` | ACT/HIDE·Read; 엄격 body, emoji별 토글·재시도 주의 | [07:426](../api/go/07-post-comment-like.md#post-apiv1boardcompaniescompany_idusersuser_idpostsidlike) |
| 07 댓글·공감·열람자 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/likes` | 게시글 공감자 목록 | `board` | emoji별 사용자 페이지; nullable user 관계 | [07:474](../api/go/07-post-comment-like.md#get-apiv1boardcompaniescompany_idusersuser_idpostsidlikes) |
| 07 댓글·공감·열람자 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/views` | 게시글 열람자 목록 | `board` | total은 고유 사용자 수; view_count 이벤트 수와 다름, 이 GET은 열람 추가 없음 | [07:520](../api/go/07-post-comment-like.md#get-apiv1boardcompaniescompany_idusersuser_idpostsidviews) |

### 08. 자료실 폴더 — 5개

| 도메인 | METHOD · 전체 경로 | 기능 | 인증 | 주의 | 원문 |
|---|---|---|---|---|---|
| 08 자료실 폴더 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/folders` | 자료실 폴더 생성 | `board` | 200; Write 필요, 삭제된 부모가 허용될 수 있어 live 폴더 선택 | [08:104](../api/go/08-drive-folder.md#post-apiv1boardcompaniescompany_idusersuser_idboardsidfolders) |
| 08 자료실 폴더 | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/folders/{id}` | 폴더 이름·위치 수정 | `board` | Write 필요; parent_id:null은 유지여서 루트 이동 불가 | [08:154](../api/go/08-drive-folder.md#put-apiv1boardcompaniescompany_idusersuser_idfoldersid) |
| 08 자료실 폴더 | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/folders` | 폴더 일괄 삭제 | `board` | 실제 삭제 ID 배열; 하위가 남으면 제외, 재귀 삭제 아님 | [08:206](../api/go/08-drive-folder.md#delete-apiv1boardcompaniescompany_idusersuser_idfolders) |
| 08 자료실 폴더 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive` | 자료실 게시판·용량·폴더 조회 | `board` | 파일은 포함하지 않음; 파일 목록은 별도 drive-files 조회 | [08:256](../api/go/08-drive-folder.md#get-apiv1boardcompaniescompany_idusersuser_idboardsiddrive) |
| 08 자료실 폴더 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive/folder-tree` | 자료실 폴더 선택 트리 | `board` | Read 권한; 최상위 게시판 설정5개+트리, 사용량·파일 없음 | [08:313](../api/go/08-drive-folder.md#get-apiv1boardcompaniescompany_idusersuser_idboardsiddrivefolder-tree) |

### 09. 자료실 파일 — 9개

| 도메인 | METHOD · 전체 경로 | 기능 | 인증 | 주의 | 원문 |
|---|---|---|---|---|---|
| 09 자료실 파일 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files` | 자료실 파일 목록·검색 | `board` | Read·활성 DRIVE 필터; 기본 페이지, is_not_paging=true면 배열 | [09:187](../api/go/09-drive-file.md#get-apiv1boardcompaniescompany_idusersuser_iddrive-files) |
| 09 자료실 파일 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/mine` | 내 자료실 파일 목록 | `board` | 항상 페이지; is_bookmark·state 모두 없거나 빈값이면 빈 페이지, is_bookmark=0만 보내면400. 그 외 non-empty is_bookmark는 Read·활성 gate가 있는 북마크 분기 | [09:233](../api/go/09-drive-file.md#get-apiv1boardcompaniescompany_idusersuser_iddrive-filesmine) |
| 09 자료실 파일 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/bookmarks` | 북마크 자료실 파일 목록 | `board` | 항상 페이지; ACT·Read·활성 필터, 파일 컬럼 정렬 | [09:289](../api/go/09-drive-file.md#get-apiv1boardcompaniescompany_idusersuser_iddrive-filesbookmarks) |
| 09 자료실 파일 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}` | 자료실 파일 상세 | `board` | Read 필요; 휴지통·UPLOADING·FAIL도 상세 가능, 다운로드와 gate 다름 | [09:335](../api/go/09-drive-file.md#get-apiv1boardcompaniescompany_idusersuser_iddrive-filesid) |
| 09 자료실 파일 | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/drive-files` | 파일 일괄 휴지통 | `board` | 업로더 또는 CanManage; 개별 거부도200 ignored_ids | [09:379](../api/go/09-drive-file.md#delete-apiv1boardcompaniescompany_idusersuser_iddrive-files) |
| 09 자료실 파일 | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/purge` | 파일 일괄 영구삭제 표시 | `board` | 업로더만; 휴지통 또는 UPLOADING/FAIL 허용, 객체 삭제는 배치 | [09:423](../api/go/09-drive-file.md#delete-apiv1boardcompaniescompany_idusersuser_iddrive-filespurge) |
| 09 자료실 파일 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/restore` | 파일 일괄 복원 | `board` | 업로더·게시판별 quota; success_drive/fail_drive는 게시판 ID | [09:469](../api/go/09-drive-file.md#post-apiv1boardcompaniescompany_idusersuser_iddrive-filesrestore) |
| 09 자료실 파일 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}/bookmark` | 자료실 파일 북마크 토글 | `board` | Read 필요; 응답 is_bookmarked, ACT 이외도 토글 가능 | [09:522](../api/go/09-drive-file.md#post-apiv1boardcompaniescompany_idusersuser_iddrive-filesidbookmark) |
| 09 자료실 파일 | `GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}/download-url` | 자료실 파일 다운로드 URL 발급 | `board` | Read 뒤 ACT 아니면409 FILE_NOT_ACTIVE; URL 5분, HEAD 없음 | [09:575](../api/go/09-drive-file.md#get-apiv1boardcompaniescompany_idusersuser_iddrive-filesiddownload-url) |

### 10. 업로드·조직도·이미지·버전 — 6개

| 도메인 | METHOD · 전체 경로 | 기능 | 인증 | 주의 | 원문 |
|---|---|---|---|---|---|
| 10 업로드·조직도·이미지·버전 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive-uploads` | 자료실 업로드 URL·예약 발급 | `board` | 최대10건; 파일별 result.state, 로컬 File과 응답 순서 대응 | [10:147](../api/go/10-upload-department-client.md#post-apiv1boardcompaniescompany_idusersuser_idboardsiddrive-uploads) |
| 10 업로드·조직도·이미지·버전 | `POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}/upload-complete` | 자료실 업로드 완료 처리 | `board` | Read+업로더; Body 값은 무시하나 알려진 키 타입오류400, 200이어도 UPLOADING/FAIL 가능 | [10:209](../api/go/10-upload-department-client.md#post-apiv1boardcompaniescompany_idusersuser_iddrive-filesidupload-complete) |
| 10 업로드·조직도·이미지·버전 | `GET /api/v1/companies/{company_id}/departments` | 회사 조직도 조회 | `member` | 루트 없으면200 빈 Body; category 필터의 빈 허용집합은 전체 members | [10:271](../api/go/10-upload-department-client.md#get-apiv1companiescompany_iddepartments) |
| 10 업로드·조직도·이미지·버전 | `GET /image/resize/{size}` | 공개 이미지 리사이즈·원본 | `exempt` | size=o는 원본200, 리사이즈는302; key prefix 검증·board 권한 없음 | [10:329](../api/go/10-upload-department-client.md#get-imageresizesize) |
| 10 업로드·조직도·이미지·버전 | `GET /api/v1/client-versions` | 게스트 클라이언트 버전 조회 | `exempt` | 플랫폼 map; query 검증422, 임의 scope 조회 가능 | [10:391](../api/go/10-upload-department-client.md#get-apiv1client-versions) |
| 10 업로드·조직도·이미지·버전 | `GET /api/v1/companies/{company_id}/users/{user_id}/client-versions` | 본인 스코프 클라이언트 버전 조회 | `member` | member 토큰의 회사·사용자 일치 필수; 플랫폼 map | [10:447](../api/go/10-upload-department-client.md#get-apiv1companiescompany_idusersuser_idclient-versions) |

**도메인 합계: 4 + 6 + 8 + 7 + 5 + 9 + 8 + 5 + 9 + 6 = 67.**
게시글 열람자 목록은 07 문서에 포함한다. 인증 계약별로는 `board` 55 + `member` 7 + `exempt` 5 = 67이다.

## 2. 등록되어 있지만 이 색인에서 제외하는 22개

이 경로들은 89개 조립의 등록 라우트이며 숨은 호환 경로가 아니다. 아래 각각의 제외 이유는
[Go README 등록 전수표](../api/go/README.md#등록-라우트-전수-대조표)를 기준으로 한다.
onpremise 관련15개는 onpremise DB가 없으면 등록되지 않는다.

| METHOD · 전체 경로 | 인증 | 제외 이유 | Go 원문 |
|---|---|---|---|
| `GET /api/v1/onpremise/bundle-downloads/{token}` | `exempt` | 프로비저닝 번들 다운로드 토큰 소비 경로; 게시글·자료실 다운로드와 별개 | [README:279](../api/go/README.md#등록-라우트-전수-대조표) |
| `GET /docs` | `exempt` | Huma 개발자 문서·OpenAPI·JSON Schema; 게시판 업무 데이터 계약 없음 | [README:280](../api/go/README.md#등록-라우트-전수-대조표) |
| `GET /healthz` | `exempt` | ALB·프로세스 liveness probe; 게시판 사용자 데이터 계약 없음 | [README:281](../api/go/README.md#등록-라우트-전수-대조표) |
| `GET /openapi-3.0.json` | `exempt` | Huma 개발자 문서·OpenAPI·JSON Schema; 게시판 업무 데이터 계약 없음 | [README:283](../api/go/README.md#등록-라우트-전수-대조표) |
| `GET /openapi-3.0.yaml` | `exempt` | Huma 개발자 문서·OpenAPI·JSON Schema; 게시판 업무 데이터 계약 없음 | [README:284](../api/go/README.md#등록-라우트-전수-대조표) |
| `GET /openapi.json` | `exempt` | Huma 개발자 문서·OpenAPI·JSON Schema; 게시판 업무 데이터 계약 없음 | [README:285](../api/go/README.md#등록-라우트-전수-대조표) |
| `GET /openapi.yaml` | `exempt` | Huma 개발자 문서·OpenAPI·JSON Schema; 게시판 업무 데이터 계약 없음 | [README:286](../api/go/README.md#등록-라우트-전수-대조표) |
| `GET /schemas/{schema}` | `exempt` | Huma 개발자 문서·OpenAPI·JSON Schema; 게시판 업무 데이터 계약 없음 | [README:287](../api/go/README.md#등록-라우트-전수-대조표) |
| `DELETE /api/v1/onpremise/tenants/{id}` | `service` | onpremise 배포·환경설정; Service credential을 쓰는 별도 소비자 계약 | [README:298](../api/go/README.md#등록-라우트-전수-대조표) |
| `GET /api/v1/onpremise/env-defaults` | `service` | onpremise 배포·환경설정; Service credential을 쓰는 별도 소비자 계약 | [README:299](../api/go/README.md#등록-라우트-전수-대조표) |
| `GET /api/v1/onpremise/env-defaults/{id}` | `service` | onpremise 배포·환경설정; Service credential을 쓰는 별도 소비자 계약 | [README:300](../api/go/README.md#등록-라우트-전수-대조표) |
| `GET /api/v1/onpremise/tenants` | `service` | onpremise 배포·환경설정; Service credential을 쓰는 별도 소비자 계약 | [README:301](../api/go/README.md#등록-라우트-전수-대조표) |
| `GET /api/v1/onpremise/tenants/{id}` | `service` | onpremise 배포·환경설정; Service credential을 쓰는 별도 소비자 계약 | [README:302](../api/go/README.md#등록-라우트-전수-대조표) |
| `GET /api/v1/onpremise/tenants/{id}/bundle` | `service` | onpremise 배포·환경설정; Service credential을 쓰는 별도 소비자 계약 | [README:303](../api/go/README.md#등록-라우트-전수-대조표) |
| `GET /api/v1/onpremise/tenants/{id}/bundle-contents` | `service` | onpremise 배포·환경설정; Service credential을 쓰는 별도 소비자 계약 | [README:304](../api/go/README.md#등록-라우트-전수-대조표) |
| `GET /api/v1/onpremise/tenants/{id}/change-logs` | `service` | onpremise 배포·환경설정; Service credential을 쓰는 별도 소비자 계약 | [README:305](../api/go/README.md#등록-라우트-전수-대조표) |
| `POST /api/v1/onpremise/tenants` | `service` | onpremise 배포·환경설정; Service credential을 쓰는 별도 소비자 계약 | [README:306](../api/go/README.md#등록-라우트-전수-대조표) |
| `POST /api/v1/onpremise/tenants/{id}/bundle-url` | `service` | onpremise 배포·환경설정; Service credential을 쓰는 별도 소비자 계약 | [README:307](../api/go/README.md#등록-라우트-전수-대조표) |
| `POST /api/v1/onpremise/tenants/{id}/memo` | `service` | onpremise 배포·환경설정; Service credential을 쓰는 별도 소비자 계약 | [README:308](../api/go/README.md#등록-라우트-전수-대조표) |
| `POST /api/v1/onpremise/tenants/{id}/resync-env` | `service` | onpremise 배포·환경설정; Service credential을 쓰는 별도 소비자 계약 | [README:309](../api/go/README.md#등록-라우트-전수-대조표) |
| `PUT /api/v1/onpremise/env-defaults/{id}` | `service` | onpremise 배포·환경설정; Service credential을 쓰는 별도 소비자 계약 | [README:310](../api/go/README.md#등록-라우트-전수-대조표) |
| `PUT /api/v1/onpremise/tenants/{id}` | `service` | onpremise 배포·환경설정; Service credential을 쓰는 별도 소비자 계약 | [README:311](../api/go/README.md#등록-라우트-전수-대조표) |

**제외 합계: Service 프로비저닝 14 + 번들 다운로드1 + 문서/스키마6 + 헬스1 = 22.**

## 3. 등록 수에 더하지 않는 호환·자동 처리

아래 동작은 등록된 별도 엔드포인트로 세지 않는다. 근거: [Go README 숨은 경로](../api/go/README.md#라우트-표-밖의-숨은-경로).
이 절의 `S`는 `/api/v1/board/companies/{company_id}/users/{user_id}`다.

| 형태 | 실제 처리와 한계 |
|---|---|
| 모든 경로의 `OPTIONS` | 인증 전 CORS204, 빈 Body. 미등록 경로도 동일하므로 실제 업무 경로 존재 증거가 아니다. |
| 등록되지 않은 `POST` + `_method=PUT/PATCH/DELETE` | query 우선, 빈값이면 form `_method`; JSON body의 `_method`는 읽지 않는다. 메서드 재작성 후 다시 dispatch한다. |
| 이미 `POST`가 등록된 경로 + `_method` | 정상 POST가 매칭돼 재작성하지 않는다. |
| `DELETE S/posts/{UUID}` | `DELETE S/posts?id={UUID}`로 재작성. bulk 작성자 규칙·`ignored_ids` 적용. |
| `POST S/posts/{UUID}?_method=DELETE` | 위 메서드·단건 경로 재작성을 연쇄 적용. 이전 `/api/v1/post/...` prefix를 살리는 기능은 아니다. |
| category-tree의 form | 지정 경로의 POST/PUT/PATCH만 form을 중첩 JSON으로 변환한다. 일반 게시글·댓글 multipart 지원이 아니다. |
| trailing slash 불일치 | 대응 경로가 있으면 GET301, 다른 method307. 별도 등록 행 아님. |
| 미등록 method·경로 | 자동 HEAD/405 fallback 없음. 인증 후 plain404가 가능하며 Huma 봉투를 보장하지 않는다. |
| panic | gin Recovery500이며 Huma 에러 봉투 보장 없음. |

## 4. 갭과 검증 기록

구현에 필요한 응답·필드·경로가 현재 Go 문서에 없으면 없는 계약으로 취급하고
[백엔드 요청 대장](../api/backend-requests.md)에 화면 맥락·Go 근거·임시 조치·요청 내용을 남긴다.
다른 Go 문서나 설정으로 설명되는 항목은 먼저 확인하고, 과거 BR의 미확인 내용을 그대로 재사용하지 않는다.

이 색인의 확인 범위는 **현재 원본 README와 01~10 본문의 경로 집합·분류·원문 링크에 대한 문서 검증**이다.
원문 작성자가 기록한 Go 테스트·curl 정적 검증을 이번 프론트 문서 갱신에서 실행한 것으로 주장하지 않는다.
프론트 소스·타입·서비스·화면을 이 색인의 경로로 변경했다는 뜻도 아니다.
