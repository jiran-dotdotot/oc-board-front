// dev 전용. Alt+클릭 → 코멘트 입력 → window.__pings 에 쌓인다.
// Claude 가 chrome-devtools MCP 의 evaluate_script 로 __pings / __pingEls 를 읽어 수정한다.
type Ping = { n: number; comment: string; tag: string; cls: string; text: string; size: string }

const w = window as unknown as { __pings: Ping[]; __pingEls: Element[] }
const pings: Ping[] = (w.__pings = [])
const els: Element[] = (w.__pingEls = [])

document.addEventListener(
  'click',
  (e) => {
    if (!e.altKey) return
    e.preventDefault()
    e.stopPropagation()
    const el = e.target as HTMLElement

    // 이미 찍힌 요소를 다시 Alt+클릭하면 삭제(토글)
    const dup = els.indexOf(el)
    if (dup !== -1) {
      els.splice(dup, 1)
      pings.splice(dup, 1)
      pings.forEach((p, i) => (p.n = i + 1))
      el.style.outline = ''
      console.log('[ping] 삭제 — 남은 핀', pings.length)
      return
    }

    const comment = window.prompt(`핀 #${pings.length + 1} — 뭐가 잘못됐나요?`)
    if (!comment) return
    const r = el.getBoundingClientRect()
    const ping: Ping = {
      n: pings.length + 1,
      comment,
      tag: el.tagName.toLowerCase(),
      cls: el.getAttribute('class') ?? '',
      text: (el.textContent ?? '').trim().slice(0, 80),
      size: `${Math.round(r.width)}x${Math.round(r.height)}`,
    }
    pings.push(ping)
    els.push(el)
    el.style.outline = '2px solid #f0f'
    console.log('[ping]', JSON.stringify(ping))
  },
  true,
)

// 전체 삭제: 콘솔에서 __pingClear()
;(window as unknown as { __pingClear: () => void }).__pingClear = () => {
  els.forEach((el) => ((el as HTMLElement).style.outline = ''))
  els.length = 0
  pings.length = 0
  console.log('[ping] 전체 삭제')
}

console.log('[ping] Alt+클릭 = 핀 찍기 / 다시 Alt+클릭 = 삭제 / __pingClear() = 전체 삭제')
