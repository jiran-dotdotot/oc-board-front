import { Fragment, useState } from 'react'

import { Link, Outlet, useLocation } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { useCategories } from '@/hooks/useCategories'
import { useMe } from '@/hooks/useMe'
import { type CategoryBoard, isDriveBoard } from '@/types/category'
import { buildNavTree, favoriteBoards } from '@/utils/category'

function itemClass(active: boolean) {
  return [
    'flex h-10 items-center gap-2.5 rounded-lg px-3.5 text-sm',
    active ? 'bg-accent font-semibold text-primary' : 'font-medium text-gray-700 hover:bg-gray-50',
  ].join(' ')
}

const SECTION_LABEL = 'px-3.5 pt-4 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-gray-400'

// 공개 게시판 섹션은 카테고리 id가 없어 접힘 상태용 고정 키를 쓴다.
const PUBLIC_KEY = '__public'

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { t } = useTranslation()
  // 사이드바 게시판 트리 = GET /category (공개 게시판 + 내 카테고리). 두 번 렌더돼도 쿼리는 공유됨.
  const { data: tree } = useCategories()
  const favorites = favoriteBoards(tree)
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
                  star
                />
              ))}
            </>
          )}

          {publicBoards.length > 0 && (
            <>
              <SectionToggle
                label={`${t('nav-category')} · ${t('nav-public')}`}
                open={!closed[PUBLIC_KEY]}
                onClick={() => toggle(PUBLIC_KEY)}
              />
              <Collapse open={!closed[PUBLIC_KEY]} rail>
                {publicBoards.map((b) => (
                  <BoardNavItem key={b.id} board={b} pathname={pathname} onNavigate={onNavigate} />
                ))}
              </Collapse>
            </>
          )}

          {sections.map((s) => (
            <Fragment key={s.id}>
              <SectionToggle
                label={`${t('nav-category')} · ${s.name}`}
                open={!closed[s.id]}
                onClick={() => toggle(s.id)}
              />
              <Collapse open={!closed[s.id]} rail>
                {s.folders.map((f) => (
                  <Fragment key={f.id}>
                    <button
                      type="button"
                      onClick={() => toggle(f.id)}
                      aria-expanded={!closed[f.id]}
                      className="flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <CaretIcon open={!closed[f.id]} />
                      <FolderIcon />
                      <span className="min-w-0 flex-1 truncate text-left">{f.name}</span>
                    </button>
                    <Collapse open={!closed[f.id]} rail>
                      {f.boards.map((b) => (
                        <BoardNavItem
                          key={b.id}
                          board={b}
                          pathname={pathname}
                          onNavigate={onNavigate}
                          indent
                        />
                      ))}
                    </Collapse>
                  </Fragment>
                ))}
                {s.boards.map((b) => (
                  <BoardNavItem key={b.id} board={b} pathname={pathname} onNavigate={onNavigate} />
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
      className="mt-1.5 flex h-9 w-full items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
    >
      <CaretIcon open={open} />
      <span className="min-w-0 truncate text-left">{label}</span>
    </button>
  )
}

// 높이를 재지 않는 접기 애니메이션 — grid-template-rows 0fr↔1fr 전환(네이티브 CSS).
// ⚠ 클리핑 박스(overflow-hidden)와 flex 컬럼은 반드시 분리한다. 한 요소로 합치면
// 자식들이 flex-shrink로 눌렸다 펴져서, 위에서 밀려나오는 대신 크기가 배분되는 느낌이 난다.
// rail: 카테고리 묶음을 왼쪽 세로선으로 표시 — 한 단계 들여쓰기(~34px)보다 훨씬 싸게
// '이 아래는 같은 카테고리' 를 전달한다. 폴더 안 게시판은 rail을 한 번 더 중첩(2뎁스 구분).
function Collapse({
  open,
  rail,
  children,
}: {
  open: boolean
  rail?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={[
        'grid transition-[grid-template-rows] duration-200 ease-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      ].join(' ')}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={['flex flex-col gap-0.5', rail ? 'ml-2 border-l border-gray-200' : ''].join(
            ' ',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

// 사이드바 게시판 한 줄. 자료실(is_drive/type=DRIVE)이면 /drive, 아니면 /board/{uuid}로 간다.
function BoardNavItem({
  board,
  pathname,
  onNavigate,
  star,
  indent,
}: {
  board: CategoryBoard
  pathname: string
  onNavigate?: () => void
  star?: boolean
  indent?: boolean // 폴더(하위 카테고리) 안의 게시판
}) {
  const drive = isDriveBoard(board)
  // 폴더 안 게시판: 예전엔 pl-[34px]로 깊게 밀었지만, 이제 폴더 rail(세로선)이 소속을
  // 표시하므로 얕게만 띄운다 — 제목 폭을 되돌려 받는다. (arbitrary 값으로 itemClass의 px-3.5 확실히 override)
  const pad = indent ? ' pl-[8px]' : ''
  const inner = (
    <>
      {star ? (
        <StarIcon className="size-[15px] flex-none text-warning" />
      ) : drive ? (
        <DriveIcon />
      ) : (
        <BoardIcon />
      )}
      <span className="min-w-0 flex-1 truncate text-left">{board.title}</span>
    </>
  )
  return drive ? (
    <Link
      to="/drive"
      search={{ b: board.id }}
      onClick={onNavigate}
      className={itemClass(pathname === '/drive') + pad}
    >
      {inner}
    </Link>
  ) : (
    <Link
      to="/board/$boardId"
      params={{ boardId: board.id }}
      onClick={onNavigate}
      className={itemClass(pathname === `/board/${board.id}`) + pad}
    >
      {inner}
    </Link>
  )
}

function CaretIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={[
        'size-3 flex-none text-gray-400 transition-transform duration-200',
        open ? 'rotate-90' : '',
      ].join(' ')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
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
  // 로그인 후 셸 진입 시 /me 호출 → 사용자 정보(프로필 표시)
  const { data: me } = useMe()
  const meName = me?.name ?? ''
  const meEmail = me?.email ?? ''
  const meInitial = meName.charAt(0)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* ── 톱바 ── */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-card">
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
        <div className="hidden h-[58px] items-center gap-[18px] px-5 min-[631px]:flex">
          <Logo className="flex-none text-[17px]" />
          <div className="flex h-[38px] w-[340px] items-center gap-2 rounded-[5px] bg-gray-100 py-0 pr-1.5 pl-3">
            <SearchIcon className="size-[15px] flex-none text-gray-400" />
            <input
              placeholder={t('nav-search-placeholder')}
              className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] outline-none"
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
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-l-blue text-[13px] font-bold text-on-pastel">
                  {meInitial}
                </span>
                <span className="text-[13px] font-semibold whitespace-nowrap text-gray-800">
                  {meName}
                </span>
                <ChevronDownIcon />
              </button>
              {profileOpen && (
                <div className="absolute top-[calc(100%+4px)] right-0 z-50 w-[200px] rounded-lg border border-gray-200 bg-card p-1 shadow-[0_4px_8px_rgba(0,0,0,0.1)]">
                  <div className="flex flex-col gap-px border-b border-gray-100 px-2.5 pt-2 pb-1.5">
                    <span className="text-[13px] font-bold">{meName}</span>
                    <span className="text-[11.5px] text-gray-400">{meEmail}</span>
                  </div>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13.5px] text-gray-800 hover:bg-gray-100"
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
                    className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13.5px] text-gray-800 hover:bg-gray-100"
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
        <aside className="hidden h-full w-[232px] flex-none flex-col gap-0.5 border-r border-gray-200 px-2.5 py-3.5 min-[631px]:flex">
          <SidebarNav pathname={pathname} />
        </aside>
        <main className="min-w-0 flex-1 p-5 pb-[76px] min-[631px]:overflow-y-auto min-[631px]:p-6 min-[631px]:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ── 모바일 하단 탭 ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[58px] border-t border-gray-200 bg-card min-[631px]:hidden">
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
        <div className="fixed inset-0 z-50 min-[631px]:hidden">
          <button
            type="button"
            aria-label="close"
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-card">
            <div className="flex items-center gap-2.5 border-b border-gray-200 p-4">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-l-blue text-[13px] font-bold text-on-pastel">
                {meInitial}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold">{meName}</span>
                <span className="truncate text-[11.5px] text-gray-400">{meEmail}</span>
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
  const cls = `flex flex-1 flex-col items-center justify-center gap-1 text-[11px] ${active ? 'font-semibold text-primary' : 'text-gray-500'}`
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
function StarIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? base}
      viewBox="0 0 24 24"
      fill="currentColor"
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
