import { Fragment, useState } from 'react'

import { Link, Outlet, useLocation } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { useBoardBookmarkMutation, useBookmarkedBoards } from '@/hooks/useBoards'
import { useCategories } from '@/hooks/useCategories'
import { useMe } from '@/hooks/useMe'
import { type CategoryBoard, isDriveBoard } from '@/types/category'
import { buildNavTree } from '@/utils/category'

function itemClass(active: boolean) {
  return [
    'flex h-[38px] items-center gap-2.5 rounded-lg px-3.5 text-sm',
    // 상태별 색 — 디자인 B-1 확정표.
    //   비선택: transparent / hover gray-50  / active gray-100
    //   선택  : ov-blue-50  / hover ov-blue-100 / active ov-blue-200
    active
      ? 'bg-ov-blue-50 font-semibold text-primary hover:bg-ov-blue-100 active:bg-ov-blue-200'
      : 'font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100',
  ].join(' ')
}

const SECTION_LABEL = 'px-3.5 pt-4 pb-1.5 text-2xs font-semibold tracking-[0.06em] text-gray-400'

// 공개 게시판 섹션은 카테고리 id가 없어 접힘 상태용 고정 키를 쓴다.
const PUBLIC_KEY = '__public'

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { t } = useTranslation()
  // 사이드바 게시판 트리 = GET /category (공개 게시판 + 내 카테고리). 두 번 렌더돼도 쿼리는 공유됨.
  const { data: tree } = useCategories()
  // 즐겨찾기는 트리 파생이 아니라 전용 쿼리다 — 트리는 '카테고리' 멤버십으로 필터돼서
  // 게시판 멤버로만 읽는 보드가 빠진다(boardService.selectBookmarkedBoards 주석).
  const { data: favorites = [] } = useBookmarkedBoards()
  const { mutate: toggleBookmark } = useBoardBookmarkMutation()
  const publicBoards = tree?.public_boards ?? []
  const sections = buildNavTree(tree?.categories)
  // 접힌 폴더만 기억한다(기본 펼침) — 디자인의 navFolderOpen[id] !== false 와 동일.
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const toggle = (id: string) => setClosed((c) => ({ ...c, [id]: !c[id] }))

  return (
    <>
      <Link
        to="/write"
        onClick={onNavigate}
        className="mx-1 mt-0.5 mb-3.5 flex h-11 flex-none items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-bold text-white hover:bg-ov-blue-700"
      >
        <PencilIcon />
        {t('board-write')}
      </Link>

      <Link to="/" onClick={onNavigate} className={`flex-none ${itemClass(pathname === '/')}`}>
        <HomeIcon />
        {t('nav-home')}
      </Link>

      {/* 여기만 스크롤 — 위(글쓰기·홈)와 아래(내 활동·환경 설정)는 고정.
          ⚠ 스크롤 박스와 flex 컬럼을 분리해야 한다: 스크롤 박스가 곧 flex 컨테이너면
          자식들이 flex-shrink로 눌려 버려서 넘치지 않고, 그래서 스크롤바가 생기지 않는다. */}
      <div className="scrollbar-hover min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {favorites.length > 0 && (
            <>
              <div className={SECTION_LABEL}>{t('nav-favorites')}</div>
              {favorites.map((b) => (
                <BoardNavItem
                  key={b.id}
                  board={b}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  bookmarked
                  onToggleBookmark={() => toggleBookmark(b.id)}
                />
              ))}
            </>
          )}

          {publicBoards.length > 0 && (
            <>
              <SectionToggle
                label={t('nav-public')}
                open={!closed[PUBLIC_KEY]}
                onClick={() => toggle(PUBLIC_KEY)}
              />
              <Collapse open={!closed[PUBLIC_KEY]}>
                {publicBoards.map((b) => (
                  <BoardNavItem
                    key={b.id}
                    board={b}
                    pathname={pathname}
                    onNavigate={onNavigate}
                    bookmarked={!!b.is_bookmark}
                    onToggleBookmark={() => toggleBookmark(b.id)}
                  />
                ))}
              </Collapse>
            </>
          )}

          {sections.map((s) => (
            <Fragment key={s.id}>
              <SectionToggle
                label={s.name}
                open={!closed[s.id]}
                onClick={() => toggle(s.id)}
              />
              <Collapse open={!closed[s.id]}>
                {s.folders.map((f) => (
                  <Fragment key={f.id}>
                    <button
                      type="button"
                      onClick={() => toggle(f.id)}
                      aria-expanded={!closed[f.id]}
                      className="flex h-9 items-center gap-2 rounded-lg pr-3 pl-[26px] text-s font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <FolderIcon />
                      <span className="min-w-0 flex-1 truncate text-left">{f.name}</span>
                      <CaretIcon open={!closed[f.id]} />
                    </button>
                    <Collapse open={!closed[f.id]}>
                      {f.boards.map((b) => (
                        <BoardNavItem
                          key={b.id}
                          board={b}
                          pathname={pathname}
                          onNavigate={onNavigate}
                          indent
                          bookmarked={!!b.is_bookmark}
                          onToggleBookmark={() => toggleBookmark(b.id)}
                        />
                      ))}
                    </Collapse>
                  </Fragment>
                ))}
                {s.boards.map((b) => (
                  <BoardNavItem
                    key={b.id}
                    board={b}
                    pathname={pathname}
                    onNavigate={onNavigate}
                    bookmarked={!!b.is_bookmark}
                    onToggleBookmark={() => toggleBookmark(b.id)}
                  />
                ))}
              </Collapse>
            </Fragment>
          ))}
        </div>
      </div>

      {/* 하단 고정 */}
      <div className="flex flex-none flex-col gap-0.5 pt-1">
        <Link to="/my" onClick={onNavigate} className={itemClass(pathname === '/my')}>
          <UserIcon />
          {t('nav-my')}
        </Link>
        {/* 환경 설정은 전원 노출 — 권한은 화면 안에서 탭 단위로 걸린다 */}
        <div className="mx-1.5 my-2.5 h-px bg-gray-100" />
        <Link to="/settings" onClick={onNavigate} className={itemClass(pathname === '/settings')}>
          <GearIcon />
          {t('nav-settings')}
        </Link>
      </div>
    </>
  )
}

// 카테고리 섹션 헤더 — 라벨 자체가 접기 토글.
function SectionToggle({
  label,
  open,
  onClick,
}: {
  label: string
  open: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="flex w-full items-center gap-[7px] rounded-lg pt-3.5 pr-3 pb-1.5 pl-3 text-sm font-bold text-gray-800 hover:bg-gray-50"
    >
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <CaretIcon open={open} />
    </button>
  )
}

// 높이를 재지 않는 접기 애니메이션 — grid-template-rows 0fr↔1fr 전환(네이티브 CSS).
// ⚠ 클리핑 박스(overflow-hidden)와 flex 컬럼은 반드시 분리한다. 한 요소로 합치면
// 자식들이 flex-shrink로 눌렸다 펴져서, 위에서 밀려나오는 대신 크기가 배분되는 느낌이 난다.
// ⚠ 세로선(rail)은 폐기했다 — 디자인 B-3 확정: «들여쓰기만»으로 계층을 표시한다.
//   카테고리 12 › 폴더 26 › 폴더 안 항목 42px (카테고리 직속 항목은 26px).
//   폴더 안 폴더는 IA 상 없으므로 3단 초과 규칙은 두지 않는다.
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={[
        'grid transition-[grid-template-rows] duration-200 ease-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      ].join(' ')}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="flex flex-col gap-px pb-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// 사이드바 게시판 한 줄. 자료실(is_drive/type=DRIVE)이면 /drive, 아니면 /board/{uuid}로 간다.
// 즐겨찾기는 우측 리본 토글 하나로 통일한다 — 등록·해제가 같은 자리·같은 아이콘·같은 클릭이고
// 상태는 채움(text-warning)/비움(gray-400)으로만 갈린다. (CLAUDE.md UI verb-unification)
function BoardNavItem({
  board,
  pathname,
  onNavigate,
  indent,
  bookmarked,
  onToggleBookmark,
}: {
  board: CategoryBoard
  pathname: string
  onNavigate?: () => void
  indent?: boolean // 폴더(하위 카테고리) 안의 게시판
  bookmarked?: boolean
  onToggleBookmark?: () => void
}) {
  const { t } = useTranslation()
  // 자료실은 경로가 전부 /drive 고 게시판은 ?b=<id> 로만 갈린다 —
  // pathname 만 보면 /drive 에 있는 동안 사이드바의 모든 자료실이 활성으로 칠해진다.
  const { searchStr } = useLocation()
  const drive = isDriveBoard(board)
  const active = drive
    ? pathname === '/drive' && new URLSearchParams(searchStr).get('b') === board.id
    : pathname === `/board/${board.id}`
  // 디자인 B-3 들여쓰기 단계: 카테고리 12 › 폴더 26 › 폴더 안 항목 42.
  // 카테고리 직속 항목은 26px(폴더와 같은 단), 폴더 안 항목만 42px.
  const pad = indent ? ' pl-[42px]' : ' pl-[26px]'
  // ★ 링크가 «칠해지는 영역 그 자체»여야 한다. 배경만 있는 래퍼 안에 링크를 넣으면
  //   좌우 패딩(14px)과 위아래 여백이 클릭·hover 불가 사각지대가 된다.
  //   즐겨찾기 버튼은 a > button 중첩을 피하려고 형제로 겹쳐 올린다(아래 relative).
  // pr-[38px]: 버튼 자리 확보 = 우측 8px + 버튼 20px + 제목과의 간격 10px.
  const rowClass = itemClass(active) + pad + (onToggleBookmark ? ' pr-[38px]' : '')
  const inner = (
    <>
      {drive ? <DriveIcon /> : <BoardIcon />}
      <span className="min-w-0 flex-1 truncate text-left">{board.title}</span>
    </>
  )
  const link = drive ? (
    <Link to="/drive" search={{ b: board.id }} onClick={onNavigate} className={rowClass}>
      {inner}
    </Link>
  ) : (
    <Link
      to="/board/$boardId"
      params={{ boardId: board.id }}
      onClick={onNavigate}
      className={rowClass}
    >
      {inner}
    </Link>
  )
  if (!onToggleBookmark) return link
  const label = t(bookmarked ? 'nav-favorite-remove' : 'nav-favorite-add')
  return (
    <div className="group relative">
      {link}
      <button
        type="button"
        onClick={onToggleBookmark}
        aria-label={label}
        aria-pressed={bookmarked}
        title={label}
        // 등록된 행은 항상 보이고(트리에서 한눈에 구분), 아닌 행은 hover/포커스에만 뜬다.
        className={[
          'absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md hover:bg-gray-200',
          bookmarked
            ? 'text-warning'
            : 'text-gray-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        ].join(' ')}
      >
        <BookmarkIcon filled={bookmarked} />
      </button>
    </div>
  )
}

// 트리 셰브런 — 행 «우측»에 놓이고 펼치면 180° 뒤집힌다 (디자인 B-3 확정).
function CaretIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={[
        'size-3 flex-none text-gray-400 transition-transform duration-200',
        open ? 'rotate-180' : '',
      ].join(' ')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg
      className="size-[15px] flex-none text-warning"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2.5H19A1.5 1.5 0 0 1 20.5 9.5v9A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5z" />
    </svg>
  )
}

function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={`tracking-[-0.01em] ${className ?? ''}`}>
      <span className="font-semibold text-ov-blue-400">Office</span>
      <span className="font-extrabold text-primary">NEXT</span>
    </Link>
  )
}

export function AppShell() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  // 모바일 드로어가 떠 있는 동안 배경 스크롤 잠금(중첩은 참조 카운팅)
  useBodyScrollLock(drawerOpen)
  // 로그인 후 셸 진입 시 /me 호출 → 사용자 정보(프로필 표시)
  const { data: me } = useMe()
  const meName = me?.name ?? ''
  const meEmail = me?.email ?? ''
  const meInitial = meName.charAt(0)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* ── 톱바 ── */}
      <header className="sticky top-0 z-[var(--z-shell)] border-b border-gray-200 bg-card">
        {/* 모바일 */}
        <div className="flex h-[54px] items-center gap-3 px-3 min-[631px]:hidden">
          <button
            type="button"
            aria-label={t('nav-menu')}
            onClick={() => setDrawerOpen(true)}
            className="inline-flex size-[34px] flex-none items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
          >
            <MenuIcon />
          </button>
          <Logo className="flex-none text-base" />
          <div className="ml-auto flex flex-none items-center gap-0.5">
            <Link
              to="/search"
              aria-label={t('common-search')}
              className="inline-flex size-[34px] items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
            >
              <SearchIcon className="size-[17px]" />
            </Link>
            <ThemeToggle />
            <span className="ml-1 inline-flex size-[30px] items-center justify-center rounded-full bg-l-blue text-xs font-bold text-on-pastel">
              {meInitial}
            </span>
          </div>
        </div>

        {/* 데스크톱 */}
        <div className="hidden h-(--spacing-topbar) items-center gap-[18px] px-5 min-[631px]:flex">
          <Logo className="flex-none text-lg" />
          <div className="flex h-10 w-[340px] items-center gap-2 rounded-[5px] bg-gray-100 py-0 pr-1.5 pl-3">
            <SearchIcon className="size-[15px] flex-none text-gray-400" />
            <input
              placeholder={t('nav-search-placeholder')}
              className="min-w-0 flex-1 border-none bg-transparent text-sm outline-none"
            />
            <Link
              to="/search"
              className="inline-flex h-7 flex-none items-center rounded bg-primary px-2.5 text-xs font-semibold text-white hover:bg-ov-blue-700"
            >
              {t('common-search')}
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 hover:bg-gray-100 aria-expanded:bg-gray-100"
                aria-expanded={profileOpen}
              >
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-l-blue text-s font-bold text-on-pastel">
                  {meInitial}
                </span>
                <span className="text-s font-semibold whitespace-nowrap text-gray-800">
                  {meName}
                </span>
                <ChevronDownIcon />
              </button>
              {profileOpen && (
                <div className="absolute top-[calc(100%+4px)] right-0 z-[var(--z-dropdown)] w-[200px] rounded-lg border border-gray-200 bg-card p-1 shadow-[0_4px_8px_rgba(0,0,0,0.1)]">
                  <div className="flex flex-col gap-px border-b border-gray-100 px-2.5 pt-2 pb-1.5">
                    <span className="text-s font-bold">{meName}</span>
                    <span className="text-xs text-gray-400">{meEmail}</span>
                  </div>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-gray-800 hover:bg-gray-100"
                  >
                    <UserIcon className="size-3.5" />
                    {t('nav-my')}
                  </button>
                  <div className="border-t border-gray-100 px-2.5 py-1.5">
                    <LanguageSwitcher />
                  </div>
                  <Link
                    to="/login"
                    onClick={() => setProfileOpen(false)}
                    className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-gray-800 hover:bg-gray-100"
                  >
                    <LogoutIcon />
                    {t('nav-logout')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── 본문(사이드바 + 콘텐츠) ── */}
      {/* 데스크탑은 톱바(58px + border 1px) 아래를 뷰포트 높이로 고정 — 사이드바/본문이 각자 스크롤한다.
          ⚠ flex-none 필수: 부모가 flex-col이라 flex-1(=flex-basis:0)이 height보다 우선해 높이 제약이 무시된다.
          모바일(<631px)은 기존대로 페이지 전체 스크롤. */}
      <div className="flex flex-1 min-[631px]:h-[calc(100svh-59px)] min-[631px]:flex-none min-[631px]:overflow-hidden">
        <aside className="hidden h-full w-(--spacing-sidebar) flex-none flex-col gap-0.5 border-r border-gray-200 px-2.5 py-3.5 min-[631px]:flex">
          <SidebarNav pathname={pathname} />
        </aside>
        <main className="min-w-0 flex-1 p-5 pb-[76px] min-[631px]:overflow-y-auto min-[631px]:p-6 min-[631px]:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ── 모바일 하단 탭 ── */}
      <nav className="fixed inset-x-0 bottom-0 z-[var(--z-shell)] flex h-[58px] border-t border-gray-200 bg-card min-[631px]:hidden">
        <BottomTab to="/" active={pathname === '/'} icon={<HomeIcon />} label={t('nav-home')} />
        <BottomTab
          to="/board/notice"
          active={pathname.startsWith('/board')}
          icon={<BoardIcon />}
          label={t('nav-board')}
        />
        <BottomTab
          to="/drive"
          active={pathname === '/drive'}
          icon={<DriveIcon />}
          label={t('nav-drive')}
        />
        <BottomTab to="/my" active={pathname === '/my'} icon={<UserIcon />} label={t('nav-my')} />
      </nav>

      {/* ── 모바일 드로어 ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[var(--z-sheet)] min-[631px]:hidden">
          <button
            type="button"
            aria-label="close"
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-card">
            <div className="flex items-center gap-2.5 border-b border-gray-200 p-4">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-l-blue text-s font-bold text-on-pastel">
                {meInitial}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold">{meName}</span>
                <span className="truncate text-xs text-gray-400">{meEmail}</span>
              </div>
              <button
                type="button"
                aria-label="close"
                onClick={() => setDrawerOpen(false)}
                className="ml-auto inline-flex size-8 flex-none items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-0.5 px-2.5 py-3.5">
              <SidebarNav pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BottomTab({
  to,
  active,
  icon,
  label,
}: {
  to?: string
  active: boolean
  icon: React.ReactNode
  label: string
}) {
  const cls = `flex flex-1 flex-col items-center justify-center gap-1 text-2xs ${active ? 'font-semibold text-primary' : 'text-gray-500'}`
  return to ? (
    <Link to={to} className={cls}>
      {icon}
      {label}
    </Link>
  ) : (
    <button type="button" className={cls}>
      {icon}
      {label}
    </button>
  )
}

function ThemeToggle() {
  const { t } = useTranslation()
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )
  return (
    <button
      type="button"
      aria-label={t('nav-theme')}
      onClick={() =>
        setDark((v) => {
          const next = !v
          document.documentElement.classList.toggle('dark', next)
          try {
            localStorage.setItem('theme', next ? 'dark' : 'light')
          } catch {
            /* localStorage 불가 환경 무시 */
          }
          return next
        })
      }
      className="inline-flex size-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

/* ── 인라인 아이콘 (디자인 그대로) ── */
type IconProps = { className?: string }
const base = 'size-[17px] flex-none'

function PencilIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-[15px] flex-none'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 15.5V20h4.5L19 9.5 14.5 5z" />
    </svg>
  )
}
function HomeIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? base}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 11l9-7 9 7" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  )
}
// 즐겨찾기 리본. filled=등록됨(채움) / 아니면 외곽선만.
function BookmarkIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      className="size-[13px] flex-none"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 3.5h11V21L12 17l-5.5 4z" />
    </svg>
  )
}
function BoardIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? base}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5" />
    </svg>
  )
}
function DriveIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? base}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 13.5L6 5.5h12l2.5 8" />
      <rect x="3.5" y="13.5" width="17" height="5.5" rx="1.5" />
      <path d="M16.5 16.2h.01M13.5 16.2h.01" />
    </svg>
  )
}
function UserIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? base}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  )
}
function GearIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? base}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" />
    </svg>
  )
}
function SearchIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? base}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8L21 21" />
    </svg>
  )
}
function MenuIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
function ChevronDownIcon() {
  return (
    <svg
      className="size-[13px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-gray-400)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
function LogoutIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 4.5H5.5v15H9" />
      <path d="M13 8l4 4-4 4M17 12H8.5" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg
      className="size-[17px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" />
    </svg>
  )
}
function SunIcon() {
  return (
    <svg
      className="size-[17px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
    </svg>
  )
}
