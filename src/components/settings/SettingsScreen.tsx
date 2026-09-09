import { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { ContentTab } from './ContentTab'
import { TABS } from './constants'
import type { EnvTab, NodeKind } from './types'
import { CaretDown, MenuItem } from './ui'
import { Toast } from '@/components/common/Toast'
import { CheckIcon, PlusIcon } from '@/components/common/icons'
import { useToast } from '@/components/common/useToast'
import { GeneralTab } from '@/components/settings/GeneralTab'
import { MainScreenTab } from '@/components/settings/MainScreenTab'
import { useMe } from '@/hooks/useMe'
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
  const [tab, setTab] = useState<EnvTab>('general')

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
        <span className="text-s text-gray-400">{t('env-subtitle')}</span>
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

      <div className="flex flex-col gap-4 min-[820px]:flex-row min-[820px]:items-start min-[820px]:gap-6">
        {/* 설정 레일 — 데스크탑 좌측 세로, 모바일 상단 스택 */}
        <div className="flex flex-none flex-col gap-[3px] border-b border-gray-200 pb-3 min-[820px]:w-[238px] min-[820px]:border-r min-[820px]:border-b-0 min-[820px]:pr-3.5 min-[820px]:pb-1">
          {tabs.map((rl) => (
            <button
              key={rl.id}
              type="button"
              onClick={() => setTab(rl.id)}
              className={[
                'flex gap-2.5 rounded-md p-2.5 text-left',
                tab === rl.id ? 'bg-ov-blue-50 font-semibold text-primary' : 'hover:bg-gray-100',
              ].join(' ')}
            >
              <span
                className={[
                  'mt-px flex-none',
                  tab === rl.id ? 'text-primary' : 'text-gray-400',
                ].join(' ')}
              >
                <TabIcon id={rl.id} />
              </span>
              <span className="flex min-w-0 flex-col gap-px">
                <span
                  className={[
                    'text-sm font-bold',
                    tab === rl.id ? 'text-primary' : 'text-gray-800',
                  ].join(' ')}
                >
                  {t(rl.label)}
                </span>
                <span
                  className={['text-2xs', tab === rl.id ? 'text-gray-500' : 'text-gray-400'].join(
                    ' ',
                  )}
                >
                  {t(DESC_KEY[rl.id])}
                </span>
              </span>
              {tab === rl.id && (
                <span className="ml-auto flex-none self-center text-primary min-[820px]:hidden">
                  <CheckIcon className="size-4 flex-none" />
                </span>
              )}
            </button>
          ))}
          <span className="mt-2.5 px-2.5 text-2xs leading-relaxed text-gray-400 min-[820px]:mt-3.5">
            {t('env-rail-note')}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
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

const DESC_KEY: Record<
  EnvTab,
  'env-tab-general-desc' | 'env-tab-main-desc' | 'env-tab-content-desc'
> = {
  general: 'env-tab-general-desc',
  main: 'env-tab-main-desc',
  content: 'env-tab-content-desc',
}

// 설정 레일 아이콘 — 일반=종, 메인화면=창, 게시판 관리=폴더
function TabIcon({ id }: { id: EnvTab }) {
  const common = {
    className: 'size-4',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (id === 'general')
    return (
      <svg {...common} strokeLinecap="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
        <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
      </svg>
    )
  if (id === 'main')
    return (
      <svg {...common}>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        <path d="M3.5 9.5h17" />
      </svg>
    )
  return (
    <svg {...common}>
      <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2.5H19A1.5 1.5 0 0 1 20.5 9.5v9A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5z" />
    </svg>
  )
}
