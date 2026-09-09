# 로그인을 OfficeWave 계약으로 전환 — 결정 기록

- 작성일: 2026-09-09 / 대상 브랜치: `feat/drive-renewal`
- 계기: `oc-api-go` @ **`ebff9af`** 에서 `board` 인증 계약이 폐지되고 자격증명 3경로
  (`POST /api/v1/board/{token,login,refresh}`)가 삭제됐다. 게시판 표면 64경로는 URL 이 그대로이고
  계약만 `member`(OfficeWave ES256)로 바뀌었다 →
  [백엔드 통지문](../../api/backend-replies/board-auth-contract-change.md) · 대장
  [BR-036](../../api/backend-requests.md#br-036)
- 한 줄: **자격증명만 OfficeWave 로 보내고, 받은 ES256 토큰을 그대로 Go 에 싣는다.** ID/PW 화면은 유지한다.

> ⚠️ **이 전환은 Go 계약이 아니다.** `docs/api/go/` 에는 이 경로가 없고, 그 사본 자체가 `65b7f49`
> 기준으로 스테일이다(→ `docs/api/README.md` 최상단). 근거는 **형제 프론트의 실동작 코드**이며,
> 백엔드가 다른 획득 방식을 지정하면 §5 의 조건으로 되돌린다.

---

## 1. 무엇을 근거로 골랐나 (직접 확인한 것만)

| #   | 사실                                                                                                                                                                                               | 근거                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | 브라우저 로그인은 `POST /api/v1/oauth/login` password grant                                                                                                                                        | `oc-web-messenger/services/auth.ts:48` — `{grant_type,type:'browser',authority:'normal'}`        |
| 2   | 그 경로는 `cin` 을 요구하지 않는다(`POST /login` 은 요구한다) → **로그인 화면에 필드를 추가하지 않아도 된다**                                                                                      | `oc-api-laravel` 검증 규칙 `AccountController:485-523`                                           |
| 3   | `client_id`/`client_secret` 은 서버가 들고 통합인증(`SYNC_HOST`)에 대리 전송한다 → 프론트에 비밀값이 없다                                                                                          | `AccountController:619`                                                                          |
| 4   | 응답에 `access_token`·`refresh_token`·`token_type`·`expired_in`(초)·`company_id`·`user_id`·`scopes`·`agent_id`·`cin`·`mfa` 등이 온다                                                               | `AccountController:773-793`                                                                      |
| 5   | 두 레포의 ES256 공개키가 **동일**하다 → OfficeWave 토큰이 Go 의 member 게이트를 통과한다                                                                                                           | `oc-api-go/keys/jwtES256.key.pub` = `oc-api-laravel/storage/keys/jwtES256.key.pub` (sha256 일치) |
| 6   | Go 의 member 조건: ES256 · `exp` 필수(5분 leeway) · `iss` **호스트**가 `JWT_ISSUER_DOMAINS` 에 속함 · `scopes` 에 `ROLE_MEMBER` · `PathScope` 가 `company_id`/`user_id` 를 URL 과 대조(불일치 403) | `oc-api-go/internal/auth/jwt.go:100-200` · `router.go:333`                                       |
| 7   | **Go 는 미지 쿼리 파라미터를 거절하지 않는다** — `RejectUnknownQueryParameters` 가 코드 전체에 미설정이고 huma 기본값이 false                                                                      | `oc-api-go` 전체 검색 0건 · `huma.go:883`                                                        |
| 8   | 브라우저 로그인은 Agent 행을 만들지 않아 응답 `agent_id` 가 **항상 null** 이고, JWT 에도 **하드코딩 null** 이 들어간다                                                                             | `AccountController:467` · `OvHelper:120`                                                         |
| 9   | 서버가 **쿼리** `agent_id` 를 읽는 곳은 API 레이트리밋 하나뿐(없으면 `Limit::none()`, 있으면 120회/분)                                                                                             | `RouteServiceProvider:109`                                                                       |
| 10  | 토큰 `sub` 는 **`'Authorization'`** 이다 — `user_id` 가 아니다                                                                                                                                     | `OvHelper:102-121`                                                                               |
| 11  | 브라우저+`normal` 의 수명은 `EXPIRED_TIME`(로컬 7200초). `SESSION_TIME`(1200)은 admin 전용                                                                                                         | `AccountController:786`                                                                          |

## 2. 사용자 결정 (물어서 정한 것)

| #   | 질문                              | 결정                                                                                    |
| --- | --------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | 로그인 엔드포인트                 | **`/oauth/login` password grant**                                                       |
| 2   | `agent_id`                        | **그대로 붙인다** — 단 브라우저는 값이 없으므로 부착 지점만 만들고 값이 없으면 생략한다 |
| 3   | OfficeWave 베이스 URL             | **새 `VITE_OV_API_URL`** (`.env.local`·`.env.example` 편집 승인)                        |
| 4   | 로컬 issuer 불일치                | **내가 `oc-api-go/.env` 의 `JWT_ISSUER_DOMAINS` 한 줄만 수정** (Go 재기동은 사용자)     |
| 5   | `src/lib/apiClient.ts`(보호 파일) | **수정 승인**                                                                           |

## 3. 만료·갱신 — 두 호스트의 규약이 다르다

| 항목        | Go (게시판)                        | OfficeWave (자격증명)                                                   |
| ----------- | ---------------------------------- | ----------------------------------------------------------------------- |
| 만료 신호   | **401** (만료·무효 구분 없음)      | **419** (JWT 만료 → 갱신하라) / 410 세션 만료 / 412 비번변경 / 422 검증 |
| 갱신 경로   | **없다** (refresh 엔드포인트 삭제) | `POST /refresh-token` (본문 `refresh_token`)                            |
| 수명 근거   | 토큰의 `exp` 만 본다(leeway 5분)   | `EXPIRED_TIME`(브라우저+normal, 로컬 7200초)                            |
| 재사용 방지 | —                                  | refresh 는 AgentBrowser 저장값과 대조 → 실질 1회용                      |

**이 앱의 처리**: 갱신 트리거는 **Go 401** 하나다. `apiClient` 가 401 을 받으면 Web Locks 로
직렬화해 OfficeWave 에 한 번만 갱신을 요청하고 원요청을 재시도한다(요청 시점 토큰과 세션 토큰을
비교해 이미 회전했으면 재소비하지 않는다). **갱신이 실패하면(419 포함) 세션을 폐기하고 `/login`
으로 돌린다** — 재시도는 1회뿐이다(`config.authRetry`).

## 4. 구현 — 파일별

| 파일                                  | 내용                                                                                                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/constants/auth.ts`               | 폐지 3경로 삭제. `AUTH_PATHS.me='/board/me'` + `OV_AUTH_PATHS={login:'/oauth/login',refresh:'/refresh-token',logout:'/logout'}`                                            |
| `src/lib/ovApiClient.ts` **신설**     | OfficeWave 전용 axios(`VITE_OV_API_URL`). 로그인엔 Authorization 을 지우고, 그 외엔 Bearer 를 싣는다                                                                       |
| `src/lib/agentQuery.ts` **신설**      | `attachAgentId(config)` — 세션의 `agent_id` 가 **숫자일 때만** `params.agent_id` 를 넣는다. 두 인스턴스가 이 함수 하나를 공유한다                                          |
| `src/lib/apiClient.ts`                | Bearer 를 **모든 요청**에 부착(경로 접두사 조건 삭제) · `isTokenRequest` 삭제 · 401 트리거에서 `/board/` 조건 삭제 · 갱신은 `refreshTokens()` 경유 · `attachAgentId` 한 곳 |
| `src/lib/authStorage.ts`              | 세션에 `company_id`·`user_id`·`agent_id` 추가. `getTokenIdentity()` 를 **세션 우선 + OfficeWave 클레임 폴백**으로 교체                                                     |
| `src/services/authService.ts`         | `login`/`refreshTokens`/`logout` + `assertMemberToken`(`token_type`·토큰쌍·`ROLE_MEMBER`)                                                                                  |
| `src/types/auth.ts`                   | `LoginResponse` 를 OfficeWave 형태로 교체(`expired_in`·`scopes`·`agent_id`…)                                                                                               |
| `src/components/auth/LoginScreen.tsx` | **디자인·문구 불변.** 에러 매핑만 교체(§6)                                                                                                                                 |
| `.env.local` · `.env.example`         | `VITE_OV_API_URL` 추가(로컬 `http://officewave/api/v1`)                                                                                                                    |

**`getTokenIdentity()` 를 왜 손댔나** — 옛 게이트(`claims.iss !== 'oc-api-go/board'`,
`claims.sub !== String(claims.user_id)`)를 그대로 두면 OfficeWave 토큰은 **전부 null** 이 된다.
그러면 `boardApi` 의 스코프 접두사(모든 게시판 경로의 `{company_id}/{user_id}` 접두사)와
`getCurrentUserId()`(자료실 「내 파일」 판정)가 **조용히 전부 죽는다.** 정의만 고치지 않고
소비처(`src/lib/boardApi.ts`·`src/components/drive/DriveScreen.tsx`·`src/services/userService.ts`)까지 확인했다.

## 5. ⚠️ 발명한 값과 되돌릴 조건

근거가 Go 계약에 **없는** 것들이다. 구현 근거로 재사용하지 않는다(→ BR-036 에도 올렸다).

| #   | 발명값                                                                            | 이유                                                                                                          | 되돌릴 조건                                       |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | 로그인 경로·바디(`grant_type:'password'`, `type:'browser'`, `authority:'normal'`) | 형제 프론트 실동작 코드                                                                                       | 백엔드가 다른 획득 방식을 지정하면 전량 폐기      |
| 2   | `VITE_OV_API_URL` 미설정 시 같은 출처 `/api/v1` 로 폴백                           | 두 호스트를 한 출처로 프록시하는 배포도 가능해서                                                              | 운영 주소·프록시 방식이 확정되면 고정값으로       |
| 3   | **`withCredentials` 를 쓰지 않는다**(생태계는 켠다)                               | 이 앱은 쿠키를 하나도 읽지 않는다. 켜면 `ACAO:*` 가 무효가 되어 실패 모드만 늘어난다                          | 서버가 쿠키 세션을 요구하면 켜고 출처를 명시      |
| 4   | 갱신 트리거를 **Go 401 만**으로 한다(만료 전 선제 갱신 없음)                      | `expired_in` 을 신뢰할 근거가 없다(시계 오차·서버 재발급)                                                     | 백엔드가 선제 갱신을 요구하면 타이머 추가         |
| 5   | 갱신 실패는 **종류를 가리지 않고** 세션 폐기                                      | 419/403/500/네트워크 유실 모두 refresh 재소비가 불가능하다                                                    | 백엔드가 재시도 가능한 실패를 구분해 주면 분기    |
| 6   | 로그아웃은 **로컬을 먼저 지우고** 서버에 best-effort 통보                         | 로컬에 토큰이 남는 것이 더 나쁘다                                                                             | —                                                 |
| 7   | 그 통보에 **지우기 전 토큰을 직접 Bearer 로 싣는다**                              | 인터셉터는 스토리지를 읽으므로 이미 비어 있다 → 서버가 대상을 못 정한다                                       | —                                                 |
| 8   | `agent_id` 가 숫자가 아니면 **쿼리 키를 만들지 않는다**                           | 생략·빈값·null 은 같은 뜻이 아니다. 빈값은 레이트리밋 키를 오염시킬 수 있다                                   | PC 에이전트 배포에서 실제 값이 오면 그대로 실린다 |
| 9   | 로컬 `oc-api-go/.env` 의 `JWT_ISSUER_DOMAINS` 에 `officewave` 추가                | Laravel `APP_URL="http://officewave"` → `iss` 호스트가 `officewave` 인데 Go 는 `officewave.co.kr` 만 허용했다 | 운영값은 백엔드 소관 — 프론트가 건드리지 않는다   |
| 10  | `is_required_password_change`·`mfa.mfa_required` 를 **무시하고 로그인 진행**      | 정본에 해당 화면이 없다. 발명하지 않는다                                                                      | 계약·화면을 받으면 구현(→ BR-036 잔여 2·3)        |

## 6. 에러 매핑 (화면 문구는 기존 키 재사용)

| 상태                        | 문구 키                             |
| --------------------------- | ----------------------------------- |
| 403 · 401 · 422             | `login-error`                       |
| 404                         | `login-user-not-found`              |
| **412**(비밀번호 변경 필요) | `login-password-change` **신규 키** |
| 429                         | `login-rate-limited`                |
| `ROLE_MEMBER` 없음          | `login-forbidden`                   |
| 그 외·네트워크              | `login-service-error`               |

## 7. 검증

**통과** — `npx tsc -b --noEmit` · `npm run lint` · `npm run build` · `npm run test`(179) ·
`npm run test:e2e`(13, 전용 포트 5188).

`tests/e2e/auth.spec.ts` 는 삭제된 board 계약 픽스처를 쓰고 있어 **재작성**했다: `/oauth/login`
password grant 바디 대조 · 로그아웃의 `POST /logout` Bearer 확인 · 403 로그인 실패 · 두 탭
단일 갱신(`/refresh-token` 1회) · **갱신 419 → 세션 폐기**. 나머지 E2E 4파일의 로그인 픽스처도
OfficeWave 형태 클레임(`iss:'http://officewave'`·`sub:'Authorization'`·`scopes:['ROLE_MEMBER']`)으로
교체했다. `agent_id` 쿼리 키가 **생기지 않는 것**도 픽스처에서 확인한다.

**아직 하지 않은 것 — 픽스처 통과는 실계정 검증이 아니다.** 실서버 확인은 로컬 Go 재기동
(`JWT_ISSUER_DOMAINS`) 이후에 수행한다: 로그인 200 → `GET /api/v1/board/me` 200 → 목록 1개 200,
그리고 401 → 갱신 1회 → 재시도 200.

## 8. 남은 미확정 → [BR-036](../../api/backend-requests.md#br-036)

① 회사 등급 게이트(`checkPlan`)의 행방 ② `is_required_password_change` 처리 화면
③ `mfa.mfa_required` ④ 운영 OfficeWave 주소·CORS 허용 출처 ⑤ Go 의 `JWT_ISSUER_DOMAINS` 운영값

---

## 9. 부록 — 폐지된 board 로그인 기록 (2026-09-08, 원문 보존)

아래는 이 문서의 **이전 내용**이다. 전제(`POST /api/v1/board/login` · board HS256 토큰 ·
`/board/refresh` 회전)는 `ebff9af` 로 폐지됐지만, **살아 있는 결정**이 섞여 있어 지운다.
지금도 유효한 것: 로그인 화면의 `type=text` + `inputMode=email`(브라우저가 앞뒤 공백을 지우는
동작 회피) · credential 무-trim · 프론트 timeout 30초 · 세션 ID 정책 · Web Locks 직렬화 ·
`/me` 세션별 Query 캐시 · 로그아웃 시 캐시 전량 폐기. 나머지는 위 §1~§8 이 대체한다.

### Go 로그인 연결

2026-09-08. 계약은 [Go 인증 원문](../../api/go/01-auth-user.md), 코드 조사 기준은 feat/settings · 65b7f49다.

### 적용 범위

- 기존 ID/PW 화면에서 POST /api/v1/board/login → board 토큰 저장 → GET /api/v1/board/me → 홈 표시를 연결했다.
- 로그인 화면 디자인을 유지한다. username은 이메일 형식으로 제한하지 않고 공백만 있는 입력은 거절한다. 브라우저의 type=email이 앞뒤 공백을 제거하는 동작을 피하기 위해 type=text·inputMode=email을 사용한다. 입력한 credential 자체는 trim하지 않는다.
- 로그인 서비스는 상위 두 호출의 각8초 제한을 고려해 프론트 요청 timeout을30초로 둔다. 이는 서버 계약에 없는 프론트 대기 정책이며 운영 시간 제한의 확정값이 아니다.
- Go 세션의 access/refresh 쌍은 localStorage의 oc-board-go-session에 한 번에 저장한다. 프론트가 생성한 세션 ID는 로그인마다 바꾸고 refresh 때 유지한다. 이전 oc-board-token/refresh/me는 새 세션에서 재사용하지 않는다.
- board 경로의401에만 회전 갱신 후 한 번 재시도한다. 로그인·교환·refresh는 bearer를 붙이지 않고401 재갱신 대상에서도 제외한다. member 및 미전환 경로에 board 토큰을 보내지 않는다.
- Web Locks로 같은 origin의 탭 간 refresh를 직렬화하고, lock 안에서 최신 저장값을 확인한다. 지원되지 않는 환경에서는 자동 갱신 대신 재인증한다. 이 기능의 배포 조건은 HTTPS 또는 localhost다.
- refresh 실패·응답 유실은 이미 소비됐을 수 있으므로 같은 refresh를 재시도하지 않는다. 새 로그인 세션이 생긴 뒤 도착한 이전 요청·refresh 응답은 새 계정의 토큰이나 데이터로 재생하지 않는다.
- /me는 세션별 Query 캐시를 사용하며 localStorage의 영구 프로필을 읽지 않는다. 토큰과 /me의 회사·사용자가 달라지면 재인증한다. null 관계·이름은 원문대로 보존한다.
- 로그아웃은 토큰과 전체 Query 캐시를 제거한다. 다른 탭의 세션 변경도 감지해 해당 탭을 로그인 화면으로 이동시킨다.
- 오류는 status·Go error.code에 따라 자격증명 오류, 접근 거절, 사용자 미등록, 요청 제한, 서비스 오류를 구분한다.

### 남은 범위와 백엔드 전달

최초 로그인 연결에서는 게시글·카테고리·자료실·설정 서비스를 전환하지 않았다. 이후 메인 조회 전환은 아래 후속 기록으로 구분한다. 로그인 성공이나 목록 전환을 상세·쓰기·설정까지 모두 연동되었다는 뜻으로 쓰지 않는다. OfficeWave 토큰 교환 화면과 member 자격 획득 흐름도 새로 만들지 않았다. 기존 member 공급 계약 요청은 [BR-012](../../api/backend-requests.md#br-012), 나머지 서비스 전환은 [BR-013](../../api/backend-requests.md#br-013)에 남아 있다.

최초16:46 확인에서는 localhost:8090의 인증 면제 경로가 bearer401을 반환했고 CORS의 Lang·Time_zone 허용이 빠져 있었다. 이력은 [최초 백엔드 전달 문서](go-login-backend-handoff.md)에 보존했다. **17:50까지의 백엔드 회신**은 실행65b7f49·인증 설정·DB 스키마 복구 후 실제 사용자 login·me200과 개발 CORS 통과를 기록한다. 이는 [백엔드 작성자의 검사 결과](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/backend-replies/BR-030-BR-031.md)다. [BR-031](../../api/backend-requests.md#br-031)은 개발 환경 해결, [BR-030](../../api/backend-requests.md#br-030)은 실제 토큰의 HTTP refresh 회전·재사용 검증만 남긴다.

### 최초 로그인 연결 검증 이력

- 인증 단위 테스트: 정확한 경로·Body·bearer 제외, 동시401의 단일 refresh, 소비 후 실패의 재사용 방지, 계정 변경 중 늦은 응답, nullable me와 회사 변경, 로그아웃·캐시 정리.
- 브라우저 테스트: 계약 fixture로 login→me→logout, 로그인401 유지, 두 탭의 실제 Web Locks·localStorage 공유와 refresh1회.
- 실제 서버 확인: 비밀값 없는 healthz, 빈 credential Body, 무인증 me, OPTIONS만 호출했다. 실제 계정·토큰 발급 검증과 구분한다.

최종 실행 결과: npm run build·npm run lint 통과, npm run test는10파일124건 통과, npm run test:e2e는 Chromium5건 통과했다. 인증 전용 단위16건과 브라우저3건은 새 Go 계약 fixture를 사용했다. 기존 CSS 예시 문자열의 파싱 경고2건과 큰 청크 경고는 빌드에 남아 있으며 이번 인증 변경에서 해당 소스·번들 분할은 수정하지 않았다. 수정 파일의 Prettier·기존 편집 훅 검사, 전달 문서의 링크, BR31개 요약/본문 일치도 확인했다.

### 후속: 로그인 직후 메인 조회 전환

백엔드의17:50:10~11 실제 요청 진단은 login·me200 뒤 기존 `/board`·`/post`·`/drive/file`·`/category/admin`의401을 확인했다. 이 실패는 **토큰 검증 전 bearer 추출 단계의 missing bearer token**이다. board 토큰을 member 경로까지 전역 첨부하는 변경은 하지 않는다.

기존 서비스의7개 목록 함수(북마크, 게시글 페이지·공지 배열, 자료실 파일 배열·페이지, 일반·관리자 카테고리)를 Go의5개 경로로 전환하는 범위다. 공통 회사/사용자 경로는 board JWT identity를 사용하며, 일반 목록의 페이지 봉투와 `is_not_paging=1`의 직접 배열을 구분한다. 북마크는 `/boards`로 대체하지 않고 `/bookmarks?take=100`을 사용한다. 화면의 병렬 조회와 기존 표시 구성을 유지한다.

전환 경로·원문 근거·남은 실제 계정 확인은 [메인 연결 전달 문서](go-main-backend-handoff.md)에 기록한다. 7개 목록 함수 전환 후 빌드·린트, 단위129건, E2E7건이 통과했다. 이 결과는 위 최초 로그인 연결의124건/5건 결과와 구분하며, E2E의 서버 응답은 Go 계약 fixture다. 실계정 목록 조회·HTTP refresh는 아직 미검증이다.
