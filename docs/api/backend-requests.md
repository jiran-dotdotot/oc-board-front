# 백엔드 요청 누적 대장

> 전달용 요약: 지금 회신이 필요한 5건은 [`backend-requests-ask.md`](backend-requests-ask.md)에 추려 두었다. 이 대장이 정본이며 상태 변경은 여기서 먼저 한다.

> ## 🚨 `ebff9af` 인증 계약 변경으로 전 항목을 재판정했다 (2026-09-09)
>
> 백엔드가 `board` 인증 계약을 폐지하고 게시판 표면 전체를 `member`(OfficeWave ES256)로 통일했다.
> `POST /api/v1/board/{token,login,refresh}` **3개가 삭제**되어 **이 앱은 현재 상태로 어떤 게시판
> API 도 호출할 수 없다.** 전달 원문·프론트 실측표: [`backend-replies/`](backend-replies/README.md).
>
> | 항목                                | 재판정                                                                                                                                                                                                                                                                                                                           |
> | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | [BR-012](#br-012)                   | **해소됨 — 단, 요청한 방식이 아니다.** member 자격을 «공급»한 게 아니라 board 계약을 없애 전부 member 로 통일했다. 관리 API 는 호출 가능해졌지만 **독립 로그인 자체가 사라졌다** → 후속은 BR-036. **2026-09-10 종결**: OfficeWave 로그인으로 member 토큰을 얻어 설정 저장·조직도(공개 범위·관리자 지정)를 실계정 200 으로 열었다 |
> | [BR-030](#br-030)                   | **무효** — 검증 대상 3경로(`/token`·`/login`·`/refresh`)가 삭제됐다. 실측 기록은 이력으로만 보존한다                                                                                                                                                                                                                             |
> | [BR-013](#br-013)~[BR-017](#br-017) | **URL 은 유효, 인증 헤더 계약이 바뀌었다.** 「프론트 전환 완료」는 board 토큰 전제에서 참이었다 → 토큰 종류 교체가 남았으므로 **해결 처리를 유지하지 않는다**(부분 해결)                                                                                                                                                         |
> | [BR-032](#br-032)                   | **재측정 필요** — 근본원인(`huma.DefaultConfig`)은 `router.go:339` 로 그대로지만 `postsbody.go` 가 삭제되고 board 패키지가 재편됐다                                                                                                                                                                                              |
> | [BR-018](#br-018)~[BR-027](#br-027) | **미판정** — 도메인 로직 변경 여부 미확인(`migrations/board/000001` 96줄 변경). 백엔드 판정([backend-requests-triage.md](backend-replies/backend-requests-triage.md))은 **`65b7f49` 기준**이라 그대로 적용하지 않는다                                                                                                            |
> | **신설 [BR-036](#br-036)**          | member 토큰 획득 경로·수명·갱신·클레임·등급 게이트 미정 — **최우선 블로커**. → 이후 프론트가 OfficeWave `POST /oauth/login`(password grant) 직접 호출로 **경로를 확정**했다(부분 해결, 잔여 5건)                                                                                                                                 |
> | **신설 [BR-037](#br-037)**          | 신규 2경로(thumbnail-url · attachments) 계약 문서 부재                                                                                                                                                                                                                                                                           |
>
> **이번 갱신은 문서·대장만 고쳤다.** 토큰 획득 방식이 미정이라 코드는 손대지 않았다(사용자 결정).
> `docs/api/go/` 사본도 고치지 않았다 — CLAUDE.md 규칙상 갱신은 원본 11파일 전체 재복사로만 하고,
> 백엔드가 재대조 중이다.

## 열린 항목 요약

| ID                | 제목                                               | 상태                   | 막힌 화면·확인 범위                |
| ----------------- | -------------------------------------------------- | ---------------------- | ---------------------------------- |
| [BR-008](#br-008) | 게시글·댓글·공감 알림의 워커 연결과 전달 계약 확인 | 열림                   | 로그인·알림·예약·정리의 운영 검증  |
| [BR-011](#br-011) | 관리자의 타인 게시글 삭제 정책 확인                | 회신 수신(작성자 전용) | 게시글 상세 관리자 삭제            |
| [BR-018](#br-018) | 회사 설정의 DB CHECK 위반을 입력 오류로 반환       | 열림(ebff9af 미판정)   | 회사 설정 저장                     |
| [BR-019](#br-019) | 업로드 예약의 음수 파일 크기 검증                  | 열림(ebff9af 미판정)   | 자료실 다중 업로드                 |
| [BR-020](#br-020) | 삭제된 자료실 폴더 아래 생성·업로드 방지           | 열림(ebff9af 미판정)   | 폴더 생성·업로드                   |
| [BR-021](#br-021) | 기존 폴더를 자료실 루트로 이동하는 계약            | 열림(ebff9af 미판정)   | 폴더 루트 이동                     |
| [BR-022](#br-022) | 파일 복원 시 직접 해제한 북마크 보존               | 열림(ebff9af 미판정)   | 휴지통 복원·북마크                 |
| [BR-023](#br-023) | 객체 정리와 복원의 경합으로 인한 파일 손실 방지    | 열림(ebff9af 미판정)   | 휴지통 복원 후 파일 다운로드       |
| [BR-024](#br-024) | 게시글 복원 시 개별 삭제 댓글의 삭제 상태 보존     | 열림(ebff9af 미판정)   | 게시글 복원 후 댓글                |
| [BR-025](#br-025) | 영구삭제 표시 게시글의 직접 상세 조회 차단         | 열림(ebff9af 미판정)   | 영구삭제 글 직접 상세              |
| [BR-026](#br-026) | 알림 웹훅 실패를 발송 성공으로 기록하지 않기       | 열림(ebff9af 미판정)   | 게시글·댓글·공감 알림              |
| [BR-027](#br-027) | 카테고리 삭제와 자식 생성의 snapshot 경합 방지     | 열림(ebff9af 미판정)   | 카테고리 동시 생성·삭제            |
| [BR-028](#br-028) | 공개 API 주소·활성 설정·토큰 TTL의 배포값 확인     | 열림                   | 로그인·API 주소·세션 갱신          |
| [BR-029](#br-029) | 브라우저 S3 업로드·다운로드와 CDN 접근 환경 확인   | 열림                   | S3 PUT/GET·CDN 이미지              |
| [BR-032](#br-032) | `is_not_paging`의 배열 반환이 실행 서버에서 미적용 | 열림(ebff9af 재측정)   | 게시판 공지 고정·자료실/홈 목록    |
| [BR-033](#br-033) | 자료실 파일 응답에 폴더 경로(위치)가 없음          | 열림                   | 통합 검색 자료 탭 행의 위치 표시   |
| [BR-034](#br-034) | 검색어의 ILIKE wildcard(`%`·`_`) escape 부재       | 열림                   | 통합 검색·목록 내 검색 전체        |
| [BR-035](#br-035) | 최근 검색어의 자동 누적과 삭제 권한 비대칭         | 열림                   | 통합 검색 최근 검색어 삭제         |
| [BR-036](#br-036) | member 토큰 획득 — 경로는 프론트가 확정, 잔여 5건  | 부분 해결              | 등급 게이트·비번변경·MFA·운영주소  |
| [BR-037](#br-037) | 신규 2경로(thumbnail-url·attachments) 계약 부재    | 열림(09-10 보강)       | 자료실 썸네일·게시글 첨부 업로드   |
| [BR-038](#br-038) | 사용자별 댓글 수 통계 없음                         | 열림                   | 내 활동 프로필 카드 「댓글」 타일  |
| [BR-039](#br-039) | 휴지통 보관 기간 미노출 + 게시글은 purge 배치 부재 | 열림                   | 내 활동 휴지통 보관 안내           |
| [BR-040](#br-040) | 글+자료 병합 목록 API 부재                         | 열림                   | 내 활동 「전체」 탭(제거함)        |
| [BR-041](#br-041) | `/posts/mine`의 `state`에 서버 enum 검증 없음      | 열림                   | 내 활동 전 칩(오타가 빈 목록 위장) |
| [BR-042](#br-042) | 글 작성·수정 응답에 관계가 없어 상세 재조회가 필수 | 열림                   | 글쓰기 저장 후 상세(ACT 조회수 +1) |
| [BR-043](#br-043) | 본문 인라인 이미지가 Go 밖(나모 호스트)에 저장됨   | 열림                   | 글쓰기 본문 이미지 보존·권한       |

## 보류·해결 항목 요약

| ID                | 제목                                          | 상태                                                  | 막힌 화면·확인 범위                    |
| ----------------- | --------------------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| [BR-001](#br-001) | 공개 환경 확인 API의 대체 필요성              | 보류(제품 화면 요구 없음)                             | 없음 — 개발 진단 후보                  |
| [BR-002](#br-002) | 일반 게시판 목록 검색 API의 필요성            | 보류(페이지형 검색 요구 미확정)                       | 일반 게시판 페이지형 검색(요구 미확정) |
| [BR-003](#br-003) | 일반 사용자의 회사 설정 기반 홈 구성 조회     | 보류(홈 위젯 구성 요구 미확정)                        | 회사 설정 기반 홈 섹션(요구 미확정)    |
| [BR-004](#br-004) | 관리용 공지 목록의 Go 대체 경로               | 해결됨(Go /boards/{id}/notices @ 65b7f49)             | 공지 관리 목록                         |
| [BR-005](#br-005) | 라이브 방송 정보 조회 API                     | 보류(방송 영역 요구 미확정)                           | 라이브 방송 영역(요구 미확정)          |
| [BR-006](#br-006) | 메인 위젯의 종류와 표시 방식 계약 확정        | 해결됨(Go /companies/{company_id}/settings @ 65b7f49) | 홈 위젯 설정·값 해석                   |
| [BR-007](#br-007) | 게시글 작성·수정 요청 본문 한도 확정          | 해결됨(Go 공통 Body 1 MiB·413 @ 65b7f49)              | 글쓰기·수정의 크기 제한 안내           |
| [BR-009](#br-009) | 게시글 첨부 영구삭제의 물리 삭제 시점 확정    | 해결됨(Go 첨부 purge 생명주기 @ 65b7f49)              | 첨부 보존·물리 삭제 안내               |
| [BR-010](#br-010) | Go 공통 요약과 도메인 본문의 계약 정합성      | 해결됨(Go 공통·도메인 규칙 정합 @ 65b7f49)            | 공통 오류·시간·정렬 처리               |
| [BR-012](#br-012) | 독립 로그인에서 설정 API용 member 자격 획득   | 종결(2026-09-10 — 설정 저장·조직도 실계정 200)        | 후속은 BR-036(토큰 획득 방식)          |
| [BR-013](#br-013) | API 경로·회사/사용자 스코프의 프론트 전환     | 부분 해결(URL 유효 · 인증 계약 재작업 @ ebff9af)      | 홈·게시판·자료실·설정 API 연동         |
| [BR-014](#br-014) | 자료실·게시글 첨부 다운로드 URL의 프론트 전환 | 부분 해결(URL 유효 · 인증 계약 재작업 @ ebff9af)      | 파일 다운로드·미리보기                 |
| [BR-015](#br-015) | 자료실 상세의 중첩 board 응답 전환            | 부분 해결(URL 유효 · 인증 계약 재작업 @ ebff9af)      | 자료실 폴더 추가·업로드 권한           |
| [BR-016](#br-016) | 자료실 일괄 삭제의 부분 실패 처리             | 부분 해결(URL 유효 · 인증 계약 재작업 @ ebff9af)      | 자료실 일괄 삭제 결과                  |
| [BR-017](#br-017) | 자료실 업로드 발급·완료 경로와 응답 전환      | 부분 해결(URL 유효 · 인증 계약 재작업 @ ebff9af)      | 자료실 업로드·재시도                   |
| [BR-030](#br-030) | 실행 서버의 board 인증 면제 경로 확인         | 무효(대상 3경로 삭제 @ ebff9af)                       | 실제 토큰의 refresh 회전·재사용 거절   |
| [BR-031](#br-031) | 실행 서버 CORS의 Lang·Time_zone 허용          | 해결됨(Go 개발 CORS @ 65b7f49)                        | localhost:5174·5188의 API preflight    |

## 기록 규칙과 이번 갱신 범위

- 문서 전면 갱신일: **2026-09-08**. 아래 당시 검증 범위는 이력이다. 이후 로그인 연결과 실제 로컬 HTTP 확인은 BR-012·013의 후속 갱신 및 BR-030·031에 별도로 기록했다. 현재 계약 근거는 백엔드 `oc-api-go`, `feat/settings`, `65b7f49f34b0b934e274437a764455af045b99d3` 기준으로 작성된 **로컬 `doc/api/` 원본**이다. 그 원본을 복사한 [Go 문서](go/README.md)를 아래에서 인용한다. 기존 프론트 Go 요약이나 이전 스냅샷을 현재 계약 근거로 재사용하지 않는다.
- BR-001~017은 최초 발견 맥락과 Laravel 역방향 근거를 보존하고 상태·현황·요청을 새 원문으로 재판정했다. ID를 삭제·재사용하지 않는다. 기존 미확인 부록은 현재 문서에서 해소되었으므로 과거 줄 번호를 현행 인용으로 남기지 않는다.
- **분류**는 `계약 누락`, `문서 불일치`, `프론트 미전환`, `환경 미확정`을 구분한다. 새 원문이 정확히 설명하는 현재 서버 버그는 `백엔드 동작 결함`으로 별도 분류한다. 버그가 문서화되어 있다는 사실을 계약이 없거나 문서 자체가 틀렸다는 뜻으로 바꾸지 않는다.
- 한 항목은 아래 7개 필드를 유지한다. 상태는 `열림`, `백엔드 확인중`, `해결됨(Go 경로/버전)`, `보류(사유)` 중 하나이며, **`ebff9af` 계약 변경으로 세 값을 추가했다**: `부분 해결(무엇이 유효하고 무엇이 남았는지)` — URL 은 유효하나 인증 계약이 바뀐 전환 항목, `무효(사유)` — 검증 대상 자체가 삭제된 항목, `해소됨(요청과 다른 방식)` — 질문이 사라졌지만 우리가 요청한 해결책은 아닌 항목. `회신 수신(요지)` 은 백엔드 답을 받았고 프론트 후속만 남은 상태다. 분류·갱신일·상태 이력은 발견 맥락에 기록한다. 상단 요약은 본문 상태와 함께 갱신하며 실제로 전달하지 않은 요청은 `백엔드 확인중`이라 쓰지 않는다.
- **해결됨은 해당 문서/계약 확인 요청의 종결**이다. 프론트 코드 전환·운영 배포·장애 재현의 완료가 아니다. 최초 문서 전면 갱신에서는 프론트 서비스·타입·UI와 백엔드 코드를 변경하지 않았고 curl·백엔드 테스트·운영 알림을 직접 실행하지 않았다. 이후 로그인·메인 조회 전환과 직접 검증은 해당 항목의 후속 이력으로 구분한다. Go 원문과 백엔드 회신의 코드 조사·테스트·서버 로그 확인은 작성자가 수행한 기록으로만 인용한다.
- 구현은 Go 문서만 사용한다. Go에 없는 타입·필드·기본값을 Laravel에서 끌어오지 않는다. 남겨 둔 Laravel 링크는 최초 갭 확인 이력이며, 새 Go 계약으로 충분한 항목에서는 추가 열람하지 않았다. 아래 **요청안은 현행 계약이 아니다**.
- BR-011~017의 프론트 연결 증거는 최초 정적 조사 이력이다(당시 graph generation `2026-09-08T05:57:20Z`, coverage와 실제 호출/JSX 바인딩 대조). 이번 원문 갱신을 새 코드 실측으로 표현하지 않는다. Go 계약이 이미 있는 프론트 미전환은 새 백엔드 API를 요청하지 않는다.

<a id="br-001"></a>

## BR-001 · 공개 환경 확인 API의 대체 필요성

- 상태: 보류(제품 화면 요구 없음)
- 발견일 / 발견 맥락: 2026-09-08 / API 카탈로그에서 Go 대응이 없는 기존 `GET /api/test`를 대조했다. 개발 환경 진단용 후보이며 제품 화면 연결이나 실행 장애는 확인하지 않았다. **분류: 계약 누락. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 보류(제품 화면 요구 없음) → 보류(제품 화면 요구 없음).** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: Go 문서에는 기존 DB 호스트 조회 API가 없다. 그 응답을 사용한 개발 진단 도구를 유지하려면 계약이 부족하지만, 게시판 제품 화면이 막혔다는 근거는 없다.
- Go 현황: [docs/api/go/README.md:315](go/README.md#L315)는 `/api/test`를 과거 72개 집계에서 제외한다. 현재 Go 등록 전수표의 [docs/api/go/README.md:281](go/README.md#L281)에는 사용자 데이터가 없는 `/healthz` liveness probe가 있다. 과거 공개 DB 호스트 응답을 제공하는 Go 계약은 없다.
- Laravel 참고: [docs/api/laravel/01-auth-user.md:341](laravel/01-auth-user.md#L341)는 공개 DB 호스트 진단 경로, [docs/api/laravel/01-auth-user.md:357](laravel/01-auth-user.md#L357)는 DB 호스트 정보 응답을 기록한다. 제품 데이터 API가 아니다.
- 프론트 임시 조치: API 추가·호출 변경 없음. 진단용 응답이나 DB 호스트 필드를 프론트 타입으로 추가하지 않는다.
- 백엔드 요청 내용: 현재 신규 API 요청은 보류한다. 공개 DB 호스트 응답을 제품 API에 복원하지 않는다. 개발 진단이 필요하면 새 원문의 /healthz liveness 범위에서 요구를 확인한다. /api/test는 새 원문이 대조한 Laravel 72개에도 포함되지 않으며 최초 후보 이력만 보존한다.

<a id="br-002"></a>

## BR-002 · 일반 게시판 목록 검색 API의 필요성

- 상태: 보류(페이지형 검색 요구 미확정)
- 발견일 / 발견 맥락: 2026-09-08 / 카탈로그의 기존 일반 게시판 목록 `GET /api/v1/board`를 Go 북마크 목록과 비교했다. 일반 게시판 선택·검색의 페이지형 목록 요구가 생겼을 때의 후보이며 해당 화면의 실행 장애는 확인하지 않았다. **분류: 계약 누락. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 보류(페이지형 검색 요구 미확정) → 보류(페이지형 검색 요구 미확정).** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: 일반 게시판 목록을 기존 형태로 페이지 조회할 Go 계약은 없다. Go 북마크 API는 북마크한 게시판만 반환하므로 전체 검색의 대체라고 단정할 수 없다. 사용자 트리로 충족되는 탐색은 막히지 않는다.
- Go 현황: [docs/api/go/README.md:344](go/README.md#L344)는 독립 일반 게시판 목록이 없고 categories 트리·ID별 boards·bookmarks로 부분 대체하되 전역 필터/페이지 동등성은 없다고 명시한다. 실제 경로는 [docs/api/go/03-category.md:146](go/03-category.md#L146)와 [docs/api/go/04-board.md:249](go/04-board.md#L249)·[docs/api/go/04-board.md:297](go/04-board.md#L297)다.
- Laravel 참고: [docs/api/laravel/04-board.md:130](laravel/04-board.md#L130)는 일반/공용/북마크 필터와 페이지 목록을 제공했다. [docs/api/laravel/04-board.md:143](laravel/04-board.md#L143)의 읽기 권한 누락은 재현할 대상이 아니다.
- 프론트 임시 조치: 새 일반 목록 경로를 만들거나 북마크 결과를 전체 게시판이라고 표시하지 않는다. 실제 요구가 트리 탐색으로 충족되는지 먼저 확인한다. 이번 작업의 코드 변경은 없다.
- 백엔드 요청 내용: 페이지형 일반 검색 요구가 확정될 때만 요청한다. **요청안(현행 아님)**: `GET /api/v1/board/companies/{company_id}/users/{user_id}/boards`, `search:string?`, `is_public_only:boolean?`, `page:integer`, `take:integer`, 응답은 Go `BoardView[]`를 담은 5키 페이지 봉투. 읽기 가능한 같은 회사 게시판만 포함하고, 검색·정렬·상한을 Go 문서로 확정해 달라. 먼저 기존 트리로 대체 가능한지 백엔드와 판단한다.

<a id="br-003"></a>

- **백엔드 회신 수신(2026-09-09)**: [BR 판정](backend-replies/backend-requests-triage.md) §4 — 일반 사용자용 계약은 **없다**. `/me.company_setting` 이 `company_main_boards` 등 5키를 억누르고(`board/dto.go:236-243`), 전체 위젯은 관리 응답에만 있으며 **회사 관리자 권한**이 필요하다. 제품이 홈 위젯 구성을 요구하기 전까지 보류를 유지한다 — 프론트가 5키를 추정해 채우지 않는다.

## BR-003 · 일반 사용자의 회사 설정 기반 홈 구성 조회

- 상태: 보류(홈 위젯 구성 요구 미확정)
- 발견일 / 발견 맥락: 2026-09-08 / 카탈로그의 메인 화면 통합 조회 후보를 Go 문서로 재검증했다. 회사가 설정한 홈 섹션을 일반 사용자에게 표시하는 작업이 대상이다. 고정 섹션 홈 전체의 장애를 주장하는 항목은 아니다. **분류: 계약 누락. 갱신: 2026-09-09, 전달 대상 재분류. 이력: 열림 → 보류(홈 위젯 구성 요구 미확정).** 2026-09-09 재분류 근거: 본문 요청이 「회사 설정 기반 홈이 제품 요구라면」이라는 조건부이고 그 제품 요구가 확정되지 않았다. BR-002·BR-005와 같은 요구 미확정 유형이다. 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: **회사 설정 기반 홈 구성 데이터 부족**. 기존 /post/main 집계 API는 폐기 결정되어 복원 요구의 근거가 아니다. posts/drive-files 조합은 가능하지만 일반 사용자가 회사 위젯 종류·순서·대상 게시판을 읽을 API가 없어 회사별 구성 적용은 별도 공급 없이는 불가하다. 고정 섹션 홈 전체 장애나 현재 운영 오류를 재현한 것은 아니다.
- Go 현황: [docs/api/go/README.md:357](go/README.md#L357)는 `/post/main`의 명시 폐기 결정과 위젯별 posts/drive-files 조합을 기록한다. [docs/api/go/README.md:460](go/README.md#L460)는 위젯 조회 API 부재를 현재 이슈로 남겼다. [docs/api/go/01-auth-user.md:174](go/01-auth-user.md#L174)는 `/me.company_setting`에서 `company_main_boards` 등 5키가 빠짐을 명시한다. 전체 위젯은 [docs/api/go/02-management.md:69](go/02-management.md#L69)의 관리 응답에 있으며 수정 [docs/api/go/02-management.md:226](go/02-management.md#L226)는 member 토큰·회사 관리자 권한을 요구한다.
- Laravel 참고: [docs/api/laravel/05-post-read.md:146](laravel/05-post-read.md#L146)의 `GET /api/v1/post/main`은 회사 설정을 읽어 위젯별로 목록을 구성했고, [docs/api/laravel/05-post-read.md:169](laravel/05-post-read.md#L169)는 위젯 설정과 `posts[]`·`drive_files[]`를 묶은 응답을 기록한다. 이때의 개수·기본값을 Go로 복사하지 않는다.
- 프론트 임시 조치: 이번 작업에서 코드 변경 없음. 설정을 읽으려고 회사 설정 생성·수정 API를 호출하지 않는다. Go 응답에 없는 `company_main_boards`나 홈 기본 섹션 규칙을 만들어 넣지 않는다.
- 백엔드 요청 내용: 폐기된 /post/main을 되살려 달라는 요청은 하지 않는다. 회사 설정 기반 홈이 제품 요구라면 위젯 구성을 일반 사용자가 읽는 별도 공급 계약을 확정해 달라. **요청안(현행 아님)**: 읽기 전용 home-settings 또는 기존 조회 응답 확장으로 `company_main_boards:Widget[]`, `latest_post_day:integer`, `latest_post_type:string`, `latest_post_description:string|null`를 제공하는 방식. 표시 규칙은 새 Go의 자유 string 계약과 제품 결정을 분리하고, 데이터 목록은 기존 posts/drive-files로 조합한다. 관리 PATCH를 읽기 대용으로 호출하지 않는다.

<a id="br-004"></a>

## BR-004 · 관리용 공지 목록의 Go 대체 경로

- 상태: 해결됨(Go /boards/{id}/notices @ 65b7f49)
- 발견일 / 발견 맥락: 2026-09-08 / 카탈로그에서 `GET /api/v1/post/badge/{board}`가 Go 없음으로 표시되어 공지 관리의 적용중·기간 외 목록이 막히는지 확인했다. **분류: 계약 누락. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 해결됨(Go /boards/{id}/notices / 2026-09-08 스냅샷) → 해결됨(Go /boards/{id}/notices @ 65b7f49).** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: 최초 후보는 공지 관리 목록 부재였지만 **NOTICE 관리용 대체 계약이 이미 존재**한다. 현행 프론트의 경로 전환 완료 여부나 운영 동작을 확인한 것은 아니다. 모든 과거 뱃지 종류가 그대로 지원된다는 뜻도 아니다.
- Go 현황: [docs/api/go/06-post-write.md:546](go/06-post-write.md#L546)의 notices 조회는 [docs/api/go/06-post-write.md:163](go/06-post-write.md#L163)에 `in_posts`·`out_posts` non-null 배열, [docs/api/go/06-post-write.md:148](go/06-post-write.md#L148)에 PostView와 추가 공지 필드를 정의한다. [docs/api/go/06-post-write.md:562](go/06-post-write.md#L562)의 unknown type은 빈 결과이며 실제 badge 타입은 [docs/api/go/06-post-write.md:152](go/06-post-write.md#L152)의 NOTICE다. [docs/api/go/06-post-write.md:570](go/06-post-write.md#L570)는 Read 뒤 CanManage별 상태 범위를 판정한다.
- Laravel 참고: [docs/api/laravel/05-post-read.md:267](laravel/05-post-read.md#L267)의 경로는 관리자용 뱃지 조회이며, [docs/api/laravel/05-post-read.md:280](laravel/05-post-read.md#L280)는 같은 두 목록 구분과 기간 필드를 기록한다. Go 대응 확인을 위한 비교일 뿐 Laravel 필드·권한을 이식하지 않는다.
- 프론트 임시 조치: 추가 우회나 코드 변경 없음. 공지 목록을 구현·전환할 때는 Go notices 계약만 사용한다. `MUST_READ` 등 별도 기능 요구가 실제 막히면 해당 요구를 새 BR로 등록한다.
- 백엔드 요청 내용: **NOTICE 목록 API 추가 구현은 불필요**하다. Go 대체 경로와 관리 권한별 조회 범위를 문서로 확인하여 이 후보를 해결 처리했다. 프론트 경로 전환은 별도 구현 작업이다.

<a id="br-005"></a>

## BR-005 · 라이브 방송 정보 조회 API

- 상태: 보류(방송 영역 요구 미확정)
- 발견일 / 발견 맥락: 2026-09-08 / 카탈로그의 라이브 방송 정보 후보를 대조했다. 홈에 방송명·설명·재생 대상을 표시할 때 필요한 계약이다. 현재 화면의 사용 여부와 실행 장애는 확인하지 않았다. **분류: 계약 누락. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 보류(방송 영역 요구 미확정) → 보류(방송 영역 요구 미확정).** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: 방송 영역을 구현하려면 방송 존재 여부와 재생 대상 정보가 필요하지만 Go 계약에 해당 조회가 없다. 기능 요구가 확정되기 전에는 제품 홈 전체의 차단으로 보지 않는다.
- Go 현황: [docs/api/go/README.md:393](go/README.md#L393)는 라이브 조회 경로·대체 API가 없고 현재 이식 계획도 없다고 명시한다. 최종 제품 결정은 별도다.
- Laravel 참고: [docs/api/laravel/10-drive-upload-department-live.md:372](laravel/10-drive-upload-department-live.md#L372)는 인증된 라이브 조회 경로를 제공했고, [docs/api/laravel/10-drive-upload-department-live.md:386](laravel/10-drive-upload-department-live.md#L386)는 `id`, `name`, `description`, `live_id`, `domain` 등을 가진 1건 또는 `null` 응답을 기록한다.
- 프론트 임시 조치: 호출·타입·방송 영역 추가 없음. 방송 도메인이나 URL 조합 규칙을 과거 계약에서 추정하지 않는다.
- 백엔드 요청 내용: 새 원문의 현재 미이식 계획을 따른다. 라이브 제품 요구가 별도로 확정되기 전에는 새 API를 요청하지 않는다. 확정 시 방송 없음/종료 상태·권한·재생 URL 형식과 TTL을 명시한 계약을 요청하며 과거 live_id/domain 조합을 구현 근거로 가져오지 않는다.

<a id="br-006"></a>

## BR-006 · 메인 위젯의 종류와 표시 방식 계약 확정

- 상태: 해결됨(Go /companies/{company_id}/settings @ 65b7f49)
- 발견일 / 발견 맥락: 2026-09-08 / Go 관리 문서의 미확인 부록을 점검하다 홈 위젯 설정·렌더링에 필요한 값의 의미가 Go 계약으로 확정되지 않은 것을 발견했다. 설정 조회 경로 문제는 BR-003이고, 이 항목은 조회 이후의 값 해석 문제다. **분류: 계약 누락. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 열림 → 해결됨(Go /companies/{company_id}/settings @ 65b7f49).** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: **기존 미확인 해소**. 새 원문은 widget의 자유 string 저장, 빈 문자열 기본값, CUSTOM일 때의 board_id 저장 규칙까지 명시한다. 서버가 다른 값을 렌더링/필터하는 집계 기능을 제공한다는 가정이 잘못된 전제였다. 프론트의 위젯 의미·표시 타입 선택은 제품 설계 문제로 남으며 이 상태는 해당 UI 구현 완료를 뜻하지 않는다.
- Go 현황: [docs/api/go/02-management.md:83](go/02-management.md#L83)의 `board_type`·`type`은 HTTP/DB enum 없는 자유 string이며 [docs/api/go/02-management.md:262](go/02-management.md#L262)는 생략 기본값을 빈 문자열로 확정한다. [docs/api/go/02-management.md:281](go/02-management.md#L281)는 CUSTOM일 때만 board_id가 저장되고 그 외 null임을 명시한다. 다른 값의 서버 필터·렌더링 의미는 계약에 없으며 과거 enum을 가져올 근거가 아니다. `/post/main`은 [docs/api/go/README.md:357](go/README.md#L357)에서 폐기되었으므로 과거 집계 동작 복원을 전제하지 않는다.
- Laravel 참고: [docs/api/laravel/02-management.md:253](laravel/02-management.md#L253)는 과거 위젯의 종류와 표시 타입을 열거한다. [docs/api/laravel/05-post-read.md:155](laravel/05-post-read.md#L155)는 그 값에 따른 필터와 개수를 설명한다. 이는 백엔드에 의미 확정을 요청하기 위한 비교이며 현행 enum 근거가 아니다.
- 프론트 임시 조치: 코드 변경 없음. 과거 NEW/PUBLIC/NOTICE/CUSTOM 또는 표시 타입 목록을 Go enum으로 제한하지 않는다. 회사 위젯 조회 공급 문제는 BR-003, 표시 규칙은 제품 결정으로 분리한다.
- 백엔드 요청 내용: 현재 저장 API의 값 검증·기본값 미확인 요청은 새 Go 문서로 해결 처리한다. 자유 문자열을 임의 enum으로 변경하거나 과거 /post/main 필터를 복원할 추가 요청은 없다. 제품이 지원값 검증을 요구하게 되면 그 구체적 필요를 별도 변경 요청으로 등록한다.

<a id="br-007"></a>

## BR-007 · 게시글 작성·수정 요청 본문 한도 확정

- 상태: 해결됨(Go 공통 Body 1 MiB·413 @ 65b7f49)
- 발견일 / 발견 맥락: 2026-09-08 / Go 게시글 쓰기 문서의 미확인 부록에서 글쓰기·수정 화면의 큰 HTML 본문 저장 시 사전 안내 근거를 점검했다. **분류: 문서 불일치. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 열림 → 해결됨(Go 공통 Body 1 MiB·413 @ 65b7f49).** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: **기존 본문 한도 미확인 해소**. 전체 JSON Body 기본 1 MiB와 초과413이 새 원문에 확정되어 저장 제한·오류 처리를 설계할 수 있다. HTML content만의 별도 문자 수 한도라는 뜻이 아니며 실제 배포 프록시가 더 작은 제한을 둘 가능성은 환경 확인 대상이다(BR-028). UI 검증 구현은 이번에 수행하지 않았다.
- Go 현황: [docs/api/go/README.md:122](go/README.md#L122)는 Body 전체 기본한도 **1 MiB(1,048,576 bytes)** 초과의 `413 REQUEST_ENTITY_TOO_LARGE`를 명시한다. [docs/api/go/README.md:130](go/README.md#L130)는 개별 maxLength/maxItems와 독립된 전체 Body 한도와 설치 Huma 2.39.0 근거를 확정한다. 게시글 작성·수정은 [docs/api/go/06-post-write.md:192](go/06-post-write.md#L192)·[docs/api/go/06-post-write.md:252](go/06-post-write.md#L252)의 JSON 계약이다.
- Laravel 참고: [docs/api/laravel/06-post-write.md:143](laravel/06-post-write.md#L143)는 HTML 본문 필드를 기록하지만, 그 행은 Go에 적용할 바이트 한도를 제공하지 않는다. 과거 multipart 업로드 계약은 Go 본문 크기 제한의 근거가 아니다.
- 프론트 임시 조치: 코드 변경 없음. 후속 글쓰기 전환에서는 전체 UTF-8 JSON 전송 크기와 413을 구분하고, 서버가 요청을 거부했을 때 작성 중 내용을 유지해야 한다. 새 원문의 수치를 운영 배포의 검증 결과라고 표현하지 않는다.
- 백엔드 요청 내용: 신규 API나 임의 한도 도입 요청은 없다. 새 Go 공통 한도/413 계약으로 문서 확인 요청을 종결한다. 운영 프록시·게이트웨이의 실효 한도는 BR-028에서 배포 담당자에게 확인한다.

<a id="br-008"></a>

## BR-008 · 게시글·댓글·공감 알림의 워커 연결과 전달 계약 확인

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / Go 쓰기·댓글 문서의 미확인 부록을 점검했다. 게시글/댓글/공감 후 상대방 알림과 알림 설정의 연동 검증이 대상이다. **분류: 환경 미확정. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 열림 → 열림.** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: **코드 미조사 해소, 운영 동작 미확정**. producer/worker/scheduler와 수신자·템플릿·재시도 동작은 새 원문에 명시되어 더 이상 미확인 코드가 아니다. 그러나 실제 배포의 자격·Redis·워커 실행·알림 템플릿·외부 가용성은 읽기만으로 확인할 수 없다. HTTP 성공은 알림 배달 성공이 아니며 이번에 운영 알림을 발송하거나 도달을 검증하지 않았다.
- Go 현황: [docs/api/go/README.md:209](go/README.md#L209)·[docs/api/go/README.md:211](go/README.md#L211)·[docs/api/go/README.md:213](go/README.md#L213)과 [docs/api/go/06-post-write.md:174](go/06-post-write.md#L174)는 producer 조립, Redis 미설정 시 enqueue 생략, worker 수신자/템플릿/언어/실패 동작을 확정했다. 따라서 코드 배선 미조사는 해소됐다. 단 [docs/api/go/README.md:13](go/README.md#L13)는 운영 OfficeNext·Redis·worker/scheduler·웹훅·알림 템플릿의 가용성과 실제 배달을 코드 밖의 입력으로 남긴다. [docs/api/go/09-drive-file.md:639](go/09-drive-file.md#L639)는 웹훅 설정 누락이 파일 정리 worker boot에도 영향을 줌을 명시한다. non-2xx 발송 latch 결함은 [BR-026](#br-026)이다.
- Laravel 참고: [docs/api/laravel/06-post-write.md:184](laravel/06-post-write.md#L184)는 게시·공지 큐의 설정별 필터, [docs/api/laravel/07-post-comment-like.md:127](laravel/07-post-comment-like.md#L127)는 댓글 알림 수신 대상, [docs/api/laravel/07-post-comment-like.md:282](laravel/07-post-comment-like.md#L282)와 [docs/api/laravel/07-post-comment-like.md:400](laravel/07-post-comment-like.md#L400)는 공감을 켤 때의 알림을 기록한다. 이 규칙이 Go에 존재한다고 가정하지 않는다.
- 프론트 임시 조치: 작성 성공 응답을 알림 발송 완료로 해석하는 신규 로직을 추가하지 않았다. 서버 응답에 없는 `notification_sent` 같은 필드도 만들지 않았다.
- 백엔드 요청 내용: 코드 배선 재조사 요청은 종결하고 배포 담당자 확인으로 범위를 좁힌다. 운영 OfficeNext와 알림 서비스 가용성, Redis/broker, API/worker/scheduler 모드 실행, DB 템플릿, 웹훅 설정 및 로그를 확인해 달라. 실제 수신 검증 결과·배포 버전을 받으면 환경 항목을 종결한다. non-2xx 응답 처리 자체의 서버 결함은 BR-026에 별도로 요청한다. 새 HTTP endpoint나 notification_sent 응답 필드를 요구하지 않는다.

<a id="br-009"></a>

## BR-009 · 게시글 첨부 영구삭제의 물리 삭제 시점 확정

- 상태: 해결됨(Go 첨부 purge 생명주기 @ 65b7f49)
- 발견일 / 발견 맥락: 2026-09-08 / Go 게시글 쓰기 문서의 미확인 부록에서 휴지통·영구삭제 후 첨부 보존 안내를 점검했다. 자료실 파일과 게시글 첨부를 같은 보존 정책으로 설명할 수 있는지가 대상이다. **분류: 문서 불일치. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 열림 → 해결됨(Go 첨부 purge 생명주기 @ 65b7f49).** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: **기존 첨부 정리 주기·보존 조건 미확인 해소**. 첨부7일과 자료실30일, purged 표시, 일일 enqueue 및 회차500개가 명확하다. 배포 worker 정상 실행 전제의 배치 대상 기준이지 정확한 물리 삭제 완료 SLA가 아니다. 복원 경합의 객체 손실은 BR-023, 운영 실행 여부는 BR-008로 남긴다. 프론트 문구나 삭제 UI를 변경한 완료 상태는 아니다.
- Go 현황: [docs/api/go/06-post-write.md:184](go/06-post-write.md#L184)는 첨부 정리를 매일 UTC 00:00 enqueue, `purged_at` 존재 또는 soft-delete **7일** 경과, 회차 최대500개, object 삭제 후 첨부 row 삭제로 확정한다. 실패 시 row 유지·다음 회차 backlog가 가능하므로 해당 시각에 모두 완료된다는 보장은 아니다. [docs/api/go/06-post-write.md:394](go/06-post-write.md#L394)는 글 row의 즉시 물리 삭제가 아님을 명시한다. 자료실 파일은 별도 [docs/api/go/09-drive-file.md:635](go/09-drive-file.md#L635)의 **30일** 조건이다. 복원 경합의 데이터 손실은 [BR-023](#br-023)으로 분리했다.
- Laravel 참고: [docs/api/laravel/06-post-write.md:233](laravel/06-post-write.md#L233)는 과거 permanent 작업의 첨부·썸네일 soft delete를 기록하며, [docs/api/laravel/06-post-write.md:243](laravel/06-post-write.md#L243)는 이름과 물리 삭제가 다름을 명시한다. 이 기록도 Go의 보존 기간을 정하지는 않는다.
- 프론트 임시 조치: 코드 변경 없음. 첨부7일과 자료실30일을 섞지 않는다. 삭제 표식 API 성공을 물리 삭제 완료로 표시하지 않고 배치 backlog와 운영 가용성의 경계를 반영할 수 있는 문서 근거를 확보했다.
- 백엔드 요청 내용: 보존 기간·실행 주기 문서 요청은 새 원문으로 종결한다. 새 endpoint/physical_deleted_at 필드는 요구하지 않는다. 복원과 S3 삭제의 원자성은 BR-023, 실제 worker 동작·외부 접근은 BR-008·029에서 각각 요청한다.

<a id="br-010"></a>

## BR-010 · Go 공통 요약과 도메인 본문의 계약 정합성

- 상태: 해결됨(Go 공통·도메인 규칙 정합 @ 65b7f49)
- 발견일 / 발견 맥락: 2026-09-08 / API 카탈로그를 Go 계약으로 다시 작성하며 오류 언어·시각 형식·정렬의 공통 규칙을 확인했다. **분류: 문서 불일치. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 열림 → 해결됨(Go 공통·도메인 규칙 정합 @ 65b7f49).** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: **기존 세 문서 상충 해소**. 표시명/에러 언어, /me 시각 예외, 게시글/자료실 정렬 범위를 새 원문이 구분하므로 이전의 전역 일반화는 폐기한다. 이번 작업이 서버 응답을 바꿨다는 뜻은 아니다. 새 원문 작성자가 명시한 기존 runtime 결함은 이 항목의 문서 오류와 구분하여 아래에 추적한다.
- Go 현황: [docs/api/go/README.md:90](go/README.md#L90)·[docs/api/go/README.md:95](go/README.md#L95)는 표시명 기본 ko와 오류 언어 기본 en을 분리한다. [docs/api/go/README.md:101](go/README.md#L101)와 [docs/api/go/01-auth-user.md:54](go/01-auth-user.md#L54)는 일반 UTC6, `/me` PG9, 부서 time.Time의 예외를 명시한다. 게시글 정렬은 [docs/api/go/05-post-read.md:280](go/05-post-read.md#L280)·[docs/api/go/05-post-read.md:357](go/05-post-read.md#L357), 자료실은 [docs/api/go/09-drive-file.md:151](go/09-drive-file.md#L151)의 endpoint별 규칙이며 미인식 자료실 정렬에도 dir가 적용된다. 기존 세 상충은 새 원문에서 해소됐다. 새 원문이 명시한 스키마/런타임 차이 등은 아래 README 이슈 선별표에서 별도 판정한다.
- Laravel 참고: 해당 없음 — **Go 문서 내부 정합성 문제**여서 이 항목을 위해 Laravel을 열 필요가 없다. 과거 계약으로 어느 설명이 맞는지 판정하지 않는다.
- 프론트 임시 조치: 코드 변경 없음. 후속 구현은 새 Go의 endpoint별 규칙을 사용한다. old README의 기본 ko·UTC 단일형식·모든 미지정 정렬 desc 문장을 현재 계약으로 재사용하지 않는다.
- 백엔드 요청 내용: 기존 Lang/시간/정렬의 문서 정합성 요청을 65b7f49 기준 새 원문으로 종결한다. 소스 작성자의 테스트 기록을 이번 프론트 작업에서 직접 실행한 검증으로 보고하지 않는다.

<a id="br-011"></a>

- **백엔드 회신 수신(2026-09-09)**: [BR 판정](backend-replies/backend-requests-triage.md) §4 — **「유지 안 함」. 삭제는 작성자 전용(D104)** 이고, 관리자가 남의 글을 지우면 에러가 아니라 `200 {affected:0, ignored_ids:[id]}` 로 **조용히 무시**된다. 판정 기준 커밋은 `65b7f49` 이며 제품 정책 답변이므로 `ebff9af` 재대조와 무관하게 유효하다. → **프론트 후속 2건이 필요하다**: ① 관리자에게 타인 글 삭제 메뉴를 노출하지 않는다 ② 일괄 삭제 응답의 `ignored_ids` 를 검사해 **전건 거부를 성공으로 표시하지 않는다**. 이번 갱신에서 코드는 바꾸지 않았다(인증 계약 확정 대기 — BR-036). 회신을 받았으므로 이 항목은 백엔드 요청 목록(`backend-requests-ask.md`)에서 제외한다.

## BR-011 · 관리자의 타인 게시글 삭제 정책 확인

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / Go 정책 전환을 위한 정적 코드 조사. [PostDetailScreen.tsx:292](../../src/components/board/PostDetailScreen.tsx#L292)는 `is_mine || is_admin`이면 삭제 메뉴를 보여 주고, [PostDetailScreen.tsx:383](../../src/components/board/PostDetailScreen.tsx#L383)의 확인 버튼은 삭제 성공 시 상세 화면에서 나간다. [usePostDetail.ts:145](../../src/hooks/usePostDetail.ts#L145)를 거쳐 [postService.ts:94](../../src/services/postService.ts#L94)의 단건 삭제가 호출되는 연결을 확인했다. **분류: 계약 누락. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 열림 → 열림.** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: **Go 전환 시 기능 실패·성공 오인**. 관리자가 남의 글을 삭제해도 Go는 `200 {affected:0, ignored_ids:[id]}`로 거부하므로 현재 void 응답 처리로는 삭제된 것처럼 화면을 떠난다. 이는 Go 경로로 전환했을 때의 계약상 결과이며 현재 운영 환경 장애를 실행 재현한 것은 아니다.
- Go 현황: [docs/api/go/06-post-write.md:340](go/06-post-write.md#L340)는 같은 회사 작성자·미삭제 조건만 삭제에 허용하며 관리자가 타인 글을 삭제하는 계약은 없다. [docs/api/go/06-post-write.md:125](go/06-post-write.md#L125)의 `affected`·`ignored_ids`, [docs/api/go/README.md:189](go/README.md#L189)의 단건 alias도 같은 규칙이다. [docs/api/go/05-post-read.md:209](go/05-post-read.md#L209)의 상세 `is_admin`은 회사·카테고리·게시판 관리자 OR이지만 삭제 허가는 아니다. 기존 UI 요구와 서버 정책 차이이며 현재 계약이 미조사라는 뜻은 아니다.
- Laravel 참고: [docs/api/laravel/06-post-write.md:197](laravel/06-post-write.md#L197)의 단건 삭제는 [docs/api/laravel/06-post-write.md:204](laravel/06-post-write.md#L204)에 작성자 또는 회사 관리자 또는 게시판 관리자 허용을 명시한다. 카테고리 관리자 단독 삭제까지 허용되었다고 확대하지 않는다.
- 프론트 임시 조치: 최초 문서 작업에서는 `src/**`를 수정하지 않았다. **후속 조치(2026-09-09)**: [usePostDetail.ts](../../src/hooks/usePostDetail.ts)의 `removePost`가 `affected === 0`을 오류로 올리고, 상세 화면은 「작성자만 이 글을 삭제할 수 있습니다」를 띄우며 화면에 머무른다 — 전건 거부를 더 이상 성공으로 처리하지 않는다. 관리자 삭제 «메뉴»의 노출 여부는 위 정책 회신 뒤에 정한다(임의로 바꾸지 않았다).
- 백엔드 요청 내용: 관리자의 타인 글 삭제를 제품 기능으로 유지할지 확인해 달라. **요청안(현행 아님)**: 유지한다면 Go `DELETE /api/v1/board/companies/{company_id}/users/{user_id}/posts`의 같은 회사·관리 대상 게시판 범위 안에서 회사/게시판 관리자 허용 여부를 명시하고 복원 주체까지 계약화한다. 카테고리 관리자는 별도 정책 판단이 필요하다. 작성자 전용 정책을 유지한다면 그 결정에 따라 프론트 삭제 메뉴를 제한하는 후속 작업으로 처리한다. 부분 실패 응답은 이미 존재하므로 새 응답 필드 요청은 없다.

<a id="br-012"></a>

- **`ebff9af` 재판정(2026-09-09)**: **해소됐지만 요청한 방식이 아니다.** 백엔드는 member 자격 공급 경로를 만든 것이 아니라 `board` 인증 계약 자체를 폐지하고 게시판 표면 64경로를 전부 `member` 로 통일했다([통지문](backend-replies/board-auth-contract-change.md) §1.1, 프론트 실측: `internal/**` 에 `BoardPrefixes`·`ContractBoard` 0건). 결과 ① 관리·개인 설정 API 는 **호출 가능한 계약**이 됐고 경로는 `/api/v1/board/companies/{c}/settings…` 로 이사했다(**`user_id` 세그먼트 없음**, 본인은 `/users/me`). ② 그러나 **이 앱의 독립 로그인 경로가 통째로 사라졌다** — Go 서비스에 로그인 엔드포인트가 하나도 없다. 즉 「설정을 저장할 수 없다」는 결손은 「무엇으로도 인증할 수 없다」로 **범위가 커졌다**. 이 항목의 원래 질문은 종결하고, 토큰 획득 방식 확정은 **BR-036** 으로 분리한다. 프론트 코드는 이번에 바꾸지 않았다(토큰 미정): `MEMBER_SETTINGS_UNSUPPORTED` 게이트는 그대로 두되 사유가 「board 토큰이라서」에서 「인증 토큰 공급 경로가 미정이라서」로 바뀌었다.
- **후속 종결(2026-09-10)**: 로그인을 OfficeWave 로 전환해 member 토큰을 갖게 되면서 **게이트를 걷었다.** `MEMBER_SETTINGS_UNSUPPORTED` 상수와 「다른 인증이 필요합니다」 문구를 삭제하고 개인 알림 4종(PATCH `{company}/settings/users/me`)·회사 설정(PATCH `{company}/settings`)에 mutation 을 붙였다. **실서버 실계정 실측(2026-09-10)**: 두 경로 모두 **200** — 개인 `{"is_like_alarm":false}` 은 응답 본문에 반영됐고 회사는 `{"latest_post_day":7}` 로 저장됐다. 이 항목은 종결한다.
- **파급분 후속 종결(2026-09-10 · 공개 범위·관리자 지정)**: 같은 401 전제로 막아 뒀던 두 번째 화면 기능도 걷었다. `GET /api/v1/board/companies/1/departments` 가 **실계정 200**(루트 1개 객체 · 부서 78 · 구성원 496, `category_id` 로 상위 카테고리 범위 가지치기)이라 「지정할 사용자·부서를 고를 목록이 없다」는 근거가 사라졌다. [NodeDetailPanel.tsx](../../src/components/settings/NodeDetailPanel.tsx) 의 「표시 + 제거만」과 [AddNodeModal.tsx](../../src/components/settings/AddNodeModal.tsx) 의 고정 「전체 공개」를 정본 조직도 피커로 교체하고 `admin-grant-add-blocked`·`admin-grant-remove-only` 문구를 삭제했다. **실계정 실측(2026-09-10, `TC2 - Board2`)**: 관리자 지정 `PUT {S}/boards/{id}` `{"insert_board_admin_user_id":[13]}` **200**, 공개 범위 `{"insert_board_department_id":[2],"delete_board_department_id":[1]}` **200**(`ignored_*` 빈 배열), 되돌리기 **200** 으로 원상복구. 관리자에 **부서 grant 가 없다**는 계약 사실은 프론트가 소속 구성원으로 펼쳐 대응하며(정본 힌트와 동일), 그 편차는 [설정 결정 기록](../features/settings/decision.md) 가정 11 에 적었다. 새 BR 은 만들지 않는다.

## BR-012 · 독립 로그인에서 설정 API용 member 자격 획득

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / Go 정책 전환 정적 조사 중 ID/PW 독립 로그인 후 개인 알림·회사 홈 설정 저장 흐름을 대조했다. [authService.ts:8](../../src/services/authService.ts#L8)의 당시 토큰 응답은 [authStorage.ts:17](../../src/lib/authStorage.ts#L17)에 저장되고 [apiClient.ts:16](../../src/lib/apiClient.ts#L16)은 당시 단일 access token을 모든 요청에 사용했다. (이 문장의 소스 줄 번호는 최초 조사 이력이다.) [GeneralTab.tsx:34](../../src/components/settings/GeneralTab.tsx#L34)와 [MainScreenTab.tsx:22](../../src/components/settings/MainScreenTab.tsx#L22)의 저장 동작은 `useSettings`를 거쳐 [settingService.ts:17](../../src/services/settingService.ts#L17)·[settingService.ts:31](../../src/services/settingService.ts#L31)에 연결된다. **분류: 계약 누락. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 열림 → 열림.** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: **독립 로그인 경로에서 설정 저장 불가**. Go 로그인으로 받은 board 토큰만 갖고 설정 URL을 Go로 바꾸면 member 인증에서 401이 난다. 최초 조사에서는 member401까지 전역 로그아웃으로 번졌다. **로그인 전환 후속 갱신**: [현재 apiClient](../../src/lib/apiClient.ts)는 board 경로에만 board bearer와 refresh를 적용하고 member401은 세션을 지우지 않는다. member 자격 공급의 결손 자체는 남아 있다. 실서버 재현은 하지 않았으며 상위 SSO가 별도 member 토큰을 제공하는 배포에는 이 결손을 그대로 적용하지 않는다.
- Go 현황: [docs/api/go/01-auth-user.md:274](go/01-auth-user.md#L274)의 ID/PW 로그인은 [docs/api/go/01-auth-user.md:307](go/01-auth-user.md#L307)의 TokenBody, [docs/api/go/01-auth-user.md:37](go/01-auth-user.md#L37)의 board 업무 토큰 필드를 반환한다(최상위 `$schema`는 [docs/api/go/README.md:144](go/README.md#L144)의 선택 메타데이터). [docs/api/go/01-auth-user.md:318](go/01-auth-user.md#L318)는 상위 토큰을 클라이언트에 반환하지 않음을 명시한다. 관리·개인 설정은 [docs/api/go/02-management.md:11](go/02-management.md#L11)의 OfficeWave member 계약이다. [docs/api/go/README.md:72](go/README.md#L72)·[docs/api/go/README.md:73](go/README.md#L73)의 HS256 board와 ES256 member는 교환 불가능하다. 독립 ID/PW 경로에서 member 자격을 얻는 계약은 이 문서 집합에 없다.
- Laravel 참고: [docs/api/laravel/01-auth-user.md:124](laravel/01-auth-user.md#L124)의 로그인은 Passport 토큰을 발급하고 [docs/api/laravel/01-auth-user.md:148](laravel/01-auth-user.md#L148)는 그 토큰을 이후 `/api/v1/*`에 사용한다고 기록한다. [docs/api/laravel/02-management.md:22](laravel/02-management.md#L22)의 설정 경로도 같은 Passport Bearer 계약이었다.
- 프론트 임시 조치: 문서 갱신 당시에는 코드 수정이 없었다. 이후 Go 로그인·회전 갱신·me·로그아웃을 연결하고 member401에 따른 board 세션 삭제를 막았다. board 토큰을 member 토큰이라고 저장하거나 서명·권한 검증을 우회하지 않는다. 상위 SSO 환경이라면 실제로 제공되는 member 토큰의 전달 계약을 확인한 뒤 프론트에서 토큰을 분리하는 것으로 해결될 수 있다. **실측 후속 갱신(2026-09-09)**: 로컬 실행 서버(:8090)에 로그인한 실브라우저의 board 토큰으로 `PATCH /companies/{c}/settings/users/me`, `PATCH /companies/{c}/settings`, `PUT /companies/{c}/settings/users/me/recent-search-keywords`, `GET /companies/{c}/departments`를 직접 호출해 **네 경로 모두 401 `UNAUTHORIZED`("Authentication required.")** 를 확인했다. 이 결손이 정적 추정이 아니라 실행 결과임이 확정됐다. 이에 따라 [settingService.ts](../../src/services/settingService.ts)에서 두 management 호출을 **삭제**하고, [useSettings.ts](../../src/hooks/useSettings.ts)의 개인·회사 설정 mutation은 `isSupported: false`로 항상 거절하도록 바꿨다. [GeneralTab.tsx](../../src/components/settings/GeneralTab.tsx)의 개인 알림 스위치 4개와 [MainScreenTab.tsx](../../src/components/settings/MainScreenTab.tsx)의 저장 버튼은 **비활성 + 사유 문구**로 표시한다(조용히 실패시키지 않는다). 게시판별 본인 알림은 board 계약인 `PUT {S}/boards/{id}/my-notification`으로 전환해 200을 확인했으므로 이 결손 범위에서 제외한다. **파급 후속 갱신(2026-09-09 · 환경설정 리뉴얼)**: 같은 401 을 맞는 `GET /companies/{cid}/departments`(조직도)의 부재가 개인 알림 저장과 **별개의** 화면 기능을 하나 더 막는다 — 「게시판 관리」의 공개 범위·관리자 지정이다. 게시판·카테고리 grant 쓰기 자체는 board 계약(`PUT {S}/boards/{id}` · `PUT {S}/categories/{id}` 의 `insert_*`/`delete_*`)으로 가능하지만, **지정할 사용자·부서를 고를 목록이 없다.** 그래서 [NodeDetailPanel.tsx](../../src/components/settings/NodeDetailPanel.tsx)는 현재 지정된 대상만 표시하고 X 로 **제거만** 할 수 있게 하고(제거는 id 를 응답에서 이미 알고 있으므로 조직도가 필요 없다), 「관리자 추가」 버튼은 `disabled` + 사유 문구(`admin-grant-add-blocked`)로 둔다. [AddNodeModal.tsx](../../src/components/settings/AddNodeModal.tsx)의 공개 범위 라디오도 「전체 공개」에 고정된 비활성이다. board 토큰으로 조직도를 호출하거나 사용자 id 를 손으로 입력받는 우회는 만들지 않았다. **이 항목이 해결되면 두 곳의 비활성이 함께 풀린다.**
- 백엔드 요청 내용: ID/PW로 독립 로그인하는 OC Board 웹이 member 계약 API를 사용하기 위한 공식 인증 흐름을 제공해 달라. **요청안(현행 아님)**: 안전한 member 자격 획득·갱신 흐름을 문서화하거나, 동등한 사용자·회사 관리자 권한 검사를 유지한 board 인증 설정 엔드포인트를 제공하는 방식 중 하나를 확정한다. 토큰 종류·응답 필드 타입·갱신 및 만료 계약을 함께 제시해야 한다. 검증 완화나 기존 board 토큰을 member 경로에서 무조건 수용하라는 요청은 아니다.

<a id="br-013"></a>

- **`ebff9af` 재판정(2026-09-09)**: **부분 해결로 되돌린다.** URL·파라미터·응답 계약은 그대로 유효하지만(🟡 6파일 38엔드포인트 불변), 이 전환이 전제한 **board 토큰이 없어졌다**. 「전환 완료」 서술은 `65b7f49` 시점에 참이었고, 지금은 같은 경로에 **member 토큰**을 실어야 한다. 남은 작업은 경로가 아니라 **토큰 종류 교체**이므로 BR-036 확정 후에 한 번에 반영한다. 이 항목의 실브라우저 검증 기록은 board 토큰으로 얻은 것이며 새 계약의 검증으로 재사용하지 않는다.

## BR-013 · API 경로·회사/사용자 스코프의 프론트 전환

- 상태: 해결됨(프론트 전환 @ 2026-09-09)
- 발견일 / 발견 맥락: 2026-09-08 / 정적 코드 조사. [postService.ts:43](../../src/services/postService.ts#L43)·[postService.ts:88](../../src/services/postService.ts#L88), [categoryService.ts:9](../../src/services/categoryService.ts#L9), [boardService.ts:18](../../src/services/boardService.ts#L18), [driveService.ts:23](../../src/services/driveService.ts#L23), [settingService.ts:18](../../src/services/settingService.ts#L18)에 과거 명사·경로가 남아 있다. [usePosts.ts:10](../../src/hooks/usePosts.ts#L10)·[usePostDetail.ts:35](../../src/hooks/usePostDetail.ts#L35)·[useDriveFiles.ts:18](../../src/hooks/useDriveFiles.ts#L18)를 거쳐 화면에 호출되는 연결을 확인했다. **분류: 프론트 미전환. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 보류(프론트 Go 전환 필요) → 보류(프론트 Go 전환 필요).** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: **Go로 연결 대상을 바꾸면 현재 호출 경로가 계약과 불일치**한다. 예를 들어 `/post`, `/category`, `/drive/file`, `/management/...`는 Go의 해당 목록·설정 경로가 아니다. 단순 base URL 교체는 회사·사용자 경로와 복수형 명사 변환을 하지 못한다. 현재 운영 서버의 오류를 실행 재현하지 않았다. **로그인 전환 후속 갱신**: base가 `/api/v1`인 현재 프론트에서는 로그인·조회 경로를 `/board/login`·`/board/me`로 변경했다. 나머지 도메인의 경로·회사/사용자 스코프 전환은 여전히 남아 있다.
- Go 현황: [docs/api/go/README.md:67](go/README.md#L67)의 인증 계약과 [docs/api/go/README.md:80](go/README.md#L80)의 회사/사용자 경로 검증을 사용한다. 실제 조회 경로는 [docs/api/go/05-post-read.md:442](go/05-post-read.md#L442) 게시글 상세, [docs/api/go/03-category.md:146](go/03-category.md#L146) 카테고리, [docs/api/go/04-board.md:297](go/04-board.md#L297) 북마크, [docs/api/go/09-drive-file.md:187](go/09-drive-file.md#L187) 파일 목록, [docs/api/go/02-management.md:295](go/02-management.md#L295) 개인 설정이다. API 계약은 이미 존재하며 기존 프론트의 경로·인증·query 직렬화 전환이 남아 있다.
- Laravel 참고: 추가 열람하지 않음. 이번 항목은 Go API 부재가 아니라 프론트 경로 미전환이며, 구현 근거는 위 Go 계약으로 충분하다. 기존 source의 문자열은 현재 호출 사실을 확인하는 근거일 뿐 새 경로를 추정하는 근거가 아니다.
- 프론트 임시 조치: 문서 갱신 때는 코드 변경이 없었다. 이후 로그인·refresh·me 연결을 새 Go 계약으로 전환했다. **메인 조회 후속 갱신(2026-09-08)**: 백엔드가 전달한17:50:10~11 KST의 실제 요청 진단에 따라 북마크, 게시글 페이지·공지 배열, 자료실 파일 배열·페이지, 일반·관리자 카테고리의7개 조회 함수를 Go의5개 경로로 전환했다. 회사·사용자는 board JWT에서 가져오고 페이지 봉투/배열 분기를 유지한다. 전체 bearer 첨부나 순차 조회로 우회하지 않는다. 적용 범위와 검증은 [메인 연결 전달 문서](../features/auth/go-main-backend-handoff.md)에 기록한다. 상세·쓰기·업로드·다운로드·설정의 남은 경로는 별도 전환 대상이므로 이 BR을 해결 처리하지 않는다. member 자격 획득의 결손은 BR-012로 분리했다.
- **전환 완료(2026-09-09)**: 남아 있던 옛 `/api/v1/post/**`·`/drive/**`·`/board/{id}`·`/board/bookmark/**`·`/board/member/**` 호출을 전부 Go 스코프 경로로 옮겼다. 실행 서버에서 옛 경로는 401(`/post/**`·`/drive/**`) 또는 404(`/board/{id}`)였고, [go/README.md:196](go/README.md#L196)이 명시한 대로 rewrite 대상이 아니다. 스코프 접두사·세션 고정은 [boardApi.ts](../../src/lib/boardApi.ts) 한 곳에서 GET/POST/PUT/DELETE 전부에 적용한다. 실브라우저로 게시글 상세 200, 댓글 작성 201·수정 200·삭제 200, 게시글 공감 토글 200, 조회 내역 200, 게시판 상세 200, 자료실 폴더 생성·이름변경·삭제 200, 게시판별 알림 200을 확인했다. 설정 저장의 member 자격 결손만 BR-012로 남는다.
- 백엔드 요청 내용: **신규 API 구현 불필요**. 문서에 존재하는 Go 경로·권한을 확인하고 프론트 서비스 호출을 전환한다. 배포 환경에 문서의 경로가 없다는 실제 결과가 나오는 경우에만 요청·응답·Go 버전을 붙여 새 백엔드 결손으로 분리한다.

<a id="br-014"></a>

- **`ebff9af` 재판정(2026-09-09)**: **부분 해결로 되돌린다.** URL·파라미터·응답 계약은 그대로 유효하지만(🟡 6파일 38엔드포인트 불변), 이 전환이 전제한 **board 토큰이 없어졌다**. 「전환 완료」 서술은 `65b7f49` 시점에 참이었고, 지금은 같은 경로에 **member 토큰**을 실어야 한다. 남은 작업은 경로가 아니라 **토큰 종류 교체**이므로 BR-036 확정 후에 한 번에 반영한다. 이 항목의 실브라우저 검증 기록은 board 토큰으로 얻은 것이며 새 계약의 검증으로 재사용하지 않는다.

## BR-014 · 자료실·게시글 첨부 다운로드 URL의 프론트 전환

- 상태: 해결됨(프론트 전환 @ 2026-09-09)
- 발견일 / 발견 맥락: 2026-09-08 / 정적 코드 조사. [DriveScreen.tsx:89](../../src/components/drive/DriveScreen.tsx#L89)는 파일 `src`를 전달하고 [DriveScreen.tsx:264](../../src/components/drive/DriveScreen.tsx#L264)는 없는 파일을 다운로드 대상에서 제외한다. [PostDetailScreen.tsx:113](../../src/components/board/PostDetailScreen.tsx#L113)의 첨부도 같은 다운로드 훅을 거쳐 [PostDetailScreen.tsx:315](../../src/components/board/PostDetailScreen.tsx#L315)에 연결된다. [useDriveDownload.ts:74](../../src/hooks/useDriveDownload.ts#L74)와 [driveDownload.ts:21](../../src/utils/driveDownload.ts#L21)은 `src`로 S3 URL을 조합한다. **분류: 프론트 미전환. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 보류(프론트 Go 전환 필요) → 보류(프론트 Go 전환 필요).** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: **Go 파일 응답을 공급하면 자료실 다운로드 대상이 비거나 미리보기가 불가**하고, 첨부 다운로드는 S3 환경 설정이 있을 때 없는 `src`의 문자열 처리 오류로 이어질 수 있다. 관련 환경 설정이 없으면 기존 훅이 먼저 비활성화한다. Go 계약과 실제 호출 연결의 정적 판정이며 실서버 다운로드를 재현하지 않았다.
- Go 현황: [docs/api/go/09-drive-file.md:57](go/09-drive-file.md#L57)는 파일 DTO에 `src`와 직접 다운로드 URL이 없다고 명시한다. 파일 URL은 [docs/api/go/09-drive-file.md:575](go/09-drive-file.md#L575), 첨부 URL은 [docs/api/go/05-post-read.md:489](go/05-post-read.md#L489)의 전용 GET으로 받는다. [docs/api/go/09-drive-file.md:607](go/09-drive-file.md#L607)·[docs/api/go/09-drive-file.md:613](go/09-drive-file.md#L613)는 5분 presigned URL을 재조합하지 말고 사용하도록 명시한다. 서명200은 S3 객체 존재나 브라우저 접근 성공 보장이 아니다([BR-029](#br-029)).
- Laravel 참고: 추가 열람하지 않음. 이미 Go 다운로드 API와 `src` 부재가 문서로 확인된 프론트 미전환이다. 과거 S3 키를 Go 응답 타입에 복원할 근거를 찾지 않는다.
- 프론트 임시 조치: 최초 문서 갱신에서는 코드·파일 타입 변경이 없었다. **메인 조회 후속 갱신(2026-09-08)**: Go 파일 목록 DTO와 표시 변환에서 원문에 없는 `src`·`position` 의존을 제거했다. 기존 URL 부재 처리를 유지하므로 다운로드·미리보기는 별도 전환 전까지 제공하지 못한다. 파일 ID와 리소스 종류로 기존 Go download-url을 받아 사용하는 작업은 남아 있으며 목록 조회 전환의 완료 범위에 넣지 않는다. 만료된 URL은 해당 계약으로 다시 발급받고 임의 S3 주소를 만들지 않는다. [메인 전달 문서](../features/auth/go-main-backend-handoff.md)에 범위를 기록한다.
- 백엔드 요청 내용: **신규 API·`src` 필드 추가 불필요**. 제공된 두 download-url 계약으로 프론트를 전환한다. 현행 코드의 환경 의존 URL 조합과 필수 `src` 타입을 교체하는 프론트 작업으로 관리한다.

<a id="br-015"></a>

- **`ebff9af` 재판정(2026-09-09)**: **부분 해결로 되돌린다.** URL·파라미터·응답 계약은 그대로 유효하지만(🟡 6파일 38엔드포인트 불변), 이 전환이 전제한 **board 토큰이 없어졌다**. 「전환 완료」 서술은 `65b7f49` 시점에 참이었고, 지금은 같은 경로에 **member 토큰**을 실어야 한다. 남은 작업은 경로가 아니라 **토큰 종류 교체**이므로 BR-036 확정 후에 한 번에 반영한다. 이 항목의 실브라우저 검증 기록은 board 토큰으로 얻은 것이며 새 계약의 검증으로 재사용하지 않는다.

## BR-015 · 자료실 상세의 중첩 board 응답 전환

- 상태: 해결됨(프론트 전환 @ 2026-09-09)
- 발견일 / 발견 맥락: 2026-09-08 / 정적 코드 조사. [types/drive.ts:45](../../src/types/drive.ts#L45)와 [driveService.ts:23](../../src/services/driveService.ts#L23)는 자료실 상세를 평평한 객체로 취급한다. [DriveScreen.tsx:278](../../src/components/drive/DriveScreen.tsx#L278)의 루트 `is_writable` 참조는 [DriveScreen.tsx:647](../../src/components/drive/DriveScreen.tsx#L647)의 폴더 추가와 [DriveScreen.tsx:658](../../src/components/drive/DriveScreen.tsx#L658)의 업로드 활성 상태에 연결된다. **분류: 프론트 미전환. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 보류(프론트 Go 전환 필요) → 보류(프론트 Go 전환 필요).** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: **URL만 Go로 전환하면 쓰기 권한이 있어도 폴더 추가·업로드가 비활성화**될 수 있다. [DriveScreen.tsx:310](../../src/components/drive/DriveScreen.tsx#L310)의 루트 금지 확장자·파일당 한도 참조도 Go 응답 위치와 달라 사전 검사 데이터를 읽지 못한다. 실제 화면을 Go 서버로 실행한 결과가 아닌 응답 shape와 JSX 바인딩의 정적 대조다.
- Go 현황: [docs/api/go/08-drive-folder.md:256](go/08-drive-folder.md#L256)의 자료실 상세 응답은 [docs/api/go/08-drive-folder.md:290](go/08-drive-folder.md#L290)부터 정의된다. [docs/api/go/08-drive-folder.md:292](go/08-drive-folder.md#L292)의 중첩 `board:BoardView`가 권한·설정의 근거이고 루트 `is_admin`, `size_limit`과 구분한다. [docs/api/go/08-drive-folder.md:301](go/08-drive-folder.md#L301)처럼 파일 목록은 별도 API다. 프론트가 읽는 데이터는 존재하지만 위치가 다르다.
- Laravel 참고: 추가 열람하지 않음. Go 응답에 필요한 필드가 이미 있으며 프론트의 필드 위치 가정이 낡은 문제다. 과거 평평한 응답을 Go에 추가할 근거로 사용하지 않는다.
- 프론트 임시 조치: 타입·화면 코드 변경 없음. 후속 전환에서 상세 DTO와 소비 지점을 Go의 중첩 구조로 함께 변경하고 실제 쓰기 권한과 업로드 제한이 전달되는지 확인해야 한다.
- 백엔드 요청 내용: **신규 API·중복 루트 필드 추가 불필요**. 현행 Go `DriveListingView` 계약에 맞춘 프론트 DTO·속성 참조 전환으로 해결한다.

<a id="br-016"></a>

- **`ebff9af` 재판정(2026-09-09)**: **부분 해결로 되돌린다.** URL·파라미터·응답 계약은 그대로 유효하지만(🟡 6파일 38엔드포인트 불변), 이 전환이 전제한 **board 토큰이 없어졌다**. 「전환 완료」 서술은 `65b7f49` 시점에 참이었고, 지금은 같은 경로에 **member 토큰**을 실어야 한다. 남은 작업은 경로가 아니라 **토큰 종류 교체**이므로 BR-036 확정 후에 한 번에 반영한다. 이 항목의 실브라우저 검증 기록은 board 토큰으로 얻은 것이며 새 계약의 검증으로 재사용하지 않는다.

## BR-016 · 자료실 일괄 삭제의 부분 실패 처리

- 상태: 해결됨(프론트 전환 @ 2026-09-09)
- 발견일 / 발견 맥락: 2026-09-08 / 정적 코드 조사. [driveService.ts:115](../../src/services/driveService.ts#L115)의 삭제 반환값은 `Promise<number>`로 선언되어 있다. 실제 삭제 버튼 [DriveScreen.tsx:954](../../src/components/drive/DriveScreen.tsx#L954)은 [DriveScreen.tsx:368](../../src/components/drive/DriveScreen.tsx#L368)의 핸들러를 호출하며, [DriveScreen.tsx:382](../../src/components/drive/DriveScreen.tsx#L382)는 응답이 숫자가 아니면 선택 전건 성공으로 계산한다. **분류: 프론트 미전환. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 보류(프론트 Go 전환 필요) → 보류(프론트 Go 전환 필요).** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: **Go의 객체 응답을 받으면 거부된 파일도 삭제 성공으로 오인**한다. 전건 거부가 `200 {affected:0, ignored_ids:[...]}`여도 현재 fallback은 전건 삭제로 집계한다. 정적 응답 대조로 확인했으며 실서버 삭제 요청은 실행하지 않았다.
- Go 현황: [docs/api/go/09-drive-file.md:167](go/09-drive-file.md#L167)는 `affected`·`ignored_ids` 객체를 정의한다. [docs/api/go/09-drive-file.md:401](go/09-drive-file.md#L401)·[docs/api/go/09-drive-file.md:407](go/09-drive-file.md#L407)는 부분/전건 거부도200임을 명시한다. [docs/api/go/09-drive-file.md:411](go/09-drive-file.md#L411)의 동시 삭제에서는 affected가 줄어도 사전 ignored_ids가 늘지 않을 수 있으므로 `요청수 - ignored_ids수`를 실제 성공 수로 단정하지 않는다.
- Laravel 참고: 추가 열람하지 않음. 이 문제는 Go의 기존 부분 실패 계약을 프론트가 읽지 않는 것이므로 과거 숫자 응답을 구현 근거로 사용할 필요가 없다.
- 프론트 임시 조치: 코드 변경 없음. 후속 작업에서 실제 `affected`와 `ignored_ids`를 사용하고 전건 성공 가정을 제거해야 한다. 게시글 관리자 삭제의 정책 차이는 BR-011로 별도 추적한다. 동시 삭제에서는 affected를 실제 성공 수로 사용하고 ignored_ids만으로 전건 결과를 역산하지 않는다.
- 백엔드 요청 내용: **신규 응답 필드·별도 삭제 API 불필요**. 현행 Go 결과를 반영하는 프론트 처리가 필요하다. `ignored_ids`별 권한·존재 여부를 노출하는 응답 확장은 요청하지 않는다.

<a id="br-017"></a>

- **`ebff9af` 재판정(2026-09-09)**: **부분 해결로 되돌린다.** URL·파라미터·응답 계약은 그대로 유효하지만(🟡 6파일 38엔드포인트 불변), 이 전환이 전제한 **board 토큰이 없어졌다**. 「전환 완료」 서술은 `65b7f49` 시점에 참이었고, 지금은 같은 경로에 **member 토큰**을 실어야 한다. 남은 작업은 경로가 아니라 **토큰 종류 교체**이므로 BR-036 확정 후에 한 번에 반영한다. 이 항목의 실브라우저 검증 기록은 board 토큰으로 얻은 것이며 새 계약의 검증으로 재사용하지 않는다.

## BR-017 · 자료실 업로드 발급·완료 경로와 응답 전환

- 상태: 해결됨(프론트 전환 @ 2026-09-09)
- 발견일 / 발견 맥락: 2026-09-08 / 정적 코드 조사. [driveService.ts:139](../../src/services/driveService.ts#L139)의 과거 presign 경로와 [driveService.ts:167](../../src/services/driveService.ts#L167)의 `/drive/callback`을 [useDriveUpload.ts:89](../../src/hooks/useDriveUpload.ts#L89)가 발급→PUT→완료 순서로 호출한다. [DriveScreen.tsx:1043](../../src/components/drive/DriveScreen.tsx#L1043)의 업로드 모달 시작·재시도까지 연결되어 있다. [types/drive.ts:94](../../src/types/drive.ts#L94)의 필수 `object_key`와 요청 echo 가정도 Go 응답과 다르다. **분류: 프론트 미전환. 갱신: 2026-09-08, feat/settings @ 65b7f49 원문 대조. 이력: 보류(프론트 Go 전환 필요) → 보류(프론트 Go 전환 필요).** 최초 정적 조사 기록이며 이번 문서 갱신에서 화면·네트워크·테스트를 재실행하지 않았다.
- 증상: **Go 서버에 과거 발급·callback 경로로 요청하면 업로드 흐름이 성립하지 않는다**. URL 전환 시에도 완료 요청의 파일 ID는 경로에 넣고 결과 배열은 입력 순서로 연결해야 한다. `object_key`가 없다는 사실 자체가 완료 오류의 원인은 아니다. Go는 완료 body를 무시하므로 핵심 파손은 과거 경로와 호출 계약이다. 네트워크 업로드로 재현하지 않았다.
- Go 현황: [docs/api/go/10-upload-department-client.md:147](go/10-upload-department-client.md#L147)의 발급과 [docs/api/go/10-upload-department-client.md:209](go/10-upload-department-client.md#L209)의 완료 경로가 존재한다. [docs/api/go/10-upload-department-client.md:33](go/10-upload-department-client.md#L33)의 입력순서 result 배열에는 [docs/api/go/10-upload-department-client.md:193](go/10-upload-department-client.md#L193)처럼 echo·object_key가 없다. 완료는 [docs/api/go/10-upload-department-client.md:227](go/10-upload-department-client.md#L227)의 선택 body를 무시하고 path ID·저장 key를 사용한다. [docs/api/go/10-upload-department-client.md:245](go/10-upload-department-client.md#L245)에 따르면 완료200도 ACT/FAIL/UPLOADING일 수 있어 state를 확인해야 한다.
- Laravel 참고: 추가 열람하지 않음. Go 업로드 발급·완료 계약이 이미 존재하는 프론트 미전환이므로 과거 callback body나 echo 응답을 Go로 복원할 근거를 찾지 않는다.
- 프론트 임시 조치: 코드·타입 변경 없음. 후속 작업에서 입력 파일과 결과의 순서를 유지하고 파일별 `result.state`를 검사하며, 성공한 `file_id`로 완료 URL을 구성해야 한다. 거부된 파일을 재시도할 때도 기존 Go 계약을 사용한다. 완료200의 ACT/FAIL/UPLOADING 분기도 후속 전환에 포함한다. DB 예약 응답 success와 업로드 완료 ACT를 구분한다.
- 백엔드 요청 내용: **신규 업로드 API·`object_key` 응답 추가 불필요**. 제공된 presign과 upload-complete 계약에 맞춰 프론트 서비스·응답 타입·호출 흐름을 전환한다.

<a id="br-018"></a>

- **`ebff9af` 재판정(2026-09-09)**: **미판정.** 백엔드 판정([backend-requests-triage.md](backend-replies/backend-requests-triage.md))은 이 항목을 「인정」으로 확인했지만 그 판정 기준은 **`65b7f49`** 다. `ebff9af` 는 167파일 (+8,269 −9,278)을 바꾸고 `migrations/board/000001` 도 96줄 수정했다 — 도메인 로직 변경 여부는 확인되지 않았다. 상태는 열림으로 두고, 판정 근거의 파일:라인은 재대조 후 갱신한다.

## BR-018 · 회사 설정의 DB CHECK 위반을 입력 오류로 반환

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / 새 백엔드 doc/api/ 원문을 기준으로 회사 설정 저장의 영향을 선별했다. **분류: 백엔드 동작 결함. 갱신: 2026-09-08, feat/settings @ 65b7f49. 이력: 신규 → 열림.** 원문 작성자의 코드 조사 결과를 인용하며 이번 프론트 작업에서 런타임 장애·테스트를 직접 재현하지 않았다.
- 증상: 회사 설정의 latest_post_day<=0 또는 허용되지 않는 latest_post_type을 HTTP 단계에서 막지 않아 DB CHECK 위반이500으로 노출된다. 사용자는 잘못된 입력과 서버 장애를 구분하기 어렵다.
- Go 현황: [docs/api/go/README.md:459](go/README.md#L459)의 발견 이슈, [docs/api/go/02-management.md:248](go/02-management.md#L248)·[docs/api/go/02-management.md:249](go/02-management.md#L249)의 HTTP/DB 제약 차이, [docs/api/go/02-management.md:277](go/02-management.md#L277)의 DB 검증500이 근거다. 새 원문이 현재 동작을 명확히 설명한 서버 입력 검증 결함이다.
- Laravel 참고: 추가 열람하지 않음. 새 Go 원문이 현재 동작과 문제를 직접 설명하므로 과거 구현을 근거로 삼을 필요가 없다. 현행 계약/환경의 보완 요청이며 Laravel에 있던 필드나 기본값을 추정하지 않는다.
- 프론트 임시 조치: 프론트 수정 없음. 후속 폼에서는 Go DB 계약의 양수·허용값을 검증하되 서버의 검증 책임을 대체하지 않는다.
- 백엔드 요청 내용: PATCH /api/v1/companies/{company_id}/settings의 latest_post_day:integer/정수문자열과 latest_post_type:string을 DB 제약과 일치하게 입력 단계에서 검증해 달라. **요청안**: 범위/enum 위반은400 INVALID_PAYLOAD와 필드별 details로 반환하고 트랜잭션을 시작하지 않는다. 기존 정상값·생략 유지 의미는 바꾸지 않으며 변경 계약과 검증 예시를 Go 문서에 반영해 달라.

<a id="br-019"></a>

- **`ebff9af` 재판정(2026-09-09)**: **미판정.** 백엔드 판정([backend-requests-triage.md](backend-replies/backend-requests-triage.md))은 이 항목을 「인정」으로 확인했지만 그 판정 기준은 **`65b7f49`** 다. `ebff9af` 는 167파일 (+8,269 −9,278)을 바꾸고 `migrations/board/000001` 도 96줄 수정했다 — 도메인 로직 변경 여부는 확인되지 않았다. 상태는 열림으로 두고, 판정 근거의 파일:라인은 재대조 후 갱신한다.

## BR-019 · 업로드 예약의 음수 파일 크기 검증

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / 새 백엔드 doc/api/ 원문을 기준으로 자료실 다중 파일 업로드의 영향을 선별했다. **분류: 백엔드 동작 결함. 갱신: 2026-09-08, feat/settings @ 65b7f49. 이력: 신규 → 열림.** 원문 작성자의 코드 조사 결과를 인용하며 이번 프론트 작업에서 런타임 장애·테스트를 직접 재현하지 않았다.
- 증상: 음수 files[].size가 형식 검증을 통과해 DB CHECK 오류로 다중 예약 트랜잭션 전체500을 만들 수 있다. 한 잘못된 파일이 다른 정상 파일 예약까지 실패시키는 경우다. 예약 후 서명실패로 행이 남는 별도 분기는1시간 예약 만료 계약과 구분한다.
- Go 현황: [docs/api/go/README.md:461](go/README.md#L461)가 음수 크기와 DB CHECK의 배치500을 기록한다. [docs/api/go/10-upload-department-client.md:170](go/10-upload-department-client.md#L170)의 size는 int64이지만 스키마 최소값이 없고 DB는0이상이다. [docs/api/go/10-upload-department-client.md:173](go/10-upload-department-client.md#L173)·[docs/api/go/10-upload-department-client.md:177](go/10-upload-department-client.md#L177)는 입력 검증과 도메인 판정 순서를 명시한다.
- Laravel 참고: 추가 열람하지 않음. 새 Go 원문이 현재 동작과 문제를 직접 설명하므로 과거 구현을 근거로 삼을 필요가 없다. 현행 계약/환경의 보완 요청이며 Laravel에 있던 필드나 기본값을 추정하지 않는다.
- 프론트 임시 조치: 프론트 변경 없음. 브라우저 File.size를 사용하더라도 서버 API 입력 검증이 필요하며, 현재 코드가 음수를 만든다고 주장하지 않는다.
- 백엔드 요청 내용: POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive-uploads의 files[].size:int64에 **요청안**으로 minimum0을 적용해 DB 저장 전에400 INVALID_PAYLOAD로 거부해 달라. 음수1건+정상1건에서 DB500이 아닌 입력 오류와 저장 없음이 보장되는지 확인하고,200 파일별 result 계약과의 경계를 문서화해 달라.

<a id="br-020"></a>

- **`ebff9af` 재판정(2026-09-09)**: **미판정.** 백엔드 판정([backend-requests-triage.md](backend-replies/backend-requests-triage.md))은 이 항목을 「인정」으로 확인했지만 그 판정 기준은 **`65b7f49`** 다. `ebff9af` 는 167파일 (+8,269 −9,278)을 바꾸고 `migrations/board/000001` 도 96줄 수정했다 — 도메인 로직 변경 여부는 확인되지 않았다. 상태는 열림으로 두고, 판정 근거의 파일:라인은 재대조 후 갱신한다.

## BR-020 · 삭제된 자료실 폴더 아래 생성·업로드 방지

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / 새 백엔드 doc/api/ 원문을 기준으로 자료실 폴더 생성·파일 업로드의 영향을 선별했다. **분류: 백엔드 동작 결함. 갱신: 2026-09-08, feat/settings @ 65b7f49. 이력: 신규 → 열림.** 원문 작성자의 코드 조사 결과를 인용하며 이번 프론트 작업에서 런타임 장애·테스트를 직접 재현하지 않았다.
- 증상: 폴더가 soft-delete된 뒤에도 새 폴더의 부모나 업로드 위치로 선택할 수 있어 성공 응답 뒤 루트 트리에서 결과를 찾지 못할 수 있다. 유효한 선택 후 다른 사용자가 폴더를 삭제하는 경우도 프론트만으로 막을 수 없다.
- Go 현황: [docs/api/go/README.md:462](go/README.md#L462)는 업로드/자식 폴더 부모 검사에 deleted_at 조건이 없음을 기록한다. [docs/api/go/08-drive-folder.md:100](go/08-drive-folder.md#L100)는 새 폴더가200이어도 트리에 보이지 않을 수 있다고 설명한다. 업로드 입력/판정은 [docs/api/go/10-upload-department-client.md:171](go/10-upload-department-client.md#L171)·[docs/api/go/10-upload-department-client.md:177](go/10-upload-department-client.md#L177)다.
- Laravel 참고: 추가 열람하지 않음. 새 Go 원문이 현재 동작과 문제를 직접 설명하므로 과거 구현을 근거로 삼을 필요가 없다. 현행 계약/환경의 보완 요청이며 Laravel에 있던 필드나 기본값을 추정하지 않는다.
- 프론트 임시 조치: 프론트 수정 없음. 살아 있는 트리의 ID만 선택하는 후속 UI 검증은 가능하지만 동시 삭제까지 보장하지 못한다.
- 백엔드 요청 내용: POST .../boards/{id}/folders의 parent_id/parent_drive_folder_id와 POST .../boards/{id}/drive-uploads의 drive_folder_id에서 같은 회사·게시판뿐 아니라 부모 생존도 검증해 달라. **요청안**: 삭제 부모는422 FOLDER_PARENT_INVALID로 거부하고, 검증과 INSERT 사이 삭제 경합도 같은 잠금/재검증 정책으로 보호한다. 결과 파일·폴더가 접근 불가능한 위치에 생성되지 않도록 해 달라.

<a id="br-021"></a>

- **`ebff9af` 재판정(2026-09-09)**: **미판정.** 백엔드 판정([backend-requests-triage.md](backend-replies/backend-requests-triage.md))은 이 항목을 「인정」으로 확인했지만 그 판정 기준은 **`65b7f49`** 다. `ebff9af` 는 167파일 (+8,269 −9,278)을 바꾸고 `migrations/board/000001` 도 96줄 수정했다 — 도메인 로직 변경 여부는 확인되지 않았다. 상태는 열림으로 두고, 판정 근거의 파일:라인은 재대조 후 갱신한다.

## BR-021 · 기존 폴더를 자료실 루트로 이동하는 계약

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / 새 백엔드 doc/api/ 원문을 기준으로 자료실 폴더 이동에서 루트 선택의 영향을 선별했다. **분류: 계약 누락. 갱신: 2026-09-08, feat/settings @ 65b7f49. 이력: 신규 → 열림.** 원문 작성자의 코드 조사 결과를 인용하며 이번 프론트 작업에서 런타임 장애·테스트를 직접 재현하지 않았다.
- 증상: 폴더 수정의 parent_id:null과 생략이 모두 기존 부모 유지로 해석되므로 하위 폴더를 루트로 옮길 요청 형태가 없다. 새 원문으로 현재 동작은 확정됐지만 루트 이동 기능을 구현할 계약은 부족하다.
- Go 현황: [docs/api/go/README.md:463](go/README.md#L463)와 [docs/api/go/08-drive-folder.md:178](go/08-drive-folder.md#L178)는 null도 기존 값 유지라고 명시한다. [docs/api/go/08-drive-folder.md:192](go/08-drive-folder.md#L192)는 루트 이동 불가를 확정한다. [docs/api/go/08-drive-folder.md:172](go/08-drive-folder.md#L172)에 따라 생성용 parent_drive_folder_id를 수정에 보내면400이므로 우회할 수 없다.
- Laravel 참고: 추가 열람하지 않음. 새 Go 원문이 현재 동작과 문제를 직접 설명하므로 과거 구현을 근거로 삼을 필요가 없다. 현행 계약/환경의 보완 요청이며 Laravel에 있던 필드나 기본값을 추정하지 않는다.
- 프론트 임시 조치: 폴더 이동 코드 변경 없음. null을 보내 놓고 성공했다고 표시하는 새 구현이나 delete/recreate 우회는 하지 않는다.
- 백엔드 요청 내용: PUT /api/v1/board/companies/{company_id}/users/{user_id}/folders/{id}에 루트 이동 방법을 제공해 달라. **요청안(미구현)**: parent_id 생략=유지, 명시null=루트라는 구분을 도입하거나 clear_parent:boolean 같은 명시적 필드를 제공하는 방식 중 하나를 선택한다. UUID 이동의 생존/회사/게시판/순환 검사와 기존 호출의 호환 영향을 함께 문서화해 달라.

<a id="br-022"></a>

- **`ebff9af` 재판정(2026-09-09)**: **미판정.** 백엔드 판정([backend-requests-triage.md](backend-replies/backend-requests-triage.md))은 이 항목을 「인정」으로 확인했지만 그 판정 기준은 **`65b7f49`** 다. `ebff9af` 는 167파일 (+8,269 −9,278)을 바꾸고 `migrations/board/000001` 도 96줄 수정했다 — 도메인 로직 변경 여부는 확인되지 않았다. 상태는 열림으로 두고, 판정 근거의 파일:라인은 재대조 후 갱신한다.

## BR-022 · 파일 복원 시 직접 해제한 북마크 보존

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / 새 백엔드 doc/api/ 원문을 기준으로 자료실 휴지통 복원·북마크 목록의 영향을 선별했다. **분류: 백엔드 동작 결함. 갱신: 2026-09-08, feat/settings @ 65b7f49. 이력: 신규 → 열림.** 원문 작성자의 코드 조사 결과를 인용하며 이번 프론트 작업에서 런타임 장애·테스트를 직접 재현하지 않았다.
- 증상: 파일을 복원하면 파일 삭제 전에 사용자가 직접 해제해 둔 북마크까지 모든 사용자의 soft-deleted 북마크가 살아난다. 파일 복구가 다른 사용자의 이전 북마크 선택을 변경한다.
- Go 현황: [docs/api/go/README.md:464](go/README.md#L464)의 이슈와 [docs/api/go/09-drive-file.md:183](go/09-drive-file.md#L183)·[docs/api/go/09-drive-file.md:510](go/09-drive-file.md#L510)가 모든 soft-deleted 북마크 복원을 명시한다. 휴지통 이동 때는 [docs/api/go/09-drive-file.md:411](go/09-drive-file.md#L411)처럼 당시 살아 있는 북마크만 함께 삭제한다.
- Laravel 참고: 추가 열람하지 않음. 새 Go 원문이 현재 동작과 문제를 직접 설명하므로 과거 구현을 근거로 삼을 필요가 없다. 현행 계약/환경의 보완 요청이며 Laravel에 있던 필드나 기본값을 추정하지 않는다.
- 프론트 임시 조치: 프론트 수정 없음. 다른 사용자의 북마크를 알거나 다시 해제하는 보상 호출로 해결할 수 없다.
- 백엔드 요청 내용: POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/restore에서 파일 삭제로 함께 지워진 북마크만 복원해 달라. **요청안**: 삭제 배치/시각 등 추적 근거로 복원 범위를 한정하여 사용자의 선행 수동 해제를 보존하고, 기존200 복원 결과 구조는 유지한다. 이전 해제/동반 삭제 북마크 각각의 복원 예시를 Go 문서에 제시해 달라.

<a id="br-023"></a>

- **`ebff9af` 재판정(2026-09-09)**: **미판정.** 백엔드 판정([backend-requests-triage.md](backend-replies/backend-requests-triage.md))은 이 항목을 「인정」으로 확인했지만 그 판정 기준은 **`65b7f49`** 다. `ebff9af` 는 167파일 (+8,269 −9,278)을 바꾸고 `migrations/board/000001` 도 96줄 수정했다 — 도메인 로직 변경 여부는 확인되지 않았다. 상태는 열림으로 두고, 판정 근거의 파일:라인은 재대조 후 갱신한다.

## BR-023 · 객체 정리와 복원의 경합으로 인한 파일 손실 방지

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / 새 백엔드 doc/api/ 원문을 기준으로 자료실·게시글 휴지통 복원 후 다운로드의 영향을 선별했다. **분류: 백엔드 동작 결함. 갱신: 2026-09-08, feat/settings @ 65b7f49. 이력: 신규 → 열림.** 원문 작성자의 코드 조사 결과를 인용하며 이번 프론트 작업에서 런타임 장애·테스트를 직접 재현하지 않았다.
- 증상: 정리 배치가 먼저 S3 객체를 지운 뒤 DB의 재검증에서 동시 복원을 감지하면 복원된 행만 남고 실제 bytes는 사라질 수 있다. 프론트가 복원 성공을 받아도 다운로드할 수 없는 데이터 손실 위험이다. 실제 운영 손실을 이번에 재현한 것은 아니다.
- Go 현황: [docs/api/go/README.md:465](go/README.md#L465)와 [docs/api/go/09-drive-file.md:641](go/09-drive-file.md#L641)는 자료실 purge의 SELECT→S3 DELETE→DB 조건부 삭제 사이 경합을 기록한다. [docs/api/go/06-post-write.md:184](go/06-post-write.md#L184)는 게시글 첨부 정리에서도 같은 원자성 문제가 있음을 명시한다. 보존 기간/주기 자체는 기존 [BR-009](#br-009)에서 확인 완료했다.
- Laravel 참고: 추가 열람하지 않음. 새 Go 원문이 현재 동작과 문제를 직접 설명하므로 과거 구현을 근거로 삼을 필요가 없다. 현행 계약/환경의 보완 요청이며 Laravel에 있던 필드나 기본값을 추정하지 않는다.
- 프론트 임시 조치: 코드 수정 없음. 클라이언트의 시간 계산이나 추가 HEAD 확인만으로 서버 정리와 복원을 원자화할 수 없다. 복원/다운로드 실패를 숨기는 우회를 만들지 않는다.
- 백엔드 요청 내용: 자료실 drive-files/restore와 첨부가 동반되는 posts/restore를 객체 정리 worker와 조율해 달라. **요청안**: 복원 가능한 대상을 정리 작업이 선점한 뒤 복원을 명확히 거절하거나, 복원 성공을 확정한 대상은 S3 삭제하지 않도록 단일 lifecycle 경계를 마련한다. DB행 보호뿐 아니라 object 보존/삭제 결과까지 검증하고 복원 불가 상태코드와 재시도 정책을 계약화해 달라.

<a id="br-024"></a>

- **`ebff9af` 재판정(2026-09-09)**: **미판정.** 백엔드 판정([backend-requests-triage.md](backend-replies/backend-requests-triage.md))은 이 항목을 「인정」으로 확인했지만 그 판정 기준은 **`65b7f49`** 다. `ebff9af` 는 167파일 (+8,269 −9,278)을 바꾸고 `migrations/board/000001` 도 96줄 수정했다 — 도메인 로직 변경 여부는 확인되지 않았다. 상태는 열림으로 두고, 판정 근거의 파일:라인은 재대조 후 갱신한다.

## BR-024 · 게시글 복원 시 개별 삭제 댓글의 삭제 상태 보존

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / 새 백엔드 doc/api/ 원문을 기준으로 게시글 휴지통 복원·댓글 목록의 영향을 선별했다. **분류: 백엔드 동작 결함. 갱신: 2026-09-08, feat/settings @ 65b7f49. 이력: 신규 → 열림.** 원문 작성자의 코드 조사 결과를 인용하며 이번 프론트 작업에서 런타임 장애·테스트를 직접 재현하지 않았다.
- 증상: 게시글 복원이 게시글 삭제 전부터 개별 삭제되어 있던 댓글까지 모두 active로 바꾸어 삭제한 내용이 다시 보일 수 있다. 첨부·뱃지 등과 댓글의 복원 범위가 다르다.
- Go 현황: [docs/api/go/README.md:466](go/README.md#L466)와 [docs/api/go/06-post-write.md:440](go/06-post-write.md#L440)가 기존 개별 삭제 댓글까지 전부 활성화하는 예외를 기록한다. 같은 절에서 다른 자식은 글 삭제 timestamp와 같은 삭제분만 복원한다고 구분한다.
- Laravel 참고: 추가 열람하지 않음. 새 Go 원문이 현재 동작과 문제를 직접 설명하므로 과거 구현을 근거로 삼을 필요가 없다. 현행 계약/환경의 보완 요청이며 Laravel에 있던 필드나 기본값을 추정하지 않는다.
- 프론트 임시 조치: 프론트·댓글 내용 변경 없음. 과거 삭제 provenance가 응답에 없어 UI가 복원 후 어떤 댓글을 다시 가릴지 정확히 판정할 수 없다.
- 백엔드 요청 내용: POST /api/v1/board/companies/{company_id}/users/{user_id}/posts/restore에서 글 삭제에 동반된 댓글만 활성화하고 이전 개별 삭제 댓글은 is_active=false로 보존해 달라. **요청안**: 삭제 provenance/시각을 추적하여 복원 범위를 구별한다. 데이터 마이그레이션이 필요하면 과거 행의 판정 불가 범위와 정책까지 Go 문서에 명시해 달라.

<a id="br-025"></a>

- **`ebff9af` 재판정(2026-09-09)**: **미판정.** 백엔드 판정([backend-requests-triage.md](backend-replies/backend-requests-triage.md))은 이 항목을 「인정」으로 확인했지만 그 판정 기준은 **`65b7f49`** 다. `ebff9af` 는 167파일 (+8,269 −9,278)을 바꾸고 `migrations/board/000001` 도 96줄 수정했다 — 도메인 로직 변경 여부는 확인되지 않았다. 상태는 열림으로 두고, 판정 근거의 파일:라인은 재대조 후 갱신한다.

## BR-025 · 영구삭제 표시 게시글의 직접 상세 조회 차단

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / 새 백엔드 doc/api/ 원문을 기준으로 게시글 영구삭제 후 직접 URL로 상세 접근의 영향을 선별했다. **분류: 백엔드 동작 결함. 갱신: 2026-09-08, feat/settings @ 65b7f49. 이력: 신규 → 열림.** 원문 작성자의 코드 조사 결과를 인용하며 이번 프론트 작업에서 런타임 장애·테스트를 직접 재현하지 않았다.
- 증상: 작성자는 영구삭제 표식이 찍힌 게시글을 직접 상세 조회할 수 있는 경로가 있어 휴지통/복원 제외 상태와 직접 조회 가능 상태가 어긋난다. 새로운 Go 원문이 확인한 동작이며 운영 URL 접근을 이번에 실행하지 않았다.
- Go 현황: [docs/api/go/README.md:467](go/README.md#L467), [docs/api/go/06-post-write.md:43](go/06-post-write.md#L43)·[docs/api/go/06-post-write.md:394](go/06-post-write.md#L394)가 작성자 상세 분기의 purged_at 조건 누락을 명시한다. 상세 endpoint는 [docs/api/go/05-post-read.md:442](go/05-post-read.md#L442)다. 따라서 “purge면 게시글 상세도 항상404”로 현재 계약을 잘못 설명하지 않는다.
- Laravel 참고: 추가 열람하지 않음. 새 Go 원문이 현재 동작과 문제를 직접 설명하므로 과거 구현을 근거로 삼을 필요가 없다. 현행 계약/환경의 보완 요청이며 Laravel에 있던 필드나 기본값을 추정하지 않는다.
- 프론트 임시 조치: 프론트 수정 없음. URL 차단만으로 API 직접 호출을 막을 수 없고, 상세 응답에 없는 삭제 의미를 임의 합성하지 않는다.
- 백엔드 요청 내용: GET /api/v1/board/companies/{company_id}/users/{user_id}/posts/{id}에서 purged_at이 있는 게시글은 작성자 예외와 무관하게 조회에서 제외할지 정책을 확정해 달라. **요청안**: 영구삭제라면404 NOT_FOUND로 통일하고 글 존재·내용을 노출하지 않는다. 기존 휴지통 작성자 가시성과 별개로 명시하고 관련 상세/다운로드 권한 검증 결과를 문서화해 달라.

<a id="br-026"></a>

- **`ebff9af` 재판정(2026-09-09)**: **미판정.** 백엔드 판정([backend-requests-triage.md](backend-replies/backend-requests-triage.md))은 이 항목을 「인정」으로 확인했지만 그 판정 기준은 **`65b7f49`** 다. `ebff9af` 는 167파일 (+8,269 −9,278)을 바꾸고 `migrations/board/000001` 도 96줄 수정했다 — 도메인 로직 변경 여부는 확인되지 않았다. 상태는 열림으로 두고, 판정 근거의 파일:라인은 재대조 후 갱신한다.

## BR-026 · 알림 웹훅 실패를 발송 성공으로 기록하지 않기

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / 새 백엔드 doc/api/ 원문을 기준으로 게시글·댓글·공감 이후 상대방 알림의 영향을 선별했다. **분류: 백엔드 동작 결함. 갱신: 2026-09-08, feat/settings @ 65b7f49. 이력: 신규 → 열림.** 원문 작성자의 코드 조사 결과를 인용하며 이번 프론트 작업에서 런타임 장애·테스트를 직접 재현하지 않았다.
- 증상: 웹훅이 HTTP non-2xx를 반환해도 네트워크 error가 없으면 전송 성공처럼 진행하여 발송 flag/latch가 설정될 수 있다. 사용자에게 도착하지 않은 알림이 재시도되지 않을 수 있다. 운영 서비스 가용성 자체와 별도의 서버 응답 처리 문제다.
- Go 현황: [docs/api/go/README.md:468](go/README.md#L468)·[docs/api/go/README.md:213](go/README.md#L213)와 [docs/api/go/06-post-write.md:180](go/06-post-write.md#L180)는 non-2xx도 error=nil로 진행하고 공지 flag를 true로 바꾸는 동작을 명시한다. enqueue 유실·전송 후 DB로그 실패 중복 가능성도 [docs/api/go/README.md:213](go/README.md#L213)에 함께 기록되어 있으나 이 항목의 요청 범위는 HTTP 실패의 성공 판정이다.
- Laravel 참고: 추가 열람하지 않음. 새 Go 원문이 현재 동작과 문제를 직접 설명하므로 과거 구현을 근거로 삼을 필요가 없다. 현행 계약/환경의 보완 요청이며 Laravel에 있던 필드나 기본값을 추정하지 않는다.
- 프론트 임시 조치: 프론트 변경 없음. is_send_alarm/is_notice_alarm이나 작성200/201을 실제 수신 완료로 표시하지 않는다. 운영 broker·worker·외부 가용성 확인은 [BR-008](#br-008)로 분리한다.
- 백엔드 요청 내용: 알림 webhook transport에서 non-2xx를 실패로 처리하고 실제 허용 성공 조건을 만족할 때만 발송 flag를 갱신해 달라. **요청안**:429/5xx 등 재시도 가능 응답과 영구 거절을 구분하고, 응답 실패 때 latch를 성공으로 잠그지 않는다. 성공 후 로그 실패 재시도의 중복 영향도 명시하며 새 프론트 응답 필드는 요구하지 않는다.

<a id="br-027"></a>

- **`ebff9af` 재판정(2026-09-09)**: **미판정.** 백엔드 판정([backend-requests-triage.md](backend-replies/backend-requests-triage.md))은 이 항목을 「인정」으로 확인했지만 그 판정 기준은 **`65b7f49`** 다. `ebff9af` 는 167파일 (+8,269 −9,278)을 바꾸고 `migrations/board/000001` 도 96줄 수정했다 — 도메인 로직 변경 여부는 확인되지 않았다. 상태는 열림으로 두고, 판정 근거의 파일:라인은 재대조 후 갱신한다.

## BR-027 · 카테고리 삭제와 자식 생성의 snapshot 경합 방지

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / 새 백엔드 doc/api/ 원문을 기준으로 카테고리 관리의 동시 생성·삭제의 영향을 선별했다. **분류: 백엔드 동작 결함. 갱신: 2026-09-08, feat/settings @ 65b7f49. 이력: 신규 → 열림.** 원문 작성자의 코드 조사 결과를 인용하며 이번 프론트 작업에서 런타임 장애·테스트를 직접 재현하지 않았다.
- 증상: 카테고리 삭제가 부모 잠금을 기다리는 동안 생성된 자식이 이전 statement snapshot에 없어 삭제된 부모 아래 살아 있는 자식이 남을 수 있다. 삭제204가 동시 생성까지 정리한 결과라고 가정하면 탐색 트리와 실제 데이터가 어긋난다.
- Go 현황: [docs/api/go/README.md:470](go/README.md#L470)와 [docs/api/go/03-category.md:500](go/03-category.md#L500)가 부모 FOR SHARE·삭제 대기·이전 snapshot의 경합을 설명한다. [docs/api/go/03-category.md:502](go/03-category.md#L502)는 현재 삭제 범위와 카테고리 복원 경로 부재를 명시한다.
- Laravel 참고: 추가 열람하지 않음. 새 Go 원문이 현재 동작과 문제를 직접 설명하므로 과거 구현을 근거로 삼을 필요가 없다. 현행 계약/환경의 보완 요청이며 Laravel에 있던 필드나 기본값을 추정하지 않는다.
- 프론트 임시 조치: 코드 변경 없음. 단일 브라우저 버튼 잠금이나 삭제 후 재조회만으로 다른 요청의 동시 생성과 서버 snapshot을 조율할 수 없다.
- 백엔드 요청 내용: DELETE /api/v1/board/companies/{company_id}/users/{user_id}/categories/{id}와 자식 생성이 같은 부모 생존성/트리 잠금 규칙을 따르도록 해 달라. **요청안**: 잠금 후 최신 자식 집합을 다시 확보하거나 생성이 삭제된 부모를 재검증하여 거부하게 해 삭제 성공 후 고아 live 자식이 남지 않게 한다. 잠금 대기 중 자식 생성 사례를 계약 검증에 포함해 달라.

<a id="br-028"></a>

## BR-028 · 공개 API 주소·활성 설정·토큰 TTL의 배포값 확인

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / 새 백엔드 doc/api/ 원문을 기준으로 로그인·모든 API 연동·세션 갱신의 영향을 선별했다. **분류: 환경 미확정. 갱신: 2026-09-08, feat/settings @ 65b7f49. 이력: 신규 → 열림.** 원문 작성자의 코드 조사 결과를 인용하며 이번 프론트 작업에서 런타임 장애·테스트를 직접 재현하지 않았다.
- 증상: 코드 기본값만으로 실제 공개 origin, 인증 기능 활성 설정, access/refresh TTL, 프록시 요청 크기 제한을 확정할 수 없다. 문서 localhost나 기본 TTL을 운영값으로 고정하면 연결/세션/저장 오류가 생길 수 있으나 운영 장애를 확인한 항목은 아니다.
- Go 현황: [docs/api/go/README.md:11](go/README.md#L11)는 공개 Base URL·활성 설정·실제 TTL을 코드 밖의 입력으로 분류한다. [docs/api/go/README.md:38](go/README.md#L38)의 로컬8080은 예시이며 [docs/api/go/01-auth-user.md:38](go/01-auth-user.md#L38)의 access TTL 기본3600초도 배포값이 아니다. 기본 Body 한도는 [BR-007](#br-007)에서 계약을 확인했다.
- Laravel 참고: 추가 열람하지 않음. 새 Go 원문이 현재 동작과 문제를 직접 설명하므로 과거 구현을 근거로 삼을 필요가 없다. 현행 계약/환경의 보완 요청이며 Laravel에 있던 필드나 기본값을 추정하지 않는다.
- 프론트 임시 조치: 환경 파일·토큰·서비스 코드 변경 없음. 실제 자격증명을 문서에 복사하지 않고 코드 기본값을 배포 검증값이라고 쓰지 않는다.
- 백엔드 요청 내용: 배포 담당자가 공개 API origin, 활성 board/member 인증 구성, access/refresh 실효 TTL 및 상위 프록시 한도를 확인해 달라. 비밀키·실토큰은 전달하지 말고 필요한 비민감 값과 환경/버전/확인일만 계약 배포 기록으로 제공한다. 확인 전 현재 localhost 예시를 제품 배포 설정으로 채택하지 않는다.

<a id="br-029"></a>

## BR-029 · 브라우저 S3 업로드·다운로드와 CDN 접근 환경 확인

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-08 / 새 백엔드 doc/api/ 원문을 기준으로 자료실 업로드·첨부 다운로드·이미지 표시의 영향을 선별했다. **분류: 환경 미확정. 갱신: 2026-09-08, feat/settings @ 65b7f49. 이력: 신규 → 열림.** 원문 작성자의 코드 조사 결과를 인용하며 이번 프론트 작업에서 런타임 장애·테스트를 직접 재현하지 않았다.
- 증상: Go가 presigned URL을 발급하는 계약과 브라우저에서 S3/CDN에 실제 접근할 수 있다는 것은 별개다. 버킷 IAM·CORS·CDN 정책이 없거나 Origin이 다르면 API200 뒤 PUT/GET 또는 이미지 로드가 실패할 수 있다. 실제 버킷 접근은 이번에 실행하지 않았다.
- Go 현황: [docs/api/go/README.md:12](go/README.md#L12)는 버킷 IAM·CORS·CDN 정책이 Go 코드가 생성하지 않는 배포 입력임을 명시한다. [docs/api/go/09-drive-file.md:615](go/09-drive-file.md#L615)는 서명 URL 발급이 S3 객체 존재 검사나 bytes 응답이 아니라고 설명한다. [docs/api/go/10-upload-department-client.md:33](go/10-upload-department-client.md#L33)은 presigned PUT 계약, [docs/api/go/10-upload-department-client.md:245](go/10-upload-department-client.md#L245)는 별도 업로드 완료 상태 계약이다.
- Laravel 참고: 추가 열람하지 않음. 새 Go 원문이 현재 동작과 문제를 직접 설명하므로 과거 구현을 근거로 삼을 필요가 없다. 현행 계약/환경의 보완 요청이며 Laravel에 있던 필드나 기본값을 추정하지 않는다.
- 프론트 임시 조치: 버킷·CDN·환경 설정이나 프론트 코드 변경 없음. [BR-014](#br-014)·[BR-017](#br-017)의 코드 전환과 운영 접근 검증을 독립적으로 추적한다. **실측 후속 갱신(2026-09-09)**: 코드 전환은 끝났고(`…/drive-files/{id}/download-url`·`…/attachments/{id}/download-url` 호출), 로컬 실행 서버가 이 두 경로에 **503 `SERVICE_UNAVAILABLE`** 를 반환하는 것을 실브라우저에서 확인했다. [docs/api/go/09-drive-file.md:600](go/09-drive-file.md#L600)의 "presigner 없으면 503" 분기와 일치하므로 **프론트 결함이 아니라 로컬 환경의 서명자 미설정**이다. 화면은 이 503을 「지금은 내려받을 수 없습니다」 안내로 정직하게 표시하며 공개 S3 주소를 조립해 우회하지 않는다. 다운로드 200 경로는 서명자가 설정된 환경에서만 검증할 수 있어 **이번에 성공 사례를 확인하지 못했다**.
- 백엔드 요청 내용: 배포 담당자가 실제 프론트 Origin에 대한 presigned PUT/GET·필수 요청 헤더·버킷 IAM·CDN 원본 접근을 확인해 달라. 승인된 테스트 파일로 브라우저 경로를 검증한 결과와 환경/버전을 기록하되 실서명URL·비밀키는 대장에 저장하지 않는다. API 계약을 변경하거나 임의 S3 URL을 조립하는 우회는 요구하지 않는다.

## 새 원문 이슈 18개 선별 대조

이 표는 새 README의 「발견한 이슈」17행을 누락 없이 대조한다. 현재 동작이 문서로 명확하고 프론트가 그 계약을 지키면 구현할 수 있는 항목은 무조건 신규 백엔드 결손으로 만들지 않는다. 신규 항목이 없다는 것은 서버의 모든 개선이 끝났다는 뜻이 아니다.

| #   | 새 README 항목·근거                                                          | 분류·처리                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [스키마와 런타임 null 검증 차이](go/README.md#L457) (`README.md:457`)        | 스키마·런타임 불일치(원문 명시). [docs/api/go/README.md:149](go/README.md#L149)와 각 도메인의 null 규칙을 프론트에서 따른다. 추가 endpoint 요청 없음; schema 생성/검증 도구가 실제로 막히면 구체 사례로 기표한다.                                                                                                                                     |
| 2   | [query 배열 인코딩의 %5B/%5b 차이](go/README.md#L458) (`README.md:458`)      | [BR-013](#br-013)의 query 전환에서 반복키 또는 문서화된 인코딩을 사용한다. 소문자 인코딩 호환 개선은 현재 필요성이 확정되지 않아 새 API 결손으로 등록하지 않는다.                                                                                                                                                                                     |
| 3   | [관리설정 CHECK 오류500](go/README.md#L459) (`README.md:459`)                | [BR-018](#br-018) — 백엔드 입력 검증 보완.                                                                                                                                                                                                                                                                                                            |
| 4   | [메인 위젯 조회 없음](go/README.md#L460) (`README.md:460`)                   | [BR-003](#br-003) — 기존 항목 유지. 폐기된 /post/main 복원 요청과 별도 공급 요구를 구분.                                                                                                                                                                                                                                                              |
| 5   | [음수 파일 크기·예약 트랜잭션500](go/README.md#L461) (`README.md:461`)       | [BR-019](#br-019) — 입력 검증. 예약 커밋 뒤 서명실패의 잔여 행은 현행1시간 예약/만료 흐름을 따르고 배포 장애는 [BR-008](#br-008)·[BR-029](#br-029)에서 확인.                                                                                                                                                                                          |
| 6   | [삭제된 부모 아래 생성/업로드](go/README.md#L462) (`README.md:462`)          | [BR-020](#br-020) — 부모 생존성 검증.                                                                                                                                                                                                                                                                                                                 |
| 7   | [폴더 null로 루트 이동 불가](go/README.md#L463) (`README.md:463`)            | [BR-021](#br-021) — 루트 이동 계약 요청.                                                                                                                                                                                                                                                                                                              |
| 8   | [파일 복원 시 과거 해제 북마크 복원](go/README.md#L464) (`README.md:464`)    | [BR-022](#br-022) — 선행 사용자 선택 보존.                                                                                                                                                                                                                                                                                                            |
| 9   | [S3 정리·파일 복원 경합](go/README.md#L465) (`README.md:465`)                | [BR-023](#br-023) — 자료실과 [docs/api/go/06-post-write.md:184](go/06-post-write.md#L184)의 첨부 경합을 함께 추적.                                                                                                                                                                                                                                    |
| 10  | [게시글 복원 시 개별 삭제 댓글 활성화](go/README.md#L466) (`README.md:466`)  | [BR-024](#br-024) — 개별 삭제 상태 보존.                                                                                                                                                                                                                                                                                                              |
| 11  | [purge 게시글 직접조회](go/README.md#L467) (`README.md:467`)                 | [BR-025](#br-025) — 영구삭제 가시성 정책·서버 조건 보완.                                                                                                                                                                                                                                                                                              |
| 12  | [웹훅 실패와 성공 flag 불일치](go/README.md#L468) (`README.md:468`)          | [BR-026](#br-026) — 서버 처리 결함. 운영 가용성은 [BR-008](#br-008)로 분리.                                                                                                                                                                                                                                                                           |
| 13  | [관리자 복원 응답 created_at 차이](go/README.md#L469) (`README.md:469`)      | 현재 응답은 계산 now, DB는 원래 생성시각 보존임을 [docs/api/go/02-management.md:160](go/02-management.md#L160)·[docs/api/go/02-management.md:167](go/02-management.md#L167)가 명시한다. 프론트가 이를 영구 저장시각으로 가정하지 않으면 연동 가능하다. 실제 관리자 생성시각 표시 요구/불일치가 확인되면 별도 기표하며 지금 새 필드를 요청하지 않는다. |
| 14  | [카테고리 삭제·자식 생성 snapshot 경합](go/README.md#L470) (`README.md:470`) | [BR-027](#br-027) — 고아 live 자식 방지.                                                                                                                                                                                                                                                                                                              |
| 15  | [게시글 last_page 덧셈 overflow](go/README.md#L471) (`README.md:471`)        | [docs/api/go/05-post-read.md:74](go/05-post-read.md#L74)의 극단값 예외로 기록. 실제 UI 페이지 크기를 사용하고 반환 메타데이터를 검증하는 프론트 전환([BR-013](#br-013))과 구분하며 새 상한값을 발명하지 않는다. 현재 화면이 그 극단값을 보내는 근거가 없어 새 blocker로 확정하지 않는다.                                                              |
| 16  | [BOARD_DRIVE_BOUNDARY 문구·판정 차이](go/README.md#L472) (`README.md:472`)   | [docs/api/go/04-board.md:237](go/04-board.md#L237)가 현재 문구와 실제 허용 조건을 구분한다. message 문장으로 권한/타입 변경을 판정하지 않는다. 프론트는 code와 Go 필드 규칙으로 처리할 수 있어 새 API를 요청하지 않으며 원문이 틀렸다고 재분류하지 않는다.                                                                                            |
| 17  | [북마크 page×take overflow](go/README.md#L473) (`README.md:473`)             | [docs/api/go/04-board.md:344](go/04-board.md#L344)의 예외를 프론트 페이지 검증에서 고려한다. 현재 실제 페이지 범위 밖 극단값 사용 근거가 없어 새 blocker로 확정하지 않는다. 서버 산술 보완 필요성을 숨기거나 임의 take 상한을 현행 계약이라고 쓰지 않는다.                                                                                            |
| 18  | [기존 initial과 refresh DDL 차이](go/README.md#L474)                         | [BR-030](#br-030). 기존 DB의 refresh_tokens 누락은 로그인 저장500을 일으킬 수 있다. 백엔드 회신에서 로컬 DB 복구를 확인했으며 다른 환경의 증분 반영은 배포 담당자가 확인한다. 프론트가 DB를 수정하지 않는다.                                                                                                                                          |

## 코드 밖 운영 입력 3개 대응

| 원문 항목                                            | 누적 항목         | 확인 범위                                          |
| ---------------------------------------------------- | ----------------- | -------------------------------------------------- |
| [공개 Base URL·활성 설정·실제 TTL](go/README.md#L11) | [BR-028](#br-028) | 배포 origin, 인증 활성 설정, TTL, 상위 프록시 제한 |
| [S3/CDN·브라우저 접근](go/README.md#L12)             | [BR-029](#br-029) | 버킷 IAM·CORS·CDN·실제 Origin의 PUT/GET            |
| [외부 인증·알림·운영 worker](go/README.md#L13)       | [BR-008](#br-008) | OfficeNext·Redis·worker/scheduler·템플릿·실제 배달 |

## 최초 미확인 항목의 갱신 이력

초기 대장은 당시 Go 부록에서 확인되지 않은 범위를 기록했다. 새 원문은 코드로 확정할 수 있는 내용을 본문에 통합했으므로 그 부록을 현재 미확인으로 계속 인용하지 않는다.

| 최초 검토 범위                             | 새 원문 근거·판정                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 사용자 저장값·latest_post_type             | [01:177](go/01-auth-user.md#L177)·[01:172](go/01-auth-user.md#L172) — 저장값과 DB 제약을 확정. 임의 enum 축소 금지.                                                                                                 |
| 토큰·OpenAPI 필드·null·에러 언어           | [01:33](go/01-auth-user.md#L33)·[README:138](go/README.md#L138)·[README:149](go/README.md#L149)·[README:95](go/README.md#L95) — 본문 계약으로 확정.                                                                 |
| 위젯 종류                                  | [BR-006](#br-006) — 자유 string 저장 계약 확인으로 해결. 일반 사용자 위젯 조회는 [BR-003](#br-003)으로 남음.                                                                                                        |
| 본문 한도·알림 배선·첨부 정리              | [BR-007](#br-007)·[BR-009](#br-009) 문서 확인 완료. [BR-008](#br-008)은 운영 환경만 남음.                                                                                                                           |
| BoardView·권한·likes·이모지                | [04-board.md](go/04-board.md)·[05-post-read.md](go/05-post-read.md)·[07-post-comment-like.md](go/07-post-comment-like.md) — 새 공유 DTO·도메인 계약을 사용. 조회자 endpoint는 새07로 이동했으며 서비스 누락이 아님. |
| 폴더 구별·자료실 파일 한도·북마크·서명 URL | [08:288](go/08-drive-folder.md#L288)·[09:174](go/09-drive-file.md#L174)·[09:613](go/09-drive-file.md#L613) — 컨테이너·한도·조회 계산·opaque URL 계약으로 처리. 서버에 없는 id_type/src를 타입에 추가하지 않음.      |

<a id="br-030"></a>

- **`ebff9af` 재판정(2026-09-09)**: **무효.** 검증 대상이던 `POST /board/token`·`/login`·`/refresh` 3경로가 `ebff9af` 에서 삭제됐고(`board/{token,login,refresh}.go`·`internal/auth/boardtoken.go` 4파일 부재 — 프론트 실측), refresh 회전·1회용 소비·`jti` 계약 자체가 없어졌다. 위 실측 기록은 **`65b7f49` 시점의 이력**으로만 보존하며 현행 계약의 근거로 인용하지 않는다. 새 인증 방식이 확정되면 그 방식에 대한 검증을 BR-036 아래에서 새로 한다.

## BR-030 · 실행 서버의 board 인증 면제 경로 확인

- 상태: 해결됨(프론트 실측 @ 2026-09-09)
- 발견일 / 발견 맥락: 2026-09-08 16:46:54 KST / 프론트 Go 로그인 재연결 중 현재 VITE_API_URL의 localhost:8090을 인증 없이 직접 확인. **분류: 환경 미확정(실행 서버와 문서 계약 불일치)**. 구버전 빌드·다른 upstream·미들웨어 중 원인은 미확정. 이전 문서 갱신의 정적 검증과 별도 수행한 HTTP 확인이다.
- 증상: POST /api/v1/board/login·token·refresh에 JSON {}를 보내면 모두401 UNAUTHORIZED(missing bearer token). 인증 진입점에서 기존 bearer를 요구하여 로그인·갱신 연결을 검증할 수 없다. healthz는200이며 me의 무인증401은 정상이다.
- Go 현황: [01:9](go/01-auth-user.md#L9)의 3개 발급 경로는 헤더 인증 면제다. [01:301](go/01-auth-user.md#L301)·[01:360](go/01-auth-user.md#L360)의 순서에 따라 필수 credential 누락은 설정 확인 전에400이어야 한다. 백엔드 로컬 checkout은65b7f49이나 실행 프로세스의 빌드 커밋은 확인하지 못했다.
- Laravel 참고: 열람하지 않음. 현재 Go 계약과 실행 서버의 직접 응답만으로 확인되는 불일치다.
- 프론트 임시 조치: 프론트 로그인·refresh·me를 Go 경로로 전환했다. 가짜 bearer·기존 경로 fallback으로 우회하지 않는다. **후속 갱신(2026-09-08, 백엔드 회신 수신)**: 백엔드 작성자는 실행 빌드를65b7f49로 교체하고 인증 설정·누락 refresh_tokens/request_logs 스키마를 복구했다. [회신:62](../../../oc-api-go/doc/backend-replies/BR-030-BR-031.md#L62)·[회신:85](../../../oc-api-go/doc/backend-replies/BR-030-BR-031.md#L85)에 실제 사용자의 login·me200과 복구 결과가 기록돼 있다. 이는 프론트 작업자가 실제 계정으로 수행한 E2E가 아니며 계약 fixture 검증과 구분한다. bearer 선행 차단은 해소됐지만 실제 토큰의 HTTP refresh 회전·재사용 거절은 아직 미검증이다. **프론트 직접 대조(18:04:12 KST)**: 자격정보 없이 POST login/refresh JSON {}는400 INVALID_PAYLOAD, GET me는401 UNAUTHORIZED였다. 실토큰 검사는 아니다.
- **남은 요청 해소(2026-09-09, 프론트 실측)**: 실제 로그인 세션의 refresh_token으로 로컬 실행 서버(:8090)에 직접 요청해 세 분기를 확인했다. ① 정상 회전: `POST /board/refresh` → **200**, `token_type=Bearer`, `expires_in=3600`, **refresh_token이 새 값으로 교체**됨. ② 같은(이미 소비한) refresh 재사용 → **401 `UNAUTHORIZED`** — 1회용이 실제로 강제된다. ③ 형식 오류: 존재하지 않는 문자열 → **401**, 빈 문자열 → **400 `INVALID_PAYLOAD`**. 이로써 이 항목의 남은 요청이던 «실제 토큰의 회전·재사용 거절»이 HTTP 수준에서 확인됐다. 앱 경로에서도 access_token만 손상시켜 401을 유발했을 때 **5건의 401에 대해 refresh가 1회만 호출되고** 전건이 재시도 200으로 복구되는 것을 실브라우저에서 확인했다(일회용 refresh 중복 소비 없음).
- 백엔드 요청 내용: 최초 요청은8090 실행 버전·인증 면제와 login→me→refresh 전체 흐름 확인이었다. [백엔드 회신](../../../oc-api-go/doc/backend-replies/BR-030-BR-031.md)으로 Base URL http://localhost:8090/api/v1, 실행65b7f49, 빈 Body400, 실제 사용자 login·me200을 확인했다. **남은 요청은 실제 발급 refresh로 새 토큰 쌍 발급 및 동일 refresh 재사용401의 HTTP 확인 결과**다. 회신의 Repository/DB 롤백 검사를 이 HTTP 검증으로 대체하지 않는다. 이후 메인4개401은 기존 경로·헤더 미전환으로 BR-013에 분리한다. 최초 재현은 [전달 문서](../features/auth/go-login-backend-handoff.md)에 보존한다. 비밀값은 회신하지 않는다.

<a id="br-031"></a>

## BR-031 · 실행 서버 CORS의 Lang·Time_zone 허용

- 상태: 해결됨(Go 개발 CORS @ 65b7f49)
- 발견일 / 발견 맥락: 2026-09-08 16:46:54 KST / Go 로그인 뒤 브라우저 me 조회에 필요한 헤더의 OPTIONS 응답 확인. **분류: 환경 미확정(실행 CORS와 문서 계약 불일치)**. 실제 브라우저의 인증 성공을 재현한 것은 아니다.
- 증상: Origin http://localhost:5174, 요청 헤더 authorization/content-type/lang/time_zone의 preflight는204이나 Allow-Headers가 Origin, Content-Type, Authorization, X-Request-ID만 제공한다. Lang·Time_zone을 포함한 교차 출처 요청은 브라우저에서 허용되지 않는다.
- Go 현황: [README:99](go/README.md#L99)는 CORS Allow-Headers에 Lang·Time_zone을 포함한다. [README:90](go/README.md#L90)의 표시 언어와 [README:91](go/README.md#L91)의 시간대 헤더를 프론트에서 임의로 다른 키로 바꿀 수 없다.
- Laravel 참고: 열람하지 않음. Go 공통 계약과 실제 OPTIONS 응답을 대조했다.
- 프론트 임시 조치: 계약의 헤더 표기를 유지한다. 원문 계약을 프론트에서 고치거나 preflight204만으로 성공 처리하지 않는다. **후속 갱신(2026-09-08)**: [백엔드 회신:95](../../../oc-api-go/doc/backend-replies/BR-030-BR-031.md#L95)에5174·5188 각각 GET me/POST login의4개 preflight가204이며 요청한 authorization/content-type/lang/time_zone 모두 허용됐다고 기록돼 있다. 백엔드 작성자의 실측이며 프론트 작업자의 브라우저 인증 E2E 결과로 표현하지 않는다. 이 개발 환경의 차단을 해결 처리한다. **프론트 직접 대조(18:04:12 KST)**에서도5174·5188의 GET me용 OPTIONS가 각각204이며 Authorization·Content-Type·Lang·Time_zone을 허용했다.
- 백엔드 요청 내용: 최초 요청한 개발 CORS 헤더 누락은65b7f49 실행 서버에서 해소됐으므로 추가 코드 변경을 요청하지 않는다. 운영 Origin 허용 정책은 [BR-028](#br-028)의 배포 환경 확인으로 남긴다. [최초 전달 문서](../features/auth/go-login-backend-handoff.md)에16:46의 재현 이력을, [백엔드 회신:109](../../../oc-api-go/doc/backend-replies/BR-030-BR-031.md#L109)에 후속 Allow-Headers 전체를 보존한다.

<a id="br-032"></a>

- **`ebff9af` 재판정(2026-09-09)**: **재측정 필요.** 근본원인으로 지목된 `huma.DefaultConfig` 는 `router.go:339` 에 그대로 있으나, 배열 반환을 구현했던 `board/postsbody.go` 가 삭제되고 board 패키지가 재편됐다([스테일 재대조](backend-replies/staleness-ebff9af.md) §7-2). 프론트는 이미 `is_not_paging` 을 보내지 않고 페이지 봉투로 통일해 두었으므로 **화면 영향은 없다** — 다만 이 항목의 「서버 버그」 판정은 `ebff9af` 에서 다시 확인해야 한다. member 토큰이 없어 프론트가 HTTP 로 재측정할 수 없다.

## BR-032 · `is_not_paging`의 배열 반환이 실행 서버에서 미적용

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-09 / 홈의 「최근 자료」가 `(fileData ?? []).slice is not a function`으로, 게시판 목록 화면 전체가 `(noticeData ?? []).map is not a function`으로 죽는 것을 실화면에서 확인했다. 로그인한 실브라우저에서 같은 토큰으로 `/posts`·`/drive-files`에 `is_not_paging=1`과 `is_not_paging=true`를 각각 보내 응답 본문의 최상위 키를 직접 확인했다. **분류: 문서 불일치(백엔드 동작 결함 후보). 갱신: 2026-09-09, 로컬 실행 서버(:8090) 실측. 이력: 신규 → 열림.**
- 증상: **문서는 배열, 실행 서버는 페이지 봉투를 반환한다.** `GET {S}/posts?is_not_paging=1&limit=5&badges[]=NOTICE` → 200, 최상위 키 `["$schema","data","current_page","last_page","per_page","total"]`. `GET {S}/drive-files?is_not_paging=1&limit=5` → 동일. `is_not_paging=true`로 보내도 동일하다(엄격 bool 파싱 자체는 통과해 400이 아니다). 즉 `Array.isArray(body) === false`다. 배열을 기대한 프론트는 `.map`/`.slice`에서 즉시 TypeError를 던져 화면이 통째로 죽었다. 400/500이 아니라 200이므로 네트워크 탭만 봐서는 드러나지 않는다.
- Go 현황: [docs/api/go/05-post-read.md:39](go/05-post-read.md#L39)는 "`GET posts?is_not_paging=1`은 **배열**, 일반 호출은 페이지 봉투"라고 적었고 [docs/api/go/05-post-read.md:307](go/05-post-read.md#L307)도 "`is_not_paging=true`일 때 PostView 배열"이라고 적었다. 자료실도 [docs/api/go/09-drive-file.md:108](go/09-drive-file.md#L108)에서 "`/drive-files`만 `is_not_paging=true`이면 **봉투 없이 DTO[]**", [docs/api/go/09-drive-file.md:215](go/09-drive-file.md#L215)에서 "`is_not_paging=true`면 DriveFileDTO[] 직접 반환"이라고 적었다. 실행 서버의 관측 결과는 이 네 지점과 모두 어긋난다. 같은 문서의 [docs/api/go/09-drive-file.md:108](go/09-drive-file.md#L108)은 비페이징도 page offset과 최대 100을 유지한다고 적고 있어, 애초에 이 플래그가 「전체 조회」를 뜻하지 않는다는 점은 문서와 실측이 일치한다.
- Laravel 참고: 열람하지 않음. 이번 항목은 Go 계약의 부재가 아니라 **문서와 실행 서버의 불일치**이며, Laravel의 과거 동작은 어느 쪽이 옳은지 판정하는 근거가 되지 않는다.
- 프론트 임시 조치: **`is_not_paging`을 더 이상 보내지 않는다.** 공지 목록은 `take=100&page=1`로, 자료실 파일 목록은 `take`/`page`로 바꾸고 모든 목록을 페이지 봉투 한 가지로 읽는다([postService.ts `selectNotices`](../../src/services/postService.ts), [driveService.ts `selectDriveFiles`](../../src/services/driveService.ts)). 배열 반환을 전제하던 `selectDriveFiles`/`useDriveFiles` 이중 함수는 페이지형 한 개로 합쳤다. 봉투/배열을 모두 받아 주는 관용 파서를 두지 않는다 — 어느 쪽이 계약인지 확정되기 전에 양쪽을 삼키면 다음 회귀를 조용히 숨긴다. 이 조치로 화면 기능 손실은 없다(상한 100은 플래그 유무와 무관하게 동일).
- 백엔드 요청 내용: **신규 API 구현 불필요.** 둘 중 어느 쪽이 계약인지 확정해 달라. ① 배열 반환이 의도라면 실행 서버가 봉투를 반환하는 것이 회귀이므로 수정 대상이고, ② 봉투 유지가 의도라면 위 네 문서 지점이 stale이므로 문서를 고쳐 달라. 확정 결과를 회신해 주면 프론트는 그때 맞춘다. **요청안(현행 아님)**: 응답 형태를 바꾸는 플래그는 화면을 통째로 죽이는 실패 모드를 만들기 쉬우므로, `is_not_paging`을 폐기하고 `take` 상한만 두는 쪽을 제안한다. 이 제안을 현행 계약으로 사용하지 않는다.

<a id="br-033"></a>

## BR-033 · 자료실 파일 응답에 폴더 경로(위치)가 없음

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-09 / 통합 검색(`/search`) 자료 탭의 결과 행을 디자인 정본대로 구현하던 중. **분류: 계약 부재(디자인 요구를 Go 응답으로 만들 수 없음).** 실행 서버 호출이 아니라 Go 계약 문서와 디자인 정본의 대조에서 나왔다.
- 증상: 디자인 정본(화면 06 · 통합 앱)의 자료 결과 행 meta 는 「**자료실 > 팀 자료** · 정다은 · 2026.08.07 · 5.1MB」로 **폴더 경로**를 보여 준다. 그러나 `GET {S}/drive-files` 의 `DriveFileDTO` 에는 `drive_folder_id`(UUID) 만 있고 폴더 이름·경로·브레드크럼이 없다. 목록 응답 한 번으로 「위치」를 만들 수 없고, 결과 N건마다 폴더 API 를 따로 부르면 N+1 이 된다.
- Go 현황: [09:56](go/09-drive-file.md#L56) 은 `DriveFileDTO` 의 객체 키가 그 표의 전부이며 "`src`, 직접 다운로드 URL, `purged_at`, 수정 가능 여부는 없다"고 못박았고, 그 표에 폴더 관련 필드는 `drive_folder_id`(null=루트) 하나다. `board` 관계도 전체 BoardView 가 아니라 `{id, title}` 두 키뿐이다([api-reference:113](../guides/api-reference.md#L113)). 폴더 이름·경로는 [08 자료실 폴더](go/08-drive-folder.md) 의 `GET /boards/{id}/drive` 응답 `path[]` 로만 얻을 수 있고 그 호출은 **게시판+폴더 하나** 를 전제한다 — 여러 게시판이 섞이는 검색 결과에는 쓸 수 없다.
- Laravel 참고: 열람하지 않음. Go 계약에 필드가 «없다»는 사실만으로 확인되는 부재이며, Laravel 이 무엇을 줬는지는 이 필드를 추정해 채우는 근거가 되지 않는다.
- 프론트 임시 조치: **폴더 경로 대신 게시판 이름(`board.title`)을 표시한다**([SearchScreen.tsx `FileRow`](../../src/components/search/SearchScreen.tsx), i18n `search-file-meta`). 레거시 `DataViewRow` 도 검색 결과에서 `board.title` 을 쓰므로 회귀는 아니지만, 디자인이 요구한 «자료실 안에서 어느 폴더인가» 는 전달되지 않는다. `drive_folder_id` 로 폴더 이름을 추측하거나 행마다 폴더 API 를 부르지 않는다.
- 백엔드 요청 내용: 파일 목록 DTO 에 폴더 경로를 함께 실어 달라. **요청안(현행 아님)**: `DriveFileDTO` 에 `drive_folder`(`{id, title}`) 또는 루트→현재 순서의 `drive_folder_path`(`[{id, title}, …]`) 를 추가한다(루트 파일은 `null`/`[]`). 관계 한 벌이면 목록 한 번으로 「위치」가 완성되고 N+1 이 사라진다. 이 요청안을 계약으로 사용하지 않으며, 갱신된 Go 문서로 확인한 뒤에만 구현에 쓴다.

<a id="br-034"></a>

## BR-034 · 검색어의 ILIKE wildcard(`%`·`_`) escape 부재

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-09 / 통합 검색의 검색어를 그대로 `search`/`title`/`content` 로 넘기기 전에 Go 계약의 문자열 처리 규칙을 확인하던 중. **분류: 계약 확인 요청(문서화된 동작이나 사용자 입력에 위험).** 실행 서버에 특수문자 검색을 넣어 재현한 것이 아니라 문서에 명시된 동작을 근거로 한다.
- 증상: 사용자가 「50%」·「a_b」처럼 검색하면 `%`·`_` 가 SQL ILIKE 의 wildcard 로 살아 있어 의도와 다른 결과가 나온다. 특히 `%` 하나만 검색하면(2자 미만 차단을 우회하는 `%%` 등) 사실상 전체 매칭이 된다. 프론트에서 `\%` 로 escape 해 보내도 서버 쿼리에 `ESCAPE` 절이 없으면 백슬래시가 리터럴로 검색돼 오히려 결과가 사라진다 — **프론트에서 고칠 수 있는 문제가 아니다.**
- Go 현황: [05:295](go/05-post-read.md#L295) 는 "`%`,`_` 는 ILIKE wildcard 로 살아 있다(**escape하지 않음**)" 고 명시한다. 자료실도 [09:149](go/09-drive-file.md#L149) 에서 같은 규칙이다. 프론트 가이드 [api-reference:107](../guides/api-reference.md#L107) 에도 "`%`·`_` 는 ILIKE wildcard 다" 로 옮겨 적혀 있다. 즉 의도된 현행 동작이며 문서와 실행의 불일치는 아니다.
- Laravel 참고: 열람하지 않음. Go 계약이 동작을 명시하고 있어 역방향 참조가 필요하지 않다.
- 프론트 임시 조치: **검색어를 가공하지 않고 그대로 보낸다.** 백슬래시를 붙이면 서버에 `ESCAPE` 절이 없어 결과가 더 나빠지므로, 계약이 확정될 때까지 우회하지 않는다. 대신 2자 미만은 프론트에서 차단해(`isQueryReady`, [searchParams.ts](../../src/components/search/searchParams.ts)) 한 글자 `%` 로 전체 목록이 나오는 경로를 줄였다. `%` 를 UI 에서 금지하지 않는다 — 파일명·본문에 실제로 쓰이는 문자다.
- 백엔드 요청 내용: 검색어의 wildcard 처리 정책을 확정해 달라. **요청안(현행 아님)**: 서버가 `%`·`_`·`\` 를 escape 하고 `ESCAPE '\'` 를 붙여 **사용자 입력을 리터럴로** 검색한다(부분일치는 서버가 감싸는 `%` 로 계속 제공). wildcard 를 노출할 의도라면 그 사실을 계약에 명시해 프론트가 입력 안내를 붙일 수 있게 해 달라. 이 요청안을 현행 계약으로 사용하지 않는다.

<a id="br-035"></a>

## BR-035 · 최근 검색어의 자동 누적과 삭제 권한 비대칭

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-09 / 통합 검색의 최근 검색어(개별 X · 전체 삭제)를 구현하려 계약을 맞춰 보던 중. **분류: 계약 확인 요청(권한 비대칭). [BR-012](#br-012) 와 연동 항목이다.**
- 증상: **읽기·자동 저장은 board 토큰인데 삭제만 member 토큰이다.** ① 검색 GET(`/posts`, 조건부 `/drive-files`)이 검색어를 **동기적으로 자동 저장**한다 — board 토큰으로 일어난다. ② 읽기도 board 토큰(`GET /board/me` → `company_user_setting.recent_search_keyword`)으로 된다. ③ 그런데 목록을 지우거나 교체하는 유일한 경로는 member 토큰 전용이라 이 앱에서 **401** 이다([BR-012](#br-012) 실측). 결과: 목록은 사용자 조작 없이 계속 늘어나는데 사용자가 지울 방법이 없다.
- Go 현황: [README:175](go/README.md#L175) 는 "GET 이 읽음·최근검색어를 쓸 수 있다"고, [05:311](go/05-post-read.md#L311) 은 "`search`/`title_content`/`title`/`content` 의 비어있지 않은 값을 검색 **전에 동기 기록**한다"고 적었다. 자료실은 [09:219](go/09-drive-file.md#L219) 의 `is_only_file_search` 조건에서만 저장한다. 읽기는 [01:165](go/01-auth-user.md#L165)(board), 상한은 [01:171](go/01-auth-user.md#L171)("최대 8개"). 교체·삭제는 [02:347](go/02-management.md#L347) `PUT /api/v1/companies/{company_id}/settings/users/me/recent-search-keywords` 이고 [02:373](go/02-management.md#L373) 이 "**member 토큰 필수**, board 토큰을 이 경로에 재사용하지 않는다"고 못박는다.
- Laravel 참고: 열람하지 않음. 세 지점이 모두 Go 문서에 명시돼 있어 역방향 참조가 필요하지 않다.
- 프론트 임시 조치: **최근 검색어는 localStorage 를 정본으로 둔다**(키 `searchWords`, 상한 8 — 레거시와 같은 키·상한). 서버값은 «로컬에 아무 조작도 없을 때» 표시용 시드로만 쓰고, 추가·개별 삭제·전체 삭제는 전부 로컬에서 처리한다([useRecentSearch.ts](../../src/hooks/useRecentSearch.ts) · [recentSearch.ts](../../src/utils/recentSearch.ts)). 자료 목록에는 `is_only_file_search` 를 **보내지 않아** 서버 누적을 한 곳(게시글 검색)으로 줄였다. board 토큰으로 member 경로를 시도하지 않는다. **알려진 한계(가정 아님, 계약 부재의 결과)**: 서버 목록은 계속 누적되고 프론트가 지운 항목과 갈라진다. 다른 기기·브라우저에서는 서버 목록이 다시 보인다.
- 백엔드 요청 내용: 자동으로 쓰는 주체와 지우는 주체의 토큰을 맞춰 달라. **요청안(현행 아님)**: ① board 스코프에 삭제·교체 경로를 하나 추가한다(예: `PUT {S}/me/recent-search-keywords`, 생략/null 은 전체 삭제 — 기존 member 경로와 같은 Body 규칙). 또는 ② 검색 GET 의 자동 저장을 프론트가 끌 수 있는 스위치를 게시글 검색에도 제공한다(자료실의 `is_only_file_search` 와 대칭). ①이면 디자인의 「개별 X · 전체 삭제」가 서버 목록에 그대로 반영되고 기기 간 동기화도 살아난다. 이 요청안을 현행 계약으로 사용하지 않으며, 갱신된 Go 문서로 확인한 뒤에만 구현에 쓴다.
- **`ebff9af` 재판정(2026-09-09)**: **비대칭 자체는 해소됐다.** 읽기(`GET /board/me`)와 교체·삭제
  (`PUT .../settings/users/me/recent-search-keywords`)가 이제 **같은 `member` 계약**이다 — board 토큰과
  member 토큰이 갈려 있던 것이 원인이었고, board 계약이 폐지되면서 그 갈림이 없어졌다. 경로는
  `/api/v1/board/companies/{c}/settings/users/me/recent-search-keywords` 로 이사했다. 남은 것은
  **토큰을 어떻게 얻는가**(BR-036)뿐이므로 이 항목은 그 확정 후 **해결 처리 후보**다. 그때
  localStorage 정본을 서버 정본으로 되돌릴지는 프론트 결정 사항이다([search/decision.md](../features/search/decision.md)).
- **후속(2026-09-10)**: BR-036 의 토큰 문제가 해소돼 **이 경로를 실제로 호출할 수 있다**(같은 스코프의 형제 경로 두 개를 실계정으로 200 확인했다 — [BR-012](#br-012) 후속). 남은 것은 계약이 아니라 **프론트 결정**(로컬 정본 유지 vs 서버 정본 복귀)이므로, 그 결정이 서면 이 항목은 해결 처리한다.

<a id="br-036"></a>

## BR-036 · member 토큰의 획득 경로·수명·갱신·클레임 미정 — 최우선 블로커

- 상태: **부분 해결** — 획득·갱신 경로는 프론트가 확정했고(아래 「프론트 전환」) 잔여 5건이 열려 있다
- 발견일 / 발견 맥락: 2026-09-09 / 백엔드 통지 [board-auth-contract-change.md](backend-replies/board-auth-contract-change.md) §3 수신 후, `oc-api-go` @ `ebff9af` 를 읽기 전용으로 직접 확인했다. **분류: 계약 누락(인증 진입점 부재). 갱신: 2026-09-09, ebff9af 실측. 이력: 신설(열림).** 서버에 HTTP 요청은 보내지 않았다 — 보낼 토큰이 없다.
- 증상: **이 앱은 어떤 게시판 API 도 호출할 수 없다.** `ebff9af` 에서 `board` 인증 계약이 폐지되고 자격증명 3경로가 삭제되어, Go 서비스에 **로그인 엔드포인트가 하나도 없다**(exempt 10개 중 로그인 계열 0). 게시판 표면 64경로는 `member`(OfficeWave ES256) 토큰만 검증한다. 프론트는 그 토큰을 **얻을 방법이 없다**.
- Go 현황(프론트 실측): `internal/transport/httpapi/testdata/routes.txt` **88행**(exempt 10 / member 64 / service 14, `board` 라벨 0). `/api/v1/board/{token,login,refresh}` 부재. `board/{token,login,refresh}.go`·`internal/auth/boardtoken.go` 4파일 부재. 계약은 `middleware/auth.go:35-37` 의 exempt/service/member 3종이고 member 는 `ROLE_MEMBER` 를 요구한다. `middleware.PathScope()`(`router.go:333`) 가 유지되므로 토큰에 **`company_id`·`user_id` 클레임이 필수**이고 경로 값과 정확히 일치해야 한다(불일치 403, 정규 십진수만).
- Laravel 참고: 열람하지 않음. Laravel Passport 흐름은 폐지된 계약이며 새 인증 방식의 근거가 될 수 없다.
- 프론트 임시 조치: **없음 — 코드를 바꾸지 않았다.** 토큰 획득 방식이 정해지지 않은 상태에서 경로·헤더·클레임·수명을 추정해 구현하면 확정 후 다시 지워야 한다. 현재 `src/constants/auth.ts:3-5` 의 3경로 참조와 `src/lib/apiClient.ts` 의 401→refresh 회전은 **동작하지 않는 코드로 남아 있다**(전환 대기). `tests/e2e/auth.spec.ts` 는 삭제된 계약을 모의 픽스처로 검증하므로 통과하지만 그 통과는 **현행 계약의 근거가 아니다**. 토큰을 손으로 주입하는 개발용 우회나 board 토큰 재사용은 만들지 않았다.
- **프론트 전환(2026-09-09) — 「경로 확정」은 백엔드 답이 아니라 프론트 결정이다.** 통지문 §3 의 3택은 여전히 미회신이다. 프론트는 회신을 기다리지 않고 **OfficeWave(`oc-api-laravel`) 로그인 API 를 직접 호출**하는 안을 골라 구현했다(사용자 결정). 근거는 Laravel 문서가 아니라 **형제 프론트의 실동작 코드**다: `oc-web-messenger/services/auth.ts:48` 이 `POST /api/v1/oauth/login` 에 `{grant_type:'password', type:'browser', authority:'normal', username, password}` 를 보낸다. 공개키가 동일함(`oc-api-go/keys/jwtES256.key.pub` = `oc-api-laravel/storage/keys/jwtES256.key.pub`, sha256 일치)이 이 경로가 Go 의 member 게이트를 통과하는 근거다. 이것은 **Go 계약이 아니다** — Go 문서에는 이 경로가 없고, 백엔드가 다른 방식을 지정하면 되돌린다. 상세·되돌릴 조건은 [docs/features/auth/decision.md](../features/auth/decision.md).
  - 획득: `POST {VITE_OV_API_URL}/oauth/login` (password grant) → `access_token`(ES256)·`refresh_token`·`expired_in`(초)·`company_id`·`user_id`·`scopes`·`agent_id`
  - 수명·갱신: **OfficeWave 가 정한다** — 브라우저+`normal` 은 `EXPIRED_TIME`(로컬 7200초, `AccountController:786`). 갱신은 `POST /refresh-token`. **만료 신호가 호스트마다 다르다**: Go 401 ↔ OfficeWave 419. 프론트는 Go 401 을 트리거로 OfficeWave 에 갱신을 요청하고, 갱신이 실패하면(419 포함) 세션을 폐기한다
  - 클레임: `scopes` 에 `ROLE_MEMBER`, `company_id`·`user_id` 정수. ⚠️ `sub` 는 **`'Authorization'`** 이고 `agent_id` 는 **하드코딩 null** 이다(`OvHelper:102-121`) — 옛 board 토큰 전제(`iss=oc-api-go/board`, `sub=user_id`)로 거르던 `getTokenIdentity()` 를 교체했다
  - `agent_id`: 브라우저 로그인은 Agent 행을 만들지 않아 **항상 null** 이다(`AccountController:467`). 사용자 지시로 **부착 지점만** 만들었고(`src/lib/agentQuery.ts`, 요청 인터셉터 한 곳) 값이 숫자가 아니면 **쿼리 키를 만들지 않는다**(생략 ≠ 빈값). Go 는 미지 쿼리를 거절하지 않는다(`RejectUnknownQueryParameters` 미설정 — 프론트 실측)
  - **검증 상태**: 단위 179건·E2E 13건 통과는 **모의 픽스처**다. 실계정·실서버 200 확인은 별도로 수행한다(로컬은 issuer 불일치 때문에 `oc-api-go/.env` 의 `JWT_ISSUER_DOMAINS` 에 `officewave` 를 추가하고 **Go 재기동**이 필요하다)
- **잔여 미확정 5건(이 항목이 계속 열려 있는 이유)**: ① **회사 등급 게이트의 행방** — 아래 ④ 그대로다. `checkPlan` 이 사라졌으므로 Free 회사가 이제 통과하는지, 다른 계층으로 옮겼는지 회신이 필요하다 ② **`is_required_password_change: true`** 응답 처리 — 정본에 화면이 없어 이번엔 UI 를 만들지 않고 로그인을 그대로 진행한다(비밀번호 변경 강제가 우회된다) ③ **`mfa.mfa_required: true`** — 같은 이유로 미구현 ④ **운영 배포의 OfficeWave 주소·CORS 허용 출처** — 로컬 `http://officewave` 만 확인했다 ⑤ **Go 의 `JWT_ISSUER_DOMAINS` 운영값** — 로컬은 프론트가 한 줄 고쳤지만 운영 배포값은 백엔드 소관이다
- 백엔드 요청 내용: `oc-board-front` 가 member 토큰을 **어떻게 얻는지** 확정해 달라. 통지문 §3 의 3택 중 하나를 명시하고, 함께 다음을 알려 달라. ① 발급 주체와 프론트 전달 방식(쿼리스트링 / `postMessage` / 쿠키 / 헤더 주입 중 어느 것인지) ② **수명과 갱신 방법**(board 토큰은 1h + refresh 회전이었다. member 토큰의 만료·갱신 경로가 있는지, 없으면 만료 시 프론트가 무엇을 해야 하는지) ③ `ROLE_MEMBER` 스코프와 `company_id`·`user_id` 클레임의 정확한 키 이름·타입 ④ **회사 등급 게이트의 행방** — `checkPlan`(Free 차단)이 `65b7f49:internal/transport/httpapi/board/token.go:246` 에 있었고 `ebff9af` 의 `internal/**` 검색 결과 **0건**이다(프론트 실측 — 통지문은 「미확인」이라 했다). 등급 차단이 없어진 것인지, 다른 계층으로 옮긴 것인지 ⑤ 독립 실행(자사 로그인) 모드를 폐기하는 것이면 그렇게 명시해 달라 — 로그인 화면·`/login` 라우트·세션 저장의 처리 방향이 그 답에 달려 있다. **요청안(현행 아님)**: 임베드 전제라면 호스트가 `postMessage` 로 토큰과 만료시각을 넘기고 만료 전 재발급을 푸시하는 계약을 제안한다. 이 제안을 계약으로 사용하지 않는다.

<a id="br-037"></a>

## BR-037 · 신규 2경로의 계약 문서 부재 (thumbnail-url · 첨부 업로드)

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-09 / [스테일 재대조](backend-replies/staleness-ebff9af.md) §4 와 `routes.txt` 대조. **분류: 계약 누락(라우트는 등록, 문서 미작성). 갱신: 2026-09-09, ebff9af 실측. 이력: 신설(열림).**
- 증상: 라우트는 등록됐는데 **입력·응답·권한·오류 계약이 어디에도 없다.** 문서 없이 필드명을 추정해 구현하면 계약이 나온 뒤 전부 다시 써야 한다.
- Go 현황(프론트 실측): `routes.txt:34` `GET /api/v1/board/companies/:company_id/users/:user_id/drive-files/:id/thumbnail-url`, `routes.txt:60` `POST /api/v1/board/companies/:company_id/users/:user_id/posts/:id/attachments`. 둘 다 `member` 계약. 관련 신규 코드로 `board/profile.go`·`board/postwritebulk.go`·`board/timeformat.go`·`worker/thumbnail.go`·`worker/attachmentexpire.go` 가 생겼다고 재대조 문서가 밝혔다(§4). 프론트는 그 코드를 읽지 않았고 계약을 추정하지 않는다.
- Laravel 참고: 열람하지 않음. 신규 기능이므로 역방향 참조 대상이 아니다.
- 프론트 임시 조치: **구현하지 않는다.** 자료실 썸네일은 현재 `VITE_S3_FILE_BASE_URL` 기반 표시를 유지하고, 게시글 첨부는 기존 업로드 경로를 유지한다. 두 신규 경로를 호출하는 코드는 없다.
  **갱신 2026-09-10(글쓰기 Go 연동)**: 게시글 첨부·대표 이미지 **업로드 UI 는 정본대로 그렸지만 호출은 게이트로 막았다** — [`POST_ATTACHMENT_UPLOAD_ENABLED=false`](../../src/components/board/constants.ts) 한 곳. 「내 PC」·드롭존·대표 이미지 박스가 disabled 이고 안내 「첨부 업로드는 서버 계약 확정 후 제공됩니다.」가 뜬다. 계약이 있는 **삭제**(`delete_file_id[]`·`delete_thumbnail_id[]`, `06-post-write.md:283-284`)는 수정 모드에서 구현했다. 상세 화면의 기존 첨부 목록·썸네일 표시는 유지.
- 게시글 첨부 요구사항(글쓰기 화면이 필요로 하는 것 — 레거시 실측 + 디자인 정본 기준, **요청안이며 현행 계약이 아니다**):
  1. **연결 시점** — 임시저장(SAVE) 글에도 첨부할 수 있어야 한다(레거시는 같은 POST 에 FormData 로 동봉, AddPostView.vue:344). 그런데 `05-post-read.md:513` 은 「작성자라도 SAVE/SCHEDULED 글의 첨부는 download-url 404」다 → 초안 단계에서 올린 파일을 **작성자가 미리보기·다운로드할 수 없다.** 작성자 자신에게는 초안 첨부의 download-url 을 허용해 달라(아니면 화면에서 초안 첨부는 파일명만 보인다).
  2. **한도** — 첨부 10개 · 총합 100MB(레거시 AddPostView.vue:126,140 · 정본 「최대 10개 · 총합 100MB」), 대표 이미지 1개 · 2MB 미만(레거시 :107 · 정본 「2MB 미만」). 서버 한도를 응답 오류(413/422 + code)로 구분해 주면 클라이언트 상수와 어긋나지 않는다. 확장자 금지 목록이 있으면 문서화.
  3. **업로드 방식** — `drive-uploads`(`10-upload-department-client.md:147`)처럼 presign 2단계인지, `POST {S}/posts/{id}/attachments` 가 multipart 를 직접 받는지. 글쓰기 저장은 JSON 전용(multipart 415, `06:52`)이므로 파일은 **어차피 별도 호출**이다. 진행률 표시(정본 첨부 행의 진행 바)를 위해 브라우저가 직접 PUT 하는 presign 방식을 선호한다.
  4. **응답** — 업로드 결과가 `files[]` 항목(`05-post-read.md:116-128`)과 같은 모양(`id`·`origin_file_name`·`size`·`type: FILE|THUMBNAIL`)이어야 수정 모드의 삭제 흐름과 이어진다. 대표 이미지는 `type=THUMBNAIL` 로 같은 경로를 쓰는지 별도 경로인지.
  5. **정리** — 저장하지 않고 이탈한 초안의 첨부를 누가 지우는지(`worker/attachmentexpire.go` 가 그 역할인지). 클라이언트는 이탈 시 삭제 호출을 하지 않는다.
- 백엔드 요청 내용: 두 경로의 계약을 문서화해 달라(`09-drive-file.md` · `06-post-write.md`). 필요한 것: 경로 파라미터·쿼리·Body 스키마, 응답 필드와 타입, 만료가 있으면 그 규칙(`download-url` 계열처럼 presign 인지), 권한(작성자/관리자), 오류 코드와 400/422 구분, 그리고 **기존 경로와의 관계**(썸네일이 `drive-files` 목록의 어떤 필드를 대체하는지, 첨부 업로드가 `POST {S}/drive-upload-*` 계열과 어떻게 다른지). 계약 확정 전에는 화면에 붙이지 않는다.

<a id="br-038"></a>

## BR-038 · 사용자별 댓글 수 통계가 어디에도 없다

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-10 / 「내 활동」(`/my`) 목업을 Go 연동으로 전환하며 디자인 정본 [`화면 08_마이페이지.dc.html`](../guides/design-tokens-guide.md) 의 프로필 카드 통계 3종(내 글 24 · **댓글 132** · 중요 18)을 실데이터로 채우려다 발견했다. **분류: 계약 누락. 갱신: 2026-09-10, Go 문서 실확인. 이력: 신설(열림).**
- 증상: 「내가 쓴 댓글 N개」를 **어떤 방법으로도 계산할 수 없다.**
- Go 현황(프론트 실측): ① `/me` 의 `MeBody` 45필드에 카운터가 하나도 없다(`01-auth-user.md:58-102`). `/me` 는 부수효과·집계가 없다고 명시돼 있다(`:429`). ② `comment_count` 는 **게시글당** 값이고 삭제 표시 댓글까지 세는 수다(`05-post-read.md:148`) — 작성자 필터가 아니다. ③ 07 문서의 전체 라우트는 「글에 댓글 작성 · 수정 · 삭제 · 댓글 공감 토글 · 댓글 공감자 · 글 공감 토글 · 글 공감자 · 글 조회자」 8개이고 **`comments/mine` 류가 없다**(`07-post-comment-like.md:178,230,282,332,380,426,474,520`).
- Laravel 참고: 열람하지 않음. Go 에 없는 계약을 Laravel 로 메꾸지 않는다.
- 프론트 임시 조치: **「댓글」 타일을 만들지 않았다.** 그리고 정본이 칩 5종 «전부»에 카운트를 요구하기 때문에(개선안 통합 앱.dc.html:1086) 화면 진입 시 **카운트 전용 `take=1` 요청이 7건** 나간다(글 ACT·SAVE·SCHEDULED·DEL, 파일 DEL, 북마크 글·파일 — [`useMyCounts`](../../src/hooks/useMyActivity.ts), staleTime 60초). 집계 엔드포인트가 하나 생기면 7건이 1건이 된다. 통계는 목록 봉투의 `total` 로 계산 가능한 2종만 둔다 — 「내 글」= `GET {S}/posts/mine?state=ACT&take=1` 의 `total`, 「중요」= `posts/bookmarks` + `drive-files/bookmarks` 두 `total` 의 **클라이언트 합산**([`useMyCounts`](../../src/hooks/useMyActivity.ts)). 그 합산 자체도 서버가 주는 값이 아니라 우리 정의다(가정). 고정 숫자 132 를 쓰던 목업 상수는 삭제했다.
- 백엔드 요청 내용: 사용자별 활동 집계를 하나 주면 좋겠다. **요청안(현행 아님)**: `GET {S}/me/activity-counts` → `{post_count, draft_count, scheduled_count, trashed_post_count, trashed_file_count, bookmark_post_count, bookmark_file_count, comment_count}` (화면이 칩마다 숫자를 띄우므로 상태별로 나눠 달라) (내 글은 `state=ACT` 기준, 댓글은 `is_active=true` 기준인지 삭제분 포함인지 명시). 또는 `/me` 응답에 같은 필드를 얹어도 된다. 이 요청안을 현행 계약으로 사용하지 않으며, 갱신된 Go 문서로 확인한 뒤에만 구현에 쓴다.

<a id="br-039"></a>

## BR-039 · 휴지통 보관 기간이 API 에 없고, 게시글은 purge 배치 자체가 없다

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-10 / 「내 활동」 휴지통에 「30일 보관」을 표시할 근거를 찾다가 발견했다. **분류: 계약 누락 + 도메인 간 동작 비대칭. 갱신: 2026-09-10, Go 문서 실확인. 이력: 신설(열림).**
- 증상: 두 가지가 겹쳐 있다. ① **보관 기간이 API 로 노출되지 않는다** — `company_setting` 에는 `latest_post_day`·`latest_post_type` 뿐이고(`01-auth-user.md:146-152`) `latest_post_day` 는 「최신글」 창이지 휴지통 보관 기간이 아니다. 화면이 「30일」을 말하려면 클라이언트에 상수를 박는 수밖에 없다. ② **게시글과 자료의 실제 동작이 다르다** — 자료는 매일 UTC00:00 배치가 `deleted_at ≤ now−30일` 을 purge 하지만(`09-drive-file.md:635`), 게시글은 `purge` 가 `purged_at` 만 찍을 뿐 **「30일 후 row 삭제」 worker 가 등록돼 있지 않다**(`06-post-write.md:43`). 즉 게시글 휴지통에 「30일 후 영구 삭제」를 붙이면 **사실과 다른 안내**가 된다.
- Go 현황(프론트 실측): 위 3개 인용. 덧붙여 자료도 「30일 경과 후에도 배치가 지우기 전이면 API 가 복원을 거절하지 않는다」(`09-drive-file.md:510`) — 30일은 배치 «대상 기준»이지 API 경계가 아니다.
- Laravel 참고: 열람하지 않음.
- 프론트 임시 조치: 보관 안내를 **자료 휴지통에만** 표시하고, 게시글 휴지통에는 붙이지 않았다. 30 은 [`TRASH_KEEP_DAYS`](../../src/components/mypage/constants.ts) 클라이언트 상수이며 그 자리에 「서버가 주지 않는 값」이라고 적어 두었다. (레거시 `jupiter-board-web` 도 i18n 문자열에 30 을 박아 두고 자료 휴지통에만 띄웠다 — `src/pages/mypage.vue:299-303`.)
- 백엔드 요청 내용: ① 보관 기간을 설정값으로 노출해 달라. **요청안(현행 아님)**: `company_setting.trash_keep_day`(정수, 기본 30). ② 게시글 휴지통의 실제 정책을 확정해 달라 — 30일 후 물리 삭제를 «할 것인지»(그러면 worker 등록과 문서화), 아니면 「영구 삭제 표시 후 무기한 보존」이 정책인지. 답에 따라 게시글 휴지통 문구가 정해진다. 요청안을 현행 계약으로 쓰지 않는다.

<a id="br-040"></a>

## BR-040 · 게시글+자료를 한 목록으로 주는 API 가 없다

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-10 / 디자인 정본의 「내 활동 · 중요」 탭이 「전체 / 게시글 / 자료」 3종이고 「전체」가 글과 자료를 한 목록에 섞는다. **분류: 계약 누락. 갱신: 2026-09-10, Go 문서 실확인. 이력: 신설(열림).**
- 증상: 서버 병합 목록이 없어 「전체」 탭을 정확히 구현할 수 없다. 클라이언트 병합은 가능하지만 ① 두 봉투가 독립적으로 페이징되고(각자 `total`) ② **정렬 어휘가 겹치지 않는다** — 게시글은 `posted_at`·`view_count` 등 20개 키(`05-post-read.md:287`), 자료는 `created_at`·`origin_file_name`·`size`·`relative` 4개(`09-drive-file.md:141`). 공통 키가 `created_at` 하나뿐이라 「최신순 병합」의 의미가 도메인마다 달라진다.
- Go 현황(프론트 실측): 등록 라우트 표에 두 도메인이 분리돼 있다 — `drive-files/bookmarks`(23)·`drive-files/mine`(24)·`posts/bookmarks`(29)·`posts/mine`(30), `README.md:245-252`. `api-catalog.md` 67개 색인에도 교차 도메인 집계가 없다. `09-drive-file.md:193` 의 「통합 목록」은 «읽을 수 있는 게시판들의 파일» 이라는 뜻이지 글+파일이 아니다.
- Laravel 참고: 열람하지 않음.
- 프론트 임시 조치: **「전체」 탭을 만들지 않았다**(사용자 결정 2026-09-10). 하위탭은 `게시글 | 자료` 2종이고 각 탭이 자기 도메인 엔드포인트 하나만 호출한다([`myParams.ts`](../../src/components/mypage/myParams.ts)). 서버가 못 주는 정렬·페이지 규칙을 클라이언트가 발명하지 않는다.
- 백엔드 요청 내용: 「내 활동」·검색처럼 글과 자료를 함께 보여줘야 하는 화면이 여럿이다. **요청안(현행 아님)**: 교차 도메인 목록 하나(`GET {S}/me/activities?type=bookmark|mine|trash`)를 주고, 각 행에 `resource_type: 'POST'|'DRIVE_FILE'` 과 공통 정렬 키(`activity_at`)를 실어 달라. 병합·정렬·페이징을 서버가 하면 클라이언트 과다조회가 사라진다. 요청안을 현행 계약으로 쓰지 않는다.

<a id="br-041"></a>

## BR-041 · `/posts/mine` 의 `state` 에 서버 enum 검증이 없어 오타가 「빈 목록」으로 위장한다

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-10 / 「내 활동」 칩 4종을 `state` 하나로 가르며 발견했다. **분류: 계약/문서 문제(입력 검증 비대칭). 갱신: 2026-09-10, Go 문서 실확인. 이력: 신설(열림).**
- 증상: 같은 뜻의 파라미터인데 두 도메인의 검증이 정반대다. **자료**는 하드 enum 이라 그 외 값이 **400** 이고(`09-drive-file.md:129`), **게시글**은 「enum 제한 없음; 생략/미지값 빈 page」다(`05-post-read.md:354`). 그래서 게시글 쪽은 `state=SCHEDULE`(오타) 이 400 이 아니라 **200 빈 페이지**로 온다 — 화면에는 「예약한 글이 없습니다」로 보이고, 회귀가 정상 빈 상태와 구별되지 않는다. `state` 를 아예 빠뜨려도 같은 결과라 누락과 오타와 진짜 0건이 전부 같은 화면이다.
- Go 현황(프론트 실측): `05-post-read.md:354`(게시글) vs `09-drive-file.md:129`(자료). 유효값은 `SAVE,ACT,HIDE,SCHEDULED,DEL` 5종이며 `DEL` 은 조회 전용 선택자다(`:365`, 쓰기 enum 에는 없다 — `06-post-write.md:214`).
- Laravel 참고: 열람하지 않음.
- 프론트 임시 조치: **문자열을 화면에서 조립하지 않는다.** 칩→`state` 표를 `myParams.ts` 한 곳에 두고 타입(`PostQueryState`)으로 고정했으며, 「mine 분기는 `state` 를 항상 보낸다」·「`is_bookmark`·`sort` 를 절대 만들지 않는다」를 단위 테스트로 잠갔다([`tests/myParams.test.ts`](../../tests/myParams.test.ts) · [`tests/myActivityApi.test.ts`](../../tests/myActivityApi.test.ts)).
- 백엔드 요청 내용: 게시글 `state` 도 자료와 같이 enum 검증해 400 `INVALID_PAYLOAD` 를 주면 좋겠다(미지값과 「0건」이 구별된다). 호환 때문에 못 바꾸면, 최소한 두 도메인의 차이를 문서 함정 절에 명시해 달라. 함께 봐 주면 좋을 것: `is_bookmark` 가 bool 이 아니라 **문자열 truthiness**(`""`·`"0"` 만 거짓, `"false"`·`"00"`·`"no"` 는 참)라 이름만 보고 `false` 를 보내면 조용히 북마크 목록이 나온다(`05-post-read.md:355` · `09-drive-file.md:251`). 같은 `is_` 접두사에 파서가 3종이라는 점(`README.md:132`)이 이 부류 사고의 뿌리다.

<a id="br-042"></a>

## BR-042 · 글 작성·수정 응답에 관계가 없어 저장 후 상세를 다시 읽어야 하고, ACT 글은 그때 조회수가 오른다

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-10 / 글쓰기(`/write`) 데모를 Go 연동으로 전환하며 「저장 → 상세 이동」 흐름을 캐시 패치로 끝내려다 발견했다. **분류: 응답 계약 결손 + 부수효과 충돌. 갱신: 2026-09-10, Go 문서 실확인. 이력: 신설(열림).**
- 증상: 작성 201·수정 200 응답은 `PostWriteBody` 최상위 객체이고 **user/board/badges/files/thumbnail 관계가 없다**(`06-post-write.md:90`). 상세 화면은 그 관계를 그린다(`05-post-read.md:96-128`). 그래서 저장 직후 상세로 가면 **반드시 `GET {S}/posts/{id}` 를 한 번 더 부른다.** 그 GET 은 살아 있는 ACT 글에 열람 이벤트를 호출마다 추가하므로(`05-post-read.md:42`) **작성자가 글을 등록·수정할 때마다 조회수 +1** 이 된다. 프론트 규칙 「상세 쿼리는 invalidate 금지·캐시 패치」([post-detail-view-log-side-effect](../../CLAUDE.md))를 이 화면에서는 지킬 수 없다.
- Go 현황(프론트 실측): `06-post-write.md:90` 「기본 eager load 없음; 응답 보강을 위한 상세 query 는 있지만 user/board/badges/files 를 응답에 포함하지 않는다」. `05-post-read.md:42` 「상세 GET 은 살아 있는 ACT 글에 열람 이벤트를 호출마다 추가 … 프리패치·재시도·중복 mount 도 열람 수에 영향」. 작성자 본인 조회를 제외하는 규칙은 문서에 없다.
- Laravel 참고: 열람하지 않음(레거시 프론트도 저장 후 상세를 1회 조회했다 — AddPostView.vue:383. 즉 현행 동작과 같다).
- 프론트 임시 조치: 저장 성공 시 `['post', id]` 캐시를 **removeQueries** 하고 상세로 replace 이동해 상세가 정확히 1회 fetch 하도록 했다([`WriteScreen.tsx`](../../src/components/board/WriteScreen.tsx) `save`). 임시저장(SAVE)은 열람이 기록되지 않으므로(`05-post-read.md:474`) invalidate 를 쓴다. 조회수 +1 은 **가정 A5 로 원장에 올렸다**([`docs/features/write/design.md`](../features/write/design.md)).
- 백엔드 요청 내용: 둘 중 하나면 된다. ① 작성·수정 응답에 상세와 같은 관계(`badges`·`files`·`thumbnail`·`user`·`board`)를 포함해 달라(이미 「응답 보강을 위한 상세 query」가 있으니 그 결과를 실어 주면 된다). ② 또는 상세 GET 에서 **작성자 본인의 조회는 열람 이벤트를 남기지 않게** 해 달라(레거시 사용자 관점에서도 「내가 고쳤는데 조회수가 올랐다」는 질문이 나온다). 어느 쪽이든 문서(`06`·`05`)에 명시된 뒤에만 프론트가 캐시 패치로 전환한다.

<a id="br-043"></a>

## BR-043 · 본문 인라인 이미지가 Go 밖(나모 에디터 호스트)에 저장된다 — 보존·이관·권한 정책 확인

- 상태: 열림
- 발견일 / 발견 맥락: 2026-09-10 / 글쓰기 에디터를 레거시와 같은 나모(Namo) CrossEditor iframe(`https://namo-editor.jupiterstudio.co.kr/editor`)으로 결정하며 확인했다. **분류: 계약 범위 밖 의존(외부 저장소). 갱신: 2026-09-10, 실측(iframe 응답 헤더·postMessage 프로토콜) + Go 문서 확인. 이력: 신설(열림).**
- 증상: 본문에 붙인 이미지(붙여넣기·업로드)는 **에디터 호스트가 자기 저장소에 올리고 그 URL 을 `<img src>` 로 본문 HTML 에 박는다.** Go 는 그 HTML 을 살균 없이 저장하고(`06-post-write.md:39`) 이미지 파일 자체는 모른다. 즉 ① Go 의 첨부(`files[]`)·S3 정리 배치·권한(Read 403)과 **무관한 공개 URL** 이 본문에 남고 ② 에디터 호스트가 파일을 지우거나 도메인이 바뀌면 글이 깨지며 ③ 회사·게시판 권한이 이미지에는 적용되지 않는다.
- Go 현황(프론트 실측): 이미지 관련 Go 경로는 `GET /image/resize/{size}` 하나이고 **읽기 전용**(허용된 원본 key 를 리사이즈, `10-upload-department-client.md:329,339`). 본문 이미지를 받는 업로드 경로는 없다. `drive-uploads` 는 DRIVE 게시판 전용(422 `BOARD_NOT_DRIVE`, `:177`).
- Laravel 참고: 열람하지 않음. 레거시 프론트에도 이미지 업로드 엔드포인트가 없다(에디터 호스트가 전담, AddPostView.vue:443-475 는 postMessage 만).
- 실측(2026-09-10): 저장 버튼마다 에디터가 자기 호스트 `POST https://namo-editor.jupiterstudio.co.kr/api/v1/upload/save` 에 `{html}` 을 보낸다(본문 사본이 에디터 호스트에도 남는다). 우리 코드가 부르는 게 아니라 에디터의 `saveEditor` 처리다.
- 프론트 임시 조치: 레거시와 같은 방식 그대로(에디터 호스트 저장). 저장 전 `sanitizePostHtml` 로 스크립트·이벤트만 제거하고 `<img src>` 는 유지한다. 호스트 URL 은 [`NAMO_EDITOR_URL`](../../src/components/board/constants.ts) 상수(`VITE_NAMO_EDITOR_URL` 이 있으면 우선) 한 곳.
- 백엔드 요청 내용: 정책 확인이 먼저다. ① 나모 호스트의 이미지 저장소가 **운영 자산**(보존 기간·백업·CDN)인지, 이관 계획이 있는지. ② 이관한다면 **본문 이미지 업로드 계약**이 필요하다 — **요청안(현행 아님)**: `POST {S}/posts/images`(또는 presign) → `{url}` 을 돌려주고, 저장 시 본문에서 참조되지 않는 이미지를 정리하는 규칙. 그러면 `GET /image/resize` 의 「허용 원본 key」에 들어가 리사이즈도 된다. ③ 권한 — 본문 이미지에 게시판 Read 를 적용할지(적용하면 presign/서명 URL 이 필요하고, 안 하면 「본문 이미지는 URL 을 아는 누구나 본다」를 문서에 명시). 요청안을 현행 계약으로 쓰지 않는다.
