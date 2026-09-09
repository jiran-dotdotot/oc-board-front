# Go 로그인 연결 — 백엔드 확인 요청 이력

**후속 상태(2026-09-08 17:50 KST 백엔드 회신 기준): 아래16:46의 차단은 과거 관측이다.** [백엔드 회신](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/backend-replies/BR-030-BR-031.md)에 따르면 실행65b7f49 적용·인증 설정·누락 DB 스키마 복구 후 실제 사용자의 login·me200과5174/5188 개발 CORS 허용을 확인했다. 실제 토큰으로 HTTP refresh 회전·재사용401을 확인하는 작업은 남아 있다. 이 기록은 백엔드 작성자의 서버 로그·검사 결과이며 프론트 작업자가 수행한 실계정 검증이 아니다.

현재 로그인 뒤 메인4개401은 기존 서비스 경로와 bearer 누락에 관한 별도 건이다. [메인 연결 전달 문서](go-main-backend-handoff.md), [BR-013](../../api/backend-requests.md#br-013)을 따른다. 아래 최초 재현과 요청은 이력 보존을 위해 남긴다.

최초 확인 시각: **2026-09-08 16:46:54 KST**. 당시 계정·토큰 없이 로컬 서버의 인증 전 응답과 CORS preflight만 확인했다. 당시 프론트 작업에서는 로그인 성공·실제 토큰 발급을 검증하지 않았다.

## 대상과 기준

- 실행 서버: `http://localhost:8090`, 프론트 설정 `VITE_API_URL=http://localhost:8090/api/v1`
- 프론트 저장소: `/Users/dotdotot/Documents/Workspace/ov/oc-board-front`
- 백엔드 저장소: `/Users/dotdotot/Documents/Workspace/ov/oc-api-go`
- 계약 원본: [백엔드 인증 문서](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/01-auth-user.md), [공통 규칙](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/README.md)
- 문서의 코드 조사 기준: `feat/settings` · `65b7f49f34b0b934e274437a764455af045b99d3`
- 백엔드 로컬 checkout은 위 커밋이다. **8090에서 실행 중인 프로세스의 빌드 커밋은 확인하지 못했다.** 구버전 프로세스·다른 upstream·인증 미들웨어 설정 중 어느 원인인지는 백엔드 확인이 필요하다. 백엔드 코드·프로세스는 변경하지 않았다.

## 1. 인증 면제 3개 경로가 bearer를 요구함 — BR-030

| 요청                                    | 기대                                              | 실제                                   |
| --------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| `GET /healthz`                          | 서버 응답                                         | 200 `{"status":"ok"}`                  |
| `POST /api/v1/board/login`, Body `{}`   | 필수 username/password 누락 → 400 INVALID_PAYLOAD | 401 UNAUTHORIZED, missing bearer token |
| `POST /api/v1/board/token`, Body `{}`   | 필수 token 누락 → 400 INVALID_PAYLOAD             | 401 UNAUTHORIZED, missing bearer token |
| `POST /api/v1/board/refresh`, Body `{}` | 필수 refresh_token 누락 → 400 INVALID_PAYLOAD     | 401 UNAUTHORIZED, missing bearer token |
| `GET /api/v1/board/me`, bearer 없음     | 401                                               | 401 — 정상 대조군                      |

3개 POST의 실제 공통 응답:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "missing bearer token" } }
```

응답 헤더에 `WWW-Authenticate: Bearer`도 포함된다. 본문 자격증명 검증에 진입하기 전에 bearer 인증이 적용되는 것으로 보인다. 근거: [인증 원문 공통 규칙](../../api/go/01-auth-user.md#공통-사항), [login](../../api/go/01-auth-user.md#post-apiv1boardlogin), [refresh](../../api/go/01-auth-user.md#post-apiv1boardrefresh).

재현(실제 계정 불필요):

```bash
curl -i http://localhost:8090/api/v1/board/login \
  -H 'Content-Type: application/json' --data '{}'
curl -i http://localhost:8090/api/v1/board/token \
  -H 'Content-Type: application/json' --data '{}'
curl -i http://localhost:8090/api/v1/board/refresh \
  -H 'Content-Type: application/json' --data '{}'
```

**백엔드 요청**: 8090의 실제 프로세스·컨테이너·프록시 upstream과 빌드 커밋을 확인하고, 지정 기준의 board 인증 경로가 등록된 서버를 실행해 달라. AuthPolicy에서 위 3개 exact 경로는 Authorization 없이 Body를 검증해야 한다. 유효한 자격증명에 대해서는 `BOARD_TOKEN_SECRET`과 `OFFICENEXT_API_URL`/`OFFICENEXT_CLIENT_ID`/`OFFICENEXT_CLIENT_SECRET`의 활성 설정을 확인하되 비밀값을 문서나 대화에 전달하지 않는다.

완료 확인: 빈 Body는400, 실제 개발 계정 login은200 TokenBody, 그 access로 me는200, refresh는 새 토큰 쌍을 반환하고 같은 refresh 재사용은401. **앞의 빈 Body400만 이번 재현의 기대값이며 성공 시나리오는 백엔드 확인 요청이다.**

## 2. 브라우저 CORS에서 Lang·Time_zone 누락 — BR-031

```bash
curl -i -X OPTIONS http://localhost:8090/api/v1/board/me \
  -H 'Origin: http://localhost:5174' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization,content-type,lang,time_zone'
```

실제 응답은204이며 다음 허용 목록만 반환한다.

```text
Access-Control-Allow-Headers: Origin, Content-Type, Authorization, X-Request-ID
```

[새 README의 CORS 계약](../../api/go/README.md#cors숫자시간응답-봉투)은 여기에 `Lang`·`Time_zone`을 포함한다. 현재 응답으로는 해당 헤더를 보내는 교차 출처 브라우저 요청의 preflight가 통과하지 않는다. curl 자체의204를 브라우저 허용 성공으로 보지 않는다.

**백엔드 요청**: 실제 실행 서버의 CORS Allow-Headers에 `Lang`, `Time_zone`을 허용하고 프론트 Origin에서 확인해 달라. 밑줄을 쓰는 `Time_zone`이며 `Time-Zone`으로 대체하지 않는다. 현재 개발 Origin은5174, E2E 전용 Origin은5188이다. 운영 Origin 허용 정책은 별도로 확정한다.

## 회신할 내용

1. 사용 가능한 Go API Base URL과 실행 빌드 커밋.
2. 인증 면제 3개 경로의 빈 Body400 및 개발 계정 login→me→refresh 확인 결과.
3. 실제 프론트 Origin에서 Lang·Time_zone을 포함한 preflight 결과.

관리·조직 API의 OfficeWave member 자격증명은 board 토큰과 별개다. ID/PW login이 이를 반환한다고 프론트에서 가정하지 않으며, 해당 공급 계약은 기존 [BR-012](../../api/backend-requests.md#br-012)에 남아 있다. 이번 로그인 선행 차단 사항은 [BR-030](../../api/backend-requests.md#br-030)·[BR-031](../../api/backend-requests.md#br-031)이다.
