#!/bin/bash
# 색 토큰의 라이트/다크 «짝» 검사.
# src/index.css 를 편집했을 때만 돈다. PostToolUse:Edit|Write 에 연결.
#
# [Why] --color-gray-* 10개가 .dark 에만 정의되고 :root 에 없던 적이 있다.
#   그러면 라이트에서 Tailwind 기본 팔레트로 «조용히» 떨어진다 — 회색은 회색이라
#   화면은 멀쩡해 보이고, 다크로 전환할 때만 색이 튄다. 사람 눈으로는 두 모드를
#   나란히 놓고 비교해야 겨우 보인다. 그래서 기계가 잡는다.
#
# 규칙: .dark 에 정의된 이름은 :root 에도 있어야 한다.
#   (반대 방향은 정상 — --radius, --z-*, --brand-panel 처럼 모드 무관 값이 있다)
# 위반 시 exit 2 (Claude 에게 피드백. 편집 자체를 되돌리지는 않는다)
set -euo pipefail

CSS="${CLAUDE_PROJECT_DIR:-.}/src/index.css"
INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
case "$FILE" in
  */src/index.css) ;;
  *) exit 0 ;;
esac
[ -f "$CSS" ] || exit 0

# 블록별 토큰 이름 추출 — 첫 :root {..} 와 첫 .dark {..}
names() {
  awk -v want="$1" '
    $0 ~ "^"want" ?\\{" { inb=1; next }
    inb && /^\}/        { exit }
    inb                 { if (match($0, /--[a-z0-9-]+[[:space:]]*:/)) {
                            t=substr($0, RSTART, RLENGTH); sub(/[[:space:]]*:$/, "", t); print t } }
  ' "$CSS" | sort -u
}

MISSING=$(comm -23 <(names '\.dark') <(names ':root'))
[ -z "$MISSING" ] && exit 0

{
  echo "❌ 라이트(:root)에 짝이 없는 토큰이 .dark 에만 정의돼 있습니다:"
  echo "$MISSING" | sed 's/^/   /'
  echo
  echo "라이트에서 이 토큰들은 값이 없어 Tailwind 기본값으로 조용히 대체됩니다."
  echo "→ :root 에도 같은 이름을 정의하거나, ov-blue/gray 처럼"
  echo "  @theme 에서 var(--x) 로 참조하고 :root/.dark 각각에 원본을 두세요."
} >&2
exit 2
