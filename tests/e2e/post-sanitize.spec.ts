import { expect, test } from '@playwright/test'

/**
 * 본문 살균은 «실브라우저»에서만 검증한다.
 * happy-dom 은 DOMPurify 가 `isSupported: true` 를 보고하는데도 결과가 틀리다
 * (실측: `<p>a</p><script>x</script>` → `a<script>x</script>`). 보안 경로를 조용히
 * 통과시키는 환경에서 확인하면 통과가 거짓이 된다.
 */
test('게시글 본문 HTML 살균 — 스크립트·이벤트·오버레이 제거', async ({ page }) => {
  await page.goto('/')
  const out = await page.evaluate(async () => {
    const m = await import('/src/utils/postHtml.ts')
    const s = m.sanitizePostHtml as (h: string) => string
    return {
      script: s('<p>안녕</p><script>alert(1)</script>'),
      onerror: s('<img src=x onerror="alert(1)">'),
      link: s('<a href="https://x.test">링크</a>'),
      position: s('<div style="position:fixed;top:0;color:red">덮개</div>'),
      overlap: s(
        '<div style="position:relative"><span style="position:absolute;left:20px">캡션</span></div>',
      ),
      keep: s('<p><strong>굵게</strong></p><img src="/a.png">'),
      svg: s('<svg><animate onbegin=alert(1) attributeName=x dur=1s>'),
      iframe: s('<iframe src="javascript:alert(1)"></iframe>'),
    }
  })

  expect(out.script).not.toContain('script')
  expect(out.script).toContain('<p>안녕</p>')
  expect(out.onerror).not.toContain('onerror')
  // target=_blank 만 주면 열린 창이 window.opener 로 이 페이지를 조작할 수 있다(tabnabbing)
  expect(out.link).toContain('target="_blank"')
  expect(out.link).toContain('noopener')
  // ⚠ 살균은 position 을 «건드리지 않는다» — 덮개 차단은 CSS containment 가 한다.
  //   여기서 걷어내면 작성자의 정상 겹침 서식까지 깨진다(utils/postHtml.ts 주석 참고).
  expect(out.position).toContain('color:red')
  expect(out.overlap).toContain('position:absolute')
  expect(out.keep).toContain('<strong>')
  expect(out.keep).toContain('img')
  expect(out.svg).toBe('')
  expect(out.iframe).toBe('')

  // 덮개 차단은 CSS 가 한다 — `.post-body` 안의 position:fixed 가 박스 밖으로 못 나가는지 실측
  const clamped = await page.evaluate(() => {
    const box = document.createElement('div')
    box.className = 'post-body'
    box.style.cssText = 'width:300px;height:100px'
    box.innerHTML = '<div id="ov" style="position:fixed;inset:0"></div>'
    document.body.appendChild(box)
    const r = document.getElementById('ov')!.getBoundingClientRect()
    const out = { w: Math.round(r.width), h: Math.round(r.height), vw: window.innerWidth }
    box.remove()
    return out
  })
  expect(clamped.w).toBeLessThan(clamped.vw)
  expect(clamped.w).toBe(300)
  expect(clamped.h).toBe(100)
})
