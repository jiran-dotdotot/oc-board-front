# 09. 자료실 파일

이 파일은 등록 라우트 **9개**를 다룬다. 폴더 탐색은 [08](08-drive-folder.md), presigned 업로드·완료는 [10](10-upload-department-client.md), Read/Write/CanManage의 전문은 [04](04-board.md)다. 근거: `internal/transport/httpapi/board/routes.go:901`, `internal/transport/httpapi/board/routes.go:927`, `internal/transport/httpapi/board/routes.go:946`, `internal/transport/httpapi/board/routes.go:963`, `internal/transport/httpapi/board/routes.go:1034`, `internal/transport/httpapi/board/routes.go:1052`, `internal/transport/httpapi/board/routes.go:1070`, `internal/transport/httpapi/board/routes.go:1089`, `internal/transport/httpapi/board/routes.go:1185`.

## 공통 사항

응답 DTO·에러 봉투에는 [Huma 자동 특수필드](README.md#schema-field)를 함께 적용한다. 등록된 최상위 struct 응답에만 `$schema:string`(null 불가, 계산된 URL)와 `Link`가 추가되며 배열·map·빈Body·gin 직접응답에는 없다. 아래 업무 필드 표에 반복하지 않는다. 입력의 추가 키 불허도 framework의 readonly `$schema` 특수키는 예외다. [Huma transforms.go:157](https://github.com/danielgtaylor/huma/blob/v2.39.0/transforms.go#L157)

이 파일의 공통 오류표에406이 열거되어도 현재 router의 기본 format fallback에서는 미지원 Accept가 JSON으로 처리되어 일반적인406 분기가 생기지 않는다. Content-Type 누락·빈값은 JSON 기본이다. [Huma api.go:355](https://github.com/danielgtaylor/huma/blob/v2.39.0/api.go#L355), [defaults.go:79](https://github.com/danielgtaylor/huma/blob/v2.39.0/defaults.go#L79)

- 모두 **board 계약**이다. 필수 헤더 `Authorization: Bearer <board access token>`은 토큰 교환으로 받은 board 토큰을 사용한다. 헤더명과 Bearer의 대소문자는 무관하며 Bearer 뒤 ASCII 공백이 필요하다. 누락/불량/만료/board 검증기 미설정은 401 `UNAUTHORIZED`. 근거: `internal/transport/httpapi/middleware/auth.go:95`, `internal/transport/httpapi/middleware/auth.go:150`.
- 모든 Path의 `company_id`, `user_id`는 토큰 int64의 표준 십진 문자열과 **바이트 단위로 같아야** 한다. 잘못된 숫자, `+42`, `042`, 타인 ID는 모두 403 `FORBIDDEN`. 아래 “공통 scope”는 이 두 필드를 뜻한다. 근거: `internal/transport/httpapi/middleware/auth.go:212`, `internal/transport/httpapi/middleware/auth.go:261`.
- JSON 요청에는 `Content-Type: application/json`; 날짜 출력은 UTC `YYYY-MM-DDTHH:mm:ss.ffffffZ`, DB는 `timestamptz(3)`이다. 파일 size·quota는 bytes 단위의 JSON 정수(int64)다. `state` 저장 enum은 **UPLOADING/FAIL/ACT**이고 삭제는 `deleted_at`이 결정한다. **응답 state가 DEL로 바뀌지 않는다**. 근거: `migrations/board/000001_initial_schema.sql:783`, `migrations/board/000001_initial_schema.sql:822`, `internal/transport/httpapi/board/drivefilesbody.go:583`, `internal/transport/httpapi/board/dto.go:25`.
- 입력 검증은 자원 권한 검사보다 먼저 수행한다. Huma schema 오류는 board에서 400 `INVALID_PAYLOAD`; 단건 자원 접근은 각 절의 404→403 순서를 따르고 일괄 처리는 거절 ID를 200에 포함한다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:106`, `internal/transport/httpapi/board/drivewrite.go:131`, `internal/domain/board/drivefilequery.go:798`.
- `Lang`은 user/delete_user 표시 이름, `Time_zone`은 시간대 없는 검색 날짜에 사용한다. 생략 언어는 ko, 시간대는 **Asia/Seoul**; 잘못된 시간대도 Asia/Seoul로 fallback한다. 기본 zone 데이터 자체를 못 읽는 예외 환경만 UTC다. 헤더명은 하이픈이 아닌 **언더스코어 `Time_zone`**이다. 근거: `internal/transport/httpapi/middleware/locale.go:26`, `internal/transport/httpapi/board/signaluserview.go:61`, `internal/transport/httpapi/board/drivefiles.go:100`.

| status/code | 의미 | 근거 |
| --- | --- | --- |
| 400 `INVALID_PAYLOAD` | UUID·정수·불리언·enum·길이·날짜·Body 검증 실패; mine의 is_bookmark=0인데 state 없음 | `internal/transport/httpapi/humaerr/humaerr.go:188`, `internal/transport/httpapi/board/drivefiles.go:156` |
| 401 `UNAUTHORIZED` | board 토큰 인증 실패 | `internal/transport/httpapi/middleware/auth.go:184` |
| 403 `FORBIDDEN` | scope 불일치, 상세/북마크/다운로드의 Read 거절 | `internal/transport/httpapi/middleware/auth.go:212`, `internal/transport/httpapi/board/drivefiles.go:68` |
| 404 `NOT_FOUND` | 단건 대상이 요청 회사 범위에 없거나 해당 작업에서 조회 대상이 아님 | `internal/transport/httpapi/board/drivefiles.go:66` |
| 409 `FILE_NOT_ACTIVE` | 다운로드에서 Read 통과 후 파일이 UPLOADING/FAIL | `internal/transport/httpapi/board/drivedownload.go:152` |
| 500 `INTERNAL_ERROR` | DB/서명 등 내부 실패, 내부 원문 비노출 | `internal/transport/httpapi/board/drivefiles.go:77`, `internal/transport/httpapi/board/drivedownload.go:134` |
| 503 `SERVICE_UNAVAILABLE` | 다운로드 presigner 미설정, 또는 공통 request context 취소/기한 만료 | `internal/transport/httpapi/board/drivedownload.go:111`, `internal/transport/httpapi/board/handler.go:290` |
| 406 `NOT_ACCEPTABLE` / 408 `REQUEST_TIMEOUT` / 413 `REQUEST_ENTITY_TOO_LARGE` / 415 `UNSUPPORTED_MEDIA_TYPE` | 공통 협상/Body 읽기/크기/미지원 콘텐츠 타입 | `internal/transport/httpapi/humaerr/humaerr.go:198` |

에러 봉투는 `{"error":{"code":"...","message":"...","details":["..."]}}`이고 `details`는 선택이다. 읽을 수 없는 board를 목록 filter에 넣는 것은 에러가 아니라 **200 빈 결과**다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:19`, `internal/domain/board/drivefilequery.go:124`, `internal/domain/board/drivefilequery.go:601`.

Huma 오류의 message는 카탈로그가 `?lang=` → `Lang` → `Accept-Language` → 영어 순으로 선택해 덮어쓴다. 따라서 날짜 파싱 오류나 `is_bookmark=0`의 state 누락에서 핸들러의 상세 문구로 분기하지 않는다. `FILE_NOT_ACTIVE`는 카탈로그에 없어 `The file is not available for download.`가 유지된다. JWTAuth의 401은 영어 `Authentication required.` 및 `WWW-Authenticate: Bearer`, PathScope의 403은 영어 `You do not have permission.`이며 번역되지 않는다. 근거: `internal/transport/httpapi/humaerr/lang.go:27`, `internal/transport/httpapi/humaerr/lang.go:127`, `internal/transport/httpapi/humaerr/lang.go:157`, `internal/transport/httpapi/board/drivedownload.go:152`, `internal/transport/httpapi/middleware/auth.go:174`, `internal/transport/httpapi/middleware/auth.go:270`.

이 9개 계약에는 `422/BOARD_NOT_DRIVE` 분기가 없다. 통합·북마크 목록은 DRIVE 게시판만 먼저 추려 빈 결과로 응답하고, mine 본인 분기·상세·일괄 쓰기·북마크 토글·다운로드는 별도 DRIVE 종류 거절을 수행하지 않는다. 공통 driveError에 그 code가 있다는 사실만으로 이 파일의 에러 분기에 추가하지 않는다. 근거: `internal/domain/board/drivefilequery.go:91`, `internal/domain/board/drivefilequery.go:638`, `internal/domain/board/drivefilequery.go:798`, `internal/domain/board/drivefilewrite.go:120`, `internal/domain/board/drivefilewrite.go:182`, `internal/domain/board/drivefilewrite.go:251`, `internal/domain/board/drivefilewrite.go:344`, `internal/domain/board/drivedownload.go:88`.

### curl 준비

각 endpoint의 예시는 서로 독립된 시작 상태를 가정한다. 쓰기 예시를 실행한 뒤에는 다음 예시의 파일·폴더 변수를 설명된 상태의 실제 ID로 다시 설정한다.

실제 토큰과 리소스 ID로 바꿔 설정한다. `FILE_ID`는 살아 있는 파일, `TRASH_FILE_ID`는 본인 휴지통 파일, `PENDING_FILE_ID`는 본인 UPLOADING 파일 예시다. 상태별 가능 여부는 각 endpoint의 권한 절을 따른다. 근거: `internal/domain/board/drivefilewritequery.go:209`, `internal/domain/board/drivefilewritequery.go:411`, `internal/domain/board/drivedownload.go:109`.

```sh
export BASE_URL='http://localhost:8080'
export BOARD_TOKEN='발급받은-board-access-token'
export COMPANY_ID='42' USER_ID='7'
export BOARD_ID='11111111-1111-4111-8111-111111111111'
export FOLDER_ID='22222222-2222-4222-8222-222222222222'
export FILE_ID='44444444-4444-4444-8444-444444444444'
export TRASH_FILE_ID='55555555-5555-4555-8555-555555555555'
export PENDING_FILE_ID='66666666-6666-4666-8666-666666666666'
export SCOPE="$BASE_URL/api/v1/board/companies/$COMPANY_ID/users/$USER_ID"
```

## 공유 DTO 필드 표

<a id="drivefiledto"></a>
### DriveFileDTO

목록·mine·bookmarks·상세·[업로드 완료](10-upload-department-client.md)가 공유한다. 객체 키는 아래 전부이며 `src`, 직접 다운로드 URL, `purged_at`, 수정 가능 여부는 없다. 다운로드 URL은 전용 endpoint로 받는다. 근거: `internal/transport/httpapi/board/drivefilesbody.go:462`, `internal/transport/httpapi/board/drivefilesbody.go:577`, `internal/transport/httpapi/board/drivefiles_test.go:264`.

| 필드 | JSON 타입 | null | 저장/계산·기본 관계·포맷 | 근거 |
| --- | --- | --- | --- | --- |
| id | string(UUID) | 아니오 | 파일 저장 ID | `internal/transport/httpapi/board/drivefilesbody.go:579` |
| company_id | integer(int64) | 아니오 | 저장 회사 | `migrations/board/000001_initial_schema.sql:785` |
| category_id | string(UUID) | 가능 | **게시판에서 JOIN**; 공용 또는 게시판 조인 불가 시 null, 파일에 복사 저장 안 함 | `internal/domain/board/drivefilequery.go:778` |
| board_id | string(UUID) | 아니오 | 파일 저장 게시판 ID, board 관계가 null이어도 ID 유지 | `internal/domain/board/drivefilequery.go:528` |
| drive_folder_id | string(UUID) | 가능 | 저장 위치, null=루트 | `migrations/board/000001_initial_schema.sql:787` |
| user_id | integer(int64) | 가능 | 저장 업로더; 사용자 삭제 시 null 가능 | `migrations/board/000001_initial_schema.sql:788` |
| state | string | 아니오 | 저장 enum UPLOADING/FAIL/ACT; 휴지통에서도 원래 값 | `migrations/board/000001_initial_schema.sql:822`, `internal/transport/httpapi/board/drivefilesbody.go:583` |
| origin_file_name | string | 아니오 | 저장 원본명, 비어 있지 않음, DDL 길이 상한 없음 | `migrations/board/000001_initial_schema.sql:791`, `migrations/board/000001_initial_schema.sql:824` |
| extension | string | 아니오 | 저장 text, 응답 시 재정규화 없음; enum/DDL 길이 상한 없음 | `migrations/board/000001_initial_schema.sql:792`, `internal/transport/httpapi/board/drivefilesbody.go:585` |
| size | integer(int64 bytes) | 아니오 | 저장, 0 이상; 예약/완료에서 측정값이 달라질 수 있음 | `migrations/board/000001_initial_schema.sql:793`, `migrations/board/000001_initial_schema.sql:823`, `internal/domain/board/drivecomplete.go:195` |
| delete_user_id | integer(int64) | 가능 | 저장 삭제자; null이 아니려면 deleted_at 있어야 함 | `migrations/board/000001_initial_schema.sql:826` |
| upload_expire_at | string(timestamp) | 아니오 | 저장 예약 만료시각, 완료 후에도 키 유지 | `internal/transport/httpapi/board/drivefilesbody.go:588` |
| created_at | string(timestamp) | 아니오 | 저장, 공통 UTC 포맷 | `internal/transport/httpapi/board/drivefilesbody.go:589` |
| updated_at | string(timestamp) | 아니오 | 저장, 공통 UTC 포맷 | `internal/transport/httpapi/board/drivefilesbody.go:590` |
| deleted_at | string(timestamp) | 가능 | 저장 휴지통 진입시각, null=살아 있음 | `migrations/board/000001_initial_schema.sql:798` |
| is_bookmark | boolean | 아니오 | 현재 요청자의 살아 있는 북마크 EXISTS 계산 | `internal/domain/board/drivefilequery.go:779` |
| user | [SignalUserView](#signaluserview) | 가능 | 동일 회사 업로더 LEFT JOIN, 기본 포함; 사용자 부재면 null | `internal/domain/board/drivefilequery.go:195`, `internal/domain/board/signaluser.go:89` |
| delete_user | [SignalUserView](#signaluserview) | 가능 | 동일 회사 삭제자 LEFT JOIN, 기본 포함; 없으면 null | `internal/domain/board/drivefilequery.go:196`, `internal/domain/board/signaluser.go:119` |
| board | `{id:string(UUID), title:string}` | 가능 | 저장 게시판 projection, 기본 JOIN; mine에서 삭제된 게시판이면 null | `internal/domain/board/drivefilequery.go:192`, `internal/transport/httpapi/board/drivefilesbody.go:510` |

<a id="signaluserview"></a>
### SignalUserView

[08의 FolderView](08-drive-folder.md#folderview)의 `user`도 같은 표를 사용한다. 이름·profile URL은 원본 DB 값 그대로가 아닐 수 있다. 근거: `internal/transport/httpapi/board/foldersbody.go:210`, `internal/transport/httpapi/board/signaluserview.go:61`.

| 필드 | 타입 | null | 저장/계산·포맷 | 근거 |
| --- | --- | --- | --- | --- |
| id | integer(int64) | 아니오 | 저장 사용자 ID | `internal/transport/httpapi/board/signaluserview.go:50` |
| name | string | 가능 | 저장 이름+계산 접미사; deleted_at이면 `(퇴직)/(Retired)/(退職)`, 아니고 disabled_at이면 `(중지)/(Suspended)/(停止)`; 이름 null인 퇴직·중지 사용자도 접미사 문자열 | `internal/transport/httpapi/board/me.go:172`, `internal/transport/httpapi/board/me.go:213` |
| profile_image_id | string | 가능 | 저장 ID | `internal/transport/httpapi/board/signaluserview.go:52` |
| disabled_at | string(timestamp) | 가능 | 저장, UTC 포맷 | `internal/transport/httpapi/board/signaluserview.go:69` |
| deleted_at | string(timestamp) | 가능 | 저장, UTC 포맷 | `internal/transport/httpapi/board/signaluserview.go:70` |
| profile_src | string(URL) | 가능 | 계산 `host/image/resize/s?image_url=folder/user/profile/{id}/profile_image.png`; host/이미지ID 없음 또는 중지 사용자는 null; 이름만 퇴직이면 그것만으로 숨기지 않음 | `internal/transport/httpapi/board/me.go:323` |

언어 선택은 `Lang` 생략 ko, 정확히 `ko/en/ja`, 그 외 영어다. 이 projection에는 `account`, 부서, rank 관계가 없다. 근거: `internal/transport/httpapi/board/me.go:213`, `internal/transport/httpapi/board/me.go:240`, `internal/transport/httpapi/board/signaluserview.go:49`.

<a id="page"></a>
### 파일 목록 봉투

| 필드 | 타입 | null | 저장/계산·포맷 | 근거 |
| --- | --- | --- | --- | --- |
| data | [DriveFileDTO](#drivefiledto)[] | 아니오 | 계산 조회 결과, 없으면 [] | `internal/transport/httpapi/board/drivefilesbody.go:556` |
| current_page | integer | 아니오 | 요청 page, 1부터 | `internal/domain/board/drivefile.go:451` |
| last_page | integer | 아니오 | ceil(total/per_page), total=0이면1 | `internal/domain/board/postlist.go:344` |
| per_page | integer | 아니오 | 정규화한 take 또는 limit, 최대100 | `internal/domain/board/drivefile.go:333` |
| total | integer(int64) | 아니오 | 동일 조건 COUNT, 전체 hit 수 | `internal/domain/board/drivefilequery.go:673` |

`/drive-files`만 `is_not_paging=true`이면 **봉투 없이 DTO[]**. mine/bookmarks는 같은 flag를 받아도 봉투를 유지하고 **페이지 크기만 limit(기본10)**으로 바꾼다. 비페이징도 page offset과 최대100은 유지하므로 “전체 파일” 요청이 아니다. 근거: `internal/transport/httpapi/board/drivefilesbody.go:269`, `internal/transport/httpapi/board/drivefilesbody.go:543`, `internal/transport/httpapi/board/drivefiles.go:183`, `internal/transport/httpapi/board/drivefiles.go:231`, `internal/domain/board/drivefilequery.go:659`.

Laravel 페이지 봉투의 `from`, `to`, `path`, `links`, 페이지 URL 필드는 제공하지 않는다. 위 다섯 업무 필드에서 페이지 UI를 계산한다. 근거: `internal/transport/httpapi/board/postsbody.go:41`, `internal/transport/httpapi/board/drivefilesbody.go:556`.

<a id="list-query"></a>
### 3개 목록의 공통 Query 전수

아래 **23개**가 전부이며 모두 선택이다(`mine`의 조건부 state 필수는 별도). 문자열 길이 상한은 명시한 최소값 외 **없음**, 배열형 query는 **없음**. `sort[by]` 등은 배열/객체 JSON이 아니라 **그 이름 자체의 query key**다. query 빈 문자열은 미입력으로 처리된다. `sort%5Bby%5D=...`처럼 URL-encode하거나 `curl --data-urlencode`를 사용한다. 근거: `internal/transport/httpapi/board/drivefilesbody.go:46`, 설치된 `github.com/danielgtaylor/huma/v2@v2.39.0/huma.go:962`.

선언되지 않은 `more_field`, `id`, `user_id`, `is_deleted` query는 오류 없이 무시한다. 특히 `id`를 넣어도 단건 필터가 되지 않고, `more_field=board` 없이도 board 관계가 포함된다. 전역 QueryArrays는 `k[]`·`k[0]`의 키를 `k`로 바꾸지만 `sort[by]`·`sort[order]`·`sort[value]`는 그대로 보존한다. 근거: `internal/transport/httpapi/board/drivefilesbody.go:46`, `internal/transport/httpapi/board/drivefilesbody.go:597`, `internal/transport/httpapi/middleware/queryarray.go:98`, `internal/transport/httpapi/router.go:354`, 설치된 `github.com/danielgtaylor/huma/v2@v2.39.0/huma.go:883`.

| 이름 | 타입 | 기본값 | 허용값·파싱·상한·효과 | 근거 |
| --- | --- | --- | --- | --- |
| take | integer | 20 | 1 이상; 100 초과는 **거절하지 않고100으로 clamp** | `internal/transport/httpapi/board/drivefilesbody.go:60`, `internal/domain/board/drivefile.go:333` |
| page | integer | 1 | 1 이상; 별도 schema 상한 없음, 마지막 이후=[]; 정수 파싱 int64 범위 밖이면400 | `internal/transport/httpapi/board/drivefilesbody.go:61`, 설치된 `github.com/danielgtaylor/huma/v2@v2.39.0/huma.go:1803` |
| is_not_paging | boolean | false | 아래 엄격 bool 규칙; true이면 take 대신 limit 적용, 봉투 제거는 일반목록만 | `internal/transport/httpapi/board/drivefilesbody.go:86`, `internal/transport/httpapi/board/drivefilesbody.go:269` |
| limit | integer | 미지정0, is_not_paging=true일 때 실효10 | 지정 시1 이상; 실제 최대100; flag=false면 무시되지만 타입/범위 검증은 수행 | `internal/transport/httpapi/board/drivefilesbody.go:87`, `internal/transport/httpapi/board/drivefilesbody.go:270` |
| board_id | UUID string | 없음 | 일치하는 게시판만; nil UUID(전부0)는 filter 없음, 잘못된 UUID400; 권한 없는 board는 일반/북마크 목록에서 [] | `internal/transport/httpapi/board/drivefilesbody.go:89`, `internal/transport/httpapi/board/drivefilesbody.go:272` |
| drive_folder_id | UUID string | 없음 | 일치 폴더만, UUID 파싱 실패400; nil UUID는 filter 없음 | `internal/transport/httpapi/board/drivefilesbody.go:98`, `internal/transport/httpapi/board/drivefilesbody.go:275` |
| is_root | boolean | false | 자료실 루트 파일만; folder filter와 함께 true이면 AND이므로 [] | `internal/transport/httpapi/board/drivefilesbody.go:99`, `internal/domain/board/drivefilequery.go:368` |
| is_drive_root | boolean | false | is_root의 별칭, 둘 중 하나 true면 루트 | `internal/transport/httpapi/board/drivefilesbody.go:106`, `internal/transport/httpapi/board/drivefilesbody.go:262` |
| state | string | 없음 | enum **UPLOADING,FAIL,ACT,DEL**; 그 외400. 일반목록·북마크는 값 무시 ACT 고정. mine만 적용: DEL은 deleted_at!=null, purged_at=null, 저장 state 조건 없음 | `internal/transport/httpapi/board/drivefilesbody.go:155`, `internal/transport/httpapi/board/drivefilesbody.go:356`, `internal/transport/httpapi/board/drivefiles.go:225` |
| category_id | UUID string | 없음 | 일반/북마크: 그 카테고리와 직속 하위 게시판만; mine 본인 분기는 **무시** | `internal/transport/httpapi/board/drivefilesbody.go:163`, `internal/domain/board/drivefilequery.go:132`, `internal/domain/board/drivefilequery.go:638` |
| is_public_only | boolean | false | 일반/북마크: category_id=null인 공용 게시판만; mine 본인 분기는 **무시** | `internal/transport/httpapi/board/drivefilesbody.go:164`, `internal/domain/board/drivefilequery.go:129` |
| is_only_file_search | string | 빈 문자열 | enum 없음. 일반목록에서 **non-empty**이며 search 또는 title도 non-empty일 때 최근검색어 저장. `0`, `false`도 켜짐, `?is_only_file_search=`는 안 켜짐; mine/bookmarks 무시 | `internal/transport/httpapi/board/drivefilesbody.go:176`, `internal/transport/httpapi/board/drivefilesbody.go:398` |
| is_bookmark | string | 빈 문자열 | enum 없음. mine에서 `""`/`"0"` 제외 전부 북마크 분기(`false`도 true 취급); 정확히0이면 state 필수. 일반목록/전용북마크에서는 무시 | `internal/transport/httpapi/board/drivefilesbody.go:191`, `internal/transport/httpapi/board/drivefilesbody.go:381` |
| search | string | 빈 문자열 | 원본 파일명 **또는 업로더 이름** ILIKE, 2 Unicode 문자 미만 무시. non-empty면 title·title_content보다 우선(한 글자도 우선) | `internal/transport/httpapi/board/drivefilesbody.go:210`, `internal/transport/httpapi/board/drivefilesbody.go:296`, `internal/domain/board/drivefilequery.go:305` |
| title | string | 빈 문자열 | 최소2자, 최대없음; 파일명 ILIKE만. search 없을 때 title_content보다 우선; 1자면400 | `internal/transport/httpapi/board/drivefilesbody.go:216`, `internal/transport/httpapi/board/drivefilesbody.go:299` |
| title_content | string | 빈 문자열 | 본문은 없음, 파일명 ILIKE만; 2자 미만 무시; 앞의 두 이름이 비었을 때 적용 | `internal/transport/httpapi/board/drivefilesbody.go:217`, `internal/domain/board/drivefilequery.go:386` |
| user_name | string | 빈 문자열 | 업로더 이름 ILIKE 추가 AND 조건, 2자 미만 무시 | `internal/transport/httpapi/board/drivefilesbody.go:218`, `internal/domain/board/drivefilequery.go:396` |
| limit_day | integer | -1 | 최소-1, 별도 상한없음; -1=기간무제한, 0 이상이면 서버 now−N일 이상 created_at | `internal/transport/httpapi/board/drivefilesbody.go:225`, `internal/domain/board/drivefilequery.go:407` |
| start_posted_at | string | 없음 | 실제 **created_at** 하한(포함). RFC3339 또는 `YYYY-MM-DD HH:mm:ss` 또는 `YYYY-MM-DD`; 뒤 두 형식은 Time_zone, 날짜만은 자정. 잘못된 날짜400 | `internal/transport/httpapi/board/drivefilesbody.go:234`, `internal/transport/httpapi/board/dto.go:89` |
| end_posted_at | string | 없음 | created_at 상한(포함), 위와 같은 형식. 날짜만=그날 자정이라 하루 끝까지가 아님 | `internal/transport/httpapi/board/drivefilesbody.go:235`, `internal/domain/board/drivefilequery.go:289` |
| sort[by] | string | created_at | 지원 **created_at,origin_file_name,size,relative**; 그 외도 허용하지만 created_at 정렬로 fallback | `internal/transport/httpapi/board/drivefilesbody.go:243`, `internal/domain/board/drivefilequery.go:432` |
| sort[order] | string | desc | enum **asc,desc**, 정확한 소문자만; 다른 값400 | `internal/transport/httpapi/board/drivefilesbody.go:244` |
| sort[value] | string | 없음 | non-empty 최소1, 최대없음; relative에서 검색어 등장수를 기준으로 정렬. 없으면 created_at로 fallback | `internal/transport/httpapi/board/drivefilesbody.go:245`, `internal/domain/board/drivefilequery.go:449` |

**엄격 boolean 네 종류**(`is_not_paging`, `is_root`, `is_drive_root`, `is_public_only`)는 `1,t,T,TRUE,true,True`→true, `0,f,F,FALSE,false,False`→false. `yes`, `on`, `2`, `null`, 공백은 **400 `INVALID_PAYLOAD`**. 빈 query 값은 입력하지 않은 false로 취급한다. `is_bookmark`, `is_only_file_search`는 이 규칙이 아닌 위 문자열 규칙이다. 근거: 설치된 `github.com/danielgtaylor/huma/v2@v2.39.0/huma.go:1830`, Go 1.26.7 `src/strconv/atob.go:10`, `internal/transport/httpapi/board/drivefilesbody.go:381`.

사용자 이름 검색은 표시용 퇴직/중지 접미사를 붙이기 전 `public.users.name`을 읽으며, soft-deleted·disabled 사용자 이름도 해당 이름 검색에서 배제하지 않는다. 근거: `internal/domain/board/drivefilequery.go:265`.

검색어에는 wildcard escape를 하지 않아 `%`·`_`가 PostgreSQL ILIKE wildcard다. 정렬은 마지막에 ID를 붙이며 휴지통 DEL은 요청 sort와 무관하게 **updated_at DESC, id ASC**. `relative`는 앞의 탭을 지운 파일명에서 대소문자를 구분하는 STRING_TO_ARRAY 분할 수를 사용한다(본문 relevance가 아님). 날짜의 상하한 역전은 별도 오류가 아니라 모순 AND에 따라 빈 결과다. 근거: `internal/domain/board/postlistfilter.go:393`, `internal/domain/board/drivefilequery.go:432`, `internal/domain/board/drivefilequery.go:478`, `internal/domain/board/drivefilequery.go:412`.

| 정렬 분기 | 실제 순서(`dir`은 sort[order], 기본 DESC) | 근거 |
| --- | --- | --- |
| 휴지통 DEL | updated_at DESC → id ASC | `internal/domain/board/drivefilequery.go:447` |
| relative + non-empty sort[value] | 파일명 분할 수 dir → **created_at DESC 고정** → id ASC | `internal/domain/board/drivefilequery.go:449` |
| origin_file_name | origin_file_name dir → id ASC | `internal/domain/board/drivefilequery.go:454` |
| size | size dir → id ASC | `internal/domain/board/drivefilequery.go:456` |
| created_at·미인식 값·value 없는 relative | created_at dir → id ASC | `internal/domain/board/drivefilequery.go:458` |

relative의 sort[value]도 SQL 문자열에 이어붙이지 않고 바인딩 값으로 전달한다. 매우 큰 page의 offset 곱셈은 포화 계산하여 음수 overflow를 막고 빈 페이지로 처리한다. 근거: `internal/domain/board/drivefilequery.go:655`, `internal/domain/board/drivefilequery.go:665`.

<a id="bulkbody"></a>
### 일괄 쓰기 공통 Body

객체 필수, `ids?:UUID[]|null`, `id?:UUID[]|null`. 기본 빈 목록, 최소/최대 개수 **없음**, 중복은 제거한다. `id`가 non-empty이면 `ids`보다 우선, 양쪽 누락/빈 배열은 no-op이다. 추가 키는 **허용·무시**, 잘못된 원소 UUID는 400 `INVALID_PAYLOAD`. 전체 Body는 Huma 기본 **1MiB** 상한이 있다. 근거: `internal/transport/httpapi/board/drivewritebody.go:27`, `internal/transport/httpapi/board/drivewritebody.go:41`, `internal/transport/httpapi/board/drivewritebody.go:56`, `internal/domain/board/drivefilewrite.go:422`, 설치된 `github.com/danielgtaylor/huma/v2@v2.39.0/schema.go:29`, `github.com/danielgtaylor/huma/v2@v2.39.0/huma.go:1491`.

<a id="bulkresponse"></a>
### Trash/Purge 응답

| 필드 | 타입 | null | 저장/계산·관계 | 근거 |
| --- | --- | --- | --- | --- |
| affected | integer(int64) | 아니오 | 실제 변경한 파일 행 수; 관계 없음 | `internal/transport/httpapi/board/drivewritebody.go:181` |
| ignored_ids | string(UUID)[] | 아니오 | 자격 없는/없는/이미 처리된 ID; [] 가능, 거절 사유 개별 비공개 | `internal/transport/httpapi/board/drivewritebody.go:184` |

파일당 업로드 기본한도 **3GiB**, 예약 만료와 완료 판정은 [10 업로드](10-upload-department-client.md)에서 정의한다. 파일 목록의 is_bookmark는 요청마다 SQL EXISTS로 계산하며 이 경로에 6000초 캐시는 없다. DB 계산을 CDN/S3의 캐시 정책으로 확대 해석하지 않는다. `internal/domain/board/driveupload.go:61`, `internal/domain/board/drivefilequery.go:774`

## ⚠️ 이 도메인의 함정

1. 내 파일은 `?state=ACT`를 명시한다. state 없이 /mine은 **200 빈 페이지**, `is_bookmark=0`만 붙이면 **400**, `is_bookmark=false`는 **북마크 목록**이다. 근거: `internal/transport/httpapi/board/drivefiles.go:149`, `internal/transport/httpapi/board/drivefilesbody.go:381`.
2. 일반·북마크 목록은 Read와 활성 DRIVE를 요구하지만 본인 mine은 Read 검사 없이 본인 데이터를 조회한다. 목록에서 보인 내 파일이 상세/다운로드에서는403일 수 있다. 근거: `internal/domain/board/drivefilequery.go:91`, `internal/domain/board/drivefilequery.go:638`, `internal/domain/board/drivefilequery.go:813`.
3. DEL은 query에서 휴지통을 선택하는 값이다. 응답 `state`는 ACT/FAIL/UPLOADING이고 `deleted_at`으로 삭제 상태를 본다. 근거: `internal/transport/httpapi/board/drivefilesbody.go:361`, `internal/transport/httpapi/board/drivefilesbody.go:583`.
4. 휴지통 이동은 업로더 또는 관리자, 영구삭제·복원은 **업로더만** 가능하다. 관리자라는 이유로 다른 사람 파일을 영구삭제/복원할 수 없다. 근거: `internal/domain/board/drivefilewrite.go:604`, `internal/domain/board/drivefilewritequery.go:213`, `internal/domain/board/drivefilewrite.go:562`.
5. 일괄 거절·용량초과는 200이며 affected/ignored_ids를 확인해야 한다. 복원 `success_drive`·`fail_drive`는 **파일 ID가 아니라 게시판 ID**, count는 해당 게시판 내 대상 **파일 수**다. 권한/부재로 제외된 파일은 fail_count에 안 들어갈 수 있다. 근거: `internal/domain/board/drivefilewrite.go:470`, `internal/transport/httpapi/board/drivewritebody.go:189`.
6. 파일 복원은 해당 파일의 **모든 사용자 soft-deleted 북마크**를 다시 살린다. 삭제 전에 사용자가 직접 껐던 북마크도 포함된다. 근거: `internal/domain/board/drivefilewritequery.go:495`.
7. 영구삭제 API는 객체를 즉시 지우거나 큐에 enqueue하지 않고 DB 표식만 쓴다. 실제 객체·행 삭제는 매일 UTC00시 배치, 한 회차 최대500개다. 프론트는 200을 “버킷 삭제 완료”로 읽지 않는다. 근거: `internal/domain/board/drivefilewrite.go:182`, `internal/domain/board/drivepurge.go:60`, `internal/domain/board/drivepurge.go:121`, `internal/transport/scheduler/scheduler.go:85`.
8. 다운로드 URL은 5분 bearer capability이며 인증 헤더를 다시 붙일 필요 없는 S3 GET이다. API가 객체 존재를 HEAD로 검사하지 않아 URL 발급200 후 객체 GET은 실패할 수 있다. 소유권/Read를 잃은 후 이미 발급한 URL의 즉시 폐기 로직은 없다. 근거: `internal/transport/httpapi/board/drivedownload.go:119`, `internal/platform/objectstore/objectstore.go:142`.

## GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files

### 1. 경로

OperationID: `board-list-drive-files`. [`internal/transport/httpapi/board/routes.go:901`](../../internal/transport/httpapi/board/routes.go#L901)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files` — 읽을 수 있는 자료실 파일 통합 목록. 근거: `internal/transport/httpapi/board/routes.go:901`.

### 2. Path

공통 scope만, 별도 자원 ID 없음. 불일치는403 `FORBIDDEN`. 근거: `internal/transport/httpapi/board/drivefilesbody.go:46`, `internal/transport/httpapi/middleware/auth.go:212`.

### 3. Query

[공통 Query 전수 표](#list-query) 적용. state는 허용 enum인지만 검증하고 **항상 살아 있는 ACT만**, is_bookmark 무시. board/category/활성 범위와 Read를 만족하는 파일에 나머지 filter를 AND한다. 기본 take20/page1/created_at DESC. 근거: `internal/transport/httpapi/board/drivefilesbody.go:256`, `internal/domain/board/drivefilequery.go:91`, `internal/domain/board/drivefilequery.go:353`.

### 4. Body

없음. Body 필드·추가 키·기본값·상한: 해당 없음. 근거: `internal/transport/httpapi/board/drivefilesbody.go:46`.

### 5. 인증·권한

공통 인증401 → scope403 → 입력검증400 → 날짜 filter 검증400 → 필요시 검색어 저장 → 읽을 수 있는 **살아 있고 활성인 DRIVE 게시판** 산출 → 파일 SELECT/COUNT. 비활성/삭제 category의 파일도 제외한다. 다른 회사/없는/읽기불가 board_id는 403/404 대신 200 빈 결과이며 total에도 안 센다. 근거: `internal/transport/httpapi/board/drivefiles.go:93`, `internal/domain/board/drivefilequery.go:91`, `internal/domain/board/drivefilequery.go:124`, `internal/domain/board/drivefilequery.go:329`.

### 6. Response

아래 status 외에도 DB·서명 등의 작업이 request context 취소/기한 만료로 중단되면 **503 `SERVICE_UNAVAILABLE`**이다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:42`.

200 기본 [페이지 봉투](#page), `is_not_paging=true`면 [DriveFileDTO](#drivefiledto)[] 직접 반환. 기본 관계는 user/delete_user/board. 에러400 `INVALID_PAYLOAD`,401 `UNAUTHORIZED`,scope403 `FORBIDDEN`,500 `INTERNAL_ERROR`, 공통406 `NOT_ACCEPTABLE`. 이 목록에는 자원별403/404/409가 없다. 근거: `internal/transport/httpapi/board/drivefiles.go:113`, `internal/transport/httpapi/board/drivefilesbody.go:543`, `internal/domain/board/drivefilequery.go:601`.

### 7. 주의사항

`is_only_file_search`가 non-empty이고 search/title도 있으면 검색어를 **동기적으로 먼저** 저장한다. 검색어 trim 후 빈 값은 건너뛰며 저장 실패는 경고만 남기고 목록은 계속된다. filter 또는 조회 실패 전후 구간에 따라 최근검색어가 남을 수 있고, title_content만으로는 저장하지 않는다. 저장소는 router에서 주입된다. 목록/COUNT는 독립 SELECT라 동시 변경 시 total과 data 순간이 다를 수 있다. 캐시·읽음 처리 없음. 근거: `internal/transport/httpapi/board/drivefiles.go:109`, `internal/transport/httpapi/board/search.go:32`, `internal/transport/httpapi/router.go:378`, `internal/domain/board/drivefilequery.go:651`.

### 8. 시나리오

true는 정상 배열, yes는400; title 한 글자는400, search 한 글자는200이지만 검색 술어 생략. 근거: `internal/transport/httpapi/board/drivefiles_test.go:1146`, `internal/transport/httpapi/board/drivefiles_test.go:1245`, `internal/transport/httpapi/board/drivefiles_test.go:1086`, 설치된 `github.com/danielgtaylor/huma/v2@v2.39.0/huma.go:1830`.

```sh
curl -i --get "$SCOPE/drive-files" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode "board_id=$BOARD_ID" --data-urlencode 'is_root=1' --data-urlencode 'take=20'
curl -i --get "$SCOPE/drive-files" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'is_not_paging=true' --data-urlencode 'limit=10'
curl -i --get "$SCOPE/drive-files" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'is_not_paging=yes'
curl -i --get "$SCOPE/drive-files" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'title=a'
curl -i --get "$SCOPE/drive-files" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'search=a'
```

## GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/mine

### 1. 경로

OperationID: `board-list-my-drive-files`. [`internal/transport/httpapi/board/routes.go:927`](../../internal/transport/httpapi/board/routes.go#L927)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/mine` — 내 자료/업로드중/실패/휴지통, 또는 북마크 분기. 근거: `internal/transport/httpapi/board/routes.go:927`.

### 2. Path

공통 scope만. 불일치403 `FORBIDDEN`; mine은 uuid 자원ID가 아닌 고정 경로다. 근거: `internal/transport/httpapi/board/routes.go:929`, `internal/transport/httpapi/middleware/auth.go:212`.

### 3. Query

[공통 Query](#list-query)의 모든 필드가 입력 검증 대상이다. 아래 분기는 빠짐없이 적용한다. 근거: `internal/transport/httpapi/board/drivefiles.go:135`.

| 조건 | 실제 결과/기본값 | 근거 |
| --- | --- | --- |
| is_bookmark가 빈 문자열 또는0이 아닌 문자열 | 전용 북마크와 동일, state는 ACT로 덮어씀. `false`, `00`, `no`도 이 분기 | `internal/transport/httpapi/board/drivefilesbody.go:381`, `internal/transport/httpapi/board/drivefiles.go:149` |
| is_bookmark=0, state 미지정/빈 값 | 400 `INVALID_PAYLOAD` | `internal/transport/httpapi/board/drivefiles.go:156` |
| is_bookmark 미지정/빈 값, state도 미지정/빈 값 | **조회 없이200 빈 봉투**(다른 date 검증은 먼저 함) | `internal/transport/httpapi/board/drivefiles.go:163` |
| state=ACT/UPLOADING/FAIL | 본인 user_id·company_id, deleted_at=null, 해당 state | `internal/transport/httpapi/board/drivefilesbody.go:356`, `internal/domain/board/drivefilequery.go:322` |
| state=DEL | 본인 휴지통, deleted_at!=null AND purged_at=null; state 조건 없음, updated_at DESC/id 정렬 | `internal/domain/board/drivefilequery.go:221`, `internal/domain/board/drivefilequery.go:447` |

본인 분기는 category_id·is_public_only를 무시하고 board_id/folder/root/search/date/sort는 적용한다. `is_not_paging=true`도 봉투는 유지하며 limit(default10)로 크기만 바꾼다. 근거: `internal/domain/board/drivefilequery.go:638`, `internal/domain/board/drivefilequery.go:322`, `internal/transport/httpapi/board/drivefiles.go:183`.

### 4. Body

없음. 필드·추가 키·기본값·상한: 해당 없음. 근거: `internal/transport/httpapi/board/drivefilesbody.go:46`.

### 5. 인증·권한

인증401 → scope403 → Huma 입력400 → 위 bookmark/state 분기 → 날짜검증400 → 본인 소유 SELECT/COUNT. 본인 분기는 **board Read·활성 여부를 검사하지 않는다**. 다른 회사 파일은 항상 제외하고 남의 파일은 관리자인 경우에도 제외한다. 북마크 분기는 일반목록과 동일한 Read/활성 gate를 사용한다. 근거: `internal/transport/httpapi/board/drivefiles.go:135`, `internal/domain/board/drivefilequery.go:638`, `internal/domain/board/drivefilequery.go:213`, `internal/domain/board/drivefilequery.go:333`.

### 6. Response

아래 status 외에도 DB·서명 등의 작업이 request context 취소/기한 만료로 중단되면 **503 `SERVICE_UNAVAILABLE`**이다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:42`.

200 항상 [페이지 봉투](#page) + [DriveFileDTO](#drivefiledto). state 없음은 total0/data[]/last_page1. 삭제된 board의 본인 파일은 board:null 및 category_id:null일 수 있다. 에러400/401/scope403/500, 공통406. 자원별403/404 없음. 근거: `internal/transport/httpapi/board/drivefiles.go:174`, `internal/domain/board/drivefilequery.go:192`, `internal/domain/board/drivefilequery.go:551`.

### 7. 주의사항

최근검색어 저장·읽음 부수효과·캐시 없음. 본인 목록에서 행을 볼 수 있다는 것이 다운로드 권한을 뜻하지 않는다. UPLOADING은 만료 배치가 성공할 때 FAIL로 바뀌며, DEL 항목의 복원 가능 기간은 객체정리 배치 실행과 경합한다. 근거: `internal/transport/httpapi/board/drivefiles.go:135`, `internal/domain/board/driveexpire.go:66`, `internal/domain/board/drivedownload.go:105`, `internal/domain/board/drivepurge.go:121`.

### 8. 시나리오

정상 ACT, DEL, state 없는 빈200, is_bookmark=0의400, 문자열 false의 북마크200 비교. 근거: `internal/transport/httpapi/board/drivefiles_test.go:1308`, `internal/transport/httpapi/board/drivefiles_test.go:1435`, `internal/transport/httpapi/board/drivefilesbody.go:381`.

```sh
curl -i "$SCOPE/drive-files/mine?state=ACT" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i "$SCOPE/drive-files/mine?state=DEL" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i "$SCOPE/drive-files/mine" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i "$SCOPE/drive-files/mine?is_bookmark=0" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i "$SCOPE/drive-files/mine?is_bookmark=false" -H "Authorization: Bearer $BOARD_TOKEN"
```

## GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/bookmarks

### 1. 경로

OperationID: `board-list-bookmarked-drive-files`. [`internal/transport/httpapi/board/routes.go:946`](../../internal/transport/httpapi/board/routes.go#L946)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/bookmarks` — 내 북마크 파일. 근거: `internal/transport/httpapi/board/routes.go:946`.

### 2. Path

공통 scope만. scope 오류403 `FORBIDDEN`; bookmarks는 고정 경로다. 근거: `internal/transport/httpapi/board/routes.go:948`, `internal/transport/httpapi/middleware/auth.go:212`.

### 3. Query

[공통 Query 전수](#list-query). state는 유효 enum인지 검사하지만 **ACT·살아 있는 파일**로 강제하고 BookmarkedOnly=true. is_bookmark/is_only_file_search 무시. is_not_paging=true여도 봉투 유지, limit(default10) 적용. 근거: `internal/transport/httpapi/board/drivefiles.go:209`.

### 4. Body

없음. 필드·추가 키·기본값·상한: 해당 없음. 근거: `internal/transport/httpapi/board/drivefilesbody.go:46`.

### 5. 인증·권한

인증401 → scope403 → 입력/날짜400 → 활성 DRIVE와 활성 category·Read gate → 현재 사용자의 deleted_at=null 북마크가 존재하는 파일만. 북마크는 접근권한을 부여하지 않으므로 권한을 잃으면 목록·total에서 빠진다. 거절 파일별403/404 없음. 근거: `internal/transport/httpapi/board/drivefiles.go:216`, `internal/domain/board/drivefilequery.go:91`, `internal/domain/board/drivefilequery.go:242`.

### 6. Response

아래 status 외에도 DB·서명 등의 작업이 request context 취소/기한 만료로 중단되면 **503 `SERVICE_UNAVAILABLE`**이다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:42`.

200 항상 [봉투](#page), data=[DriveFileDTO](#drivefiledto)[]; 기본 user/delete_user/board 관계. 빈 결과도 동일. 에러400/401/scope403/500, 공통406. 근거: `internal/transport/httpapi/board/drivefiles.go:231`.

### 7. 주의사항

UPLOADING/FAIL에 북마크를 켤 수 있어도 이 목록에는 ACT만 보인다. 검색 기록 저장·읽음 처리 없음. SELECT/COUNT 동시성의 한계는 일반목록과 같다. 근거: `internal/domain/board/drivefilewritequery.go:518`, `internal/transport/httpapi/board/drivefiles.go:225`, `internal/domain/board/drivefilequery.go:651`.

권한을 잃어 목록에서 숨겨져도 북마크 행을 삭제하지 않으므로 권한이 돌아오면 다시 보일 수 있다. 북마크한 시각 순서의 정렬은 제공하지 않는다. 북마크 테이블에는 updated_at이 없고 목록은 파일 컬럼으로만 정렬한다. 근거: `internal/domain/board/drivefilequery.go:91`, `internal/domain/board/drivefilequery.go:242`, `internal/domain/board/drivefilequery.go:432`, `migrations/board/000001_initial_schema.sql:865`.

### 8. 시나리오

정상 조회와 state=DEL(그래도 살아 있는 ACT 북마크), 잘못된 state(400) 비교. 근거: `internal/transport/httpapi/board/drivefiles.go:225`, `internal/transport/httpapi/board/drivefilesbody.go:155`.

```sh
curl -i "$SCOPE/drive-files/bookmarks" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i "$SCOPE/drive-files/bookmarks?state=DEL" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i "$SCOPE/drive-files/bookmarks?state=WAIT" -H "Authorization: Bearer $BOARD_TOKEN"
```

## GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}

### 1. 경로

OperationID: `board-get-drive-file`. [`internal/transport/httpapi/board/routes.go:963`](../../internal/transport/httpapi/board/routes.go#L963)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}` — 상세. 근거: `internal/transport/httpapi/board/routes.go:963`.

### 2. Path

공통 scope + `id:string(UUID)` 파일 ID 필수. UUID 형식 오류400 `INVALID_PAYLOAD`. 다른 회사/없는/영구삭제된 파일·삭제된 게시판이면404 `NOT_FOUND`. **휴지통 파일은 조회 대상**이다. 근거: `internal/transport/httpapi/board/drivefilesbody.go:419`, `internal/domain/board/drivefilequery.go:730`, `internal/domain/board/drivefilequery.go:743`.

### 3. Query

없음. query 배열·기본값·enum·상한: 해당 없음. 근거: `internal/transport/httpapi/board/drivefilesbody.go:419`.

### 4. Body

없음. 필드·추가 키·기본값·상한: 해당 없음. 근거: `internal/transport/httpapi/board/drivefilesbody.go:419`.

### 5. 인증·권한

공통 인증/scope/검증 → 대상 조회404 → board Read403 →200. 상세는 본인 소유 여부로 Read를 우회하지 않는다. UPLOADING/FAIL도 Read가 있으면 반환하고 다운로드의 ACT 검사는 여기 없다. 읽기불가 대상은 상태·원본명 등을 반환하지 않는다. 근거: `internal/domain/board/drivefilequery.go:798`.

### 6. Response

아래 status 외에도 DB·서명 등의 작업이 request context 취소/기한 만료로 중단되면 **503 `SERVICE_UNAVAILABLE`**이다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:42`.

200 [DriveFileDTO](#drivefiledto) 직접 객체; 기본 user/delete_user/board JOIN, 휴지통에서는 deleted_at 및 저장 state 그대로. 에러400/401/403/404/500, 공통406. 근거: `internal/transport/httpapi/board/drivefiles.go:248`, `internal/domain/board/drivefilequery.go:774`.

### 7. 주의사항

파일 상세를 GET해도 읽음·다운로드 횟수 증가·최근검색어 기록은 없다. 파일키/다운로드 URL은 주지 않는다. 이 상세의 휴지통200과 다운로드의 휴지통404는 의도적으로 다르다. 근거: `internal/transport/httpapi/board/drivefiles.go:248`, `internal/domain/board/drivefilequery.go:730`, `internal/domain/board/drivedownload.go:163`.

### 8. 시나리오

정상과 휴지통200, 형식 오류400을 비교한다(모두 본인이 읽을 수 있는 게시판 기준). 근거: `internal/domain/board/drivefile_integration_test.go:634`, `internal/transport/httpapi/board/drivefiles_test.go:712`.

```sh
curl -i "$SCOPE/drive-files/$FILE_ID" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i "$SCOPE/drive-files/$TRASH_FILE_ID" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i "$SCOPE/drive-files/not-a-uuid" -H "Authorization: Bearer $BOARD_TOKEN"
```

## DELETE /api/v1/board/companies/{company_id}/users/{user_id}/drive-files

### 1. 경로

OperationID: `board-trash-drive-files`. [`internal/transport/httpapi/board/routes.go:1034`](../../internal/transport/httpapi/board/routes.go#L1034)

`DELETE /api/v1/board/companies/{company_id}/users/{user_id}/drive-files` — 휴지통 이동. 근거: `internal/transport/httpapi/board/routes.go:1034`.

### 2. Path

공통 scope만; 대상 ID는 Body. 불일치403 `FORBIDDEN`. 근거: `internal/transport/httpapi/board/drivewritebody.go:27`, `internal/transport/httpapi/middleware/auth.go:212`.

### 3. Query

없음. 대상 배열을 query에 보내는 계약 없음. 근거: `internal/transport/httpapi/board/drivewritebody.go:27`.

### 4. Body

[일괄 Body 전수](#bulkbody): 객체필수, ids/id 선택 UUID 배열, 기본 빈 목록, 개수 상한없음·Body1MiB, 중복 제거, 추가 키 허용. 근거: `internal/transport/httpapi/board/drivewritebody.go:41`.

### 5. 인증·권한

인증401 → scope403 → 입력400 → 파일·게시판 동일회사/살아 있음 → **파일 업로더 또는 CanManage**(회사/카테고리/게시판 관리자). Read/Write 별도 조건은 없다. 상태 ACT/UPLOADING/FAIL 모두 대상. 다른 회사·없는·거절·이미휴지통은 ignored_ids로만 반환한다. 근거: `internal/domain/board/drivefilewritequery.go:118`, `internal/domain/board/drivefilewrite.go:414`, `internal/domain/board/drivefilewrite.go:604`.

### 6. Response

아래 status 외에도 DB·서명 등의 작업이 request context 취소/기한 만료로 중단되면 **503 `SERVICE_UNAVAILABLE`**이다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:42`.

200 [affected/ignored_ids](#bulkresponse). 전부 거절이면 affected0이며 403/404가 아니다. 에러는 인증401/scope403/입력400/내부500, Body 공통406/408/413/415. 근거: `internal/transport/httpapi/board/drivewrite.go:80`, `internal/transport/httpapi/board/drivewrite.go:131`.

### 7. 주의사항

state를 바꾸지 않고 deleted_at/updated_at/delete_user_id를 기록한다. **모든 사용자의 살아 있는 파일 북마크**도 transaction 안에서 soft-delete한다. S3/큐는 호출하지 않는다. gate와 UPDATE 사이 행잠금이 없고 UPDATE는 현재 deleted_at를 다시 검사하므로 동시 삭제에서 affected가 줄어도 사전 ignored_ids가 늘지는 않을 수 있다. 근거: `internal/domain/board/drivefilewrite.go:120`, `internal/domain/board/drivefilewritequery.go:160`.

### 8. 시나리오

첫 정상 이동, 같은 ID 두 번째 요청은200 ignored, 잘못된 UUID는400. 근거: `internal/domain/board/drivefilewrite_integration_test.go:265`, `internal/transport/httpapi/board/drivewrite_test.go:258`.

```sh
curl -i -X DELETE "$SCOPE/drive-files" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data "{\"ids\":[\"$FILE_ID\"]}"
curl -i -X DELETE "$SCOPE/drive-files" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data "{\"ids\":[\"$FILE_ID\"]}"
curl -i -X DELETE "$SCOPE/drive-files" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data '{"ids":["bad-id"]}'
```

## DELETE /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/purge

### 1. 경로

OperationID: `board-purge-drive-files`. [`internal/transport/httpapi/board/routes.go:1052`](../../internal/transport/httpapi/board/routes.go#L1052)

`DELETE /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/purge` — 영구삭제 표식. 근거: `internal/transport/httpapi/board/routes.go:1052`.

### 2. Path

공통 scope만. 파일 ID는 Body, scope mismatch403 `FORBIDDEN`. 근거: `internal/transport/httpapi/board/drivewritebody.go:27`, `internal/transport/httpapi/middleware/auth.go:212`.

### 3. Query

없음. 기본값·enum·배열·상한 해당 없음. 근거: `internal/transport/httpapi/board/drivewritebody.go:27`.

### 4. Body

[공통 일괄 Body](#bulkbody). 객체필수, ids/id UUID 배열 선택; 기본 빈 목록, 빈 배열 허용, 개수 상한없음·Body1MiB, 추가 키 허용. 근거: `internal/transport/httpapi/board/drivewritebody.go:41`.

### 5. 인증·권한

인증/scope/검증 후 **동일회사 업로더 본인**, purged_at=null, 그리고 **휴지통이거나 state가 UPLOADING/FAIL**인 파일만 허용. 살아 있는 ACT는 안 된다. 관리자 특례·board Read/활성/게시판 존재 JOIN은 없다. 거절 ID는200 ignored, 정렬·중복 제거한다. 근거: `internal/domain/board/drivefilewritequery.go:209`, `internal/domain/board/drivefilewrite.go:182`.

### 6. Response

아래 status 외에도 DB·서명 등의 작업이 request context 취소/기한 만료로 중단되면 **503 `SERVICE_UNAVAILABLE`**이다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:42`.

200 [affected/ignored_ids](#bulkresponse). 에러 인증401/scope403/입력400/내부500, Body공통406/408/413/415. 자원별403/404/409 없음. 근거: `internal/transport/httpapi/board/drivewrite.go:94`, `internal/transport/httpapi/board/drivewrite.go:131`.

### 7. 주의사항

purged_at/updated_at를 찍고 deleted_at 없으면 함께 채운다. **purged_at이 복원 불가 표식**이며 그 순간 mine 휴지통·상세에서 사라진다. 이 API는 S3 삭제·큐 enqueue·북마크 수정 없음; 객체와 FK cascade 정리는 [배치](#lifecycle)에서 수행한다. 살아 있는 UPLOADING을 바로 purge하면 delete_user_id는 따로 기록하지 않는다. 근거: `internal/domain/board/drivefilewritequery.go:253`, `internal/domain/board/drivefilequery.go:221`, `internal/domain/board/drivefilequery.go:730`, `internal/domain/board/drivefilewrite.go:182`.

같은 ID로 다시 호출하면 기존 purged_at을 재기록하지 않고 ignored_ids에 넣는다. 첫 호출 뒤 실제 배치가 행을 지웠어도 재호출의 결과는 같은 제외다. 근거: `internal/domain/board/drivefilewritequery.go:209`, `internal/domain/board/drivefilewritequery.go:258`, `internal/domain/board/drivefilewrite.go:193`.

### 8. 시나리오

본인 휴지통 정상200, 살아 있는 ACT는200 ignored, UPLOADING은 휴지통 단계를 거치지 않고200 처리된다. 근거: `internal/domain/board/drivefilewritequery.go:209`.

```sh
curl -i -X DELETE "$SCOPE/drive-files/purge" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data "{\"ids\":[\"$TRASH_FILE_ID\"]}"
curl -i -X DELETE "$SCOPE/drive-files/purge" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data "{\"ids\":[\"$FILE_ID\"]}"
curl -i -X DELETE "$SCOPE/drive-files/purge" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data "{\"ids\":[\"$PENDING_FILE_ID\"]}"
```

## POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/restore

### 1. 경로

OperationID: `board-restore-drive-files`. [`internal/transport/httpapi/board/routes.go:1070`](../../internal/transport/httpapi/board/routes.go#L1070)

`POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/restore` — 복원. 근거: `internal/transport/httpapi/board/routes.go:1070`.

### 2. Path

공통 scope만. 별도 자원 path 없음, 불일치403 `FORBIDDEN`. 근거: `internal/transport/httpapi/board/drivewritebody.go:27`, `internal/transport/httpapi/middleware/auth.go:212`.

### 3. Query

없음. 기본값·enum·상한·배열 해당 없음. 근거: `internal/transport/httpapi/board/drivewritebody.go:27`.

### 4. Body

[공통 일괄 Body](#bulkbody). 객체필수, ids/id 선택 UUID 배열, 기본 빈 목록; 최소·최대 개수없음, 추가 키허용, Body1MiB. 근거: `internal/transport/httpapi/board/drivewritebody.go:41`.

### 5. 인증·권한

인증/scope/입력검증 → 같은 회사·살아 있는 게시판의 휴지통 파일(purged_at=null) → **업로더 본인** → 게시판별 quota. 관리자·Read·Write 권한으로 소유자 조건을 우회하지 않는다. 복원하려는 동일 게시판의 ACT/UPLOADING size 합 + 그 게시판의 현재 살아 있는 ACT/UPLOADING 사용량이 size_limit를 넘으면 그 게시판 대상 전부 실패한다. FAIL 복원은 quota size0, null 한도는 무제한, 정확히 한도는 허용. 권한/부재/쿼터 모두200의 일부 제외다. 근거: `internal/domain/board/drivefilewritequery.go:411`, `internal/domain/board/drivefilewritequery.go:458`, `internal/domain/board/drivefilewrite.go:470`, `internal/domain/board/drivefilewrite.go:562`.

### 6. Response

아래 status 외에도 DB·서명 등의 작업이 request context 취소/기한 만료로 중단되면 **503 `SERVICE_UNAVAILABLE`**이다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:42`.

200 아래 객체. 에러 인증401/scope403/입력400/내부500, Body공통406/408/413/415. quota 초과를422로 처리하지 않는다. 근거: `internal/transport/httpapi/board/drivewrite.go:112`.

| 필드 | 타입 | null | 계산/관계·의미 | 근거 |
| --- | --- | --- | --- | --- |
| success_drive | string(UUID)[] | 아니오 | 용량 판정을 통과한 **게시판** ID 목록 | `internal/transport/httpapi/board/drivewritebody.go:191` |
| success_count | integer | 아니오 | 위 게시판에 속해 허용된 대상 **파일 수** | `internal/domain/board/drivefilewrite.go:527` |
| fail_drive | string(UUID)[] | 아니오 | 용량 초과로 거절된 **게시판** ID | `internal/transport/httpapi/board/drivewritebody.go:193` |
| fail_count | integer | 아니오 | 용량 때문에 실패한 파일 수; 부재/권한으로 제외한 수는 아님 | `internal/domain/board/drivefilewrite.go:493`, `internal/domain/board/drivefilewrite.go:532` |
| affected | integer(int64) | 아니오 | 실제 UPDATE한 파일 수, 권한/용량 판정 후 발생한 경합에 따라 success_count와 다를 수 있음 | `internal/domain/board/drivefilewrite.go:306` |
| ignored_ids | string(UUID)[] | 아니오 | 없음/비소유/이미복원/영구삭제/용량실패 파일 ID, 개별 사유 없음 | `internal/domain/board/drivefilewrite.go:275`, `internal/domain/board/drivefilewrite.go:470` |

### 7. 주의사항

원래 state·폴더 위치는 유지, deleted_at/delete_user_id는 null로 바꾸고 updated_at 갱신. 모든 soft-deleted 북마크를 다시 살린다. 부모 폴더의 생존 여부는 검사하지 않아 삭제된 폴더 위치로 복원될 수 있다. 카테고리→게시판 순서의 잠금으로 동시 quota 예약·복원을 조율하지만 S3 객체 존재 확인은 없다. 30일 경과 후에도 배치가 지우기 전이면 API 자체가 날짜를 거절하지 않는다. 근거: `internal/domain/board/drivefilewritequery.go:328`, `internal/domain/board/drivefilewritequery.go:411`, `internal/domain/board/drivefilewritequery.go:488`, `internal/domain/board/drivefilewrite.go:251`.

### 8. 시나리오

본인 휴지통 정상, 빈 배열 정상 no-op, 잘못된 UUID는400. quota 실패는 동일 정상 요청에서 게시판 한도를 넘는 대상이면 fail_drive/fail_count로200에 표현된다. 근거: `internal/domain/board/drivefilewrite_integration_test.go:505`, `internal/transport/httpapi/board/drivewrite_test.go:480`.

```sh
curl -i -X POST "$SCOPE/drive-files/restore" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data "{\"ids\":[\"$TRASH_FILE_ID\"]}"
curl -i -X POST "$SCOPE/drive-files/restore" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data '{"ids":[]}'
curl -i -X POST "$SCOPE/drive-files/restore" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' --data '{"ids":["bad-id"]}'
```

## POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}/bookmark

### 1. 경로

OperationID: `board-toggle-drive-file-bookmark`. [`internal/transport/httpapi/board/routes.go:1089`](../../internal/transport/httpapi/board/routes.go#L1089)

`POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}/bookmark` — 북마크 토글. 근거: `internal/transport/httpapi/board/routes.go:1089`.

### 2. Path

공통 scope + 필수 `id:string(UUID)` 파일ID. 형식 오류400 `INVALID_PAYLOAD`; 다른 회사/없는/휴지통/삭제 게시판은404 `NOT_FOUND`. 근거: `internal/transport/httpapi/board/drivewritebody.go:69`, `internal/domain/board/drivefilewritequery.go:518`.

### 3. Query

없음. 목표 on/off 불리언이나 배열 파라미터 없음. 근거: `internal/transport/httpapi/board/drivewritebody.go:69`.

### 4. Body

없음. on/off 필드·추가 키 검증·기본값·상한 해당 없음; 상태 설정 API가 아니라 현재 값의 반전이다. 근거: `internal/transport/httpapi/board/drivewritebody.go:69`, `internal/domain/board/drivefilewritequery.go:561`.

### 5. 인증·권한

공통 인증/scope/검증 → 파일/게시판 조회404 → Read403 → toggle. 업로더일 필요 없고 상태 ACT 여부도 검사하지 않아 UPLOADING/FAIL도 가능하다. 근거: `internal/domain/board/drivefilewrite.go:344`, `internal/domain/board/drivefilewritequery.go:518`.

### 6. Response

아래 status 외에도 DB·서명 등의 작업이 request context 취소/기한 만료로 중단되면 **503 `SERVICE_UNAVAILABLE`**이다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:42`.

200 아래 객체, 봉투없음. 에러400/401/403/404/500, 공통406. 근거: `internal/transport/httpapi/board/drivewrite.go:160`.

| 필드 | 타입 | null | 저장/계산·포맷·관계 | 근거 |
| --- | --- | --- | --- | --- |
| user_id | integer(int64) | 아니오 | 인증 사용자에서 계산 | `internal/transport/httpapi/board/drivewrite.go:178` |
| drive_file_id | string(UUID) | 아니오 | 요청 리소스 ID | `internal/transport/httpapi/board/drivewrite.go:179` |
| deleted_at | string(timestamp) | 가능 | 켜면null, 끄면 응답 시 clock UTC(저장행 직접 읽은 값 아님) | `internal/transport/httpapi/board/drivewrite.go:180`, `internal/transport/httpapi/board/drivewrite.go:184` |
| is_bookmarked | boolean | 아니오 | UPSERT 결과, 이번 호출 후 상태 | `internal/transport/httpapi/board/drivewrite.go:181`, `internal/domain/board/drivefilewritequery.go:568` |

### 7. 주의사항

리스트 필드는 `is_bookmark`, 여기 응답은 **is_bookmarked**다. 재시도는 같은 상태를 유지하지 않고 다시 뒤집는다. 자연키(user_id,drive_file_id) UPSERT이므로 동시 요청은 각각 토글하지만 네트워크 응답 순서와 서버 반영순서가 다를 수 있다. 알림·큐 호출은 없다. 근거: `internal/transport/httpapi/board/drivefilesbody.go:479`, `internal/transport/httpapi/board/drivewritebody.go:168`, `internal/domain/board/drivefilewritequery.go:561`.

북마크 행의 created_at은 첫 생성 시각을 보존하며 이후 토글은 deleted_at만 바꾼다. **응답에는 created_at이 없으므로** 클라이언트가 재토글 시각으로 대체해 표시하지 않는다. 근거: `internal/domain/board/drivefilewritequery.go:561`, `internal/transport/httpapi/board/drivewritebody.go:164`.

### 8. 시나리오

같은 파일 두 번은 켬/끔(기존 상태가 켜짐이면 순서 반대), malformed ID는400. 근거: `internal/domain/board/drivefilewrite_integration_test.go:613`, `internal/transport/httpapi/board/drivewrite_test.go:397`.

```sh
curl -i -X POST "$SCOPE/drive-files/$FILE_ID/bookmark" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i -X POST "$SCOPE/drive-files/$FILE_ID/bookmark" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i -X POST "$SCOPE/drive-files/not-a-uuid/bookmark" -H "Authorization: Bearer $BOARD_TOKEN"
```

## GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}/download-url

### 1. 경로

OperationID: `board-get-drive-file-download-url`. [`internal/transport/httpapi/board/routes.go:1185`](../../internal/transport/httpapi/board/routes.go#L1185)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}/download-url` — presigned GET URL 발급. 근거: `internal/transport/httpapi/board/routes.go:1185`.

### 2. Path

공통 scope + `id:string(UUID)` 필수. UUID 오류400 `INVALID_PAYLOAD`; 타 회사/없는/휴지통 파일/삭제 게시판404 `NOT_FOUND`. 근거: `internal/transport/httpapi/board/drivedownload.go:39`, `internal/domain/board/drivedownload.go:154`.

### 3. Query

없음. expiry·filename·배열·상한 override 파라미터 없음. 근거: `internal/transport/httpapi/board/drivedownload.go:39`.

### 4. Body

없음. 필드·추가 키·기본값·상한 해당 없음. 근거: `internal/transport/httpapi/board/drivedownload.go:39`.

### 5. 인증·권한

공통 인증401 → scope403 → 입력400 → presigner 없으면503 `SERVICE_UNAVAILABLE` → 파일/게시판404 → Read403 → **state!=ACT면409 `FILE_NOT_ACTIVE`** → 서명500/200. 인증없는 호출자가 presigner 설정 여부를 알 수 없고, Read 없는 호출자는 ACT 여부를 알 수 없다. 근거: `internal/transport/httpapi/board/drivedownload.go:105`, `internal/domain/board/drivedownload.go:88`.

### 6. Response

아래 status 외에도 DB·서명 등의 작업이 request context 취소/기한 만료로 중단되면 **503 `SERVICE_UNAVAILABLE`**이다. 근거: `internal/transport/httpapi/humaerr/humaerr.go:42`.

200 아래 객체. 에러400/401/403/404/409 `FILE_NOT_ACTIVE`/500/503, 공통406. 근거: `internal/transport/httpapi/board/drivedownload.go:128`, `internal/transport/httpapi/board/drivedownload.go:152`.

| 필드 | 타입 | null | 저장/계산·포맷·관계 | 근거 |
| --- | --- | --- | --- | --- |
| url | string(URL) | 아니오 | S3 key로 생성한 presigned GET, **TTL5분**, eager 관계없음 | `internal/transport/httpapi/board/drivedownload.go:33`, `internal/platform/objectstore/objectstore.go:142` |
| origin_file_name | string | 아니오 | 저장 원본 파일명; 프론트의 저장 이름에 사용 | `internal/domain/board/drivedownload.go:112` |
| expires_at | string(timestamp) | 아니오 | handler clock+5분을 UTC 소수점6자리로 표시; SDK 서명시각과 아주 작은 차이 가능 | `internal/transport/httpapi/board/drivedownload.go:128`, `internal/transport/httpapi/board/drivedownload.go:139` |

### 7. 주의사항

S3 GET 서명에 `ResponseContentDisposition` 또는 파일명 override를 넣지 않는다. 객체에 저장된 응답 헤더와 `origin_file_name` UI 값을 구분한다. 서명 URL은 SDK가 조립하므로 쿼리를 파싱·재조합하지 않고 그대로 사용한다. 테스트는 PUT의 X-Amz-Expires=3600, GET=300과 서명 값을 확인한다. `internal/platform/objectstore/objectstore.go:143`, `internal/platform/objectstore/objectstore_test.go:87`, `internal/platform/objectstore/objectstore_test.go:112`

redirect나 파일 bytes 응답이 아니다. URL을 얻어 외부 S3로 GET한다. 서명 요청에는 response-content-disposition을 설정하지 않으므로 파일명 UI는 origin_file_name을 사용한다. S3 객체 존재를 확인하지 않는다. URL 캐시/권한회수 즉시취소/다운로드 카운터 증가는 이 경로에 없다. 객체키를 별도 JSON 필드로 주지 않지만 서명 URL 경로에 key가 담기는 것은 정상이다. 근거: `internal/transport/httpapi/board/drivedownload.go:119`, `internal/platform/objectstore/objectstore.go:142`.

### 8. 시나리오

ACT 정상200, 동일 권한의 UPLOADING은409, 휴지통은404. 받은 url을 GET하면 실제 파일 전송이 된다(별도 board endpoint 수에는 포함하지 않음). 근거: `internal/domain/board/drivedownload.go:105`, `internal/domain/board/drivedownload.go:163`, `internal/platform/objectstore/objectstore.go:146`.

```sh
curl -i "$SCOPE/drive-files/$FILE_ID/download-url" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i "$SCOPE/drive-files/$PENDING_FILE_ID/download-url" -H "Authorization: Bearer $BOARD_TOKEN"
curl -i "$SCOPE/drive-files/$TRASH_FILE_ID/download-url" -H "Authorization: Bearer $BOARD_TOKEN"
```

<a id="lifecycle"></a>
## 업로드 만료·보존·객체 정리 배치

이 절은 HTTP endpoint가 아닌 파일 상태·지연에 영향을 주는 실행 경로다. 운영에서 실제 worker/scheduler가 실행되는지는 저장소 코드만으로 확정할 수 없다. 배포 역할·broker·S3 설정의 확인 지점은 README의 운영 입력 목록을 따른다. 코드가 정한 조건은 다음과 같다. 근거: `internal/app/worker.go:32`, `internal/app/scheduler.go:27`.

| 단계 | 코드가 실행하는 동작 | 프론트 해석 | 근거 |
| --- | --- | --- | --- |
| 매분 UTC | `board.drive.expire-uploads`: 살아 있는 UPLOADING이고 upload_expire_at<=실행시각이면 state FAIL·updated_at 갱신 | 화면 시간 도달과 동시에 상태가 반드시 바뀌지는 않음; 다음 정상 작업 이후 재조회 | `internal/domain/board/driveexpire.go:66`, `internal/transport/scheduler/scheduler.go:50`, `internal/platform/queue/queue.go:88` |
| 매일 UTC00:00(한국09:00) | `board.drive.purge-files`: purged_at!=null **또는** deleted_at<=now−30×24시간, 최대500행 | 영구삭제표식은 즉시 숨김, 버킷 정리는 지연; 삭제30일은 배치 대상 기준 | `internal/domain/board/drivepurge.go:60`, `internal/domain/board/drivepurge.go:121`, `internal/transport/scheduler/scheduler.go:85` |
| 삭제 순서 | src가 non-empty이면 S3 DELETE → DB 조건부 hard-delete; src가 비면 DB만 | 객체 삭제 실패 시 DB 행 유지, 다음 배치 재시도 | `internal/transport/worker/drivepurge.go:135` |
| 실패 처리 | 개별 객체/행 삭제 실패는 로그·계수 증가 후 다음 파일 계속; handler는 마지막 ctx.Err만 반환 | 개별 실패가 asynq 실패로 반드시 표시되는 것은 아님 | `internal/transport/worker/drivepurge.go:135`, `internal/transport/worker/drivepurge.go:168` |
| hard-delete | 파일 행 삭제와 FK CASCADE로 북마크 삭제 | 파일 상세는404, 복원 불가 | `internal/domain/board/drivepurge.go:150`, `migrations/board/000001_initial_schema.sql:873` |
| worker 조립 | broker+core DB+drive S3 연결, 알림 webhook 설정이 없으면 worker boot 실패 | 알림 구성 누락도 파일 만료·정리 작업 실행을 막을 수 있음 | `internal/app/worker.go:32`, `internal/app/worker.go:54`, `internal/app/worker.go:68`, `internal/app/worker.go:147` |

**발견한 레이스:** 배치 SELECT 후 복원되어도 DB DELETE는 조건을 다시 검사해 행을 보존한다. 그러나 worker는 **그 전에 S3 객체를 삭제**하므로 그 창에서 복원한 행만 살아 있고 bytes는 사라질 수 있다. 저장소의 보호 테스트는 DB 행 보호만 검증한다. 또한 첫500개에 반복 실패가 쌓이면 같은 정렬의 다음 대상 처리가 지연될 수 있다. 이 조사에서는 수정하지 않는다. 근거: `internal/transport/worker/drivepurge.go:135`, `internal/domain/board/drivepurge.go:150`, `internal/domain/board/drivepurge_integration_test.go:244`, `internal/domain/board/drivepurge.go:126`.
