#!/usr/bin/env node
/**
 * 스케일 밖 임의값 검사 — docs/guides/design-tokens-guide.md
 * 정본: "구현은 이 표의 값만 사용하고 임의 px·hex를 만들지 않는다."
 * 눈으로는 안 잡히는 부류만 본다(글자·radius·색·자간·행간). 아이콘/레이아웃 치수는 별도.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : []
  })

const RULES = [
  { re: /\btext-\[[^\]]*(px|rem|em)\]/g, msg: '임의 글자 크기 — 11/12/13/14/16/18/20/24 (text-2xs…2xl) 만' },
  { re: /\brounded[a-z-]*-\[[^\]]+\]/g, msg: '임의 radius — 4/8/12/16/20/full (rounded·md·lg·xl·2xl·full) 만' },
  { re: /\brounded-(sm|3xl|4xl)\b/g, msg: '사용 금지 radius 클래스' },
  { re: /\btracking-\[[^\]]+\]/g, msg: '임의 자간 — tracking-title/display/body/label 만' },
  { re: /\bleading-\[[^\]]+\]/g, msg: '임의 행간 — leading-title/body/prose 만' },
  { re: /\b(bg|text|border|fill|stroke|ring)-\[#[0-9a-fA-F]{3,8}\]/g, msg: '하드코딩 색 — 정본 토큰만' },
  { re: /\bshadow-\[(?!var\()[^\]]+\]/g, msg: '하드코딩 그림자 — shadow-[var(--shadow-dropdown|modal)] 만' },
  // 전면 오버레이(inset-0)에 쓴 bg-black 만 스크림으로 본다.
  // 이미지 위 캡션 칩 같은 «테마 무관 어두운 배경»은 정당하므로 제외한다.
  { re: /\bbg-black\/\d+/g, msg: '하드코딩 스크림 — bg-[var(--scrim-modal|sheet)] 만', needs: /inset-0/ },
  {
    re: /\b(bg|text|border)-(red|blue|green|yellow|orange|amber|slate|zinc|neutral|stone|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|lime)-\d{2,3}\b/g,
    msg: 'Tailwind 기본 팔레트 — 정본에 없다',
  },
  { re: /\bfont-(black|light|thin|extralight)\b/g, msg: '웨이트는 400/500/600/700/800 만 (800은 16px+ 타이틀 전용)' },
  // 아이콘 «호출부»에 임의 크기를 얹는 경우. <svg> 안쪽만 보는 아래 검사를 빠져나간다.
  // (컨테이너 span/div 의 size-[Npx] 는 정본에 스케일이 없어 대상이 아니다)
  {
    re: /<[A-Z]\w*(?:Icon|Mark|Mini)\b[^>]*\bsize-\[\d+px\]/g,
    msg: '아이콘 호출부 임의 크기 — size-3/3.5/4/5/6 또는 size prop 을 쓴다',
  },
]

// ── 아이콘 · stroke 는 «값» 단위 검사라 RULES(정규식)와 따로 돈다 ──
// 아이콘 크기: 12/14/16/20/24. 26px 이상은 «일러스트 글리프»(빈 상태·이미지 자리표시·스피너)로
// 아이콘 스케일 밖 — 사용자 확정. 그 사이(13·15·17·19·22 등)가 걸리면 위반이다.
const ICON_OK = new Set([12, 14, 16, 20, 24])
const ILLUSTRATION_MIN = 26
// stroke: 1.7~2.2. 3.4(체크박스 체크마크·대시)와 3(로딩 스피너)은 사용자 확정 예외 —
// 작은 체크박스 안에서 두꺼워야 보이고, 스피너는 글리프가 아니라 원의 굵기다.
const STROKE_EXEMPT = new Set(['3', '3.4'])
const SVG_TAG = /<svg[^>]*>/g

const hits = []
for (const file of walk('src')) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const { re, msg, needs } of RULES) {
      if (needs && !needs.test(line)) continue
      for (const m of line.matchAll(re)) hits.push({ file, line: i + 1, found: m[0], msg })
    }
  })
}

// 아이콘 크기 — <svg> 여는 태그 안쪽만 본다(아바타·히트영역·체크박스 컨테이너는 아이콘이 아니다)
for (const file of walk('src')) {
  const src = readFileSync(file, 'utf8')
  for (const tag of src.matchAll(SVG_TAG)) {
    const lineNo = src.slice(0, tag.index).split('\n').length
    const nums = [
      ...[...tag[0].matchAll(/size-\[(\d+)px\]/g)].map((m) => m[1]),
      ...[...tag[0].matchAll(/\b(?:width|height)="(\d+)"/g)].map((m) => m[1]),
    ]
    for (const raw of nums) {
      const n = Number(raw)
      if (ICON_OK.has(n) || n >= ILLUSTRATION_MIN) continue
      hits.push({
        file,
        line: lineNo,
        found: raw + 'px',
        msg: `아이콘 크기 — 12/14/16/20/24 만 (${ILLUSTRATION_MIN}px 이상은 일러스트 글리프로 예외)`,
      })
    }
  }
  src.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/strokeWidth=[{"]([\d.]+)/g)) {
      if (STROKE_EXEMPT.has(m[1])) continue
      const n = Number(m[1])
      if (n >= 1.7 && n <= 2.2) continue
      hits.push({ file, line: i + 1, found: `strokeWidth ${m[1]}`, msg: 'stroke 폭 — 1.7~2.2 만 (체크마크 3.4 · 스피너 3 은 예외)' })
    }
  })
}

// 셸 구조 — 디자인에서 --color-bg 인 요소는 반드시 면(bg-card)을 명시해야 한다.
// 빠뜨리면 캔버스(--background)를 상속받아 사이드바보다 어두워지고 hover 대비가 무너진다.
{
  const shell = 'src/components/common/AppShell.tsx'
  const src = readFileSync(shell, 'utf8')
  for (const tag of ['<header', '<aside', '<main']) {
    const m = src.match(new RegExp(tag + '[^>]*>'))
    if (!m) {
      hits.push({ file: shell, line: 0, found: tag, msg: '셸 요소를 찾지 못했다 — 검사기 갱신 필요' })
    } else if (!/\bbg-(card|\[var\(--card\)\])\b/.test(m[0])) {
      hits.push({
        file: shell,
        line: src.slice(0, m.index).split('\n').length,
        found: tag,
        msg: '셸 요소에 면이 없다 — bg-card 를 명시한다 (디자인: background:var(--color-bg))',
      })
    }
  }
}

if (hits.length) {
  console.error('❌ 스케일 밖 임의값\n')
  for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.found}\n      → ${h.msg}`)
  console.error(`\n총 ${hits.length}건 — docs/guides/design-tokens-guide.md 참조`)
  process.exit(1)
}
console.log(`✅ 스케일 밖 임의값 0건 (${RULES.length}개 정규식 규칙 + 아이콘 크기 + stroke 폭)`)
