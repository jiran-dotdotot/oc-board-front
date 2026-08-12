import { BoardList } from '@/components/board/BoardList'
import i18n from '@/lib/i18n'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

describe('BoardList', () => {
  // 언어 감지가 환경 언어로 해석될 수 있으므로 ko로 고정해 결정적으로 검증.
  beforeEach(async () => {
    await i18n.changeLanguage('ko')
  })

  it('기본 언어(ko)로 게시글 목록 제목을 렌더링한다', () => {
    render(<BoardList />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('게시글 목록')
  })
})
