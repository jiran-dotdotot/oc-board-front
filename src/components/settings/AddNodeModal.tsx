import { useEffect, useId, useState } from 'react'

import { useTranslation } from 'react-i18next'

import {
  BTYPE_KEY,
  BTYPE_OPTIONS,
  DESC_MAX,
  FILE_MAX_OPTS,
  NAME_MAX,
  TOTAL_MAX_OPTS,
  TYPE_KEY,
} from './constants'
import type { AddDraft, NodeKind } from './types'
import { CapChip, CaretDown, Field, RadioRow } from './ui'
import { Modal } from '@/components/common/Modal'
import { Switch } from '@/components/common/Switch'
import { ErrIcon, PersonIcon, PlusMini, XMini } from '@/components/common/icons'

/**
 * 카테고리·폴더·게시판·자료실 추가 모달.
 * 스크림/포커스 트랩/스크롤 락은 `common/Modal` 이 담당한다 —
 * 이전에는 직접 만든 오버레이라 포커스가 배경에 남고 닫은 뒤 복귀도 없었다.
 */
export function AddNodeModal({
  kind,
  draft,
  locOpts,
  onChange,
  onOpenScopePicker,
  onOpenAdminPicker,
  onClose,
  onSubmit,
}: {
  kind: NodeKind
  draft: AddDraft
  locOpts: { v: string; label: string }[]
  onChange: (patch: Partial<AddDraft>) => void
  onOpenScopePicker: () => void
  onOpenAdminPicker: () => void
  onClose: () => void
  onSubmit: () => boolean
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const [tried, setTried] = useState(false)
  const [locOpen, setLocOpen] = useState(false)
  const curLoc = locOpts.find((o) => o.v === draft.loc) ?? locOpts[0]

  // Modal 은 ESC 를 호출 쪽에 맡긴다. 위치 드롭다운이 열려 있으면 그것만 닫는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (locOpen) setLocOpen(false)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [locOpen, onClose])

  useEffect(() => {
    if (!locOpen) return
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-dd="aloc"]')) setLocOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [locOpen])

  const submit = () => {
    setTried(true)
    onSubmit()
  }
  const nameMissing = tried && !draft.name.trim()

  return (
    <Modal onClose={onClose} labelledBy={titleId}>
      <div className="flex max-h-[calc(100dvh-64px)] w-[420px] max-w-full flex-col rounded-xl bg-card shadow-[var(--shadow-modal)]">
        <div className="flex items-center border-b border-gray-100 px-5 pt-[18px] pb-3.5">
          <span id={titleId} className="text-base font-bold">
            {t(TYPE_KEY[kind])} {t('admin-add')}
          </span>
          <button
            type="button"
            aria-label={t('common-cancel')}
            onClick={onClose}
            className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
          >
            <XMini size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-3.5 overflow-y-auto px-5 py-[18px]">
          {/* 위치 — 카테고리는 최상위라 위치가 없다 */}
          {kind !== 'cat' && (
            <Field label={t('admin-loc')} required>
              <span data-dd="aloc" className="relative block">
                <button
                  type="button"
                  aria-expanded={locOpen}
                  onClick={() => setLocOpen((v) => !v)}
                  className="flex h-10 w-full items-center gap-2 rounded-md border border-gray-300 bg-card px-3"
                >
                  <span className="flex-1 text-left text-sm text-gray-900">{curLoc?.label}</span>
                  <CaretDown
                    className={locOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
                  />
                </button>
                {locOpen && (
                  <span
                    role="listbox"
                    aria-label={t('admin-loc')}
                    className="absolute top-[calc(100%+4px)] right-0 left-0 z-[var(--z-dropdown)] block rounded-lg border border-gray-200 bg-card p-1 shadow-[var(--shadow-dropdown)]"
                  >
                    {locOpts.map((o) => (
                      <span
                        key={o.v}
                        role="option"
                        aria-selected={draft.loc === o.v}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return
                          e.preventDefault()
                          onChange({ loc: o.v })
                          setLocOpen(false)
                        }}
                        onClick={() => {
                          onChange({ loc: o.v })
                          setLocOpen(false)
                        }}
                        className={[
                          'flex h-8 cursor-pointer items-center rounded-md px-2.5 text-s hover:bg-gray-100',
                          draft.loc === o.v ? 'font-semibold text-primary' : 'text-gray-800',
                        ].join(' ')}
                      >
                        {o.label}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </Field>
          )}

          {/* 이름 */}
          <Field label={`${t(TYPE_KEY[kind])}${t('admin-name-suffix')}`} required>
            <span className="relative block">
              <input
                value={draft.name}
                aria-invalid={nameMissing}
                onChange={(e) =>
                  onChange({ name: Array.from(e.target.value).slice(0, NAME_MAX).join('') })
                }
                placeholder={t('admin-name-required')}
                className="h-10 w-full rounded-md border bg-card pr-16 pl-3 text-sm focus:border-primary focus:outline-none"
                style={{
                  borderColor: nameMissing
                    ? 'var(--color-destructive)'
                    : draft.name
                      ? 'var(--color-primary)'
                      : 'var(--color-gray-300)',
                }}
              />
              <span className="absolute top-3 right-3 text-xs text-gray-400">
                {Array.from(draft.name).length}/{NAME_MAX}
              </span>
            </span>
            {nameMissing && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <ErrIcon /> {t('admin-name-required')}
              </span>
            )}
          </Field>

          {/* 공개 범위 */}
          <Field label={t('admin-scope')} required>
            <div
              role="radiogroup"
              aria-label={t('admin-scope')}
              className="flex flex-wrap items-center gap-[18px]"
            >
              <RadioRow
                label={t('admin-scope-all')}
                on={draft.scope === 'all'}
                onClick={() => onChange({ scope: 'all' })}
              />
              <RadioRow
                label={t('admin-scope-org')}
                on={draft.scope === 'org'}
                onClick={() => onChange({ scope: 'org' })}
              />
              {draft.scope === 'org' && (
                <button
                  type="button"
                  onClick={onOpenScopePicker}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-card px-3 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  <PersonIcon /> {draft.scopeLabel || t('admin-scope-default')}
                </button>
              )}
            </div>
          </Field>

          {/* 관리자 */}
          <Field label={t('admin-managers')}>
            <div className="flex flex-wrap items-center gap-1.5">
              {draft.admins.map((name) => (
                <span
                  key={name}
                  className="inline-flex h-8 items-center gap-[7px] rounded-2xl bg-gray-50 pr-[7px] pl-[5px]"
                >
                  <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-l-green text-2xs font-bold text-on-pastel">
                    {name.slice(0, 1)}
                  </span>
                  <span className="text-s text-gray-700">{name}</span>
                  <button
                    type="button"
                    aria-label={`${name} ${t('common-delete')}`}
                    onClick={() => onChange({ admins: draft.admins.filter((n) => n !== name) })}
                    className="inline-flex size-[17px] items-center justify-center rounded-full text-gray-400 hover:text-destructive"
                  >
                    <XMini />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={onOpenAdminPicker}
                className="inline-flex h-8 items-center gap-1.5 rounded-2xl border border-dashed border-gray-300 px-3 text-xs font-semibold text-gray-500 hover:bg-gray-100"
              >
                <PlusMini /> {t('admin-add-manager')}
              </button>
            </div>
          </Field>

          {/* 게시판 전용 */}
          {kind === 'board' && (
            <>
              <Field label={t('admin-board-desc')} optional>
                <span className="relative block">
                  <textarea
                    value={draft.desc}
                    onChange={(e) =>
                      onChange({ desc: Array.from(e.target.value).slice(0, DESC_MAX).join('') })
                    }
                    placeholder={t('admin-board-desc-ph')}
                    rows={2}
                    className="w-full resize-none rounded-md border border-gray-300 bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  <span className="absolute right-3 bottom-2.5 text-xs text-gray-400">
                    {Array.from(draft.desc).length}/{DESC_MAX}
                  </span>
                </span>
              </Field>
              <Field label={t('admin-type')}>
                <div
                  role="radiogroup"
                  aria-label={t('admin-type')}
                  className="flex flex-wrap gap-[18px]"
                >
                  {BTYPE_OPTIONS.map((bt) => (
                    <RadioRow
                      key={bt}
                      label={t(BTYPE_KEY[bt])}
                      on={draft.btype === bt}
                      onClick={() => onChange({ btype: bt })}
                    />
                  ))}
                </div>
              </Field>
              <div className="flex items-center gap-3">
                <span className="text-s font-semibold text-gray-700">{t('admin-alarm-new')}</span>
                <Switch
                  on={draft.alarm}
                  label={t('admin-alarm-new')}
                  onClick={() => onChange({ alarm: !draft.alarm })}
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-s font-semibold text-gray-700">{t('admin-active')}</span>
                <Switch
                  on={draft.active}
                  label={t('admin-active')}
                  onClick={() => onChange({ active: !draft.active })}
                />
                <span className="text-xs text-gray-400">{t('admin-active-hint')}</span>
              </div>
            </>
          )}

          {/* 자료실 전용 */}
          {kind === 'drive' && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-[110px] flex-none text-s font-semibold text-gray-700">
                  {t('admin-file-max')}
                </span>
                {FILE_MAX_OPTS.map((v) => (
                  <CapChip
                    key={v}
                    label={v}
                    on={draft.fileMax === v}
                    onClick={() => onChange({ fileMax: v })}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-[110px] flex-none text-s font-semibold text-gray-700">
                  {t('admin-total-max')}
                </span>
                {TOTAL_MAX_OPTS.map((v) => (
                  <CapChip
                    key={v}
                    label={v}
                    on={draft.totalMax === v}
                    onClick={() => onChange({ totalMax: v })}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="w-[110px] flex-none text-s font-semibold text-gray-700">
                  {t('admin-drive-alarm')}
                </span>
                <Switch
                  on={draft.alarm}
                  label={t('admin-drive-alarm')}
                  onClick={() => onChange({ alarm: !draft.alarm })}
                />
              </div>
              <Field label={`${t('admin-ext-block')} `} optional>
                <input
                  value={draft.ext}
                  onChange={(e) => onChange({ ext: e.target.value })}
                  placeholder={t('admin-ext-ph-modal')}
                  className="h-10 w-full rounded-md border border-gray-300 bg-card px-3 text-sm focus:border-primary focus:outline-none"
                />
              </Field>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 pt-3.5 pb-[18px]">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-md border border-gray-200 bg-card px-4 text-sm font-semibold text-gray-800 hover:bg-gray-100"
          >
            {t('common-cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            className="inline-flex h-10 items-center rounded-md bg-primary px-[18px] text-sm font-semibold text-white hover:bg-ov-blue-700"
          >
            {t('admin-add')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
