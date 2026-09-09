import DOMPurify from 'dompurify'

/**
 * 게시글 본문(`post.content`)은 나모 에디터가 만든 **HTML 원문**이다.
 * 레거시는 Shadow DOM 에 raw `innerHTML` 로 심었다(ShadowHtmlRenderer.vue:24) — 스타일은
 * 가둬지지만 **XSS 방어는 0** 이다. Shadow DOM 은 스타일 경계지 보안 경계가 아니다.
 * 여기서는 DOMPurify 로 살균한 뒤 심는다.
 *
 * ⚠ 「본문이 화면을 덮는 것」은 여기서 막지 않는다. 예전엔 인라인 style 에서 `position` 선언을
 *   무조건 걷어냈는데, 그러면 나모 에디터의 정상 겹침 서식(`relative` 컨테이너 + `absolute` 캡션)까지
 *   깨지고 `;` 로 split 하는 방식이라 `url('a;b.png')` 같은 값도 망가졌다.
 *   대신 `.post-body { contain: paint }`(src/index.css)가 박스를 컨테이닝 블록으로 만들어
 *   fixed/absolute 자손을 «잘라낸다». 실측: 덮개 1429×729 → 300×100 으로 갇히고
 *   absolute 캡션의 지정 위치(left 20)는 그대로 유지된다.
 *
 * ⚠️ 가정: 링크를 새 탭으로 연다. 레거시는 새 탭 열기 핸들러가 iframe 시절 잔재로 죽어 있어
 *   본문 링크가 같은 탭에서 열렸다(PostView.vue:112-117 이 조작할 iframe 이 주석 처리됨).
 *   읽던 글을 잃지 않는 쪽이 낫다고 판단했다.
 */
let hooked = false

function installHooks() {
  if (hooked) return
  hooked = true

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (!(node instanceof Element)) return

    // 링크는 새 탭 + noopener — target=_blank 만 주면 열린 창이 window.opener 로 이 페이지를
    // 조작할 수 있다(tabnabbing).
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
}

export function sanitizePostHtml(html: string): string {
  installHooks()
  return DOMPurify.sanitize(html, {
    // 나모 에디터 산출물에 필요한 서식·표·이미지를 남기고 스크립트 계열을 뺀다.
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'link', 'base'],
    FORBID_ATTR: ['srcdoc', 'formaction'],
    // svg/mathml 은 본문에 쓰이지 않는데 필터 우회 벡터가 많다.
    USE_PROFILES: { html: true },
  })
}
