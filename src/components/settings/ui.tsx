// 환경 설정 화면에서 여러 곳이 나눠 쓰는 소형 컴포넌트.
// (react-refresh 규약상 이 파일은 컴포넌트만 내보낸다 — 상수는 constants.ts, 타입은 types.ts)
import { useTranslation } from 'react-i18next'

import type { NodeKind } from './types'

/** 상세 패널의 구획 — 위쪽 구분선 + 제목. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
      <span className="text-s font-bold">{title}</span>
      {children}
    </div>
  )
}

/** 모달 폼의 필드 — 라벨 + 필수/선택 표시. */
export function Field({
  label,
  required,
  optional,
  children,
}: {
  label: string
  required?: boolean
  optional?: boolean
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-s font-semibold text-gray-700">
        {label}
        {required && <span className="text-destructive"> *</span>}
        {optional && <span className="font-normal text-gray-400"> {t('admin-ext-optional')}</span>}
      </span>
      {children}
    </div>
  )
}

export function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-full items-center rounded-md px-2.5 text-s text-gray-800 hover:bg-gray-100"
    >
      {children}
    </button>
  )
}

/** 라디오. 정본 원 17px · 선택 `5px solid primary` · 미선택 `1.5px gray-300`. */
export function RadioRow({
  label,
  on,
  onClick,
  disabled,
}: {
  label: string
  on: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      disabled={disabled}
      className="group inline-flex items-center gap-[7px] disabled:opacity-40"
    >
      <span
        className={[
          'box-border size-[17px] flex-none rounded-full',
          on
            ? 'border-[5px] border-primary'
            : 'border-[1.5px] border-gray-300 group-enabled:group-hover:border-gray-400 group-enabled:group-hover:bg-gray-50',
        ].join(' ')}
      />
      <span className="text-s">{label}</span>
    </button>
  )
}

/** 용량 선택 칩. */
export function CapChip({
  label,
  on,
  onClick,
}: {
  label: string
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={[
        'inline-flex h-7 items-center rounded-2xl px-3 text-xs font-semibold',
        on ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

export function CaretDown({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/** 트리 노드 아이콘 — 카테고리·폴더·자료실·게시판. 폴더만 `warning` 색이다. */
export function NodeIcon({ kind, active }: { kind: NodeKind; active: boolean }) {
  const c = active ? 'var(--color-primary)' : 'var(--color-gray-500)'
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    strokeWidth: 1.8,
    strokeLinejoin: 'round' as const,
    className: 'flex-none',
    'aria-hidden': true,
  }
  if (kind === 'cat')
    return (
      <svg {...common} stroke={c}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 9.5h16" />
      </svg>
    )
  if (kind === 'folder')
    return (
      <svg {...common} stroke="var(--color-warning)">
        <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2.5H19A1.5 1.5 0 0 1 20.5 9.5v9A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5z" />
      </svg>
    )
  if (kind === 'drive')
    return (
      <svg {...common} stroke={c} strokeWidth={1.7}>
        <path d="M3.5 13.5L6 5.5h12l2.5 8" />
        <rect x="3.5" y="13.5" width="17" height="5.5" rx="1.5" />
        <path d="M16.5 16.2h.01M13.5 16.2h.01" />
      </svg>
    )
  return (
    <svg {...common} stroke={c} strokeWidth={1.7}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5" />
    </svg>
  )
}
