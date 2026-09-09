import { initial, pastel } from '@/utils/avatar'

/**
 * 이름 이니셜 아바타. 목록·상세·댓글·내역 모달이 «같은 사람을 같은 색·같은 글자 크기»로 그린다.
 * 지름만 호출부가 정한다(정본: 상세 34 · 댓글 32 · 답글 26 · 내역 30).
 * `l-*` 파스텔 위 글자는 반드시 `text-on-pastel` 이다 — 다크 오버라이드가 없다.
 */
export function Avatar({ name, size }: { name?: string; size: string }) {
  return (
    <span
      className={`inline-flex ${size} flex-none items-center justify-center rounded-full text-s font-bold text-on-pastel ${pastel(name ?? '?')}`}
    >
      {initial(name)}
    </span>
  )
}
