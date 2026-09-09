# 🚨 board 인증 계약 폐지 — 프론트 긴급 통지

- 통지일: 2026-09-09
- 대상 커밋: `feat/settings` @ **`ebff9af`** ("게시판 설정 및 첨부파일 처리 정리")
- 직전 기준: `65b7f49` — `oc-board-front/docs/api/go/` 사본과 이 레포 `doc/api/` 가 근거로 삼던 커밋
- 변경 규모: 167 파일 / +8,269 −9,278

> **한 줄: `board` 인증 계약이 사라지고 게시판 표면 전체가 `member`(OfficeWave ES256) 계약으로 바뀌었다.
> `POST /api/v1/board/token` · `/login` · `/refresh` 세 경로가 제거됐다.**
>
> `oc-board-front` 의 **독립 로그인 경로가 통째로 없어진다.** 이 앱은 현재 상태로는 어떤 게시판 API 도 호출할 수 없다.

---

## 1. 무엇이 바뀌었나

### 1.1 인증 계약 3종으로 축소

`AuthPolicy` 에서 `BoardPrefixes` 가 제거됐다 (`router.go:AuthPolicy()`).
`middleware/auth.go` 에 `ContractBoard` 도 남아 있지 않다.

| 계약 | `65b7f49` | `ebff9af` |
| --- | ---: | ---: |
| `board` | **55** | **0 (폐지)** |
| `member` | 7 | **64** |
| `exempt` | 13 | 10 |
| `service` | 14 | 14 |
| **합계** | **89** | **88** |

`JWTAuth` 의 시그니처도 인자가 하나 줄었다 — board 검증자를 받지 않는다
(`router.go:327` `middleware.JWTAuth(o.Verifier, AuthPolicy())`).

### 1.2 자격증명 엔드포인트 3개 제거

```
POST /api/v1/board/token      ← 삭제
POST /api/v1/board/login      ← 삭제
POST /api/v1/board/refresh    ← 삭제
```

`internal/auth/boardtoken.go` 파일 자체가 삭제됐다 (HS256 자체 발급 토큰 폐지).
`board/token.go` · `board/login.go` · `board/refresh.go` 도 함께 삭제됐다.

현재 `exempt` 계약은 **10개뿐이고 로그인 계열이 하나도 없다**:

```
GET /api/v1/client-versions          GET /openapi.json      GET /openapi-3.0.json
GET /api/v1/onpremise/bundle-downloads/:token               GET /openapi.yaml
GET /docs        GET /healthz        GET /image/resize/:size  GET /openapi-3.0.yaml
GET /schemas/:schema
```

### 1.3 관리·조직 경로가 `/api/v1/board/` 아래로 이사

새 상수 `BoardCompanyPrefix = /api/v1/board/companies/{company_id}` (`router.go:131`).

| 이전 (`65b7f49`) | 현재 (`ebff9af`) |
| --- | --- |
| `GET /api/v1/companies/{c}/departments` | `GET /api/v1/board/companies/{c}/departments` |
| `POST /api/v1/companies/{c}/admins` | `POST /api/v1/board/companies/{c}/admins` |
| `POST /api/v1/companies/{c}/settings` | `POST /api/v1/board/companies/{c}/settings` |
| `PATCH /api/v1/companies/{c}/settings` | `PATCH /api/v1/board/companies/{c}/settings` |
| `PATCH /api/v1/companies/{c}/settings/users/me` | `PATCH /api/v1/board/companies/{c}/settings/users/me` |
| `PUT /api/v1/companies/{c}/settings/users/me/recent-search-keywords` | `PUT /api/v1/board/companies/{c}/settings/users/me/recent-search-keywords` |

**주의: 조직도 경로에 `user_id` 가 없다.** `.../companies/{c}/departments` 이지
`.../companies/{c}/users/{u}/departments` 가 아니다. 나머지 5개도 company 스코프까지만이고
본인은 `/users/me` 리터럴로 표기한다.

### 1.4 신규 라우트 2개

```
GET  /api/v1/board/companies/{c}/users/{u}/drive-files/{id}/thumbnail-url
POST /api/v1/board/companies/{c}/users/{u}/posts/{id}/attachments
```

### 1.5 바뀌지 않은 것

- `GET /api/v1/board/me` — 경로 동일, 계약만 `board` → `member`
- 55개 게시판 리소스 경로의 **URL 은 그대로**. 계약만 `board` → `member`
- `middleware.PathScope` 유지 (`router.go:333`) — `{company_id}`/`{user_id}` 는 여전히 토큰과
  정확히 일치해야 하고 불일치는 403. 정규 십진수만 (`0100` 은 403)
- `service`(onpremise) 14개, `exempt` 의 이미지/클라이언트버전 경로

---

## 2. 프론트에 미치는 영향

### 2.1 즉시 깨지는 것

| 프론트 위치 | 내용 | 현재 결과 |
| --- | --- | --- |
| `src/constants/auth.ts:3-5` | `login: '/board/login'`, `token: '/board/token'`, `refresh: '/board/refresh'` | **3개 경로 모두 서버에 없음** → 401 (미등록 경로도 인증이 먼저 걸린다) |
| `src/services/authService.ts` | Go `/board/login` 호출 | 동일 |
| 게시판/자료실/카테고리 전 호출 | board 토큰을 Bearer 로 전송 | **전부 401** — 서버는 이제 OfficeWave ES256 만 검증한다 |
| `src/services/settingService.ts` | member 전용이라 호출 삭제해 둔 상태 | 경로가 이사했고 계약이 통일돼서 **재작성 필요** |

어제(2026-09-08~09) 붙인 Go 로그인·토큰 회전·`member401` 분리 처리는 **전부 무효**다.

### 2.2 BR 항목 재판정

| BR | 이전 상태 | `ebff9af` 이후 |
| --- | --- | --- |
| **BR-012** (독립 로그인의 member 자격) | 열림 | **해소됨 — 단, 요청한 방식이 아니다.** member 자격을 공급한 게 아니라 board 계약을 없애서 전부 member 로 통일했다. 관리 API 는 이제 호출 가능하지만 **독립 로그인 자체가 사라졌다** |
| **BR-030** (board 인증 면제 경로 실측) | 해결됨 | **무효** — 검증 대상 경로 3개가 삭제됨 |
| **BR-013 ~ BR-017** (프론트 전환 완료분) | 해결됨 | **URL 은 유효하나 인증 헤더 계약이 바뀜** — 토큰 종류 교체 필요 |
| **BR-032** (`is_not_paging`) | 열림 | 재확인 필요. `huma.DefaultConfig` 는 그대로(`router.go:339`)라 근본원인은 남아 있을 가능성이 높지만 board 패키지가 재편돼(`postsbody.go` 삭제) 재측정해야 한다 |
| BR-018 ~ BR-027 | 열림 | 미판정 — 도메인 코드 변경 여부 재확인 필요 |

---

## 3. ❓ 백엔드가 답해야 할 것 — 프론트는 이것 없이 진행 불가

**`oc-board-front` 는 이제 OfficeWave member 토큰(ES256)을 어떻게 획득하는가?**

Go 서비스에 로그인 엔드포인트가 하나도 없으므로, 토큰은 **이 서비스 밖**에서 와야 한다.
아래 중 어느 것인지 확정해 주어야 한다:

1. **상위 SSO/officechat 이 발급** → 발급 경로·갱신·만료 계약과 프론트 전달 방식(쿼리/postMessage/쿠키)을 명시
2. **officechat 웹에 임베드되는 전제** → 독립 실행 모드는 폐기임을 명시
3. **다른 계획** → 그 계획

동시에 다음도 확정이 필요하다:

- **토큰 수명·갱신 방법** — board 토큰은 1h + refresh 회전이었다. member 토큰의 만료/갱신은?
- **`ROLE_MEMBER` 스코프와 `company_id`/`user_id` 클레임** — `PathScope` 가 그대로라 두 클레임이 필수다
- **회사 등급 게이트(Free 차단)는 어디로 갔나** — `checkPlan` 이 `/token`·`/login` 에 있었다.
  member 계약으로 옮기면서 그 게이트가 남아 있는지, 없어졌는지

---

## 4. ⚠️ 백엔드 내부 정리 필요 (프론트 조치 불필요, 참고용)

`ebff9af` 는 코드에서 board 계약을 지웠지만 **`router.go` 주석이 폐지된 것을 그대로 설명하고 있다**:

- `router.go:98-101` — "The four credential/identity endpoints above stay flat on purpose:
  **/token, /login and /refresh** run BEFORE an access token exists…" → 그 세 경로는 존재하지 않는다
- `router.go:113-121` — `BoardCompanyPrefix` 를 "**It is BOARD-contracted**" 라고 설명하고,
  근거로 "both deployed webs call these paths with the token **POST /api/v1/board/token mints**" 를 든다
  → board 계약도 `/token` 도 없다

주석만 스테일한 것이고 **동작은 라우트 표(88개)가 정본**이다. 골든 파일은 신선하다
(`go test ./internal/transport/httpapi -run '^TestRouteTable'` 통과 확인).

---

## 5. 이 레포 문서의 상태

| 문서 | 상태 |
| --- | --- |
| `doc/api/` 11개 (67 엔드포인트) | **상당 부분 폐기.** board 계약·`/token`·`/login`·`/refresh`·토큰 수명·`{SCOPE}` 전제가 무너졌다. 88개 기준 재대조 진행 중 |
| `doc/api/backend-requests-triage.md` | BR-012 절 갱신 필요 (§2.2 참조). BR-032 절은 재측정 후 확정 |
| `oc-board-front/docs/api/go/` 사본 | `65b7f49` 시점 사본이므로 **현재 서버와 불일치**. 재대조가 끝나면 새 사본을 전달한다 |

재대조 결과가 나오는 대로 별도 통지한다. **그 전까지 `docs/api/go/` 를 현행 계약으로 쓰지 마라.**

---

## 6. 이 통지에서 확인한 것 / 하지 않은 것

**확인함** — 라우트 표 88개 전수 diff, `AuthPolicy` 소스, 삭제된 파일 목록,
골든 파일 신선도, 프론트의 폐지 경로 참조 위치 4곳.

**하지 않음** — 운영/로컬 서버에 요청을 보내지 않았다. 도메인 로직(BR-018~027) 변경 여부를
확인하지 않았다. `is_not_paging` 재측정을 하지 않았다.
