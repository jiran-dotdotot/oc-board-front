# 07. 댓글·공감·열람자

등록 엔드포인트 **8개**. 댓글 목록은 독립 GET이 아니라 [게시글 상세](05-post-read.md)에 포함된다. [글 쓰기·읽음 처리](06-post-write.md), [게시판 권한 전문](04-board.md).

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

1. 댓글 **작성은 201**, 수정/삭제/공감은 200이다. comments.go의 “작성 200” 주석은 stale이며 실제 Register DefaultStatus가 201이다. `internal/transport/httpapi/board/routes.go:406`, `internal/transport/httpapi/board/comments.go:51`
2. 댓글은 빈 문자열도 저장할 수 있다. 작성 `comment`는 선택, 수정은 body/query 둘 다 없어도 updated_at만 바뀐다. body의 빈 문자열은 본문 지우기지만 query의 빈 문자열은 기존 유지다. `internal/transport/httpapi/board/commentsbody.go:80`, `internal/transport/httpapi/board/commentsbody.go:113`, `internal/domain/board/commentquery.go:394`
3. 삭제는 is_active=false 표시다. comment_count는 비활성 댓글까지 SQL로 세므로 삭제해도 줄지 않고, 작성분은 다음 조회에 반영된다. `internal/domain/board/postlistquery.go:186` 답글/공감을 연쇄 삭제하지 않고, 비활성 댓글의 원문도 DB에 남는다. 본인 비활성 댓글 수정은 가능하고 응답에는 원문이 나오지만 상세 재조회에서는 빈 문자열로 가린다. `internal/domain/board/commentquery.go:394`, `internal/domain/board/commentquery.go:413`, `internal/domain/board/postdetailquery.go:330`
4. 댓글 쓰기 3종은 같은 좁은 read gate를 쓰지 않는다. 댓글 공감 토글은 삭제 댓글/임시저장·예약·휴지통 글도 read+댓글허용 조건이면 가능하지만 공감자 GET은 그런 대상을 404로 숨긴다. 프론트가 GET 가능 여부만으로 토글 성공 여부를 예측하면 안 된다. `internal/domain/board/commentquery.go:82`, `internal/domain/board/commentquery.go:106`, `internal/domain/board/comment.go:309`
5. 게시글 공감과 댓글 공감은 추가 body 키 정책이 다르다. 글 공감 body는 엄격하며 `is_liked` 같은 키를 보내면 400; 댓글 공감 body는 추가 키를 무시한다. 어느 쪽도 요청 상태를 설정하는 API가 아니며 호출마다 토글한다. `internal/transport/httpapi/board/postsignalbody.go:335`, `internal/transport/httpapi/board/commentsbody.go:196`
6. emoji는 진짜 emoji인지 검사하지 않는 1~16 Unicode code point 문자열이다. 공감 토글에서는 17자 400, 공감자 조회에서는 길이 상한 없이 200 빈 목록이다. 결합형 emoji 하나가 여러 code point일 수 있다. `internal/transport/httpapi/board/postsignalbody.go:293`, `internal/transport/httpapi/board/commentsbody.go:169`, `migrations/board/000001_initial_schema.sql:644`, `migrations/board/000001_initial_schema.sql:719`
7. 열람자 total은 고유 사용자 수, 게시글 view_count는 이벤트 수다. 열람자 DTO에 `viewed_at=last_visit_at`, `view_count=count` 두 쌍을 함께 보낸다. `internal/domain/board/postsignalquery.go:238`, `internal/transport/httpapi/board/postsignalbody.go:150`

## 공통 요청·응답 규칙

이 도메인에는 boolean query와 배열 query가 **없음**. scalar query는 URL 인코딩하며 미등록 키는 무시한다. body는 JSON; 폼 변환 대상이 아니므로 form-urlencoded/multipart는 415이다. Huma 기본 body 상한은 1 MiB, 별도 필드 길이 상한이 없는 것과 구별한다. `internal/transport/httpapi/board/commentsbody.go:33`, `internal/transport/httpapi/board/postsignalbody.go:113`, `internal/transport/httpapi/router.go:322`; 라이브러리 `github.com/danielgtaylor/huma/v2@v2.39.0/huma.go:1490`

**선택 body 필드의 null은 실제 HTTP에서 허용**한다. Huma는 non-required object property가 null이면 schema의 nullable 표시와 관계없이 검증을 건너뛴다. 댓글 수정 comment:null은 미지정→query fallback/기존 유지, 생성 comment:null과 공감 emoji:null은 빈 문자열과 같은 후속 처리를 한다. parent UUID 두 필드는 명시 nullable:true이며 null은 부모 미지정이다. `internal/transport/httpapi/board/commentsbody.go:71`, `internal/transport/httpapi/board/commentsbody.go:113`; 라이브러리 `github.com/danielgtaylor/huma/v2@v2.39.0/schema.go:944`, `github.com/danielgtaylor/huma/v2@v2.39.0/validate.go:855`

페이지 query `take`는 integer 기본 20, `page`는 integer 기본 1, 둘 다 >=1이며 **상한 없음**. 숫자 아닌 값/기계 정수 범위 초과/0/음수는 400 INVALID_PAYLOAD. 빈 값은 Huma에서 미전송처럼 처리하여 기본값을 쓴다. 너무 큰 page의 offset 곱은 포화 처리하여 음수 overflow 대신 빈 페이지를 반환한다. `internal/transport/httpapi/board/commentsbody.go:224`, `internal/transport/httpapi/board/postsignalbody.go:113`, `internal/domain/board/comment.go:383`, `internal/domain/board/postlistquery.go:532`

### 도메인 오류 코드

공통 오류 표에 추가되는 code 전수다. **400**이며 board의 schema error는 INVALID_PAYLOAD로 별개다. `internal/transport/httpapi/board/comments.go:155`, `internal/transport/httpapi/board/comments.go:217`, `internal/transport/httpapi/board/postsignal.go:151`

| status | code | 조건 |
| --- | --- | --- |
| 400 | COMMENT_NOT_ALLOWED | 댓글 작성/수정에서 게시글 허용·상태 조건 실패 |
| 400 | COMMENT_PARENT_INVALID | 답글의 부모가 없음/다른 글/비활성/이미 답글 |
| 400 | COMMENT_EMOJI_REQUIRED | 댓글 공감의 body와 query 모두 emoji가 비어 있음 |
| 400 | POST_EMOJI_REQUIRED | 글 공감의 body와 query 모두 emoji가 비어 있음 |

### 권한·상태 비교

모든 행은 먼저 공통 인증/scope/schema를 통과해야 한다. “회사 일치+살아 있는 board”는 아래 전부의 조회 기준이다. 읽기/관리자 계산 전문은 [04](04-board.md). 표는 전용 함수의 실제 if/WHERE를 기준으로 작성했다. `internal/domain/board/comment.go:123`, `internal/domain/board/comment.go:200`, `internal/domain/board/comment.go:265`, `internal/domain/board/comment.go:309`, `internal/domain/board/comment.go:364`, `internal/domain/board/commentquery.go:82`

| 작업 | 조회로 404가 되는 범위 | 뒤의 검사 순서 |
| --- | --- | --- |
| 댓글 작성 | post 없음/다른 회사/삭제/SAVE/SCHEDULED | 댓글허용 400 → Read 403 → state ACT 아니면 400 → parent 400 |
| 댓글 수정 | comment/post/board 없음·회사 불일치, board 삭제 | 작성자 403 → post live·댓글허용·ACT 아니면 400; Read 검사 없음 |
| 댓글 삭제 | 위 수정과 같음 | 작성자 OR 게시판/카테고리/회사관리자 아니면 403; 글 상태/댓글 활성/Read 검사 없음 |
| 댓글 공감 토글 | 위 수정과 같음 | Read AND 댓글허용 아니면 403; 글 삭제/상태·댓글 활성 검사 없음 |
| 댓글 공감자 | 비활성 댓글, post 삭제/SAVE/SCHEDULED도 404 | Read 아니면 403; 댓글허용 검사 없음 |
| 글 공감 토글·공감자·열람자 | post 없음/다른 회사/삭제/SAVE/SCHEDULED | Read 아니면 403; 댓글허용 검사 없음 |

## 공유 DTO 필드 표

### Huma가 추가하는 공통 필드

아래 표는 업무 DTO 필드다. 실제 최상위 객체는 Huma의 [자동 스키마 필드 규칙](README.md#schema-field)에 따라 다음 메타 필드 및 Link 헤더가 추가될 수 있다. 중첩 관계 객체에는 자동 추가하지 않는다. strict body의 일반 추가 키 불허와 별개로 등록 schema에 추가된 read-only `$schema` 키는 입력에서도 예외적으로 허용/무시한다. `internal/transport/httpapi/routerboard_test.go:161`; 라이브러리 `github.com/danielgtaylor/huma/v2@v2.39.0/transforms.go:82`, `github.com/danielgtaylor/huma/v2@v2.39.0/validate.go:832`

| 공통 필드 | 타입 | null/생략 | 저장/계산 |
| --- | --- | --- | --- |
| $schema | string | null 아님, 조건부 생략 | 계산 · 해당 응답 JSON Schema 경로; 객체/배열·등록 방식 조건은 README 참조 |

지원하지 않는 Accept 값도 기본 JSON 포맷으로 fallback한다. 이 설정에서는 Accept 미지원만으로 406을 반환하지 않는다. [공통 content negotiation](README.md), `internal/transport/httpapi/router.go:354`; 라이브러리 `github.com/danielgtaylor/huma/v2@v2.39.0/api.go:375`, `github.com/danielgtaylor/huma/v2@v2.39.0/defaults.go:79`


### CommentView

작성/수정 응답은 봉투 없는 아래 객체. user는 기본 관계이며 comments/child_comments/likes 관계는 이 응답에 **없음**; 필요하면 상세를 재조회한다. deleted_at도 없음(삭제축은 is_active). depth 필드도 없으며 root/답글은 parent_id로 판정한다. `internal/transport/httpapi/board/commentsbody.go:252`, `internal/domain/board/commentquery.go:363`; DB 필드 타입/기본값 `migrations/board/000001_initial_schema.sql:662`
| 필드 | 타입 | null | 저장/계산 · 관계/포맷 |
| --- | --- | --- | --- |
| id | UUID string | 아니오 | 저장 |
| post_id | UUID string | 아니오 | 저장 |
| parent_id | UUID string | 예 | 저장 · root는 null |
| parent_comment_id | UUID string | 예 | 계산 · parent_id와 완전히 같은 값 |
| user_id | int64 | 예 | 저장 · hard-delete 작성자면 null 가능 |
| comment | string | 아니오 | 저장 · 원문; 비활성 댓글 수정 응답도 원문 |
| is_active | boolean | 아니오 | 저장 · 생성 true, 삭제 false |
| created_at | timestamp string | 아니오 | 저장 · UTC 6자리 |
| updated_at | timestamp string | 아니오 | 저장 · UTC 6자리 |
| user | PostAuthorView | 예 | 기본 관계 · [05 작성자 DTO](05-post-read.md#postauthorview), account 포함 |
| is_mine | boolean | 아니오 | 계산 · user_id == 요청자 |

### SignalUserView

공감자/열람자 기본 user 관계. 작성자 PostAuthorView와 달리 **account 없음**, 소속/부서/직위를 담은 member 관계도 없음. public.users의 같은 회사 행을 LEFT JOIN하므로 관계는 null 가능하나 부모 row.user_id는 남는다. 퇴직/중지 표시와 profile_src 생성은 작성자와 같은 helper를 사용한다. `internal/transport/httpapi/board/signaluserview.go:49`, `internal/domain/board/commentquery.go:484`, `internal/domain/board/postsignalquery.go:238`, `internal/transport/httpapi/board/me.go:172`
| 필드 | 타입 | null | 저장/계산 · 포맷 |
| --- | --- | --- | --- |
| id | int64 | 아니오 | 저장 · public.users ID |
| name | string | 예 | 계산 · 저장 이름+언어별 퇴직/중지 접미사 |
| profile_image_id | string | 예 | 저장 |
| disabled_at | timestamp string | 예 | 저장 · UTC |
| deleted_at | timestamp string | 예 | 저장 · UTC |
| profile_src | URL string | 예 | 계산 · 호스트/이미지ID 없음 또는 중지면 null |

### ParticipantPage

3개의 GET 참가자 목록이 공유하는 봉투. `data`의 원소만 아래 LikerView 또는 PostViewerView로 다르다. 모두 기본 포함, count/페이지/배열은 계산 필드이며 null은 없다. `internal/transport/httpapi/board/postsbody.go:41`, `internal/transport/httpapi/board/commentsbody.go:361`, `internal/transport/httpapi/board/postsignalbody.go:161`

| 필드 | 타입 | null | 저장/계산 |
| --- | --- | --- | --- |
| data | LikerView[] 또는 PostViewerView[] | 아니오 | 계산 · 빈 결과 [] |
| current_page | integer | 아니오 | 계산 · 요청 page |
| last_page | integer | 아니오 | 계산 · max(1, ceil(total/take)) |
| per_page | integer | 아니오 | 계산 · 요청 take |
| total | int64 | 아니오 | 계산 · 필터된 전체 참가자 수 |

### LikerView

CommentLikerView와 PostLikerView의 공통 전 필드. 기본 user 관계 이외 추가 eager load 없음. 두 timestamp는 최초 공감/마지막 토글 시각이며 현재 목록은 살아 있는 공감만 읽는다. `internal/transport/httpapi/board/commentsbody.go:336`, `internal/transport/httpapi/board/postsignalbody.go:192`

| 필드 | 타입 | null | 저장/계산 · 포맷 |
| --- | --- | --- | --- |
| user_id | int64 | 아니오 | 저장 · 공감 행의 사용자 ID |
| user | SignalUserView | 예 | 기본 관계 |
| created_at | timestamp string | 아니오 | 저장 · 최초 생성 UTC |
| updated_at | timestamp string | 아니오 | 저장 · 마지막 토글 UTC |

### PostViewerView

`internal/transport/httpapi/board/postsignalbody.go:150`, 집계 `internal/domain/board/postsignalquery.go:238`; DB `migrations/board/000001_initial_schema.sql:593`.

| 필드 | 타입 | null | 저장/계산 · 포맷 |
| --- | --- | --- | --- |
| user_id | int64 | 아니오 | 저장 · 열람 행 사용자 ID |
| user | SignalUserView | 예 | 기본 관계 |
| viewed_at | timestamp string | 아니오 | 계산 · 해당 사용자 MAX(created_at), UTC |
| last_visit_at | timestamp string | 아니오 | 계산 · viewed_at 별칭 |
| view_count | int64 | 아니오 | 계산 · 해당 사용자의 열람 이벤트 개수 |
| count | int64 | 아니오 | 계산 · view_count 별칭 |

### LikeToggleView

글/댓글 공감의 응답 전 필드. data 봉투와 eager-load 관계는 **없음**. 댓글만 comment_id가 추가된다. `internal/transport/httpapi/board/commentsbody.go:308`, `internal/transport/httpapi/board/postsignalbody.go:362`; DB `migrations/board/000001_initial_schema.sql:634`, `migrations/board/000001_initial_schema.sql:711`

| 필드 | 타입 | null | 저장/계산 · 포맷 |
| --- | --- | --- | --- |
| is_liked | boolean | 아니오 | 계산 · 토글 후 삭제되지 않았는가 |
| deleted_at | timestamp string | 예 | 저장/계산 · 켜짐 null, 꺼짐 현재 시각 UTC(글 응답은 요청 now로 렌더링) |
| user_id | int64 | 아니오 | 저장 · 요청 사용자 |
| post_id | UUID string | 아니오 | 글: 저장, 댓글: comment→post 조회 계산 |
| comment_id | UUID string | 아니오 | 저장 · **댓글 토글에만 존재**, 글에는 없음 |
| emoji | string | 아니오 | 저장 · 요청한 원문 |
| created_at | timestamp string | 아니오 | 저장 · 최초 생성 시각, 재토글해도 유지 |
| updated_at | timestamp string | 아니오 | 저장 · 토글 시각 |

### 댓글·공감 알림

댓글 생성은 root면 AlarmComment, 답글이면 AlarmReply를 커밋 후 enqueue한다. 댓글 수정/삭제는 enqueue하지 않는다. 공감은 켜지는 결과에만 알림 작업을 enqueue하고 해제는 enqueue하지 않는다. 알림 큐와 count 계산은 별개다. 댓글/글 공감 count 및 요약은 조회 SQL에서 구하며 별도 비동기 count job/공감 캐시를 기다리지 않는다. `internal/domain/board/postdetailquery.go:720`, `internal/domain/board/postlistquery.go:193` 실패는 로그만 남겨 HTTP 성공을 바꾸지 않으며 Redis 미설정이면 발행하지 않는다. `internal/transport/httpapi/board/comments.go:80`, `internal/transport/httpapi/board/comments.go:98`, `internal/transport/httpapi/board/comments.go:122`, `internal/transport/httpapi/board/comments.go:167`, `internal/transport/httpapi/board/postsignal.go:165`, `internal/transport/httpapi/board/handler.go:268`, `internal/app/app.go:142`

worker는 소비 시점의 현재 데이터로 전송 대상을 결정한다. 댓글/답글 알림은 게시글 작성자와 부모 댓글 작성자를 각각 고려하고 자신은 제외한다. 공감 알림에 넣는 emoji 목록은 이벤트 당시 값이 아니라 소비 시점의 해당 사용자의 최근 3개다. 빠르게 토글/재토글하면 실제 알림과 마지막 HTTP 응답 값이 다를 수 있다. 알림 언어는 ko 고정, 템플릿 미설정/잘못된 JSON은 warn 후 skip. `internal/transport/worker/alarmdelivery.go:322`, `internal/transport/worker/alarmdelivery.go:359`, `internal/transport/worker/alarmdelivery.go:403`, `internal/transport/worker/alarmdelivery.go:624`

## POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/comments

### 1. 경로

OperationID: `board-create-comment`. [`internal/transport/httpapi/board/routes.go:395`](../../internal/transport/httpapi/board/routes.go#L395)

`POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/comments` — `internal/transport/httpapi/testdata/routes.txt:44`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 게시글 UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/commentsbody.go:33`

### 3. Query

없음. query comment/parent_id를 보내도 본문으로 대체하지 않는다. `internal/transport/httpapi/board/commentsbody.go:33`

### 4. Body

| 필드 | 타입 | 필수 | 기본값 | 상한/검증 |
| --- | --- | --- | --- | --- |
| comment | string | 아니오 | 빈 문자열 | 최소/최대 길이 없음; null은 빈 본문, 그 밖의 비문자열 400 |
| parent_comment_id | UUID string 또는 null | 아니오 | null(root) | UUID 오류 400; non-null이면 parent_id보다 우선 |
| parent_id | UUID string 또는 null | 아니오 | null(root) | UUID 오류 400; 위 키가 없거나 null일 때 사용 |

JSON 객체 body 필수; `{}`는 빈 root 댓글. 추가 키는 **허용 후 무시**(is_active/company_id/user_id 등). 개수형 필드 없음. 두 parent 키 모두를 보내면 각각 UUID schema를 먼저 검증하므로 우선순위에서 버려질 값이 잘못되어도 400이다. `internal/transport/httpapi/board/commentsbody.go:45` `internal/transport/httpapi/board/commentsbody.go:85`

### 5. 인증·권한

공통 인증/scope/schema → 회사 내 살아 있는 ACT/HIDE 글+살아 있는 board 없으면 404 → is_allow_comment=false면 400 COMMENT_NOT_ALLOWED → Read=false면 403 → ACT 아니면 400 COMMENT_NOT_ALLOWED → 부모가 있으면 같은 글의 살아 있는 root인지 검사, 아니면 400 COMMENT_PARENT_INVALID → insert. 권한이 없는 독자도 댓글 비허용 400과 read 거절 403을 구별할 수 있다. 부모 존재 검사는 read 통과 뒤라 부적격 부모의 세부 이유는 알 수 없다. `internal/domain/board/comment.go:123` `internal/domain/board/commentquery.go:188`

### 6. Response

201: [CommentView](#commentview), Location header 없음. 400 INVALID_PAYLOAD/COMMENT_NOT_ALLOWED/COMMENT_PARENT_INVALID, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND 및 공통 408/413/415/500/503. `internal/transport/httpapi/board/routes.go:394` `internal/transport/httpapi/board/comments.go:217`

### 7. 주의사항

root/답글 2단까지; 답글에 답글은 허용하지 않는다. comment text는 정제/길이 축약 없이 저장한다. user 관계는 write CTE의 LEFT JOIN 결과이고, 상세 재조회 없이 UI에 추가할 수 있지만 likes/child_comments는 직접 빈 배열로 초기화하거나 상세를 재조회해야 한다. 알림은 위 공통 부수효과를 따른다. `internal/domain/board/commentquery.go:327` `internal/domain/board/commentquery.go:363`

### 8. 시나리오

```sh
# 정상: root 댓글 작성, 201
curl -sS -i -X POST "$S/posts/$POST_ID/comments" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"comment":"댓글 연동 테스트"}'
# 정상 경계: 빈 댓글도 허용되는 201
curl -sS -i -X POST "$S/posts/$POST_ID/comments" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{}'
# 오류: parent UUID 형식은 400 INVALID_PAYLOAD
curl -sS -i -X POST "$S/posts/$POST_ID/comments" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"comment":"답글","parent_comment_id":"not-a-uuid"}'
```


## PUT /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}

### 1. 경로

OperationID: `board-update-comment`. [`internal/transport/httpapi/board/routes.go:425`](../../internal/transport/httpapi/board/routes.go#L425)

`PUT /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}` — `internal/transport/httpapi/testdata/routes.txt:53`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 댓글 UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/commentsbody.go:33`

### 3. Query

`comment`: 선택 string, 기본 없음, 최소/최대 길이 없음, enum 없음. 비어있지 않을 때만 본문 후보로 사용한다. 배열 지원 없음. query는 문자열이므로 숫자처럼 생긴 텍스트도 그대로 저장한다. 빈 query는 본문을 지우지 않는다. `internal/transport/httpapi/board/commentsbody.go:101`

### 4. Body

| 필드 | 타입 | 필수 | 기본값 | 상한/검증 |
| --- | --- | --- | --- | --- |
| comment | string | 아니오 | 기존 유지 | 최소/최대 길이 없음; 빈 문자열은 지우기, JSON null은 미지정 |

JSON body 자체도 선택. 추가 키는 **허용 후 무시**(is_active 포함). body.comment가 있으면 빈 문자열까지 query보다 우선; body.comment 없음 → nonempty query → 둘 다 없으면 기존 유지. `internal/transport/httpapi/board/commentsbody.go:113` `internal/transport/httpapi/board/commentsbody.go:131`

### 5. 인증·권한

공통 인증/scope/schema → 회사 내 comment/post/살아 있는 board 결합 없으면 404 → 댓글 작성자 아니면 403 → 글이 live ACT이고 is_allow_comment=true가 아니면 400 COMMENT_NOT_ALLOWED → update. **Read 검사 없음, 댓글 is_active 검사 없음**. 관리자도 타인의 댓글 수정 불가. 타인은 403이 먼저이므로 그 뒤의 post 댓글허용 여부는 알 수 없다. `internal/domain/board/comment.go:200` `internal/domain/board/commentquery.go:82`

### 6. Response

200: [CommentView](#commentview). 400 INVALID_PAYLOAD/COMMENT_NOT_ALLOWED, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND 및 공통 408/413/415/500/503. `internal/transport/httpapi/board/comments.go:98` `internal/transport/httpapi/board/comments.go:217`

### 7. 주의사항

기존 비활성 댓글도 원문 수정 가능하며 응답 comment에는 수정 원문이 들어간다. is_active=true 추가 키로 복원할 수 없다. 본문 변경이 없어도 updated_at은 now로 갱신한다. 알림/열람/검색이력 없음. `internal/domain/board/commentquery.go:394` `internal/transport/httpapi/board/commentsbody.go:381`

### 8. 시나리오

```sh
# 정상: 본인 댓글 본문 지우기
curl -sS -i -X PUT "$S/comments/$COMMENT_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"comment":""}'
# 정상 경계: query 빈 문자열은 본문 유지(수정 시각만 갱신)
curl -sS -i -X PUT "$S/comments/$COMMENT_ID?comment=" -H "Authorization: Bearer $BOARD_TOKEN"
# 정상 경계: null은 미지정으로 기존 본문 유지
curl -sS -i -X PUT "$S/comments/$COMMENT_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"comment":null}'
# 오류: 숫자 타입은 400 INVALID_PAYLOAD
curl -sS -i -X PUT "$S/comments/$COMMENT_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"comment":123}'
```


## DELETE /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}

### 1. 경로

OperationID: `board-delete-comment`. [`internal/transport/httpapi/board/routes.go:442`](../../internal/transport/httpapi/board/routes.go#L442)

`DELETE /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}` — `internal/transport/httpapi/testdata/routes.txt:3`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 댓글 UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/commentsbody.go:33`

### 3. Query

없음. `internal/transport/httpapi/board/commentsbody.go:92`

### 4. Body

없음. body 필드/추가 키 계약 없음. `internal/transport/httpapi/board/commentsbody.go:92`

### 5. 인증·권한

공통 인증/scope/UUID → 회사 내 comment/post/살아 있는 board 결합 없으면 404 → 댓글 작성자 OR 게시판 관리자 OR 카테고리 관리자 OR 회사관리자 아니면 403 → inactive 처리. Read, post live/state, 댓글허용, 기존 is_active 검사는 없음. 삭제된 댓글 존재도 권한에 따라 200/403으로 구별된다. `internal/domain/board/comment.go:265` `internal/domain/board/commentquery.go:82`

### 6. Response

200: 봉투 없는 아래 한 필드 객체. 400 INVALID_PAYLOAD, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 500 INTERNAL_ERROR, 503 SERVICE_UNAVAILABLE. 기본 관계 없음. `internal/transport/httpapi/board/commentsbody.go:284`

| 필드 | 타입 | null | 저장/계산 |
| --- | --- | --- | --- |
| is_active | boolean | 아니오 | 계산 · 항상 false, 저장 이후 상태 |

### 7. 주의사항

is_active=false/updated_at=now만 기록하고 원문/답글/공감은 유지한다. 이미 false면 SQL UPDATE 0행이지만 200 false이며 updated_at도 다시 바꾸지 않는다. 댓글별 복원 endpoint는 없으나 글 복원이 비활성 댓글 전부를 활성화하는 부수효과는 [06](06-post-write.md)에 별도 기록했다. 알림 없음. `internal/domain/board/commentquery.go:413` `internal/domain/board/postwritequery.go:535`

### 8. 시나리오

```sh
# 정상: 내 댓글 또는 관리 권한이 있는 댓글 삭제, 200 {"is_active":false}
curl -sS -i -X DELETE "$S/comments/$COMMENT_ID" -H "Authorization: Bearer $BOARD_TOKEN"
# 정상 경계: 이미 삭제된 댓글에 반복해도 200 false
curl -sS -i -X DELETE "$S/comments/$COMMENT_ID" -H "Authorization: Bearer $BOARD_TOKEN"
# 오류: UUID 파싱 실패 400 INVALID_PAYLOAD
curl -sS -i -X DELETE "$S/comments/not-a-uuid" -H "Authorization: Bearer $BOARD_TOKEN"
```


## POST /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}/like

### 1. 경로

OperationID: `board-toggle-comment-like`. [`internal/transport/httpapi/board/routes.go:459`](../../internal/transport/httpapi/board/routes.go#L459)

`POST /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}/like` — `internal/transport/httpapi/testdata/routes.txt:38`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 댓글 UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/commentsbody.go:33`

### 3. Query

`emoji`: 선택 string, 기본 빈 문자열; enum 없음, 최대 **16 Unicode code point**, 최소 길이는 최종 body/query 병합 뒤 1이다. trim하지 않으므로 공백만으로도 비어 있지 않다. URL 인코딩하고 배열 표기는 없음. emoji의 schema 검증은 body 선택보다 앞서므로 body가 정상이어도 너무 긴 query는 400 INVALID_PAYLOAD다. `internal/transport/httpapi/board/commentsbody.go:163`

### 4. Body

선택 JSON 객체, `emoji`: 선택 string, 기본 빈 문자열, 최대 16 Unicode code point, enum 없음, null은 빈 값; 그 밖의 잘못된 타입 400. nonempty body.emoji가 query보다 우선이고 body가 비었으면 query를 쓴다. 둘 다 비면 수동 400. 추가 키는 **허용 후 무시**(is_liked 포함). 원하는 상태를 지정하는 필드는 없음. `page=2`를 이 POST에 붙여도 공감자 조회로 바뀌지 않고 무시한 뒤 토글한다. `internal/transport/httpapi/board/commentsbody.go:175` `internal/transport/httpapi/board/commentsbody.go:196`

### 5. 인증·권한

공통 인증/scope/schema → emoji 최종값 빈 경우 400 COMMENT_EMOJI_REQUIRED → 회사 내 comment/post/살아 있는 board 결합 없으면 404 → Read=false OR is_allow_comment=false면 403 → 토글. 댓글 active/게시글 삭제·상태는 검사하지 않는다. 따라서 비활성 댓글, SAVE/SCHEDULED/HIDE/휴지통 글에 붙은 댓글도 조건에 따라 200이다. read와 댓글허용 거절은 같은 403이라 구별할 수 없다. `internal/transport/httpapi/board/comments.go:155` `internal/domain/board/comment.go:309`

### 6. Response

200: [LikeToggleView](#liketoggleview)의 댓글형(comment_id 포함). 400 INVALID_PAYLOAD/COMMENT_EMOJI_REQUIRED, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND 및 공통 408/413/415/500/503. `internal/transport/httpapi/board/comments.go:143`

### 7. 주의사항

(comment_id,emoji,user_id)별 원자적 토글이다. 한 사람이 여러 emoji를 동시에 가질 수 있고 재시도/이중 클릭은 다시 상태를 반전한다. created_at은 최초, updated_at은 토글시각. 켜질 때 알림 enqueue, 꺼질 때 없음. 댓글 삭제가 기존 공감을 지우지는 않는다. `internal/domain/board/commentquery.go:444` `internal/transport/httpapi/board/comments.go:167`

### 8. 시나리오

```sh
# 정상: query만으로 토글, emoji URL 인코딩
curl -sS -i -X POST -G "$S/comments/$COMMENT_ID/like" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'emoji=👍'
# 정상 경계: 추가 is_liked는 무시; 앞 호출의 반대 상태로 토글
curl -sS -i -X POST "$S/comments/$COMMENT_ID/like" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"emoji":"👍","is_liked":true}'
# 오류: 대상 조회보다 먼저 400 COMMENT_EMOJI_REQUIRED
curl -sS -i -X POST "$S/comments/$COMMENT_ID/like" -H "Authorization: Bearer $BOARD_TOKEN"
# 오류: 17자는 400 INVALID_PAYLOAD
curl -sS -i -X POST "$S/comments/$COMMENT_ID/like" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"emoji":"abcdefghijklmnopq"}'
```


## GET /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}/likes

### 1. 경로

OperationID: `board-list-comment-likes`. [`internal/transport/httpapi/board/routes.go:477`](../../internal/transport/httpapi/board/routes.go#L477)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}/likes` — `internal/transport/httpapi/testdata/routes.txt:19`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 댓글 UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/commentsbody.go:33`

### 3. Query

`emoji`: **필수** string, 기본값 없음, 길이 >=1, 최대 길이/enum 없음. 누락/빈 값은 400 INVALID_PAYLOAD; 17자 이상도 허용되어 보통 빈 목록이다. trim하지 않아 공백도 조회 문자열이다. `take`: 선택 integer 기본20, `page`: 선택 integer 기본1, 둘 다 >=1/상한 없음; 파싱/잘못된 값은 공통 페이지 규칙. 배열 표기 없음, 미등록 query 무시. `internal/transport/httpapi/board/commentsbody.go:224`

### 4. Body

없음. body 필드/추가 키 계약 없음.

### 5. 인증·권한

공통 인증/scope/query/UUID → 회사 내 active 댓글+live ACT/HIDE 글+살아 있는 board 없으면 404 → Read=false 403 → 해당 emoji 참가자 조회. 댓글허용=false여도 조회는 된다. 비활성/초안/휴지통은 404로 합쳐 숨기고 유효 대상의 권한 부족은 403으로 구별된다. `internal/domain/board/comment.go:364` `internal/domain/board/commentquery.go:106`

### 6. Response

200: [ParticipantPage](#participantpage), data는 [LikerView](#likerview) 배열. 400 INVALID_PAYLOAD, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 500 INTERNAL_ERROR, 503 SERVICE_UNAVAILABLE. `internal/transport/httpapi/board/comments.go:187`

### 7. 주의사항

활성 공감만 created_at ASC,user_id ASC 순서로 반환한다. 동일 emoji는 사용자당 한 행이므로 total은 그 emoji의 공감 사용자 수다. 사용자 관계가 없어도 row.user_id는 남고 user=null. count와 data는 별도 SQL이므로 동시 토글 중 잠깐 다를 수 있다. 읽음/알림/검색이력 없음. `internal/domain/board/commentquery.go:484` `internal/domain/board/comment.go:377`

### 8. 시나리오

```sh
# 정상: 특정 emoji 공감자 목록
curl -sS -i -G "$S/comments/$COMMENT_ID/likes" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'emoji=👍' --data-urlencode 'take=20'
# 정상 경계: 토글은 거절하는 17자도 조회는 200 빈 목록
curl -sS -i -G "$S/comments/$COMMENT_ID/likes" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'emoji=abcdefghijklmnopq'
# 오류: emoji 누락 400 INVALID_PAYLOAD
curl -sS -i "$S/comments/$COMMENT_ID/likes" -H "Authorization: Bearer $BOARD_TOKEN"
```


## POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/like

### 1. 경로

OperationID: `board-toggle-post-like`. [`internal/transport/httpapi/board/routes.go:820`](../../internal/transport/httpapi/board/routes.go#L820)

`POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/like` — `internal/transport/httpapi/testdata/routes.txt:45`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 게시글 UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/postsignalbody.go:113`

### 3. Query

`emoji`: 선택 string, 기본 빈 문자열; enum 없음, 최대 **16 Unicode code point**, 최소 길이는 최종 body/query 병합 뒤 1이다. trim하지 않으므로 공백만으로도 비어 있지 않다. URL 인코딩하고 배열 표기는 없음. emoji의 schema 검증은 body 선택보다 앞서므로 body가 정상이어도 너무 긴 query는 400 INVALID_PAYLOAD다. `internal/transport/httpapi/board/postsignalbody.go:287`

### 4. Body

선택 JSON 객체, `emoji`: 선택 string, 기본 빈 문자열, 최대 16 Unicode code point, enum 없음, null은 빈 값; 그 밖의 잘못된 타입 400. nonempty body.emoji가 query보다 우선이고 body가 비었으면 query를 쓴다. 둘 다 비면 수동 400. 추가 키는 **불허**(400 INVALID_PAYLOAD). is_liked/deleted_at 등을 보내 상태를 설정할 수 없다. `internal/transport/httpapi/board/postsignalbody.go:301` `internal/transport/httpapi/board/postsignalbody.go:335`

### 5. 인증·권한

공통 인증/scope/schema 뒤에 최종 emoji가 비면 대상 조회 전에 **400 POST_EMOJI_REQUIRED**. emoji가 있으면 다음 순서다: 공통 인증/scope/schema → 회사 내 live ACT/HIDE 글+살아 있는 board 없으면 404 → Read=false 403 → 작업. 작성자의 SAVE/SCHEDULED/휴지통 예외 없음. is_allow_comment는 판정에 쓰지 않는다. 404는 없음/다른 회사/부적격 상태를 합치지만 권한 부족 403은 별개라 유효 대상 존재를 구별할 수 있다. `internal/domain/board/postsignalquery.go:100` `internal/transport/httpapi/board/postsignal.go:151`

### 6. Response

200: [LikeToggleView](#liketoggleview)의 글형(comment_id 없음). 400 INVALID_PAYLOAD/POST_EMOJI_REQUIRED, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND 및 공통 408/413/415/500/503. `internal/transport/httpapi/board/postsignal.go:138`

### 7. 주의사항

(post_id,emoji,user_id)별 원자적 토글. 한 사용자 여러 emoji 허용, count는 emoji별 row를 센다. 최초 created_at 유지/updated_at 갱신. 켜질 때만 알림 enqueue하며 열람행은 만들지 않는다. 재시도는 동일 결과를 보장하지 않으므로 응답 is_liked/deleted_at 또는 상세 요약으로 화면을 맞춘다. `internal/domain/board/postsignalquery.go:362` `internal/transport/httpapi/board/postsignal.go:165`

### 8. 시나리오

```sh
# 정상: query만으로 토글
curl -sS -i -X POST -G "$S/posts/$POST_ID/like" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'emoji=👍'
# 정상 경계: body의 빈 emoji는 query로 fallback, 앞 상태의 반대로 토글
curl -sS -i -X POST "$S/posts/$POST_ID/like?emoji=%F0%9F%91%8D" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"emoji":""}'
# 오류: 댓글 공감과 달리 추가 키는 400 INVALID_PAYLOAD
curl -sS -i -X POST "$S/posts/$POST_ID/like" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"emoji":"👍","is_liked":true}'
# 오류: emoji 없음은 400 POST_EMOJI_REQUIRED
curl -sS -i -X POST "$S/posts/$POST_ID/like" -H "Authorization: Bearer $BOARD_TOKEN"
```


## GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/likes

### 1. 경로

OperationID: `board-list-post-likes`. [`internal/transport/httpapi/board/routes.go:836`](../../internal/transport/httpapi/board/routes.go#L836)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/likes` — `internal/transport/httpapi/testdata/routes.txt:27`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 게시글 UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/postsignalbody.go:113`

### 3. Query

`emoji`: **필수** string, 기본값 없음, 길이 >=1, 최대 길이/enum 없음. 누락/빈 값은 400 INVALID_PAYLOAD; 17자 이상도 허용되어 보통 빈 목록이다. trim하지 않아 공백도 조회 문자열이다. `take`: 선택 integer 기본20, `page`: 선택 integer 기본1, 둘 다 >=1/상한 없음; 파싱/잘못된 값은 공통 페이지 규칙. 배열 표기 없음, 미등록 query 무시. `internal/transport/httpapi/board/postsignalbody.go:182`

### 4. Body

없음. body 필드/추가 키 계약 없음.

### 5. 인증·권한

공통 인증/scope/schema → 회사 내 live ACT/HIDE 글+살아 있는 board 없으면 404 → Read=false 403 → 작업. 작성자의 SAVE/SCHEDULED/휴지통 예외 없음. is_allow_comment는 판정에 쓰지 않는다. 404는 없음/다른 회사/부적격 상태를 합치지만 권한 부족 403은 별개라 유효 대상 존재를 구별할 수 있다. `internal/domain/board/postsignalquery.go:100`

### 6. Response

200: [ParticipantPage](#participantpage), data는 [LikerView](#likerview) 배열. 400 INVALID_PAYLOAD, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 500 INTERNAL_ERROR, 503 SERVICE_UNAVAILABLE. `internal/transport/httpapi/board/postsignal.go:176`

### 7. 주의사항

현재 살아 있는 해당 emoji 공감만 created_at ASC,user_id ASC. 사용자 관계 null이어도 공감 row는 남는다. data/count 별도 조회라 동시 토글 중 스냅샷은 다를 수 있다. 한 사용자가 다른 emoji에도 공감해도 이 emoji의 total에 중복되지 않는다. 열람/알림 부수효과 없음. `internal/domain/board/postsignalquery.go:387` `internal/domain/board/postsignal.go:329`

### 8. 시나리오

```sh
# 정상: 글의 해당 emoji 공감자 페이지
curl -sS -i -G "$S/posts/$POST_ID/likes" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'emoji=👍' --data-urlencode 'page=1'
# 정상 경계: 17자 emoji도 조회에서는 200 빈 목록
curl -sS -i -G "$S/posts/$POST_ID/likes" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'emoji=abcdefghijklmnopq'
# 오류: take=0은 400 INVALID_PAYLOAD
curl -sS -i -G "$S/posts/$POST_ID/likes" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'emoji=👍' --data-urlencode 'take=0'
```


## GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/views

### 1. 경로

OperationID: `board-list-post-viewers`. [`internal/transport/httpapi/board/routes.go:789`](../../internal/transport/httpapi/board/routes.go#L789)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/views` — `internal/transport/httpapi/testdata/routes.txt:28`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 게시글 UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/postsignalbody.go:113`

### 3. Query

`take`: 선택 integer 기본20; `page`: 선택 integer 기본1. 둘 다 >=1/상한 없음, 숫자 아님/범위 초과/0/음수는 400 INVALID_PAYLOAD, 큰 page는 빈 페이지. 배열·enum·boolean 없음, 미등록 query 무시. `internal/transport/httpapi/board/postsignalbody.go:113`

### 4. Body

없음. body 필드/추가 키 계약 없음.

### 5. 인증·권한

공통 인증/scope/schema → 회사 내 live ACT/HIDE 글+살아 있는 board 없으면 404 → Read=false 403 → 작업. 작성자의 SAVE/SCHEDULED/휴지통 예외 없음. is_allow_comment는 판정에 쓰지 않는다. 404는 없음/다른 회사/부적격 상태를 합치지만 권한 부족 403은 별개라 유효 대상 존재를 구별할 수 있다. `internal/domain/board/postsignalquery.go:100`

### 6. Response

200: [ParticipantPage](#participantpage), data는 [PostViewerView](#postviewerview) 배열. 400 INVALID_PAYLOAD, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 500 INTERNAL_ERROR, 503 SERVICE_UNAVAILABLE. `internal/transport/httpapi/board/postsignal.go:94`

### 7. 주의사항

사용자별 GROUP BY로 최신 열람시각/횟수를 집계하며 latest DESC,user_id ASC. total은 DISTINCT user_id 수, data.view_count 합계와 의미가 다르다. 이 GET 자체는 열람을 추가하지 않는다. 실제 읽음 증가는 상세 GET 또는 [POST post-views](06-post-write.md)로 수행한다. 사용자 관계는 LEFT JOIN이라 null 가능; data/count 별도 query라 동시 열람 중 차이가 가능하다. `internal/domain/board/postsignalquery.go:238` `internal/domain/board/postsignalquery.go:264`

### 8. 시나리오

```sh
# 정상: 열람자 20명 페이지(조회만으로 조회수 증가 없음)
curl -sS -i "$S/posts/$POST_ID/views" -H "Authorization: Bearer $BOARD_TOKEN"
# 정상 경계: 큰 페이지는 빈 data, last_page/total은 실제 전체를 표시
curl -sS -i "$S/posts/$POST_ID/views?page=1000000000&take=1" -H "Authorization: Bearer $BOARD_TOKEN"
# 오류: page=0은 400 INVALID_PAYLOAD
curl -sS -i "$S/posts/$POST_ID/views?page=0" -H "Authorization: Bearer $BOARD_TOKEN"
```

