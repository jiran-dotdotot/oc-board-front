# 01. 인증·토큰·유저

## 공통 사항

응답 DTO·에러 봉투에는 [Huma 자동 특수필드](README.md#schema-field)를 함께 적용한다. 등록된 최상위 struct 응답에만 `$schema:string`(null 불가, 계산된 URL)와 `Link`가 추가되며 배열·map·빈Body·gin 직접응답에는 없다. 아래 업무 필드 표에 반복하지 않는다. 입력의 추가 키 불허도 framework의 readonly `$schema` 특수키는 예외다. [Huma transforms.go:157](https://github.com/danielgtaylor/huma/blob/v2.39.0/transforms.go#L157)

이 파일의 공통 오류표에406이 열거되어도 현재 router의 기본 format fallback에서는 미지원 Accept가 JSON으로 처리되어 일반적인406 분기가 생기지 않는다. Content-Type 누락·빈값은 JSON 기본이다. [Huma api.go:355](https://github.com/danielgtaylor/huma/blob/v2.39.0/api.go#L355), [defaults.go:79](https://github.com/danielgtaylor/huma/blob/v2.39.0/defaults.go#L79)

이 파일은 등록 엔드포인트 **4개**를 다룬다. `/token`, `/login`, `/refresh`는 헤더 인증 면제이고 본문 자격증명을 검증한다. `/me`는 board 토큰만 받는다. [`internal/transport/httpapi/router.go:440`](../../internal/transport/httpapi/router.go#L440)

본문은 JSON 객체다. credential 문자열은 필수, null·빈 문자열·공백만 있는 값은 400이다. 앞뒤 공백을 trim해서 인증하지 않는다. 필드별 길이 상한은 없음이지만 Huma 전체 Body 한도 1 MiB가 적용된다. 정의되지 않은 본문 키는 거절한다. [`internal/transport/httpapi/board/token.go:37`](../../internal/transport/httpapi/board/token.go#L37) [`internal/transport/httpapi/board/login.go:26`](../../internal/transport/httpapi/board/login.go#L26) [`internal/transport/httpapi/board/refresh.go:33`](../../internal/transport/httpapi/board/refresh.go#L33) [공통 Huma 규칙](README.md#huma-common)

성공 응답은 객체 자체이며 `data`/`result` 봉투는 없다. 에러는 `{"error":{"code":"…","message":"…","details":["…"]}}`; details는 없을 수 있다. [`internal/transport/httpapi/board/dto.go:124`](../../internal/transport/httpapi/board/dto.go#L124) [`internal/transport/httpapi/board/dto.go:270`](../../internal/transport/httpapi/board/dto.go#L270) [`internal/transport/httpapi/humaerr/humaerr.go:18`](../../internal/transport/httpapi/humaerr/humaerr.go#L18)

| HTTP | code | 의미 |
| --- | --- | --- |
| 400 | INVALID_PAYLOAD | 스키마/JSON 불일치, /login 상위 400 |
| 401 | UNAUTHORIZED | board bearer 또는 refresh 거절, /login 상위 401 |
| 403 | FORBIDDEN | 회사 등급/교환 자격/동기화 거절, /login 상위 403 |
| 404 | NOT_FOUND | /me 사용자 없음, /login 내부 사용자 없음 또는 상위 404 |
| 406 | NOT_ACCEPTABLE | 지원하지 않는 Accept |
| 408 | REQUEST_TIMEOUT | 요청 Body 읽기 timeout |
| 413 | REQUEST_ENTITY_TOO_LARGE | Body 크기 초과 |
| 415 | UNSUPPORTED_MEDIA_TYPE | 지원하지 않는 Content-Type |
| 500 | INTERNAL_ERROR | DB·발급 오류 |
| 503 | SERVICE_UNAVAILABLE | 기능 미설정, 네트워크/취소/기한 초과 |

code 매핑은 [`internal/transport/httpapi/humaerr/humaerr.go:188`](../../internal/transport/httpapi/humaerr/humaerr.go#L188). `/login`이 그대로 전달하는 다른 상위 status(예:409/429/500/503)는 `huma.NewError` 기본 분기에 따라 `INTERNAL_ERROR`이며, 로컬이 명시적으로 만든 503만 `SERVICE_UNAVAILABLE`이다. [`internal/transport/httpapi/board/login.go:117`](../../internal/transport/httpapi/board/login.go#L117)

## 공유 DTO 필드 표

<a id="tokenbody"></a>
### TokenBody

| 필드 | 타입 | null | 저장/계산 | 포맷·의미·관계 |
| --- | --- | --- | --- | --- |
| token_type | string | 불가 | 계산 | 항상 `Bearer`; 관계 없음 |
| expires_in | int64(number) | 불가 | 계산 | **access** TTL 초. 설정 기본3600, refresh TTL이 아님 |
| access_token | string | 불가 | 계산 | HS256 JWT, issuer `oc-api-go/board`, sub는 user_id의 문자열, company_id/user_id는 숫자, iat/nbf/exp/jti 포함 |
| refresh_token | string | 불가 | 계산+해시 저장 | 32 random bytes를 padding 없는 base64url로 만든43자 opaque credential; SHA-256만 DB 저장 |

[`internal/transport/httpapi/board/dto.go:291`](../../internal/transport/httpapi/board/dto.go#L291) [`internal/transport/httpapi/board/token.go:187`](../../internal/transport/httpapi/board/token.go#L187) [`internal/transport/httpapi/board/token.go:283`](../../internal/transport/httpapi/board/token.go#L283) [`internal/auth/boardtoken.go:116`](../../internal/auth/boardtoken.go#L116) [`internal/platform/config/config.go:190`](../../internal/platform/config/config.go#L190)

access token 기본1시간, refresh 기본336시간(14일); 운영 설정이 값을 바꿀 수 있다. board 검증은 HS256·issuer·exp를 검증하고 officewave의 5분 leeway를 사용하지 않는다. [`internal/auth/boardtoken.go:146`](../../internal/auth/boardtoken.go#L146) [`internal/platform/config/config.go:190`](../../internal/platform/config/config.go#L190)


refresh 만료는 회전 발급 시각에서 다시 `BOARD_REFRESH_TTL`(기본336시간)을 더하는 슬라이딩 방식이다. 최초 로그인 기준 총 세션 수명 상한은 없다. `expires_in`은 access TTL 초의 소수 부분을 버린 정수이며 refresh 만료시각/TTL 필드는 응답하지 않는다. `internal/transport/httpapi/board/token.go:209`, `internal/platform/config/config.go:175`, `internal/auth/boardtoken.go:137`, `internal/transport/httpapi/board/dto.go:291`

`BOARD_TOKEN_SECRET`이 비면 발급3종은 유효한 Body 이후503, board bearer 경로는401이다. 설정값이 base64로 디코딩되지 않거나 디코딩 secret이32바이트 미만 또는 access TTL<=0이면 API 기동 오류다. `OFFICENEXT_API_URL`, `OFFICENEXT_CLIENT_ID`, `OFFICENEXT_CLIENT_SECRET` 중 하나라도 빈 문자열이면 login만503이다. 설정검사에서 공백을 trim하지 않는다. `internal/app/app.go:259`, `internal/auth/boardtoken.go:96`, `internal/transport/httpapi/board/officenext.go:58`, `internal/platform/config/config.go:214`

<a id="mebody"></a>
### MeBody와 기본 포함 관계

숫자는 JSON number다. `UTC6`은 `YYYY-MM-DDTHH:mm:ss.ffffffZ`, `DATE`는 `YYYY-MM-DD`, `PG9`는 KST 고정 `YYYY-MM-DD HH:mm:ss[.소수최대6자리]+09`다. **`Time_zone` 헤더가 PG9를 바꾸지 않는다.** [`internal/transport/httpapi/board/dto.go:25`](../../internal/transport/httpapi/board/dto.go#L25) [`internal/transport/httpapi/board/me.go:260`](../../internal/transport/httpapi/board/me.go#L260) [`internal/transport/httpapi/board/me.go:287`](../../internal/transport/httpapi/board/me.go#L287)

/me는 사용자→관리자 플래그→기본 member(부서·직급 포함)→회사설정→사용자설정을 각각 읽는다. 관계가 없으면 null이며 생성하지 않는다. 회사ID는 토큰 company_id가 아닌 조회한 `public.users.company_id`다. [`internal/transport/httpapi/board/me.go:32`](../../internal/transport/httpapi/board/me.go#L32) [`internal/domain/board/repository.go:166`](../../internal/domain/board/repository.go#L166) [`internal/domain/board/repository.go:250`](../../internal/domain/board/repository.go#L250)

#### MeBody

| 필드 | JSON 타입 | null | 저장/계산 | 포맷·관계 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `id` | int64(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:138`](../../internal/transport/httpapi/board/dto.go#L138) |
| `company_id` | int64(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:139`](../../internal/transport/httpapi/board/dto.go#L139) |
| `rank_id` | int64(number) | 가능 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:140`](../../internal/transport/httpapi/board/dto.go#L140) |
| `name` | string | 가능 | 계산 | 퇴직/중지 접미사 표시명(아래 규칙) | [`internal/transport/httpapi/board/dto.go:141`](../../internal/transport/httpapi/board/dto.go#L141) |
| `last_name` | string | 가능 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:142`](../../internal/transport/httpapi/board/dto.go#L142) |
| `first_name` | string | 가능 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:143`](../../internal/transport/httpapi/board/dto.go#L143) |
| `account` | string | 불가 | 계산 | 중지 접미사 포함 가능 | [`internal/transport/httpapi/board/dto.go:144`](../../internal/transport/httpapi/board/dto.go#L144) |
| `email` | string | 불가 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:145`](../../internal/transport/httpapi/board/dto.go#L145) |
| `mobile` | string | 가능 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:146`](../../internal/transport/httpapi/board/dto.go#L146) |
| `phone` | string | 가능 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:147`](../../internal/transport/httpapi/board/dto.go#L147) |
| `code` | string | 가능 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:148`](../../internal/transport/httpapi/board/dto.go#L148) |
| `bot` | boolean | 불가 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:149`](../../internal/transport/httpapi/board/dto.go#L149) |
| `status_message` | string | 가능 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:150`](../../internal/transport/httpapi/board/dto.go#L150) |
| `birth_date` | string | 가능 | 저장 | DATE | [`internal/transport/httpapi/board/dto.go:151`](../../internal/transport/httpapi/board/dto.go#L151) |
| `lunar` | boolean | 불가 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:152`](../../internal/transport/httpapi/board/dto.go#L152) |
| `career_month` | integer(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:153`](../../internal/transport/httpapi/board/dto.go#L153) |
| `gender` | string | 가능 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:154`](../../internal/transport/httpapi/board/dto.go#L154) |
| `working_status` | string | 불가 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:155`](../../internal/transport/httpapi/board/dto.go#L155) |
| `status` | integer(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:156`](../../internal/transport/httpapi/board/dto.go#L156) |
| `entry_date_1` | string | 가능 | 저장 | DATE | [`internal/transport/httpapi/board/dto.go:157`](../../internal/transport/httpapi/board/dto.go#L157) |
| `entry_date_2` | string | 가능 | 저장 | DATE | [`internal/transport/httpapi/board/dto.go:158`](../../internal/transport/httpapi/board/dto.go#L158) |
| `quit_date` | string | 가능 | 저장 | DATE | [`internal/transport/httpapi/board/dto.go:159`](../../internal/transport/httpapi/board/dto.go#L159) |
| `password_updated_at` | string | 가능 | 저장 | PG9 | [`internal/transport/httpapi/board/dto.go:160`](../../internal/transport/httpapi/board/dto.go#L160) |
| `fail_count` | integer(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:161`](../../internal/transport/httpapi/board/dto.go#L161) |
| `banned_at` | string | 가능 | 저장 | PG9 | [`internal/transport/httpapi/board/dto.go:162`](../../internal/transport/httpapi/board/dto.go#L162) |
| `last_login_at` | string | 가능 | 저장 | PG9 | [`internal/transport/httpapi/board/dto.go:163`](../../internal/transport/httpapi/board/dto.go#L163) |
| `disabled_at` | string | 가능 | 저장 | PG9 | [`internal/transport/httpapi/board/dto.go:164`](../../internal/transport/httpapi/board/dto.go#L164) |
| `profile_image_id` | string | 가능 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:165`](../../internal/transport/httpapi/board/dto.go#L165) |
| `sync_id` | int64(number) | 가능 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:166`](../../internal/transport/httpapi/board/dto.go#L166) |
| `sync_account` | string | 가능 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:167`](../../internal/transport/httpapi/board/dto.go#L167) |
| `website_url` | string | 가능 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:168`](../../internal/transport/httpapi/board/dto.go#L168) |
| `created_at` | string | 가능 | 저장 | UTC6 | [`internal/transport/httpapi/board/dto.go:169`](../../internal/transport/httpapi/board/dto.go#L169) |
| `updated_at` | string | 가능 | 저장 | UTC6 | [`internal/transport/httpapi/board/dto.go:170`](../../internal/transport/httpapi/board/dto.go#L170) |
| `deleted_at` | string | 가능 | 저장 | PG9 | [`internal/transport/httpapi/board/dto.go:171`](../../internal/transport/httpapi/board/dto.go#L171) |
| `is_admin` | boolean | 불가 | 계산 | 없음 | [`internal/transport/httpapi/board/dto.go:173`](../../internal/transport/httpapi/board/dto.go#L173) |
| `is_category_admin` | boolean | 불가 | 계산 | 없음 | [`internal/transport/httpapi/board/dto.go:174`](../../internal/transport/httpapi/board/dto.go#L174) |
| `is_board_admin` | boolean | 불가 | 계산 | 없음 | [`internal/transport/httpapi/board/dto.go:175`](../../internal/transport/httpapi/board/dto.go#L175) |
| `profile_src` | string | 가능 | 계산 | 이미지 URL, 설정/이미지ID 없음 또는 중지사용자이면 null | [`internal/transport/httpapi/board/dto.go:177`](../../internal/transport/httpapi/board/dto.go#L177) |
| `member` | MemberDTO(object) | 가능 | 조회 관계 | 기본 포함, 없으면 null | [`internal/transport/httpapi/board/dto.go:179`](../../internal/transport/httpapi/board/dto.go#L179) |
| `company_setting` | CompanySettingDTO(object) | 가능 | 조회 관계 | 기본 포함, 없으면 null | [`internal/transport/httpapi/board/dto.go:180`](../../internal/transport/httpapi/board/dto.go#L180) |
| `company_user_setting` | CompanyUserSettingDTO(object) | 가능 | 조회 관계 | 기본 포함, 없으면 null | [`internal/transport/httpapi/board/dto.go:181`](../../internal/transport/httpapi/board/dto.go#L181) |

#### MemberDTO

| 필드 | JSON 타입 | null | 저장/계산 | 포맷·관계 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `id` | int64(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:188`](../../internal/transport/httpapi/board/dto.go#L188) |
| `company_id` | int64(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:189`](../../internal/transport/httpapi/board/dto.go#L189) |
| `department_id` | int64(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:190`](../../internal/transport/httpapi/board/dto.go#L190) |
| `user_id` | int64(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:191`](../../internal/transport/httpapi/board/dto.go#L191) |
| `rank_id` | int64(number) | 가능 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:192`](../../internal/transport/httpapi/board/dto.go#L192) |
| `role_id` | int64(number) | 가능 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:193`](../../internal/transport/httpapi/board/dto.go#L193) |
| `position` | integer(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:194`](../../internal/transport/httpapi/board/dto.go#L194) |
| `default` | boolean | 불가 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:195`](../../internal/transport/httpapi/board/dto.go#L195) |
| `leader` | boolean | 불가 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:196`](../../internal/transport/httpapi/board/dto.go#L196) |
| `disabled_at` | string | 가능 | 저장 | PG9 | [`internal/transport/httpapi/board/dto.go:197`](../../internal/transport/httpapi/board/dto.go#L197) |
| `sync_id` | int64(number) | 가능 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:198`](../../internal/transport/httpapi/board/dto.go#L198) |
| `created_at` | string | 가능 | 저장 | UTC6 | [`internal/transport/httpapi/board/dto.go:199`](../../internal/transport/httpapi/board/dto.go#L199) |
| `updated_at` | string | 가능 | 저장 | UTC6 | [`internal/transport/httpapi/board/dto.go:200`](../../internal/transport/httpapi/board/dto.go#L200) |
| `deleted_at` | string | 가능 | 저장 | UTC6 | [`internal/transport/httpapi/board/dto.go:201`](../../internal/transport/httpapi/board/dto.go#L201) |
| `department` | DepartmentDTO(object) | 가능 | 조회 관계 | 기본 포함, 없으면 null | [`internal/transport/httpapi/board/dto.go:202`](../../internal/transport/httpapi/board/dto.go#L202) |
| `rank` | RankDTO(object) | 가능 | 조회 관계 | 기본 포함, 없으면 null | [`internal/transport/httpapi/board/dto.go:203`](../../internal/transport/httpapi/board/dto.go#L203) |

#### DepartmentDTO

| 필드 | JSON 타입 | null | 저장/계산 | 포맷·관계 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `id` | int64(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:210`](../../internal/transport/httpapi/board/dto.go#L210) |
| `parent_id` | int64(number) | 가능 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:211`](../../internal/transport/httpapi/board/dto.go#L211) |
| `name` | string | 불가 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:212`](../../internal/transport/httpapi/board/dto.go#L212) |
| `path` | string | 가능 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:213`](../../internal/transport/httpapi/board/dto.go#L213) |
| `position` | integer(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:214`](../../internal/transport/httpapi/board/dto.go#L214) |

#### RankDTO

| 필드 | JSON 타입 | null | 저장/계산 | 포맷·관계 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `id` | int64(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:219`](../../internal/transport/httpapi/board/dto.go#L219) |
| `name` | string | 불가 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:220`](../../internal/transport/httpapi/board/dto.go#L220) |

#### CompanySettingDTO

| 필드 | JSON 타입 | null | 저장/계산 | 포맷·관계 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `id` | string | 불가 | 저장 | UUID 문자열 | [`internal/transport/httpapi/board/dto.go:232`](../../internal/transport/httpapi/board/dto.go#L232) |
| `company_id` | int64(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:233`](../../internal/transport/httpapi/board/dto.go#L233) |
| `latest_post_day` | integer(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:234`](../../internal/transport/httpapi/board/dto.go#L234) |
| `latest_post_type` | string | 불가 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:235`](../../internal/transport/httpapi/board/dto.go#L235) |
| `created_at` | string | 불가 | 저장 | UTC6 | [`internal/transport/httpapi/board/dto.go:236`](../../internal/transport/httpapi/board/dto.go#L236) |
| `updated_at` | string | 불가 | 저장 | UTC6 | [`internal/transport/httpapi/board/dto.go:237`](../../internal/transport/httpapi/board/dto.go#L237) |
| `deleted_at` | string | 가능 | 저장 | UTC6 | [`internal/transport/httpapi/board/dto.go:238`](../../internal/transport/httpapi/board/dto.go#L238) |

#### CompanyUserSettingDTO

| 필드 | JSON 타입 | null | 저장/계산 | 포맷·관계 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `company_id` | int64(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:249`](../../internal/transport/httpapi/board/dto.go#L249) |
| `user_id` | int64(number) | 불가 | 저장 | 10진 정수 | [`internal/transport/httpapi/board/dto.go:250`](../../internal/transport/httpapi/board/dto.go#L250) |
| `is_post_alarm` | boolean | 불가 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:251`](../../internal/transport/httpapi/board/dto.go#L251) |
| `is_notice_alarm` | boolean | 불가 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:252`](../../internal/transport/httpapi/board/dto.go#L252) |
| `is_public_post_alarm` | boolean | 불가 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:253`](../../internal/transport/httpapi/board/dto.go#L253) |
| `is_comment_alarm` | boolean | 불가 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:254`](../../internal/transport/httpapi/board/dto.go#L254) |
| `is_like_alarm` | boolean | 불가 | 저장 | 없음 | [`internal/transport/httpapi/board/dto.go:255`](../../internal/transport/httpapi/board/dto.go#L255) |
| `recent_search_keyword` | string[] | 불가 | 저장 | 항상 배열; nil은 []; 저장순서 유지, 자동 reverse 없음 | [`internal/transport/httpapi/board/dto.go:260`](../../internal/transport/httpapi/board/dto.go#L260) |
| `created_at` | string | 불가 | 저장 | UTC6 | [`internal/transport/httpapi/board/dto.go:261`](../../internal/transport/httpapi/board/dto.go#L261) |
| `updated_at` | string | 불가 | 저장 | UTC6 | [`internal/transport/httpapi/board/dto.go:262`](../../internal/transport/httpapi/board/dto.go#L262) |
| `deleted_at` | string | 가능 | 저장 | UTC6 | [`internal/transport/httpapi/board/dto.go:263`](../../internal/transport/httpapi/board/dto.go#L263) |

표 변환의 실행 근거: [`internal/transport/httpapi/board/me.go:97`](../../internal/transport/httpapi/board/me.go#L97) [`internal/transport/httpapi/board/me.go:333`](../../internal/transport/httpapi/board/me.go#L333) [`internal/transport/httpapi/board/me.go:368`](../../internal/transport/httpapi/board/me.go#L368) [`internal/transport/httpapi/board/me.go:383`](../../internal/transport/httpapi/board/me.go#L383). `member.department`는5개필드, `member.rank`는2개필드만 포함하며 role관계는 없다. 기본 member는 삭제되지 않은 default=true 중 가장 작은id, disabled_at 조건은 없다. 부서·직급은 삭제행을 제외한다. [`internal/domain/board/repository.go:198`](../../internal/domain/board/repository.go#L198)

회사설정 DB 기본값은 latest_post_day=30, latest_post_type=BOARD; 허용 latest_post_type은 BOARD/PREVIEW/ALBUM/DRIVE. 사용자 알림5종 기본true, 검색어기본[] 최대8개다. **설정행 자체가 없으면 기본 객체를 만들어 반환하지 않고 null**이다. [`migrations/board/000001_initial_schema.sql:898`](../../migrations/board/000001_initial_schema.sql#L898) [`migrations/board/000001_initial_schema.sql:921`](../../migrations/board/000001_initial_schema.sql#L921) [`internal/domain/board/repository.go:250`](../../internal/domain/board/repository.go#L250)

/me의 company_setting에는 `is_post_alarm`, `is_comment_alarm`, `latest_post_description`, `post_badge_type`, `company_main_boards`가 없다. company_user_setting에는 surrogate id/company_setting_id/is_upload_alarm이 없다. 관리 응답과 같은 DTO로 취급하지 않는다. password도 조회·응답에서 제외한다. [`internal/transport/httpapi/board/dto.go:231`](../../internal/transport/httpapi/board/dto.go#L231) [`internal/transport/httpapi/board/dto.go:248`](../../internal/transport/httpapi/board/dto.go#L248) [`internal/domain/board/repository.go:70`](../../internal/domain/board/repository.go#L70)


### 사용자 저장값과 기본값

아래 값은 SQL COMMENT의 업무 값이다. enum CHECK로 제한하지 않으므로 프론트에서 서버가 이 값만 저장할 수 있다고 가정하지 않는다. /me는 저장값을 반환한다. `internal/transport/httpapi/board/me.go:97`

| 필드 | 저장값·의미 | DB 기본값 | 근거 |
| --- | --- | --- | --- |
| gender | male/female | 없음, nullable | `migrations/officechat/postgres/000001_init_schema.sql:501`, `migrations/officechat/postgres/000001_init_schema.sql:549` |
| working_status | Online 온라인, Task 다른 용무 중, Conference 회의 중, Outside 외근 중, Leave 휴가 중, Home 재택근무 중 | Online | `migrations/officechat/postgres/000001_init_schema.sql:502`, `migrations/officechat/postgres/000001_init_schema.sql:550` |
| status | 0 재직, 1 휴직, 2 육아휴직, 3 퇴사 | 0 | `migrations/officechat/postgres/000001_init_schema.sql:503`, `migrations/officechat/postgres/000001_init_schema.sql:551` |
| career_month | 경력 개월 수 | 0 | `migrations/officechat/postgres/000001_init_schema.sql:500`, `migrations/officechat/postgres/000001_init_schema.sql:548` |
| code | 사원번호 | 없음, nullable | `migrations/officechat/postgres/000001_init_schema.sql:495`, `migrations/officechat/postgres/000001_init_schema.sql:543` |
| entry_date_1 / entry_date_2 | 실제 입사일 / 연차계산용 입사일 | 없음, nullable | `migrations/officechat/postgres/000001_init_schema.sql:552` |

name이 SQL NULL이어도 퇴직/중지 상태이면 null 대신 접미사만 있는 문자열(예:`(퇴직)`)을 반환한다. profile_src는 `{OFFOCEWAVE_SURVEY_HOST}/image/resize/s?image_url={AWS_FOLDER}/user/profile/{profile_image_id}/profile_image.png`를 문자열 결합하며 key를 percent-encode하지 않는다. 관리자 플래그는 /me마다 DB를 조회하고 캐시하지 않는다. `internal/transport/httpapi/board/me.go:172`, `internal/transport/httpapi/board/me.go:323`, `internal/domain/board/repository.go:297`

<a id="admin-sync"></a>
### 토큰 발급 시 관리자 동기화 상태표

public.managers의 동일 회사/유저, access_level=80, deleted_at IS NULL을 최고관리자라고 판정한다. /token·/login·/refresh가 아래 동기화를 사용하며 실패처리는 각 endpoint마다 다르다. `internal/domain/board/adminsync.go:72`

| 최고관리자 | 기존 board.company_admins | 수행 |
| --- | --- | --- |
| 아니오 | 살아 있는 is_manager=true | deleted_at/updated_at=now |
| 아니오 | 행 없음·수동(is_manager=false)·이미 삭제 | 변경 없음 |
| 예 | 행 없음 | is_manager=true INSERT; 동시 삽입은 ON CONFLICT DO NOTHING |
| 예 | 삭제된 행 | deleted_at=null, is_manager=true, updated_at=now |
| 예 | 살아 있는 수동행 | is_manager=true, updated_at=now; created_at 유지 |
| 예 | 살아 있는 동기화행 | 변경 없음 |

수동행도 OfficeWave 최고관리자가 되면 동기화 소유로 바뀌므로, 이후 최고관리자 해제 시 다음 동기화가 회수한다. “수동 추가는 영원히 회수되지 않는다”는 규칙은 아니다. `internal/domain/board/adminsync.go:124`, `internal/domain/board/adminsync.go:163`, `internal/domain/board/adminsync.go:184`, `internal/domain/board/adminsync.go:200`, `internal/domain/board/adminsync.go:213`

## ⚠️ 이 도메인의 함정

- 회사등급은 정확히 대소문자 무시 `OFFICE_FREE`와 비교하며 trim하지 않는다. 모든 free계열 등급을 차단하는 규칙이 아니다. public.companies SQL 기본 `cooperation-free`는 이 문자열과 다르다. [`internal/transport/httpapi/board/token.go:246`](../../internal/transport/httpapi/board/token.go#L246) [`internal/domain/board/entity.go:155`](../../internal/domain/board/entity.go#L155) [`migrations/officechat/postgres/000001_init_schema.sql:150`](../../migrations/officechat/postgres/000001_init_schema.sql#L150)
- `/token`은 토큰 발급 뒤 admin sync실패가403, `/login`은 발급 전 sync실패가500, `/refresh`는 sync실패를 로그만 남기고 발급을 계속한다. 동일 헬퍼라도 실패 계약은 다르다. [`internal/transport/httpapi/board/token.go:174`](../../internal/transport/httpapi/board/token.go#L174)
- refresh는 **소비와 새 발급이 별도 작업**이다. 소비 후403/500 또는 응답유실이면 이전 refresh로 재시도할 수 없다. 탭간 refresh를 직렬화하고401이면 다시 인증한다. family revoke-on-reuse는 구현되어 있지 않다. [`internal/transport/httpapi/board/refresh.go:62`](../../internal/transport/httpapi/board/refresh.go#L62) [`internal/domain/board/refreshtoken.go:118`](../../internal/domain/board/refreshtoken.go#L118) [`internal/transport/httpapi/board/token.go:209`](../../internal/transport/httpapi/board/token.go#L209)
- /me와 sync_id lookup은 퇴직/중지 유저를 차단하지 않는다. sync_id가 중복이면 id가 가장 작은 사용자다. 관리자 플래그는 해당회사 내 살아있는 관리지정이 하나라도 있는지이며 특정게시판 접근 허가가 아니다. [`internal/domain/board/repository.go:87`](../../internal/domain/board/repository.go#L87) [`internal/domain/board/repository.go:115`](../../internal/domain/board/repository.go#L115) [`internal/domain/board/repository.go:297`](../../internal/domain/board/repository.go#L297)
- 표시명은 deleted_at가 있으면 퇴직이 중지보다 우선. Lang가 `ko`/빈값이면 `(퇴직)`/`(중지)`, `ja`면 `(退職)`/`(停止)`, 나머지(ko-KR 포함)는 `(Retired)`/`(Suspended)`. account는 중지만 붙인다. 에러메시지 언어판정과 다르다. [`internal/transport/httpapi/board/me.go:172`](../../internal/transport/httpapi/board/me.go#L172) [`internal/transport/httpapi/board/me.go:201`](../../internal/transport/httpapi/board/me.go#L201) [`internal/transport/httpapi/board/me.go:240`](../../internal/transport/httpapi/board/me.go#L240)

curl의 환경변수는 [README 실행 준비](README.md#curl-setup)를 사용한다. `OFFICEWAVE_TOKEN`과 `BOARD_TOKEN`을 분리한다.

## POST /api/v1/board/token

### 1. 경로

OperationID: `board-exchange-token`. [`internal/transport/httpapi/board/routes.go:40`](../../internal/transport/httpapi/board/routes.go#L40)

OfficeWave member token을 board token으로 교환. [`internal/transport/httpapi/board/routes.go:39`](../../internal/transport/httpapi/board/routes.go#L39)

### 2. Path

없음. [`internal/transport/httpapi/board/token.go:37`](../../internal/transport/httpapi/board/token.go#L37)

### 3. Query

도메인 query 없음. 공통 `lang`은 오류 번역용일 뿐 인증에 사용하지 않는다. [`internal/transport/httpapi/board/token.go:37`](../../internal/transport/httpapi/board/token.go#L37) [`internal/transport/httpapi/humaerr/lang.go:162`](../../internal/transport/httpapi/humaerr/lang.go#L162)

### 4. Body

| 필드 | 타입 | 필수 | 기본·검증·상한 |
| --- | --- | --- | --- |
| token | string | 예 | ES256 OfficeWave member JWT; minLength1, 최소 한 비공백문자 |

모든 필드 기본값 없음, null 불가, 길이 상한 없음, 추가 키 불허. 위 공통 Body 규칙 적용. [`internal/transport/httpapi/board/token.go:37`](../../internal/transport/httpapi/board/token.go#L37)

### 5. 인증·권한

exempt, Authorization 없음. JSON 검증400 → 미설정503 → OfficeWave ES256/exp(5분leeway)/issuer/scopes ROLE_MEMBER 검증 및 숫자 company_id/user_id 추출 실패403 → 회사 없음·삭제·OFFICE_FREE403 → access/refresh 생성 → 최고관리자 동기화 실패403 → refresh저장. 사유별403을 구분할 수 없다. [`internal/transport/httpapi/board/token.go:70`](../../internal/transport/httpapi/board/token.go#L70) [`internal/transport/httpapi/board/token.go:174`](../../internal/transport/httpapi/board/token.go#L174) [`internal/auth/jwt.go:103`](../../internal/auth/jwt.go#L103) [`internal/auth/jwt.go:164`](../../internal/auth/jwt.go#L164)

### 6. Response

| HTTP | 응답 |
| --- | --- |
| 200 | [TokenBody](#tokenbody) |
| 400 | INVALID_PAYLOAD |
| 403 | FORBIDDEN(토큰/등급/동기화 사유 구별 불가) |
| 500 | INTERNAL_ERROR(DB/발급/refresh기록 실패) |
| 503 | SERVICE_UNAVAILABLE |

[`internal/transport/httpapi/board/token.go:70`](../../internal/transport/httpapi/board/token.go#L70) [`internal/transport/httpapi/board/token.go:174`](../../internal/transport/httpapi/board/token.go#L174) 공통 전처리 406/408/413/415와 DB500·취소503은 위 오류표 및 [공통 규약](README.md#huma-common) 참조.

### 7. 주의사항

관리자 동기화는 public.managers access_level=80이며 company_id/user_id 일치·deleted_at IS NULL인 행을 기준으로 한다. 수동 admin은 권한회수 대상과 구별한다. 순수 토큰교환 호출도 DB를 변경한다. [`internal/domain/board/adminsync.go:72`](../../internal/domain/board/adminsync.go#L72) [`internal/domain/board/adminsync.go:124`](../../internal/domain/board/adminsync.go#L124) [`internal/domain/board/entity.go:145`](../../internal/domain/board/entity.go#L145)

### 8. 시나리오

```bash
# 정상: 실제 OfficeWave member token 필요 → 200
jq -n --arg token "$OFFICEWAVE_TOKEN" '{token:$token}' | curl -i "$BASE_URL/api/v1/board/token" -H 'Content-Type: application/json' --data-binary @-
# 비어있음: 검증 단계 400 INVALID_PAYLOAD
curl -i "$BASE_URL/api/v1/board/token" -H 'Content-Type: application/json' -d '{"token":"   "}'
# 형식검증은 통과하지만 서명 검증 실패 → 403 FORBIDDEN(기능이 설정된 서버)
curl -i "$BASE_URL/api/v1/board/token" -H 'Content-Type: application/json' -d '{"token":"invalid.jwt.value"}'
```
[`internal/transport/httpapi/board/contract_test.go:79`](../../internal/transport/httpapi/board/contract_test.go#L79)

## POST /api/v1/board/login

### 1. 경로

OperationID: `board-login`. [`internal/transport/httpapi/board/routes.go:57`](../../internal/transport/httpapi/board/routes.go#L57)

OfficeNext ID/PW로 board token 발급. [`internal/transport/httpapi/board/routes.go:59`](../../internal/transport/httpapi/board/routes.go#L59)

### 2. Path

없음. [`internal/transport/httpapi/board/login.go:26`](../../internal/transport/httpapi/board/login.go#L26)

### 3. Query

도메인 query 없음. 공통 lang만 오류번역에 사용. [`internal/transport/httpapi/board/login.go:26`](../../internal/transport/httpapi/board/login.go#L26)

### 4. Body

| 필드 | 타입 | 필수 | 기본·검증·상한 |
| --- | --- | --- | --- |
| username | string | 예 | minLength1, 비공백문자 포함; 이메일 형식 검증 없음 |
| password | string | 예 | minLength1, 비공백문자 포함 |

모든 필드 기본값 없음, null 불가, 길이 상한 없음, 추가 키 불허. 위 공통 Body 규칙 적용. [`internal/transport/httpapi/board/login.go:26`](../../internal/transport/httpapi/board/login.go#L26)

### 5. 인증·권한

exempt, Authorization 없음. JSON400 → OfficeNext/token설정없음503 → POST upstream /oauth/token(password grant, scope=web) → GET /api/user → 응답id를 local sync_id로 검색(없으면404) → 회사등급403 → admin sync500 → 발급·refresh저장. 상위 인증에 성공한 계정이 로컬에 없는 사실은404로 알 수 있다. [`internal/transport/httpapi/board/login.go:59`](../../internal/transport/httpapi/board/login.go#L59) [`internal/transport/httpapi/board/officenext.go:99`](../../internal/transport/httpapi/board/officenext.go#L99) [`internal/transport/httpapi/board/token.go:174`](../../internal/transport/httpapi/board/token.go#L174)

### 6. Response

| HTTP | 응답 |
| --- | --- |
| 200 | [TokenBody](#tokenbody) |
| 400 | INVALID_PAYLOAD(스키마 또는 상위400) |
| 401/403/404 | UNAUTHORIZED/FORBIDDEN/NOT_FOUND; 상위 동일status 또는 로컬 등급403·유저404 |
| 상위 기타 non-2xx | status는 그대로; 위 codeForStatus표 외 값은 INTERNAL_ERROR |
| 500 | INTERNAL_ERROR(DB/동기화/발급) |
| 503 | SERVICE_UNAVAILABLE(미설정·통신·상위2xx의잘못된본문) |

[`internal/transport/httpapi/board/login.go:117`](../../internal/transport/httpapi/board/login.go#L117) [`internal/transport/httpapi/board/officenext.go:158`](../../internal/transport/httpapi/board/officenext.go#L158) 공통 전처리 406/408/413/415와 DB500·취소503은 위 오류표 및 [공통 규약](README.md#huma-common) 참조.

### 7. 주의사항

상위 요청에 애플리케이션 수준 재시도 루프는 없다. OfficeNext access_token은 이어지는 /api/user 조회에만 쓰고 클라이언트에는 board 토큰을 반환한다. `internal/transport/httpapi/board/officenext.go:45`, `internal/transport/httpapi/board/officenext.go:158`, `internal/transport/httpapi/board/login.go:68`

상위 각 호출 timeout8초, 읽는 응답최대1MiB. 2xx지만 access_token 없음/사용자id=0/JSON불량은503이다. 로그인할 때 사용자 last_login_at를 쓰는 코드나 퇴직·중지 차단은 이 경로에 없다. [`internal/transport/httpapi/board/officenext.go:32`](../../internal/transport/httpapi/board/officenext.go#L32) [`internal/transport/httpapi/board/officenext.go:123`](../../internal/transport/httpapi/board/officenext.go#L123) [`internal/domain/board/repository.go:115`](../../internal/domain/board/repository.go#L115)

### 8. 시나리오

```bash
# 정상: 환경변수에 실제 계정값을 넣는다 → 200
jq -n --arg username "$LOGIN_USERNAME" --arg password "$LOGIN_PASSWORD" '{username:$username,password:$password}' | curl -i "$BASE_URL/api/v1/board/login" -H 'Content-Type: application/json' --data-binary @-
# 누락: 상위서버 호출 전에400
curl -i "$BASE_URL/api/v1/board/login" -H 'Content-Type: application/json' -d '{"username":"user@example.com"}'
# 숫자 password는 문자열로 변환하지 않는다 →400
curl -i "$BASE_URL/api/v1/board/login" -H 'Content-Type: application/json' -d '{"username":"user@example.com","password":123}'
```
[`internal/transport/httpapi/board/contract_test.go:301`](../../internal/transport/httpapi/board/contract_test.go#L301)

## POST /api/v1/board/refresh

### 1. 경로

OperationID: `board-refresh-token`. [`internal/transport/httpapi/board/routes.go:78`](../../internal/transport/httpapi/board/routes.go#L78)

저장된 refresh를1회 소비하고 새 쌍 발급. [`internal/transport/httpapi/board/routes.go:86`](../../internal/transport/httpapi/board/routes.go#L86)

### 2. Path

없음. [`internal/transport/httpapi/board/refresh.go:33`](../../internal/transport/httpapi/board/refresh.go#L33)

### 3. Query

도메인 query 없음. [`internal/transport/httpapi/board/refresh.go:33`](../../internal/transport/httpapi/board/refresh.go#L33)

### 4. Body

| 필드 | 타입 | 필수 | 기본·검증·상한 |
| --- | --- | --- | --- |
| refresh_token | string | 예 | minLength1, 비공백문자 포함; 발급길이43자지만 입력maxLength 없음 |

모든 필드 기본값 없음, null 불가, 길이 상한 없음, 추가 키 불허. 위 공통 Body 규칙 적용. [`internal/transport/httpapi/board/refresh.go:33`](../../internal/transport/httpapi/board/refresh.go#L33)

### 5. 인증·권한

exempt. Body400 → board tokens없음503 → token SHA-256 DELETE RETURNING(없음/만료/재사용401) → 회사등급403 → 발급 → sync실패로그만 → 새refresh저장. 만료 비교는 expires_at > now, 경계같음은 거절. [`internal/transport/httpapi/board/refresh.go:67`](../../internal/transport/httpapi/board/refresh.go#L67) [`internal/domain/board/refreshtoken.go:118`](../../internal/domain/board/refreshtoken.go#L118)

### 6. Response

| HTTP | 응답 |
| --- | --- |
| 200 | [TokenBody](#tokenbody), 이전refresh 폐기 후 새값 보관 |
| 400 | INVALID_PAYLOAD |
| 401 | UNAUTHORIZED(없음/만료/재사용 구별 불가) |
| 403 | FORBIDDEN(회사등급; 기존토큰은 이미소비됨) |
| 500 | INTERNAL_ERROR(consume/발급/새저장) |
| 503 | SERVICE_UNAVAILABLE |

[`internal/transport/httpapi/board/refresh.go:67`](../../internal/transport/httpapi/board/refresh.go#L67) [`internal/transport/httpapi/board/token.go:174`](../../internal/transport/httpapi/board/token.go#L174) 공통 전처리 406/408/413/415와 DB500·취소503은 위 오류표 및 [공통 규약](README.md#huma-common) 참조.

### 7. 주의사항

동시호출은 하나만 성공할 수 있다. 성공 응답이 네트워크에서 사라져도 이전토큰은 복구되지 않는다. expiry행 전체 청소작업이 아니라 새발급시 해당company/user의 만료행을 지운다. [`internal/domain/board/refreshtoken.go:118`](../../internal/domain/board/refreshtoken.go#L118) [`internal/domain/board/refreshtoken.go:161`](../../internal/domain/board/refreshtoken.go#L161)

### 8. 시나리오

```bash
# 정상 → 200; 응답 refresh_token으로 저장값 교체
jq -n --arg token "$REFRESH_TOKEN" '{refresh_token:$token}' | curl -i "$BASE_URL/api/v1/board/refresh" -H 'Content-Type: application/json' --data-binary @-
# 동일 REFRESH_TOKEN을 아직 교체하지 않은 채 다시 호출 →401
jq -n --arg token "$REFRESH_TOKEN" '{refresh_token:$token}' | curl -i "$BASE_URL/api/v1/board/refresh" -H 'Content-Type: application/json' --data-binary @-
# null →400
curl -i "$BASE_URL/api/v1/board/refresh" -H 'Content-Type: application/json' -d '{"refresh_token":null}'
```
[`internal/transport/httpapi/board/refresh_test.go:100`](../../internal/transport/httpapi/board/refresh_test.go#L100)

## GET /api/v1/board/me

### 1. 경로

OperationID: `board-get-me`. [`internal/transport/httpapi/board/routes.go:94`](../../internal/transport/httpapi/board/routes.go#L94)

현재 bearer의 user_id 프로필과 설정 조회. [`internal/transport/httpapi/board/routes.go:104`](../../internal/transport/httpapi/board/routes.go#L104)

### 2. Path

없음. company/user path도 없다. [`internal/transport/httpapi/board/me.go:21`](../../internal/transport/httpapi/board/me.go#L21)

### 3. Query

없음. `Lang` 헤더가 표시명 접미사를 바꾼다. [`internal/transport/httpapi/board/me.go:39`](../../internal/transport/httpapi/board/me.go#L39)

### 4. Body

없음. [`internal/transport/httpapi/board/me.go:21`](../../internal/transport/httpapi/board/me.go#L21)

### 5. 인증·권한

board 계약, Authorization: Bearer <BOARD_TOKEN> 필수. 토큰401 → identity없음401 → user_id 조회없음404 → 관계조회. 회사등급 재검사와 관리자 제한 없음. 토큰의 company_id와 현재users.company_id가 달라도 /me는 후자를 보여준다. scoped API에는 토큰company_id가 계속 적용되므로 소속변경 후 재인증한다. [`internal/transport/httpapi/board/me.go:32`](../../internal/transport/httpapi/board/me.go#L32)

### 6. Response

| HTTP | 응답 |
| --- | --- |
| 200 | [MeBody](#mebody), 모든 nullable관계/필드는 null로 포함 |
| 401 | UNAUTHORIZED |
| 404 | NOT_FOUND |
| 500 | INTERNAL_ERROR |
| 503 | SERVICE_UNAVAILABLE |

[`internal/transport/httpapi/board/me.go:32`](../../internal/transport/httpapi/board/me.go#L32) 공통 전처리 406/408/413/415와 DB500·취소503은 위 오류표 및 [공통 규약](README.md#huma-common) 참조.

### 7. 주의사항

읽음/설정생성/admin sync 부수효과 없음. profile_src는 legacy 설정키 `OFFOCEWAVE_SURVEY_HOST`(철자그대로)+AWS_FOLDER로 만들며 호스트가 빈값이면null. 퇴직만으로는 이미지를 숨기지 않고 중지이면숨긴다. [`internal/transport/httpapi/board/me.go:323`](../../internal/transport/httpapi/board/me.go#L323) [`internal/platform/config/config.go:198`](../../internal/platform/config/config.go#L198)

### 8. 시나리오

```bash
# 정상 →200
curl -i "$BASE_URL/api/v1/board/me" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Lang: ko'
# 헤더누락 →401 UNAUTHORIZED
curl -i "$BASE_URL/api/v1/board/me"
# bearer 뒤 탭은 구분자로 인정되지 않는다 →401
curl -i "$BASE_URL/api/v1/board/me" -H "$(printf 'Authorization: Bearer\t%s' "$BOARD_TOKEN")"
```
[`internal/transport/httpapi/middleware/auth.go:150`](../../internal/transport/httpapi/middleware/auth.go#L150)
