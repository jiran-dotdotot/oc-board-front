// OfficeNext 아이콘 — 단일 공유 모듈.
//
// 이전엔 13개 화면 파일에 101개가 흩어져 있었고 그중 29개가 순수 중복이었다
// (CheckIcon 5곳, XIcon·TrashIcon·PaperclipIcon·ImageIcon·EyeIcon·DownloadIcon·BookmarkIcon 각 4곳).
// stroke 폭·크기를 정본에 맞출 때 «같은 아이콘을 여러 번» 고쳐야 했다.
//
// ⚠ SVG 마크업은 옮기면서 한 글자도 바꾸지 않았다 — 화면은 1px도 달라지지 않는다.
//   크기·stroke 는 docs/guides/design-tokens-guide.md 의 정본 스케일을 이미 따른다
//   (12/14/16/20/24 · stroke 1.7~2.2, 일러스트·스피너·체크마크는 예외).
//
// 데이터로 아이콘을 «고르는» 래퍼(NodeIcon·ToneIcon·TabIcon·BasicIcon)와 브랜드 마크(WaveMark)는
// 도메인 파일에 남는다 — 아이콘이 아니라 선택 로직이기 때문이다.

export interface IconProps {
  className?: string
}

/** 사이드바·헤더 내비 아이콘의 공통 기본 크기 */
const base = 'size-4 flex-none'

// AlbumIcon — 원본 board/BoardListScreen.tsx
export function AlbumIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  )
}

// AlertIcon — 원본 board/WriteScreen.tsx
export function AlertIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3 flex-none'}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path
        d="M12 6.5v7M12 16.4h.01"
        stroke="var(--color-white)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ArrowIcon — 원본 board/PostDetailScreen.tsx
export function ArrowIcon({ dir, className }: { dir?: 'up' | 'down'; className?: string }) {
  return (
    <svg
      className={className ?? 'size-3'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === 'up' ? (
        <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
      ) : (
        <path d="M12 5v14M5.5 12.5L12 19l6.5-6.5" />
      )}
    </svg>
  )
}

// BoardIcon — 원본 common/AppShell.tsx (같은 정의 2곳에 중복돼 있었다)
export function BoardIcon({ className }: IconProps) {
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

// BookmarkIcon — 원본 common/AppShell.tsx (같은 정의 4곳에 중복돼 있었다)
// 즐겨찾기 리본. filled=등록됨(채움) / 아니면 외곽선만.
export function BookmarkIcon({ filled, className }: { filled?: boolean; className?: string }) {
  return (
    <svg
      className={className ?? 'size-3 flex-none'}
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

// BuildingIcon — 원본 settings/OrgPickerModal.tsx
export function BuildingIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-gray-500)"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className={className ?? 'size-3.5 flex-none'}
    >
      <rect x="5" y="3.5" width="14" height="17" />
      <path d="M9 7.5h2M13 7.5h2M9 11h2M13 11h2M9 14.5h2M13 14.5h2M10.5 20.5v-3h3v3" />
    </svg>
  )
}

// CalendarIcon — 원본 board/WriteScreen.tsx (같은 정의 2곳에 중복돼 있었다)
export function CalendarIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3.5 flex-none text-gray-400'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" />
    </svg>
  )
}

// CaretIcon — 원본 common/AppShell.tsx
// 트리 셰브런 — 행 «우측»에 놓이고 펼치면 180° 뒤집힌다 (디자인 B-3 확정).
export function CaretIcon({ open, className }: { open?: boolean; className?: string }) {
  return (
    <svg
      className={[
        className ?? 'size-3 flex-none text-gray-400 transition-transform duration-200',
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

// CheckIcon — 원본 drive/DriveScreen.tsx (같은 정의 5곳에 중복돼 있었다)
export function CheckIcon({
  accent,
  strokeWidth = 2.2,
  className,
}: {
  accent?: boolean
  /** 작은 체크박스 안에서는 두껍게 — 정본 stroke 예외 */
  strokeWidth?: number
  className?: string
}) {
  return (
    <svg
      width={accent ? 16 : 12}
      height={accent ? 16 : 12}
      viewBox="0 0 24 24"
      fill="none"
      stroke={accent ? 'var(--color-success)' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'flex-none'}
    >
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  )
}

// ChevronDownIcon — 원본 board/BoardListScreen.tsx (같은 정의 2곳에 중복돼 있었다)
export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`size-3.5 text-gray-400 transition-transform ${className ?? ''}`}
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

// ChevronIcon — 원본 board/PostDetailScreen.tsx
export function ChevronIcon({
  dir,
  small,
  className,
}: {
  dir?: 'left' | 'right'
  small?: boolean
  className?: string
}) {
  return (
    <svg
      className={className ?? (small ? 'size-3' : 'size-3.5')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === 'left' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  )
}

// ClearIcon — 원본 auth/LoginScreen.tsx
export function ClearIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3'}
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

// ClockIcon — 원본 search/SearchScreen.tsx
export function ClockIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3 flex-none text-gray-400'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

// CloseIcon — 원본 board/PostDetailScreen.tsx (같은 정의 2곳에 중복돼 있었다)
export function CloseIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-4'}
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

// CommentIcon — 원본 home/HomeScreen.tsx (같은 정의 2곳에 중복돼 있었다)
export function CommentIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.5 12.5c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20.5l1.5-3.6A6.6 6.6 0 0 1 3.5 12.5c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z" />
    </svg>
  )
}

// DashIcon — 원본 board/WriteScreen.tsx
export function DashIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 12h12" />
    </svg>
  )
}

// DocIcon — 원본 home/HomeScreen.tsx
export function DocIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-5'}
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

// DotsIcon — 원본 board/PostDetailScreen.tsx
export function DotsIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-4'}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="5.5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="18.5" r="1.6" />
    </svg>
  )
}

// DownloadIcon — 원본 home/HomeScreen.tsx (같은 정의 4곳에 중복돼 있었다)
export function DownloadIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3.5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4v11M7 10.5l5 5 5-5" />
      <path d="M4.5 19.5h15" />
    </svg>
  )
}

// DriveIcon — 원본 common/AppShell.tsx (같은 정의 3곳에 중복돼 있었다)
export function DriveIcon({ className }: IconProps) {
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

// EditIcon — 원본 board/PostDetailScreen.tsx
export function EditIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3.5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 15.5V20h4.5L19 9.5 14.5 5z" />
    </svg>
  )
}

// ErrIcon — 원본 settings/SettingsScreen.tsx
export function ErrIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V13M12 16.5h.01" />
    </svg>
  )
}

// ErrorIcon — 원본 auth/LoginScreen.tsx
export function ErrorIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3 flex-none'}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path
        d="M12 6.5v7M12 16.4h.01"
        stroke="var(--color-white)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

// EyeIcon — 원본 auth/LoginScreen.tsx (같은 정의 4곳에 중복돼 있었다)
export function EyeIcon({ off, className }: { off?: boolean; className?: string }) {
  return off ? (
    <svg
      className={className ?? 'size-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6 0 9.5 7 9.5 7a15 15 0 0 1-3.3 3.9M6.2 6.2A15 15 0 0 0 2.5 12s3.5 7 9.5 7a9.4 9.4 0 0 0 4-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </svg>
  ) : (
    <svg
      className={className ?? 'size-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  )
}

// FilterIcon — 원본 search/SearchScreen.tsx
export function FilterIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3.5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

// FolderIcon — 원본 common/AppShell.tsx
export function FolderIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-4 flex-none text-warning'}
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

// GearIcon — 원본 common/AppShell.tsx
export function GearIcon({ className }: IconProps) {
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

// HeartIcon — 원본 board/PostDetailScreen.tsx
export function HeartIcon({
  filled,
  small,
  className,
}: {
  filled?: boolean
  small?: boolean
  className?: string
}) {
  return (
    <svg
      className={className ?? (small ? 'size-3' : 'size-4')}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20.5s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3.5c0 5.4-7.5 10-7.5 10z" />
    </svg>
  )
}

// HomeIcon — 원본 common/AppShell.tsx
export function HomeIcon({ className }: IconProps) {
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

// ImageIcon — 원본 board/PostDetailScreen.tsx (같은 정의 4곳에 중복돼 있었다)
export function ImageIcon({
  size,
  large,
  className,
}: {
  /** 일러스트 글리프라 아이콘 스케일(12~24) 밖 값도 허용한다 — 정본 예외 */
  size?: number
  large?: boolean
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      className={className ?? (large ? 'size-[26px] opacity-75' : 'opacity-75')}
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M3.5 16.5l5-4.5 4 3.5 3.5-3 4.5 4" />
    </svg>
  )
}

// LinkIcon — 원본 board/PostDetailScreen.tsx (같은 정의 3곳에 중복돼 있었다)
export function LinkIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.5 13.5a4 4 0 0 0 5.7 0l3.3-3.3a4 4 0 0 0-5.7-5.7l-1.6 1.6" />
      <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-3.3 3.3a4 4 0 0 0 5.7 5.7l1.6-1.6" />
    </svg>
  )
}

// ListIcon — 원본 board/WriteScreen.tsx
export function ListIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h10M4 17h16" />
    </svg>
  )
}

// LockIcon — 원본 auth/LoginScreen.tsx
export function LockIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-4 flex-none text-gray-400'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  )
}

// LogoutIcon — 원본 common/AppShell.tsx
export function LogoutIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3.5'}
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

// MailIcon — 원본 auth/LoginScreen.tsx
// 이메일 필드 봉투 아이콘 (디자인 17px). 사람 아이콘이 아니다 — 입력값이 계정 이메일이라 봉투가 정본.
export function MailIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-4 flex-none text-gray-400'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4.5 7.5l7.5 6 7.5-6" />
    </svg>
  )
}

// MenuIcon — 원본 common/AppShell.tsx
export function MenuIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-5'}
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

// MoonIcon — 원본 common/AppShell.tsx
export function MoonIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-4'}
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

// OrgIcon — 원본 board/WriteScreen.tsx (같은 정의 2곳에 중복돼 있었다)
export function OrgIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3.5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.9-2.8 3-4.2 5.5-4.2s4.6 1.4 5.5 4.2" />
      <path d="M15.5 5.4a3.2 3.2 0 0 1 0 5.2M17.8 14.9c1.4.7 2.4 2 2.9 3.9" />
    </svg>
  )
}

// PaperclipIcon — 원본 mypage/MyActivityScreen.tsx (같은 정의 4곳에 중복돼 있었다)
export function PaperclipIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className ?? 'size-3 flex-none text-gray-400'}
    >
      <path d="M20 12.5l-7.6 7.6a5 5 0 0 1-7-7L13 5.5a3.3 3.3 0 0 1 4.7 4.7L10.5 17a1.7 1.7 0 0 1-2.4-2.4l6.6-6.6" />
    </svg>
  )
}

// PencilIcon — 원본 common/AppShell.tsx
export function PencilIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-4 flex-none'}
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

// PersonIcon — 원본 settings/SettingsScreen.tsx
export function PersonIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.9-2.8 3-4.2 5.5-4.2s4.6 1.4 5.5 4.2" />
      <path d="M15.5 5.4a3.2 3.2 0 0 1 0 5.2M17.8 14.9c1.4.7 2.4 2 2.9 3.9" />
    </svg>
  )
}

// PlusIcon — 원본 board/BoardListScreen.tsx (같은 정의 2곳에 중복돼 있었다)
export function PlusIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3.5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

// PlusMini — 원본 settings/SettingsScreen.tsx
export function PlusMini({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

// PreviewIcon — 원본 board/BoardListScreen.tsx
export function PreviewIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="7" rx="1.5" />
      <rect x="4" y="14" width="16" height="7" rx="1.5" />
    </svg>
  )
}

// PrintIcon — 원본 board/PostDetailScreen.tsx
export function PrintIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 8.5V3.5h10v5" />
      <path d="M7 17.5H4.5v-7a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5v7H17" />
      <rect x="7" y="14.5" width="10" height="6" />
    </svg>
  )
}

// RestoreIcon — 원본 mypage/MyActivityScreen.tsx
export function RestoreIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3.5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 11.5A8 8 0 1 0 18.9 16" />
      <path d="M20 5v6.5h-6.5" />
    </svg>
  )
}

// ScopedIcon — 원본 settings/SettingsScreen.tsx
export function ScopedIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-gray-400)"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className ?? 'size-3 flex-none'}
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.9-2.8 3-4.2 5.5-4.2s4.6 1.4 5.5 4.2" />
      <path d="M15.5 5.4a3.2 3.2 0 0 1 0 5.2M17.8 14.9c1.4.7 2.4 2 2.9 3.9" />
    </svg>
  )
}

// SearchIcon — 원본 search/SearchScreen.tsx (같은 정의 3곳에 중복돼 있었다)
export function SearchIcon({ big, className }: { big?: boolean; className?: string }) {
  return (
    <svg
      className={className ?? (big ? 'size-6' : 'size-5 flex-none text-gray-400')}
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

// StarIcon — 원본 board/BoardListScreen.tsx
export function StarIcon({
  filled,
  small,
  className,
}: {
  filled?: boolean
  small?: boolean
  className?: string
}) {
  return (
    <svg
      className={className ?? (small ? 'size-4' : 'size-4')}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  )
}

// SunIcon — 원본 common/AppShell.tsx
export function SunIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-4'}
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

// TrashIcon — 원본 board/PostDetailScreen.tsx (같은 정의 4곳에 중복돼 있었다)
export function TrashIcon({ size, className }: { size?: number } & IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className ?? (size ? undefined : 'size-3.5')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  )
}

// UploadIcon — 원본 board/WriteScreen.tsx (같은 정의 2곳에 중복돼 있었다)
export function UploadIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V5M7.5 9.5L12 5l4.5 4.5" />
      <path d="M4.5 19.5h15" />
    </svg>
  )
}

// UserIcon — 원본 common/AppShell.tsx
export function UserIcon({ className }: IconProps) {
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

// XIcon — 원본 settings/OrgPickerModal.tsx (같은 정의 4곳에 중복돼 있었다)
export function XIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

// XMini — 원본 settings/SettingsScreen.tsx
export function XMini({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

// ZoomIcon — 원본 board/PostDetailScreen.tsx
export function ZoomIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'size-3'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8L21 21M11 8.5v5M8.5 11h5" />
    </svg>
  )
}
