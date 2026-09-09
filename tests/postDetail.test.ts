import { REACTION_EMOJIS } from '@/components/board/constants'
import type { PostComment, PostLikeStat } from '@/types/post'
import { appendComment, applyToggle, mapCommentTree } from '@/utils/postCache'
import { commentChildren, countComments, reactionTotal } from '@/utils/postComments'
import { listPage } from '@/utils/postDetailState'
import { describe, expect, it } from 'vitest'

const c = (over: Partial<PostComment>): PostComment => ({
  id: 'c1',
  post_id: 'p1',
  user_id: 1,
  parent_comment_id: null,
  is_active: true,
  depth: 1,
  comment: '내용',
  created_at: '',
  updated_at: '',
  deleted_at: null,
  ...over,
})

describe('commentChildren — Go 계약의 child_comments 하나만 읽는다', () => {
  it('child_comments(docs/api/go/05-post-read.md:237)', () => {
    expect(commentChildren(c({ child_comments: [c({ id: 'k' })] }))).toHaveLength(1)
  })
  it('없으면 빈 배열 — undefined 를 흘리지 않는다', () => {
    expect(commentChildren(c({}))).toEqual([])
  })
})

describe('reactionTotal — 메타줄의 공감 총합', () => {
  it('이모지별 count 를 더한다', () => {
    const likes: PostLikeStat[] = [
      { emoji: '👍', count: 36, is_reacted: 1 },
      { emoji: '❤️', count: 4, is_reacted: 0 },
      { emoji: '😊', count: 2, is_reacted: 0 },
    ]
    expect(reactionTotal(likes)).toBe(42)
  })
  it('없으면 0 (undefined 전파 금지)', () => {
    expect(reactionTotal(undefined)).toBe(0)
  })
})

describe('countComments — 표시되는 댓글 수', () => {
  it('대댓글까지 센다', () => {
    const tree = [
      c({ id: 'a', child_comments: [c({ id: 'a1' }), c({ id: 'a2' })] }),
      c({ id: 'b' }),
    ]
    expect(countComments(tree)).toBe(4)
  })
  it('비활성 댓글도 자리표시자로 남으므로 센다', () => {
    expect(countComments([c({ is_active: false, comment: null })])).toBe(1)
  })
})

describe('REACTION_EMOJIS', () => {
  it('중복이 없다 — 같은 이모지를 두 칸으로 그리면 토글이 서로를 덮는다', () => {
    expect(new Set(REACTION_EMOJIS).size).toBe(REACTION_EMOJIS.length)
  })
})

describe('applyToggle — 공감 토글은 응답의 deleted_at 으로만 판정한다', () => {
  const stat = (emoji: string, count: number, mine: number): PostLikeStat => ({
    emoji,
    count,
    is_reacted: mine,
  })
  const make = (emoji: string): PostLikeStat => ({ emoji, count: 1, is_reacted: 1 })

  it('없던 이모지를 켜면 칩이 새로 생긴다', () => {
    expect(applyToggle([], { emoji: '👍', deleted_at: null }, make)).toEqual([
      { emoji: '👍', count: 1, is_reacted: 1 },
    ])
  })
  it('있던 이모지를 켜면 +1 이고 내 반응으로 표시된다', () => {
    expect(applyToggle([stat('👍', 3, 0)], { emoji: '👍', deleted_at: null }, make)).toEqual([
      stat('👍', 4, 1),
    ])
  })
  it('취소(deleted_at 채워짐)면 -1 이고 내 반응이 해제된다 — 취소도 200 이다', () => {
    expect(applyToggle([stat('👍', 3, 1)], { emoji: '👍', deleted_at: 'x' }, make)).toEqual([
      stat('👍', 2, 0),
    ])
  })
  it('0 건이 된 이모지는 칩에서 사라진다 — 서버 집계도 1건 이상만 준다', () => {
    expect(applyToggle([stat('👍', 1, 1)], { emoji: '👍', deleted_at: 'x' }, make)).toEqual([])
  })
  it('다른 이모지는 건드리지 않는다 — 토글 단위가 (유저 × 글 × 이모지)다', () => {
    const out = applyToggle(
      [stat('👍', 3, 1), stat('❤️', 2, 0)],
      { emoji: '👍', deleted_at: 'x' },
      make,
    )
    expect(out).toEqual([stat('👍', 2, 0), stat('❤️', 2, 0)])
  })
})

describe('mapCommentTree · appendComment — 2단 트리 패치', () => {
  it('대댓글도 찾아서 바꾼다', () => {
    const tree = [c({ id: 'a', child_comments: [c({ id: 'a1', comment: '이전' })] })]
    const out = mapCommentTree(tree, 'a1', (x) => ({ ...x, comment: '수정' }))
    expect(commentChildren(out[0])[0].comment).toBe('수정')
  })
  it('부모를 비활성으로 바꿔도 자식은 남는다 — 연쇄 삭제가 없다(07:236)', () => {
    const tree = [c({ id: 'a', child_comments: [c({ id: 'a1' })] })]
    const out = mapCommentTree(tree, 'a', (x) => ({ ...x, is_active: false, comment: null }))
    expect(out[0].is_active).toBe(false)
    expect(commentChildren(out[0])).toHaveLength(1)
  })
  it('자식 한 칸만 바뀌고 형제는 그대로다', () => {
    const tree = [c({ id: 'a', child_comments: [c({ id: 'a1' }), c({ id: 'a2' })] })]
    const out = mapCommentTree(tree, 'a1', (x) => ({ ...x, comment: '수정' }))
    expect(out[0].child_comments?.[0].comment).toBe('수정')
    expect(out[0].child_comments?.[1].comment).not.toBe('수정')
  })
  it('최상위 댓글은 꼬리에 붙는다 — 서버 정렬이 오름차순이다', () => {
    const out = appendComment([c({ id: 'a' })], c({ id: 'new' }))
    expect(out.map((x) => x.id)).toEqual(['a', 'new'])
  })
  it('답글은 부모의 자식 꼬리에 붙는다', () => {
    const out = appendComment(
      [c({ id: 'a', child_comments: [c({ id: 'a1' })] })],
      c({ id: 'r' }),
      'a',
    )
    expect(commentChildren(out[0]).map((x) => x.id)).toEqual(['a1', 'r'])
  })
})

describe('listPage — 「목록」 복귀 페이지는 «개수 설정»으로 나눈다', () => {
  it('개수 10에서 row_num 2 → 1페이지(URL 생략)', () => {
    expect(listPage(2, 10)).toBeUndefined()
  })
  it('개수 10에서 row_num 11 → 2페이지', () => {
    expect(listPage(11, 10)).toBe(2)
  })
  it('경계값 — row_num 10 은 1페이지, 11 부터 2페이지', () => {
    expect(listPage(10, 10)).toBeUndefined()
    expect(listPage(11, 10)).toBe(2)
  })
  it('같은 row_num 이라도 개수가 다르면 페이지가 다르다 — 레거시의 /10 하드코딩이 틀린 이유', () => {
    expect(listPage(15, 20)).toBeUndefined() // 20개 기준 1페이지
    expect(listPage(15, 10)).toBe(2) // 10개 기준 2페이지
    expect(listPage(45, 20)).toBe(3)
  })
  it('공지글·비활성 글은 row_num 이 1 또는 null → 1페이지', () => {
    expect(listPage(1, 10)).toBeUndefined()
    expect(listPage(null, 10)).toBeUndefined()
    expect(listPage(undefined, 10)).toBeUndefined()
  })
  it('개수가 0 이하로 들어와도 0 나누기를 하지 않는다', () => {
    expect(listPage(5, 0)).toBeUndefined()
  })
})
