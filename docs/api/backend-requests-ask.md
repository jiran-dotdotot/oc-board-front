# 백엔드 회신 요청 — 5건 (2026-09-09 갱신)

누적 대장 [`backend-requests.md`](backend-requests.md)에서 **지금 답이 필요한 것만** 추린 전달용 문서다.
상태·본문·ID는 대장이 정본이다(이 문서는 사본이므로 대장을 먼저 갱신한다).

> ## 🚨 `ebff9af` 로 1번 항목이 바뀌었다
>
> board 인증 계약 폐지 통지를 받고 대장을 재판정했다([backend-replies/](backend-replies/README.md)).
> **BR-012(독립 로그인의 member 자격)는 종결**됐다 — 요청한 방식은 아니지만 계약 통일로 질문 자체가
> 사라졌다. 대신 **BR-036(member 토큰을 어떻게 얻는가)** 가 최우선 블로커로 들어왔다.
> **이 앱은 현재 상태로 게시판 API 를 하나도 호출할 수 없다.**
>
> BR-011(관리자의 타인 글 삭제)은 **회신을 받아 이 문서에서 빼고** 대장에 기록했다
> (「유지 안 함 · 작성자 전용」 → 프론트 후속 2건).

- 나머지 열린 항목(BR-008 · BR-018~027)은 **이번 프론트 작업에서 재현하지 않았고 지금 화면을 막고
  있지 않아** 이 문서에 넣지 않았다. 「재현 안 됨」은 「위험하지 않음」이 아니다 —
  특히 [BR-022](backend-requests.md#br-022)(복원이 남의 수동 해제 북마크까지 되살림)와
  [BR-023](backend-requests.md#br-023)(정리·복원 경합으로 실제 파일 bytes 손실)은 **데이터 손실** 항목이다.
  다만 그 10건의 판정 근거는 `65b7f49` 기준이므로 `ebff9af` 재대조 때 함께 확인해 달라.
- 실행 서버 실측은 전부 **로컬 `:8090`** 이며, `ebff9af` 이후로는 **토큰이 없어 HTTP 확인을 할 수 없다.**

| #   | ID                                   | 필요한 것                            | 근거                     |
| --- | ------------------------------------ | ------------------------------------ | ------------------------ |
| 1   | [BR-036](backend-requests.md#br-036) | **인증 진입점 확정 (최우선 블로커)** | 실측(`ebff9af` 라우트)   |
| 2   | [BR-032](backend-requests.md#br-032) | 계약 확정 (문서 ↔ 서버 불일치)       | 실측(`65b7f49`) + 재측정 |
| 3   | [BR-029](backend-requests.md#br-029) | 환경 확인 (S3 서명자·CORS·CDN)       | 실측                     |
| 4   | [BR-037](backend-requests.md#br-037) | 신규 2경로 계약 문서화               | 실측(라우트 등록 확인)   |
| 5   | [BR-028](backend-requests.md#br-028) | 배포값 확인                          | 문의                     |

---

## 1. BR-036 · member 토큰을 어떻게 얻는가 — 앱이 아무 API 도 호출할 수 없다

**실측(`oc-api-go` @ `ebff9af`, 읽기 전용)** — 통지문의 주장을 그대로 옮기지 않고 직접 확인했다.
전부 일치했다:

- `internal/transport/httpapi/testdata/routes.txt` **88행** = exempt 10 / member 64 / service 14,
  `board` 라벨 **0건**
- `POST /api/v1/board/{token,login,refresh}` **없음** · `board/{token,login,refresh}.go`·
  `internal/auth/boardtoken.go` **4파일 부재**
- `internal/**` 에 `BoardPrefixes`·`ContractBoard` **0건** — 계약은 exempt/service/member 3종
- `middleware.PathScope()` 유지(`router.go:333`) → 토큰에 **`company_id`·`user_id` 클레임 필수**
- **회사 등급 게이트(`checkPlan`, Free 차단)가 코드에서 사라졌다** — `65b7f49:board/token.go:246` 에
  있었고 `ebff9af` 의 `internal/**` 검색 결과 0건. (통지문은 「미확인」이라 했다.)

**필요한 회신** — 통지문 §3 의 3택 확정과 함께:

1. 발급 주체와 **프론트 전달 방식**(쿼리스트링 / `postMessage` / 쿠키 / 헤더 주입)
2. **수명과 갱신 방법** — board 토큰은 1h + refresh 회전이었다. member 토큰의 만료·갱신 경로가 있는가,
   없으면 만료 시 프론트가 무엇을 해야 하는가
3. `ROLE_MEMBER` 스코프와 `company_id`·`user_id` **클레임의 키 이름·타입**
4. **회사 등급 게이트의 행방** — 없어진 것인가, 다른 계층으로 옮겼는가
5. **독립 실행(자사 로그인) 모드를 폐기하는가** — 로그인 화면·`/login` 라우트·세션 저장의 처리 방향이
   이 답에 달려 있다

**프론트 현재 조치** — **없다(의도적).** 토큰 획득 방식을 추정해 구현하면 확정 후 다시 지운다.
`src/constants/auth.ts` 의 3경로 참조와 `src/lib/apiClient.ts` 의 401→refresh 회전은 동작하지 않는
코드로 남겨 두었고, board 토큰 재사용이나 개발용 토큰 주입 우회를 만들지 않았다.

---

## 2. BR-032 · `is_not_paging`이 문서는 배열, 실행 서버는 페이지 봉투

**증상(실측)** — 같은 토큰으로 직접 호출한 결과:

- `GET {S}/posts?is_not_paging=1&limit=5&badges[]=NOTICE` → **200**, 최상위 키 `["$schema","data","current_page","last_page","per_page","total"]`
- `GET {S}/drive-files?is_not_paging=1&limit=5` → 동일. `is_not_paging=true`로 보내도 동일(엄격 bool 파싱은 통과, 400 아님)

즉 `Array.isArray(body) === false`. 배열을 기대한 화면이 `.map`/`.slice`에서 TypeError로 통째로 죽었다
(홈 「최근 자료」, 게시판 목록 전체). **200이라 네트워크 탭만 봐서는 드러나지 않는다.**

**문서 쪽 기재** — `go/05-post-read.md:39`·`:307`, `go/09-drive-file.md:108`·`:215` 네 곳이 모두 "배열 반환"이라고 적혀 있다.

**필요한 회신** — 신규 API는 필요 없다. 둘 중 어느 쪽이 계약인가:

1. **배열이 의도** → 실행 서버의 봉투 반환이 회귀다(서버 수정 대상)
2. **봉투가 의도** → 위 네 문서 지점이 stale이다(문서 수정 대상)

**프론트 현재 조치** — `is_not_paging`을 더 이상 보내지 않고 `take`/`page` 페이지 봉투 한 가지로 통일했다.
봉투·배열을 모두 삼키는 관용 파서는 두지 않았다(다음 회귀를 조용히 숨기므로). 확정되면 그때 맞춘다.

---

## 3. BR-029 · 다운로드 presign 미가동 + 브라우저 S3/CDN 접근 환경 확인

**증상(실측)** — 코드 전환은 끝났고 `…/drive-files/{id}/download-url`·`…/attachments/{id}/download-url`을 호출한다.
로컬 실행 서버는 이 두 경로에 **503 `SERVICE_UNAVAILABLE`** 를 반환한다.
`go/09-drive-file.md:25`의 "다운로드 presigner 미설정" 503 항목과 일치하므로 **프론트 결함이 아니라 환경의 서명자 미설정**이다.
**다운로드 200 경로는 이번에 성공 사례를 확인하지 못했다.**

**필요한 회신** (배포 담당자):

- 각 환경에서 presigner가 설정되어 있는가 / 언제 켜지는가
- 실제 프론트 Origin에 대한 **presigned PUT/GET** 동작, 필수 요청 헤더, 버킷 IAM·CORS, CDN 원본 접근
- 승인된 테스트 파일로 브라우저 경로를 검증한 결과 + 환경/버전

⚠️ 실서명 URL·비밀키는 회신에 넣지 말 것(대장에 저장하지 않는다).
API 계약 변경이나 임의 S3 URL 조립 우회는 요청하지 않는다.

**프론트 현재 조치** — 503을 「지금은 내려받을 수 없습니다」 안내로 정직하게 표시하고 우회하지 않는다.

---

## 4. BR-037 · 신규 2경로의 계약이 문서에 없다

**실측** — `routes.txt` 에 등록돼 있으나 계약 문서가 없다:

- `routes.txt:34` `GET /api/v1/board/companies/:company_id/users/:user_id/drive-files/:id/thumbnail-url`
- `routes.txt:60` `POST /api/v1/board/companies/:company_id/users/:user_id/posts/:id/attachments`

**필요한 회신** — `09-drive-file.md`·`06-post-write.md` 에 계약을 써 달라: 파라미터·Body 스키마,
응답 필드·타입, 만료 규칙(presign 계열인가), 권한, 오류 코드와 400/422 구분, 그리고 **기존 경로와의
관계**(썸네일이 목록의 어떤 필드를 대체하는가 / 첨부 업로드가 `drive-upload-*` 계열과 어떻게 다른가).

**화면 요구가 있다** — 자료실·앨범형 목록의 썸네일은 현재 `VITE_S3_FILE_BASE_URL` 로 직접 조립하고
있고, 다운로드 presign 은 [BR-029](backend-requests.md#br-029) 로 503 이다. `thumbnail-url` 이 그
대안일 수 있으나 계약 없이는 붙일 수 없다.

**프론트 현재 조치** — 두 경로를 호출하지 않는다. 필드명을 추정해 타입을 만들지 않았다.

---

## 5. BR-028 · 배포값 확인 (공개 API origin·인증 구성·토큰 TTL)

**상황** — 코드 기본값만으로는 실제 값을 확정할 수 없다.
문서의 localhost 예시나 기본 TTL을 운영값으로 고정하면 연결·세션·저장 오류가 생긴다.
(운영 장애를 확인한 항목은 아니다.)

**필요한 회신** (배포 담당자) — 환경별로:

- 공개 API origin
- 활성 board/member 인증 구성
- access/refresh **실효** TTL
- 상위 프록시의 요청 크기 한도

⚠️ 비밀키·실토큰은 전달하지 말 것. 비민감 값과 환경/버전/확인일만 계약 배포 기록으로 남긴다.
확인 전까지 프론트는 현재 localhost 예시를 제품 배포 설정으로 채택하지 않는다.

---

## 참고 — 6번째 후보

[BR-008](backend-requests.md#br-008)(게시글·댓글·공감 알림의 **실동작** 확인 — OfficeNext·Redis·worker/scheduler 실행, DB 템플릿, 웹훅 설정)은
BR-028·BR-029와 같은 **배포 담당자 확인** 유형이다. 코드 배선 조사는 종결됐고 남은 것은 운영 가용성뿐이다.
알림 실동작을 이번 릴리스에서 보장해야 한다면 이 문서에 6번째로 넣으면 된다.
