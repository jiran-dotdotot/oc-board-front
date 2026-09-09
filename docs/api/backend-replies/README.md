# 백엔드 전달 원문 보관

백엔드(`oc-api-go`)가 프론트로 전달한 문서를 **바이트 그대로** 보존한다. 형제 레포는 이 저장소의
히스토리에 남지 않으므로, 인용의 근거가 사라지지 않게 사본을 둔다.

- 이 폴더는 **계약 원문이 아니다.** 구현 계약 사본은 `docs/api/go/` 이고, 그마저 현재
  스테일이다(아래 참조) — 판단 근거는 `docs/api/README.md` 최상단 경고를 먼저 읽는다.
- 여기 있는 문서는 **수정하지 않는다.** 갱신은 백엔드가 새로 전달한 파일로 교체한다.
- 원문 작성자가 수행한 검증과 프론트가 직접 수행한 검증을 섞지 않는다. 프론트가 실측한 것은
  `docs/api/backend-requests.md` 각 항목의 「실측」 문장에만 쓴다.

| 사본                                                           | 백엔드 원본 절대경로                                                                                 | 기준 커밋                    | 수신일     |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------- | ---------- |
| [board-auth-contract-change.md](board-auth-contract-change.md) | `/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/backend-replies/board-auth-contract-change.md` | `ebff9af`                    | 2026-09-09 |
| [staleness-ebff9af.md](staleness-ebff9af.md)                   | `/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/staleness-ebff9af.md`                      | `ebff9af`                    | 2026-09-09 |
| [backend-requests-triage.md](backend-requests-triage.md)       | `/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/backend-requests-triage.md`                | **`65b7f49`** (ebff9af 이전) | 2026-09-09 |

- `board-auth-contract-change.md` — 🚨 board 인증 계약 폐지 통지. `POST /api/v1/board/{token,login,refresh}`
  3개 삭제, 게시판 표면 전체가 `member`(OfficeWave ES256)로 통일.
- `staleness-ebff9af.md` — `doc/api/` 11파일의 스테일 재대조(삭제 3 · 이사 6 · 신규 2 · 오염 295줄).
- `backend-requests-triage.md` — BR-001 ~ BR-032 판정. **`65b7f49` 기준**이므로 도메인 판정(BR-018 ~ BR-027)은
  `ebff9af` 재확인 전까지 그대로 적용하지 않는다. 인증 관련 판정은 위 통지문이 덮어썼다.

## 프론트가 직접 실측한 것 (2026-09-09, 읽기 전용)

통지문의 사실 주장을 옮기기 전에 `oc-api-go` @ `ebff9af` 에서 확인했다. **전부 일치**했다.

| 확인 항목                                                        | 결과                                                                                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `internal/transport/httpapi/testdata/routes.txt`                 | **88행** · exempt 10 / member 64 / service 14 · `board` 라벨 **0**                                                                                           |
| `/api/v1/board/{token,login,refresh}`                            | routes.txt 에 **없음**                                                                                                                                       |
| `board/{token,login,refresh}.go` · `internal/auth/boardtoken.go` | 4파일 모두 **부재**(삭제 커밋 = `ebff9af`)                                                                                                                   |
| `BoardPrefixes` · `ContractBoard`                                | `internal/**` 전체 **0건**. 계약은 exempt/service/member 3종(`middleware/auth.go:35-37`)                                                                     |
| `BoardCompanyPrefix`                                             | `router.go:131` 존재, `managementGroup`(`router.go:393`)에 배선                                                                                              |
| 이사한 6경로                                                     | routes.txt `19,45,46,47,48,65` — 전부 `companies/:company_id/…`, **`user_id` 세그먼트 없음**                                                                 |
| 신규 2경로                                                       | routes.txt `34`(thumbnail-url) · `60`(attachments) 등록 확인                                                                                                 |
| `middleware.PathScope()`                                         | `router.go:333` 배선 유지                                                                                                                                    |
| **회사 등급 게이트(`checkPlan`, Free 차단)**                     | 통지문은 「미확인」이라 했으나 **없어졌다** — `65b7f49:board/token.go:246` 에 있었고 `ebff9af` 의 `internal/**` 검색 결과 **0건**. 파일 삭제와 함께 사라졌다 |

**하지 않은 것** — 서버에 HTTP 요청을 보내지 않았다(member 토큰이 없어 보낼 수 없다).
도메인 로직(BR-018~027) 변경 여부, `is_not_paging` 재측정, `/me` 타임스탬프 포맷,
신규 2경로의 계약은 확인하지 않았다.
