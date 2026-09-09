import { PostAttachments } from '@/components/board/PostAttachments'
import { type CommentActions, PostComments } from '@/components/board/PostComments'
import { PostReactions } from '@/components/board/PostReactions'
import i18n from '@/lib/i18n'
import type { PostComment, PostFile } from '@/types/post'
import { blockedKind } from '@/utils/postDetailState'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(async () => {
  await i18n.changeLanguage('ko')
})

const noop = () => {}
const comment = (over: Partial<PostComment>): PostComment => ({
  id: 'c1',
  post_id: 'p1',
  user_id: 1,
  parent_comment_id: null,
  is_active: true,
  depth: 1,
  comment: '본문 댓글',
  created_at: '2026-08-03T05:32:00.000000Z',
  updated_at: '',
  deleted_at: null,
  user: { id: 1, name: '이서연' },
  ...over,
})
const ok = async () => true
/** 수정·삭제·공감 내역은 ⋮ 메뉴 안에 있다 — 열고 나서 항목을 집는다. */
const openMenu = (name = '이서연') =>
  fireEvent.click(screen.getByRole('button', { name: `${name}님의 댓글 메뉴` }))
const actions = (over: Partial<CommentActions> = {}): CommentActions => ({
  onAdd: ok,
  onEdit: ok,
  onDelete: noop,
  onReact: noop,
  onHistory: noop,
  allowed: true,
  reactAllowed: true,
  isAdmin: false,
  busy: false,
  ...over,
})

describe('blockedKind — 볼 수 없는 글 판정', () => {
  it('404 는 없는 글', () => expect(blockedKind(404, 'ACT')).toBe('not-found'))
  it('200 인데 state=DEL 도 없는 글 — soft delete 가 아니라 상태 전환이라 200 이 온다', () =>
    expect(blockedKind(undefined, 'DEL')).toBe('not-found'))
  it('403 은 권한 없음', () => expect(blockedKind(403, 'ACT')).toBe('forbidden'))
  it('500 은 재시도 대상 — 차단이 아니다', () => expect(blockedKind(500, 'ACT')).toBeNull())
})

// sanitizePostHtml 검증은 tests/e2e/post-sanitize.spec.ts(실브라우저)에 있다.
// happy-dom 에서는 DOMPurify 가 `isSupported: true` 를 보고하면서도 결과가 틀리다
// (실측: '<p>a</p><script>x</script>' → 'a<script>x</script>' — script 가 살아남는다).
// 보안 경로를 «조용히 통과하는» 환경에서 검증하면 안 되므로 실브라우저로 옮겼다.

describe('PostComments — 정본 구조와 레거시 파리티', () => {
  it('삭제된 댓글은 숨기지 않고 자리표시자로 남고, 자식 답글은 그대로 렌더된다', () => {
    render(
      <PostComments
        comments={[
          comment({
            id: 'p',
            is_active: false,
            comment: null,
            child_comments: [comment({ id: 'ch', comment: '살아있는 답글' })],
          }),
        ]}
        actions={actions()}
      />,
    )
    expect(screen.getByText('삭제된 댓글입니다.')).toBeInTheDocument()
    expect(screen.getByText('살아있는 답글')).toBeInTheDocument()
  })

  it('댓글 수는 대댓글까지 센다', () => {
    render(
      <PostComments
        comments={[comment({ id: 'a', child_comments: [comment({ id: 'a1' })] })]}
        actions={actions()}
      />,
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('대댓글에는 답글 버튼이 없다 — 서버는 더 깊게 받지만 상세 트리는 2단만 채운다', () => {
    render(
      <PostComments
        comments={[comment({ id: 'a', child_comments: [comment({ id: 'a1' })] })]}
        actions={actions()}
      />,
    )
    expect(screen.getAllByRole('button', { name: '답글 달기' })).toHaveLength(1)
  })

  it('내 댓글이 아니면 수정이 없고, 관리자면 삭제는 보인다', () => {
    render(
      <PostComments
        comments={[comment({ is_mine: false })]}
        actions={actions({ isAdmin: true })}
      />,
    )
    openMenu()
    expect(screen.queryByRole('button', { name: '수정' })).toBeNull()
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
  })

  it('댓글 미허용 게시글이면 입력 대신 안내를 띄운다 — 보내도 400 이다', () => {
    render(<PostComments comments={[]} actions={actions({ allowed: false })} />)
    expect(screen.getByText('이 게시글은 댓글을 받지 않습니다.')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('댓글을 입력해주세요.')).toBeNull()
  })

  it('빈 입력이면 등록이 비활성 — 서버에 validator 가 없어 빈 문자열이 저장된다', () => {
    render(<PostComments comments={[]} actions={actions()} />)
    expect(screen.getByRole('button', { name: '등록' })).toBeDisabled()
  })
})

describe('PostReactions — 상태를 색만으로 전하지 않는다', () => {
  it('내가 누른 칩은 aria-pressed=true 다 (WCAG 1.4.1)', () => {
    render(
      <PostReactions
        likes={[
          { emoji: '👍', count: 36, is_reacted: 1 },
          { emoji: '❤️', count: 4, is_reacted: 0 },
        ]}
        onToggle={noop}
        onHistory={noop}
        busy={false}
      />,
    )
    expect(screen.getByRole('button', { name: '👍 공감 취소' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '❤️ 공감하기' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('반응이 0건이어도 「+」로 새로 누를 수 있다 — 서버는 세트를 주지 않는다', () => {
    render(<PostReactions likes={[]} onToggle={noop} onHistory={noop} busy={false} />)
    expect(screen.getByRole('button', { name: '공감 추가' })).toBeEnabled()
  })
})

describe('PostAttachments — 정본 3행 + 모두 보기', () => {
  const file = (i: number): PostFile => ({
    id: `f${i}`,
    src: `key/${i}`,
    origin_file_name: `문서${i}.pdf`,
    extension: 'pdf',
    size: 1024,
  })

  it('3행까지만 보이고 나머지는 「외 N개 모두 보기」로 접힌다', () => {
    render(<PostAttachments files={[1, 2, 3, 4, 5].map(file)} onDownload={noop} onPreview={noop} />)
    expect(screen.getByText('문서3.pdf')).toBeInTheDocument()
    expect(screen.queryByText('문서4.pdf')).toBeNull()
    expect(screen.getByRole('button', { name: /외 2개 모두 보기/ })).toBeInTheDocument()
  })

  // 레거시 PostView.vue:435 의 눈 아이콘 — 내려받지 않고 보는 유일한 경로다.
  it('행의 미리보기 버튼이 그 파일을 넘긴다', () => {
    const onPreview = vi.fn()
    render(<PostAttachments files={[file(1)]} onDownload={noop} onPreview={onPreview} />)
    fireEvent.click(screen.getByRole('button', { name: '미리보기' }))
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1' }))
  })

  it('첨부가 없으면 박스를 그리지 않는다', () => {
    const { container } = render(<PostAttachments files={[]} onDownload={noop} onPreview={noop} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('여러 건을 한 번에 넘긴다 — zip 판정은 훅이 files.length 로 한다(레거시 파리티)', () => {
    const onDownload = vi.fn()
    render(<PostAttachments files={[file(1), file(2)]} onDownload={onDownload} onPreview={noop} />)
    screen.getByRole('button', { name: '전체 다운로드' }).click()
    expect(onDownload).toHaveBeenCalledWith([file(1), file(2)])
  })
})

describe('CommentInput — 전송 실패 시 입력값을 지키지 않으면 사용자가 쓴 글이 사라진다', () => {
  it('실패(false)면 입력값이 그대로 남는다', async () => {
    render(<PostComments comments={[]} actions={actions({ onAdd: async () => false })} />)
    const input = screen.getByPlaceholderText('댓글을 입력해주세요.')
    fireEvent.change(input, { target: { value: '오래 쓴 댓글' } })
    fireEvent.click(screen.getByRole('button', { name: '등록' }))
    await waitFor(() => expect(input).toHaveValue('오래 쓴 댓글'))
  })

  it('성공(true)이면 비운다', async () => {
    render(<PostComments comments={[]} actions={actions()} />)
    const input = screen.getByPlaceholderText('댓글을 입력해주세요.')
    fireEvent.change(input, { target: { value: '보낼 댓글' } })
    fireEvent.click(screen.getByRole('button', { name: '등록' }))
    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('수정이 실패하면 편집창이 닫히지 않는다 — 닫히면 수정 전 텍스트까지 사라진다', async () => {
    render(
      <PostComments
        comments={[comment({ is_mine: true, comment: '원래 내용' })]}
        actions={actions({ onEdit: async () => false })}
      />,
    )
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: '수정' }))
    const editor = await screen.findByPlaceholderText('댓글 수정 중')
    fireEvent.change(editor, { target: { value: '고친 내용' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(screen.getByPlaceholderText('댓글 수정 중')).toHaveValue('고친 내용'),
    )
  })

  it('등록 버튼은 진행 중에도 disabled 가 되지 않는다 — 초점을 쥔 버튼이 꺼지면 초점이 body 로 떨어진다', () => {
    render(<PostComments comments={[]} actions={actions({ busy: true })} />)
    const input = screen.getByPlaceholderText('댓글을 입력해주세요.')
    fireEvent.change(input, { target: { value: 'x' } })
    expect(screen.getByRole('button', { name: '등록' })).toBeEnabled()
  })
})

describe('PostAttachments 전체 모달 — 정본 구조(:1507-1540)', () => {
  const file = (i: number, ext: string | undefined = 'pdf'): PostFile => ({
    id: `f${i}`,
    src: `key/${i}`,
    origin_file_name: ext ? `문서${i}.${ext}` : `Makefile`,
    extension: ext,
    size: 1024,
  })
  const openAll = (files: PostFile[]) => {
    render(<PostAttachments files={files} onDownload={noop} onPreview={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /모두 보기/ }))
  }

  it('「전체 선택」이 «화면에 보이는 글자»다 — aria-label 로만 넣으면 눈으로 알 수 없다', () => {
    openAll([1, 2, 3, 4].map((i) => file(i)))
    expect(screen.getByText('첨부 전체 선택')).toBeVisible()
  })

  it('행 전체가 토글이고 접근 이름이 파일명이다 — 정본은 행 클릭으로 선택한다', () => {
    openAll([1, 2, 3, 4].map((i) => file(i)))
    const row = screen.getByRole('checkbox', { name: '문서4.pdf' })
    expect(row).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(row)
    expect(screen.getByRole('checkbox', { name: '문서4.pdf' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('구분선이 «마지막 행만» 없다 — last:border-b-0 은 모든 행에 걸려 선이 전멸했다', () => {
    openAll([1, 2, 3, 4].map((i) => file(i)))
    const rows = [1, 2, 3, 4].map(
      (i) => screen.getByRole('checkbox', { name: `문서${i}.pdf` }).parentElement!,
    )
    expect(rows.slice(0, 3).every((r) => r.className.includes('border-b'))).toBe(true)
    expect(rows[3].className.includes('border-b')).toBe(false)
  })

  it('선택 다운로드는 고른 것만 넘긴다', () => {
    const onDownload = vi.fn()
    render(
      <PostAttachments
        files={[1, 2, 3, 4].map((i) => file(i))}
        onDownload={onDownload}
        onPreview={noop}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /모두 보기/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: '문서2.pdf' }))
    fireEvent.click(screen.getByRole('button', { name: /선택 다운로드/ }))
    expect(onDownload).toHaveBeenCalledWith([file(2)])
  })

  it('확장자가 없는 파일 칩에는 「파일」이 찍힌다 — 「다운로드」가 아니다', () => {
    // ⚠ 기본 매개변수는 undefined 를 넘기면 «기본값»이 적용된다 → 객체를 직접 만든다.
    const noExt: PostFile = { id: 'f9', src: 'k/9', origin_file_name: 'Makefile' }
    render(<PostAttachments files={[noExt]} onDownload={noop} onPreview={noop} />)
    expect(screen.getByText('파일')).toBeInTheDocument()
    expect(screen.queryByText('다운로드')).toBeNull()
  })

  it('파일별 다운로드 버튼 이름에 파일명이 들어간다 — 이름 없는 아이콘 버튼 금지(WCAG 4.1.2)', () => {
    render(<PostAttachments files={[file(1)]} onDownload={noop} onPreview={noop} />)
    expect(screen.getByRole('button', { name: '문서1.pdf 이 파일만 다운로드' })).toBeInTheDocument()
  })
})

describe('댓글 이모지 피커 — 게시글과 같은 고정 세트를 쓴다(M-9)', () => {
  it('댓글 행에 「+」가 있고 세트에서 고르면 그 댓글에 반응이 간다', () => {
    const onReact = vi.fn()
    render(<PostComments comments={[comment({ id: 'c9' })]} actions={actions({ onReact })} />)
    fireEvent.click(screen.getByRole('button', { name: '공감 추가' }))
    fireEvent.click(screen.getByRole('button', { name: '🎉 공감하기' }))
    expect(onReact).toHaveBeenCalledWith('c9', '🎉')
  })

  it('공감 불가 글에서는 「+」를 아예 렌더하지 않는다 — 눌러도 403 이다', () => {
    render(<PostComments comments={[comment({})]} actions={actions({ reactAllowed: false })} />)
    expect(screen.queryByRole('button', { name: '공감 추가' })).toBeNull()
  })

  // 서버는 공감에서 게시글 state 를 검사하지 않는다(docs/api/go/07-post-comment-like.md:356) —
  // 숨김 글이라 «댓글 작성»은 막혀도 공감·취소는 열려 있어야 한다.
  it('숨김 글(작성 불가)이어도 공감은 열려 있다', () => {
    render(
      <PostComments
        comments={[comment({})]}
        actions={actions({ allowed: false, reactAllowed: true })}
      />,
    )
    expect(screen.getByRole('button', { name: '공감 추가' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /공감하기|공감 취소/ })).not.toHaveProperty(
      'disabled',
      true,
    )
  })

  it('이미 누른 이모지는 팝오버에서도 aria-pressed=true 다', () => {
    render(
      <PostComments
        comments={[
          comment({ likes: [{ comment_id: 'c1', emoji: '🎉', count: 1, is_reacted: 1 }] }),
        ]}
        actions={actions()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '공감 추가' }))
    // 행의 집계 칩과 팝오버 안 버튼 «둘 다» 눌린 상태로 보여야 한다
    const pressed = screen.getAllByRole('button', { name: '🎉 공감 취소' })
    expect(pressed).toHaveLength(2)
    expect(pressed.every((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true)
  })
})

describe('IME 조합 중 Escape — 작성 중인 본문을 버리지 않는다', () => {
  it('조합 중(isComposing) ESC 는 편집창을 닫지 않는다', () => {
    render(
      <PostComments
        comments={[comment({ is_mine: true, comment: '원래 내용' })]}
        actions={actions()}
      />,
    )
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: '수정' }))
    const editor = screen.getByPlaceholderText('댓글 수정 중')
    fireEvent.change(editor, { target: { value: '고치는 중인 긴 내용' } })
    fireEvent.keyDown(editor, { key: 'Escape', isComposing: true })
    expect(screen.getByPlaceholderText('댓글 수정 중')).toHaveValue('고치는 중인 긴 내용')
  })

  it('조합이 끝난 뒤 ESC 는 정상적으로 닫는다', () => {
    render(
      <PostComments
        comments={[comment({ is_mine: true, comment: '원래 내용' })]}
        actions={actions()}
      />,
    )
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: '수정' }))
    const editor = screen.getByPlaceholderText('댓글 수정 중')
    fireEvent.keyDown(editor, { key: 'Escape', isComposing: false })
    expect(screen.queryByPlaceholderText('댓글 수정 중')).toBeNull()
  })

  it('조합 중 Enter 도 등록하지 않는다 (기존 가드 회귀 방지)', () => {
    const onAdd = vi.fn(async () => true)
    render(<PostComments comments={[]} actions={actions({ onAdd })} />)
    const input = screen.getByPlaceholderText('댓글을 입력해주세요.')
    fireEvent.change(input, { target: { value: '한글' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(onAdd).not.toHaveBeenCalled()
  })
})

describe('공감 줄 — 고정 세트를 «항상» 그린다(정본 4칩, 0 포함)', () => {
  it('반응이 0건인 글도 고정 4칩이 보인다 — 서버는 0 카운트를 주지 않는다', () => {
    render(<PostReactions likes={[]} onToggle={noop} onHistory={noop} busy={false} />)
    for (const e of ['👍', '❤️', '😊', '🎉']) {
      expect(screen.getByRole('button', { name: `${e} 공감하기` })).toHaveTextContent('0')
    }
  })

  it('서버 값이 있으면 그 카운트로 덮고, 세트 밖 이모지는 뒤에 이어 붙는다', () => {
    render(
      <PostReactions
        likes={[
          { emoji: '👍', count: 36, is_reacted: 1 },
          { emoji: '🔥', count: 7, is_reacted: 0 },
        ]}
        onToggle={noop}
        onHistory={noop}
        busy={false}
      />,
    )
    expect(screen.getByRole('button', { name: '👍 공감 취소' })).toHaveTextContent('36')
    expect(screen.getByRole('button', { name: '❤️ 공감하기' })).toHaveTextContent('0')
    // 세트 밖 이모지도 사라지지 않는다
    expect(screen.getByRole('button', { name: '🔥 공감하기' })).toHaveTextContent('7')
  })
})

describe('댓글 ⋮ 메뉴 — 행 버튼을 접는다', () => {
  it('수정·삭제·공감 내역은 ⋮ 를 열어야 나온다', () => {
    render(
      <PostComments
        comments={[
          comment({
            is_mine: true,
            likes: [{ comment_id: 'c1', emoji: '❤️', count: 1, is_reacted: 0 }],
          }),
        ]}
        actions={actions()}
      />,
    )
    expect(screen.queryByRole('button', { name: '수정' })).toBeNull()
    expect(screen.queryByRole('button', { name: '삭제' })).toBeNull()
    openMenu()
    expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '공감 내역' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
  })

  it('하트와 답글은 행에 그대로 남는다', () => {
    render(<PostComments comments={[comment({})]} actions={actions()} />)
    expect(screen.getByRole('button', { name: '❤️ 공감하기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '답글 달기' })).toBeInTheDocument()
  })

  it('권한이 하나도 없으면 ⋮ 자체를 그리지 않는다', () => {
    render(
      <PostComments
        comments={[comment({ is_mine: false })]}
        actions={actions({ isAdmin: false })}
      />,
    )
    expect(screen.queryByRole('button', { name: /댓글 메뉴/ })).toBeNull()
  })
})

describe('첨부 전체 모달 — ESC 로 닫힌다', () => {
  it('공용 Modal 은 ESC 를 호출부에 맡기므로 여기서 처리해야 한다', async () => {
    const f = (i: number): PostFile => ({
      id: `f${i}`,
      src: `k/${i}`,
      origin_file_name: `문서${i}.pdf`,
      extension: 'pdf',
      size: 1024,
    })
    render(<PostAttachments files={[1, 2, 3, 4].map(f)} onDownload={noop} onPreview={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /모두 보기/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
