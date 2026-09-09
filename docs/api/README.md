# OC Board API 문서 안내

프론트 구현 계약은 **[Go 원문](go/README.md)**이다. 이 폴더의 안내와 `docs/guides/`는 탐색·연동을 돕는 해설이며, 원문의 필드·응답·권한·기본값을 대체하지 않는다. 이전 프론트 Go 정리는 현행 계약 근거에서 제외하고, 아래 새 원본으로 전면 교체했다.

## 출처와 조사 기준

| 항목 | 값 |
| --- | --- |
| 백엔드 저장소 | `/Users/dotdotot/Documents/Workspace/ov/oc-api-go` |
| 복사한 원본 | `/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/` |
| 코드 조사 기준 | `feat/settings` · `65b7f49f34b0b934e274437a764455af045b99d3` |
| 원본의 상태 | 위 코드를 조사해 작성한 **현재 로컬 문서**. 커밋에 포함되지 않은 미추적 파일이므로 `git show`로 취득하지 않음 |
| 프론트 복사본 | `/Users/dotdotot/Documents/Workspace/ov/oc-board-front/docs/api/go/` |
| 복사 시점 | **2026-09-08 18:06:45 +0900** (최초 전면 교체 16:17:22 KST, 백엔드 README 후속 이슈 추가분 전체 재복사) |
| 복사 범위 | `README.md`와 01~10 도메인 문서, 총 **11파일**. 파일명·본문·표·예시·근거를 바이트 그대로 보존 |

백엔드는 읽기 전용으로 사용했다. `doc/api-prev/`는 과거 보관본이며 이번 계약 근거가 아니다. 원문이 기록한 과거 조사·테스트·curl 검증은 **원본 작성자의 기록**이다. 이번 프론트 문서 갱신이 그 검사나 실제 토큰을 사용한 HTTP 호출을 다시 수행했다는 뜻은 아니다.

## 읽는 순서와 문서 역할

1. [Go README](go/README.md): 인증·입력 검증·응답 공통 규칙, 전역 함정, 등록/제외 라우트, 발견 이슈, 운영 환경 확인 항목을 읽는다.
2. [Go API 카탈로그](../guides/api-catalog.md): 구현할 기능의 METHOD·전체 경로·인증 종류를 찾는다.
3. 아래 해당 도메인 **원문 전문**: 공유 DTO와 엔드포인트의 입력·기본값·응답 분기·권한·부수효과를 함께 확인한다. 예시 한 건만으로 타입이나 권한을 추정하지 않는다.
4. [프론트 연동 레퍼런스](../guides/api-reference.md): 직렬화·오류·캐시·업로드 등 연동 시 주의점을 확인한다.
5. 계약 부족·불일치 또는 환경 의존으로 막히면 [백엔드 요청 누적 대장](backend-requests.md)에 근거와 조치를 기록한다. 이미 있는 Go 계약을 사용하지 못하는 **프론트 미전환**은 서버 계약 누락과 구분한다.

`Laravel` 문서는 그대로 보존한다. 기본 구현 열람 대상은 아니며, 실제 Go 계약 갭에 대한 요청 근거가 필요할 때만 `laravel/`의 해당 부분을 역방향 참조한다. Laravel에만 있는 필드·기본값·응답·권한을 Go에 있다고 채워 넣지 않는다. 레거시 Vue 프론트 `../jupiter-board-web`을 화면 작업 전에 읽는 규칙은 별개이며 그대로 유지한다.

## 도메인 탐색과 원본 절대경로

| 문서 | 프론트 복사본 | 백엔드 원본 — 코드 근거 링크를 따라갈 때 |
| --- | --- | --- |
| 공통 규칙·범위 | [README](go/README.md) | [원본 README](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/README.md) |
| 인증·토큰·유저 | [01-auth-user](go/01-auth-user.md) | [원본 01](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/01-auth-user.md) |
| 관리자·설정·정렬 | [02-management](go/02-management.md) | [원본 02](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/02-management.md) |
| 카테고리 | [03-category](go/03-category.md) | [원본 03](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/03-category.md) |
| 게시판·권한 | [04-board](go/04-board.md) | [원본 04](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/04-board.md) |
| 게시글 조회·첨부 다운로드 | [05-post-read](go/05-post-read.md) | [원본 05](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/05-post-read.md) |
| 작성·삭제·복원·공지 | [06-post-write](go/06-post-write.md) | [원본 06](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/06-post-write.md) |
| 댓글·공감·열람자 | [07-post-comment-like](go/07-post-comment-like.md) | [원본 07](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/07-post-comment-like.md) |
| 자료실 폴더 | [08-drive-folder](go/08-drive-folder.md) | [원본 08](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/08-drive-folder.md) |
| 자료실 파일 | [09-drive-file](go/09-drive-file.md) | [원본 09](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/09-drive-file.md) |
| 업로드·이미지·부서·버전 | [10-upload-department-client](go/10-upload-department-client.md) | [원본 10](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/10-upload-department-client.md) |

<a id="source-links"></a>
### 원문의 코드 근거 링크 해석

원문을 완전히 복사했기 때문에 원문 안의 `../../internal/...`, `../../go.mod`, `../../migrations/...` 링크는 **백엔드 `doc/api/` 기준 상대경로**다. 프론트 복사본에서 클릭하면 프론트의 `docs/internal/...` 등을 찾으므로 열리지 않는다. 코드 근거를 확인할 때는 위 표의 **백엔드 원본을 먼저 열고** 같은 링크를 따른다. 예를 들어 `../../internal/transport/httpapi/router.go#L409`의 실제 대상은 [백엔드 router.go](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/internal/transport/httpapi/router.go:409)다.

도메인 문서끼리의 링크와 앵커는 프론트 복사본에서도 사용할 수 있다. Go 코드 인용은 백엔드 저장소 루트와 지정 커밋 기준으로 확인한다. 원문에 들어 있는 과거 보관본·Laravel 코드 링크는 출처 이력이며, 기본 구현 근거로 추가 열람하지 않는다. 다른 개발 환경에서는 위 절대경로의 저장소 루트를 해당 로컬 위치로 바꿔 읽는다.

이 제약을 없애려고 원문 링크를 재작성하거나 백엔드 소스를 프론트에 복제하지 않는다. 코드 링크는 백엔드 문맥에서, 프론트 해설의 문서 링크는 프론트 문맥에서 검증한다.

## 엔드포인트 범위와 설정 조건

원문이 분류한 프론트 연동 대상은 **67개**다. 새 문서의 도메인별 개수는 `4 + 6 + 8 + 7 + 5 + 9 + 8 + 5 + 9 + 6`이다. 열람자 조회는 07번에 포함된다.

**onpremise DB를 제공한 조립에서는 89개 = 연동 대상 67 + 제외 22**다. onpremise DB가 없으면 해당 15개가 등록되지 않아 **74개 = 67 + 나머지 제외 7**이다. 나머지 일부 기능은 설정이 없을 때 라우트가 사라지는 대신 503을 반환하므로 운영 등록 수와 사용 가능 여부를 같은 뜻으로 보지 않는다. 제외 경로와 숨은 rewrite·OPTIONS·리다이렉트는 [카탈로그](../guides/api-catalog.md)와 [원문 등록표](go/README.md#등록-라우트-전수-대조표)를 따른다. Laravel 개수와의 뺄셈으로 누락 API를 추정하지 않는다.

## 갱신 방법

원문 교정은 백엔드에서 진행하고 완성된 `doc/api/`를 다시 복사한다. 프론트에서는 `go/` 내부를 부분 수정하거나 README 이름을 바꾸지 않는다. 이 안내, 두 프론트 가이드, 요청 대장은 복사 원문과 별도로 관리한다.

1. 양쪽 저장소의 `git status`를 확인하고 기존 변경을 보존한다. 원본 README의 조사 커밋과 실제 백엔드 작업 상태도 확인한다. 백엔드 checkout/reset은 하지 않는다.
2. 교체 전 프론트 `docs/api/go/`를 작업 폴더 밖에 백업한다. **현재 로컬 원본 전체**를 복사하고 원본에 없는 대상 파일은 제거한다. 아래 명령의 삭제 범위는 프론트 `docs/api/go/`뿐이다.

```bash
rsync -a --delete \
  /Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/api/ \
  /Users/dotdotot/Documents/Workspace/ov/oc-board-front/docs/api/go/
```

3. 파일 목록과 각 파일 SHA-256/바이트가 원본과 같은지 확인한다. 출처·코드 기준·복사 시점을 이 안내에 갱신한다.
4. 새 README와 01~10을 읽어 카탈로그·레퍼런스를 다시 대조하고, METHOD+경로 집합·인증 종류·조건부 등록을 검증한다. 요약만 보정하고 원문 대조를 생략하지 않는다.
5. 요청 대장의 기존 ID와 이력을 보존하며 상태·근거·분류를 다시 판정한다. 문서가 명확해진 것과 프론트 코드 수정 완료를 구분한다.
6. CLAUDE·검토 지침·문서의 기존 인용을 갱신하고 링크·앵커·줄 번호를 검사한다. 기존 Vue 화면 동작과 디자인 결정은 보존한다.

## 운영 환경에서 확정할 3개 항목

| 항목 | 확인할 내용 |
| --- | --- |
| 공개 Base URL·활성 설정·실제 토큰 TTL | 배포 origin, BOARD_* TTL/키, OFFICENEXT_* 설정. 코드 기본값을 운영값으로 확정하지 않음 |
| S3/CDN 접근·브라우저 업로드 허용 | 버킷 IAM·CORS·CDN과 실제 Origin에서 presigned PUT/GET 허용 여부 |
| 외부 인증·알림 가용성과 실제 배달·운영 워커 실행 | OfficeNext·웹훅, Redis·worker·scheduler 배포, DB 알림 템플릿 및 실행 로그 |

근거는 [새 원문 상단](go/README.md#코드-밖에서-결정되는-값)이다. 이 항목들은 문서 복사나 정적 코드 확인만으로 확정할 수 없다. 실제 API 연동·타입·서비스·UI 전환과 운영 호출 검증은 이번 작업에 포함하지 않는다.

## 이번 갱신에서 수행한 검증

2026-09-08 문서 갱신의 정적 검증 결과다. 원본 작성자의 검사를 재수행했다는 뜻이 아니다.

| 검사 | 결과 |
| --- | --- |
| 원문 복사 | 11파일의 목록·바이트 일치, 구버전 잔존 파일 없음 |
| 카탈로그 | 원문 도메인 제목·README 등록표와 67개 METHOD+경로·인증 일치, 중복·누락 없음. 제외22개도 일치하며 onpremise 조건부15개를 구분 |
| 등록표 교차 확인 | 원문89개와 백엔드에 이미 있는 `internal/transport/httpapi/testdata/routes.txt`의 정적 목록 일치. 라우터 실행·Go 테스트를 새로 수행한 검사가 아님 |
| 링크·인용 | 프론트 문서의 로컬 링크·앵커, 카탈로그67개 인용의 실제 제목 줄, 대장의 줄 번호 범위를 확인. 원문 코드 링크는 위 설명대로 백엔드 기준에서 확인하며 과거 보관본은 존재만 확인 |
| 요청 대장 | 기존17개 ID·Laravel 근거 링크 보존. 총29개 항목의 필수 필드와 요약/본문 상태 일치: 열림16·보류8·해결5 |
| 변경 범위 | 작업 시작 시점 대비 프론트 코드·Laravel 원문·훅·백엔드 파일 변경 없음. CLAUDE의 Screen work order 2번과 기존 Vue 참조 문구 보존 |

직접 작성한 문서는 `git diff --check`를 통과했다. Go 복사 원문 05·06·07의 마지막 빈 줄에 대한 경고 3건은 원본과 바이트를 일치시키기 위해 그대로 유지했다. 외부 웹 링크 접속·실제 토큰의 API 호출·빌드·프론트/백엔드 테스트는 이번 문서 작업에서 실행하지 않았다.

## 로그인·메인 연결 후속 갱신

2026-09-08 로그인·메인 API 연결 결과는 [전달 문서](../features/auth/go-main-backend-handoff.md)에 별도 기록했다. 위 표는 최초 문서 정비 당시의 검증 이력이다. 이번 재복사는 백엔드 README의 refresh DDL 이슈1건 추가를 반영했고, 도메인10파일·67개 API 계약은 바뀌지 않았다. 누적 대장은31항목(열림16·백엔드 확인중1·보류8·해결6)이다. 원문은 부분 편집하지 않았다.
