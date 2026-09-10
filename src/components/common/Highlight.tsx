/**
 * 검색어 강조. 정본(화면 06 · 통합 앱)은 배경 없이 `--color-primary` 색만 쓰고
 * 스니펫·파일명에서만 굵기를 올린다.
 *
 * `<mark>` 를 쓰는 이유: 디자인은 span 이지만 그러면 강조가 «색 하나»로만 전달돼
 * 스크린리더에는 아무 정보가 없다. `<mark>` 는 브라우저 기본 배경을 지워도 의미가 남는다.
 *
 * ⚠ 정규식 메타문자를 반드시 escape 한다 — 레거시는 사용자 입력을 그대로 `new RegExp` 에
 *   넣고 결과를 `v-html` 로 부었다(`SearchPost.vue:24`).
 */
export function Highlight({
  text,
  q,
  bold,
}: {
  text: string
  q: string | undefined
  /** 스니펫·파일명은 굵기까지 올린다(제목은 이미 600 이라 색만). */
  bold?: boolean
}) {
  const query = (q ?? '').trim()
  if (!query) return <>{text}</>
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  const cls = `bg-transparent text-primary${bold ? ' font-semibold' : ''}`
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className={cls}>
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}
