#!/usr/bin/env node
/**
 * 디자인 토큰 정본표(docs/guides/design-tokens-guide.md) 대비 src/index.css 검증.
 * 출처: Claude Design 「디자인 토큰 정본.dc.html」 (2026-09-01).
 * 값을 손으로 고칠 일이 있으면 «정본표를 먼저» 고치고 여기 CANON 을 맞춘다.
 */
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const block = (head) => {
  const i = css.indexOf(head)
  if (i < 0) throw new Error(`블록 없음: ${head}`)
  const j = css.indexOf('\n}', i)
  const out = {}
  for (const m of css.slice(i, j).matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2]
  return out
}
const norm = (v) =>
  (v ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/([(,])\./g, '$10.')

const ramp = (name, light, dark) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s, i) => [
      `${name}-${s}`,
      [light[i], dark[i]],
    ]),
  )

const CANON = {
  primary: ['#3362ff', '#4b79ff'],
  card: ['#ffffff', '#26262a'],
  background: ['#f9fafb', '#1c1c1f'],
  success: ['#10bf79', '#10bf79'],
  'success-hover': ['#0ea96b', '#3bd495'],
  'success-bg': ['#e5f8f1', 'rgba(16,191,121,0.16)'],
  warning: ['#ff9045', '#ff9045'],
  'warning-hover': ['#f07e33', '#ffa666'],
  'warning-bg': ['#ffecdd', 'rgba(255,144,69,0.16)'],
  destructive: ['#fd4c45', '#fd4c45'],
  'destructive-hover': ['#e23b35', '#ff6b65'],
  'destructive-bg': ['#fae8e7', 'rgba(253,76,69,0.16)'],
  'info-bg': ['#f7faff', 'rgba(75,121,255,0.16)'],
  'scrim-modal': ['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.62)'],
  'scrim-sheet': ['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)'],
  'shadow-dropdown': ['0 4px 8px rgba(0,0,0,0.1)', '0 6px 16px rgba(0,0,0,0.45)'],
  'shadow-modal': ['0 4px 18px rgba(75,70,92,0.1)', '0 10px 30px rgba(0,0,0,0.55)'],
  'brand-panel': ['#1b3aa8', null],
  ...ramp(
    'gray',
    ['#f9fafb', '#f3f4f6', '#e5e7eb', '#cbd0d8', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937', '#111827'],
    ['#1c1c1f', '#303036', '#3c3c43', '#4f4f58', '#8e8e99', '#a4a4af', '#c7c7d0', '#dfdfe5', '#efeff2', '#f7f7fa'],
  ),
  ...ramp(
    'ov-blue',
    ['#f7faff', '#f0f6ff', '#d6e5ff', '#adc9ff', '#85a9ff', '#5c87ff', '#3362ff', '#2145d9', '#122db3', '#07198c'],
    [
      'rgba(75,121,255,0.16)', 'rgba(75,121,255,0.24)', 'rgba(124,158,255,0.38)', '#4a72ff', '#7fa0ff',
      '#93aeff', '#4b79ff', '#6d93ff', '#b9ccff', '#d6e5ff',
    ],
  ),
}

const light = block(':root {')
const dark = block('.dark {')
const bad = []
for (const [token, [l, d]] of Object.entries(CANON)) {
  if (norm(l) !== norm(light[token])) bad.push(['라이트', token, l, light[token] ?? '— 없음'])
  if (d !== null && norm(d) !== norm(dark[token])) bad.push(['다크', token, d, dark[token] ?? '— 없음'])
}

if (bad.length) {
  console.error('❌ 디자인 토큰 정본표와 불일치\n')
  for (const [mode, t, want, got] of bad) console.error(`  [${mode}] ${t}\n      정본 ${want}\n      실제 ${norm(got)}`)
  console.error(`\n총 ${bad.length}건 — docs/guides/design-tokens-guide.md 참조`)
  process.exit(1)
}
console.log(`✅ 디자인 토큰 정본표 일치 (${Object.keys(CANON).length}개 토큰 × 라이트/다크)`)
