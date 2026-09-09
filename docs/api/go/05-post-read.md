# 05. 게시글 조회

등록 엔드포인트 **5개**. [전체 목록과 계약](README.md), [작성·읽음·공지](06-post-write.md), [댓글·공감](07-post-comment-like.md).

## 공통 사항

응답 DTO·에러 봉투에는 [Huma 자동 특수필드](README.md#schema-field)를 함께 적용한다. 등록된 최상위 struct 응답에만 `$schema:string`(null 불가, 계산된 URL)와 `Link`가 추가되며 배열·map·빈Body·gin 직접응답에는 없다. 아래 업무 필드 표에 반복하지 않는다. 입력의 추가 키 불허도 framework의 readonly `$schema` 특수키는 예외다. [Huma transforms.go:157](https://github.com/danielgtaylor/huma/blob/v2.39.0/transforms.go#L157)

이 파일의 공통 오류표에406이 열거되어도 현재 router의 기본 format fallback에서는 미지원 Accept가 JSON으로 처리되어 일반적인406 분기가 생기지 않는다. Content-Type 누락·빈값은 JSON 기본이다. [Huma api.go:355](https://github.com/danielgtaylor/huma/blob/v2.39.0/api.go#L355), [defaults.go:79](https://github.com/danielgtaylor/huma/blob/v2.39.0/defaults.go#L79)

이 파일의 모든 경로는 `board` 인증 계약이다. `Authorization: Bearer $BOARD_TOKEN`을 보낸다. OfficeWave/member 토큰으로 대체할 수 없다. 인증 실패 **401 `UNAUTHORIZED`** → scope 불일치 **403 `FORBIDDEN`** → Huma 파라미터/JSON 검증 **400 `INVALID_PAYLOAD`** → 엔드포인트별 검사를 실행한다. 헤더 이름은 대소문자를 구별하지 않으며 `Bearer` 뒤 첫 구분자는 공백이다. `internal/transport/httpapi/middleware/auth.go:95`, `internal/transport/httpapi/middleware/auth.go:150`, `internal/transport/httpapi/humaerr/humaerr.go:106`

`Lang`은 표시 이름 언어, `Time_zone`은 IANA 시간대이며 밑줄이다. `Time-Zone`은 다른 헤더다. 시간대 누락/잘못된 값은 `Asia/Seoul`; 일반 응답 시각은 UTC `YYYY-MM-DDTHH:mm:ss.ffffffZ`, `schedule_at_tz`는 해당 시간대의 `YYYY-MM-DD HH:mm:ss`이다. DB `timestamptz(3)`는 밀리초 정밀도지만 출력은 소수 6자리다. 숫자 ID/카운트는 JSON number이다. `internal/transport/httpapi/middleware/locale.go:21`, `internal/transport/httpapi/board/dto.go:25`, `internal/transport/httpapi/board/dto.go:108`, `migrations/board/000001_initial_schema.sql:425`

날짜 입력은 RFC3339, `YYYY-MM-DD HH:mm:ss`, `YYYY-MM-DD`(요청 시간대의 자정)를 받는다. 공백을 trim하지 않으며 빈 문자열은 zero time/없음으로 해석한다. 필드별 required 검증과 zero time의 후속 처리는 별도다. `internal/transport/httpapi/board/dto.go:89`

예시의 `$S`는 `$BASE_URL/api/v1/board/companies/$COMPANY_ID/users/$USER_ID`이다. 먼저 [README의 실행 환경](README.md)을 설정하고 실제 접근 가능한 ID를 넣는다. UUID 형식 오류 예시는 인증과 scope가 통과한 상태를 전제한다.

### 공통 오류 코드와 봉투

오류 본문은 `{"error":{"code":"...","message":"...","details":["..."]}}`; `details`는 없을 수 있다. HTTP status와 code를 함께 판정한다. 권한 거절은 내부 이유를 반환하지 않지만, 서로 다른 404/403 상태로 대상의 존재 여부를 구별할 수 있는 경우가 있으므로 각 endpoint의 순서를 확인한다. `internal/transport/httpapi/humaerr/humaerr.go:18`, `internal/transport/httpapi/middleware/auth.go:174`

| status | code | 조건 |
| --- | --- | --- |
| 400 | `INVALID_PAYLOAD` | 파라미터/본문 형식·스키마 오류, 수동 날짜 파싱 오류 |
| 401 | `UNAUTHORIZED` | 누락·유효하지 않은 board bearer |
| 403 | `FORBIDDEN` | scope 또는 개별 권한 거절 |
| 404 | `NOT_FOUND` | endpoint별 대상 조회 실패 |
| 408 | `REQUEST_TIMEOUT` | 본문 읽기 시간 초과 |
| 413 | `REQUEST_ENTITY_TOO_LARGE` | Huma 본문 크기 한도 초과 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 지원하지 않는 본문 Content-Type |
| 500 | `INTERNAL_ERROR` | 저장소·서명 등 내부 실패 |
| 503 | `SERVICE_UNAVAILABLE` | context 취소/기한 초과, endpoint별 미설정 어댑터 |

공통 표의 프레임워크 오류는 실제 요청 형식에 따라 발생한다. 읽기 전용이며 body가 없는 endpoint는 본문 처리 408/413/415를 사용하지 않는다. 모든 저장소 오류가 500인 것은 아니며 context 오류는 503으로 바뀐다. `internal/transport/httpapi/humaerr/humaerr.go:42`, `internal/transport/httpapi/humaerr/humaerr.go:188`

## ⚠️ 이 도메인의 함정

1. `GET posts?is_not_paging=1`은 **배열**, 일반 호출은 페이지 봉투다. 입력 필드 `doc` 주석의 “봉투는 그대로”는 현재 MarshalJSON과 다르다. `internal/transport/httpapi/board/postsbody.go:363`, `internal/transport/httpapi/board/posts_test.go:705`
2. `is_view=false`는 **읽은 글 필터**, `is_bookmark=false`는 **북마크 분기**다. 이 두 필드는 bool이 아니라 문자열이며 `"0"`만 거짓이고, 빈 문자열은 각각 필터 없음/내 글 분기다. 반면 `is_public_only`, `is_not_paging`, `is_include_comment`는 정상 bool 파서다. `internal/transport/httpapi/board/posts.go:264`, `internal/transport/httpapi/board/posts.go:488`, `internal/transport/httpapi/board/posts.go:581`
3. 일반 목록은 권한 없는 글을 total에서도 제외하지만 **내 글/북마크 목록에는 게시판 read gate가 없다**. 목록에 나타나도 상세 403이 가능하다. `internal/domain/board/postlistquery.go:391`, `internal/domain/board/postlistfilter.go:137`
4. 상세 GET은 살아 있는 ACT 글에 열람 이벤트를 **호출마다 추가**한다. 응답 `view_count`/`is_view`는 기록 전 스냅샷이고 기록 실패도 200이다. 기록은 응답을 반환하기 전 동기 호출이며 백그라운드 작업이 아니다. 프리패치·재시도·중복 mount도 열람 수에 영향을 준다. `internal/transport/httpapi/board/postdetail.go:70`, `internal/transport/httpapi/board/postdetail.go:105`, `internal/domain/board/postdetailquery.go:596`
5. `HIDE`는 목록에서 숨김이며 읽을 권한이 있으면 직접 상세·첨부 다운로드가 가능하다. SAVE/SCHEDULED/삭제 글의 상세는 작성자만 가시성 검사를 통과하고, 그 뒤에도 read gate가 필요하다. `internal/domain/board/postdetailquery.go:190`, `internal/domain/board/commentquery.go:62`
6. 목록 `text_content`는 299자, 상세는 전체다. 공지 목록은 전체 평문으로 다시 덮어쓴다. `is_writable`/상세 `is_mine`은 작성자 여부이고 관리자 여부가 아니다. `internal/domain/board/postlistquery.go:183`, `internal/domain/board/notice.go:206`, `internal/transport/httpapi/board/postdetailbody.go:314`
7. 파일 첨부는 `src`/`url`이 없고 download-url을 따로 요청한다. 썸네일은 설정에 따라 `url`과 `src`가 **생략**될 수 있다. 원본 object key를 가지고 클라이언트에서 URL을 재조립하지 않는다. `internal/transport/httpapi/board/postsbody.go:519`
8. `take/page/limit`에 정책 상한이 없다. `PostListMaxTake=100` 상수나 오래된 라우트 설명을 상한으로 적용하면 틀린 계약이 된다. `internal/domain/board/postlist.go:307`, `internal/transport/httpapi/board/posts_test.go:325`

## 공유 DTO 필드 표

### Huma가 추가하는 공통 필드

아래 표는 업무 DTO 필드다. 실제 최상위 객체는 Huma의 [자동 스키마 필드 규칙](README.md#schema-field)에 따라 다음 메타 필드 및 Link 헤더가 추가될 수 있다. 중첩 관계 객체에는 자동 추가하지 않는다. strict body의 일반 추가 키 불허와 별개로 등록 schema에 추가된 read-only `$schema` 키는 입력에서도 예외적으로 허용/무시한다. `internal/transport/httpapi/routerboard_test.go:161`; 라이브러리 `github.com/danielgtaylor/huma/v2@v2.39.0/transforms.go:82`, `github.com/danielgtaylor/huma/v2@v2.39.0/validate.go:832`

| 공통 필드 | 타입 | null/생략 | 저장/계산 |
| --- | --- | --- | --- |
| $schema | string | null 아님, 조건부 생략 | 계산 · 해당 응답 JSON Schema 경로; 객체/배열·등록 방식 조건은 README 참조 |

지원하지 않는 Accept 값도 기본 JSON 포맷으로 fallback한다. 이 설정에서는 Accept 미지원만으로 406을 반환하지 않는다. [공통 content negotiation](README.md), `internal/transport/httpapi/router.go:354`; 라이브러리 `github.com/danielgtaylor/huma/v2@v2.39.0/api.go:375`, `github.com/danielgtaylor/huma/v2@v2.39.0/defaults.go:79`


### PageEnvelope

Laravel 페이지네이터의 `from,to,first_page_url,last_page_url,next_page_url,prev_page_url,path,links`는 없다. 페이지 이동은 current_page/last_page와 요청 경로를 사용한다. `internal/domain/board/postlist.go:324`, `internal/transport/httpapi/board/postsbody.go:41`

각 row는 [PostView](#postview). `is_not_paging` 분기 외 목록은 아래 봉투이며, 빈 결과에서도 `data=[]`, `last_page=1`이다. 관계는 별도 include query 없이 기본 로드된다. `internal/transport/httpapi/board/postsbody.go:41`, `internal/domain/board/postlist.go:344`
| 필드 | 타입 | null | 저장/계산 · 의미 |
| --- | --- | --- | --- |
| data | PostView[] | 아니오 | 계산 · 현재 페이지 행 |
| current_page | integer | 아니오 | 계산 · 요청 page |
| last_page | integer | 아니오 | 계산 · total=0이면 1, 일반값 ceil(total/per_page); 아래 overflow 예외 |
| per_page | integer | 아니오 | 계산 · 적용 take 또는 limit |
| total | int64 number | 아니오 | 계산 · 필터 전체 개수 |

`take`가 극단적으로 크면 last_page 계산 예외가 있다. 현재 `(total + per_page - 1) / per_page`의 덧셈을 overflow 검사 없이 계산하므로 64bit에서 `take=9223372036854775807`, total>=2 같은 입력은 last_page=-1이 될 수 있다. 상한 검증이 없다는 사실과 페이지 메타데이터가 모든 정수에서 안전하다는 뜻은 다르다. 프론트는 현실적인 페이지 크기를 사용한다. `internal/domain/board/postlist.go:344`, `internal/domain/board/postlistquery.go:588`

### PostAuthorView

목록/상세/댓글 작성자 `user`는 이 객체 또는 null이다. `public.users`를 LEFT JOIN하며 hard-delete/다른 회사로 결합되지 않으면 null이다. `internal/transport/httpapi/board/postsbody.go:63`, `internal/domain/board/postlistquery.go:217`

| 필드 | 타입 | null | 저장/계산 · 포맷 |
| --- | --- | --- | --- |
| id | int64 | 아니오 | 저장 · 사용자 ID |
| name | string | 예 | 계산 · 저장 이름 + 퇴직/중지 접미사(퇴직 우선) |
| account | string | 아니오 | 계산 · 저장 계정 + 중지 접미사 |
| profile_image_id | string | 예 | 저장 |
| disabled_at | timestamp string | 예 | 저장 · UTC 6자리 |
| deleted_at | timestamp string | 예 | 저장 · UTC 6자리 |
| profile_src | URL string | 예 | 계산 · 호스트/이미지ID 없음 또는 중지면 null |

표시명은 ko `퇴직`/`중지`, en `Retired`/`Suspended`, ja `退職`/`停止`를 괄호로 붙인다. profile_src는 `{host}/image/resize/s?image_url={folder}/user/profile/{id}/profile_image.png`. `internal/transport/httpapi/board/me.go:172`, `internal/transport/httpapi/board/me.go:212`, `internal/transport/httpapi/board/me.go:323`

### PostBadgeView

근거: `internal/transport/httpapi/board/postsbody.go:86`, `internal/transport/httpapi/board/postsbody.go:479`; DB 타입·허용값: `migrations/board/000001_initial_schema.sql:506`.

| 필드 | 타입 | null | 저장/계산 · 포맷 |
| --- | --- | --- | --- |
| id | UUID string | 아니오 | 저장 · 뱃지 PK |
| company_id | int64 | 아니오 | 계산 · 게시판/게시글에서 가져옴 |
| board_id | UUID string | 아니오 | 계산 · 게시글 소속 |
| post_id | UUID string | 아니오 | 저장 |
| type | string | 아니오 | 저장 · NOTICE만 |
| start_date | timestamp string | 아니오 | 저장 · UTC |
| end_date | timestamp string | 아니오 | 저장 · UTC; 무기한 표현은 연도 2999 |
| created_at | timestamp string | 아니오 | 저장 · UTC |
| updated_at | timestamp string | 아니오 | 저장 · UTC |
| deleted_at | timestamp string | 예 | 저장 · 이 조회는 미삭제만이라 null |
| is_active | boolean | 아니오 | 계산 · start_date <= 요청 now <= end_date |

`badges[]`에는 만료/미래 뱃지도 포함되며 `is_active`로 유효성을 구별한다. `internal/domain/board/postlistquery.go:253`, `internal/domain/board/postlistfilter.go:197`

### PostAttachmentView

근거: `internal/transport/httpapi/board/postsbody.go:168`, `internal/transport/httpapi/board/postsbody.go:519`; DB: `migrations/board/000001_initial_schema.sql:537`. files와 thumbnail은 같은 DTO지만 조건부 필드가 다르다.

| 필드 | 타입 | null/생략 | 저장/계산 · 포맷 |
| --- | --- | --- | --- |
| id | UUID string | 아니오 | 저장 · 첨부 PK |
| company_id | int64 | 아니오 | 계산 · 소속 게시판에서 주입 |
| post_id | UUID string | 아니오 | 저장 |
| origin_file_name | string | 아니오 | 저장 · 파일명 |
| extension | string | 아니오 | 저장 · 확장자 |
| size | int64 | 아니오 | 저장 · byte, DB >=0 |
| created_at | timestamp string | 아니오 | 저장 · UTC |
| updated_at | timestamp string | 아니오 | 저장 · UTC |
| deleted_at | timestamp string | 예(null) | 조회는 미삭제만; DTO null |
| url | URL string | 생략 가능 | 계산 · 썸네일만, presigned GET 5분; signer 미설정/실패 시 생략 |
| src | ThumbnailSrcView | 생략 가능 | 계산 · 썸네일만, resize/CDN 설정 또는 key 없으면 생략 |

첨부 wire에는 `type,width,height`가 없다. 타입은 files/thumbnail 위치로 구별한다. `internal/transport/httpapi/board/postsbody.go:168`

`ThumbnailSrcView`의 필드 전부는 string/non-null 계산값이다. `s,s_m,m,l_m,l`은 `{resizeBase}/{해당 크기}?image_url={key}`, `o`는 `{CDN}/{key}`, `data`는 저장 key다. URL은 문자열 결합이며 query escape를 하지 않는다. 파일 첨부에는 이 객체 자체가 없다. `internal/transport/httpapi/board/postsbody.go:572`, `internal/transport/httpapi/board/postsbody.go:596`

### PostView

필드 전수와 변환: `internal/transport/httpapi/board/postsbody.go:239`, `internal/transport/httpapi/board/postsbody.go:411`; count/flag SQL: `internal/domain/board/postlistquery.go:180`; 저장 기본값/상태: `migrations/board/000001_initial_schema.sql:425`.

| 필드 | 타입 | null | 저장/계산 · 기본 관계/포맷 |
| --- | --- | --- | --- |
| id | UUID string | 아니오 | 저장 |
| seq | int64 | 아니오 | 저장 · 회사별 양의 순번 |
| category_id | UUID string | 예 | 계산 · board.category_id, 공용이면 null |
| board_id | UUID string | 아니오 | 저장 |
| user_id | int64 | 예 | 저장 · 작성자 |
| state | string | 아니오 | 저장+계산 · SAVE/ACT/HIDE/SCHEDULED; deleted_at 있으면 DEL |
| title | string | 예 | 저장 · null 제목은 프론트 fallback |
| text_content | string | 아니오 | 저장 평문을 left(...,299)로 계산 |
| comment_count | int64 | 아니오 | 계산 · 삭제 표시 댓글/답글까지 전체 count |
| view_count | int64 | 아니오 | 계산 · 열람 이벤트 수(사용자 수 아님) |
| like_count | int64 | 아니오 | 계산 · 미삭제 공감 행 수; 여러 emoji 각각 셈 |
| created_at | timestamp string | 아니오 | 저장 · UTC |
| updated_at | timestamp string | 아니오 | 저장 · UTC |
| deleted_at | timestamp string | 예 | 저장 · UTC |
| posted_at | timestamp string | 예 | 저장 · UTC |
| schedule_at | timestamp string | 예 | 저장 · UTC |
| schedule_at_tz | string | 예 | 계산 · 요청 시간대 YYYY-MM-DD HH:mm:ss |
| delete_user_id | int64 | 예 | 저장 · 삭제자 |
| delete_user | object{name:string\|null} | 예 | 관계 · 삭제자 저장 이름만, 접미사 없음 |
| is_writable | boolean | 아니오 | 계산 · user_id == 요청 사용자 |
| is_view | boolean | 아니오 | 계산 · 작성자이거나 열람 이력 존재 |
| is_bookmark | boolean | 아니오 | 계산 · 내 미삭제 북마크 존재 |
| is_like | boolean | 아니오 | 계산 · 내 미삭제 공감 하나 이상 |
| board | BoardView | 아니오 | 기본 관계 · [04 게시판 DTO](04-board.md) |
| badges | PostBadgeView[] | 아니오 | 기본 관계 · 미삭제 뱃지, 없으면 [] |
| files | PostAttachmentView[] | 아니오 | 기본 관계 · 미삭제 FILE, 없으면 [] |
| user | PostAuthorView | 예 | 기본 관계 · 작성자 |
| thumbnail | PostAttachmentView | 예 | 기본 관계 · 미삭제 THUMBNAIL 한 건 |

첨부는 `created_at,id` 순, 뱃지는 `type` 순으로 조회된다. 데이터·count·관계 조회는 여러 statement이며 하나의 snapshot transaction이 아니므로 동시 쓰기 때 total과 data/관계가 순간적으로 다를 수 있다. `internal/domain/board/postlistquery.go:241`, `internal/domain/board/postlistquery.go:496`, `internal/domain/board/postlistquery.go:551`

### PostDetailView

**PostView와 다른 객체**다. 아래가 상세의 전 필드다. `category_id`는 상세 최상위에 없고 `board.category_id`를 사용한다. `internal/transport/httpapi/board/postdetailbody.go:50`

| 필드 | 타입 | null | 저장/계산 · 기본 관계/포맷 |
| --- | --- | --- | --- |
| id | UUID string | 아니오 | 저장 |
| seq | int64 | 아니오 | 저장 · 회사별 양의 순번 |
| board_id | UUID string | 아니오 | 저장 |
| user_id | int64 | 예 | 저장 · 작성자 |
| state | string | 아니오 | 저장+계산 · SAVE/ACT/HIDE/SCHEDULED; deleted_at 있으면 DEL |
| title | string | 예 | 저장 · null 제목은 프론트 fallback |
| content | string | 아니오 | 저장 · 전체 HTML; 서버에서 HTML sanitize하지 않음 |
| text_content | string | 아니오 | 저장 · 전체 평문 |
| comment_count | int64 | 아니오 | 계산 · 삭제 표시 댓글/답글까지 전체 count |
| view_count | int64 | 아니오 | 계산 · 열람 이벤트 수(사용자 수 아님) |
| like_count | int64 | 아니오 | 계산 · 미삭제 공감 행 수; 여러 emoji 각각 셈 |
| created_at | timestamp string | 아니오 | 저장 · UTC |
| updated_at | timestamp string | 아니오 | 저장 · UTC |
| deleted_at | timestamp string | 예 | 저장 · UTC |
| posted_at | timestamp string | 예 | 저장 · UTC |
| schedule_at | timestamp string | 예 | 저장 · UTC |
| schedule_at_tz | string | 예 | 계산 · 요청 시간대 YYYY-MM-DD HH:mm:ss |
| delete_user_id | int64 | 예 | 저장 · 삭제자 |
| delete_user | object{name:string\|null} | 예 | 관계 · 삭제자 저장 이름만, 접미사 없음 |
| is_writable | boolean | 아니오 | 계산 · user_id == 요청 사용자 |
| is_view | boolean | 아니오 | 계산 · 작성자이거나 열람 이력 존재 |
| is_bookmark | boolean | 아니오 | 계산 · 내 미삭제 북마크 존재 |
| is_like | boolean | 아니오 | 계산 · 내 미삭제 공감 하나 이상 |
| board | BoardView | 아니오 | 기본 관계 · [04 게시판 DTO](04-board.md) |
| badges | PostBadgeView[] | 아니오 | 기본 관계 · 미삭제 뱃지, 없으면 [] |
| files | PostAttachmentView[] | 아니오 | 기본 관계 · 미삭제 FILE, 없으면 [] |
| user | PostAuthorView | 예 | 기본 관계 · 작성자 |
| thumbnail | PostAttachmentView | 예 | 기본 관계 · 미삭제 THUMBNAIL 한 건 |
| is_allow_comment | boolean | 아니오 | 저장 · 댓글 허용 |
| is_comment_alarm | boolean | 아니오 | 저장 · 댓글 알림 설정 |
| is_send_alarm | boolean | 아니오 | 저장 · 알림 worker가 수정하는 상태 |
| is_mine | boolean | 아니오 | 계산 · is_writable과 동일(작성자) |
| is_admin | boolean | 아니오 | 계산 · 회사/카테고리/게시판 관리자 OR |
| comments | PostCommentView[] | 아니오 | 기본 관계 · 전체 댓글 2단 트리, 빈 배열 가능 |
| likes | PostLikeStatView[] | 아니오 | 계산 · emoji별 미삭제 공감; count DESC, emoji 순 |
| row_num | int64 | 예 | 계산 · 같은 게시판의 ACT 목록 위치; 공지는 1, 그 외 1부터 |
| prev_post_id | UUID string | 예 | 계산 · 같은 공지 여부 그룹에서 더 오래된 글 |
| next_post_id | UUID string | 예 | 계산 · 같은 공지 여부 그룹에서 더 최근 글 |

상세의 like_count는 `sum(likes[].count)`, is_like는 `any(likes[].is_reacted==1)`로 같은 집계 결과에서 다시 채워 일치시킨다. 공감 요약을 300초 캐시하는 경로는 없고 매요청 SQL 집계다. `internal/domain/board/postdetail.go:277`, `internal/domain/board/postdetailquery.go:720`

`row_num/prev_post_id/next_post_id`는 미삭제 ACT이고 posted_at이 있을 때만 계산한다. 정렬축은 `posted_at,id`이며 요청했던 검색·페이징·목록 정렬은 반영하지 않는다. 공지 그룹은 **현재 유효 NOTICE**로 나뉜다. `internal/domain/board/postdetailquery.go:200`, `internal/domain/board/postdetailquery.go:524`, `internal/domain/board/postdetailquery.go:735`

### PostCommentView / 공감 요약

상세에 기본 포함되는 댓글 트리의 필드 전수다. 작성/수정 응답 [CommentView](07-post-comment-like.md#commentview)와 달리 `parent_comment_id` 별칭은 없다. `internal/transport/httpapi/board/postdetailbody.go:244`

| 필드 | 타입 | null | 저장/계산 |
| --- | --- | --- | --- |
| id | UUID string | 아니오 | 저장 |
| post_id | UUID string | 아니오 | 저장 |
| parent_id | UUID string | 예 | 저장 · 최상위 null |
| user_id | int64 | 예 | 저장 |
| comment | string | 아니오 | 저장+계산 · 비활성이면 빈 문자열 |
| is_active | boolean | 아니오 | 저장 · false면 삭제 표시 |
| is_mine | boolean | 아니오 | 계산 · 댓글 작성자 == 요청자 |
| created_at | timestamp string | 아니오 | 저장 · UTC |
| updated_at | timestamp string | 아니오 | 저장 · UTC |
| user | PostAuthorView | 예 | 기본 관계 |
| likes | CommentLikeStatView[] | 아니오 | 계산 · 공감 집계 |
| child_comments | PostCommentView[] | 아니오 | 기본 관계 · 답글, 답글의 배열은 [] |

`PostLikeStatView={emoji:string,count:int64,is_reacted:0|1}`; `CommentLikeStatView`는 여기에 `comment_id:UUID string`을 추가한다. 전부 non-null 계산 필드이며 is_reacted는 boolean이 아니다. 댓글은 created_at,id 오름차순이며 비활성 부모도 트리/작성자/공감 정보는 남는다. `internal/transport/httpapi/board/postdetailbody.go:207`, `internal/transport/httpapi/board/postdetailbody.go:224`, `internal/domain/board/postdetailquery.go:278`, `internal/domain/board/postdetailquery.go:330`, `internal/domain/board/postdetailquery.go:397`

## GET /api/v1/board/companies/{company_id}/users/{user_id}/posts

### 1. 경로

OperationID: `board-list-posts`. [`internal/transport/httpapi/board/routes.go:339`](../../internal/transport/httpapi/board/routes.go#L339)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/posts` — 등록 `internal/transport/httpapi/testdata/routes.txt:25`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

추가 path 파라미터: 없음.

### 3. Query

| 이름 | 타입 | 필수 | 기본값 | 허용값·파싱·상한 |
| --- | --- | --- | --- | --- |
| take | integer | 아니오 | 20 | >=1; 상한 없음 |
| page | integer | 아니오 | 1 | >=1; 상한 없음, 큰 page는 빈 페이지 |
| is_not_paging | boolean | 아니오 | false | 참이면 bare 배열+limit 사용 |
| limit | integer | 아니오 | 미전송 0 → bare 분기에서 10 | 명시하면 >=1; 상한 없음; false 분기에선 사용 안 함 |
| board_id | UUID | 아니오 | 필터 없음 | zero UUID도 필터 없음 |
| category_id | UUID | 아니오 | 필터 없음 | 해당+직속 자식 카테고리; zero UUID 필터 없음 |
| is_public_only | boolean | 아니오 | false | board.category_id IS NULL |
| id | UUID | 아니오 | 필터 없음 | 게시글 하나; zero UUID 필터 없음 |
| user_id | int64 | 아니오 | 0 → 필터 없음 | 작성자 필터; 양수 minimum 없음 |
| is_view | string | 아니오 | 빈 값 → 필터 없음 | "0"=열람이력 없음, 그 외 비어있지 않은 값=있음; enum/길이 상한 없음 |
| badges | string[] | 아니오 | 없음 | 개수/길이/enum 제한 없음; 저장값 NOTICE, 미지값 결과 없음 |
| except_badges | string[] | 아니오 | 없음 | 개수/길이/enum 제한 없음; 현재 유효한 해당 뱃지 제외 |
| limit_day | integer | 아니오 | -1 | 음수 모두 미적용; 0은 now 이후; 상한 없음 |
| start_posted_at | string | 아니오 | 없음 | 날짜 공통 파서, 포함 하한; 길이 상한 없음 |
| end_posted_at | string | 아니오 | 없음 | 날짜 공통 파서, 포함 상한; 역전도 에러 없이 보통 빈 결과 |
| user_name | string | 아니오 | 없음 | 비어있지 않은 값 길이>=1, 상한 없음, ILIKE |
| search | string | 아니오 | 없음 | 2자 이상일 때 제목/평문/작성자; 1자는 필터 안 함; 상한 없음 |
| title_content | string | 아니오 | 없음 | 비어있지 않은 값 2자 이상; 상한 없음; 제목 OR 평문 |
| title | string | 아니오 | 없음 | 비어있지 않은 값 2자 이상; 상한 없음 |
| content | string | 아니오 | 없음 | 비어있지 않은 값 2자 이상; 상한 없음; text_content 검색 |
| is_include_comment | boolean | 아니오 | false | title/content/title_content를 살아 있는 댓글로 확장; search에는 무관 |
| sort[by] | string | 아니오 | created_at | 아래 정렬키 전수; 미지값은 created_at |
| sort[order] | string | 아니오 | desc | asc,desc만; 대문자/다른 값 400 |
| sort[value] | string | 아니오 | 없음 | 비어있지 않은 값 >=1, 상한 없음; relative일 때만 사용 |
| more_field | string | 아니오 | 없음 | 어떤 값도 무시; 길이 상한 없음 |

모든 optional scalar query에서 빈 값은 미전송처럼 처리된다. `board_id=`, `id=`, `user_id=`, `title=`, `user_name=`도 각 필드의 zero/default로 처리한다. 문자열 minLength가 있어도 빈 query는 schema 검사에 들어가지 않는 차이다. 라이브러리 `github.com/danielgtaylor/huma/v2@v2.39.0/huma.go:961`

정렬키 전수: `id,company_id,board_id,user_id,seq,state,title,content,text_content,is_allow_comment,is_comment_alarm,is_send_alarm,is_notice_alarm,delete_user_id,schedule_at,deleted_at,posted_at,updated_at,created_at,relative`. 일반 키는 동률에서 id 오름차순, relative는 `text_content`의 앞 탭을 지운 뒤 sort[value]로 분할한 조각 수(대체로 출현 횟수+1), 동률은 created_at 내림차순/id 순이다. relative에 값이 없으면 created_at. `internal/domain/board/postlist.go:115`, `internal/domain/board/postlistfilter.go:406`, `internal/domain/board/postlistfilter.go:467`

boolean query는 `1,t,T,TRUE,true,True` / `0,f,F,FALSE,false,False`만 허용한다. `yes,on,2`는 400. 빈 값은 Huma에서 미전송처럼 처리한다. int는 부호 있는 10진 정수이며 숫자 아닌 값/정수 범위 초과는 400. UUID 형식 오류도 400. 배열은 반복키 `badges=NOTICE&badges=X`, `badges[]=NOTICE`, `badges[0]=NOTICE`로 보낸다. 쉼표를 쓰면 한 문자열 값이며 JSON 배열 문자열도 배열이 아니다. `sort[by]` 같은 문자열 index는 재작성하지 않는다. [공통 파싱 근거](README.md), `internal/transport/httpapi/middleware/queryarray.go:42`, `internal/transport/httpapi/board/posts.go:86`

`badges`는 해당 미삭제 badge가 **현재 유효한** 글을 포함하고 except_badges는 현재 유효한 글을 제외한다. 같은 NOTICE를 양쪽에 보내면 두 조건이 AND로 걸려 빈 결과다. `internal/domain/board/postlistfilter.go:277`, `internal/domain/board/postlistfilter.go:289`

정렬 SQL은 NULLS FIRST/LAST를 명시하지 않아 PostgreSQL 기본(DESC에서는 NULL 먼저, ASC에서는 나중)을 따른다. sort[by]=comment_count/view_count/like_count/category_id/purged_at은 인식 목록에 없어 created_at으로 대체된다. `internal/domain/board/postlist.go:109`, `internal/domain/board/postlistfilter.go:488`

복수 검색 조건은 AND 결합, 각 문자열 조건 내부는 OR다. `%`,`_`는 ILIKE wildcard로 살아 있다(escape하지 않음). 앞뒤 공백도 검색에 그대로 들어가지만 검색 이력에는 trim한 값이 저장된다. 미등록 query(예: `state`,`start_created_at`,`end_created_at`)는 무시한다. `internal/domain/board/postlistfilter.go:325`, `internal/domain/board/postlistfilter.go:393`, `internal/transport/httpapi/board/search.go:32`

### 4. Body

없음. 본문/필드/추가 키 계약 없음.

### 5. 인증·권한

공통 401 → 403 → query 400 → 읽기 가능한 게시판 집합 계산 → ACT·미삭제 글 필터. 비활성 게시판, 비활성/삭제 카테고리, 읽기 권한 없는 게시판은 결과와 total에서 제외하며 개별 403/404를 내지 않는다. category_id/board_id가 없거나 다른 회사여도 빈 결과로 보이므로 존재 이유를 구분할 수 없다. `internal/domain/board/postlistquery.go:66` `internal/domain/board/postlistquery.go:662`

### 6. Response

200: [PageEnvelope](#pageenvelope) 또는 is_not_paging=true일 때 [PostView](#postview) 배열. 기본 관계는 위 DTO 표와 같다. 그 외 400 `INVALID_PAYLOAD`, 401 `UNAUTHORIZED`, scope 403 `FORBIDDEN`, 500 `INTERNAL_ERROR`, 503 `SERVICE_UNAVAILABLE`. `internal/transport/httpapi/board/posts.go:318` `internal/transport/httpapi/board/postsbody.go:363`

### 7. 주의사항

search/title_content/title/content의 비어있지 않은 값을 검색 **전에 동기 기록**한다. 검색 SQL이 실패해도 이력은 남을 수 있고 이력 저장 실패는 응답을 실패시키지 않는다. 검색어 한 글자는 목록 필터에서 빠져도 이력은 저장하며, 날짜 파싱 400은 이력 기록 전에 끝난다. 값이 있는 검색 필드마다 저장을 호출한다. 일반 게시글 목록의 기본 DB statement는 빈 페이지 3개(게시판·행·count), 행이 있으면 관계 2개를 추가하여 5개이고 검색 이력 I/O는 별도다. `internal/transport/httpapi/board/posts.go:326`, `internal/domain/board/postlistquery.go:391`, `internal/domain/board/postlistquery.go:551`

GET 자체는 열람 이벤트를 남기지 않는다. `is_view=0`은 열람행만 검사하므로 자기 글이 결과에 있으면서 DTO is_view=true일 수 있다. bare 분기에서도 page/offset은 살아 있으므로 첫 limit개면 page=1로 보낸다. `internal/transport/httpapi/board/posts.go:336` `internal/transport/httpapi/board/search.go:32` `internal/domain/board/postlistfilter.go:261` `internal/domain/board/postlistquery.go:205`

### 8. 시나리오

```sh
# 정상: page 봉투
curl -sS -i -G "$S/posts" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode "board_id=$BOARD_ID" --data-urlencode 'take=20'
# 정상 경계: bare array, 최대 5개
curl -sS -i -G "$S/posts" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'is_not_paging=1' --data-urlencode 'limit=5'
# 정상: 한 글자 search는 필터를 걸지 않음
curl -sS -i -G "$S/posts" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'search=가'
# 오류: 같은 한 글자라도 title은 400 INVALID_PAYLOAD
curl -sS -i -G "$S/posts" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'title=가'
# 오류: bool에 yes는 400; is_view=yes는 허용되어 읽은 글 필터가 됨
curl -sS -i -G "$S/posts" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'is_not_paging=yes'
```
근거: `internal/transport/httpapi/board/posts_test.go:414`, `internal/transport/httpapi/board/posts_test.go:674`.


## GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/mine

### 1. 경로

OperationID: `board-list-my-posts`. [`internal/transport/httpapi/board/routes.go:706`](../../internal/transport/httpapi/board/routes.go#L706)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/mine`. `internal/transport/httpapi/testdata/routes.txt:30`

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

추가 path 파라미터: 없음.

### 3. Query

| 이름 | 타입 | 필수 | 기본값 | 허용값·파싱·상한 |
| --- | --- | --- | --- | --- |
| take | integer | 아니오 | 20 | >=1; 상한 없음 |
| page | integer | 아니오 | 1 | >=1; 상한 없음 |
| sort[by] | string | 아니오 | 빈 문자열 | 위 정렬키 중 posts 컬럼; relative 값 없음 → created_at; 미지값 created_at |
| sort[order] | string | 아니오 | desc | asc,desc 전수 |
| state | string | 아니오 | 빈 문자열 | SAVE,ACT,HIDE,SCHEDULED,DEL 의미 있음; enum 제한 없음; 생략/미지값 빈 page |
| is_bookmark | string | 아니오 | 빈 문자열 | 빈 문자열/0이면 내 글; 나머지 모두 북마크, state 무시 |

정수/빈 query/미등록 key/정렬 파싱은 앞 목록과 같다. 배열 파라미터 없음. sort[by] 생략 시 DEL=updated_at, SAVE=created_at, 나머지=posted_at; **미지 이름은 생략과 달리 created_at**으로 간다. `internal/transport/httpapi/board/posts.go:379` `internal/domain/board/postlistfilter.go:432` `internal/domain/board/postlistfilter.go:488`

### 4. Body

없음. body 필드/추가 키 계약 없음.

### 5. 인증·권한

작성자 + 같은 회사로만 고른다. 상태 DEL이면 deleted_at IS NOT NULL AND purged_at IS NULL; 그 외 상태 일치+미삭제. is_bookmark truthy이면 본인 작성 조건 없이 북마크 SQL로 분기. scope 403, query 400 외 개별 글의 403/404는 없다. `internal/transport/httpapi/board/posts.go:480` `internal/domain/board/postlistfilter.go:137`

### 6. Response

200 [PageEnvelope](#pageenvelope) of [PostView](#postview), 관계 기본 포함. 배열로 바뀌는 분기 없음. 400 `INVALID_PAYLOAD`, 401 `UNAUTHORIZED`, scope 403 `FORBIDDEN`, 500 `INTERNAL_ERROR`, 503 `SERVICE_UNAVAILABLE`. `internal/transport/httpapi/board/posts.go:480`

### 7. 주의사항

게시판 접근권한이 없어도 제목/미리보기/첨부 메타데이터와 게시판 객체가 반환될 수 있다. 상세 성공을 보장하지 않는다. 읽음·검색이력 저장 없음. is_not_paging,검색 필터는 선언되지 않았으므로 무시된다. `internal/domain/board/postlistquery.go:474` `internal/transport/httpapi/board/posts.go:379`

### 8. 시나리오

```sh
# 정상: 내 발행 글
curl -sS -i -G "$S/posts/mine" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'state=ACT'
# 정상 경계: state가 없으면 data=[]
curl -sS -i "$S/posts/mine" -H "Authorization: Bearer $BOARD_TOKEN"
# 정상이나 주의: 문자열 false는 북마크 분기, SAVE 무시
curl -sS -i -G "$S/posts/mine" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'state=SAVE' --data-urlencode 'is_bookmark=false'
# 오류: page=0은 400 INVALID_PAYLOAD
curl -sS -i -G "$S/posts/mine" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'state=ACT' --data-urlencode 'page=0'
```


## GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/bookmarks

### 1. 경로

OperationID: `board-list-bookmarked-posts`. [`internal/transport/httpapi/board/routes.go:725`](../../internal/transport/httpapi/board/routes.go#L725)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/bookmarks`. `internal/transport/httpapi/testdata/routes.txt:29`

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

추가 path 파라미터: 없음.

### 3. Query

| 이름 | 타입 | 필수 | 기본값 | 허용값·파싱·상한 |
| --- | --- | --- | --- | --- |
| take | integer | 아니오 | 20 | >=1; 상한 없음 |
| page | integer | 아니오 | 1 | >=1; 상한 없음 |
| sort[by] | string | 아니오 | 빈 문자열 | 위 정렬키 중 posts 컬럼; relative 값 없음 → created_at; 미지값 created_at |
| sort[order] | string | 아니오 | desc | asc,desc 전수 |

정수/빈 query/미등록 key/정렬 파싱은 앞 목록과 같다. 배열 파라미터 없음. sort[by] 생략 시 posted_at; **미지 이름은 생략과 달리 created_at**으로 간다. `internal/transport/httpapi/board/posts.go:512` `internal/domain/board/postlistfilter.go:432` `internal/domain/board/postlistfilter.go:488`

### 4. Body

없음. body 필드/추가 키 계약 없음.

### 5. 인증·권한

같은 회사 + 미삭제 ACT + 내 미삭제 북마크로만 고른다. 게시판 Read/active gate가 없다. scope 403, query 400 외 개별 글의 403/404는 없다. `internal/transport/httpapi/board/posts.go:556` `internal/domain/board/postlistfilter.go:137`

### 6. Response

200 [PageEnvelope](#pageenvelope) of [PostView](#postview), 관계 기본 포함. 배열로 바뀌는 분기 없음. 400 `INVALID_PAYLOAD`, 401 `UNAUTHORIZED`, scope 403 `FORBIDDEN`, 500 `INTERNAL_ERROR`, 503 `SERVICE_UNAVAILABLE`. `internal/transport/httpapi/board/posts.go:556`

### 7. 주의사항

게시판 접근권한이 없어도 제목/미리보기/첨부 메타데이터와 게시판 객체가 반환될 수 있다. 상세 성공을 보장하지 않는다. 읽음·검색이력 저장 없음. is_not_paging,검색 필터는 선언되지 않았으므로 무시된다. `internal/domain/board/postlistquery.go:433` `internal/transport/httpapi/board/posts.go:512`

### 8. 시나리오

```sh
# 정상: 북마크한 ACT 목록
curl -sS -i "$S/posts/bookmarks" -H "Authorization: Bearer $BOARD_TOKEN"
# 정상: 100을 넘겨도 크기 정책 상한 없음
curl -sS -i -G "$S/posts/bookmarks" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'take=101'
# 오류: take=0은 400 INVALID_PAYLOAD
curl -sS -i -G "$S/posts/bookmarks" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'take=0'
```


## GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}

### 1. 경로

OperationID: `board-get-post`. [`internal/transport/httpapi/board/routes.go:744`](../../internal/transport/httpapi/board/routes.go#L744)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}`. `internal/transport/httpapi/testdata/routes.txt:26`

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 게시글 UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/postdetail.go:37`

### 3. Query

없음. 검색·정렬 query를 보내도 앞뒤 글 계산에 반영하지 않는다. `internal/transport/httpapi/board/postdetail.go:37`

### 4. Body

없음. body 필드/추가 키 계약 없음.

### 5. 인증·권한

공통 401 → scope 403 → UUID 400 → 같은 회사 게시글+미삭제 게시판 존재 404 → 가시성 404 → 게시판 Read 403 → 관계 조회. 작성자는 모든 상태/삭제표시에서 가시성을 통과하나 Read를 우회하지 않는다. 다른 사용자는 미삭제 ACT/HIDE만 통과; 관리자도 작성자가 아니면 SAVE/SCHEDULED/삭제 글 404. 가시성 실패와 없는 글은 같은 NOT_FOUND다. `internal/domain/board/postdetailquery.go:190` `internal/domain/board/postdetailquery.go:645`

### 6. Response

200 [PostDetailView](#postdetailview) 단일 객체, 봉투 없음. 400 `INVALID_PAYLOAD`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 500 `INTERNAL_ERROR`, 503 `SERVICE_UNAVAILABLE`. 응답 전 열람 기록 실패는 오류 응답에 반영하지 않는다. `internal/transport/httpapi/board/postdetail.go:64`

### 7. 주의사항

ACT/미삭제이면 이벤트를 1개 추가하지만 응답은 추가 전 데이터다. HIDE/SAVE/SCHEDULED/삭제이면 기록하지 않는다. 삭제 댓글은 comment=""와 is_active=false, 자식·user는 남는다. purged_at을 가시성에 검사하지 않으므로 작성자는 purged 글을 ID로 여전히 읽을 수 있다(게시판 Read 필요). 본문 HTML은 sanitizer 결과가 아니므로 프론트 렌더링 시 신뢰 경계를 별도 적용한다. `internal/transport/httpapi/board/postdetail.go:105` `internal/domain/board/postdetailquery.go:190` `internal/domain/board/postdetailquery.go:330` `internal/domain/board/postwrite.go:273`

### 8. 시나리오

```sh
# 정상: 접근 가능한 글. ACT면 열람 이벤트가 증가
curl -sS -i "$S/posts/$POST_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Time_zone: Asia/Seoul'
# 오류: UUID 형식은 맞지만 없는 게시글 → 404 NOT_FOUND
curl -sS -i "$S/posts/00000000-0000-0000-0000-000000000000" -H "Authorization: Bearer $BOARD_TOKEN"
# 오류: 형식부터 틀린 UUID → 400 INVALID_PAYLOAD
curl -sS -i "$S/posts/not-a-uuid" -H "Authorization: Bearer $BOARD_TOKEN"
```
근거: `internal/transport/httpapi/board/postdetail_test.go:412`, `internal/transport/httpapi/board/postdetail_test.go:568`.


## GET /api/v1/board/companies/{company_id}/users/{user_id}/attachments/{id}/download-url

### 1. 경로

OperationID: `board-get-post-attachment-download-url`. [`internal/transport/httpapi/board/routes.go:1215`](../../internal/transport/httpapi/board/routes.go#L1215)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/attachments/{id}/download-url`. id는 post id가 아니라 첨부 id다. `internal/transport/httpapi/testdata/routes.txt:9`

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 첨부(FILE 또는 THUMBNAIL) UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/attachmentdownload.go:43`

### 3. Query

없음. `internal/transport/httpapi/board/attachmentdownload.go:43`

### 4. Body

없음. body 필드/추가 키 계약 없음.

### 5. 인증·권한

공통 401 → scope 403 → UUID 400 → 첨부 signer 미설정 503 → 같은 회사의 미삭제 첨부+미삭제 ACT/HIDE 글+미삭제 게시판 조회 404 → Read 403 → 서명. 작성자라도 SAVE/SCHEDULED/삭제 글의 첨부는 404. 타입(FILE/THUMBNAIL) 제한은 없다. `internal/transport/httpapi/board/attachmentdownload.go:85` `internal/domain/board/attachmentdownload.go:160` `internal/domain/board/commentquery.go:62`

### 6. Response

| status | 응답 |
| --- | --- |
| 200 | 아래 DownloadURLBody 단일 객체 |
| 400 / 401 / 403 / 404 | INVALID_PAYLOAD / UNAUTHORIZED / FORBIDDEN / NOT_FOUND |
| 500 / 503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE |

| 필드 | 타입 | null | 저장/계산 · 포맷 |
| --- | --- | --- | --- |
| url | URL string | 아니오 | 계산 · 첨부 bucket의 presigned GET URL |
| origin_file_name | string | 아니오 | 저장 · 다운로드 표시 파일명 |
| expires_at | timestamp string | 아니오 | 계산 · 요청 clock+5분, UTC 소수6자리 |

`internal/transport/httpapi/board/attachmentdownload.go:106`

### 7. 주의사항

바이트 응답/302가 아니라 URL 발급이다. 반환 URL은 bearer 없이 별도 GET 가능하며 5분 뒤 재발급한다(TTL query 없음). 자료실 download와 달리 업로드 stage가 없어 409 분기가 없다. Content-Disposition response override도 PresignGetObject 입력에 넣지 않는다. object에 저장된 Content-Disposition을 사용할 수 있으므로 origin_file_name으로 다운로드 UI를 처리한다. raw object key를 별도 src 필드로 반환하지는 않지만 presigned URL 경로에 key가 포함될 수 있다. `internal/transport/httpapi/board/attachmentdownload.go:126`, `internal/platform/objectstore/objectstore.go:142`

S3 존재 확인(HEAD)을 하지 않으므로 발급 200이 실제 object 존재를 보장하지 않는다. 읽음 이벤트 없음. 네트워크에서 URL을 받은 이후 권한 회수/삭제해도 이미 발급한 URL의 만료 전 효력은 object store 정책에 따른다. `internal/transport/httpapi/board/attachmentdownload.go:99`

### 8. 시나리오

```sh
# 정상: FILE_ID에 files[].id 또는 thumbnail.id를 지정
curl -sS -i "$S/attachments/$FILE_ID/download-url" -H "Authorization: Bearer $BOARD_TOKEN"
# 오류: 없는 첨부 → 404 (서명 어댑터 설정이 없는 환경은 먼저 503)
curl -sS -i "$S/attachments/00000000-0000-0000-0000-000000000000/download-url" -H "Authorization: Bearer $BOARD_TOKEN"
# 오류: UUID 자체가 잘못됨 → 400
curl -sS -i "$S/attachments/not-a-uuid/download-url" -H "Authorization: Bearer $BOARD_TOKEN"
```
근거: `internal/transport/httpapi/board/attachmentdownload.go:85`.

