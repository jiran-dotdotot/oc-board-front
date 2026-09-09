# Claude → Codex 설정

2026-09-08, Codex CLI 0.153.4 기준으로 실제 연결과 설정 로딩을 확인했다.
프로젝트 규칙과 검사 로직은 Claude와 공유하고 Codex 이벤트 형식만 변환한다.

## 연결 상태

| 항목            | Codex 구성                                                     | 검증                                                           |
| --------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| 프로젝트 규칙   | 루트 `AGENTS.md`에서 `CLAUDE.md` 전체 읽기를 지시              | 기존 규칙을 복제하지 않고 공유                                 |
| Context7        | 기존 `~/.codex/config.toml`의 HTTP MCP                         | 라이브러리 검색·문서 조회 성공                                 |
| Ponytail        | 기존 `ponytail@ponytail` 4.9.0 플러그인                        | full 모드 주입, 세션·하위 에이전트·프롬프트 훅 활성            |
| codebase-memory | 기존 글로벌 MCP·스킬·3개 조사 에이전트                         | 이 저장소 인덱스 생성, 상태 ready                              |
| shadcn          | `.codex/config.toml`                                           | Claude와 동일 명령·인자, MCP 도구 7개 응답                     |
| Chrome DevTools | `.codex/config.toml`                                           | Claude와 동일 격리 프로필·인자, MCP 도구 26개 응답             |
| 자동 검사       | `.codex/hooks.json` → `hooks/claude_hooks.py` → 기존 Claude 훅 | 두 Codex 이벤트 활성·신뢰 상태 확인, 격리 테스트 통과          |
| `/adv`          | `.agents/skills/adv/SKILL.md`                                  | Codex 스킬 목록에서 활성 확인                                  |
| claude-mem      | 기존 `claude-mem@claude-mem-local`                             | 연동은 유지되지만 observer 사용량 소진으로 새 메모리 저장 중단 |

Context7·Ponytail·codebase-memory는 이미 사용자 설정에 설치되어 있어 중복 설치하지 않았다.
codebase-memory 프로젝트 ID는 `Users-dotdotot-Documents-Workspace-ov-oc-board-front`다.
인덱스의 제외 파일과 부분 파싱 범위는 `index_status`·`check_index_coverage`로 확인한다.
`.claude/`는 인덱스 제외 대상이므로 해당 설정·스크립트는 직접 읽는다.

## 공유하는 검사

`.claude/settings.json`과 `.claude/hooks/`를 계속 정본으로 사용한다.

- 셸 실행 전: push 전에 build 확인, tmux/Conductor 밖의 dev 서버 시작 차단.
- `apply_patch` 편집 후: Prettier, CommonJS 검사, ko/en/ja 키 동기화, 라이트/다크 색 토큰 검사.
- 여러 파일·이름 변경·공백 경로·하위 폴더 작업을 처리하며, 저장소 외부 경로와 삭제된 파일은 제외한다.
- 편집 후 검사 실패는 피드백이다. 이미 수행된 편집을 되돌리지는 않는다.
- 셸로 파일을 직접 쓰는 작업은 편집 훅 대상이 아니다. `apply_patch`를 사용하거나 동일 검사를 직접 실행한다.

Codex는 `apply_patch` 입력을 패치 문자열로 전달하므로 Claude의 `file_path` 형식으로 변환하는
작은 어댑터가 필요하다. 원본 검사 로직은 변경하지 않았다.
설정 위치와 이벤트 형식은 [공식 훅 문서](https://learn.chatgpt.com/docs/hooks)를 따른다.

## 사용

이 프로젝트에서 새 Codex 작업을 열면 추가한 MCP·지침·스킬·훅을 읽는다.
현재 컴퓨터에서는 프로젝트 훅 두 개의 검토·활성화까지 완료했다.
다른 컴퓨터나 체크아웃에서는 Codex의 `/hooks`에서 해당 훅을 검토하고 신뢰해야 한다.
글로벌 도구 설치는 개인 설정이므로 이 저장소를 복제하는 것만으로 설치되지는 않는다.
[Codex MCP 설정 문서](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

- `$adv` 또는 `/adv` 검토 요청은 기존 `.claude/commands/adv.md`의 14개 역할을 유지한다.
  Codex의 동시 실행 한도에 맞춰 나눠 실행한다. 실제 리뷰 자체는 이번 설정 작업에서 실행하지 않았다.
- Claude 전용 `EnterPlanMode`, `AskUserQuestion` 등의 대응은 루트 `AGENTS.md`에 명시했다.
- `DesignSync` 연결이나 `/design-login` 인증은 이번 작업에서 확인하지 않았다.
  디자인 작업 시 연결 상태를 먼저 확인한다.
- Claude의 `typescript-lsp` 플러그인은 그대로 설치하지 않았다. 현재 Codex에서는 기존
  codebase-memory의 구조 조회와 프로젝트 TypeScript 검사(`npx tsc -b --noEmit`)를 사용한다.
  Claude 전용 LSP 도구와 동일한 인터페이스라는 뜻은 아니다.
- `superpowers`와 `claude-code-setup`은 Claude 프로젝트에 활성 플래그만 있고 실제 설치
  레지스트리에 없었다. 이번 이식에서는 추가 설치하지 않았다.

claude-mem 오류는 `Provider reported the inference allowance exhausted`다.
observer 사용량이 회복되거나 별도 제공자로 변경되기 전에는 새 메모리를 저장할 수 없다.
기존 워커·제공자 설정은 변경하지 않았다.

## 확인 명령

```sh
codex mcp list
python3 .codex/hooks/test_claude_hooks.py
npm run build
npm run lint
npm run test
```

훅 통합 테스트 1개와 단위 테스트 108개, build, lint가 통과했다.
build에는 CSS 최적화와 큰 번들 경고가 있었지만 실패하지 않았다.
UI·앱 코드는 변경하지 않아 E2E는 이번 설정 변경의 검증 대상에서 제외했다.

글로벌 설정 변경 전 백업:
`~/.codex/backups/oc-board-setup-20260908-145629/config.toml`.
글로벌 설정에는 검토한 프로젝트 훅 두 개의 신뢰 상태만 추가했고 기존 설정을 보존했다.
