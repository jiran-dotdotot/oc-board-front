# `doc/api/` 스테일 재대조 — `65b7f49` → `ebff9af`

← [API 문서 목록](README.md) · 관련: [프론트 통지](../backend-replies/board-auth-contract-change.md) · [BR 판정](backend-requests-triage.md)

- 측정일: 2026-09-09
- 기준: `internal/transport/httpapi/testdata/routes.txt` **88행** (골든 신선 —
  `go test ./internal/transport/httpapi -run '^TestRouteTable'` 통과)
- 대상: `doc/api/` 11개 파일 (67 엔드포인트, `65b7f49` 기준 작성)

**결론: 엔드포인트 단위로는 67 중 58 이 살아남았다(87%). 그러나 인증 계약 서술이 전 파일에서
무효가 되어 실질 재작업량은 그보다 훨씬 크다.**

---

## 1. 숫자

| 항목 | 값 |
| --- | ---: |
| 현재 등록 라우트 | **88** (exempt 10 / member 64 / service 14) |
| 문서가 기술한 엔드포인트 | 67 |
| └ 현재도 **그대로 유효** | **58** |
| └ **삭제됨** (경로 자체가 없음) | **3** |
| └ **이사함** (핸들러 동일, 경로 변경) | **6** |
| 현재 있는데 문서에 **없는 것** | **8** (이사분 6 + 신규 2) |
| 새 문서화 목표 | **66** = 58 + 6 + 2 |
| 제외 유지 | 22 (service 14 + 도구/프로브 8) |

검산: 66 + 22 = 88 ✓

> 이전 목표는 67 이었다. 66 으로 하나 줄어든 이유: 삭제 3 − 신규 2 = −1.

---

## 2. 삭제된 3개 — 문서에서 제거해야 함

전부 `01-auth-user.md`.

```
POST /api/v1/board/token      ← board/token.go 삭제
POST /api/v1/board/login      ← board/login.go 삭제
POST /api/v1/board/refresh    ← board/refresh.go 삭제
```

`internal/auth/boardtoken.go` 도 삭제됐다. 대체 경로 **없음** — Go 서비스에 로그인
엔드포인트가 하나도 남지 않았다.

## 3. 이사한 6개 — 경로만 치환

`/api/v1/companies/{c}/…` → `/api/v1/board/companies/{c}/…`
(새 상수 `BoardCompanyPrefix`, `router.go:131`)

| 문서 | 이전 경로 | 현재 경로 |
| --- | --- | --- |
| `02-management.md` | `POST /api/v1/companies/{c}/admins` | `POST /api/v1/board/companies/{c}/admins` |
| `02-management.md` | `POST /api/v1/companies/{c}/settings` | `POST /api/v1/board/companies/{c}/settings` |
| `02-management.md` | `PATCH /api/v1/companies/{c}/settings` | `PATCH /api/v1/board/companies/{c}/settings` |
| `02-management.md` | `PATCH /api/v1/companies/{c}/settings/users/me` | `PATCH /api/v1/board/companies/{c}/settings/users/me` |
| `02-management.md` | `PUT /api/v1/companies/{c}/settings/users/me/recent-search-keywords` | `PUT /api/v1/board/companies/{c}/settings/users/me/recent-search-keywords` |
| `10-upload-…md` | `GET /api/v1/companies/{c}/departments` | `GET /api/v1/board/companies/{c}/departments` |

**company 스코프까지만이고 `user_id` 세그먼트가 없다.** 본인은 `/users/me` 리터럴이다.

## 4. 신규 2개 — 문서 작성 필요

```
GET  {SCOPE}/drive-files/{id}/thumbnail-url     → 09-drive-file.md
POST {SCOPE}/posts/{id}/attachments             → 06-post-write.md
```

관련 신규 코드: `board/profile.go`, `board/postwritebulk.go`, `board/timeformat.go`,
`worker/thumbnail.go`, `worker/attachmentexpire.go`.

---

## 5. 전역 오염 — 엔드포인트 수보다 이쪽이 크다

`board` 인증 계약이 폐지되어(→ `member`) **모든 파일의 인증 서술이 무효**다.

| 오염 유형 | 건수 | 조치 |
| --- | ---: | --- |
| `board 계약`/`board 토큰`/`HS256`/`refresh_token` 등을 언급한 줄 | **295** | 전수 검토 |
| curl 예시의 `Bearer $BOARD_TOKEN` | **193** | `$MEMBER_TOKEN` 으로 치환 |
| curl 예시의 `Bearer $MEMBER_TOKEN` (이미 맞음) | 23 | 유지 |

파일별 오염 줄 수:

| 파일 | 줄 |
| --- | ---: |
| `01-auth-user.md` | 49 |
| `09-drive-file.md` | 34 |
| `README.md` | 31 |
| `06-post-write.md` | 31 |
| `04-board.md` | 30 |
| `07-post-comment-like.md` | 29 |
| `03-category.md` | 28 |
| `05-post-read.md` | 20 |
| `08-drive-folder.md` | 17 |
| `02-management.md` | 16 |
| `10-upload-department-client.md` | 10 |

**단순 치환으로 끝나지 않는 것** (의미가 사라진 서술):

- 인증 계약 **4종 → 3종** (`exempt`/`service`/`member`). `AuthPolicy` 에 `BoardPrefixes` 없음
- board 토큰 수명(1h)·refresh 회전(336h)·1회용 소비·`jti`·`iss=oc-api-go/board` — **전부 삭제 대상**
- 회사 등급 게이트(Free 차단) — `/token`·`/login` 에 있었다. **member 계약으로 옮겨졌는지 미확인** (§7)
- "관리 3종은 board 아래가 아니다" 라는 전역 함정 9번 — **반대로 뒤집혔다**

**살아남는 공통 규약**: `PathScope`(정규 십진수, 403), `Lang`/`Time_zone` 언더스코어,
400 vs 422, 에러 봉투·코드 카탈로그, 페이징 봉투, `QueryArrays`, `$schema`.

---

## 6. 파일별 판정과 작업량

| 파일 | 엔드포인트 | 판정 | 작업 |
| --- | --- | --- | --- |
| `README.md` | — | 🔴 **대수술** | 계약 4→3종, 전수표 89→88 전면 재작성, 토큰 수명 절 삭제, 함정 목록 재정렬 |
| `01-auth-user.md` | 4 → **1** | 🔴 **사실상 폐기** | 3개 삭제 후 `/me` 만 남는다. 파일 유지 여부부터 결정 (§8) |
| `02-management.md` | 6 → 6 | 🟠 경로 치환 | 5개 경로 앞에 `/board` 삽입 + 계약 라벨 |
| `10-upload-…md` | 6 → 6 | 🟠 경로 치환 | `departments` 1개 + 계약 라벨 |
| `06-post-write.md` | 9 → **10** | 🟠 신규 1 | `POST .../posts/{id}/attachments` 추가 + 계약 라벨 |
| `09-drive-file.md` | 9 → **10** | 🟠 신규 1 | `GET .../drive-files/{id}/thumbnail-url` 추가 + 계약 라벨 |
| `03-category.md` | 8 → 8 | 🟡 라벨만 | URL 전부 유효 |
| `04-board.md` | 7 → 7 | 🟡 라벨만 | 〃 |
| `05-post-read.md` | 5 → 5 | 🟡 라벨만 | 〃 + BR-032 정정 2곳 |
| `07-post-comment-like.md` | 8 → 8 | 🟡 라벨만 | 〃 |
| `08-drive-folder.md` | 5 → 5 | 🟡 라벨만 | 〃 |

🟡 6개 파일(38 엔드포인트)은 **URL·파라미터·응답 계약이 그대로**다. 인증 절과 curl 토큰 변수만 손대면 된다.

---

## 7. 재조사가 필요한 미확정 사항

문서를 고치기 전에 코드로 확인해야 하는 것들. **추측으로 쓰면 안 된다.**

1. **회사 등급 게이트의 행방** — `checkPlan`(Free 차단)이 `/token`·`/login` 에 있었다.
   그 두 경로가 사라졌는데 게이트가 어디로 갔는지, 아니면 없어졌는지
2. **BR-032 `is_not_paging`** — `huma.DefaultConfig` 는 그대로(`router.go:339`)라 근본원인은
   남아 있을 공산이 크지만 `postsbody.go` 가 삭제되고 board 패키지가 재편됐다. **재측정 필요**
3. **BR-018 ~ BR-027 (10건)** — 도메인 로직이 바뀌었는지 미확인. `migrations/board/000001` 도
   96줄 변경됐다
4. **`/me` 응답의 pg 원시 타임스탬프 6개** — `board/timeformat.go` 가 신설됐다. 포맷 규칙이
   유지됐는지 재확인
5. **신규 2개 엔드포인트의 전체 계약** — 미조사

---

## 8. 권고 순서

```
[ ] ① §7 의 5건 재조사 — 문서 수정 전에 사실부터 확정
[ ] ② README 인증 절 + 전수표(88) 재작성          ← 다른 파일이 여기를 참조한다
[ ] ③ 01-auth-user.md 처리 결정
       /me 하나만 남으므로: (a) 파일 유지하고 축소, (b) README 나 다른 파일로 흡수 후 삭제
[ ] ④ 02 · 10 경로 치환 (6개)
[ ] ⑤ 06 · 09 신규 엔드포인트 2개 작성
[ ] ⑥ 전역 스윕 — $BOARD_TOKEN → $MEMBER_TOKEN (193곳), 계약 서술 295줄 검토
[ ] ⑦ BR-032 정정 (05 ×2, 09 ×2) — §7-2 재측정 결과 반영
[ ] ⑧ 완료 검증 재실행 (라우트 전수 · 8절 · 링크 · 인용 라인)
[ ] ⑨ oc-board-front/docs/api/go/ 사본 갱신 전달
```

②를 먼저 하는 이유: 10개 도메인 파일이 전부 README 의 공통 규약을 링크로 참조한다.
계약 서술이 확정되기 전에 도메인 파일을 고치면 두 번 고치게 된다.

---

## 9. 측정 방법

- 라우트 전수: `routes.txt` 88행을 파싱해 각 경로의 `{brace}`·`:colon`·`{SCOPE}`·`{S}` 표기
  변형을 문서 전문에서 탐색
- 문서 주장분: 각 도메인 파일의 `^## <METHOD> <path>` 제목 67개를 추출해 현재 라우트 집합과 대조
- 오염도: 계약·토큰 관련 정규식의 파일별 매칭 줄 수
- 운영/로컬 서버에 요청을 보내지 않았다. 도메인 로직 변경 여부는 **측정하지 않았다**(§7-3)
