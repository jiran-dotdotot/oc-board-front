import { useTranslation } from 'react-i18next'

/* 목록 페이지네이션 — 데스크톱 전용, 10칸 윈도우 + 처음·이전·다음·마지막.
   게시글 목록과 자료실이 함께 쓴다. lastPage>1 일 때만 렌더할 것(호출 쪽 판단). */
export function Pagination({
  page,
  totalPages,
  onPick,
}: {
  page: number
  totalPages: number
  /** 1페이지는 URL 에서 생략하는 화면이 있어 «페이지 번호» 그대로 넘긴다. */
  onPick: (n: number) => void
}) {
  const { t } = useTranslation()
  const windowStart = Math.floor((page - 1) / 10) * 10 + 1
  const pages: number[] = []
  for (let i = 0; i < 10 && windowStart + i <= totalPages; i++) pages.push(windowStart + i)
  const atFirst = page <= 1
  const atLast = page >= totalPages

  return (
    <div className="flex items-center justify-center gap-[3px] py-1.5">
      <PageArrow disabled={atFirst} onClick={() => onPick(1)} label={t('list-page-first')}>
        <DoubleChevron dir="left" />
      </PageArrow>
      <PageArrow disabled={atFirst} onClick={() => onPick(page - 1)} label={t('list-page-prev')}>
        <Chevron dir="left" />
      </PageArrow>
      {pages.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          aria-current={n === page ? 'page' : undefined}
          className={`mx-px inline-flex h-7 min-w-[28px] items-center justify-center rounded-full border px-1.5 text-s ${
            n === page
              ? 'border-primary font-bold text-primary'
              : 'border-transparent text-gray-500 hover:bg-gray-100'
          }`}
        >
          {n}
        </button>
      ))}
      <PageArrow disabled={atLast} onClick={() => onPick(page + 1)} label={t('list-page-next')}>
        <Chevron dir="right" />
      </PageArrow>
      <PageArrow disabled={atLast} onClick={() => onPick(totalPages)} label={t('list-page-last')}>
        <DoubleChevron dir="right" />
      </PageArrow>
    </div>
  )
}

function PageArrow({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-[30px] items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === 'left' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  )
}

function DoubleChevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === 'left' ? (
        <path d="M17.5 5l-7 7 7 7M10.5 5l-7 7 7 7" />
      ) : (
        <path d="M6.5 5l7 7-7 7M13.5 5l7 7-7 7" />
      )}
    </svg>
  )
}
