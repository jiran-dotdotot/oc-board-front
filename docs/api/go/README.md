# Board 프론트 연동 API — 코드 전수 재조사

조사 기준은 `oc-api-go`의 `feat/settings`, 커밋 `65b7f49`다. Go **1.26.7**, gin **1.12.0**, Huma **2.39.0**, GORM **1.31.2**를 사용한다. 이전 API 문서는 계약 근거로 사용하지 않고 핸들러 → 권한/저장소 → SQL → 조립부/워커/테스트 순으로 확인했다. 버전 근거: [`go.mod:3`](../../go.mod#L3)

## 코드 밖에서 결정되는 값

코드의 미조사 항목은 남기지 않는다. 아래 **3개**는 배포 환경 또는 외부 시스템의 실제 값이므로 저장소만으로 확정할 수 없다. 본문의 기본값은 코드 기본값이며 운영값으로 단정하지 않는다.

| 항목 | 판정할 수 없는 이유 | 배포 시 확인할 곳·프론트 조치 | 코드 근거 |
| --- | --- | --- | --- |
| 공개 Base URL·활성 설정·실제 토큰 TTL | 프록시 도메인과 환경변수는 배포가 공급 | 배포 설정의 공개 origin, BOARD_* TTL/키, OFFICENEXT_*를 확인. 아래 예시는 localhost로 시작 | [`internal/platform/config/config.go:190`](../../internal/platform/config/config.go#L190) |
| S3/CDN 접근·브라우저 업로드 허용 | 버킷 IAM·CORS·CDN 정책은 Go 코드가 생성하지 않음 | 배포 버킷/CloudFront 설정에서 presigned PUT/GET 및 Origin 허용 확인 | [`internal/platform/objectstore/objectstore.go:64`](../../internal/platform/objectstore/objectstore.go#L64) |
| 외부 인증/알림의 가용성과 실제 배달·운영 워커 실행 | OfficeNext 응답, Redis/worker/scheduler 배포, DB 알림 템플릿은 실행 환경의 상태 | OfficeNext·웹훅 운영 설정, 워커 로그, board.alarm_templates 데이터를 확인. 쓰기 성공을 알림 배달 성공으로 표시하지 않음 | [`internal/transport/httpapi/board/officenext.go:99`](../../internal/transport/httpapi/board/officenext.go#L99) [`internal/transport/worker/alarmdelivery.go:624`](../../internal/transport/worker/alarmdelivery.go#L624) |

## 문서 목록과 범위

등록된 METHOD+경로 기준 **89 = 문서화 67 + 제외 22**다. 숨은 rewrite/OPTIONS/리다이렉트는 아래 별도 절에서 설명하며 등록 수에 중복 가산하지 않는다. onpremise DB까지 제공하는 테스트 조립 기준이며, 실제 설정에서 onpremise DB가 없으면 관련15개가 등록되지 않아74개다. 나머지 기능의 설정 부재는 대개 라우트 제거 대신503이다. [`internal/transport/httpapi/routetable_test.go:32`](../../internal/transport/httpapi/routetable_test.go#L32) [`internal/transport/httpapi/router_test.go:35`](../../internal/transport/httpapi/router_test.go#L35) [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409)

| 문서 | 도메인 | 등록 엔드포인트 |
| --- | --- | ---: |
| [01-auth-user.md](01-auth-user.md) | 인증·토큰·유저 | 4 |
| [02-management.md](02-management.md) | 회사설정·관리자·유저설정·정렬 | 6 |
| [03-category.md](03-category.md) | 카테고리 | 8 |
| [04-board.md](04-board.md) | 게시판·권한 판정 전문 | 7 |
| [05-post-read.md](05-post-read.md) | 게시글 조회·첨부 다운로드 | 5 |
| [06-post-write.md](06-post-write.md) | 작성·수정·삭제·복원·읽음·북마크·공지 | 9 |
| [07-post-comment-like.md](07-post-comment-like.md) | 댓글·공감·조회자 | 8 |
| [08-drive-folder.md](08-drive-folder.md) | 자료실 폴더 | 5 |
| [09-drive-file.md](09-drive-file.md) | 자료실 파일 | 9 |
| [10-upload-department-client.md](10-upload-department-client.md) | 업로드·부서·이미지·클라이언트 버전 | 6 |
| **합계** | 아래 전수표의 문서화 대상과 동일 | **67** |

모든 문서는 공통 규칙·공유 DTO·도메인 함정 뒤에 엔드포인트별 8개 절을 둔다. 적용되지 않는 Path/Query/Body는 없음으로 표시한다. 여러 엔드포인트에서 공유하는 응답 객체는 DTO 표 링크로 정의한다.

<a id="curl-setup"></a>
## 공통 규약과 curl 실행 준비

URL은 `BASE_URL + 전체 경로`다. 로컬 API 기본 포트8080, 공개 origin은 배포값이다. 경로의 `{id}`는 실제 UUID로, `{company_id}`/`{user_id}`는 각 토큰의 숫자 ID로 치환한다. 설정되는 포트 근거: [`internal/platform/config/config.go:262`](../../internal/platform/config/config.go#L262)

```bash
export BASE_URL='http://localhost:8080'
export OFFICEWAVE_TOKEN='실제 OfficeWave member JWT'
export BOARD_TOKEN='교환 또는 로그인 응답의 access_token'
export REFRESH_TOKEN='같은 응답의 refresh_token'
export COMPANY_ID='1' USER_ID='1'
export BOARD_ID='11111111-1111-4111-8111-111111111111'
export CATEGORY_ID='22222222-2222-4222-8222-222222222222'
export POST_ID='33333333-3333-4333-8333-333333333333'
export COMMENT_ID='44444444-4444-4444-8444-444444444444'
export FILE_ID='55555555-5555-4555-8555-555555555555'
export FOLDER_ID='66666666-6666-4666-8666-666666666666'
export ATTACHMENT_ID='77777777-7777-4777-8777-777777777777'
export SCOPE="$BASE_URL/api/v1/board/companies/$COMPANY_ID/users/$USER_ID"
export S="$SCOPE"
export MEMBER_TOKEN="$OFFICEWAVE_TOKEN"
export MANAGEMENT="$BASE_URL/api/v1/companies/$COMPANY_ID"
export TARGET_USER_ID="$USER_ID"
export IMAGE_KEY="설정된 AWS_FOLDER/user/profile/실제ID/profile_image.png"
export UPLOAD_URL="presign 응답 result.url"
export LOCAL_FILE="업로드할 실제 로컬 파일 경로"
export LOGIN_USERNAME='실제 계정' LOGIN_PASSWORD='실제 비밀번호'
```

UUID 예시는 문법적으로 유효한 자리표시자다. **정상 예시의 대상은 실제 존재하고 해당 호출자가 권한을 가진 행으로 교체**한다. `jq`가 쓰인 예시는 JSON 문자열을 안전하게 인코딩한다. 요청은 실제 데이터를 변경할 수 있으므로 개발용 데이터를 사용한다. API curl의 경로·메서드는 정적으로 전수 검증하며, 운영 자격증명을 넣어 HTTP 요청을 실행했다는 뜻은 아니다.

<a id="auth-contracts"></a>
### Prefix와 인증 계약

| 계약 | 경로 | credential·검증 | 거절 |
| --- | --- | --- | --- |
| exempt | board `/token`, `/login`, `/refresh`; 게스트 client-versions; image; 문서·health·bundle-download | Authorization 미검증. 인증3개는 Body, bundle-download는 다운로드 토큰으로 별도 검증 | 각 endpoint 규칙 |
| board | `/api/v1/board`의 나머지 | **이 API가 발급한 HS256** bearer, issuer `oc-api-go/board`, exp 필수 | 없거나 잘못되거나 verifier 미설정이면401 UNAUTHORIZED. OfficeWave 토큰으로 fallback 없음 |
| member | `/api/v1/companies/...`의 조직/관리·사용자 버전 | OfficeWave **ES256**, issuer·exp(5분leeway)·`scopes` 배열의 정확한 `ROLE_MEMBER` | 401 UNAUTHORIZED |
| service | `/api/v1/onpremise/...`(다운로드 면제 경로 제외) | OfficeWave ES256, member scope 대신 `aud=Service` | 401 UNAUTHORIZED |

[`internal/transport/httpapi/router.go:440`](../../internal/transport/httpapi/router.go#L440) [`internal/transport/httpapi/middleware/auth.go:95`](../../internal/transport/httpapi/middleware/auth.go#L95) [`internal/auth/jwt.go:103`](../../internal/auth/jwt.go#L103) [`internal/auth/boardtoken.go:146`](../../internal/auth/boardtoken.go#L146)

AuthPolicy는 ExemptExact → ExemptPrefixes → ServicePrefixes → BoardPrefixes → 나머지 member 순서로 판정한다. `internal/transport/httpapi/middleware/auth.go:54`

스코프 `.../companies/{company_id}/users/{user_id}`는 리소스 필터가 아니라 **토큰 claim과의 일치 검증**이다. middleware가 company → user 순서로 먼저 비교한다. 정규10진수 문자열의 정확한 일치이므로 `01`, `+1`, `1.0`, UUID, 타회사/타유저는 모두403 FORBIDDEN이다. `/companies/{company_id}`만 있으면 company만 비교한다. 인증401 → 스코프403 → Huma 입력검증 → 도메인 판정 순서이고, 핸들러 내부의404/403/422 순서는 각 문서에 적었다. 스코프가 틀린 호출자는 입력 UUID나 대상 존재 여부를 알아낼 수 없다. [`internal/transport/httpapi/middleware/auth.go:212`](../../internal/transport/httpapi/middleware/auth.go#L212) [`internal/transport/httpapi/middleware/auth.go:261`](../../internal/transport/httpapi/middleware/auth.go#L261) [`internal/transport/httpapi/router.go:342`](../../internal/transport/httpapi/router.go#L342)

bearer 검증은 stateless다. DB의 banned_at·password_updated_at·사용자/회사 상태 또는 로그아웃 denylist를 매 요청 조회하지 않는다. 계정 상태가 바뀌어도 이미 발급된 bearer가 즉시 무효화된다고 가정하지 않는다. [`internal/auth/jwt.go:103`](../../internal/auth/jwt.go#L103), [`internal/auth/boardtoken.go:146`](../../internal/auth/boardtoken.go#L146)

### 헤더·로케일

| 헤더 | 표기·기본값 | 누락·오류 동작 | 근거 |
| --- | --- | --- | --- |
| Authorization | `Bearer` + **ASCII 공백1개** + 토큰. Bearer 대소문자 무관; 뒤 토큰은 TrimSpace | 필수 계약에서401. 앞 공백/첫 구분자가 탭이면 거절; Bearer 뒤 공백이 여러 개면 남은 공백 trim | [`internal/transport/httpapi/middleware/auth.go:150`](../../internal/transport/httpapi/middleware/auth.go#L150) |
| Content-Type | JSON Body는 `application/json` | 누락·빈값은 JSON 기본; 지원하지 않는 형식415. category-tree의 지정 form 변환만 예외 | [`internal/transport/httpapi/middleware/formbody.go:50`](../../internal/transport/httpapi/middleware/formbody.go#L50) |
| Lang | 원문 문자열, 없어도 됨 | 표시명은 빈값/ko=한국어, ja=일본어, 나머지 영어. 에러 언어는 아래 별도 규칙 | [`internal/transport/httpapi/middleware/locale.go:62`](../../internal/transport/httpapi/middleware/locale.go#L62) [`internal/transport/httpapi/board/me.go:240`](../../internal/transport/httpapi/board/me.go#L240) |
| Time_zone | IANA zone 예:`Asia/Seoul` | 누락·잘못된 zone은Asia/Seoul; tzdata 로딩 실패 시에만UTC | [`internal/transport/httpapi/middleware/locale.go:62`](../../internal/transport/httpapi/middleware/locale.go#L62) |
| X-Request-ID | 선택; 없으면 UUID 생성 | 요청값 또는 생성값을 응답 헤더로 돌려줌 | [`internal/transport/httpapi/middleware/middleware.go:66`](../../internal/transport/httpapi/middleware/middleware.go#L66) |
| Accept | 선택; JSON을 지원하는 값 사용 | 기본 NoFormatFallback=false이므로 지원하지 않는 Accept도 JSON fallback | [`huma@v2.39.0/huma.go:1427`](https://github.com/danielgtaylor/huma/blob/v2.39.0/huma.go#L1427) |

HTTP 헤더명은 대소문자를 구분하지 않지만 `_`와 `-`는 다른 문자다. 따라서 `Time-Zone`은 `Time_zone`의 대체 표기가 아니다. Locale 코드가 읽는 정확한 키가 위 표의 키다. 에러 message는 `?lang=` → `Lang` → `Accept-Language` 순서의 언어 매칭이며 기본 영어다. 다만 gin 인증401·스코프403은 transformer 전에 생성되어 **항상 영어**다. code로 분기하고 message는 표시용으로만 쓴다. [`internal/transport/httpapi/middleware/locale.go:62`](../../internal/transport/httpapi/middleware/locale.go#L62) [`internal/transport/httpapi/humaerr/lang.go:134`](../../internal/transport/httpapi/humaerr/lang.go#L134) [`internal/transport/httpapi/humaerr/lang.go:162`](../../internal/transport/httpapi/humaerr/lang.go#L162) [`internal/transport/httpapi/middleware/auth.go:184`](../../internal/transport/httpapi/middleware/auth.go#L184)

### CORS·숫자·시간·응답 봉투

CORS는 Origin 허용목록(빈 설정 또는 `*`는 전체)을 사용한다. 메서드 허용값은 GET/POST/PUT/PATCH/DELETE/OPTIONS, 헤더는 Origin/Content-Type/Authorization/X-Request-ID/Lang/Time_zone, max-age86400초다. Allow-Credentials와 Expose-Headers는 설정하지 않는다. 브라우저에서 X-Request-ID/Location을 읽을 때 노출 정책을 별도로 고려한다. [`internal/transport/httpapi/middleware/middleware.go:34`](../../internal/transport/httpapi/middleware/middleware.go#L34)

int64 ID/bytes는 JSON number이며 문자열로 자동 변환하지 않는다. 프론트는 JS의 안전정수 범위를 넘는 ID가 가능한 타입임을 고려한다. UUID는 문자열이다. board DTO의 일반 시각은 **UTC 소수6자리** `2026-09-08T00:00:00.000000Z`; `/me` 일부 public DB 시각은 KST 고정 PG형 `2026-09-08 09:00:00.123456+09`; 부서DTO의 time.Time은 RFC3339 계열이다. 모든 시각에 한 파서를 강제로 적용하지 않는다. 입력 시각·로컬 day 계산은 각 endpoint의 Time_zone 규칙을 따른다. [`internal/transport/httpapi/board/dto.go:25`](../../internal/transport/httpapi/board/dto.go#L25) [`internal/transport/httpapi/board/me.go:287`](../../internal/transport/httpapi/board/me.go#L287) [`internal/transport/httpapi/management/department.go:73`](../../internal/transport/httpapi/management/department.go#L73)

성공 응답에 통일된 최상위 봉투는 없다. DTO 객체, 배열, `{data,...}` 페이지, `{result:{...}}` 부분실패 결과, 빈Body가 공존한다. 게시글/자료실의 일부 `is_not_paging` 분기는 배열로 바뀌고 다른 목록은 항상 페이지다. 필드명은 도메인 표가 기준이다. [`internal/transport/httpapi/board/posts.go:145`](../../internal/transport/httpapi/board/posts.go#L145) [`internal/transport/httpapi/board/drivefiles.go:250`](../../internal/transport/httpapi/board/drivefiles.go#L250) [`internal/transport/httpapi/board/driveuploadbody.go:116`](../../internal/transport/httpapi/board/driveuploadbody.go#L116) [`internal/transport/httpapi/management/department.go:126`](../../internal/transport/httpapi/management/department.go#L126)

<a id="huma-common"></a>
### 입력 검증과 에러 골격

```json
{"$schema":"http://localhost:8080/schemas/Envelope.json","error":{"code":"INVALID_PAYLOAD","message":"Invalid request payload.","details":["body.field: ..."]}}
```

`error`는 객체, `code`/`message`는 non-null string, `details`는 선택 string[]다. 스키마 검증 details는 위치/메시지이며 offending value를 싣지 않는다. Huma 카탈로그에 있는 code는 handler의 임의 message 대신 로컬라이즈한 문구가 나간다. generic500은 내부 DB 오류문을 노출하지 않는다. [`internal/transport/httpapi/humaerr/humaerr.go:18`](../../internal/transport/httpapi/humaerr/humaerr.go#L18) [`internal/transport/httpapi/humaerr/humaerr.go:99`](../../internal/transport/httpapi/humaerr/humaerr.go#L99) [`internal/transport/httpapi/humaerr/humaerr.go:150`](../../internal/transport/httpapi/humaerr/humaerr.go#L150)

| status | code | 적용 조건 |
| --- | --- | --- |
| 400 | INVALID_PAYLOAD | 깨진JSON/필수Body 없음; board·조직/관리·image의 Huma 필드검증도400 |
| 401 | UNAUTHORIZED | gin bearer 검증의401은 WWW-Authenticate: Bearer 포함; refresh/login의401은 이 헤더를 보장하지 않음 |
| 403 | FORBIDDEN | 스코프·일반 권한 실패 |
| 404 | NOT_FOUND | Huma의 일반 없음 |
| 406 | NOT_ACCEPTABLE | code 매핑은 있으나 현재 기본 설정의 format fallback으로 일반 Accept 협상에서는 발생하지 않음 |
| 408 | REQUEST_TIMEOUT | Body 읽기 timeout(기본5초) |
| 413 | REQUEST_ENTITY_TOO_LARGE | Body 전체 1MiB 기본한도 초과 또는 명시적 이미지제한 |
| 415 | UNSUPPORTED_MEDIA_TYPE | Body 디코더가 지원하지 않는 형식 |
| 422 | VALIDATION_ERROR | client-versions 등400변환 대상 밖의 Huma 검증 |
| 500 | INTERNAL_ERROR | 일반 저장소 오류 및 codeForStatus 미등록 status의 기본code |
| 503 | SERVICE_UNAVAILABLE | 명시적 미설정·context 취소/기한초과 ServerError |

도메인의 409/422 등은 `BOARD_NOT_DRIVE`, `UPLOAD_NOT_PENDING`처럼 별도 code를 유지한다. **모든422가 VALIDATION_ERROR인 것은 아니다.** 반대로 `/login` 상위 HTTP status를 전달할 때503/429/409도 기본code `INTERNAL_ERROR`일 수 있다. [`internal/transport/httpapi/router.go:149`](../../internal/transport/httpapi/router.go#L149) [`internal/transport/httpapi/humaerr/humaerr.go:42`](../../internal/transport/httpapi/humaerr/humaerr.go#L42) [`internal/transport/httpapi/humaerr/humaerr.go:188`](../../internal/transport/httpapi/humaerr/humaerr.go#L188) [`internal/transport/httpapi/board/login.go:117`](../../internal/transport/httpapi/board/login.go#L117)

Body 없는 GET에413/415가 정상 도메인 분기로 있다는 뜻은 아니다. 위 표는 Huma가 실제 읽거나 협상하는 단계에 적용한다. 일반 구조체 Body는 framework의 `$schema` readonly 특수키를 제외한 추가 키 불허가 기본이지만 legacy 호환 Body는 명시적으로 허용하는 경우가 있다. **필드 표의 개별 규칙을 우선**한다. maxLength/maxItems가 없어도 전체 Body1MiB 한도는 남는다. Huma 기본값과 포인터의 `omitempty`/`nullable`는 실제 설치 버전 소스를 확인했다(Context7 자료는 버전별 고정본을 제공하지 않아 보조로만 사용). [`huma@v2.39.0/huma.go:1491`](https://github.com/danielgtaylor/huma/blob/v2.39.0/huma.go#L1491) [`huma@v2.39.0/schema.go:944`](https://github.com/danielgtaylor/huma/blob/v2.39.0/schema.go#L944) [`huma@v2.39.0/schema.go:973`](https://github.com/danielgtaylor/huma/blob/v2.39.0/schema.go#L973)

스키마 타입이 진짜 bool인 query는 strconv.ParseBool: true쪽 `1,t,T,TRUE,true,True`, false쪽 `0,f,F,FALSE,false,False`; 그 외 `yes,on,Falsee`는 검증오류다. 그러나 이 저장소에는 **문자열 query를 직접 파싱하는 엄격한 bool**, PHP truthiness(`""`/`"0"`만false), Body용 legacy.Bool이 공존한다. 이름이 `is_`라고 ParseBool을 가정하지 않는다. 각 endpoint의 허용 문자열 전수표가 기준이다. [`huma@v2.39.0/huma.go:1831`](https://github.com/danielgtaylor/huma/blob/v2.39.0/huma.go#L1831) [`internal/transport/httpapi/board/category.go:99`](../../internal/transport/httpapi/board/category.go#L99) [`internal/transport/httpapi/board/posts.go:571`](../../internal/transport/httpapi/board/posts.go#L571)

배열 query는 endpoint별로 repeated key를 받는다. 전처리가 `id[]=a&id[1]=b`를 `id=a&id=b`로 바꾸지만 `sort[by]`는 보존한다. 단, raw query에 `[` 또는 **대문자 `%5B`**가 있어야 전처리를 시작하므로 `%5b`만 있는 인코딩은 우회할 수 있다. `curl --globoff` 또는 `--data-urlencode`를 사용하고, comma 분리 지원 여부는 개별 표를 따른다. 미정의 query 키는 일반적으로 Huma가 읽지 않으며, Body의 추가 키 규칙과 다르다. [`internal/transport/httpapi/middleware/queryarray.go:42`](../../internal/transport/httpapi/middleware/queryarray.go#L42) [`huma@v2.39.0/huma.go:1844`](https://github.com/danielgtaylor/huma/blob/v2.39.0/huma.go#L1844)


<a id="schema-field"></a>
### Huma가 자동으로 추가하는 필드

이 문서의 모든 성공 DTO 표와 Huma 에러 봉투에는 다음 **공유 특수필드 규칙**을 함께 적용한다. `$schema`는 업무 DTO의 저장 필드가 아니며 내부 관계에 재귀적으로 붙지 않는다. 실제 router는 `huma.DefaultConfig`의 transformer를 유지한다. [`internal/transport/httpapi/router.go:354`](../../internal/transport/httpapi/router.go#L354), [`internal/transport/httpapi/routerboard_test.go:161`](../../internal/transport/httpapi/routerboard_test.go#L161)

| 필드/헤더 | 타입·null | 저장/계산 | 포함 조건·형식 |
| --- | --- | --- | --- |
| 최상위 `$schema` | string, 포함될 때 null 불가 | 계산 | 내부 `$ref`의 object 응답으로 등록된 Go struct를 반환할 때 추가. 예: TokenBody, MeBody, DriveFileDTO, Envelope. 값은 `<계산된 origin>/schemas/<타입명>.json` |
| `Link` 헤더 | string | 계산 | 같은 조건에서 `</schemas/<타입명>.json>; rel="describedBy"` |

최상위 배열·map·nil·raw callback·gin 직접 응답에는 붙지 않는다. `Body:any`처럼 동적 출력은 실제 값의 struct 타입이 응답 registry에 등록되어 있을 때만 붙는다. 따라서 업무 데이터 파서는 `$schema`를 선택적 메타데이터로 처리한다. URL origin은 `X-Forwarded-Host`→`Forwarded host`→요청Host 순서로 얻으며 TLS 없는 localhost/127.0.0.1은http, 그 밖은https를 사용한다. 프론트 API Base URL을 이 메타데이터에서 역산하지 않는다. [Huma transforms.go:51](https://github.com/danielgtaylor/huma/blob/v2.39.0/transforms.go#L51), [transforms.go:157](https://github.com/danielgtaylor/huma/blob/v2.39.0/transforms.go#L157), [transforms.go:190](https://github.com/danielgtaylor/huma/blob/v2.39.0/transforms.go#L190), [transforms.go:238](https://github.com/danielgtaylor/huma/blob/v2.39.0/transforms.go#L238)

request의 등록 object schema에도 readonly `$schema` 속성이 생긴다. 그래서 본문의 “추가 키 불허”는 이 framework 특수키를 제외한 업무 키에 대한 규칙이다. 요청에서 `$schema`를 보낼 필요는 없다. 또한 optional property가 null이면 Huma는 해당 property의 검증을 건너뛴다. `nullable:false` OpenAPI 표기만으로 null400을 예상하지 말고 각 도메인의 decoder/기본값 규칙을 따른다. [Huma transforms.go:85](https://github.com/danielgtaylor/huma/blob/v2.39.0/transforms.go#L85), [validate.go:855](https://github.com/danielgtaylor/huma/blob/v2.39.0/validate.go#L855)

현재 format 설정은 `NoFormatFallback=false`: 미지원 Accept도 JSON으로 fallback하므로 카탈로그의406을 일반적인 요청 실패 분기로 사용하지 않는다. Content-Type이 없거나 빈 문자열이어도 JSON으로 해석한다. [Huma defaults.go:79](https://github.com/danielgtaylor/huma/blob/v2.39.0/defaults.go#L79), [api.go:355](https://github.com/danielgtaylor/huma/blob/v2.39.0/api.go#L355), [api.go:376](https://github.com/danielgtaylor/huma/blob/v2.39.0/api.go#L376)

페이지 응답의 업무 봉투는 아래5개 키다. data의 원소는 각 도메인 DTO이며 `$schema` 추가 여부는 위 규칙을 따른다. Laravel의 `first_page_url`, `last_page_url`, `next_page_url`, `prev_page_url`, `path`, `links`, `from`, `to`는 반환하지 않는다. `internal/transport/httpapi/board/postsbody.go:25`

| 필드 | 타입·null | 저장/계산 | 기본·계산 규칙 |
| --- | --- | --- | --- |
| data | object[], null 불가 | 조회 | 빈 결과[]; 관계는 원소 DTO |
| current_page | integer, null 불가 | 계산 | 요청 page, 기본1 |
| last_page | integer, null 불가 | 계산 | 통상 ceil(total/per_page), 빈 결과1; 극단값 overflow 예외는05/04 문서 |
| per_page | integer, null 불가 | 계산 | 실효 take/limit; 상한은 endpoint별로 다름 |
| total | int64, null 불가 | 조회 집계 | 전체 일치 행 수 |

`internal/transport/httpapi/board/postsbody.go:41`, `internal/domain/board/postlist.go:344`, `internal/domain/board/drivefile.go:333`

응답 이름의 주의점: 게시글 `is_writable`은 작성자==나, `board.is_writable`은 실제 게시판 Write 권한이다. 게시글 `state=DEL`은 삭제 시각으로부터의 표시값이지만 자료실 state는 ACT/FAIL/UPLOADING 저장값이며 `deleted_at`으로 휴지통을 판정한다. 댓글 삭제는 is_active=false다. 댓글/조회/공감 카운트는 조회시점 SQL 집계이고 별도 count 갱신 queue를 기다리지 않는다. `internal/transport/httpapi/board/postsbody.go:285`, `internal/transport/httpapi/board/postsbody.go:320`, `internal/transport/httpapi/board/drivefilesbody.go:583`, `internal/domain/board/comment.go:28`, `internal/transport/worker/worker.go:148`

## 전역 함정 Top 12

1. **토큰 두 종류를 보관한다.** board HS256과 조직/관리의 OfficeWave ES256은 교환 불가능하다. [`internal/transport/httpapi/middleware/auth.go:109`](../../internal/transport/httpapi/middleware/auth.go#L109)
2. **스코프 불일치가 가장 먼저403**이다. 입력 UUID 검증보다 먼저이며 ID의 앞0도 안 된다. [`internal/transport/httpapi/middleware/auth.go:212`](../../internal/transport/httpapi/middleware/auth.go#L212)
3. **400과422를 통일하지 않는다.** board Huma 검증400, domain422, client-version검증422가 공존한다. [`internal/transport/httpapi/router.go:149`](../../internal/transport/httpapi/router.go#L149)
4. **200은 항목 성공 보장이 아니다.** batch의 ignored_ids와 업로드 result.state, 완료의 UPLOADING/FAIL을 검사한다. [`internal/transport/httpapi/board/postwritebody.go:398`](../../internal/transport/httpapi/board/postwritebody.go#L398) [`internal/transport/httpapi/board/driveuploadbody.go:155`](../../internal/transport/httpapi/board/driveuploadbody.go#L155) [`internal/transport/httpapi/board/drivecomplete.go:184`](../../internal/transport/httpapi/board/drivecomplete.go#L184)
5. **`"false"`가 true인 query가 있다.** 내목록 bookmark와 카테고리 옵션의 truthiness를 표대로 직렬화한다. [`internal/transport/httpapi/board/posts.go:571`](../../internal/transport/httpapi/board/posts.go#L571) [`internal/transport/httpapi/board/category.go:99`](../../internal/transport/httpapi/board/category.go#L99)
6. **페이지/배열/빈Body를 구별한다.** JSON.parse 전 status뿐 아니라 endpoint 응답 분기를 따른다. [`internal/transport/httpapi/management/department.go:126`](../../internal/transport/httpapi/management/department.go#L126) [`internal/transport/httpapi/board/posts.go:145`](../../internal/transport/httpapi/board/posts.go#L145)
7. **GET이 읽음·최근검색어를 쓸 수 있다.** 조회 호출을 speculative prefetch하면 사용자 상태가 바뀐다. [`internal/domain/board/postdetailquery.go:95`](../../internal/domain/board/postdetailquery.go#L95) [`internal/transport/httpapi/board/search.go:32`](../../internal/transport/httpapi/board/search.go#L32)
8. **refresh는 일회 소비**다. 실패한 응답을 같은 refresh로 무조건 재시도하면401이다. [`internal/domain/board/refreshtoken.go:118`](../../internal/domain/board/refreshtoken.go#L118)
9. **presign 예약 → S3 PUT → 완료 호출**의 세 단계를 수행한다. DB 예약 후 서명실패·용량변경·HEAD 미반영도 가능하다. [`internal/transport/httpapi/board/driveupload.go:72`](../../internal/transport/httpapi/board/driveupload.go#L72) [`internal/transport/httpapi/board/drivecomplete.go:96`](../../internal/transport/httpapi/board/drivecomplete.go#L96)
10. **보이는 플래그와 쓰기 권한은 같지 않다.** 회사/카테고리/게시판 관리자, 저자, Read/Write와 삭제 규칙은 [권한 전문](04-board.md)에 따른다. [`internal/domain/board/permission.go:45`](../../internal/domain/board/permission.go#L45)
11. **수정의 생략·null·빈배열은 다른 입력**이다. optional 필드의 null은 스키마 nullable:false여도 Huma 검증이 건너뛰므로 실제 decoder·도메인 결과를 따른다. [`huma@v2.39.0/schema.go:944`](https://github.com/danielgtaylor/huma/blob/v2.39.0/schema.go#L944) [`internal/transport/httpapi/board/postwritebody.go:40`](../../internal/transport/httpapi/board/postwritebody.go#L40)
12. **알림은 비동기이며 게시글 성공과 분리**된다. 템플릿 없음·큐 없음·enqueue 실패·HTTP 비2xx도 저장 성공을 바꾸지 않는다. [`internal/transport/httpapi/board/handler.go:268`](../../internal/transport/httpapi/board/handler.go#L268) [`internal/transport/worker/alarmdelivery.go:624`](../../internal/transport/worker/alarmdelivery.go#L624)

## 라우트 표 밖의 숨은 경로

| 형태 | 실제 처리·한계 | 근거 |
| --- | --- | --- |
| 모든 경로의 OPTIONS | CORS가 인증 전에204, Body 없음. 미등록 경로도 같음. RequestID보다 앞이라 X-Request-ID 생성도 안 함 | [`internal/transport/httpapi/router.go:293`](../../internal/transport/httpapi/router.go#L293) [`internal/transport/httpapi/middleware/middleware.go:34`](../../internal/transport/httpapi/middleware/middleware.go#L34) |
| unmatched POST + query `_method=PUT/PATCH/DELETE` | NoRoute가 메서드를 대문자로 바꾸고 router 재실행. query 값 우선, 빈값이면 form의 _method; JSON body의 _method는 읽지 않음 | [`internal/transport/httpapi/legacycompat.go:89`](../../internal/transport/httpapi/legacycompat.go#L89) |
| 이미 POST가 등록된 URL + _method | 정상 POST가 매칭되어 NoRoute 미실행. 예: POST posts/{id}/comments는 수정으로 바뀌지 않음 | [`internal/transport/httpapi/legacycompat.go:49`](../../internal/transport/httpapi/legacycompat.go#L49) |
| DELETE `{S}/posts/{UUID}` | 등록되지 않은 단건 삭제를 DELETE `{S}/posts?id={UUID}`로 재작성. 원래 query 뒤에 추가. 권한은 bulk의 저자 규칙이고 ignored_ids 가능 | [`internal/transport/httpapi/legacycompat.go:130`](../../internal/transport/httpapi/legacycompat.go#L130) |
| POST `{S}/posts/{UUID}?_method=DELETE` | 위 두 rewrite를 연쇄 적용, 최대2회 재작성/3회 middleware 실행. request ID는 유지되고 access log는 dispatch마다 생김 | [`internal/transport/httpapi/legacycompat.go:49`](../../internal/transport/httpapi/legacycompat.go#L49) |
| category-tree의 form Body | 이 경로의 POST/PUT/PATCH만 application/x-www-form-urlencoded 또는 multipart를 중첩 JSON으로 바꿈. 일반 게시글/댓글 multipart 지원이라는 뜻이 아님 | [`internal/transport/httpapi/middleware/formbody.go:50`](../../internal/transport/httpapi/middleware/formbody.go#L50) |
| trailing slash 불일치 | gin 기본 RedirectTrailingSlash=true. 대응 경로가 있으면 GET301, 나머지307. 리다이렉트는 route middleware보다 앞 | [`gin@v1.12.0/gin.go:211`](https://github.com/gin-gonic/gin/blob/v1.12.0/gin.go#L211) [`gin@v1.12.0/gin.go:820`](https://github.com/gin-gonic/gin/blob/v1.12.0/gin.go#L820) |
| 그 밖의 미등록/잘못된 method | 자동 HEAD 등록과405 fallback 없음. 인증이 먼저401일 수 있고 통과하면 plain404 `404 page not found` | [`internal/transport/httpapi/legacycompat.go:49`](../../internal/transport/httpapi/legacycompat.go#L49) [`gin@v1.12.0/gin.go:211`](https://github.com/gin-gonic/gin/blob/v1.12.0/gin.go#L211) |
| panic | gin.Recovery의500, Huma 에러 봉투를 보장하지 않음 | [`internal/transport/httpapi/router.go:287`](../../internal/transport/httpapi/router.go#L287) |

`{S}`는 `/api/v1/board/companies/{company_id}/users/{user_id}`다. 위 rewrite는 **옛 `/api/v1/post/...` prefix를 살리지 않는다**. 이미지의302와 다운로드 URL 발급은 각 도메인 문서에 별도로 설명한다. [`internal/transport/httpapi/legacycompat.go:135`](../../internal/transport/httpapi/legacycompat.go#L135)

```bash
# 단건 alias: 정상 권한이면200, ignored_ids도 확인
curl -i -X DELETE "$SCOPE/posts/$POST_ID" -H "Authorization: Bearer $BOARD_TOKEN"
# 재작성 발생: POST 미등록 경로 + query override
curl -i -X POST "$SCOPE/posts/$POST_ID?_method=DELETE" -H "Authorization: Bearer $BOARD_TOKEN"
# 미등록 경로도 OPTIONS는 인증 없이204
curl -i -X OPTIONS "$BASE_URL/no-such-route" -H 'Origin: https://example.test'
```

## 비동기 작업·부수효과

HTTP 조립이 Redis를 사용하지 않으면 알림 producer가 없으며 HTTP는 계속 동작한다. enqueue 실패는 로그만 남긴다. API·worker·scheduler는 같은 바이너리의 별도 모드이고 scheduler는 enqueue만 한다. 게시글 예약발행과 업로드 만료는 매분, 파일/첨부 purge는 **UTC00:00**이며 배치 크기 제한 때문에 backlog가 다음 회차로 남을 수 있다. [`internal/app/app.go:143`](../../internal/app/app.go#L143) [`internal/transport/httpapi/board/handler.go:268`](../../internal/transport/httpapi/board/handler.go#L268) [`internal/transport/scheduler/scheduler.go:38`](../../internal/transport/scheduler/scheduler.go#L38) [`internal/transport/worker/worker.go:148`](../../internal/transport/worker/worker.go#L148)

알림은 worker 처리 시점의 DB 상태/수신자를 읽는다. 게시글은 ACT+활성 게시판+is_post_alarm이 필요하고 기존 `is_send_alarm`에 따라 POST_ALARM/UPDATE_POST_ALARM 템플릿을 고른다. notice는 ACT+is_notice_alarm+미발송 latch를 보며 badge 여부를 별도로 요구하지 않는다. 댓글은 게시글/부모댓글 작성자 분기이고, 공감 알림 actor 목록은 처리시점의 최근3명이다. 수신자 필터는 회사/게시판 알림설정 및 부서 관계를 쓰며 HTTP Read 판정과 완전히 같지 않다. [`internal/transport/worker/alarmdelivery.go:97`](../../internal/transport/worker/alarmdelivery.go#L97) [`internal/transport/worker/alarmdelivery.go:167`](../../internal/transport/worker/alarmdelivery.go#L167) [`internal/transport/worker/alarmdelivery.go:303`](../../internal/transport/worker/alarmdelivery.go#L303) [`internal/transport/worker/alarmdelivery.go:497`](../../internal/transport/worker/alarmdelivery.go#L497)

템플릿 언어는 worker의 고정 `ko`; 요청 Lang를 그대로 사용하지 않는다. 템플릿 없음/잘못된JSON이면 skip한다. 웹훅 네트워크 오류는 job 재시도 대상이지만 **HTTP 비2xx는 전달 호출의 error가 아니어서** 발송 latch가 설정될 수 있다. 전송 후 DB 로그 실패는 재시도를 만들어 중복 알림이 가능하다. commit→enqueue 사이 유실을 보상하는 outbox는 이 경로에 없다. 프론트는 발송 플래그로 실제 수신 완료를 보장하면 안 된다. [`internal/transport/worker/alarmdelivery.go:26`](../../internal/transport/worker/alarmdelivery.go#L26) [`internal/transport/worker/alarmdelivery.go:593`](../../internal/transport/worker/alarmdelivery.go#L593) [`internal/platform/webhook/client.go:139`](../../internal/platform/webhook/client.go#L139) [`internal/transport/httpapi/board/handler.go:268`](../../internal/transport/httpapi/board/handler.go#L268)

선택적 request log는 인증 거절도 기록하며 자격증명은 마스킹한다. handler 이후 DB 기록을 수행하고 실패는 응답을 바꾸지 않는다. query 정규화 전 값을 저장하며 최대64KiB 본문, 별도5초 쓰기 기한이다. [`internal/transport/httpapi/middleware/requestlog.go:29`](../../internal/transport/httpapi/middleware/requestlog.go#L29) [`internal/transport/httpapi/middleware/requestlog.go:119`](../../internal/transport/httpapi/middleware/requestlog.go#L119)

## 등록 라우트 전수 대조표

`TestRouteTable`은 실제 `testRouter → NewRouter → gin.Engine.Routes()`에서 표를 생성하며 production `AuthPolicy.Contract` 결과를 함께 정렬한다. 2026-09-08 실행에서 checked-in golden과 일치했다. **스테일하지 않아 golden 갱신 없음.** 각 행의 근거는 golden의 정확한 행이며 제외행은 소비자/계약/조립 근거를 추가했다. [`internal/transport/httpapi/routetable_test.go:32`](../../internal/transport/httpapi/routetable_test.go#L32) [`internal/transport/httpapi/routetable_test.go:54`](../../internal/transport/httpapi/routetable_test.go#L54) [`internal/transport/httpapi/router_test.go:35`](../../internal/transport/httpapi/router_test.go#L35)

| # | 계약 | METHOD 전체 경로 | 분류 | 문서 또는 제외 사유·근거 |
| ---: | --- | --- | --- | --- |
| 1 | board | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}` | 문서화 대상 | [04-board.md](04-board.md) — [`internal/transport/httpapi/testdata/routes.txt:1`](../../internal/transport/httpapi/testdata/routes.txt#L1) |
| 2 | board | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}` | 문서화 대상 | [03-category.md](03-category.md) — [`internal/transport/httpapi/testdata/routes.txt:2`](../../internal/transport/httpapi/testdata/routes.txt#L2) |
| 3 | board | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}` | 문서화 대상 | [07-post-comment-like.md](07-post-comment-like.md) — [`internal/transport/httpapi/testdata/routes.txt:3`](../../internal/transport/httpapi/testdata/routes.txt#L3) |
| 4 | board | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/drive-files` | 문서화 대상 | [09-drive-file.md](09-drive-file.md) — [`internal/transport/httpapi/testdata/routes.txt:4`](../../internal/transport/httpapi/testdata/routes.txt#L4) |
| 5 | board | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/purge` | 문서화 대상 | [09-drive-file.md](09-drive-file.md) — [`internal/transport/httpapi/testdata/routes.txt:5`](../../internal/transport/httpapi/testdata/routes.txt#L5) |
| 6 | board | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/folders` | 문서화 대상 | [08-drive-folder.md](08-drive-folder.md) — [`internal/transport/httpapi/testdata/routes.txt:6`](../../internal/transport/httpapi/testdata/routes.txt#L6) |
| 7 | board | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/posts` | 문서화 대상 | [06-post-write.md](06-post-write.md) — [`internal/transport/httpapi/testdata/routes.txt:7`](../../internal/transport/httpapi/testdata/routes.txt#L7) |
| 8 | board | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/posts/purge` | 문서화 대상 | [06-post-write.md](06-post-write.md) — [`internal/transport/httpapi/testdata/routes.txt:8`](../../internal/transport/httpapi/testdata/routes.txt#L8) |
| 9 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/attachments/{id}/download-url` | 문서화 대상 | [05-post-read.md](05-post-read.md) — [`internal/transport/httpapi/testdata/routes.txt:9`](../../internal/transport/httpapi/testdata/routes.txt#L9) |
| 10 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}` | 문서화 대상 | [04-board.md](04-board.md) — [`internal/transport/httpapi/testdata/routes.txt:10`](../../internal/transport/httpapi/testdata/routes.txt#L10) |
| 11 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive` | 문서화 대상 | [08-drive-folder.md](08-drive-folder.md) — [`internal/transport/httpapi/testdata/routes.txt:11`](../../internal/transport/httpapi/testdata/routes.txt#L11) |
| 12 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive/folder-tree` | 문서화 대상 | [08-drive-folder.md](08-drive-folder.md) — [`internal/transport/httpapi/testdata/routes.txt:12`](../../internal/transport/httpapi/testdata/routes.txt#L12) |
| 13 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/notices` | 문서화 대상 | [06-post-write.md](06-post-write.md) — [`internal/transport/httpapi/testdata/routes.txt:13`](../../internal/transport/httpapi/testdata/routes.txt#L13) |
| 14 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/bookmarks` | 문서화 대상 | [04-board.md](04-board.md) — [`internal/transport/httpapi/testdata/routes.txt:14`](../../internal/transport/httpapi/testdata/routes.txt#L14) |
| 15 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/categories` | 문서화 대상 | [03-category.md](03-category.md) — [`internal/transport/httpapi/testdata/routes.txt:15`](../../internal/transport/httpapi/testdata/routes.txt#L15) |
| 16 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}` | 문서화 대상 | [03-category.md](03-category.md) — [`internal/transport/httpapi/testdata/routes.txt:16`](../../internal/transport/httpapi/testdata/routes.txt#L16) |
| 17 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/categories/admin` | 문서화 대상 | [03-category.md](03-category.md) — [`internal/transport/httpapi/testdata/routes.txt:17`](../../internal/transport/httpapi/testdata/routes.txt#L17) |
| 18 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/categories/management` | 문서화 대상 | [03-category.md](03-category.md) — [`internal/transport/httpapi/testdata/routes.txt:18`](../../internal/transport/httpapi/testdata/routes.txt#L18) |
| 19 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}/likes` | 문서화 대상 | [07-post-comment-like.md](07-post-comment-like.md) — [`internal/transport/httpapi/testdata/routes.txt:19`](../../internal/transport/httpapi/testdata/routes.txt#L19) |
| 20 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files` | 문서화 대상 | [09-drive-file.md](09-drive-file.md) — [`internal/transport/httpapi/testdata/routes.txt:20`](../../internal/transport/httpapi/testdata/routes.txt#L20) |
| 21 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}` | 문서화 대상 | [09-drive-file.md](09-drive-file.md) — [`internal/transport/httpapi/testdata/routes.txt:21`](../../internal/transport/httpapi/testdata/routes.txt#L21) |
| 22 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}/download-url` | 문서화 대상 | [09-drive-file.md](09-drive-file.md) — [`internal/transport/httpapi/testdata/routes.txt:22`](../../internal/transport/httpapi/testdata/routes.txt#L22) |
| 23 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/bookmarks` | 문서화 대상 | [09-drive-file.md](09-drive-file.md) — [`internal/transport/httpapi/testdata/routes.txt:23`](../../internal/transport/httpapi/testdata/routes.txt#L23) |
| 24 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/mine` | 문서화 대상 | [09-drive-file.md](09-drive-file.md) — [`internal/transport/httpapi/testdata/routes.txt:24`](../../internal/transport/httpapi/testdata/routes.txt#L24) |
| 25 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts` | 문서화 대상 | [05-post-read.md](05-post-read.md) — [`internal/transport/httpapi/testdata/routes.txt:25`](../../internal/transport/httpapi/testdata/routes.txt#L25) |
| 26 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}` | 문서화 대상 | [05-post-read.md](05-post-read.md) — [`internal/transport/httpapi/testdata/routes.txt:26`](../../internal/transport/httpapi/testdata/routes.txt#L26) |
| 27 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/likes` | 문서화 대상 | [07-post-comment-like.md](07-post-comment-like.md) — [`internal/transport/httpapi/testdata/routes.txt:27`](../../internal/transport/httpapi/testdata/routes.txt#L27) |
| 28 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/views` | 문서화 대상 | [07-post-comment-like.md](07-post-comment-like.md) — [`internal/transport/httpapi/testdata/routes.txt:28`](../../internal/transport/httpapi/testdata/routes.txt#L28) |
| 29 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/bookmarks` | 문서화 대상 | [05-post-read.md](05-post-read.md) — [`internal/transport/httpapi/testdata/routes.txt:29`](../../internal/transport/httpapi/testdata/routes.txt#L29) |
| 30 | board | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/mine` | 문서화 대상 | [05-post-read.md](05-post-read.md) — [`internal/transport/httpapi/testdata/routes.txt:30`](../../internal/transport/httpapi/testdata/routes.txt#L30) |
| 31 | board | `GET /api/v1/board/me` | 문서화 대상 | [01-auth-user.md](01-auth-user.md) — [`internal/transport/httpapi/testdata/routes.txt:31`](../../internal/transport/httpapi/testdata/routes.txt#L31) |
| 32 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards` | 문서화 대상 | [04-board.md](04-board.md) — [`internal/transport/httpapi/testdata/routes.txt:32`](../../internal/transport/httpapi/testdata/routes.txt#L32) |
| 33 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/bookmark` | 문서화 대상 | [04-board.md](04-board.md) — [`internal/transport/httpapi/testdata/routes.txt:33`](../../internal/transport/httpapi/testdata/routes.txt#L33) |
| 34 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive-uploads` | 문서화 대상 | [10-upload-department-client.md](10-upload-department-client.md) — [`internal/transport/httpapi/testdata/routes.txt:34`](../../internal/transport/httpapi/testdata/routes.txt#L34) |
| 35 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/folders` | 문서화 대상 | [08-drive-folder.md](08-drive-folder.md) — [`internal/transport/httpapi/testdata/routes.txt:35`](../../internal/transport/httpapi/testdata/routes.txt#L35) |
| 36 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/posts` | 문서화 대상 | [06-post-write.md](06-post-write.md) — [`internal/transport/httpapi/testdata/routes.txt:36`](../../internal/transport/httpapi/testdata/routes.txt#L36) |
| 37 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/categories` | 문서화 대상 | [03-category.md](03-category.md) — [`internal/transport/httpapi/testdata/routes.txt:37`](../../internal/transport/httpapi/testdata/routes.txt#L37) |
| 38 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}/like` | 문서화 대상 | [07-post-comment-like.md](07-post-comment-like.md) — [`internal/transport/httpapi/testdata/routes.txt:38`](../../internal/transport/httpapi/testdata/routes.txt#L38) |
| 39 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}/bookmark` | 문서화 대상 | [09-drive-file.md](09-drive-file.md) — [`internal/transport/httpapi/testdata/routes.txt:39`](../../internal/transport/httpapi/testdata/routes.txt#L39) |
| 40 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}/upload-complete` | 문서화 대상 | [10-upload-department-client.md](10-upload-department-client.md) — [`internal/transport/httpapi/testdata/routes.txt:40`](../../internal/transport/httpapi/testdata/routes.txt#L40) |
| 41 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/restore` | 문서화 대상 | [09-drive-file.md](09-drive-file.md) — [`internal/transport/httpapi/testdata/routes.txt:41`](../../internal/transport/httpapi/testdata/routes.txt#L41) |
| 42 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/post-views` | 문서화 대상 | [06-post-write.md](06-post-write.md) — [`internal/transport/httpapi/testdata/routes.txt:42`](../../internal/transport/httpapi/testdata/routes.txt#L42) |
| 43 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/bookmark` | 문서화 대상 | [06-post-write.md](06-post-write.md) — [`internal/transport/httpapi/testdata/routes.txt:43`](../../internal/transport/httpapi/testdata/routes.txt#L43) |
| 44 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/comments` | 문서화 대상 | [07-post-comment-like.md](07-post-comment-like.md) — [`internal/transport/httpapi/testdata/routes.txt:44`](../../internal/transport/httpapi/testdata/routes.txt#L44) |
| 45 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/like` | 문서화 대상 | [07-post-comment-like.md](07-post-comment-like.md) — [`internal/transport/httpapi/testdata/routes.txt:45`](../../internal/transport/httpapi/testdata/routes.txt#L45) |
| 46 | board | `POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/restore` | 문서화 대상 | [06-post-write.md](06-post-write.md) — [`internal/transport/httpapi/testdata/routes.txt:46`](../../internal/transport/httpapi/testdata/routes.txt#L46) |
| 47 | board | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}` | 문서화 대상 | [04-board.md](04-board.md) — [`internal/transport/httpapi/testdata/routes.txt:47`](../../internal/transport/httpapi/testdata/routes.txt#L47) |
| 48 | board | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/my-notification` | 문서화 대상 | [04-board.md](04-board.md) — [`internal/transport/httpapi/testdata/routes.txt:48`](../../internal/transport/httpapi/testdata/routes.txt#L48) |
| 49 | board | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/notices` | 문서화 대상 | [06-post-write.md](06-post-write.md) — [`internal/transport/httpapi/testdata/routes.txt:49`](../../internal/transport/httpapi/testdata/routes.txt#L49) |
| 50 | board | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}` | 문서화 대상 | [03-category.md](03-category.md) — [`internal/transport/httpapi/testdata/routes.txt:50`](../../internal/transport/httpapi/testdata/routes.txt#L50) |
| 51 | board | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}/my-notification` | 문서화 대상 | [03-category.md](03-category.md) — [`internal/transport/httpapi/testdata/routes.txt:51`](../../internal/transport/httpapi/testdata/routes.txt#L51) |
| 52 | board | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/category-tree` | 문서화 대상 | [02-management.md](02-management.md) — [`internal/transport/httpapi/testdata/routes.txt:52`](../../internal/transport/httpapi/testdata/routes.txt#L52) |
| 53 | board | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}` | 문서화 대상 | [07-post-comment-like.md](07-post-comment-like.md) — [`internal/transport/httpapi/testdata/routes.txt:53`](../../internal/transport/httpapi/testdata/routes.txt#L53) |
| 54 | board | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/folders/{id}` | 문서화 대상 | [08-drive-folder.md](08-drive-folder.md) — [`internal/transport/httpapi/testdata/routes.txt:54`](../../internal/transport/httpapi/testdata/routes.txt#L54) |
| 55 | board | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}` | 문서화 대상 | [06-post-write.md](06-post-write.md) — [`internal/transport/httpapi/testdata/routes.txt:55`](../../internal/transport/httpapi/testdata/routes.txt#L55) |
| 56 | exempt | `GET /api/v1/client-versions` | 문서화 대상 | [10-upload-department-client.md](10-upload-department-client.md) — [`internal/transport/httpapi/testdata/routes.txt:56`](../../internal/transport/httpapi/testdata/routes.txt#L56) |
| 57 | exempt | `GET /api/v1/onpremise/bundle-downloads/{token}` | 제외 | 서명 provisioning bundle 다운로드 토큰 소비자; 게시글/자료실 다운로드와 다른 배포 경로. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:57`](../../internal/transport/httpapi/testdata/routes.txt#L57) |
| 58 | exempt | `GET /docs` | 제외 | Huma 개발자 문서/OpenAPI/JSON Schema; 게시판 업무 데이터 계약 없음. [`internal/transport/httpapi/router.go:353`](../../internal/transport/httpapi/router.go#L353) [`internal/transport/httpapi/testdata/routes.txt:58`](../../internal/transport/httpapi/testdata/routes.txt#L58) |
| 59 | exempt | `GET /healthz` | 제외 | ALB·프로세스 liveness probe; 사용자 데이터/board 계약 없음. [`internal/transport/httpapi/router.go:423`](../../internal/transport/httpapi/router.go#L423) [`internal/transport/httpapi/testdata/routes.txt:59`](../../internal/transport/httpapi/testdata/routes.txt#L59) |
| 60 | exempt | `GET /image/resize/{size}` | 문서화 대상 | [10-upload-department-client.md](10-upload-department-client.md) — [`internal/transport/httpapi/testdata/routes.txt:60`](../../internal/transport/httpapi/testdata/routes.txt#L60) |
| 61 | exempt | `GET /openapi-3.0.json` | 제외 | Huma 개발자 문서/OpenAPI/JSON Schema; 게시판 업무 데이터 계약 없음. [`internal/transport/httpapi/router.go:353`](../../internal/transport/httpapi/router.go#L353) [`internal/transport/httpapi/testdata/routes.txt:61`](../../internal/transport/httpapi/testdata/routes.txt#L61) |
| 62 | exempt | `GET /openapi-3.0.yaml` | 제외 | Huma 개발자 문서/OpenAPI/JSON Schema; 게시판 업무 데이터 계약 없음. [`internal/transport/httpapi/router.go:353`](../../internal/transport/httpapi/router.go#L353) [`internal/transport/httpapi/testdata/routes.txt:62`](../../internal/transport/httpapi/testdata/routes.txt#L62) |
| 63 | exempt | `GET /openapi.json` | 제외 | Huma 개발자 문서/OpenAPI/JSON Schema; 게시판 업무 데이터 계약 없음. [`internal/transport/httpapi/router.go:353`](../../internal/transport/httpapi/router.go#L353) [`internal/transport/httpapi/testdata/routes.txt:63`](../../internal/transport/httpapi/testdata/routes.txt#L63) |
| 64 | exempt | `GET /openapi.yaml` | 제외 | Huma 개발자 문서/OpenAPI/JSON Schema; 게시판 업무 데이터 계약 없음. [`internal/transport/httpapi/router.go:353`](../../internal/transport/httpapi/router.go#L353) [`internal/transport/httpapi/testdata/routes.txt:64`](../../internal/transport/httpapi/testdata/routes.txt#L64) |
| 65 | exempt | `GET /schemas/{schema}` | 제외 | Huma 개발자 문서/OpenAPI/JSON Schema; 게시판 업무 데이터 계약 없음. [`internal/transport/httpapi/router.go:353`](../../internal/transport/httpapi/router.go#L353) [`internal/transport/httpapi/testdata/routes.txt:65`](../../internal/transport/httpapi/testdata/routes.txt#L65) |
| 66 | exempt | `POST /api/v1/board/login` | 문서화 대상 | [01-auth-user.md](01-auth-user.md) — [`internal/transport/httpapi/testdata/routes.txt:66`](../../internal/transport/httpapi/testdata/routes.txt#L66) |
| 67 | exempt | `POST /api/v1/board/refresh` | 문서화 대상 | [01-auth-user.md](01-auth-user.md) — [`internal/transport/httpapi/testdata/routes.txt:67`](../../internal/transport/httpapi/testdata/routes.txt#L67) |
| 68 | exempt | `POST /api/v1/board/token` | 문서화 대상 | [01-auth-user.md](01-auth-user.md) — [`internal/transport/httpapi/testdata/routes.txt:68`](../../internal/transport/httpapi/testdata/routes.txt#L68) |
| 69 | member | `GET /api/v1/companies/{company_id}/departments` | 문서화 대상 | [10-upload-department-client.md](10-upload-department-client.md) — [`internal/transport/httpapi/testdata/routes.txt:69`](../../internal/transport/httpapi/testdata/routes.txt#L69) |
| 70 | member | `GET /api/v1/companies/{company_id}/users/{user_id}/client-versions` | 문서화 대상 | [10-upload-department-client.md](10-upload-department-client.md) — [`internal/transport/httpapi/testdata/routes.txt:70`](../../internal/transport/httpapi/testdata/routes.txt#L70) |
| 71 | member | `PATCH /api/v1/companies/{company_id}/settings` | 문서화 대상 | [02-management.md](02-management.md) — [`internal/transport/httpapi/testdata/routes.txt:71`](../../internal/transport/httpapi/testdata/routes.txt#L71) |
| 72 | member | `PATCH /api/v1/companies/{company_id}/settings/users/me` | 문서화 대상 | [02-management.md](02-management.md) — [`internal/transport/httpapi/testdata/routes.txt:72`](../../internal/transport/httpapi/testdata/routes.txt#L72) |
| 73 | member | `POST /api/v1/companies/{company_id}/admins` | 문서화 대상 | [02-management.md](02-management.md) — [`internal/transport/httpapi/testdata/routes.txt:73`](../../internal/transport/httpapi/testdata/routes.txt#L73) |
| 74 | member | `POST /api/v1/companies/{company_id}/settings` | 문서화 대상 | [02-management.md](02-management.md) — [`internal/transport/httpapi/testdata/routes.txt:74`](../../internal/transport/httpapi/testdata/routes.txt#L74) |
| 75 | member | `PUT /api/v1/companies/{company_id}/settings/users/me/recent-search-keywords` | 문서화 대상 | [02-management.md](02-management.md) — [`internal/transport/httpapi/testdata/routes.txt:75`](../../internal/transport/httpapi/testdata/routes.txt#L75) |
| 76 | service | `DELETE /api/v1/onpremise/tenants/{id}` | 제외 | onpremise 배포/환경설정용 Service credential; board 프론트 member/board 계약과 분리. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:76`](../../internal/transport/httpapi/testdata/routes.txt#L76) |
| 77 | service | `GET /api/v1/onpremise/env-defaults` | 제외 | onpremise 배포/환경설정용 Service credential; board 프론트 member/board 계약과 분리. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:77`](../../internal/transport/httpapi/testdata/routes.txt#L77) |
| 78 | service | `GET /api/v1/onpremise/env-defaults/{id}` | 제외 | onpremise 배포/환경설정용 Service credential; board 프론트 member/board 계약과 분리. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:78`](../../internal/transport/httpapi/testdata/routes.txt#L78) |
| 79 | service | `GET /api/v1/onpremise/tenants` | 제외 | onpremise 배포/환경설정용 Service credential; board 프론트 member/board 계약과 분리. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:79`](../../internal/transport/httpapi/testdata/routes.txt#L79) |
| 80 | service | `GET /api/v1/onpremise/tenants/{id}` | 제외 | onpremise 배포/환경설정용 Service credential; board 프론트 member/board 계약과 분리. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:80`](../../internal/transport/httpapi/testdata/routes.txt#L80) |
| 81 | service | `GET /api/v1/onpremise/tenants/{id}/bundle` | 제외 | onpremise 배포/환경설정용 Service credential; board 프론트 member/board 계약과 분리. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:81`](../../internal/transport/httpapi/testdata/routes.txt#L81) |
| 82 | service | `GET /api/v1/onpremise/tenants/{id}/bundle-contents` | 제외 | onpremise 배포/환경설정용 Service credential; board 프론트 member/board 계약과 분리. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:82`](../../internal/transport/httpapi/testdata/routes.txt#L82) |
| 83 | service | `GET /api/v1/onpremise/tenants/{id}/change-logs` | 제외 | onpremise 배포/환경설정용 Service credential; board 프론트 member/board 계약과 분리. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:83`](../../internal/transport/httpapi/testdata/routes.txt#L83) |
| 84 | service | `POST /api/v1/onpremise/tenants` | 제외 | onpremise 배포/환경설정용 Service credential; board 프론트 member/board 계약과 분리. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:84`](../../internal/transport/httpapi/testdata/routes.txt#L84) |
| 85 | service | `POST /api/v1/onpremise/tenants/{id}/bundle-url` | 제외 | onpremise 배포/환경설정용 Service credential; board 프론트 member/board 계약과 분리. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:85`](../../internal/transport/httpapi/testdata/routes.txt#L85) |
| 86 | service | `POST /api/v1/onpremise/tenants/{id}/memo` | 제외 | onpremise 배포/환경설정용 Service credential; board 프론트 member/board 계약과 분리. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:86`](../../internal/transport/httpapi/testdata/routes.txt#L86) |
| 87 | service | `POST /api/v1/onpremise/tenants/{id}/resync-env` | 제외 | onpremise 배포/환경설정용 Service credential; board 프론트 member/board 계약과 분리. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:87`](../../internal/transport/httpapi/testdata/routes.txt#L87) |
| 88 | service | `PUT /api/v1/onpremise/env-defaults/{id}` | 제외 | onpremise 배포/환경설정용 Service credential; board 프론트 member/board 계약과 분리. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:88`](../../internal/transport/httpapi/testdata/routes.txt#L88) |
| 89 | service | `PUT /api/v1/onpremise/tenants/{id}` | 제외 | onpremise 배포/환경설정용 Service credential; board 프론트 member/board 계약과 분리. [`internal/transport/httpapi/router.go:409`](../../internal/transport/httpapi/router.go#L409) [`internal/transport/httpapi/testdata/routes.txt:89`](../../internal/transport/httpapi/testdata/routes.txt#L89) |

## Laravel 72개 → Go 이행 대조표

72개는 Laravel의 `/api/v1` **71개**와 web의 `/image/resize/{size}` **1개**다. `RouteServiceProvider`의 `/api` prefix를 적용해 전체 경로를 복원했다. 별도로 존재하는 `/api/user`(sanctum), `/api/test`, web `/`는 이72개에 포함되지 않는다. 71개 라우트 선언을 직접 전수 추출했으며 주석 처리된 경로는 제외했다. [`jupiter-board-api/app/Providers/RouteServiceProvider.php:31`](../../../jupiter-board-api/app/Providers/RouteServiceProvider.php#L31) [`jupiter-board-api/routes/api.php:36`](../../../jupiter-board-api/routes/api.php#L36) [`jupiter-board-api/routes/web.php:21`](../../../jupiter-board-api/routes/web.php#L21)

**모든 행에 적용되는 차이:** Go board 리소스는 `{company_id}/{user_id}` scope와 자체 board token을 사용하고, 관리·조직은 OfficeWave member token이다. 공통 에러 봉투/400·422 차이도 적용된다. 표에서 연결한 Go 도메인 문서가 필드·권한·응답의 상세 근거이며, 구체적인 Go 경로 존재는 바로 위89행 전수표로 확인한다. Laravel 경로만 바꾸고 기존 payload/DTO를 그대로 재사용하지 않는다. [`internal/transport/httpapi/router.go:440`](../../internal/transport/httpapi/router.go#L440) [`internal/transport/httpapi/router.go:149`](../../internal/transport/httpapi/router.go#L149)

`없음`은 **동일 기능의 독립 endpoint가 없음**을 뜻한다. 대체 API가 있는지와 없는지를 각각 적었다. 예정 여부는 실행 코드로 제품 로드맵을 확정할 수 없으므로, 코드 내 예정 근거가 없는 기능을 `예정 근거 없음`으로 표시한다. 이는 임의의 예정 날짜나 제품팀의 무계획을 만들어낸 표현이 아니다.

| # | Laravel METHOD 전체 경로·근거 | 대응 Go METHOD 전체 경로(없으면 없음) | 계약 차이·Go 근거 | 프론트 조치 |
| ---: | --- | --- | --- | --- |
| 1 | `POST /api/v1/token` [`jupiter-board-api/routes/api.php:38`](../../../jupiter-board-api/routes/api.php#L38) | `POST /api/v1/board/token` | Go 전용 HS256 access+opaque refresh를 발급 — [01-auth-user.md](01-auth-user.md) | 기존 토큰 저장소를 OfficeWave/board로 분리 |
| 2 | `POST /api/v1/login` [`jupiter-board-api/routes/api.php:39`](../../../jupiter-board-api/routes/api.php#L39) | `POST /api/v1/board/login` | OfficeNext password grant 뒤 local sync_id 조회; refresh 포함 — [01-auth-user.md](01-auth-user.md) | 200 TokenBody 저장; upstream status 및 local404 처리 |
| 3 | `GET /api/v1/me` [`jupiter-board-api/routes/api.php:42`](../../../jupiter-board-api/routes/api.php#L42) | `GET /api/v1/board/me` | board bearer; 회사·개인설정 null 및 일부 날짜PG9 — [01-auth-user.md](01-auth-user.md) | 공유 DTO와 날짜 분기 적용 |
| 4 | `POST /api/v1/management/admin` [`jupiter-board-api/routes/api.php:45`](../../../jupiter-board-api/routes/api.php#L45) | `POST /api/v1/companies/{company_id}/admins` | board bearer가 아닌 member 계약 — [02-management.md](02-management.md) | OfficeWave 토큰; duplicate403 code 처리 |
| 5 | `POST /api/v1/management/company-setting` [`jupiter-board-api/routes/api.php:47`](../../../jupiter-board-api/routes/api.php#L47) | `POST /api/v1/companies/{company_id}/settings` | companySetting 경로ID 없음; member 계약 — [02-management.md](02-management.md) | POST로 생성; 중복500 code 처리 |
| 6 | `POST /api/v1/management/company-setting/{companySetting}` [`jupiter-board-api/routes/api.php:48`](../../../jupiter-board-api/routes/api.php#L48) | `PATCH /api/v1/companies/{company_id}/settings` | POST+companySetting UUID → PATCH+company scope — [02-management.md](02-management.md) | 회사설정ID 경로 제거; 필드 생략/null 구분 |
| 7 | `PUT /api/v1/management/user-setting/search-keyword` [`jupiter-board-api/routes/api.php:51`](../../../jupiter-board-api/routes/api.php#L51) | `PUT /api/v1/companies/{company_id}/settings/users/me/recent-search-keywords` | member 계약; 배열 전체 대체;8개 초과 잘림 — [02-management.md](02-management.md) | 최근검색어 배열 전송; null/생략은 비우기 |
| 8 | `POST /api/v1/management/user-setting/{companySetting}` [`jupiter-board-api/routes/api.php:52`](../../../jupiter-board-api/routes/api.php#L52) | `PATCH /api/v1/companies/{company_id}/settings/users/me` | POST+companySetting → PATCH+현재유저 — [02-management.md](02-management.md) | 토큰 user 기준; 회사설정ID 제거 |
| 9 | `POST /api/v1/management/category/edit` [`jupiter-board-api/routes/api.php:56`](../../../jupiter-board-api/routes/api.php#L56) | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/category-tree` | 다섯 정렬 경로를 통합 — [02-management.md](02-management.md) | positions 또는 legacy map 계약에 맞춰 PUT |
| 10 | `POST /api/v1/management/category` [`jupiter-board-api/routes/api.php:57`](../../../jupiter-board-api/routes/api.php#L57) | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/category-tree` | 최상위 카테고리 정렬 통합 — [02-management.md](02-management.md) | categories map/positions 전송 |
| 11 | `POST /api/v1/management/category/{category}` [`jupiter-board-api/routes/api.php:58`](../../../jupiter-board-api/routes/api.php#L58) | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/category-tree` | 부모별 카테고리 경로 제거 — [02-management.md](02-management.md) | 부모별 기존 카테고리의 순서를 통합 본문 형식으로 전송 |
| 12 | `POST /api/v1/management/board` [`jupiter-board-api/routes/api.php:62`](../../../jupiter-board-api/routes/api.php#L62) | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/category-tree` | 공용 게시판 정렬 통합 — [02-management.md](02-management.md) | boards map/positions 및 회사관리자 조건 적용 |
| 13 | `POST /api/v1/management/board/{category}` [`jupiter-board-api/routes/api.php:63`](../../../jupiter-board-api/routes/api.php#L63) | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/category-tree` | 카테고리별 게시판 정렬 통합 — [02-management.md](02-management.md) | 기존 게시판의 순서를 통합 본문 형식으로 전송 |
| 14 | `GET /api/v1/category` [`jupiter-board-api/routes/api.php:68`](../../../jupiter-board-api/routes/api.php#L68) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/categories` | scoped tree; PHP truthy 옵션 존재 — [03-category.md](03-category.md) | with_category_admin 직렬화 규칙 적용 |
| 15 | `GET /api/v1/category/admin` [`jupiter-board-api/routes/api.php:69`](../../../jupiter-board-api/routes/api.php#L69) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/categories/admin` | scoped 관리자 트리 — [03-category.md](03-category.md) | 일반 트리와 권한/포함 관계 구분 |
| 16 | `GET /api/v1/category/management` [`jupiter-board-api/routes/api.php:70`](../../../jupiter-board-api/routes/api.php#L70) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/categories/management` | scoped 관리 트리 — [03-category.md](03-category.md) | 일반 목록과 동일 DTO로 뭉개지 않기 |
| 17 | `POST /api/v1/category` [`jupiter-board-api/routes/api.php:71`](../../../jupiter-board-api/routes/api.php#L71) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/categories` | Huma400과 domain422 분리 — [03-category.md](03-category.md) | strict body DTO 및 멤버/부서/관리자 입력 규칙 적용 |
| 18 | `GET /api/v1/category/{category}` [`jupiter-board-api/routes/api.php:72`](../../../jupiter-board-api/routes/api.php#L72) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}` | UUID/권한 판정 및 제한된 관계 — [03-category.md](03-category.md) | 전체 관리트리와 별도 DTO 사용 |
| 19 | `PUT /api/v1/category/{category}` [`jupiter-board-api/routes/api.php:73`](../../../jupiter-board-api/routes/api.php#L73) | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}` | scope는 claim; patch식 nullable/omission 처리 — [03-category.md](03-category.md) | 실제 PUT 사용; 비운 배열과 생략 구분 |
| 20 | `DELETE /api/v1/category/{category}` [`jupiter-board-api/routes/api.php:74`](../../../jupiter-board-api/routes/api.php#L74) | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}` | soft-delete 및 자손 영향 — [03-category.md](03-category.md) | 응답 필드/연쇄부수효과 표 적용 |
| 21 | `PUT /api/v1/category/member/{category}` [`jupiter-board-api/routes/api.php:77`](../../../jupiter-board-api/routes/api.php#L77) | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}/my-notification` | 멤버 명단 변경이 아니라 현재유저 알림설정 — [03-category.md](03-category.md) | 멤버관리 UI에서 호출하지 말고 알림 토글로 연결 |
| 22 | `GET /api/v1/board` [`jupiter-board-api/routes/api.php:82`](../../../jupiter-board-api/routes/api.php#L82) | **없음** | 독립 게시판 목록 API 없음; 대체 수단 있음 — [03-category.md](03-category.md) | 북마크 용도는 GET scoped /bookmarks로 대체. 일반 목록은 categories 트리/ID별 boards로 부분 대체; 전역 필터/페이지 동등성은 없음 |
| 23 | `POST /api/v1/board` [`jupiter-board-api/routes/api.php:83`](../../../jupiter-board-api/routes/api.php#L83) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards` | category_id/body로 위치 지정; Drive 옵션 도메인검증 — [04-board.md](04-board.md) | 기본값과 DRIVE size_limit 규칙 적용 |
| 24 | `GET /api/v1/board/{board}` [`jupiter-board-api/routes/api.php:84`](../../../jupiter-board-api/routes/api.php#L84) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}` | Read와 관리권한의 응답 판정 — [04-board.md](04-board.md) | 04 DTO·권한 전문 적용 |
| 25 | `PUT /api/v1/board/{board}` [`jupiter-board-api/routes/api.php:85`](../../../jupiter-board-api/routes/api.php#L85) | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}` | 게시판 유형 변경/size_limit 결합검증 — [04-board.md](04-board.md) | 변경 후 유형에 맞게 필드 생략 |
| 26 | `DELETE /api/v1/board/{board}` [`jupiter-board-api/routes/api.php:86`](../../../jupiter-board-api/routes/api.php#L86) | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}` | soft-delete 및 관계 정리 — [04-board.md](04-board.md) | 삭제 성공 후 목록 재조회 |
| 27 | `POST /api/v1/board/bookmark/{board}` [`jupiter-board-api/routes/api.php:87`](../../../jupiter-board-api/routes/api.php#L87) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/bookmark` | 북마크 토글과 저장행 응답 — [04-board.md](04-board.md) | 응답/조회 bookmark 플래그 기준 갱신 |
| 28 | `POST /api/v1/board/member/{board}` [`jupiter-board-api/routes/api.php:90`](../../../jupiter-board-api/routes/api.php#L90) | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/my-notification` | POST member → PUT 내 알림 — [04-board.md](04-board.md) | 멤버 추가 API로 사용하지 않기 |
| 29 | `POST /api/v1/post/badge` [`jupiter-board-api/routes/api.php:96`](../../../jupiter-board-api/routes/api.php#L96) | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/notices` | POST badge → board별 PUT notices — [06-post-write.md](06-post-write.md) | 게시판별 요청 분리; ignored_ids/부분실패 처리 |
| 30 | `GET /api/v1/post/badge/{board}` [`jupiter-board-api/routes/api.php:97`](../../../jupiter-board-api/routes/api.php#L97) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/notices` | 명시 notices 경로 — [06-post-write.md](06-post-write.md) | 일반 posts와 공지 필드/정렬 구분 |
| 31 | `POST /api/v1/post/bookmark/{post}` [`jupiter-board-api/routes/api.php:99`](../../../jupiter-board-api/routes/api.php#L99) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/bookmark` | scoped bookmark 토글 — [06-post-write.md](06-post-write.md) | 200 result를 따라 갱신 |
| 32 | `POST /api/v1/post/comment/{post}` [`jupiter-board-api/routes/api.php:102`](../../../jupiter-board-api/routes/api.php#L102) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/comments` | post ID가 부모 리소스 경로 — [07-post-comment-like.md](07-post-comment-like.md) | JSON body 사용; parent 댓글 검증 적용 |
| 33 | `PUT /api/v1/post/comment/{comment}` [`jupiter-board-api/routes/api.php:103`](../../../jupiter-board-api/routes/api.php#L103) | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}` | 댓글 독립 리소스; 생략/null 차이 — [07-post-comment-like.md](07-post-comment-like.md) | multipart 대신 JSON+실제 PUT |
| 34 | `DELETE /api/v1/post/comment/{comment}` [`jupiter-board-api/routes/api.php:104`](../../../jupiter-board-api/routes/api.php#L104) | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}` | 댓글 독립 리소스; soft-delete — [07-post-comment-like.md](07-post-comment-like.md) | 답글/공감 부수효과 확인 후 UI 갱신 |
| 35 | `GET /api/v1/post/main` [`jupiter-board-api/routes/api.php:107`](../../../jupiter-board-api/routes/api.php#L107) | **없음** | 메인 위젯 집계 응답 없음; 부분 대체 수단 있음 — [05-post-read.md](05-post-read.md) | 명시 폐기 결정: docs/board-api/POST_SPEC.md:95. 위젯별 posts/drive-files 조합으로 부분 대체; /me에 위젯 설정이 없어 별도 공급 필요 |
| 36 | `GET /api/v1/post/my` [`jupiter-board-api/routes/api.php:108`](../../../jupiter-board-api/routes/api.php#L108) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/mine` | my → mine; is_bookmark의 문자열 truthiness — [05-post-read.md](05-post-read.md) | "false" 사용 금지; state/봉투 조건 준수 |
| 37 | `GET /api/v1/post` [`jupiter-board-api/routes/api.php:109`](../../../jupiter-board-api/routes/api.php#L109) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts` | 목록 scope추가; paging/비paging 분기 — [05-post-read.md](05-post-read.md) | query 상한·필터·sort 표 적용 |
| 38 | `GET /api/v1/post/{post}` [`jupiter-board-api/routes/api.php:110`](../../../jupiter-board-api/routes/api.php#L110) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}` | 접근 시 읽음 부수효과; 응답관계 변환 — [05-post-read.md](05-post-read.md) | 직접 파일 src 대신 첨부 download-url 이용 |
| 39 | `POST /api/v1/post/read` [`jupiter-board-api/routes/api.php:112`](../../../jupiter-board-api/routes/api.php#L112) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/post-views` | read → post-views; bulk 결과 — [06-post-write.md](06-post-write.md) | id 배열 표기와 ignored_ids 처리 |
| 40 | `POST /api/v1/post/restore` [`jupiter-board-api/routes/api.php:113`](../../../jupiter-board-api/routes/api.php#L113) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/restore` | 복원 batch; 댓글 연쇄복원 — [06-post-write.md](06-post-write.md) | 부분실패와 연관 댓글 재조회 |
| 41 | `POST /api/v1/post/{board}` [`jupiter-board-api/routes/api.php:114`](../../../jupiter-board-api/routes/api.php#L114) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/posts` | POST post/{board} → boards/{id}/posts — [06-post-write.md](06-post-write.md) | 게시판ID와 게시글ID 변수 분리 |
| 42 | `PUT /api/v1/post/{post}` [`jupiter-board-api/routes/api.php:115`](../../../jupiter-board-api/routes/api.php#L115) | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}` | 저자 권한; 전송 destination board 선검증 — [06-post-write.md](06-post-write.md) | 현재 board_id도 불필요하면 생략; multipart 미지원 |
| 43 | `DELETE /api/v1/post/delete` [`jupiter-board-api/routes/api.php:116`](../../../jupiter-board-api/routes/api.php#L116) | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/posts` | delete 접미사 제거; 저자 bulk 규칙 — [06-post-write.md](06-post-write.md) | query id[] 또는 JSON ids; ignored_ids 표시 |
| 44 | `DELETE /api/v1/post/permanent` [`jupiter-board-api/routes/api.php:117`](../../../jupiter-board-api/routes/api.php#L117) | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/posts/purge` | permanent → purge; DB표시와 객체청소 분리 — [06-post-write.md](06-post-write.md) | 즉시 외부 객체 삭제를 보장하지 않기 |
| 45 | `DELETE /api/v1/post/{post}` [`jupiter-board-api/routes/api.php:118`](../../../jupiter-board-api/routes/api.php#L118) | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/posts?id={id}` | 정식 등록은 bulk. DELETE posts/{UUID} hidden alias도 존재 — [06-post-write.md](06-post-write.md) | 신규 프론트는 bulk의 단일id 사용; 관리자도 author 규칙 |
| 46 | `GET /api/v1/post/view/{post}` [`jupiter-board-api/routes/api.php:120`](../../../jupiter-board-api/routes/api.php#L120) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/views` | view → views; 조회자 관계/페이지 — [07-post-comment-like.md](07-post-comment-like.md) | read 호출과 조회자 목록 API 분리 |
| 47 | `POST /api/v1/post/like/{post}` [`jupiter-board-api/routes/api.php:124`](../../../jupiter-board-api/routes/api.php#L124) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/like` | scoped 공감 토글 — [07-post-comment-like.md](07-post-comment-like.md) | emoji 입력/길이 규칙과 자기 공감 분기 적용 |
| 48 | `GET /api/v1/post/like/{post}` [`jupiter-board-api/routes/api.php:125`](../../../jupiter-board-api/routes/api.php#L125) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}/likes` | like → GET likes — [07-post-comment-like.md](07-post-comment-like.md) | 공감 타입 필터/목록 응답 적용 |
| 49 | `POST /api/v1/post/like/comment/{comment}` [`jupiter-board-api/routes/api.php:129`](../../../jupiter-board-api/routes/api.php#L129) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}/like` | post/like/comment → comments/{id}/like — [07-post-comment-like.md](07-post-comment-like.md) | 댓글 UUID 사용 |
| 50 | `GET /api/v1/post/like/comment/{comment}` [`jupiter-board-api/routes/api.php:130`](../../../jupiter-board-api/routes/api.php#L130) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/comments/{id}/likes` | 댓글 리소스 아래 GET likes — [07-post-comment-like.md](07-post-comment-like.md) | 목록필드/필터 계약 적용 |
| 51 | `GET /api/v1/department` [`jupiter-board-api/routes/api.php:135`](../../../jupiter-board-api/routes/api.php#L135) | `GET /api/v1/companies/{company_id}/departments` | 암묵 company → path scope; member bearer — [10-upload-department-client.md](10-upload-department-client.md) | 토큰company 명시; 루트없음200 빈Body 처리 |
| 52 | `GET /api/v1/department/{companyId}` [`jupiter-board-api/routes/api.php:137`](../../../jupiter-board-api/routes/api.php#L137) | `GET /api/v1/companies/{company_id}/departments` | 다른 회사 조회 불가; exact scope403 — [10-upload-department-client.md](10-upload-department-client.md) | 현재 토큰회사만 조회 |
| 53 | `POST /api/v1/drive/folder/{board}` [`jupiter-board-api/routes/api.php:141`](../../../jupiter-board-api/routes/api.php#L141) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/folders` | 명시 boards 하위 folder 생성 — [08-drive-folder.md](08-drive-folder.md) | board와 folder ID 분리 |
| 54 | `PUT /api/v1/drive/folder/{driveFolder}` [`jupiter-board-api/routes/api.php:142`](../../../jupiter-board-api/routes/api.php#L142) | `PUT /api/v1/board/companies/{company_id}/users/{user_id}/folders/{id}` | root 이동 null이 유지로 처리되는 현재 구현 — [08-drive-folder.md](08-drive-folder.md) | 이동UI에서 null로 루트이동 완료표시 금지 |
| 55 | `DELETE /api/v1/drive/folder/board/{board}` [`jupiter-board-api/routes/api.php:143`](../../../jupiter-board-api/routes/api.php#L143) | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/folders` | board별 bulk를 통합 — [08-drive-folder.md](08-drive-folder.md) | 선택 폴더 UUID를 JSON ids 또는 id 배열로 전송. board_id와 query 대상목록은 받지 않음 |
| 56 | `DELETE /api/v1/drive/folder/{driveFolder}` [`jupiter-board-api/routes/api.php:144`](../../../jupiter-board-api/routes/api.php#L144) | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/folders` | 단건 경로 제거; bulk로 통합 — [08-drive-folder.md](08-drive-folder.md) | JSON ids 배열 한 원소로 전송. 성공은 삭제된 UUID 배열, 비어 있지 않은 폴더는200에서 제외 |
| 57 | `GET /api/v1/drive/file` [`jupiter-board-api/routes/api.php:148`](../../../jupiter-board-api/routes/api.php#L148) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files` | state 무시 ACT목록; scoped — [09-drive-file.md](09-drive-file.md) | 휴지통은 mine state경로 사용 |
| 58 | `GET /api/v1/drive/file/my` [`jupiter-board-api/routes/api.php:149`](../../../jupiter-board-api/routes/api.php#L149) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/mine` | my → mine; bookmark PHP truthiness — [09-drive-file.md](09-drive-file.md) | false 문자열 대신0/생략, state 조합 명시 |
| 59 | `GET /api/v1/drive/file/{driveFile}` [`jupiter-board-api/routes/api.php:150`](../../../jupiter-board-api/routes/api.php#L150) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}` | 공개 src/object_key 없음 — [09-drive-file.md](09-drive-file.md) | download-url 발급 후 내려받기 |
| 60 | `DELETE /api/v1/drive/file` [`jupiter-board-api/routes/api.php:151`](../../../jupiter-board-api/routes/api.php#L151) | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/drive-files` | 소유자 또는 관리권한의 통합 batch; JSON body 배열만 — [09-drive-file.md](09-drive-file.md) | result ignored_ids 검사 |
| 61 | `DELETE /api/v1/drive/file/permanent` [`jupiter-board-api/routes/api.php:152`](../../../jupiter-board-api/routes/api.php#L152) | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/purge` | permanent → purge — [09-drive-file.md](09-drive-file.md) | 물리파일은 정리worker와 분리 |
| 62 | `DELETE /api/v1/drive/file/{driveFile}` [`jupiter-board-api/routes/api.php:153`](../../../jupiter-board-api/routes/api.php#L153) | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/drive-files` | 단건 경로 제거; bulk — [09-drive-file.md](09-drive-file.md) | JSON ids 배열 한 원소; {affected,ignored_ids} 검사. 단건 별칭 없음 |
| 63 | `DELETE /api/v1/drive/file/board/{board}` [`jupiter-board-api/routes/api.php:154`](../../../jupiter-board-api/routes/api.php#L154) | `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/drive-files` | board별 삭제 통합 — [09-drive-file.md](09-drive-file.md) | 선택 UUID만 JSON ids/id 배열로 전송. board_id로 범위를 좁히지 않으므로 선택목록을 정확히 구성 |
| 64 | `POST /api/v1/drive/file/bookmark/{driveFile}` [`jupiter-board-api/routes/api.php:155`](../../../jupiter-board-api/routes/api.php#L155) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}/bookmark` | scoped 파일 bookmark — [09-drive-file.md](09-drive-file.md) | 응답 현재상태에 맞춰 토글 |
| 65 | `POST /api/v1/drive/file/restore` [`jupiter-board-api/routes/api.php:156`](../../../jupiter-board-api/routes/api.php#L156) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/restore` | bulk 복원으로 계약 고정 — [09-drive-file.md](09-drive-file.md) | 복원가능성과 ignored_ids 처리 |
| 66 | `POST /api/v1/drive/pre-signed-url/multiple/{board}` [`jupiter-board-api/routes/api.php:159`](../../../jupiter-board-api/routes/api.php#L159) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive-uploads` | 예약과 presigned PUT URL 배열; success/fail 부분결과 — [10-upload-department-client.md](10-upload-department-client.md) | 최대10개, result별 판단 후 PUT |
| 67 | `POST /api/v1/drive/pre-signed-url/{board}` [`jupiter-board-api/routes/api.php:160`](../../../jupiter-board-api/routes/api.php#L160) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive-uploads` | 단건 endpoint 없음; files 배열1개로 대체 — [10-upload-department-client.md](10-upload-department-client.md) | 단건을 files:[...]로 포장; 배열응답 해제 |
| 68 | `POST /api/v1/drive/callback` [`jupiter-board-api/routes/api.php:161`](../../../jupiter-board-api/routes/api.php#L161) | `POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}/upload-complete` | callback → board인증/경로file_id. Body file_id/object_key 무시 — [10-upload-department-client.md](10-upload-department-client.md) | 예약응답 file_id 사용, HEAD결과 state가 ACT인지 확인 |
| 69 | `GET /api/v1/drive/{board}` [`jupiter-board-api/routes/api.php:163`](../../../jupiter-board-api/routes/api.php#L163) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive` | 폴더 목록과 용량 응답; 파일은 별도 drive-files 조회 — [08-drive-folder.md](08-drive-folder.md) | query sort/filter와 응답봉투 따르기 |
| 70 | `GET /api/v1/drive/tree/{board}` [`jupiter-board-api/routes/api.php:164`](../../../jupiter-board-api/routes/api.php#L164) | `GET /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive/folder-tree` | 폴더 트리 명시경로 — [08-drive-folder.md](08-drive-folder.md) | children 관계와 is_open 처리 |
| 71 | `GET /api/v1/live` [`jupiter-board-api/routes/api.php:167`](../../../jupiter-board-api/routes/api.php#L167) | **없음** | Live 모델 조회 endpoint 없음; 대체 없음 — [`internal/transport/httpapi/router.go:367`](../../internal/transport/httpapi/router.go#L367) [`internal/transport/worker/worker.go:148`](../../internal/transport/worker/worker.go#L148) | 대체 없음·현재 이식 계획 없음(기본 미이식, 최종 제품 결정 별도). docs/board-api/DECISION_LOG.md:2694 |
| 72 | `GET /image/resize/{size}` [`jupiter-board-api/routes/web.php:21`](../../../jupiter-board-api/routes/web.php#L21) | `GET /image/resize/{size}` | Go는 key prefix 검사·크기제한·302 CDN 또는 원본; [10-upload-department-client.md](10-upload-department-client.md) | 전체 URL 대신 허용 S3 key를 image_url로 전달, 원본과302 분기 처리 |

신규 Go의 `/refresh`, 범용 bookmark 트리·전용 post/drive bookmark 목록·첨부/파일 download-url·클라이언트 버전은 위72개와1:1 행이 없는 추가 계약이다. 이전 목록에 없었다는 이유로 누락하지 않았으며89행 전수표에 모두 포함했다. [`internal/transport/httpapi/router.go:367`](../../internal/transport/httpapi/router.go#L367) [`internal/transport/httpapi/board/routes.go:39`](../../internal/transport/httpapi/board/routes.go#L39)

## 완료 검증 기록

2026-09-08, 위 조사 기준 커밋에서 다음을 검증했다. 등록 수는 실제 gin 라우터와 golden의 일치 결과이며, 문서 검사는 Markdown의 엔드포인트 제목·필수 절·curl 명령·링크를 추출하여 수행했다.

| 검증 항목 | 결과 |
| --- | --- |
| 등록 라우트와 README 전수표 | **89행 완전 일치**, 중복·누락 0 |
| 분류 | **문서화 67 + 제외 22 = 89**; 제외 22행 모두 개별 사유·근거 있음 |
| 도메인 문서 합계 | **67개**, README 문서 목록·전수표와 동일 |
| 엔드포인트 필수 항목 | **67 × 8 = 536절**, 누락 0; 없음인 입력도 명시 |
| Laravel 이행표 | **72행**, PHP 등록 경로와 대조; Go 대응 경로는 등록표 또는 명시한 hidden alias로 확인 |
| curl | **211개**: 도메인 208개 + README hidden 경로 3개. 도메인 예시 중 1개는 S3 PUT이며 나머지 API 호출은 등록/재작성 경로와 대조 |
| 예시별 검사 | 엔드포인트당 **2~5개**; 셸 구문, 변수 치환 후 JSON 문법, METHOD·경로 불일치 **0건** |
| 링크·인용 | 새 문서의 상대링크 대상 파일·Markdown 앵커 오류 **0건**; 인용한 소스 파일·행 범위 오류 **0건** |
| 남은 조사 항목 | 코드에서 판정할 계약의 미조사 **0건**. 코드 밖의 값은 상단에 모은 **3개**이며 각각 이유·확인 위치 명시 |
| 이전 문서 대조 | 전체 diff 후 코드로 재검증한 유효한 프론트 계약 정보의 **잔여 누락 0건** |
| 수정 범위 | 문서만 작성·이동. 소스·마이그레이션·라우트 golden 변경 없음; 작업 전의 `.env.example` 변경 보존 |

| 파일 | 엔드포인트 | 필수 절 | curl |
| --- | ---: | ---: | ---: |
| 01-auth-user.md | 4 | 32 | 12 |
| 02-management.md | 6 | 48 | 16 |
| 03-category.md | 8 | 64 | 20 |
| 04-board.md | 7 | 56 | 20 |
| 05-post-read.md | 5 | 40 | 18 |
| 06-post-write.md | 9 | 72 | 29 |
| 07-post-comment-like.md | 8 | 64 | 27 |
| 08-drive-folder.md | 5 | 40 | 15 |
| 09-drive-file.md | 9 | 72 | 31 |
| 10-upload-department-client.md | 6 | 48 | 20 |
| **도메인 합계** | **67** | **536** | **208** |

실행하여 통과한 검사는 `go test ./internal/transport/httpapi -run '^TestRouteTable' -count=1`, `go test ./... -race -count=1`, `make test-integration`이다. 마지막 명령은 Docker 기반 저장소 통합 테스트를 포함한 `go test -tags integration -race ./... -count=1`이다. 라우트 golden은 스테일하지 않아 갱신하지 않았다. curl은 위 정적 검사까지 수행했으며 실제 운영 토큰·데이터로 211개 요청을 전송한 것은 아니다. 실행할 때는 [공통 준비](#curl-setup)와 각 예시의 권한·데이터 조건을 충족해야 한다.

조사에는 그래프 탐색과 직접 소스 확인을 함께 사용했다. 그래프의 Go 최신 문법·SQL 파싱 누락은 해당 소스를 직접 읽어 보완했고, 라우트 전수성은 그래프 검색 결과가 아니라 실제 router를 조립하는 테스트로 검증했다. [`internal/transport/httpapi/routetable_test.go:32`](../../internal/transport/httpapi/routetable_test.go#L32)

### 원본 보존과 마지막 diff 대조

작업 시작 당시 `doc/api/`에는 미추적 파일 2개가 있었고, `doc/api-prev/`에는 그보다 앞선 11개 문서가 이미 있었다. 현재 원본 2개는 `git add -N` 후 **git mv**로 이동하여 [원본 README](../api-prev/README.md)·[원본 인증 문서](../api-prev/01-auth-user.md)로 보존했다. 충돌하던 선행 백업 11개는 [api-prev/earlier/README.md](../api-prev/earlier/README.md)와 같은 디렉터리에 보존했다. 백업 13개 모두 이동 전후 SHA-256이 같아 내용 변경은 없다.

새 본문과 대조표를 먼저 완성한 뒤에만 백업 13개를 읽고 `git diff --no-index`로 비교했다. 전문을 다시 썼으므로 텍스트 diff가 비어 있다는 의미가 아니다. 아래는 마지막 비교에서 복원하거나 현재 코드로 정정한 정보다. 각 계약의 근거는 연결한 새 도메인 문서에 있다.

| 대조 범위 | 코드 재검증 후 반영 내용 | 잔여 유효 정보 누락 |
| --- | --- | ---: |
| README·Laravel 경로 | 공통 인증·숨은 경로·72개 매핑 및 폐기/대체 조치 | 0 |
| [01 인증·유저](01-auth-user.md) | refresh 슬라이딩 만료·설정 부재/부팅 오류·사용자 SQL 값·관리자 동기화 회수·OperationID | 0 |
| [02 관리](02-management.md)·[03 카테고리](03-category.md)·[04 게시판](04-board.md) | 정렬 form 입력·soft-delete/동기화·권한 필드 차이·삭제 잠금/경합·리터럴 오류 문구 | 0 |
| [05 조회](05-post-read.md)·[06 쓰기](06-post-write.md)·[07 댓글·공감](07-post-comment-like.md) | 페이지 누락 필드·빈 query·정렬·최근검색어·동기 읽음·첨부/배지 처리 순서·복원/삭제 부수효과 | 0 |
| [08 폴더](08-drive-folder.md)·[09 파일](09-drive-file.md) | 폴더 이동/잠금·정렬·북마크 복구/시각·페이지 필드·purge 재호출·서명 URL·오류 문구 | 0 |
| [10 업로드·부서·이미지·버전](10-upload-department-client.md) | 완료 Body 생략/null·업로더 권한·예약 결과 대응·이미지 포맷/캐시·부서 루트/빈값 처리 | 0 |

이전 문서의 동작 설명 중 현재 코드와 다른 내용은 정정했다. 예를 들어 optional null의 일괄 거부, gin 오류의 한국어 응답, 읽음 처리의 비동기 설명, 폴더 트리가 항상 같다는 설명, per-file null이 무제한이라는 설명은 현재 계약으로 사용하지 않는다. 각각 [Huma 공통 규칙](#schema-field), [공통 헤더](#공통-규약과-curl-실행-준비), [게시글 조회](05-post-read.md), [자료실 폴더](08-drive-folder.md)에 실제 동작과 근거를 적었다.

## 발견한 이슈

이번 작업에서는 아래 코드·계약 불일치를 수정하지 않고 프론트에 영향을 주는 현재 동작으로 기록했다.

| 이슈 | 실제 영향·근거 |
| --- | --- |
| 스키마와 런타임 null 검증 차이 | Huma는 optional property의 null 검증을 건너뛰어 nullable:false 스키마여도 실제 입력이 통과한다. 아래 라이브러리 근거와 각 도메인의 유지를 구분해야 한다. [Huma validate.go:855](https://github.com/danielgtaylor/huma/blob/v2.39.0/validate.go#L855) |
| 입력 배열 인코딩 전처리의 대소문자 차이 | `%5b`만 있는 query는 정규화를 건너뛸 수 있다. `internal/transport/httpapi/middleware/queryarray.go:42` |
| 관리설정 CHECK 오류가500으로 노출 | latest_post_day<=0 등 일부값은 Huma가 막지 않고 DB에서 실패한다. `internal/transport/httpapi/management/setting.go:35`, `migrations/board/000001_initial_schema.sql:903` |
| 메인 위젯 조회 API 없음 | 위젯 수정은 있지만 /me에 company_main_boards가 없다. `/post/main`은 폐기 결정되어 별도 화면 구성이 필요하다. `internal/transport/httpapi/board/dto.go:231`, `internal/domain/board/management.go:245`, `docs/board-api/POST_SPEC.md:95` |
| 업로드 예약은 음수크기를 형식검증에서 받음 | DB CHECK 실패로 배치 transaction 전체500; presign 실패 시에는 이미 예약이 commit되어 남는다. `internal/transport/httpapi/board/driveuploadbody.go:44`, `migrations/board/000001_initial_schema.sql:824`, `internal/transport/httpapi/board/driveupload.go:93` |
| 삭제된 폴더를 업로드/자식폴더 부모로 지정 가능 | 존재검사에 deleted_at 조건이 없다. `internal/domain/board/driveuploadquery.go:117`, `internal/domain/board/folderquery.go:112` |
| 폴더 수정 null로 루트 이동 불가 | parent_id:nil은 유지이며 명시null과 생략이 구별되지 않는다. `internal/domain/board/folderquery.go:251` |
| 파일 복원이 과거 해제 북마크도 복원 | 복원 UPDATE의 범위가 넓다. `internal/domain/board/drivefilewritequery.go:228` |
| S3 삭제와 파일 복원 경합 | purge가 객체를 지운 뒤 DB hard-delete에서 복원을 감지하면 행은 살아 있고 파일 bytes는 사라질 수 있다. `internal/transport/worker/drivepurge.go:135`, `internal/domain/board/drivepurge.go:150` |
| 게시글 복원은 기존 개별 삭제 댓글까지 활성화 | restore가 자식 댓글을 일괄 활성화한다. `internal/domain/board/postwritequery.go:535` |
| purge 게시글 직접조회 조건 누락 | 작성자 직접 상세조회에서 purged_at를 별도로 걸러내지 않는 경로가 있다. `internal/domain/board/postdetailquery.go:190`, `internal/domain/board/postdetailquery.go:645` |
| 알림 성공 플래그가 외부 배달 성공과 불일치 | 비2xx webhook도 error=nil로 진행할 수 있다. `internal/platform/webhook/client.go:139`, `internal/transport/worker/alarmdelivery.go:593` |
| 관리자 복원 응답 created_at 차이 | DB created_at는 유지되지만 핸들러 응답은 현재시각을 만들 수 있다. `internal/transport/httpapi/management/setting.go:148`, `internal/domain/board/management.go:44` |
| 카테고리 삭제와 자식 생성 snapshot 경합 | 잠금 대기 중 생성된 자식이 삭제 대상 snapshot에서 빠져 삭제 부모 아래 live 자식이 남을 수 있다. `internal/domain/board/categorydelete.go:92` |
| 게시글 last_page 덧셈 overflow | take 상한이 없는 게시글 목록에서 극단적인 take와 total 조합은 last_page가 음수가 될 수 있다. `internal/domain/board/postlist.go:344` |
| BOARD_DRIVE_BOUNDARY 문구와 판정 불일치 | 메시지는 타입 변경 불가라고 하지만 실제 전환 허용 경로가 있다. `internal/transport/httpapi/board/boards.go:141`, `internal/domain/board/boardwrite.go:353` |
| bookmark 페이지 정수 곱의 overflow 가능 | take 상한이 없어 page×take 계산이 int 범위를 넘을 수 있다. `internal/transport/httpapi/board/bookmarks.go:161` |
| 이미 적용한 initial과 최신 refresh DDL의 차이 | 개발 중 refresh_tokens 생성 DDL을 initial에 합친 이력이 있어, 그 이전 initial을 적용한 DB는 일반 migrate up만으로 refresh 테이블이 생기지 않을 수 있다. 로그인은 토큰 저장 시500이다. 기존 DB의 증분 반영이 필요하다. `migrations/board/000001_initial_schema.sql:1158`, `internal/transport/httpapi/board/token.go:209`; Git `f7a60e13` |
