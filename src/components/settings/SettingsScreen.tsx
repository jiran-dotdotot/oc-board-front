import { useEffect, useId, useRef, useState } from 'react'

import { useNavigate } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { ContentTab } from './ContentTab'
import { TABS } from './constants'
import type { EnvTab, NodeKind } from './types'
import { CaretDown, MenuItem } from './ui'
import { Toast } from '@/components/common/Toast'
import { PlusIcon } from '@/components/common/icons'
import { useToast } from '@/components/common/useToast'
import { GeneralTab } from '@/components/settings/GeneralTab'
import { MainScreenTab } from '@/components/settings/MainScreenTab'
import { useMe } from '@/hooks/useMe'
import { Route } from '@/routes/settings'
import { isAnyAdmin } from '@/types/user'

export function SettingsScreen() {
  const { t } = useTranslation()
  const { toast, showToast, hideToast } = useToast()

  const { data: me } = useMe()
  const isOfficeAdmin = !!me?.is_admin // 슈퍼(오피스) 관리자 — 카테고리/폴더 추가 · 메인화면 탭
  const canManage = isAnyAdmin(me)
  const tabs = TABS.filter(
    (x) => x.id === 'general' || (x.id === 'main' ? isOfficeAdmin : canManage),
  )
  // 탭 정본은 URL. 권한이 없어진 탭이 URL 에 남아 있으면 「일반」로 떨어뜨린다.
  const { tab: urlTab } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const tab: EnvTab = tabs.some((x) => x.id === urlTab) ? (urlTab as EnvTab) : 'general'
  const setTab = (next: EnvTab) =>
    navigate({ search: { tab: next === 'general' ? undefined : next }, replace: true })
  const panelId = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [addKind, setAddKind] = useState<NodeKind | null>(null)

  useEffect(() => {
    if (!addMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-dd="addmenu"]')) setAddMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [addMenuOpen])

  const openAdd = (kind: NodeKind) => {
    setAddMenuOpen(false)
    setAddKind(kind)
  }

  return (
    <div className="flex w-full flex-col gap-5">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-lg font-extrabold tracking-title">{t('env-title')}</span>
        <span className="text-s text-gray-400">{t('env-role-note')}</span>
        {/* 추가 드롭다운 — 게시판 관리 탭에서만 */}
        {tab === 'content' && (
          <span data-dd="addmenu" className="relative ml-auto">
            <button
              type="button"
              aria-expanded={addMenuOpen}
              onClick={() => setAddMenuOpen((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-semibold text-white hover:bg-ov-blue-700"
            >
              <PlusIcon className="size-3" /> {t('admin-add')} <CaretDown />
            </button>
            {addMenuOpen && (
              <div className="absolute top-[calc(100%+4px)] right-0 z-[var(--z-dropdown)] w-[180px] rounded-lg border border-gray-200 bg-card p-1 shadow-[var(--shadow-dropdown)]">
                {isOfficeAdmin ? (
                  <>
                    <MenuItem onClick={() => openAdd('cat')}>{t('admin-add-cat')}</MenuItem>
                    <MenuItem onClick={() => openAdd('folder')}>{t('admin-add-folder')}</MenuItem>
                  </>
                ) : (
                  <span className="flex h-8 items-center px-2.5 text-xs text-gray-300">
                    {t('admin-add-super-only')}
                  </span>
                )}
                <MenuItem onClick={() => openAdd('board')}>{t('admin-add-board')}</MenuItem>
                <MenuItem onClick={() => openAdd('drive')}>{t('admin-add-drive')}</MenuItem>
              </div>
            )}
          </span>
        )}
      </div>

      {/* 탭 — 정본은 회색 필 탭이다(통합 앱 web:1163 · mob:1089).
          좌측 레일(`envRail`)은 정본에서 `display:none` 인 죽은 마크업이라 옮기지 않는다. */}
      <div
        role="tablist"
        aria-label={t('env-title')}
        className="flex gap-1 self-start rounded-2xl bg-gray-100 p-[3px] max-[630px]:w-full"
      >
        {tabs.map((x, i) => (
          <button
            key={x.id}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${panelId}-tab-${x.id}`}
            aria-selected={tab === x.id}
            aria-controls={panelId}
            tabIndex={tab === x.id ? 0 : -1}
            onKeyDown={(e) => {
              const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
              if (!d) return
              e.preventDefault()
              const next = (i + d + tabs.length) % tabs.length
              setTab(tabs[next].id)
              tabRefs.current[next]?.focus()
            }}
            onClick={() => setTab(x.id)}
            className={[
              'inline-flex h-[30px] items-center justify-center rounded-2xl px-[15px] text-s font-semibold max-[630px]:h-[34px] max-[630px]:flex-1',
              tab === x.id ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-200',
            ].join(' ')}
          >
            {t(x.label)}
          </button>
        ))}
      </div>

      <div className="flex flex-col">
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${panelId}-tab-${tab}`}
          className="flex min-w-0 flex-1 flex-col"
        >
          {tab === 'general' && <GeneralTab onToast={showToast} />}
          {tab === 'main' && <MainScreenTab />}
          {tab === 'content' && (
            <ContentTab addKind={addKind} onAddClose={() => setAddKind(null)} onToast={showToast} />
          )}
        </div>
      </div>

      <Toast toast={toast} onClose={hideToast} />
    </div>
  )
}
