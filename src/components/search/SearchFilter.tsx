import { useState } from 'react'

import { useTranslation } from 'react-i18next'

import { BOARD_ALL, BOARD_PUBLIC, PERIOD_OPTIONS, TARGET_OPTIONS } from './constants'
import { presetOf, rangeOf, ymd } from './searchParams'
import type { FilterDraft, PeriodPreset, SearchTargetKey } from './types'
import { Popover } from '@/components/common/Popover'
import { CheckIcon, ChevronDownIcon } from '@/components/common/icons'
import { useCategories } from '@/hooks/useCategories'
import { buildNavTree } from '@/utils/category'

const EMPTY: FilterDraft = {}

/* ── 게시판 선택 ──
   레거시 데스크톱 트리는 `is_writable` 게시판만 보여 줘 «읽기 전용 게시판을 검색 범위로
   고를 수 없었다»(SearchInput.vue:557). 읽을 수 있으면 검색도 할 수 있어야 하므로 걸러내지 않는다.
   카테고리 행도 고를 수 있다 — Go category_id 는 해당 카테고리와 직속 자식까지 포함한다(05:264). */
interface BoardOption {
  key: string
  label: string
  depth: number
  isCategory: boolean
  choice: FilterDraft
}

function useBoardOptions(): BoardOption[] {
  const { t } = useTranslation()
  const { data: tree } = useCategories()
  const out: BoardOption[] = [
    { key: BOARD_ALL, label: t('search-board-all'), depth: 0, isCategory: false, choice: {} },
  ]
  const publics = tree?.public_boards ?? []
  if (publics.length > 0) {
    out.push({
      key: BOARD_PUBLIC,
      label: t('search-board-public'),
      depth: 0,
      isCategory: true,
      choice: { board: BOARD_PUBLIC },
    })
    for (const b of publics) {
      out.push({ key: b.id, label: b.title, depth: 1, isCategory: false, choice: { board: b.id } })
    }
  }
  for (const section of buildNavTree(tree?.categories)) {
    out.push({
      key: section.id,
      label: section.name,
      depth: 0,
      isCategory: true,
      choice: { board: section.id, cat: 1 },
    })
    for (const b of section.boards) {
      out.push({ key: b.id, label: b.title, depth: 1, isCategory: false, choice: { board: b.id } })
    }
    for (const folder of section.folders) {
      out.push({
        key: folder.id,
        label: folder.name,
        depth: 1,
        isCategory: true,
        choice: { board: folder.id, cat: 1 },
      })
      for (const b of folder.boards) {
        out.push({
          key: b.id,
          label: b.title,
          depth: 2,
          isCategory: false,
          choice: { board: b.id },
        })
      }
    }
  }
  return out
}

function BoardPicker({
  draft,
  onPick,
}: {
  draft: FilterDraft
  onPick: (choice: FilterDraft) => void
}) {
  const { t } = useTranslation()
  const options = useBoardOptions()
  const current = draft.board ?? BOARD_ALL
  const label = options.find((o) => (o.choice.board ?? BOARD_ALL) === current)?.label
  return (
    <Popover
      label={t('search-location')}
      triggerClass="flex h-9 w-full items-center gap-2 rounded-md border border-gray-200 bg-card px-3 text-s text-gray-800 hover:bg-gray-100"
      panelClass="top-[calc(100%+4px)] right-0 left-0 max-h-[240px] overflow-y-auto p-1.5"
      trigger={
        <>
          <span className="flex-1 truncate text-left">{label ?? t('search-board-all')}</span>
          <ChevronDownIcon />
        </>
      }
    >
      {(close) => (
        <>
          {options.map((o) => {
            const selected = (o.choice.board ?? BOARD_ALL) === current
            return (
              <button
                key={`${o.key}-${o.depth}`}
                type="button"
                aria-current={selected ? 'true' : undefined}
                onClick={() => {
                  onPick(o.choice)
                  close()
                }}
                className={`flex h-8 w-full items-center gap-1.5 rounded-md pr-2.5 text-s hover:bg-gray-100 ${
                  o.isCategory ? 'font-bold text-gray-500' : 'text-gray-800'
                } ${selected ? 'text-primary' : ''}`}
                style={{ paddingLeft: `${10 + o.depth * 14}px` }}
              >
                <span className="flex-1 truncate text-left">{o.label}</span>
                {selected && <CheckIcon className="size-3 flex-none" strokeWidth={3} />}
              </button>
            )
          })}
        </>
      )}
    </Popover>
  )
}

/* ── 필드 껍데기 ──
   정본은 라벨을 컨트롤 «위»에 둔다(12px/600/gray-500 · gap 6). 왼쪽 고정폭 라벨을 쓰면
   영어·일본어에서 「Search in」·「検索対象」이 폭을 넘겨 컨트롤을 밀어낸다. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      {children}
    </div>
  )
}

/* 정본 그리드: 웹은 230px 하한 auto-fit 반응형 2열(gap 14/24), 모바일은 1열. */
const GRID =
  'grid grid-cols-1 gap-3.5 min-[631px]:grid-cols-[repeat(auto-fit,minmax(230px,1fr))] min-[631px]:gap-x-6'

const chipClass = (on: boolean) =>
  `inline-flex h-[30px] items-center rounded-full px-[13px] text-s font-semibold ${
    on ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  }`

function TargetField({ draft, patch }: { draft: FilterDraft; patch: (p: FilterDraft) => void }) {
  const { t } = useTranslation()
  const current = draft.target ?? 'all'
  return (
    <Field label={t('search-target')}>
      <div className="flex flex-wrap gap-1.5">
        {TARGET_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={current === o.value}
            onClick={() =>
              patch({
                target: o.value === 'all' ? undefined : (o.value as SearchTargetKey),
                // Go 는 is_include_comment 를 title/content 만 확장하고 search 에는 안 쓴다(05:279)
                // → 「전체」로 돌아가면 죽은 조건이 되므로 함께 끈다.
                comment: o.value === 'all' ? undefined : draft.comment,
              })
            }
            className={chipClass(current === o.value)}
          >
            {t(o.key)}
          </button>
        ))}
        {/* 「댓글 내용 포함」은 검색 대상이 제목·본문일 때만 효력이 있다(05:279) —
            효력 없는 컨트롤을 띄우지 않는다. */}
        {current !== 'all' && (
          <button
            type="button"
            aria-pressed={!!draft.comment}
            onClick={() => patch({ comment: draft.comment ? undefined : 1 })}
            className={chipClass(!!draft.comment)}
          >
            {t('search-include-comment')}
          </button>
        )}
      </div>
    </Field>
  )
}

function PeriodField({ draft, patch }: { draft: FilterDraft; patch: (p: FilterDraft) => void }) {
  const { t } = useTranslation()
  const [today] = useState(() => new Date())
  const maxDate = ymd(today)
  const preset = presetOf(draft.from, draft.to, today)
  const pick = (value: PeriodPreset) => {
    if (value === 'custom') {
      // 직접입력으로 들어갈 때 기준점을 준다(둘 다 오늘) — 레거시와 같은 규약.
      patch({ from: draft.from ?? maxDate, to: draft.to ?? maxDate })
      return
    }
    patch(rangeOf(value, today))
  }
  return (
    <Field label={t('search-period')}>
      <div className="flex flex-wrap gap-1.5">
        {PERIOD_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={preset === o.value}
            onClick={() => pick(o.value)}
            className={chipClass(preset === o.value)}
          >
            {t(o.key)}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        // 달력은 브라우저 기본 date 입력에 맡긴다 — 시작 max=종료 · 종료 min=시작 ·
        // 오늘 이후 불가(정본 규칙)를 max/min 으로 그대로 표현하고 키보드 접근성도 공짜다.
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label={t('search-period-from')}
            value={draft.from ?? ''}
            max={draft.to ?? maxDate}
            onChange={(e) => patch({ from: e.target.value || undefined })}
            className="h-9 rounded-md border border-gray-200 bg-card px-3 text-s text-gray-800 outline-none focus:border-primary"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            aria-label={t('search-period-to')}
            value={draft.to ?? ''}
            min={draft.from}
            max={maxDate}
            onChange={(e) => patch({ to: e.target.value || undefined })}
            className="h-9 rounded-md border border-gray-200 bg-card px-3 text-s text-gray-800 outline-none focus:border-primary"
          />
        </div>
      )}
    </Field>
  )
}

/* ── 상세 필터 패널 ──
   정본(통합 앱 «웹·모바일 둘 다»)은 브레이크포인트마다 같은 패널을 쓴다 — 모바일도 바텀시트가
   아니라 인라인 아코디언이고, 그리드만 1열로 접히고 하단 버튼만 풀폭(초기화 1 : 적용 2)이 된다. */
export function SearchFilterPanel({
  id,
  value,
  onApply,
}: {
  id: string
  value: FilterDraft
  onApply: (next: FilterDraft) => void
}) {
  const { t } = useTranslation()
  // 초안 키: URL 값이 바뀌면(적용·뒤로가기) 초안을 그 값으로 다시 시작한다.
  // effect 로 되돌리면 옛 초안이 한 프레임 그려진다 → 렌더 중 파생(React 공식 패턴).
  const key = JSON.stringify(value)
  const [draft, setDraft] = useState({ key, value })
  if (draft.key !== key) setDraft({ key, value })
  const current = draft.key === key ? draft.value : value
  const patch = (p: FilterDraft) => setDraft({ key, value: { ...current, ...p } })

  return (
    <div
      id={id}
      className="flex flex-col gap-3.5 rounded-lg border border-gray-200 bg-card p-3.5 min-[631px]:px-[18px] min-[631px]:py-4"
    >
      <div className={GRID}>
        <Field label={t('search-location')}>
          {/* 게시판을 바꾸면 카테고리 플래그도 함께 갈아치운다 — cat 만 남으면 UUID 종류가 어긋난다. */}
          <BoardPicker
            draft={current}
            onPick={(choice) => patch({ board: undefined, cat: undefined, ...choice })}
          />
        </Field>
        <Field label={t('search-author')}>
          <input
            value={current.writer ?? ''}
            onChange={(e) => patch({ writer: e.target.value || undefined })}
            onKeyDown={(e) => {
              // IME 조합 확정 Enter 이중 발화 방지 — 조합 중엔 적용하지 않는다.
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) onApply(current)
            }}
            placeholder={t('search-author-ph')}
            className="h-9 w-full rounded-md border border-gray-200 bg-card px-3 text-s outline-none focus:border-primary"
          />
        </Field>
      </div>
      <div className={GRID}>
        <TargetField draft={current} patch={patch} />
      </div>
      <PeriodField draft={current} patch={patch} />
      {/* 정본: 웹은 우측 정렬 34px, 모바일은 풀폭 40px */}
      <div className="flex items-center gap-2 border-t border-gray-100 pt-3 min-[631px]:justify-end">
        <button
          type="button"
          onClick={() => onApply(EMPTY)}
          className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-gray-200 bg-card px-[13px] text-s font-semibold text-gray-700 hover:bg-gray-100 min-[631px]:h-8 min-[631px]:flex-none"
        >
          {t('search-reset')}
        </button>
        <button
          type="button"
          onClick={() => onApply(current)}
          className="inline-flex h-10 flex-[2] items-center justify-center rounded-md bg-primary px-[15px] text-s font-semibold text-white hover:bg-ov-blue-700 min-[631px]:h-8 min-[631px]:flex-none"
        >
          {t('search-apply')}
        </button>
      </div>
    </div>
  )
}
