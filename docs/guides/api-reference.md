# API 연동 가이드 — Go 정본

구현 계약은 [Go 원문 README](../api/go/README.md)와 도메인 01~10이다. 이 가이드는 공통 처리와 도메인별 주의점을 연결한다. 엔드포인트 선택은 [67개 카탈로그](api-catalog.md), 정확한 필드·기본값·응답·권한은 원문을 따른다. 기존 프론트 타입·서비스·이전 요약은 새 계약의 근거가 아니다. Laravel은 기본 열람 대상이 아니며 실제 계약 갭의 역방향 근거와 [요청 대장](../api/backend-requests.md) 작성에만 사용한다.

기준은 `oc-api-go/doc/api/`의 현재 로컬 문서, 코드 조사 기준은 `feat/settings` · `65b7f49f34b0b934e274437a764455af045b99d3`다. [출처·복사 시점·원본 절대경로](../api/README.md)를 확인한다. 원문 내부의 코드 상대링크는 백엔드 기준이므로 [원본 링크 해석](../api/README.md#source-links)을 따른다.

등록 수는 **onpremise DB를 제공한 조립에서 89 = 연동67 + 제외22**, onpremise DB가 없으면 관련15개가 빠져 **74 = 67 + 제외7**이다. 다른 기능의 설정 부재는 대개 라우트 제거 대신503이며 숨은 rewrite·OPTIONS·리다이렉트는 중복 가산하지 않는다. 원문의 테스트·curl 검사는 작성자의 기록이다. 이번 작업은 문서 정비이며 Go 테스트·운영 HTTP 호출·프론트 코드 전환을 수행한 것이 아니다.

## 1. 인증과 회사·사용자 스코프

`BASE_URL`에 전체 경로를 붙인다. 아래 `S`는 `/api/v1/board/companies/{company_id}/users/{user_id}`다. 로컬 포트8080과 토큰 TTL 기본값을 운영값으로 고정하지 않는다.

| 계약      | 경로                                                        | 자격증명                                                                                                                                                                                                                          |
| --------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| exempt    | board `/token`, `/login`, `/refresh`; 게스트 버전·이미지 등 | Authorization 미검증. 인증3종은 Body로, 배포 bundle-download는 별도 다운로드 토큰으로 검증                                                                                                                                        |
| ~~board~~ | —                                                           | 🚫 **`ebff9af` 에서 폐지됐다.** 게시판 표면 64경로는 전부 아래 `member` 계약이고, Go 발급 HS256 토큰·`iss=oc-api-go/board`·refresh 회전은 존재하지 않는다. 토큰 획득 경로는 미정이다([BR-036](../api/backend-requests.md#br-036)) |
| member    | `/api/v1/companies/...`의 관리·조직·사용자 버전             | OfficeWave ES256, issuer·exp 및 scopes 배열의 정확한 `ROLE_MEMBER`; exp 5분 leeway                                                                                                                                                |
| service   | `/api/v1/onpremise/...`의 면제 외 경로                      | OfficeWave ES256, `aud=Service`. 게시판 프론트 호출과 분리                                                                                                                                                                        |

[인증 계약](../api/go/README.md#auth-contracts)의 판정 순서는 exempt exact → exempt prefix → service prefix → board prefix → 나머지 member다. 공통 요청 순서는 **인증401 → 회사/사용자 스코프403 → 입력 검증 → 도메인 판정**이다.

⚠️ **`ebff9af` 갱신**: 아래 문장의 「ID/PW 로그인 응답의 board 토큰」은 더 이상 존재하지 않는다. `PathScope` 규칙(정규 십진수·403)은 그대로 유효하고, 관리·조직 6경로는 `/api/v1/board/companies/{c}/…` 로 이사했으며 **`user_id` 세그먼트가 없다**. 근거: [backend-replies/](../api/backend-replies/README.md).

경로 ID는 검색 필터가 아니라 토큰 claim과의 일치 조건이다. 회사 → 사용자 순서로 정규10진 문자열까지 비교하므로 `01`, `+1`, `1.0`, 다른 회사·사용자는403이다. ID/PW 로그인 응답의 board 토큰을 member 설정 API에 보내지 않는다. 기존 인증 인터셉터 변경은 프로젝트 보호 파일 규칙을 따른다.

- [TokenBody](../api/go/01-auth-user.md#tokenbody)의 expires_in은 access TTL 초다. 코드 기본 access1시간·refresh14일이며 refresh 회전 때 만료가 연장된다. refresh TTL·만료시각 필드는 응답하지 않는다.
- refresh는 일회 소비이고 소비와 새 발급이 분리된다. 동시 갱신을 직렬화하고 응답 유실·소비 뒤403/500에 같은 refresh를 무조건 재시도하지 않는다. 재사용401이면 다시 인증한다.
- token/login/refresh의 관리자 동기화 실패 처리는 다르다. [동기화 상태표](../api/go/01-auth-user.md#admin-sync)를 따른다. bearer는 stateless이므로 계정 상태 변경·로그아웃이 기존 토큰을 즉시 무효화한다고 가정하지 않는다.
- [MeBody](../api/go/01-auth-user.md#mebody)는 관계가 없으면 member·company_setting·company_user_setting을 null로 반환한다. DB 기본값으로 관계 객체를 만들지 않는다. 관리 설정 DTO와 다르며 company_main_boards가 없다.
- `/me.company_id`는 사용자 DB 값이라 토큰 회사와 달라질 수 있다. 회사 변경은 URL 치환만으로 처리하지 않고 재인증 흐름에서 다룬다. 사용자·회사 상태의 SQL 값 목록만으로 좁은 enum을 만들지 않는다.

## 2. 헤더·오류·숫자·시간

| 항목          | 규칙                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Authorization | Bearer 뒤 첫 구분자는 ASCII 공백. 스킴 대소문자 무관, 토큰 부분 TrimSpace. 앞 공백·첫 구분자의 탭은 거절    |
| Content-Type  | JSON은 application/json. 누락·빈값도 JSON 해석. 일반 게시글·댓글 multipart 지원으로 확대하지 않음           |
| Lang          | 표시명은 빈값/ko=한국어, ja=일본어, 나머지=영어. ko-KR도 표시명은 영어 분기                                 |
| 오류 언어     | query lang → Lang → Accept-Language 매칭, 기본 영어. gin 인증401·스코프403은 영어 고정                      |
| Time_zone     | 밑줄 사용. Time-Zone은 다른 키. 누락·잘못된 IANA zone은 Asia/Seoul, tzdata 로딩 실패만 UTC                  |
| X-Request-ID  | 없으면 생성, 응답 헤더로 반환. 기본 CORS의 Expose-Headers가 없어 브라우저 읽기 가능 여부는 별도 확인        |
| Accept        | 기본 format fallback으로 미지원 값도 JSON 처리. 오류 목록의406을 일반 Accept 실패로 가정하지 않음           |
| ID·bytes      | int64는 JSON number, UUID는 string. JS 안전정수 범위를 고려하되 계약을 임의 문자열로 바꾸지 않음            |
| 시각          | 일반 board DTO는 UTC 소수6자리. `/me` 일부 public DB 시각은 KST 고정 PG 형식. 부서 time.Time은 RFC3339 계열 |

근거: [공통 헤더·봉투](../api/go/README.md#curl-setup), [MeBody](../api/go/01-auth-user.md#mebody), [조직도 DTO](../api/go/10-upload-department-client.md#organizationdto). 시각 전체에 단일 파서를 강제하거나 Time_zone이 모든 응답 시각을 바꾼다고 가정하지 않는다.

Huma 오류는 `{error:{code:string,message:string,details?:string[]}}`이며 최상위 `$schema`가 추가될 수 있다. details는 검증 위치·문구이고 입력 원문을 반환하지 않는다. **status와 code로 분기하고 번역 message는 표시용으로 사용한다.**

| status          | 대표 code·예외                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 400             | INVALID_PAYLOAD: board·관리·조직·이미지 Huma 검증. COMMENT_NOT_ALLOWED·POST_SCHEDULE_REQUIRED 등 별도 도메인400도 있음 |
| 401 / 403       | UNAUTHORIZED / FORBIDDEN. gin bearer401은 WWW-Authenticate: Bearer 포함, login/refresh401은 보장하지 않음              |
| 404             | NOT_FOUND. 존재·삭제·상태·회사 범위를 묶어 숨기는 순서는 endpoint별로 다름                                             |
| 409             | FILE_NOT_ACTIVE·UPLOAD_NOT_PENDING 등 도메인 code                                                                      |
| 422             | client-versions 검증은 VALIDATION_ERROR. BOARD_NOT_DRIVE·FOLDER_CYCLE 등 도메인422와 구분                              |
| 408 / 413 / 415 | REQUEST_TIMEOUT / REQUEST_ENTITY_TOO_LARGE / UNSUPPORTED_MEDIA_TYPE. 실제 Body 처리 단계에 적용                        |
| 500 / 503       | 보통 INTERNAL_ERROR / SERVICE_UNAVAILABLE. login이 전달하는 상위409·429·503도 INTERNAL_ERROR일 수 있음                 |

[공통 검증](../api/go/README.md#huma-common)과 각 도메인 오류표를 따른다. 미등록 경로는 인증 통과 후 plain404일 수 있고 panic500도 Huma 봉투를 보장하지 않는다. 모든 실패 Body를 JSON으로 단정하지 않는다.

## 3. 직렬화·검증·생략·빈값·null

optional property의 null은 Huma가 검증을 건너뛰므로 nullable:false 표기만 보고400을 예상하지 않는다. 필드 길이 제한이 없어도 일반 Body 전체 **1MiB**, Body 읽기 기본 **5초**는 남는다. 추가 키도 거절하는 Body와 허용 후 무시하는 Body가 공존한다. strict Body도 등록된 readonly `$schema`는 허용 후 무시하는 예외가 있다. [공통 규칙](../api/go/README.md#huma-common)과 개별 decoder·도메인 결과를 함께 따른다.

| 입력 계열           | 처리                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 실제 boolean query  | 참1,t,T,TRUE,true,True / 거짓0,f,F,FALSE,false,False. yes,on,2는 검증 오류. 빈 optional query는 보통 미입력                                                        |
| 문자열 truthiness   | is_view·mine is_bookmark·with_category_admin은 빈 문자열/0만 거짓 계열. false는 참. 빈 is_view는 필터 없음, 안읽음은0                                              |
| 개인 알림 query     | 정확한0,1,true,false enum. Body가 덮어도 잘못된 query가 먼저400일 수 있음                                                                                          |
| legacy.Bool Body    | JSON true,false,0,1,"0","1","true","false",null. 대문자 문자열·공백 포함·yes·2는400. null의 최종 효과는 개별 규칙                                                  |
| is_only_file_search | 키 존재 자체가 아닌 non-empty 문자열. 일반 파일 목록에서 search/title도 non-empty일 때 이력 저장. 0/false는 켜짐, 빈값은 꺼짐. title_content만으로는 저장하지 않음 |
| query 배열          | 지원 endpoint에서 반복키·[]·숫자 index. sort[by]는 scalar 키. %5b만 있는 인코딩은 전처리 우회 가능. comma·JSON 배열 문자열을 범용 규칙으로 사용하지 않음           |

근거: [README 입력 검증](../api/go/README.md#huma-common), [파일 Query](../api/go/09-drive-file.md#list-query), [게시글 JSON 불리언](../api/go/06-post-write.md#json-입력과-불리언), [카테고리](../api/go/03-category.md)·[게시판 알림](../api/go/04-board.md).

| 사례                      | 생략 / null / 빈값                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 게시글 생성               | {}는 SAVE 빈 글. state 생략/null은 SAVE, 빈 문자열은400                                                                    |
| 게시글 수정 title/content | 생략/null 유지, 빈 문자열 비우기. {}도 updated_at 변경 가능. 배열 생략/null/[]는 삭제·추가 대상 없음                       |
| 예약                      | 빈 날짜는 새 예약값 없음. effective state=SCHEDULED에서 delete_schedule_at=true이며 새 날짜가 없으면 기존 예약이 있어도400 |
| 댓글 수정                 | Body comment:""는 지우기. null/생략은 non-empty query fallback 후 없으면 유지. query comment=만으로 지우지 않음            |
| 폴더 수정                 | parent_id 생략/null 유지: null로 루트 이동 불가. 생성의 parent_drive_folder_id는 수정 Body에서400                          |
| 게시판 수정               | except_extension 생략/null 유지, [] 비우기. 최종 non-DRIVE에 용량 키를 보내면 null이어도422, 생성의 정규화와 다름          |
| 회사 설정 PATCH           | scalar 생략/null은 보통 유지. post_badge_type:null은 JSON null 저장. edit_company_main_board는 JSON 배열을 인코딩한 문자열 |
| 최근검색어 PUT            | {} 또는 필드 null은 전체 삭제. 앞8개 저장, 순서·중복·빈 문자열 보존                                                        |
| 업로드 예약               | files 키 생략400. files:[] 또는 null은 권한 검사 후200 빈 배열                                                             |
| 업로드 완료               | Body 생략/{} / JSON null 가능. 경로 ID·저장 키 사용. 알려진 file_id/object_key는 무시하나 잘못된 타입400                   |

근거: [게시글 요청](../api/go/06-post-write.md#공유-요청-계약), [댓글 요청](../api/go/07-post-comment-like.md#공통-요청응답-규칙), [폴더](../api/go/08-drive-folder.md), [게시판](../api/go/04-board.md), [관리](../api/go/02-management.md), [업로드](../api/go/10-upload-department-client.md). 빈 객체를 공통 no-op으로 취급하지 않는다.

## 4. 응답 DTO·페이징·정렬·필터

객체·배열·페이지·부분 결과·빈Body를 endpoint별로 처리한다. 최상위 struct의 선택 `$schema:string`와 Link 헤더는 업무 필드가 아니다. 내부 객체에 재귀적으로 붙지 않고 배열·map·nil·raw callback·gin 응답에는 없다. 동적 출력은 registry 등록 여부에도 영향을 받는다. [자동 특수필드](../api/go/README.md#schema-field)에서 API origin을 역산하지 않는다.

| 응답                  | 처리                                                                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 페이지                | data,current_page,last_page,per_page,total 5개 업무 키. 빈 결과 data=[], 통상 last_page=1. from/to/path/links/*_url 없음                                                    |
| 일반 게시글           | 기본 take20/page1. is_not_paging=true일 때 배열·limit 기본10. page offset은 남음                                                                                            |
| 게시글 mine/bookmarks | 항상 페이지. mine의 is_bookmark 빈값/0인 분기는 state 생략/미지값에 빈 페이지, 그 외 is_bookmark는 state를 무시하는 북마크 분기. 일반 목록 검색·배열 옵션을 재사용하지 않음 |
| 파일3종 목록          | 모두 기본 take20/page1, take/limit 최대100 절삭. is_not_paging=true일 때 일반만 배열, mine/bookmarks는 봉투를 유지하며 limit(기본10) 적용                                   |
| 참가자                | 공감자·열람자는 페이지. 댓글 독립 목록 GET은 없고 게시글 상세의 트리에 포함                                                                                                 |
| 빈Body                | 카테고리·게시판 삭제204. 조직도 루트 없음은200 빈Body. 폴더 삭제200 []와 구분                                                                                               |

근거: [게시글 페이지](../api/go/05-post-read.md#pageenvelope), [파일 페이지](../api/go/09-drive-file.md#page), [참가자](../api/go/07-post-comment-like.md#participantpage), [조직도](../api/go/10-upload-department-client.md#organizationdto).

게시글·북마크·참가자의 take에 자료실100 상한을 일반화하지 않는다. 현실적인 페이지 크기를 사용하며 극단값 overflow는 원문 이슈로 구분한다. 파일 DEL 정렬은 updated_at DESC 고정이고, 미인식 파일 정렬키는 created_at에 요청 방향을 적용한다. 게시글의 일반·mine·bookmark 정렬 분기는 각각 확인한다.

게시글 검색 조건은 AND 결합하지만 파일은 search → title → title_content 우선순위다. 한 글자 search가 필터를 생략하면서 낮은 우선순위 검색도 막을 수 있다. %·_는 ILIKE wildcard다. 자료실 start/end_posted_at은 created_at을 검사하고 날짜만인 종료값은 해당 날짜 자정이다. 근거: [게시글](../api/go/05-post-read.md), [파일 Query](../api/go/09-drive-file.md#list-query).

- [PostView](../api/go/05-post-read.md#postview)·[PostDetailView](../api/go/05-post-read.md#postdetailview)·[PostWriteBody](../api/go/06-post-write.md#postwritebody)는 다르다. 상세에 최상위 category_id가 없고 쓰기에는 board/user/files/badges 관계가 없다. 응답 보강 실패의 count0·flag false가 저장 실패를 뜻하지 않는다.
- [CommentView](../api/go/07-post-comment-like.md#commentview)는 parent_comment_id 별칭을 포함하지만 상세 댓글은 parent_id만 제공한다. 삭제 응답은 is_active 한 필드. 비활성 댓글은 상세에서 본문이 가려지며 답글·공감은 남는다.
- [BoardWrite](../api/go/04-board.md#board-write)와 [BoardView](../api/go/04-board.md#board-view)의 계산 필드는 다르다. 쓰기 응답 is_admin=false로 조회 캐시의 권한을 덮지 않는다.
- [FolderView](../api/go/08-drive-folder.md#folderview)의 생성·수정 user는 null이며 조회는 관계를 포함한다. [DriveFileDTO](../api/go/09-drive-file.md#drivefiledto)의 board는 {id,title} 또는 null로 전체 BoardView가 아니다.
- [첨부](../api/go/05-post-read.md#postattachmentview)에 src/url은 없다. thumbnail의 url·7키 src 객체는 설정에 따라 생략된다. 첨부 type/width/height를 임의로 보충하지 않는다.

## 5. 도메인별 권한과 연동

### 카테고리·게시판

[권한 전문](../api/go/04-board.md#permission)과 [카테고리 규칙](../api/go/03-category.md#category-permission)을 따른다. Vue 권한 문서는 화면 동작 참고이며 Go 판정의 대체물이 아니다.

공용 게시판 또는 회사 관리자는 Read/Write=true다. 분류된 게시판의 read/write_permission은 독립 계산한다. ALL은 전사 공개가 아니라 직접 카테고리·게시판 멤버·관리자·부서 grant의 존재 조건이다. MEMBER는 해당 방향 플래그도 검사한다. 관리자 상속은 명시된 부모1홉 규칙을 따른다.

게시글 is_writable은 저자 여부, board.is_writable은 Write 결과다. BoardView.is_admin에는 회사 관리자만인 경우가 포함되지 않는다. 게시판 삭제는 회사/카테고리 관리자이며 게시판 관리자만으로는 부족하다. is_admin·is_writable·can_manage를 범용 작업 허가로 사용하지 않는다.

트리 노출·상세 가시성·관리 권한은 다르며 트리에 나타나도 상세403일 수 있다. 카테고리 수정의 parent_category_id는 이동하지 않고 무시된다. [grant 변경 순서](../api/go/04-board.md#grant-rules)를 지키며 삭제 후 재추가가 관리자 권한을 복구한다고 가정하지 않는다. ignored_*도 모든 무시된 삭제를 열거하지 않는다.

[category-tree](../api/go/02-management.md)는 board 인증이며 삭제 필드도 포함한다. reordered 수를 삭제 수로 읽지 않으며 소속 이동은 수행하지 않는다. my-notification은 멤버 추가 API가 아니고 빈 요청도 설정 생성·수정시각 변경을 일으킬 수 있다. BOARD_DRIVE_BOUNDARY 문구만으로 게시판 종류 변경이 불가하다고 단정하지 않는다.

### 회사·개인 설정과 홈

[관리 DTO](../api/go/02-management.md#company-setting)를 /me DTO와 분리한다. 위젯 type/board_type은 HTTP·DB enum 없는 문자열, CUSTOM일 때만 board_id가 적용된다. 수정은 있지만 **독립 메인 집계·위젯 설정 조회 계약의 결손**은 남아 있다. 없는 /me.company_main_boards를 복원하지 않고 대장에 기록한다.

edit_company_main_board는 JSON 배열을 인코딩한 문자열이다. 같은 ID의 위젯 삭제·편집을 함께 보내면 삭제 후 편집404로 전체 rollback된다. PATCH users/me는 사용자 설정을 만들 수 있지만 회사 설정이 먼저 필요하다. 최근검색어 PUT은 기존 live 사용자 설정이 없으면404이고 {}는 전체 삭제다.

관리자 추가 중복은403 ALREADY_EXIST_ADMIN, 회사 설정 중복은500 ALREADY_EXIST_COMPANY_SETTING이다. latest_post_day<=0·잘못된 latest_post_type 등은 HTTP 검증 뒤 DB CHECK에서500일 수 있다. 자동 재시도나 저장 성공으로 처리하지 않는다. 근거: [02 관리 원문](../api/go/02-management.md).

### 게시글 목록·상세·쓰기

일반 목록은 Read 불가 글을 total에서도 제외하지만 mine/bookmarks는 같은 gate가 없다. 목록에 있는 글이 상세403일 수 있다. 상세는 회사 내 글·게시판 존재 → 상태 가시성404 → Read403 순서로 작성자도 Read를 우회하지 않는다. HIDE는 권한이 있으면 직접 조회 가능하고 SAVE/SCHEDULED/삭제 글은 저자 가시성이 먼저다.

미삭제 ACT 상세 GET은 **매번 동기적으로 열람 이벤트를 추가**하며 is_view/view_count는 기록 전 스냅샷이다. 기록 실패도200을 바꾸지 않는다. speculative prefetch·자동 재시도·mutation 뒤 불필요한 상세 refetch가 조회수를 늘릴 수 있다. 일반 검색 GET도 검색 전에 최근검색어를 저장할 수 있다. 근거: [05 조회](../api/go/05-post-read.md).

작성201·수정200이며 제목/HTML의 개별 길이 상한이 없어도 Body1MiB는 적용된다. 서버가 HTML을 sanitize하지 않는다. 수정은 저자 전용이고 board_id를 보내면 원본 조회 전에 목적지 존재·Write를 검사한다. 실제 이동은 원래 SAVE 글에만 적용되므로 board_id를 일괄 전송하지 않는다. 알림·응답 보강은 저장 transaction과 구분한다. 근거: [06 쓰기](../api/go/06-post-write.md).

### 댓글·공감·열람자

[권한·상태 비교](../api/go/07-post-comment-like.md#권한상태-비교)에서 작성·수정·삭제·공감 토글·공감자 조회의 gate를 각각 확인한다. 작성은 live ACT·댓글허용·Read, 수정은 저자·글 상태·댓글허용, 삭제는 저자 또는 해당 관리자 조건이다. 수정·삭제에 Read를 공통 필수로 추가하지 않는다.

댓글 생성201이며 빈 댓글도 계약상 허용된다. 삭제는 is_active=false로 답글·공감을 지우지 않는다. comment_count는 비활성 댓글도 포함하므로 성공만으로 감소시키지 않는다. 기존 사용자 입력·표시 결정은 이번 문서 정비로 바꾸지 않는다.

공감은 목표 상태 설정이 아닌 **사용자·대상·emoji별 토글**이며 여러 emoji가 공존한다. 재시도하면 다시 반전한다. 토글 emoji는1~16 Unicode code point 문자열로 enum이 아니다. 공감자 GET은 emoji 필수지만 길이 상한이 없다. 글 공감 Body의 추가 키는 거절하고 댓글 공감은 무시한다. is_liked와 상세 집계의 is_reacted(0/1)를 구분한다.

열람자 total은 고유 사용자 수이고 view_count는 이벤트 수다. 열람자 GET은 읽음을 추가하지 않는다. 참가자의 user는 null일 수 있고 account·부서·직위 관계는 없다. 근거: [CommentView](../api/go/07-post-comment-like.md#commentview), [LikeToggleView](../api/go/07-post-comment-like.md#liketoggleview), [PostViewerView](../api/go/07-post-comment-like.md#postviewerview).

### 자료실 탐색·파일

GET S/boards/{id}/drive는 상단정보·path·직속 폴더·전체 트리이며 **파일 목록은 별도 조회**한다. Write·금지 확장자·파일당 한도는 중첩 board에 있다. folder-tree는 except_extension·size_limit·size_limit_per_file이 최상위이며 is_writable·board·사용량·path는 없다. drive의 is_open은 현재 경로, folder-tree는 모두false다. 근거: [08 폴더](../api/go/08-drive-folder.md):256–354.

자료실 조회의 잘못된 drive_folder_id는200 빈 path·직속 폴더이며 전체 트리를 유지한다. 파일 목록의 UUID 형식 오류는400이다. 일반 파일·북마크 목록은 활성 DRIVE·Read를 검사하지만 본인 mine의 state 분기는 같은 gate가 없어 상세/다운로드403과 다를 수 있다. mine의 state와 is_bookmark가 모두 생략/빈값이면 빈200이고, 정확히 is_bookmark=0인데 state 없음은400이다. truthy is_bookmark는 state가 없어도 북마크 분기로 들어가 활성 DRIVE·Read를 검사한다. query state는 DEL도 허용하고 mine?state=DEL이 휴지통 조건이다. 응답 DTO의 state는 ACT/UPLOADING/FAIL이며 삭제 여부는 deleted_at으로 판정한다. 근거: [파일 Query](../api/go/09-drive-file.md#list-query).

폴더 생성200, 수정은 Write 사용자, 삭제는 소유자 또는 CanManage 조건이다. 삭제는 재귀 삭제가 아니며 live 자식 폴더·FAIL 외 live 파일이 있으면 제외한다. 생성은 삭제된 부모를 받을 수 있고 수정 null은 루트 이동이 아니다. 성공만으로 트리 노출을 보장하지 않는다. 근거: [폴더 함정](../api/go/08-drive-folder.md):95–102, 228–244.

### 다운로드·업로드

GET S/attachments/{id}/download-url 또는 S/drive-files/{id}/download-url로 `{url,origin_file_name,expires_at}`을 받는다. 기본5분 presigned GET URL을 그대로 사용하며 인증 토큰을 S3에 붙이거나 src/object key로 URL을 재조립하지 않는다. 발급은 bytes 전송·HEAD 검사가 아니므로200 뒤 실제 GET이 실패할 수 있다.

자료실 다운로드는 presigner 설정 → 대상 존재 → Read → ACT 순서다. UPLOADING/FAIL은 권한 통과 후409 FILE_NOT_ACTIVE, 휴지통은 다운로드404다. 첨부는 live ACT/HIDE에 한정되며 저자의 SAVE/SCHEDULED도404다. 이미 발급한 URL의 즉시 권한 회수를 보장하지 않는다. 근거: [첨부](../api/go/05-post-read.md):489–535, [파일](../api/go/09-drive-file.md):575–615.

1. POST S/boards/{id}/drive-uploads에 files 배열을 보낸다. 최대10개, extension은 점 없는 영숫자1~16자다. [예약 응답](../api/go/10-upload-department-client.md#uploadresult)은 입력순서 `[{result}]`, success만 file_id/url, fail만 message다. echo/object_key가 없으므로 로컬 파일과 index로 대응한다.
2. success의 URL로 S3 PUT한다. URL·예약 기본1시간이며 presign200은 업로드 완료가 아니다. 금지 확장자 → 파일당 한도 → 전체 용량 순서로 거절하며 앞 파일 예약이 뒤 파일의 가용량에 영향을 준다.
3. POST S/drive-files/{file_id}/upload-complete 후 **DriveFileDTO.state=ACT**를 확인한다. 완료 권한은 Write가 아닌 Read·업로더 본인이다. 객체 없음/0byte는200 UPLOADING, 실측 파일당 한도 초과는200 FAIL, 이미 ACT/FAIL이면200 현재 행이다. HEAD 뒤 CAS 경합은409 UPLOAD_NOT_PENDING이다.

size_limit=null은 전체 무제한이지만 size_limit_per_file=null은 기본 **3GiB**다. 표시 사용량은 ACT, 예약·복원 quota는 ACT+UPLOADING을 포함한다. 완료에서 실측 크기로 바뀌어도 전체 quota는 다시 검사하지 않는다. 서명 실패500에도 예약 commit이 남을 수 있어 전체 재시도를 무조건 반복하지 않는다. 근거: [10 업로드](../api/go/10-upload-department-client.md):133–269.

### 조직도·이미지·클라이언트 버전

조직도는 member 인증의 루트 객체 하나이고 루트 없음은200 빈Body다. 여러 루트 중 최소ID 하나를 반환한다. breadcrumbs는 문자열, 직속 members의 겸직 중복과 total_members/member_count의 사용자 중복 제거는 다르다. category_id=0/빈값은 전체이며 부재·삭제 카테고리와 live 타회사 카테고리 처리도 다르다. 근거: [조직도 DTO](../api/go/10-upload-department-client.md#organizationdto), 10:271–315.

이미지는 exempt이고 image_url은 전체URL 아닌 허용 prefix의 S3 key다. o는 원본 bytes200, 나머지 지원 크기는 CDN302다. 원본 존재 검사가 size 검사보다 먼저이고 resize cache miss에만20MiB/4천만 픽셀 제한이 적용된다. 같은 key 덮어쓰기의 cache 무효화는 없다. 원본200을 JSON으로 파싱하지 않는다. 근거: [이미지](../api/go/10-upload-department-client.md):329–375.

게스트 버전은 exempt, 사용자 버전은 member다. 입력 오류422 VALIDATION_ERROR, 응답은 플랫폼 map이다. [버전 DTO](../api/go/10-upload-department-client.md#versiondto)의 표준9키 외 추가 키가 가능하다. 후보 없음의0.1.0과 DB 값null을 구분하고 latest/min은 선택한 한 행의 쌍이다. 사용자 경로 agent_id는 무시한다.

## 6. 일괄 작업·삭제·복원

입력 형식 오류의 전체 실패와 유효 ID의 권한·상태로 인한 부분 실패를 구분한다. **200만으로 전건 성공 처리하지 않는다.**

| 작업                             | 대상 전달·결과                                                                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 게시글 삭제·purge·복원·일괄 읽음 | query id와 Body ids 합산·중복 제거·정렬. Body를 보내면 ids 필수, readonly $schema 외 추가 키 불허. ids:[] 또는 null은 query id도 없을 때 no-op, query/Body 모두 없으면400. affected/ignored_ids 검사 |
| 파일 삭제·purge·복원             | JSON 객체 필수. id/ids 배열 중 non-empty id 우선, query 배열 미지원, 추가 키 무시. affected/ignored_ids 검사                                                                                         |
| 폴더 삭제                        | 파일과 같은 Body 선택 규칙이나 응답은 실제 삭제 UUID 배열. 중복 제거한 요청ID와 비교                                                                                                                 |
| 파일 복원 추가 결과              | success_drive/fail_drive는 게시판ID. success_count/fail_count는 파일 수이며 fail_count는 quota 실패만. affected와 success_count도 경합 시 다를 수 있음                                               |
| 공지 지정                        | ids는 게시글ID, badge_id는 뱃지ID. ignored_ids는 요청 ids의 미적용 글만, badge_id 무시까지 열거하지 않음                                                                                             |
| 권한·정렬                        | ignored_*·reordered는 개별 계약의 집계 대상. 반환하지 않은 거절 이유·변경 건수를 발명하지 않음                                                                                                       |

근거: [BulkIDs](../api/go/06-post-write.md#bulkids), [파일 Body](../api/go/09-drive-file.md#bulkbody)·[부분 결과](../api/go/09-drive-file.md#bulkresponse), [폴더](../api/go/08-drive-folder.md):206–244, [공지](../api/go/06-post-write.md):592–631.

게시글 삭제·purge는 **저자**, 복원은 **삭제자**다. 파일 휴지통 이동은 업로더 또는 관리자, 복원·purge는 업로더다. 댓글의 관리자 허용을 게시글로 확대하지 않는다. 공지 PUT은 회사/게시판 관리자 외 요청에403 대신200 no-op일 수 있다.

게시글 DEL은 deleted_at 파생값이며 파일은 state 유지·deleted_at/내부 purged_at으로 관리한다. 댓글은 is_active=false다. 글 복원은 기존 개별 삭제 댓글까지, 파일 복원은 과거 해제 북마크까지 복구할 수 있다. 경합으로 affected가 줄어도 ignored_ids가 추가되지 않을 수 있으므로 응답만으로 전ID를 완벽히 분류했다고 단정하지 않는다. 필요한 목록을 다시 확인하되 게시글 상세 GET을 무조건 포함하지 않는다. 근거: [06](../api/go/06-post-write.md), [09](../api/go/09-drive-file.md):401–411, 491–510.

## 7. 부수효과와 캐시

| 작업                  | 처리                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 미삭제 ACT 상세 GET   | 매호출 읽음 이벤트, 응답은 기록 전 값. 화면과 무관한 prefetch·중복 refetch 주의                                              |
| POST post-views       | 미삭제 ACT·살아 있는 게시판·Read 대상에 이미 읽어도 새 이벤트 추가. 요청 내부 ID만 중복 제거하며 idempotent 상태 설정이 아님 |
| 검색 GET              | 게시글은 검색 전, 파일은 지정 문자열 조건에서 동기 이력 저장. 이후 목록 오류와 이력 성공이 공존 가능                         |
| 댓글·조회·공감 count  | 조회 SQL 집계, 별도 count queue 대기시간 없음. 댓글 삭제가 count 감소를 뜻하지 않음                                          |
| bookmark·like POST    | 재전송은 반대 결과 가능. 응답 현재 상태를 반영하고 중복 클릭·응답 역전 관리                                                  |
| 글·댓글·업로드 알림   | 저장 commit 뒤 비동기. enqueue·템플릿·외부 전송 실패와 저장 성공 분리                                                        |
| 예약 발행·업로드 만료 | 매분 scheduler/worker 처리. 예정 시각 도달만으로 처리 완료 단정 금지                                                         |
| 파일·첨부 정리        | 파일 soft-delete30일, 첨부7일 또는 purged 표식이 대상. 매일UTC00:00, 회차당 최대500개. backlog·실패로 지연 가능              |

근거: [비동기 작업](../api/go/README.md#비동기-작업부수효과), [게시글 정리 경계](../api/go/06-post-write.md#알림예약파일-정리의-실제-경계), [파일 수명주기](../api/go/09-drive-file.md#lifecycle), [댓글 알림](../api/go/07-post-comment-like.md#댓글공감-알림).

mutation이 제공한 확정 필드만 캐시에 반영하고 영향받은 목록·트리·집계를 갱신한다. 기존 상세 캐시 직접 갱신 방식을 유지하며 **게시글 상세 재조회는 읽음 부수효과까지 검토**한다. 쓰기 DTO에 없는 관계를 지우거나 응답에 없는 기본값을 만들지 않는다.

worker 알림은 ko 고정이며 처리 시점 데이터·수신자를 사용한다. HTTP Read와 같은 수신자 집합을 보장하지 않는다. 비2xx webhook도 발송 latch가 남고 전송 뒤DB 실패는 중복 배달을 만들 수 있다. is_send_alarm을 수신 완료 표시에 쓰지 않는다. HTTP 동작만으로 Redis·worker·scheduler 배포를 보장하지 않는다.

purge200은 DB 표식이며 즉시 버킷 삭제가 아니다. 글 자체를30일 뒤 물리삭제하는 worker는 등록돼 있지 않다. 객체 삭제와 DB 판정은 원자적이지 않아 복원 경합에서 행은 살아 있지만 bytes가 사라질 수 있다. [06 정리 경계](../api/go/06-post-write.md#알림예약파일-정리의-실제-경계)·[09 수명주기](../api/go/09-drive-file.md#lifecycle)를 따른다.

## 8. 원문이 기록한 백엔드 이슈 18개

[원문 발견 이슈](../api/go/README.md#발견한-이슈)를 정리한 것이며 이번에 런타임 재현·수정한 목록이 아니다. 기존 항목의 이력과 새 상태는 [누적 대장](../api/backend-requests.md)에서 관리한다. 서버 결함·계약/문서 문제·프론트 미전환을 구분한다.

| #   | 원문 이슈                            | 프론트 처리·확인                                                                                                                                                                                                          |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 스키마/런타임 null 검증 차이         | optional null을 일괄400으로 가정하지 않음                                                                                                                                                                                 |
| 2   | query 배열 인코딩 대소문자 차이      | %5b 전처리 우회 확인                                                                                                                                                                                                      |
| 3   | 관리 설정 CHECK500                   | DB 제약 실패 처리                                                                                                                                                                                                         |
| 4   | 메인 위젯 조회 없음                  | 수정 응답·목록 조합을 읽기 계약으로 대체했다고 주장하지 않음                                                                                                                                                              |
| 5   | 음수 업로드 size·예약 잔존           | 배치전체500·서명 실패 뒤 잔존 예약 구분                                                                                                                                                                                   |
| 6   | 삭제된 부모 폴더 허용                | 생성/업로드 성공과 트리 노출 구분                                                                                                                                                                                         |
| 7   | 폴더 null 루트 이동 불가             | null로 이동 완료 표시 금지                                                                                                                                                                                                |
| 8   | 파일 복원이 해제 북마크도 복원       | 북마크 표시도 갱신                                                                                                                                                                                                        |
| 9   | S3 삭제·복원 경합                    | DB 복원과 bytes 존재 구분                                                                                                                                                                                                 |
| 10  | 글 복원이 개별 삭제 댓글도 활성화    | 댓글 복원 범위 확인                                                                                                                                                                                                       |
| 11  | purge 글 직접조회 조건 누락          | 영구삭제 표식과 저자 상세 가시성 차이                                                                                                                                                                                     |
| 12  | 알림 latch와 외부 배달 불일치        | 수신 완료 보장 금지                                                                                                                                                                                                       |
| 13  | 관리자 복원 응답 created_at 차이     | 응답 현재시각과 DB 최초시각 구분                                                                                                                                                                                          |
| 14  | 카테고리 삭제·자식 생성 경합         | 삭제 부모 아래 live 자식 가능성 추적                                                                                                                                                                                      |
| 15  | 게시글 last_page 덧셈 overflow       | 극단 take의 안전한 계산 보장 금지                                                                                                                                                                                         |
| 16  | BOARD_DRIVE_BOUNDARY 문구·판정 차이  | 실제 전환·용량 규칙 사용                                                                                                                                                                                                  |
| 17  | bookmark page×take overflow          | 극단 페이지 정수 계산 보장 금지                                                                                                                                                                                           |
| 18  | 기존 initial과 최신 refresh DDL 차이 | 이미 initial을 적용한 DB에 refresh_tokens가 없을 수 있어 로그인 저장500이 발생한다. [BR-030](../api/backend-requests.md#br-030)의 로컬 복구와 다른 배포 환경의 증분 반영을 구분한다. [원문:474](../api/go/README.md#L474) |

## 9. 운영에서 확정할 3개 항목

[운영 미확정](../api/go/README.md#코드-밖에서-결정되는-값)은 코드의 미조사와 다르다. 기본값으로 운영 상태를 확정하지 않는다.

| 항목                             | 확인 위치·조치                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| 공개 Base URL·활성 설정·실제 TTL | 배포 origin·프록시, BOARD__/OFFICENEXT__. localhost·기본TTL을 운영 상수로 만들지 않음    |
| S3/CDN·브라우저 업로드           | 실제 버킷 IAM·CORS·CDN. API presign 성공과 브라우저 PUT/GET 성공을 별도 확인             |
| 외부 인증·알림·워커              | OfficeNext·웹훅·Redis·worker/scheduler 로그·알림 템플릿. 저장 성공과 배달·배치 실행 구분 |

## 10. 연동 작업 순서

1. 카탈로그에서 경로를 찾고 원문의 공통 규칙·공유 DTO·Path/Query/Body·권한·Response·주의사항을 함께 읽는다.
2. credential·스코프·생략/null/빈값·추가 키·조건부 DTO·부분 실패·빈Body를 정리한다.
3. 실제 구현 단계에서 service → hook → 화면 바인딩을 확인한다. 기존 타입은 현황이며 계약 근거가 아니다.
4. 기존 query key·캐시 범위를 새 계약과 대조하고 읽음·검색이력·토글·refresh의 재시도 의미를 확인한다.
5. 막힌 지점은 대장에 화면·증상·근거·임시 조치·요청을 남긴다. Go에 이미 있는 API를 못 부르는 경우는 프론트 미전환이다.
6. 런타임 확인은 실제 개발용 데이터·인증·배포 조건에서 수행하고 범위를 보고한다. 원본 작성자의 검사를 이번 직접 실행으로 표현하지 않는다.

화면 작업에서 레거시 Vue `jupiter-board-web`을 먼저 읽는 CLAUDE.md 순서와 기존 사용자 UI 결정은 그대로 따른다. 이 문서 갱신이 실제 API 연결·서비스·타입·UI 전환 완료를 뜻하지 않는다.
