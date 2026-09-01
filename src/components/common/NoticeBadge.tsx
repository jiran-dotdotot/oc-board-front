import { useTranslation } from 'react-i18next'

/**
 * 공지 뱃지. 목록·홈·상세·내활동에 각각 인라인 복제돼 있던 것을 하나로 합쳤다
 * (높이가 19/20/22px 로, 글자색이 제각각으로 갈라져 있었다).
 *
 * 글자색은 `text-primary-pastel` — 정본표가 이 토큰을 정확히 「파스텔 배경 위 primary
 * 텍스트 (l-blue 칩 등)」 용도로 정의한다. `text-primary` 를 쓰면 안 된다:
 * `l-blue` 는 다크 오버라이드가 없는 «고정» 파스텔인데 `primary` 는 다크에서 밝아져
 * 밝은 배경 위 밝은 글자가 된다.
 */
export function NoticeBadge() {
  const { t } = useTranslation()
  return (
    <span className="inline-flex h-5 flex-none items-center rounded bg-l-blue px-[7px] text-2xs font-bold text-primary-pastel">
      {t('badge-notice')}
    </span>
  )
}
