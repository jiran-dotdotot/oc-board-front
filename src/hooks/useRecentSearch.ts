import { useState } from 'react'

import { RECENT_MAX } from '@/components/search/constants'
import { useMe } from '@/hooks/useMe'
import { addRecent, readRecents, writeRecents } from '@/utils/recentSearch'

/**
 * 최근 검색어. 로컬이 정본이고 서버값(GET /board/me)은 «로컬에 아무것도 없을 때»만 보여 준다 —
 * 서버는 검색 GET 마다 자동 누적하는데 프론트가 되돌릴 수 없어서(member 토큰 전용 PUT,
 * BR-012) 매번 합치면 사용자가 지운 항목이 되살아난다.
 *
 * `local === null` = 아직 이 브라우저에서 아무 조작도 없음 → 서버 시드를 그대로 보여 준다.
 * 한 번이라도 추가·삭제하면 로컬이 정본이 된다. 저장은 조작 시점에만 일어나므로
 * 렌더·effect 어디에서도 부수효과가 없다.
 */
export function useRecentSearch() {
  const { data: me } = useMe()
  const seed = me?.company_user_setting?.recent_search_keyword
  const [local, setLocal] = useState<string[] | null>(() => readRecents())
  const list = local ?? seed?.slice(0, RECENT_MAX) ?? []

  const commit = (next: string[]) => {
    writeRecents(next)
    setLocal(next)
  }

  return {
    list,
    add: (word: string) => commit(addRecent(list, word)),
    remove: (word: string) => commit(list.filter((x) => x !== word)),
    clear: () => commit([]),
  }
}
