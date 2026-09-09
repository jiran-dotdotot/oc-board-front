# 백엔드 회신 — `oc-board-front` backend-requests 대장 판정

← [API 문서 목록](README.md)

- 대상 문서: `oc-board-front/docs/api/backend-requests.md` (2026-09-09, 110KB, BR-001~032)
- 판정 기준 코드: `oc-api-go` `feat/settings` @ `65b7f49`
- 판정일: 2026-09-09
- 판정 방법: 코드 직접 확인 + 격리 재현 테스트 1건. 운영 서버 요청은 보내지 않았다.

프론트 대장의 **열린 17건**을 코드로 판정했다. 결론부터: 프론트 문서는 정확하다.
근거 인용이 엄격하고 추측을 계약으로 격상시키지 않았다. 17건 중 **새로 확인된 서버 버그 1건**,
**설계 결손 1건**이 실제 조치 대상이고, 10건은 우리가 이미 기록한 이슈가 돌아온 것, 5건은 코드 밖이다.

---

## 0. 판정 요약

| 구분 | 건수 | BR | 조치 주체 |
| --- | ---: | --- | --- |
| 🔴 **확인된 프로덕션 버그** (신규) | 1 | BR-032 | **백엔드 — 즉시** |
| 🟠 **설계 결손** (실측 근거 있음) | 1 | BR-012 | **백엔드 + 제품 결정** |
| 🟡 이미 기록된 이슈의 재요청 | 10 | BR-018 ~ BR-027 | 백엔드 — 개별 우선순위 |
| ⚪ 제품 결정 | 2 | BR-003, BR-011 | 제품 |
| ⚪ 배포 환경 확인 | 3 | BR-008, BR-028, BR-029 | 인프라/배포 |
| **합계** | **17** | | |

**우선순위: BR-032 → BR-012 → 나머지.**

프론트 판정 중 **틀린 것은 없었다.** 표본 검증한 BR-021·BR-032 모두 코드와 일치했다.

---

## 1. 🔴 BR-032 — `is_not_paging` 배열 반환이 프로덕션에서 무효화됨

**판정: 프론트 주장 전면 인정. 문서 오류가 아니라 서버 버그다.**

프론트는 「① 배열이 의도면 서버가 회귀, ② 봉투가 의도면 문서가 stale」 중 어느 쪽인지 물었다.
답은 **①** 이다. 배열이 의도이고, 서버가 그 의도를 실행하지 못하고 있다.

### 1.1 의도는 배열이다 (코드·테스트 근거)

| 근거 | 내용 |
| --- | --- |
| `board/postsbody.go:353-366` | `PostListBody` 가 `bare` 일 때 `json.Marshal(b.Data)` — 배열 |
| `board/drivefilesbody.go:534-546` | `DriveFileListBody` 동일 |
| `board/posts.go:104-109` | "the response **DROPS the envelope** on that branch" (D122) |
| `board/drivefilesbody.go:86` | `doc:"참이면 **봉투 없이** limit 개의 배열을 돌려줍니다"` |
| `board/posts_test.go:705` | `t.Run("the body is a BARE ARRAY on the is_not_paging branch")` — **통과** |
| `board/drivefiles_test.go:1146` | `TestListDriveFiles_IsNotPagingAnswersABareArray` — **통과** |

### 1.2 그런데 프로덕션은 봉투를 낸다 (근본 원인)

원인은 `huma.DefaultConfig` 가 설치하는 **`SchemaLinkTransformer`** 다
(`router.go:354` → huma `defaults.go:88`).

그 트랜스포머는 `$schema` 를 붙이려고 **응답 바디의 타입을 통째로 다시 만든다**:

- huma `transforms.go:142` — `reflect.StructOf(fields)` 로 **새 익명 구조체 타입** 생성
- huma `transforms.go:224` — "Copy over all the **exported** fields"

결과로 두 가지가 동시에 사라진다:

1. **커스텀 `MarshalJSON` 이 사라진다.** 새 타입에는 그 메서드가 없다.
2. **`bare` 플래그가 사라진다.** unexported 라 필드 복사 대상에서 제외된다.

남는 건 승격된 `PageEnvelope` 필드들 + `$schema` 뿐이다.

### 1.3 격리 재현

레포와 동일한 타입 모양(`PageEnvelope` 임베드 + unexported `bare` + `MarshalJSON`)으로
config 만 바꿔 재현했다:

```
최소 config (= humatest.New(t), 테스트가 쓰는 것)   → 배열   ["a","b"]
huma.DefaultConfig (= router.go:354, 프로덕션)       → 객체   [data current_page last_page per_page total $schema]
```

프론트가 관측한 6개 키와 **정확히 일치**한다.

### 1.4 왜 테스트가 못 잡았나 — 구조적 사각지대

board 패키지 테스트는 전부 `humatest.New(t)` 로 API 를 조립한다
(`category_test.go:45`, `contract_test.go:39`, `errcode_test.go:43`).
`humatest` 는 **`huma.DefaultConfig` 를 쓰지 않으므로 `SchemaLinkTransformer` 가 없다.**

즉 이 클래스의 버그는 **현재 테스트 구성으로는 원리적으로 검출 불가능**하다.
`is_not_paging` 만의 문제가 아니라, 응답 바디의 마샬링/타입 동작에 의존하는 모든 계약이 같은 사각지대에 있다.

### 1.5 파급 범위 — 정확히 2개 엔드포인트

`bare=true` 가 실제로 전달되는 곳은 두 군데뿐이다:

| 엔드포인트 | 전달 지점 |
| --- | --- |
| `GET {S}/posts` | `board/posts.go:344` — `h.postPage(..., in.IsNotPaging)` |
| `GET {S}/drive-files` | `board/drivefiles.go:118` — `h.driveFilePage(..., in.IsNotPaging)` |

`/posts/mine` · `/posts/bookmarks` · `/drive-files/mine` · `/drive-files/bookmarks` 는
`false` 를 고정 전달하므로 **영향 없다** (`posts.go:495,506,567`).

응답 바디의 커스텀 `MarshalJSON` 은 이 레포에 총 4개인데, 나머지 2개
(`boardwritebody.go:268` `nullableInt64`, `legacy/bool.go:85` `Bool`)는 **중첩 필드 타입**이라
값째로 복사되어 타입이 보존된다 — **영향 없다.**

> 따라서 이 버그의 폭발 반경은 **최상위 응답 바디 2개 / 엔드포인트 2개**로 한정된다.

### 1.6 소스 자체의 모순 (별건)

`board/posts.go` 는 자기 자신과 어긋난다:

- 주석 104-109줄: "the response **DROPS** the envelope on that branch"
- `doc:` 태그 110줄: `"참이면 limit 개를 한 번에 돌려줍니다. **응답 봉투는 그대로입니다.**"`

OpenAPI/`/docs` 에 노출되는 건 태그 쪽이고, **공교롭게도 태그가 실제 동작을 맞게 적고 있다.**
`drivefilesbody.go:86` 의 태그는 반대로 배열이라고 적어 실제와 어긋난다.
어느 쪽으로 결정하든 두 태그를 일치시켜야 한다.

> 우리 문서 `05-post-read.md:39` 는 이 모순을 **이미 발견했고** — "입력 필드 `doc` 주석의
> '봉투는 그대로'는 현재 MarshalJSON과 다르다" — `MarshalJSON`(배열) 쪽 손을 들어줬다.
> 코드만 읽으면 타당한 판정이었지만 런타임은 반대였다. **런타임을 확인하지 않은 것이
> 이 오류의 직접 원인**이고, §1.8 의 회귀 테스트가 그 재발을 막는다.

### 1.7 선택지

| # | 방안 | 비용 | 위험 |
| --- | --- | --- | --- |
| **A** | **`is_not_paging` 의 응답 분기를 폐기**하고 봉투로 통일. `take`/`page` 만 남긴다 | 가장 작음 — `bare` 필드·`MarshalJSON` 2개 삭제 | D122 결정 되돌림. 다만 아래 참고 |
| B | 트랜스포머가 이 두 타입을 건너뛰도록 우회 | 중간 — 래퍼 트랜스포머 필요 | huma 내부 동작 의존, 업그레이드 시 재발 |
| C | 오퍼레이션을 둘로 분리 (`/posts` vs `/posts:bare`) | 큼 — 라우트 표 변경 | URL 계약 변경 |

**A 를 권한다.** 근거:

- **D122 가 인용한 소비자는 Go 를 호출하지 않는다.** 주석이 근거로 든
  `jupiter-board-web`·`oc-board-web` 은 Laravel(`jupiter-board-api`)을 호출한다.
  Go 를 호출하는 유일한 클라이언트는 `oc-board-front` 이고, **이미 `take`/`page` 로 전환을 마쳤다**
  (기능 손실 없음 — 상한 100 은 플래그 유무와 무관).
- 프론트도 같은 방향을 제안했다("응답 형태를 바꾸는 플래그는 화면을 통째로 죽이는 실패 모드를 만들기 쉽다").
- 실제로 그 실패 모드가 발생했다 — 200 응답이라 네트워크 탭에서 안 보이고
  `.map is not a function` 으로 화면 전체가 죽었다.

단, **요청 측 `is_not_paging`/`limit` 은 유지**해야 한다 — 페이지 크기 선택 기능이고
그건 정상 동작한다(`posts_test.go:689-691`).

### 1.8 함께 해야 할 것

- [ ] **프로덕션 config 로 도는 회귀 테스트 추가.** `humatest` 가 아니라 `NewRouter` 가 만드는
      API 로 최소 1건. 이게 없으면 같은 클래스의 버그가 또 통과한다. (§1.4)
- [ ] `posts.go:110` 과 `drivefilesbody.go:86` 의 `doc:` 태그를 결정에 맞춰 일치시킬 것.
- [ ] **우리 문서 4곳 정정** (아래 §5).

---

## 2. 🟠 BR-012 — 독립 로그인 경로에 member 자격이 없다

**판정: 실재하는 설계 결손. 프론트 실측이 맞다.**

프론트가 실행 서버(:8090)에서 board 토큰으로 관리 4경로를 호출해 **전부 401 `UNAUTHORIZED`** 를 확인했다.
이는 우연이 아니라 **설계대로**다:

- 관리 3종은 `/api/v1/companies/…` 평평한 경로에 있다 (`router.go:122-124`)
- 그 경로는 `AuthPolicy` 상 **member 계약** — OfficeWave ES256 (`middleware/auth.go:54-71`)
- board 토큰은 이 서비스가 발급한 **HS256** (`auth/boardtoken.go:63,72`)
- 두 계약은 교환 불가. 우리 README 도 전역 함정 9번으로 같은 사실을 적어뒀다

**결과: ID/PW 독립 로그인만 하는 웹은 개인 알림·회사 홈 설정을 저장할 방법이 구조적으로 없다.**

영향 경로 4개:

```
PATCH /api/v1/companies/{c}/settings/users/me
PATCH /api/v1/companies/{c}/settings
PUT   /api/v1/companies/{c}/settings/users/me/recent-search-keywords
GET   /api/v1/companies/{c}/departments
```

### 프론트의 현재 조치 (타당함)

두 management 호출을 삭제하고 mutation 을 `isSupported: false` 로 거절, UI 는 **비활성 + 사유 표시**.
조용히 실패시키지 않은 것은 옳은 판단이다. 게시판별 알림은 board 계약
`PUT {S}/boards/{id}/my-notification` 으로 전환해 200 확인.

### 결정이 필요하다

| # | 방안 | 비고 |
| --- | --- | --- |
| A | board 계약으로 동등한 설정 엔드포인트를 제공 | 권한 검사(회사 관리자 등)를 board 토큰 클레임으로 동등하게 재현해야 함 |
| B | 독립 로그인에서 member 자격을 획득하는 공식 흐름 문서화 | 상위 SSO 가 member 토큰을 주는 배포에만 성립 |
| C | 독립 로그인 배포에서는 해당 기능을 미지원으로 확정 | 프론트 현재 상태를 계약으로 승격 |

**결정 없이는 프론트가 더 진행할 수 없는 항목이다.** 어느 쪽이든 토큰 종류·갱신·만료 계약을 함께 확정해야 한다.

> 프론트가 명시적으로 선을 그었다: "검증 완화나 기존 board 토큰을 member 경로에서 무조건 수용하라는 요청은 아니다."
> 그 선은 지켜야 한다 — B 를 택하더라도 검증을 느슨하게 하는 방식은 안 된다.

---

## 3. 🟡 BR-018 ~ BR-027 — 이미 기록된 이슈의 재요청 (10건)

이 10건은 **우리가 `README.md` 「발견한 이슈」 19건에 스스로 기록한 것**을 프론트가 읽고
요청서로 옮긴 것이다. 새 정보가 아니므로 재검증하지 않았다.
표본으로 BR-021 만 코드 재확인했고 정확했다.

| BR | 내용 | 우리 근거 | 판정 |
| --- | --- | --- | --- |
| BR-018 | 회사설정 CHECK 위반이 500 | `management/setting.go:35`, `migrations/board/000001:903` | 인정 |
| BR-019 | 업로드 예약이 음수 size 를 통과 → 배치 전체 500 | `board/driveuploadbody.go:44`, `000001:824` | 인정 |
| BR-020 | 삭제된 폴더를 부모/업로드 위치로 지정 가능 | `driveuploadquery.go:117`, `folderquery.go:112` | 인정 |
| BR-021 | 폴더를 루트로 이동할 방법 없음 | `folderquery.go:255` — `parent_id = COALESCE(CAST(@parent_id AS uuid), parent_id)` → **null 은 유지** | **재확인 완료** |
| BR-022 | 파일 복원이 수동 해제한 북마크까지 복원 | `drivefilewritequery.go:228` | 인정 |
| BR-023 | purge 와 복원 경합 → 행은 살고 bytes 는 소멸 | `worker/drivepurge.go:135`, `board/drivepurge.go:150` | 인정 |
| BR-024 | 게시글 복원이 기존 개별삭제 댓글까지 활성화 | `postwritequery.go:535` | 인정 |
| BR-025 | purged_at 글의 작성자 직접 상세 조회 가능 | `postdetailquery.go:190,645` | 인정 |
| BR-026 | 웹훅 non-2xx 를 발송 성공으로 latch | `webhook/client.go:139`, `worker/alarmdelivery.go:593` | 인정 |
| BR-027 | 카테고리 삭제 snapshot 경합 → 고아 live 자식 | `categorydelete.go:92` | 인정 |

**우선순위 제안** (데이터 손실 > 오탐 > 표시 오류):

1. **BR-023** — 유일한 실데이터 손실. 복원 성공 응답 후 다운로드 불가.
2. **BR-026** — 알림 미도달이 재시도 없이 성공으로 잠긴다.
3. **BR-022 · BR-024** — 다른 사용자의 선택/삭제 상태를 되살린다.
4. **BR-019 · BR-020 · BR-027** — 정합성 붕괴, 성공 응답 후 결과를 못 찾음.
5. **BR-018 · BR-025** — 상태코드/가시성 오류.
6. **BR-021** — 기능 부재(신규 계약 필요).

> 우리 README 의 나머지 9건(스키마/런타임 null 차이, `%5b` 대소문자, last_page overflow 등)은
> 프론트가 요청서로 올리지 않았다. 프론트 화면에 영향이 없다고 판단한 것으로 보이며, 타당하다.

---

## 4. ⚪ 코드 밖 항목 (5건)

### 제품 결정 (2건)

| BR | 질문 | 현재 계약 |
| --- | --- | --- |
| **BR-003** | 회사 설정 기반 홈 위젯을 일반 사용자가 읽을 API 를 낼 것인가 | 없음. `/me.company_setting` 은 `company_main_boards` 등 5키를 억누른다(`board/dto.go:236-243`). 전체 위젯은 관리 응답에만 있고 member 토큰 + 회사 관리자 권한 필요 |
| **BR-011** | 관리자의 타인 게시글 삭제를 기능으로 유지할 것인가 | **유지 안 함.** 작성자 전용(D104). 관리자가 남의 글을 지우면 `200 {affected:0, ignored_ids:[id]}` — 에러가 아니다 |

BR-011 은 결정이 어느 쪽이든 프론트 후속 작업이 필요하다:
유지하면 백엔드 계약 확장, 유지 안 하면 프론트가 삭제 메뉴를 제한하고
`ignored_ids` 를 검사해 **전건 거부를 성공으로 처리하지 않아야** 한다.

### 배포 환경 확인 (3건)

BR-008(워커·Redis·알림 템플릿 실행) · BR-028(공개 URL·활성 설정·TTL) · BR-029(S3/CDN IAM·CORS).

우리 README 「코드 밖에서 결정되는 값」 3개와 그대로 대응한다. **코드로 판정 불가**이며
배포 담당자 회신이 있어야 종결된다. 프론트도 이미 "배포 담당자 확인으로 범위를 좁힌다"고 적었다.

---

## 5. 우리 문서에서 고쳐야 할 것

BR-032 때문에 `doc/api/` 4곳이 **런타임과 다른 서술**을 하고 있다.
코드 의도를 옮긴 것이지 실제 응답이 아니다 — 프론트 계약 문서로서는 오류다.

> 프론트의 `docs/api/go/` 사본은 우리 원본과 **SHA-256 동일**(`05-post-read.md`,
> `09-drive-file.md` 확인)이므로 아래 줄 번호가 양쪽에 그대로 대응한다.
> 우리가 고치면 프론트는 사본만 다시 받으면 된다.

| 파일 | 위치 | 현재 서술 | 실제 |
| --- | --- | --- | --- |
| `05-post-read.md` | :39 | `is_not_paging=1` 은 **배열** | 봉투 + `$schema` |
| `05-post-read.md` | :307 | `is_not_paging=true` 일 때 PostView **배열** | 〃 |
| `09-drive-file.md` | :108 | `is_not_paging=true` 이면 **봉투 없이 DTO[]** | 〃 |
| `09-drive-file.md` | :215 | `is_not_paging=true` 면 DriveFileDTO[] **직접 반환** | 〃 |

BR-032 의 결정(§1.7)이 나온 뒤에 한 번에 고치는 게 맞다 —
방안 A 면 "플래그는 페이지 크기만 바꾼다"로, 방안 B 면 "배열"로 유지하되 회귀 테스트를 붙인다.

추가로 README 「발견한 이슈」에 **BR-032 를 새 항목으로 추가**해야 한다.
현재 19건에 이 건이 없다 — 우리가 코드만 읽고 런타임을 확인하지 않아 놓친 것이다.

---

## 6. 백엔드 작업 목록

```
[ ] BR-032 결정 (§1.7) — A/B/C 중 택1                       ← 먼저
[ ] BR-032 수정 + 프로덕션 config 회귀 테스트 (§1.8)
[ ] BR-032 doc: 태그 2곳 일치 (posts.go:110, drivefilesbody.go:86)
[ ] doc/api 4곳 정정 + README 이슈에 BR-032 추가 (§5)
[ ] BR-012 방안 결정 (§2) — 프론트가 대기 중
[ ] BR-023 → BR-026 → BR-022/024 순으로 착수 (§3)
[ ] BR-003 / BR-011 제품 결정 회신
[ ] BR-008 / BR-028 / BR-029 배포 담당자 회신 요청
```

---

## 7. 이 판정에서 하지 않은 것

- **코드를 수정하지 않았다.** 판정과 문서 작성만 했다.
- **운영 서버에 요청을 보내지 않았다.** BR-032 는 격리 재현 테스트로 확인했고,
  프론트의 로컬 실행 서버(:8090) 관측을 인용했다.
- **BR-018~027 을 개별 재검증하지 않았다.** 우리가 기록한 이슈의 재요청이므로 근거를 대조만 했다.
  BR-021 만 표본으로 코드를 다시 읽었다.
- **BR-008/028/029 를 확인할 수 없다.** 배포 환경의 실제 값이다.
