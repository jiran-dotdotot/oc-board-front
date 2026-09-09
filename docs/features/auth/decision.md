# Go 로그인 연결

2026-09-08. 계약은 [Go 인증 원문](../../api/go/01-auth-user.md), 코드 조사 기준은 feat/settings · 65b7f49다.

## 적용 범위

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

## 남은 범위와 백엔드 전달

최초 로그인 연결에서는 게시글·카테고리·자료실·설정 서비스를 전환하지 않았다. 이후 메인 조회 전환은 아래 후속 기록으로 구분한다. 로그인 성공이나 목록 전환을 상세·쓰기·설정까지 모두 연동되었다는 뜻으로 쓰지 않는다. OfficeWave 토큰 교환 화면과 member 자격 획득 흐름도 새로 만들지 않았다. 기존 member 공급 계약 요청은 [BR-012](../../api/backend-requests.md#br-012), 나머지 서비스 전환은 [BR-013](../../api/backend-requests.md#br-013)에 남아 있다.

최초16:46 확인에서는 localhost:8090의 인증 면제 경로가 bearer401을 반환했고 CORS의 Lang·Time_zone 허용이 빠져 있었다. 이력은 [최초 백엔드 전달 문서](go-login-backend-handoff.md)에 보존했다. **17:50까지의 백엔드 회신**은 실행65b7f49·인증 설정·DB 스키마 복구 후 실제 사용자 login·me200과 개발 CORS 통과를 기록한다. 이는 [백엔드 작성자의 검사 결과](/Users/dotdotot/Documents/Workspace/ov/oc-api-go/doc/backend-replies/BR-030-BR-031.md)다. [BR-031](../../api/backend-requests.md#br-031)은 개발 환경 해결, [BR-030](../../api/backend-requests.md#br-030)은 실제 토큰의 HTTP refresh 회전·재사용 검증만 남긴다.

## 최초 로그인 연결 검증 이력

- 인증 단위 테스트: 정확한 경로·Body·bearer 제외, 동시401의 단일 refresh, 소비 후 실패의 재사용 방지, 계정 변경 중 늦은 응답, nullable me와 회사 변경, 로그아웃·캐시 정리.
- 브라우저 테스트: 계약 fixture로 login→me→logout, 로그인401 유지, 두 탭의 실제 Web Locks·localStorage 공유와 refresh1회.
- 실제 서버 확인: 비밀값 없는 healthz, 빈 credential Body, 무인증 me, OPTIONS만 호출했다. 실제 계정·토큰 발급 검증과 구분한다.

최종 실행 결과: npm run build·npm run lint 통과, npm run test는10파일124건 통과, npm run test:e2e는 Chromium5건 통과했다. 인증 전용 단위16건과 브라우저3건은 새 Go 계약 fixture를 사용했다. 기존 CSS 예시 문자열의 파싱 경고2건과 큰 청크 경고는 빌드에 남아 있으며 이번 인증 변경에서 해당 소스·번들 분할은 수정하지 않았다. 수정 파일의 Prettier·기존 편집 훅 검사, 전달 문서의 링크, BR31개 요약/본문 일치도 확인했다.

## 후속: 로그인 직후 메인 조회 전환

백엔드의17:50:10~11 실제 요청 진단은 login·me200 뒤 기존 `/board`·`/post`·`/drive/file`·`/category/admin`의401을 확인했다. 이 실패는 **토큰 검증 전 bearer 추출 단계의 missing bearer token**이다. board 토큰을 member 경로까지 전역 첨부하는 변경은 하지 않는다.

기존 서비스의7개 목록 함수(북마크, 게시글 페이지·공지 배열, 자료실 파일 배열·페이지, 일반·관리자 카테고리)를 Go의5개 경로로 전환하는 범위다. 공통 회사/사용자 경로는 board JWT identity를 사용하며, 일반 목록의 페이지 봉투와 `is_not_paging=1`의 직접 배열을 구분한다. 북마크는 `/boards`로 대체하지 않고 `/bookmarks?take=100`을 사용한다. 화면의 병렬 조회와 기존 표시 구성을 유지한다.

전환 경로·원문 근거·남은 실제 계정 확인은 [메인 연결 전달 문서](go-main-backend-handoff.md)에 기록한다. 7개 목록 함수 전환 후 빌드·린트, 단위129건, E2E7건이 통과했다. 이 결과는 위 최초 로그인 연결의124건/5건 결과와 구분하며, E2E의 서버 응답은 Go 계약 fixture다. 실계정 목록 조회·HTTP refresh는 아직 미검증이다.
