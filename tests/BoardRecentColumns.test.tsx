import { BoardView } from '@/components/board/BoardListScreen'
import type { BoardRow } from '@/components/board/listData'
import i18n from '@/lib/i18n'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

const row: BoardRow = {
  id: 'p1',
  title: '주간 업무 공유',
  board: '자유게시판',
  author: '이서연',
  authorInitial: '이',
  avatarBg: 'bg-l-green',
  date: '2026.08.12',
  views: 96,
  likes: 8,
  comments: 0,
  notice: false,
  read: true,
  bookmarked: false,
  hasFile: false,
  snippet: '',
  hasThumb: false,
  thumbBg: 'bg-l-blue',
}

const noop = () => {}
const ctx = { open: noop, onBm: noop, onCopy: noop }
const base = {
  rows: [row],
  ctx,
  notices: [],
  hiddenCount: 0,
  expanded: false,
  onToggleNotices: noop,
}

describe('BoardView 위치 컬럼', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ko')
  })

  it('전체 목록(showBoard)에서는 위치 헤더와 게시판명을 보여준다', () => {
    render(<BoardView {...base} showBoard />)
    expect(screen.getByText('위치')).toBeInTheDocument()
    // 데스크톱 셀 + 모바일 메타 한 줄 두 곳에 게시판명이 들어간다
    expect(screen.getAllByText(/자유게시판/).length).toBeGreaterThan(0)
  })

  it('게시판 목록에서는 위치 컬럼이 없다', () => {
    render(<BoardView {...base} showBoard={false} />)
    expect(screen.queryByText('위치')).not.toBeInTheDocument()
    expect(screen.queryByText(/자유게시판/)).not.toBeInTheDocument()
  })
})
