#!/bin/bash
# 화면을 고치기 전에 «디자인 정본»을 이번 세션에 실제로 가져왔는지 검사한다.
#
# [Why] 실측 2026-09-10 — CLAUDE.md 가 정본을 `개선안 통합 앱.dc.html` 로 지정해 뒀는데도
#   개별 아트보드(`화면 08_마이페이지.dc.html`)를 대신 읽고 항목별 대조표를 만들었다.
#   그 대조표로 «승인»까지 받았고, 아트보드가 시안 제시용으로 두른 데모 프레임
#   (`max-width:860px; margin:0 auto`)을 앱 레이아웃 명세로 옮겨 화면을 880px 고정폭으로 만들었다.
#   정본과 아트보드는 칩 카운트·표 구조·일괄버튼 위치가 서로 다르다.
#
#   「정본이 어딘가 존재하나」를 검사하면 아무것도 못 잡는다 — 정본은 그때도 접근 가능했고
#   내가 안 읽은 것뿐이다. 그래서 **이번 세션에 정본을 get_file 했는가**를 검사한다.
#   라이브 취득을 강제하므로 «사본이 낡는» 문제도 같이 사라진다(그래서 저장소에 미러를 두지 않는다).
#
# 배선: PostToolUse 에 두 번 등록한다.
#   - matcher "DesignSync"  → 정본 get_file 이면 세션 마커를 남긴다 (검사하지 않음)
#   - matcher "Edit|Write"  → 화면 컴포넌트인데 마커가 없으면 exit 2
# exit 2 는 편집을 되돌리지 않는다. Claude 에게 피드백만 준다(기존 훅과 동일).
set -uo pipefail

# 정본 파일명의 공통 부분. 아트보드(`화면 NN_*.dc.html`)는 «의도적으로» 매치되지 않는다 —
# 아트보드를 읽는 것으로 이 검사를 통과시키면 오늘의 사고가 그대로 재현된다.
CANONICAL_MATCH="개선안 통합 앱"

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || true)
SESSION=$(printf '%s' "$INPUT" | jq -r '.session_id // "nosession"' 2>/dev/null || true)
MARKER="${TMPDIR:-/tmp}/oc-design-canonical-${SESSION}"

# ── 1) 마커 기록 ───────────────────────────────────────────────────────────
# list_projects·list_files 로는 통과되지 않는다. 실제 본문을 가져와야 한다.
if [ "$TOOL" = "DesignSync" ]; then
  METHOD=$(printf '%s' "$INPUT" | jq -r '.tool_input.method // empty' 2>/dev/null || true)
  DPATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.path // empty' 2>/dev/null || true)
  case "$METHOD:$DPATH" in
    get_file:*"$CANONICAL_MATCH"*) : >"$MARKER" ;;
  esac
  exit 0
fi

# ── 2) 검사 ───────────────────────────────────────────────────────────────
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
[ -z "$FILE" ] && exit 0

# 화면 단위 컴포넌트만. 훅·유틸·서비스·타입은 디자인 정본과 무관하다.
case "$FILE" in
  */src/components/*Screen.tsx) ;;
  *) exit 0 ;;
esac

[ -f "$MARKER" ] && exit 0

{
  echo "디자인 정본을 이번 세션에 읽지 않고 화면을 고치고 있다: ${FILE##*/}"
  echo "-> DesignSync get_file 로 «${CANONICAL_MATCH}.dc.html» (웹) 과 «${CANONICAL_MATCH} mobile.dc.html» (모바일) 을 먼저 가져와라."
  echo "   · 응답의 truncated 필드를 «먼저» 읽는다. true 면 256KiB 에서 잘린 것이고 스크립트 블록은 없다."
  echo "   · 큰 응답은 도구가 파일로 저장하고 경로를 알려준다. 그 경로를 python3 로 풀어 scratchpad 에 떨구고 grep 한다."
  echo "   · 개별 아트보드(화면 NN_*.dc.html)는 정본이 아니다 — 로직·라벨의 근거로만 쓰고,"
  echo "     그 안의 max-width·margin:0 auto·테마 토글 바는 «데모 프레임»이지 명세가 아니다."
  echo "   · 시각 변경이 없는 순수 배선이어도 정본 1회 취득이면 이 경고가 풀린다."
} >&2
exit 2
