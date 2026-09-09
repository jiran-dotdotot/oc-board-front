# 06. 게시글 작성·수정·삭제·복원·읽음·북마크·공지

등록 엔드포인트 **9개**. [목록·상세와 공통 조회 DTO](05-post-read.md), [댓글·공감](07-post-comment-like.md), [게시판 권한 전문](04-board.md).

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

1. 작성/수정은 HTML을 sanitize하지 않는다. 저장 평문은 정규식 `<[^>]*>`로 태그를 지운 값이다. 프론트에서 HTML을 렌더링할 때 이를 신뢰 가능한 HTML이라는 뜻으로 해석하면 안 된다. 제목/본문 길이 정책 상한도 없다. `internal/domain/board/postwrite.go:273`, `internal/domain/board/postwritequery.go:87`
2. 글 수정은 **작성자 전용**이다. 관리자에게 다른 사람의 수정 권한을 주지 않는다. 이동은 원래 상태가 SAVE인 글에만 적용하지만, 다른 상태에 `board_id`를 보내도 먼저 목적지 write 권한을 검사한다. `internal/transport/httpapi/board/postwrite.go:170`, `internal/domain/board/postwrite.go:480`, `internal/domain/board/postwritequery.go:212`
3. 일괄 삭제/복원/영구삭제/읽음은 일부 또는 전부 무시해도 **200**이다. `affected`와 `ignored_ids`를 반드시 확인한다. 삭제는 작성자, 복원은 삭제자, 영구삭제는 작성자를 기준으로 하며 세 작업은 board read 권한을 검사하지 않는다. `internal/domain/board/postwritequery.go:338`, `internal/domain/board/postwritequery.go:366`, `internal/domain/board/postwritequery.go:383`
4. 복원은 글 삭제 당시 같이 삭제된 첨부/뱃지/공감/북마크를 되살리지만, 댓글은 **그 글의 비활성 댓글 전부**를 활성화한다. 글 삭제 전에 따로 삭제한 댓글도 살아날 수 있다. `internal/domain/board/postwritequery.go:480`, `internal/domain/board/postwritequery.go:535`
5. 게시글 `purge`는 즉시 물리 삭제가 아니라 `purged_at`을 찍는다. 등록 scheduler/worker에는 “30일 후 게시글 row 삭제” 작업이 없다. 첨부 worker는 별도로 object와 첨부 row를 지운다. 작성자는 현재 상세 조회에서 purged_at 검사가 없어 영구삭제 표시 글도 조회할 수 있다. `internal/domain/board/postwritequery.go:560`, `internal/domain/board/postdetailquery.go:190`, `internal/transport/scheduler/scheduler.go:38`, `internal/transport/worker/worker.go:148`
6. `is_send_alarm`은 “전송 예정”이 아니라 worker의 신규/수정 템플릿 선택 상태다. HTTP 성공과 알림 성공은 별개이고 응답 직후에는 상태가 늦게 반영된다. `not_send_alarm=true`는 **해당 직접 저장 요청**의 enqueue를 막는다. 예약 발행 worker에는 이 일회성 요청값이 전달되지 않는다. `internal/transport/httpapi/board/postwrite.go:128`, `internal/transport/httpapi/board/postwrite.go:201`, `internal/transport/worker/postpublish.go:75`, `internal/transport/worker/alarmdelivery.go:97`
7. 공지 GET의 `out_posts`는 만료 **또는 아직 시작하지 않은** 공지다. 공지 PUT은 카테고리 관리자만인 사용자에게 403을 주지 않고 무시한 ID를 담아 200을 반환한다. `internal/domain/board/notice.go:206`, `internal/domain/board/notice.go:347`
8. `delete_schedule_at=true`와 effective state=SCHEDULED, 새 schedule 없음 조합은 기존 예약일이 있어도 **400 `POST_SCHEDULE_REQUIRED`**다. 주석의 “예약 상태에서는 무시”만 읽고 구현하지 않는다. `internal/domain/board/postwrite.go:494`

## 공유 요청 계약

### JSON 입력과 불리언

본문은 `Content-Type: application/json`으로 보낸다. 이 경로에는 폼 변환 middleware가 적용되지 않으므로 form-urlencoded/multipart로 대체하면 415다. 대상 route의 별도 MaxBodyBytes 설정은 없고 Huma 기본 본문 한도는 **1 MiB**다. 필드에 “길이 상한 없음”이라고 적힌 것은 이 전체 HTTP 본문 한도와 별개다. `internal/transport/httpapi/router.go:322`, `internal/transport/httpapi/board/routes.go:599`, `go.mod:10`; 라이브러리 `github.com/danielgtaylor/huma/v2@v2.39.0/huma.go:1490`

`legacy.Bool` body 값은 JSON `true,false,0,1,"0","1","true","false",null`을 허용한다. `null`은 미지정처럼 처리한다. `"True"`, `"FALSE"`, `"yes"`, `2`는 schema 400이다(디코더가 더 많은 문자열을 처리할 수 있어도 HTTP 스키마가 먼저 제한). 일반 query boolean 규칙과 다르다. `internal/transport/httpapi/legacy/bool.go:110`, `internal/transport/httpapi/board/postwritebody.go:96`

**선택 body 필드는 JSON null도 실제 HTTP에서 허용한다.** Huma 스키마가 optional pointer를 nullable:false로 표시하더라도 validator는 non-required object property의 null 검증을 건너뛴다. 포인터 string/UUID의 null은 미지정과 같아 생성 기본값/수정 유지로 처리한다. 즉 title을 null로 변경하려는 PUT은 기존 제목을 유지하며 지우려면 빈 문자열을 보낸다. required badge 날짜/end_date의 null은 별도로 400이다. `internal/transport/httpapi/board/postwritebody.go:85`, `internal/transport/httpapi/board/postwritebody.go:175`; 라이브러리 `github.com/danielgtaylor/huma/v2@v2.39.0/schema.go:944`, `github.com/danielgtaylor/huma/v2@v2.39.0/validate.go:855`

### PostBadgeBody

작성/수정 `badges`의 원소. 배열 자체는 선택, 생략/빈 배열이면 작업 없음이며 **최대 1개**다. 알려지지 않은 키와 `type`은 허용하고 버린다. 실제 저장 type은 NOTICE로 고정한다. `internal/transport/httpapi/board/postwritebody.go:120`, `internal/transport/httpapi/board/postwritebody.go:235`, `internal/domain/board/postwritequery.go:300`

| 필드 | 타입 | 필수 | 기본값 | 길이·개수 상한 / 검증 |
| --- | --- | --- | --- | --- |
| start_date | string | 예 | 없음 | 길이 상한 없음; 공통 날짜 파서, 빈 문자열도 zero time으로 통과 |
| end_date | string | 예 | 없음 | 길이 상한 없음; 공통 날짜 파서, end < start는 400 BADGE_PERIOD_INVALID |

키 누락/JSON null/잘못된 타입은 400 `INVALID_PAYLOAD`. `start_date=""`는 year 1 zero time이라 정상 시간으로 보내야 한다. `end_date=""`도 파싱은 통과하지만 start와 비교하여 실패하거나 year 1을 저장한다. 무기한을 표현하려면 명시적인 2999년 종료값을 보낸다. `internal/transport/httpapi/board/dto.go:89`, `internal/transport/httpapi/board/postwritebody.go:511`, `internal/domain/board/postwrite.go:325`, `migrations/board/000001_initial_schema.sql:506`

### BulkIDs

DELETE posts, DELETE posts/purge, POST posts/restore, POST post-views의 공통 대상 전달법이다. query `id`(반복 UUID)와 선택 JSON body `ids`를 **합친 뒤 중복 제거**한다. `ids`는 body를 보냈다면 필수 키이나 최소·최대 개수는 없고 빈 배열/null은 빈 대상으로 처리한다. JSON body 추가 키는 불허(400). query id를 안 보내고 body 자체도 없으면 400; `{"ids":[]}`는 200 affected=0이다. `internal/transport/httpapi/board/postwritebody.go:264`, `internal/transport/httpapi/board/postwrite.go:292`, `internal/domain/board/postwritebulk.go:235`, `internal/transport/httpapi/board/postsignalbody.go:55`

query 배열은 `id=UUID&id=UUID`, `id[]=UUID`, `id[0]=UUID`; 콤마 결합은 하나의 UUID로 검증하므로 400이다. query/body UUID 형식 오류는 400 `INVALID_PAYLOAD`. 미등록 query는 무시한다. **중복 제거 후 UUID byte 순 정렬**되어 ignored_ids가 입력 순서를 보존하지 않는다. `internal/transport/httpapi/middleware/queryarray.go:42`, `internal/domain/board/postwritebulk.go:235`

## 공유 DTO 필드 표

### Huma가 추가하는 공통 필드

아래 표는 업무 DTO 필드다. 실제 최상위 객체는 Huma의 [자동 스키마 필드 규칙](README.md#schema-field)에 따라 다음 메타 필드 및 Link 헤더가 추가될 수 있다. 중첩 관계 객체에는 자동 추가하지 않는다. strict body의 일반 추가 키 불허와 별개로 등록 schema에 추가된 read-only `$schema` 키는 입력에서도 예외적으로 허용/무시한다. `internal/transport/httpapi/routerboard_test.go:161`; 라이브러리 `github.com/danielgtaylor/huma/v2@v2.39.0/transforms.go:82`, `github.com/danielgtaylor/huma/v2@v2.39.0/validate.go:832`

| 공통 필드 | 타입 | null/생략 | 저장/계산 |
| --- | --- | --- | --- |
| $schema | string | null 아님, 조건부 생략 | 계산 · 해당 응답 JSON Schema 경로; 객체/배열·등록 방식 조건은 README 참조 |

지원하지 않는 Accept 값도 기본 JSON 포맷으로 fallback한다. 이 설정에서는 Accept 미지원만으로 406을 반환하지 않는다. [공통 content negotiation](README.md), `internal/transport/httpapi/router.go:354`; 라이브러리 `github.com/danielgtaylor/huma/v2@v2.39.0/api.go:375`, `github.com/danielgtaylor/huma/v2@v2.39.0/defaults.go:79`


### PostWriteBody

작성 201/수정 200의 최상위 객체이며 `data` 봉투나 관계 객체가 없다. 기본 eager load **없음**; 응답 보강을 위한 상세 query는 있지만 user/board/badges/files를 응답에 포함하지 않는다. 아래 필드는 모두 기본 포함된다. `internal/transport/httpapi/board/postwritebody.go:329`, `internal/transport/httpapi/board/postwrite.go:234`, `internal/transport/httpapi/board/postwritebody.go:544`; DB: `migrations/board/000001_initial_schema.sql:425`
| 필드 | 타입 | null | 저장/계산 · 포맷 |
| --- | --- | --- | --- |
| id | UUID string | 아니오 | 저장 · 게시글 ID |
| company_id | int64 | 아니오 | 저장 · 회사 |
| category_id | UUID string | 예 | 계산 · board.category_id; 응답 보강 실패/권한 없음이면 null |
| board_id | UUID string | 아니오 | 저장 |
| user_id | int64 | 예 | 저장 · 작성자 |
| seq | int64 | 아니오 | 저장 · 회사 내 순번 |
| state | string | 아니오 | 저장 · SAVE/ACT/HIDE/SCHEDULED |
| title | string | 예 | 저장 |
| content | string | 아니오 | 저장 · HTML 원문 |
| text_content | string | 아니오 | 계산 후 저장 · 태그 제거 평문 전체 |
| is_allow_comment | boolean | 아니오 | 저장 |
| is_comment_alarm | boolean | 아니오 | 저장 |
| is_send_alarm | boolean | 아니오 | 저장 · worker가 변경 |
| is_notice_alarm | boolean | 아니오 | 저장 · worker가 변경 |
| posted_at | timestamp string | 예 | 저장 · UTC 6자리 |
| schedule_at | timestamp string | 예 | 저장 · UTC 6자리 |
| schedule_at_tz | string | 예 | 계산 · 요청 시간대의 YYYY-MM-DD HH:mm:ss |
| created_at | timestamp string | 아니오 | 저장 · UTC |
| updated_at | timestamp string | 아니오 | 저장 · UTC |
| delete_user_id | int64 | 예 | 계산 · 이 응답은 항상 null |
| deleted_at | timestamp string | 예 | 계산 · 이 응답은 항상 null |
| purged_at | timestamp string | 예 | 계산 · 이 응답은 항상 null |
| is_writable | boolean | 아니오 | 계산 · 항상 true(작성자만 write 성공) |
| is_view | boolean | 아니오 | 계산 · 작성자이므로 보강 성공 시 true, 보강 실패 시 false |
| is_bookmark | boolean | 아니오 | 계산 · 내 미삭제 북마크; 보강 실패 시 false |
| is_like | boolean | 아니오 | 계산 · 내 미삭제 공감; 보강 실패 시 false |
| comment_count | int64 | 아니오 | 계산 · 전체 댓글 수; 보강 실패 시 0 |
| view_count | int64 | 아니오 | 계산 · 열람 이벤트 수; 보강 실패 시 0 |
| like_count | int64 | 아니오 | 계산 · 미삭제 공감 수; 보강 실패 시 0 |

응답 보강 실패는 이미 커밋된 저장을 실패로 바꾸지 않는다. 글을 쓸 수 있지만 읽을 수 없는 권한 조합에서도 기본 보강값으로 성공한다. write 응답을 만들 때는 실제 상세 GET handler를 부르지 않으므로 열람행을 추가하지 않는다. `internal/transport/httpapi/board/postwrite.go:234`

### PostBulkBody

봉투 없이 아래 객체. `ignored_ids=[]`는 null이 아니며, 권한·없음·상태 불일치의 이유는 구분하지 않는다. count는 게시글 수(하위 테이블 행 합계 아님) 또는 읽음 endpoint의 삽입 대상 글 수다. `internal/transport/httpapi/board/postwritebody.go:409`, `internal/transport/httpapi/board/postsignal.go:62`

| 필드 | 타입 | null | 저장/계산 |
| --- | --- | --- | --- |
| affected | int64 | 아니오 | 계산 · 실제 적용된 고유 대상 수 |
| ignored_ids | UUID string[] | 아니오 | 계산 · 거절/미존재/상태 불일치로 적용 안 된 대상 |

### BookmarkToggleBody

`internal/transport/httpapi/board/postsignalbody.go:247`, `internal/domain/board/postsignalquery.go:328`; DB `migrations/board/000001_initial_schema.sql:622`.

| 필드 | 타입 | null | 저장/계산 · 포맷 |
| --- | --- | --- | --- |
| is_bookmarked | boolean | 아니오 | 계산 · 토글 이후 살아 있으면 true |
| deleted_at | timestamp string | 예 | 계산 · 켜짐 null, 꺼짐 요청 now를 UTC 6자리로 표시 |
| user_id | int64 | 아니오 | 저장 · 현재 사용자 |
| post_id | UUID string | 아니오 | 저장 |
| created_at | timestamp string | 아니오 | 저장 · 최초 생성 시각, 재토글해도 유지 |

### NoticePostView / NoticesView

NoticePostView는 [PostView의 전 필드](05-post-read.md#postview)를 포함한다. `text_content`는 이 endpoint에서 **전체 평문**으로 바뀐다. `badges/files/user/board/thumbnail/delete_user`도 같은 기본 관계다. 다음 추가 필드도 기본 포함된다. `internal/transport/httpapi/board/noticebody.go:118`, `internal/domain/board/notice.go:206`

| 추가 필드 | 타입 | null | 저장/계산 · 포맷 |
| --- | --- | --- | --- |
| type | string | 아니오 | 저장 · 해당 live badge의 NOTICE |
| start_date | timestamp string | 아니오 | 저장 · 공지 시작 UTC |
| end_date | timestamp string | 아니오 | 저장 · 공지 종료 UTC |
| is_processing | boolean | 아니오 | 계산 · start <= now <= end |
| company_id | int64 | 아니오 | 저장 |
| content | string | 아니오 | 저장 · 전체 HTML |
| is_allow_comment | boolean | 아니오 | 저장 |
| is_comment_alarm | boolean | 아니오 | 저장 |
| is_send_alarm | boolean | 아니오 | 저장 |
| is_notice_alarm | boolean | 아니오 | 저장 |

NoticesView 필드 `in_posts:NoticePostView[]`(현재 유효), `out_posts:NoticePostView[]`(그 밖)만 있으며 둘 다 non-null 계산 배열이다. 페이지 봉투는 없다. `internal/transport/httpapi/board/noticebody.go:157`

### 도메인 오류 코드

공통 오류에 추가되는 전수 코드다. 저장소 오류는 공통 500/503이다. 상태와 상세 사유는 각 endpoint의 순서를 따른다. `internal/transport/httpapi/board/postwrite.go:117`, `internal/transport/httpapi/board/postwrite.go:182`, `internal/transport/httpapi/board/notice.go:145`

| status | code | 발생 조건 |
| --- | --- | --- |
| 400 | POST_SCHEDULE_REQUIRED | 예약 상태에 유효한 예약 시각 없음/예약 시각 지우기 조합 |
| 400 | BADGE_PERIOD_INVALID | 유효한 날짜를 파싱했지만 허용한 기간 비교에서 end < start |

## 알림·예약·파일 정리의 실제 경계

ACT 직접 저장은 `not_send_alarm`이 거짓일 때 커밋 후 게시글 알림과 공지 알림 작업을 enqueue한다. publish 실패는 로그만 남기고 이미 성공한 write의 HTTP status는 바꾸지 않는다. Redis 미설정 서버는 이 알림 발행 없이 API를 제공할 수 있다. `internal/transport/httpapi/board/postwrite.go:128`, `internal/transport/httpapi/board/postwrite.go:201`, `internal/transport/httpapi/board/handler.go:268`, `internal/app/app.go:142`

게시글 알림 worker는 **소비 시점**의 ACT/살아 있는 게시판/게시판 is_post_alarm을 확인하며 is_send_alarm이 false면 신규, true면 수정 템플릿을 사용하고 전송 후 flag를 바꾼다. 사용자 설정과 대상 선정도 worker 시점이다. company/board 사용자설정의 is_post_alarm과 is_public_post_alarm을 함께 AND하고, 비공개 audience의 부서/멤버 SQL은 read 권한 함수와 완전히 같은 식이 아니다. 알림 수신자를 read 가능한 사용자 목록으로 추정하지 않는다. `internal/transport/worker/alarmdelivery.go:97`, `internal/transport/worker/alarmdelivery.go:497`, `internal/transport/worker/alarmdelivery.go:546`

공지 알림 worker는 ACT, 게시판 is_notice_alarm, 미전송 flag를 보지만 **NOTICE 뱃지 존재/기간을 검사하지 않는다**. 따라서 “공지 PUT 호출 = 알림 발송”, “일반 글 = 공지 알림 없음”으로 구현하면 안 된다. 템플릿이 없거나 JSON 불량이면 skip하고, 언어는 ko 고정이다. webhook HTTP non-2xx라도 네트워크 에러가 없으면 공지 전송 flag를 true로 바꾸는 구현이다. `internal/transport/worker/alarmdelivery.go:167`, `internal/transport/worker/alarmdelivery.go:236`, `internal/transport/worker/alarmdelivery.go:624`

예약 발행은 매분 enqueue되는 worker에서 due SCHEDULED 글을 최대 500개씩 ACT로 바꾸며 posted_at을 실행 now로 설정한다. schedule_at은 남는다. 외부 알림은 그 뒤 enqueue되므로 HTTP 저장 완료 시각/예약 시각/실제 발행 시각은 다를 수 있다. `internal/transport/scheduler/scheduler.go:38`, `internal/domain/board/postpublish.go:58`, `internal/domain/board/postpublish.go:114`, `internal/transport/worker/postpublish.go:75`

첨부 정리는 매일 00:00 UTC에 enqueue된다. `purged_at`이 있거나 soft-delete 7일 경과한 첨부를 최대 500개씩 대상화하여 object 삭제 후 첨부 row를 물리 삭제한다. object 삭제 실패는 row를 남긴다. object 삭제와 DB 판정은 원자적이지 않아 동시 복원과 경쟁하면 row가 복원돼도 object는 사라질 수 있다. `internal/transport/scheduler/scheduler.go:38`, `internal/domain/board/attachmentpurge.go:63`, `internal/domain/board/attachmentpurge.go:118`, `internal/transport/worker/attachmentpurge.go:114`

## 등록 표 밖의 호환 호출

상세 동작/전수는 [README의 숨은 경로](README.md)를 따른다. `POST .../posts/{id}?_method=PUT`은 NoRoute에서 PUT으로 재작성될 수 있다. `_method`는 query 또는 form body에서만 읽고 JSON에서는 읽지 않는다. 폼 재작성에 성공해도 게시글 JSON body 계약으로 자동 변환되지 않아 form/multipart 요청이 성공하는 것은 아니다. `internal/transport/httpapi/legacycompat.go:89`

`DELETE .../posts/{UUID}`는 `DELETE .../posts?id=UUID`로 재작성돼 이 파일의 일괄 삭제 결과/권한을 사용한다. 기존 query에 id를 추가하므로 원래 query 대상도 합쳐진다. 관리자라는 이유로 타인 글을 단건 삭제할 수 있는 별도 gate는 없다. 이 별칭은 등록 엔드포인트 수에 다시 넣지 않는다. `internal/transport/httpapi/legacycompat.go:128`

## POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/posts

### 1. 경로

OperationID: `board-create-post`. [`internal/transport/httpapi/board/routes.go:600`](../../internal/transport/httpapi/board/routes.go#L600)

`POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/posts` — `internal/transport/httpapi/testdata/routes.txt:36`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 게시판 UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/postwritebody.go:56`

### 3. Query

없음. 미등록 query는 처리하지 않는다. `internal/transport/httpapi/board/postwritebody.go:56`

### 4. Body

| 필드 | 타입 | 필수 | 기본값 | 길이·개수 상한/허용값 |
| --- | --- | --- | --- | --- |
| state | string | 아니오 | SAVE | SAVE, ACT, HIDE, SCHEDULED; 빈 문자열/기타 400; null은 SAVE 기본값; 길이 상한은 enum |
| title | string | 아니오 | null | 길이 상한 없음; 빈 문자열 허용; null은 생성 기본값 |
| content | string | 아니오 | 빈 문자열 | 길이 상한 없음; HTML 저장, null은 빈 본문 기본값 |
| is_allow_comment | legacy.Bool | 아니오 | true | 공통 JSON bool 계약 |
| is_comment_alarm | legacy.Bool | 아니오 | true | 공통 JSON bool 계약 |
| not_send_alarm | legacy.Bool | 아니오 | false | 이 요청 enqueue 억제; 저장 필드 아님 |
| schedule_at | string | 아니오 | null | 공통 날짜 파서; 빈 문자열은 예약 없음; 길이 상한 없음 |
| delete_schedule_at | legacy.Bool | 아니오 | false | state가 SCHEDULED가 아니면 입력 schedule을 지움 |
| badges | PostBadgeBody[] | 아니오 | 없음 | 최대 1개; 빈 배열/null은 없음 |

JSON 객체 body는 필수. `{}`도 유효하며 SAVE 빈 글을 만든다. 추가 키는 **허용 후 무시**(예: company_id/user_id/id/files/type). 첨부 업로드는 별도 API를 사용한다. Badges는 [공유 요청](#postbadgebody). `internal/transport/httpapi/board/postwritebody.go:72` `internal/domain/board/postwrite.go:314`

### 5. 인증·권한

공통 인증/scope/schema → 게시판 존재 404 → board Write=false 403 → 날짜 파싱 400 → badges가 있고 CanManage=false 403 → 예약 조건 400 POST_SCHEDULE_REQUIRED → 뱃지 역전 400 BADGE_PERIOD_INVALID → transaction. 글을 쓸 수 없는 호출자는 게시판 없음과 권한 없음의 상태 차이를 알 수 있고, 날짜/뱃지 내용은 그 뒤 검사된다. 게시판 type으로 POST 전용 제한을 추가하지 않는다. `internal/transport/httpapi/board/postwrite.go:87` `internal/domain/board/postwrite.go:314`

### 6. Response

201: [PostWriteBody](#postwritebody). 실패는 400 INVALID_PAYLOAD/POST_SCHEDULE_REQUIRED/BADGE_PERIOD_INVALID, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND 및 공통 408/413/415/500/503. 관계 eager load 없음. `internal/transport/httpapi/board/routes.go:599` `internal/transport/httpapi/board/postwrite.go:117`

### 7. 주의사항

ACT이면 posted_at=now; 나머지는 null. seq는 회사 내 MAX+1이고 유일키 충돌 시 한 번 재시도한다. 동시 생성이 계속 충돌하면 내부 오류일 수 있으며 클라이언트가 seq를 계산하면 안 된다. 생성과 NOTICE badge는 하나의 transaction, 알림은 커밋 뒤다. 게시판 Write gate는 transaction 밖이라 통과 직후 게시판 삭제와 경합하면 삭제된 게시판 아래 글 생성이 성공할 수 있다. `internal/transport/httpapi/board/postwrite.go:93`, `internal/domain/board/postwrite.go:357` 제목/HTML은 별도 XSS 정제 없이 저장한다. `internal/domain/board/postwrite.go:335` `internal/domain/board/postwrite.go:357` `internal/domain/board/postwritequery.go:87`

### 8. 시나리오

```sh
# 정상: 임시저장(빈 객체도 유효)
curl -sS -i -X POST "$S/boards/$BOARD_ID/posts" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"title":"연동 테스트","content":"<p>본문</p>","state":"SAVE"}'
# 정상: boolean은 문자열 "1"도 허용
curl -sS -i -X POST "$S/boards/$BOARD_ID/posts" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"state":"SAVE","is_allow_comment":"1"}'
# 오류: 문자열 "yes"는 400 INVALID_PAYLOAD
curl -sS -i -X POST "$S/boards/$BOARD_ID/posts" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"is_allow_comment":"yes"}'
# 오류: 날짜 없는 예약은 400 POST_SCHEDULE_REQUIRED
curl -sS -i -X POST "$S/boards/$BOARD_ID/posts" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"state":"SCHEDULED"}'
```


## PUT /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}

### 1. 경로

OperationID: `board-update-post`. [`internal/transport/httpapi/board/routes.go:620`](../../internal/transport/httpapi/board/routes.go#L620)

`PUT /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}` — `internal/transport/httpapi/testdata/routes.txt:55`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 게시글 UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/postwritebody.go:56`

### 3. Query

없음. 미등록 query는 처리하지 않는다. `internal/transport/httpapi/board/postwritebody.go:127`

### 4. Body

| 필드 | 타입 | 필수 | 기본값 | 상한/허용값 |
| --- | --- | --- | --- | --- |
| board_id | UUID string | 아니오 | 기존 유지 | 형식 오류 400; null은 유지; 원래 SAVE만 실제 이동 |
| state | string | 아니오 | 기존 유지 | SAVE,ACT,HIDE,SCHEDULED; 기타/빈 문자열 400; null은 유지 |
| title | string | 아니오 | 기존 유지 | 길이 상한 없음; 빈 문자열로 지움, null은 유지 |
| content | string | 아니오 | 기존 유지 | 길이 상한 없음; 빈 문자열로 지움, null은 유지 |
| is_allow_comment | legacy.Bool | 아니오 | 기존 유지 | 공통 JSON bool, null도 유지 |
| is_comment_alarm | legacy.Bool | 아니오 | 기존 유지 | 공통 JSON bool, null도 유지 |
| not_send_alarm | legacy.Bool | 아니오 | false | 이 요청 알림 enqueue 억제 |
| schedule_at | string | 아니오 | 기존 유지 | 공통 날짜 파서; 빈 문자열은 새 값 없음; 길이 상한 없음 |
| delete_schedule_at | legacy.Bool | 아니오 | false | 예약 삭제 플래그; 상태 조합 주의 |
| delete_file_id | UUID string[] | 아니오 | 없음 | 최소/최대 개수 없음; 이 글 live 첨부만 적용 |
| delete_thumbnail_id | UUID string[] | 아니오 | 없음 | 최소/최대 개수 없음; delete_file_id와 합침 |
| delete_badge_id | UUID string[] | 아니오 | 없음 | 최소/최대 개수 없음; 이 글 live badge만 적용 |
| badges | PostBadgeBody[] | 아니오 | 없음 | 최대 1개; NOTICE upsert |

JSON 객체 body 필수, `{}` 허용(updated_at 갱신). 추가 키 **허용 후 무시**. 배열 생략/빈 배열/null은 대상 없음. 날짜/null/불리언은 공통 규칙을 따른다. 첨부 배열 항목 type은 검사하지 않으므로 delete_thumbnail_id에 FILE ID를 보내도 자기 글 첨부이면 지워진다. `internal/transport/httpapi/board/postwritebody.go:160` `internal/domain/board/postwritequery.go:261`

### 5. 인증·권한

공통 인증/scope/schema → board_id가 있으면 목적지 존재 404/Write 403 → 날짜 파싱 400 → badges 기간 역전 400 BADGE_PERIOD_INVALID → 원본 글/게시판 live 회사 범위 조회 404 → 작성자 아니면 403 → 뱃지 추가/삭제 요청 시 CanManage 아니면 403 → 예약 조건 400 POST_SCHEDULE_REQUIRED → 쓰기. 원본 read 권한을 요구하지 않는다. 올바른 목적지/날짜여야 원본 글 없음 여부가 드러나며 관리자라도 타인의 글 수정은 403이다. `internal/transport/httpapi/board/postwrite.go:164` `internal/domain/board/postwrite.go:440`

### 6. Response

200: [PostWriteBody](#postwritebody). 실패는 400 INVALID_PAYLOAD/BADGE_PERIOD_INVALID/POST_SCHEDULE_REQUIRED, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND 및 공통 408/413/415/500/503. 첨부/뱃지 삭제 미적용 ID를 따로 반환하는 필드는 없음. `internal/transport/httpapi/board/postwrite.go:182` `internal/domain/board/postwritequery.go:261`

### 7. 주의사항

원래 SAVE에서만 board_id 이동. ACT로 처음 바뀔 때만 posted_at을 채우고 이미 있던 posted_at은 유지한다. 새 schedule_at은 effective state SAVE/SCHEDULED에서만 저장; ACT/HIDE는 새 날짜를 무시하고 기존 예약값을 남긴다. delete_schedule_at은 non-SCHEDULED에서 지우지만 SCHEDULED에서 새 날짜도 없으면 기존 날짜가 있어도 400이다. 자기 글이 아닌 첨부/뱃지 ID는 조용히 무시하며 같은 transaction으로 soft-delete/upsert한다. 순서는 첨부 삭제 → badge 삭제 → NOTICE upsert다. 같은 요청에 delete_badge_id와 badges를 넣으면 삭제 후 **새 UUID의 살아 있는 NOTICE**가 남는다(이미 soft-delete된 badge row를 되살리는 동작은 아님). badges[].id/type과 text_content는 추가 키로 무시한다. `internal/domain/board/postwrite.go:554`, `internal/domain/board/postwritequery.go:297` ACT 결과면 내용 무변경 요청도 알림 enqueue 가능하다. `internal/domain/board/postwritequery.go:212` `internal/domain/board/postwrite.go:494` `internal/transport/httpapi/board/postwrite.go:201`

### 8. 시나리오

```sh
# 정상: 본인 글의 제목을 빈 문자열로 지움
curl -sS -i -X PUT "$S/posts/$POST_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"title":"","not_send_alarm":true}'
# 정상 경계: null은 생략과 같아 기존 제목 유지(지우기가 아님)
curl -sS -i -X PUT "$S/posts/$POST_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"title":null}'
# 정상: 본인 글을 명시한 날짜의 예약으로 설정
curl -sS -i -X PUT "$S/posts/$POST_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -H 'Time_zone: Asia/Seoul' -d '{"state":"SCHEDULED","schedule_at":"2999-01-01 09:00:00"}'
# 오류: 직전 예약에서 날짜 지우기만 하면 400 POST_SCHEDULE_REQUIRED
curl -sS -i -X PUT "$S/posts/$POST_ID" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"delete_schedule_at":true}'
```


## DELETE /api/v1/board/companies/{company_id}/users/{user_id}/posts

### 1. 경로

OperationID: `board-trash-posts`. [`internal/transport/httpapi/board/routes.go:644`](../../internal/transport/httpapi/board/routes.go#L644)

`DELETE /api/v1/board/companies/{company_id}/users/{user_id}/posts` — `internal/transport/httpapi/testdata/routes.txt:7`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

추가 path 파라미터: 없음.

### 3. Query

`id`: 선택 UUID 배열, 기본 없음, 최소/최대 개수 없음. 반복/[]/숫자 index 표기와 JSON body 합집합은 [BulkIDs](#bulkids). UUID 파싱 오류/콤마 결합은 400 INVALID_PAYLOAD. 미등록 query는 무시한다. `internal/transport/httpapi/board/postwritebody.go:264`

### 4. Body

선택 JSON 객체 `{ "ids": ["UUID"] }`. body를 보내면 ids 키 필수, UUID 배열/null, 기본 없음, 최소/최대 개수 없음. 추가 키 불허. body 없이 query id도 없으면 400, 명시적 빈 ids 배열은 성공하는 no-op이다. [BulkIDs](#bulkids). `internal/transport/httpapi/board/postwritebody.go:284` `internal/transport/httpapi/board/postwrite.go:292`

### 5. 인증·권한

공통 인증/scope/schema → 고유 대상별 회사+작성자+미삭제 검사 → 통과한 대상만 삭제. board 존재/활성/read/manage, 글 state 검사는 없음. 부적격은 ignored_ids로 합쳐져 다른 회사/없음/타인/이미 삭제를 구별할 수 없다. `internal/domain/board/postwritebulk.go:74` `internal/domain/board/postwritequery.go:338`

### 6. Response

200: [PostBulkBody](#postbulkbody), 전부 거절도 200 affected=0. 개별 ID의 403/404/422는 없음. 400 INVALID_PAYLOAD, 401 UNAUTHORIZED, scope 403 FORBIDDEN, 공통 408/413/415/500/503. 한 transaction이므로 DB 오류는 전체 rollback이며 일부 커밋으로 보고하지 않는다. `internal/domain/board/postwritebulk.go:171`

### 7. 주의사항

state는 유지한 채 deleted_at/updated_at/delete_user_id를 기록한다. 첨부/뱃지/공감/댓글 공감/북마크 soft-delete, 댓글 inactive 처리를 같은 transaction에서 한다. 열람 이벤트는 지우지 않는다. 목록은 deleted_at으로 DEL을 표시하므로 저장 state=DEL로 보내는 기능이 아니다. 알림 enqueue 없음. `internal/domain/board/postwritequery.go:436`

### 8. 시나리오

```sh
# 정상: 본인 글을 휴지통으로(실제 삭제 상태 변경)
curl -sS -i -X DELETE "$S/posts" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d "{\"ids\":[\"$POST_ID\"]}"
# 정상 경계: 같은 호출을 반복하면 affected=0, ignored_ids에 해당 글
curl -sS -i -X DELETE "$S/posts" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d "{\"ids\":[\"$POST_ID\"]}"
# 오류: 대상 없는 무본문은 400 INVALID_PAYLOAD
curl -sS -i -X DELETE "$S/posts" -H "Authorization: Bearer $BOARD_TOKEN"
```


## DELETE /api/v1/board/companies/{company_id}/users/{user_id}/posts/purge

### 1. 경로

OperationID: `board-purge-posts`. [`internal/transport/httpapi/board/routes.go:661`](../../internal/transport/httpapi/board/routes.go#L661)

`DELETE /api/v1/board/companies/{company_id}/users/{user_id}/posts/purge` — `internal/transport/httpapi/testdata/routes.txt:8`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

추가 path 파라미터: 없음.

### 3. Query

`id`: 선택 UUID 배열, 기본 없음, 최소/최대 개수 없음. 반복/[]/숫자 index 표기와 JSON body 합집합은 [BulkIDs](#bulkids). UUID 파싱 오류/콤마 결합은 400 INVALID_PAYLOAD. 미등록 query는 무시한다. `internal/transport/httpapi/board/postwritebody.go:264`

### 4. Body

선택 JSON 객체 `{ "ids": ["UUID"] }`. body를 보내면 ids 키 필수, UUID 배열/null, 기본 없음, 최소/최대 개수 없음. 추가 키 불허. body 없이 query id도 없으면 400, 명시적 빈 ids 배열은 성공하는 no-op이다. [BulkIDs](#bulkids). `internal/transport/httpapi/board/postwritebody.go:284` `internal/transport/httpapi/board/postwrite.go:292`

### 5. 인증·권한

공통 인증/scope/schema → 회사+작성자+삭제됨+아직 purged 아님인 대상만 허용. 관리자라는 이유로 타인 글을 purge할 수 없다. board read/존재 검사는 없음. live 글/타인/다른 회사/없음/이미 purge는 모두 ignored_ids이며 존재 이유는 드러내지 않는다. `internal/domain/board/postwritebulk.go:127` `internal/domain/board/postwritequery.go:383`

### 6. Response

200: [PostBulkBody](#postbulkbody), 전부 거절도 200 affected=0. 개별 ID의 403/404/422는 없음. 400 INVALID_PAYLOAD, 401 UNAUTHORIZED, scope 403 FORBIDDEN, 공통 408/413/415/500/503. 한 transaction이므로 DB 오류는 전체 rollback이며 일부 커밋으로 보고하지 않는다. `internal/domain/board/postwritebulk.go:171`

### 7. 주의사항

purged_at/updated_at을 찍고 그 글의 첨부 전부에도 purged_at을 찍는다(글 삭제 전에 따로 지운 첨부 포함). 첨부 deleted_at이 없으면 now로 채우고 있으면 보존한다. purged_at 컬럼 없는 나머지 자식 테이블은 이 단계에서 갱신하지 않는다. `internal/domain/board/postwritequery.go:581` 즉시 S3 삭제/게시글 row 물리 삭제를 수행하지 않는다. 일반 복원/휴지통 목록에서는 제외되지만 현재 상세는 작성자 가시성 분기에서 purged_at을 검사하지 않는다. 첨부는 별도 일일 worker 대상이며 되돌릴 수 없는 object 삭제로 이어진다. `internal/domain/board/postwritequery.go:560` `internal/domain/board/postdetailquery.go:190` `internal/domain/board/attachmentpurge.go:118`

### 8. 시나리오

```sh
# 정상: 이미 휴지통에 있는 본인 테스트 글만 대상으로 실행
curl -sS -i -X DELETE "$S/posts/purge" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d "{\"ids\":[\"$POST_ID\"]}"
# 정상 경계: 이미 purge된 같은 글은 200, affected=0
curl -sS -i -X DELETE "$S/posts/purge" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d "{\"ids\":[\"$POST_ID\"]}"
# 오류: body를 보냈지만 ids가 없으면 400 INVALID_PAYLOAD
curl -sS -i -X DELETE "$S/posts/purge" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{}'
```


## POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/restore

### 1. 경로

OperationID: `board-restore-posts`. [`internal/transport/httpapi/board/routes.go:678`](../../internal/transport/httpapi/board/routes.go#L678)

`POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/restore` — `internal/transport/httpapi/testdata/routes.txt:46`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

추가 path 파라미터: 없음.

### 3. Query

`id`: 선택 UUID 배열, 기본 없음, 최소/최대 개수 없음. 반복/[]/숫자 index 표기와 JSON body 합집합은 [BulkIDs](#bulkids). UUID 파싱 오류/콤마 결합은 400 INVALID_PAYLOAD. 미등록 query는 무시한다. `internal/transport/httpapi/board/postwritebody.go:264`

### 4. Body

선택 JSON 객체 `{ "ids": ["UUID"] }`. body를 보내면 ids 키 필수, UUID 배열/null, 기본 없음, 최소/최대 개수 없음. 추가 키 불허. body 없이 query id도 없으면 400, 명시적 빈 ids 배열은 성공하는 no-op이다. [BulkIDs](#bulkids). `internal/transport/httpapi/board/postwritebody.go:284` `internal/transport/httpapi/board/postwrite.go:292`

### 5. 인증·권한

공통 인증/scope/schema → 회사+delete_user_id가 요청자+삭제됨+purged 아님인 대상만 허용. 작성자와 삭제자는 다른 개념이다. board read/존재 검사 없음. live/다른 삭제자/다른 회사/없음/purged는 ignored_ids로 합친다. `internal/domain/board/postwritebulk.go:102` `internal/domain/board/postwritequery.go:366`

### 6. Response

200: [PostBulkBody](#postbulkbody), 전부 거절도 200 affected=0. 개별 ID의 403/404/422는 없음. 400 INVALID_PAYLOAD, 401 UNAUTHORIZED, scope 403 FORBIDDEN, 공통 408/413/415/500/503. 한 transaction이므로 DB 오류는 전체 rollback이며 일부 커밋으로 보고하지 않는다. `internal/domain/board/postwritebulk.go:171`

### 7. 주의사항

삭제 marker와 삭제자를 지우며 이전 저장 state를 유지한다. 첨부/뱃지/공감/북마크는 글 삭제 timestamp와 같은 삭제분만 복원하고 purged 첨부는 제외한다. 댓글은 기존 개별 삭제분까지 전부 active로 복원하는 예외다. 삭제된 게시판 아래 글도 복원 성공할 수 있지만 목록에 다시 보인다는 보장은 없다. 알림 enqueue 없음. `internal/domain/board/postwritequery.go:480` `internal/domain/board/postwritequery.go:535`

### 8. 시나리오

```sh
# 정상: 내가 휴지통으로 보낸 아직 purge하지 않은 글 복원
curl -sS -i -X POST "$S/posts/restore" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d "{\"ids\":[\"$POST_ID\"]}"
# 정상 경계: 이미 복원된 글은 200 affected=0, ignored_ids에 들어감
curl -sS -i -X POST "$S/posts/restore" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d "{\"ids\":[\"$POST_ID\"]}"
# 오류: 잘못된 UUID는 부분 무시가 아니라 전체 400
curl -sS -i -X POST "$S/posts/restore" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"ids":["not-a-uuid"]}'
```


## POST /api/v1/board/companies/{company_id}/users/{user_id}/post-views

### 1. 경로

OperationID: `board-mark-posts-read`. [`internal/transport/httpapi/board/routes.go:773`](../../internal/transport/httpapi/board/routes.go#L773)

`POST /api/v1/board/companies/{company_id}/users/{user_id}/post-views` — `internal/transport/httpapi/testdata/routes.txt:42`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

추가 path 파라미터: 없음.

### 3. Query

`id`: 선택 UUID 배열, 기본 없음, 최소/최대 개수 없음. 반복/[]/숫자 index 표기와 JSON body 합집합은 [BulkIDs](#bulkids). UUID 파싱 오류/콤마 결합은 400 INVALID_PAYLOAD. 미등록 query는 무시한다. `internal/transport/httpapi/board/postsignalbody.go:55`

### 4. Body

선택 JSON 객체 `{ "ids": ["UUID"] }`. body를 보내면 ids 키 필수, UUID 배열/null, 기본 없음, 최소/최대 개수 없음. 추가 키 불허. body 없이 query id도 없으면 400, 명시적 빈 ids 배열은 성공하는 no-op이다. [BulkIDs](#bulkids). `internal/transport/httpapi/board/postwritebody.go:284` `internal/transport/httpapi/board/postwrite.go:292`

### 5. 인증·권한

공통 인증/scope/schema → ACT·미삭제·살아 있는 게시판·회사 범위 대상 → 각 게시판 Read 판정 → 통과 ID에 열람행 삽입. 거절 대상은 ignored_ids이며 이유/존재를 구별하지 않는다. HIDE는 상세 GET이 가능한 권한이어도 이 일괄 읽음 대상에는 안 들어간다. `internal/domain/board/postsignal.go:107` `internal/domain/board/postsignalquery.go:149`

### 6. Response

200: [PostBulkBody](#postbulkbody), 전부 거절도 200 affected=0. 개별 ID의 403/404/422는 없음. 400 INVALID_PAYLOAD, 401 UNAUTHORIZED, scope 403 FORBIDDEN, 공통 408/413/415/500/503. 한 transaction이므로 DB 오류는 전체 rollback이며 일부 커밋으로 보고하지 않는다. `internal/domain/board/postwritebulk.go:171`

### 7. 주의사항

이미 읽었어도 호출마다 새 열람행을 추가한다. 한 요청 안의 중복 ID만 제거하므로 idempotent 읽음 flag API가 아니다. count는 사용자 수가 아니라 이벤트 수다. 목록에서 본인 글의 is_view=true여도 이 endpoint는 이벤트를 더할 수 있다. 알림 없음. `internal/domain/board/postsignalquery.go:193` `internal/domain/board/postlistquery.go:205`

### 8. 시나리오

```sh
# 정상: 읽을 수 있는 ACT 글에 열람 이벤트 1개
curl -sS -i -X POST "$S/post-views" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d "{\"ids\":[\"$POST_ID\"]}"
# 정상 경계: 같은 ID 2개를 한 요청에 보내면 중복 제거 후 1개 추가
curl -sS -i -X POST "$S/post-views" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d "{\"ids\":[\"$POST_ID\",\"$POST_ID\"]}"
# 오류: query의 쉼표 배열은 400 INVALID_PAYLOAD
curl -sS -i -X POST "$S/post-views?id=$POST_ID,$POST_ID" -H "Authorization: Bearer $BOARD_TOKEN"
```


## POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/bookmark

### 1. 경로

OperationID: `board-toggle-post-bookmark`. [`internal/transport/httpapi/board/routes.go:806`](../../internal/transport/httpapi/board/routes.go#L806)

`POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/bookmark` — `internal/transport/httpapi/testdata/routes.txt:43`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 게시글 UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/postsignalbody.go:113`

### 3. Query

없음. `internal/transport/httpapi/board/postsignalbody.go:209`

### 4. Body

없음. 본문/필드/추가 키 계약 없음. `internal/transport/httpapi/board/postsignalbody.go:209`

### 5. 인증·권한

공통 인증/scope/UUID → 회사 내 미삭제 ACT/HIDE 글+살아 있는 게시판 없으면 404 → Read=false면 403 → 내 북마크 토글. 작성자 예외 없음. SAVE/SCHEDULED/삭제는 작성자여도 404. 권한 없는 독자는 유효 대상의 403과 부적격 대상의 404를 구별할 수 있다. `internal/domain/board/postsignalquery.go:100` `internal/domain/board/postsignal.go:240`

### 6. Response

200: [BookmarkToggleBody](#bookmarktogglebody). 400 INVALID_PAYLOAD, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 500 INTERNAL_ERROR, 503 SERVICE_UNAVAILABLE. `internal/transport/httpapi/board/postsignal.go:113`

### 7. 주의사항

현재 상태를 반전하므로 재시도하면 다시 꺼지거나 켜진다. 중복 클릭 방지/네트워크 재시도는 목록·상세 is_bookmark를 재조회해 결정한다. SQL upsert가 상태를 원자적으로 반전하며 최초 created_at은 유지한다. bookmark에는 updated_at 컬럼/응답 키가 없고 gate와 upsert는 같은 transaction이다. `migrations/board/000001_initial_schema.sql:615`, `internal/domain/board/postsignal.go:231` 알림/열람 처리 없음. `internal/domain/board/postsignalquery.go:328`

### 8. 시나리오

```sh
# 정상: 현재 상태 반전; 응답 is_bookmarked를 적용
curl -sS -i -X POST "$S/posts/$POST_ID/bookmark" -H "Authorization: Bearer $BOARD_TOKEN"
# 경계: 같은 요청 한 번 더는 같은 결과가 아니라 다시 반전
curl -sS -i -X POST "$S/posts/$POST_ID/bookmark" -H "Authorization: Bearer $BOARD_TOKEN"
# 오류: UUID 형식 오류 400 INVALID_PAYLOAD
curl -sS -i -X POST "$S/posts/not-a-uuid/bookmark" -H "Authorization: Bearer $BOARD_TOKEN"
```


## GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/notices

### 1. 경로

OperationID: `board-list-board-notices`. [`internal/transport/httpapi/board/routes.go:854`](../../internal/transport/httpapi/board/routes.go#L854)

`GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/notices` — `internal/transport/httpapi/testdata/routes.txt:13`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 게시판 UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/noticebody.go:79`

### 3. Query

`type`: 선택 string 배열, 기본 `["NOTICE"]`; enum/문자열 길이/배열 개수 상한 없음. 반복키 `type=NOTICE&type=X`, []/숫자 index 지원. 쉼표는 한 문자열이며 unknown type은 400 대신 결과 없음. 페이징/take/limit 파라미터 없음; 미등록 query는 무시한다. `internal/transport/httpapi/board/noticebody.go:79` `internal/domain/board/notice.go:121`

### 4. Body

없음. 본문/필드/추가 키 계약 없음.

### 5. 인증·권한

공통 인증/scope/UUID → boardDetailRead 존재 404 → Read=false 403 → 조회. 일반 독자는 live ACT만, CanManage(회사/카테고리/게시판 관리자)는 live SAVE/HIDE/SCHEDULED도 포함한다. 관리 가능하다는 것만으로 Read 단계를 건너뛰지는 않는다. 권한 없는 호출자는 403과 404를 구별할 수 있다. `internal/domain/board/notice.go:115` `internal/domain/board/noticequery.go:127`

### 6. Response

200: [NoticesView](#noticepostview--noticesview), in_posts/out_posts 둘 다 배열. 실패 400 INVALID_PAYLOAD, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 500 INTERNAL_ERROR, 503 SERVICE_UNAVAILABLE. `internal/transport/httpapi/board/notice.go:87`

### 7. 주의사항

미삭제 뱃지는 기간을 걸러내지 않는다. start_date DESC/id 순으로 읽은 다음 inclusive 기간 조건으로 둘로 나눈다. text_content와 content는 전체이며 열람행/검색이력/알림 부수효과 없음. 숫자가 많은 경우 페이지 없이 모두 반환한다. `internal/domain/board/noticequery.go:127` `internal/domain/board/notice.go:206`

### 8. 시나리오

```sh
# 정상: NOTICE 기본값, in_posts/out_posts 객체
curl -sS -i "$S/boards/$BOARD_ID/notices" -H "Authorization: Bearer $BOARD_TOKEN"
# 정상 경계: 알 수 없는 type은 검증 오류가 아니라 두 빈 배열
curl -sS -i -G "$S/boards/$BOARD_ID/notices" -H "Authorization: Bearer $BOARD_TOKEN" --data-urlencode 'type=UNKNOWN'
# 오류: 잘못된 게시판 UUID는 400 INVALID_PAYLOAD
curl -sS -i "$S/boards/not-a-uuid/notices" -H "Authorization: Bearer $BOARD_TOKEN"
```


## PUT /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/notices

### 1. 경로

OperationID: `board-set-board-notices`. [`internal/transport/httpapi/board/routes.go:871`](../../internal/transport/httpapi/board/routes.go#L871)

`PUT /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/notices` — `internal/transport/httpapi/testdata/routes.txt:49`.

### 2. Path

`company_id`, `user_id`: int64의 정규 10진 문자열. 토큰 값과 문자열까지 같아야 하며 `01`, `+1`, 다른 회사/유저, principal 누락은 **403 `FORBIDDEN`**. `internal/transport/httpapi/middleware/auth.go:212`

`id`: 게시판 UUID. 형식 오류는 **400 `INVALID_PAYLOAD`**; 형식은 맞으나 대상이 없을 때의 처리는 인증·권한 절을 따른다. `internal/transport/httpapi/board/noticebody.go:79`

### 3. Query

없음. type은 query로 받지 않는다. `internal/transport/httpapi/board/noticebody.go:165`

### 4. Body

| 필드 | 타입 | 필수 | 기본값 | 상한/검증 |
| --- | --- | --- | --- | --- |
| ids | UUID string[] | 아니오 | 없음 | 최소/최대 개수 없음; post PK |
| badge_id | UUID string[] | 아니오 | 없음 | 최소/최대 개수 없음; post_badges PK, ids와 합집합 |
| start_date | string | 아니오 | 기존 시작 유지; 신규는 now | 길이 상한 없음; 날짜 파서, null은 생략 |
| end_date | string | 예 | 없음 | 길이 상한 없음; 날짜 파서, 빈 문자열도 year 1 통과 |

JSON body 필수. 추가 키 허용 후 무시(type 포함). ids/badge_id 둘 다 생략 또는 빈 배열/null이면 대상 없음. 날짜는 공통 Time_zone 규칙; end_date 키 누락/null은 400. `internal/transport/httpapi/board/noticebody.go:206`

### 5. 인증·권한

공통 인증/scope/schema → 날짜 파싱 400 → 회사 내 live board 없으면 404 → 회사 관리자/게시판 관리자 아니면 **200 no-op**(카테고리 관리자만도 해당) → 회사 관리자에게 명시 start가 있을 때만 역전 400 BADGE_PERIOD_INVALID → 회사·게시판 내 live target 선택/합집합 → upsert. Read 게이트 없음. 비관리자는 board 존재 여부를 200/404로 구별할 수 있지만 대상 post의 적격성은 검사하기 전에 돌려보낸다. `internal/transport/httpapi/board/notice.go:142` `internal/domain/board/notice.go:309`

### 6. Response

200: [PostBulkBody](#postbulkbody). ignored_ids는 **요청 ids의 미적용 post ID만**, 없는/다른 게시판 badge_id는 별도 목록 없이 무시한다. 400 INVALID_PAYLOAD/BADGE_PERIOD_INVALID, 401 UNAUTHORIZED, scope 403 FORBIDDEN, 404 NOT_FOUND 및 공통 408/413/415/500/503. 역할 부족 자체는 403이 아니다. `internal/domain/board/notice.go:347` `internal/domain/board/notice.go:382`

### 7. 주의사항

신규 badge 시작은 supplied start 또는 now를 end 이하로 clamp한다. 기존 badge 시작은 보통 LEAST(기존 start,end)로 유지/당기며, 회사 관리자가 start를 명시한 경우에만 명시값으로 덮는다. **게시판 관리자도 새 badge 삽입에는 supplied start가 적용**되므로 “관리자는 start 완전 무시”로 단순화할 수 없다. 모든 live state 대상; 요청당 개수 제한 없음. 해제는 end_date를 현재/과거로 변경(끝시각 포함); 물리/soft-delete는 아님. 이 endpoint는 알림을 enqueue하지 않는다. 이미 soft-delete된 badge는 재활성하지 않고 새 UUID로 삽입하며, affected는 upsert된 badge 수다. 다른 해제 방식인 글 수정 delete_badge_id는 기간 만료가 아닌 soft-delete다. `internal/domain/board/noticequery.go:416`, `internal/domain/board/notice.go:387` `internal/domain/board/noticequery.go:354` `internal/domain/board/notice.go:356`

### 8. 시나리오

```sh
# 정상: 회사/게시판 관리자가 글 하나를 무기한 공지로 지정
curl -sS -i -X PUT "$S/boards/$BOARD_ID/notices" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -H 'Time_zone: Asia/Seoul' -d "{\"ids\":[\"$POST_ID\"],\"end_date\":\"2999-12-31 23:59:59\"}"
# 정상 경계: 대상 없음은 200 affected=0
curl -sS -i -X PUT "$S/boards/$BOARD_ID/notices" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"ids":[],"end_date":"2999-12-31T23:59:59Z"}'
# 오류: end_date 키 누락은 400 INVALID_PAYLOAD
curl -sS -i -X PUT "$S/boards/$BOARD_ID/notices" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"ids":[]}'
```

