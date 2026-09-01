import { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { GeneralTab } from '@/components/settings/GeneralTab'
import { Toast } from '@/components/common/Toast'
import { useToast } from '@/components/common/useToast'
import { MainScreenTab } from '@/components/settings/MainScreenTab'
import {
  OrgPickerModal,
  type PickerMode,
  type PickerResult,
} from '@/components/settings/OrgPickerModal'
import {
  BTYPE_KEY,
  type BType,
  type Cat,
  FILE_MAX_OPTS,
  type Folder,
  INITIAL_CATS,
  INITIAL_FOLDERS,
  INITIAL_ITEMS,
  type Item,
  type NodeKind,
  type Scope,
  TOTAL_MAX_OPTS,
} from '@/components/settings/treeData'
import { useMe } from '@/hooks/useMe'
import { isAnyAdmin } from '@/types/user'

const ME_NAME = '김민준'

type EnvTab = 'general' | 'main' | 'content'

// 설정 레일. 일반=전원, 메인화면=오피스 관리자, 게시판 관리=관리자 권한 보유자.
const TABS: {
  id: EnvTab
  label: 'env-tab-general' | 'env-tab-main' | 'env-tab-content'
  desc: 'env-tab-general-desc' | 'env-tab-main-desc' | 'env-tab-content-desc'
}[] = [
  { id: 'general', label: 'env-tab-general', desc: 'env-tab-general-desc' },
  { id: 'main', label: 'env-tab-main', desc: 'env-tab-main-desc' },
  { id: 'content', label: 'env-tab-content', desc: 'env-tab-content-desc' },
]

const TYPE_KEY: Record<
  NodeKind,
  'admin-add-cat' | 'admin-add-folder' | 'admin-add-board' | 'admin-add-drive'
> = {
  cat: 'admin-add-cat',
  folder: 'admin-add-folder',
  board: 'admin-add-board',
  drive: 'admin-add-drive',
}

interface TreeNode {
  kind: NodeKind
  id: string
  name: string
  pad: number
  paused: boolean
  scoped: boolean
  cat: string | null
  folder: string | null
}

export function SettingsScreen() {
  const { t } = useTranslation()

  const { data: me } = useMe()
  const isOfficeAdmin = !!me?.is_admin // 슈퍼(오피스) 관리자 — 카테고리/폴더 추가 · 메인화면 탭
  const canManage = isAnyAdmin(me)
  const tabs = TABS.filter(
    (x) => x.id === 'general' || (x.id === 'main' ? isOfficeAdmin : canManage),
  )
  const [tab, setTab] = useState<EnvTab>('general')

  const [cats, setCats] = useState<Cat[]>(INITIAL_CATS)
  const [folders, setFolders] = useState<Folder[]>(INITIAL_FOLDERS)
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS)
  const [sel, setSel] = useState<{ kind: NodeKind; id: string }>({ kind: 'cat', id: 'shared' })

  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addKind, setAddKind] = useState<NodeKind>('board')
  const [aName, setAName] = useState('')
  const [aDesc, setADesc] = useState('')
  const [dragItem, setDragItem] = useState<TreeNode | null>(null)
  const [dragOver, setDragOver] = useState<{ id: string; pos: 'before' | 'after' } | null>(null)
  const [aTried, setATried] = useState(false)
  const [aLoc, setALoc] = useState('cat:shared')
  const [aLocOpen, setALocOpen] = useState(false)
  const [aScope, setAScope] = useState<Scope>('all')
  const [aScopeLabel, setAScopeLabel] = useState('')
  const [aBtype, setABtype] = useState<BType>('BOARD')
  const [aAlarm, setAAlarm] = useState(true)
  const [aActive, setAActive] = useState(true)
  const [aFileMax, setAFileMax] = useState('500MB')
  const [aTotalMax, setATotalMax] = useState('10GB')
  const [aExt, setAExt] = useState('')
  const [aAdmins, setAAdmins] = useState<string[]>([])

  const [extInput, setExtInput] = useState('')
  const { toast, showToast, hideToast } = useToast()
  const [picker, setPicker] = useState<{ mode: PickerMode; target: 'sel' | 'add' } | null>(null)


  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (addMenuOpen && !el.closest('[data-dd="addmenu"]')) setAddMenuOpen(false)
      if (aLocOpen && !el.closest('[data-dd="aloc"]')) setALocOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [addMenuOpen, aLocOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAddOpen(false)
      setAddMenuOpen(false)
      setALocOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // 선택 노드
  const found: Cat | Folder | Item | undefined =
    sel.kind === 'cat'
      ? cats.find((c) => c.id === sel.id)
      : sel.kind === 'folder'
        ? folders.find((f) => f.id === sel.id)
        : items.find((b) => b.id === sel.id)
  const so = found ?? cats[0]
  const soKind: NodeKind = found ? sel.kind : 'cat'
  const soItem = soKind === 'board' || soKind === 'drive' ? (so as Item) : null

  const patchSel = (patch: Partial<Cat & Folder & Item>) => {
    if (soKind === 'cat')
      setCats((prev) => prev.map((c) => (c.id === so.id ? { ...c, ...patch } : c)))
    else if (soKind === 'folder')
      setFolders((prev) => prev.map((f) => (f.id === so.id ? { ...f, ...patch } : f)))
    else setItems((prev) => prev.map((b) => (b.id === so.id ? { ...b, ...patch } : b)))
  }

  // 트리 구성
  const tree: TreeNode[] = []
  cats.forEach((cat) => {
    tree.push({
      kind: 'cat',
      id: cat.id,
      name: cat.name,
      pad: 10,
      paused: false,
      scoped: cat.scope === 'org',
      cat: null,
      folder: null,
    })
    folders
      .filter((f) => f.cat === cat.id)
      .forEach((f) => {
        tree.push({
          kind: 'folder',
          id: f.id,
          name: f.name,
          pad: 28,
          paused: false,
          scoped: f.scope === 'org',
          cat: cat.id,
          folder: null,
        })
        items
          .filter((it) => it.folder === f.id)
          .forEach((it) =>
            tree.push({
              kind: it.type,
              id: it.id,
              name: it.name,
              pad: 46,
              paused: !it.active,
              scoped: it.scope === 'org',
              cat: cat.id,
              folder: f.id,
            }),
          )
      })
    items
      .filter((it) => it.cat === cat.id && !it.folder)
      .forEach((it) =>
        tree.push({
          kind: it.type,
          id: it.id,
          name: it.name,
          pad: 28,
          paused: !it.active,
          scoped: it.scope === 'org',
          cat: cat.id,
          folder: null,
        }),
      )
  })

  // 같은 상위 안에서만 순서 변경 (드래그)
  const dndSame = (a: TreeNode | null, b: TreeNode) => {
    if (!a || a.id === b.id) return false
    const isItem = (k: NodeKind) => k === 'board' || k === 'drive'
    if (a.kind === 'cat' && b.kind === 'cat') return true
    if (a.kind === 'folder' && b.kind === 'folder') return a.cat === b.cat
    if (isItem(a.kind) && isItem(b.kind)) return a.cat === b.cat && a.folder === b.folder
    return false
  }
  const reorder = <T extends { id: string }>(
    arr: T[],
    fromId: string,
    toId: string,
    pos: 'before' | 'after',
  ) => {
    const a = arr.slice()
    const from = a.findIndex((x) => x.id === fromId)
    const item = a.splice(from, 1)[0]
    let ti = a.findIndex((x) => x.id === toId)
    if (pos === 'after') ti += 1
    a.splice(ti, 0, item)
    return a
  }
  const onDrop = (target: TreeNode) => {
    const d = dragItem
    if (!d || !dndSame(d, target)) return
    const pos = dragOver && dragOver.id === target.id ? dragOver.pos : 'after'
    if (d.kind === 'cat') setCats((prev) => reorder(prev, d.id, target.id, pos))
    else if (d.kind === 'folder') setFolders((prev) => reorder(prev, d.id, target.id, pos))
    else setItems((prev) => reorder(prev, d.id, target.id, pos))
    setDragItem(null)
    setDragOver(null)
  }

  const locOpts: { v: string; label: string }[] = []
  cats.forEach((c) => {
    locOpts.push({ v: `cat:${c.id}`, label: c.name })
    if (addKind !== 'folder')
      folders
        .filter((f) => f.cat === c.id)
        .forEach((f) => locOpts.push({ v: `fol:${f.id}`, label: `${c.name} / ${f.name}` }))
  })
  const curLoc = locOpts.find((o) => o.v === aLoc) ?? locOpts[0]

  const openAdd = (kind: NodeKind) => {
    setAddKind(kind)
    setAddMenuOpen(false)
    setAddOpen(true)
    setAName('')
    setADesc('')
    setATried(false)
    setAScope('all')
    setAScopeLabel('')
    setAAdmins([])
    setALoc('cat:shared')
    setALocOpen(false)
    if (kind === 'board') {
      setABtype('BOARD')
      setAAlarm(true)
      setAActive(true)
    }
    if (kind === 'drive') {
      setAAlarm(true)
      setAFileMax('500MB')
      setATotalMax('10GB')
      setAExt('')
    }
  }

  const aSave = () => {
    setATried(true)
    const nm = aName.trim()
    if (!nm) return
    const id = `n${Date.now()}`
    const [locType, locId] = aLoc.split(':')
    if (addKind === 'cat') {
      setCats((prev) => [
        ...prev,
        { id, name: nm, scope: aScope, scopeLabel: aScopeLabel || undefined, admins: aAdmins },
      ])
      setSel({ kind: 'cat', id })
    } else if (addKind === 'folder') {
      setFolders((prev) => [
        ...prev,
        {
          id,
          name: nm,
          cat: locId,
          scope: aScope,
          scopeLabel: aScopeLabel || undefined,
          admins: aAdmins,
        },
      ])
      setSel({ kind: 'folder', id })
    } else {
      const cat = locType === 'cat' ? locId : (folders.find((f) => f.id === locId)?.cat ?? 'shared')
      const folder = locType === 'fol' ? locId : null
      const base: Item = {
        id,
        name: nm,
        type: addKind as 'board' | 'drive',
        active: addKind === 'board' ? aActive : true,
        scope: aScope,
        scopeLabel: aScopeLabel || undefined,
        admins: aAdmins,
        alarm: aAlarm,
        cat,
        folder,
      }
      if (addKind === 'board') {
        base.btype = aBtype
        base.desc = aDesc.trim() || undefined
      } else {
        base.fileMax = aFileMax
        base.totalMax = aTotalMax
        base.exts = aExt
          .split(',')
          .map((x) => x.trim().replace(/^\./, '').toLowerCase())
          .filter(Boolean)
      }
      setItems((prev) => [...prev, base])
      setSel({ kind: addKind, id })
    }
    setAddOpen(false)
    showToast(t('admin-toast-added', { name: nm, type: t(TYPE_KEY[addKind]) }))
  }

  const onPickerConfirm = (r: PickerResult) => {
    if (!picker) return
    if (picker.mode === 'scope') {
      if (picker.target === 'sel') patchSel({ scope: 'org', scopeLabel: r.label })
      else {
        setAScope('org')
        setAScopeLabel(r.label)
      }
      showToast(t('admin-toast-scope-set'))
    } else {
      if (picker.target === 'sel') {
        const cur = (so as Item).admins ?? []
        const merged = cur.slice()
        r.names.forEach((n) => !merged.includes(n) && merged.push(n))
        patchSel({ admins: merged })
      } else {
        setAAdmins((prev) => {
          const m = prev.slice()
          r.names.forEach((n) => !m.includes(n) && m.push(n))
          return m
        })
      }
      showToast(t('admin-toast-manager-set', { n: r.names.length }))
    }
    setPicker(null)
  }

  const addExt = () => {
    const v = extInput.trim()
    if (!v || (soItem?.exts ?? []).includes(v)) return
    patchSel({ exts: [...(soItem?.exts ?? []), v] })
    setExtInput('')
  }

  const isFixed = 'fixed' in so && so.fixed

  return (
    <div className="flex w-full flex-col gap-5">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-lg font-extrabold tracking-[-0.01em]">{t('env-title')}</span>
        <span className="text-[12.5px] text-gray-400">{t('env-subtitle')}</span>
        {/* 추가 드롭다운 — 게시판 관리 탭에서만 */}
        {tab === 'content' && (
          <span data-dd="addmenu" className="relative ml-auto">
            <button
              type="button"
              onClick={() => setAddMenuOpen((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[5px] bg-primary px-3.5 text-[13.5px] font-semibold text-white hover:bg-ov-blue-700"
            >
              <PlusIcon /> {t('admin-add')} <CaretDown />
            </button>
            {addMenuOpen && (
              <div className="absolute top-[calc(100%+4px)] right-0 z-[var(--z-dropdown)] w-[180px] rounded-lg border border-gray-200 bg-card p-1 shadow-[var(--shadow-dropdown)]">
                {isOfficeAdmin ? (
                  <>
                    <MenuItem onClick={() => openAdd('cat')}>{t('admin-add-cat')}</MenuItem>
                    <MenuItem onClick={() => openAdd('folder')}>{t('admin-add-folder')}</MenuItem>
                  </>
                ) : (
                  <span className="flex h-[34px] items-center px-2.5 text-xs text-gray-300">
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
                'flex gap-2.5 rounded-[10px] p-2.5 text-left',
                tab === rl.id ? 'bg-accent' : 'hover:bg-gray-50',
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
                    'text-[13.5px] font-bold',
                    tab === rl.id ? 'text-primary' : 'text-gray-800',
                  ].join(' ')}
                >
                  {t(rl.label)}
                </span>
                <span
                  className={[
                    'text-[11px]',
                    tab === rl.id ? 'text-gray-500' : 'text-gray-400',
                  ].join(' ')}
                >
                  {t(rl.desc)}
                </span>
              </span>
              {tab === rl.id && (
                <span className="ml-auto flex-none self-center text-primary min-[820px]:hidden">
                  <CheckIcon />
                </span>
              )}
            </button>
          ))}
          <span className="mt-2.5 px-2.5 text-[11px] leading-relaxed text-gray-400 min-[820px]:mt-3.5">
            {t('env-rail-note')}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {tab === 'general' && <GeneralTab onToast={showToast} />}
          {tab === 'main' && <MainScreenTab onToast={showToast} />}
          {tab === 'content' && (
            <div className="flex flex-col gap-5">
              {/* 트리 + 상세 */}
              <div className="grid grid-cols-1 items-start gap-4 min-[820px]:grid-cols-[300px_minmax(0,1fr)]">
                {/* 좌: 트리 */}
                <div className="flex flex-col gap-px rounded-lg border border-gray-200 bg-card p-2">
                  {tree.map((n) => {
                    const on = sel.kind === n.kind && sel.id === n.id
                    return (
                      <button
                        key={`${n.kind}-${n.id}`}
                        type="button"
                        draggable
                        onClick={() => setSel({ kind: n.kind, id: n.id })}
                        onDragStart={() => setDragItem(n)}
                        onDragOver={(e) => {
                          if (!dndSame(dragItem, n)) return
                          e.preventDefault()
                          const rect = e.currentTarget.getBoundingClientRect()
                          const pos = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after'
                          if (!dragOver || dragOver.id !== n.id || dragOver.pos !== pos)
                            setDragOver({ id: n.id, pos })
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          onDrop(n)
                        }}
                        onDragEnd={() => {
                          setDragItem(null)
                          setDragOver(null)
                        }}
                        className={[
                          'flex h-9 cursor-grab items-center gap-2 rounded-lg pr-2.5 text-[13px] active:cursor-grabbing',
                          on ? 'bg-accent' : 'hover:bg-gray-50',
                        ].join(' ')}
                        style={{
                          paddingLeft: n.pad,
                          opacity: dragItem?.id === n.id ? 0.45 : 1,
                          boxShadow:
                            dragOver?.id === n.id && dndSame(dragItem, n)
                              ? dragOver.pos === 'before'
                                ? 'inset 0 2px 0 var(--color-primary)'
                                : 'inset 0 -2px 0 var(--color-primary)'
                              : undefined,
                        }}
                      >
                        <NodeIcon kind={n.kind} active={on} />
                        <span
                          className={[
                            'min-w-0 flex-1 truncate text-left',
                            on
                              ? 'font-semibold text-primary'
                              : n.kind === 'cat'
                                ? 'font-semibold text-gray-800'
                                : n.paused
                                  ? 'text-gray-400'
                                  : 'text-gray-800',
                          ].join(' ')}
                        >
                          {n.name}
                        </span>
                        {n.scoped && <ScopedIcon />}
                        {n.paused && (
                          <span className="inline-flex h-[18px] flex-none items-center rounded bg-l-gray px-1.5 text-[10px] font-bold text-gray-500">
                            {t('admin-paused')}
                          </span>
                        )}
                      </button>
                    )
                  })}
                  <span className="mt-2 border-t border-gray-100 px-2.5 pt-2 text-[11.5px] leading-relaxed text-gray-400">
                    {t('admin-tree-note')}
                  </span>
                </div>

                {/* 우: 상세 패널 */}
                <div className="flex flex-col gap-[18px] rounded-lg border border-gray-200 bg-card px-[22px] py-5">
                  {/* 이름 + 삭제 */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex h-[22px] flex-none items-center rounded bg-l-blue px-2 text-[11px] font-bold text-primary">
                      {t(TYPE_KEY[soKind])}
                    </span>
                    <input
                      value={so.name}
                      onChange={(e) =>
                        patchSel({ name: Array.from(e.target.value).slice(0, 60).join('') })
                      }
                      className="h-[38px] w-[250px] max-w-full rounded-[5px] border border-gray-300 px-3 text-sm font-semibold focus:border-primary focus:outline-none"
                    />
                    {isFixed ? (
                      <span className="text-xs text-gray-400">{t('admin-fixed-note')}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => showToast(t('admin-toast-del-demo', { name: so.name }))}
                        className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-[5px] border border-gray-200 px-3 text-[12.5px] font-semibold text-destructive hover:bg-l-red"
                      >
                        <TrashIcon /> {t('common-delete')}
                      </button>
                    )}
                  </div>

                  {/* 공개 범위 */}
                  <Section title={t('admin-scope')}>
                    {isFixed ? (
                      <span className="text-[12.5px] text-gray-500">
                        {t('admin-fixed-scope-note')}
                      </span>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-[18px]">
                          <RadioRow
                            label={t('admin-scope-all')}
                            on={so.scope === 'all'}
                            onClick={() => patchSel({ scope: 'all' })}
                          />
                          <RadioRow
                            label={t('admin-scope-org')}
                            on={so.scope === 'org'}
                            onClick={() => patchSel({ scope: 'org' })}
                          />
                          {so.scope === 'org' && (
                            <button
                              type="button"
                              onClick={() => setPicker({ mode: 'scope', target: 'sel' })}
                              className="inline-flex h-8 items-center gap-1.5 rounded-[5px] border border-gray-200 px-3 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-100"
                            >
                              <PersonIcon /> {so.scopeLabel || t('admin-scope-default')}
                            </button>
                          )}
                        </div>
                        <span className="text-[11.5px] text-gray-400">{t('admin-scope-hint')}</span>
                      </>
                    )}
                  </Section>

                  {/* 관리자 */}
                  <Section title={t('admin-managers')}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-[34px] items-center gap-[7px] rounded-full bg-gray-50 pr-3 pl-1.5">
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-l-blue text-[11px] font-bold text-on-pastel">
                          {ME_NAME[0]}
                        </span>
                        <span className="text-[12.5px] text-gray-700">
                          {ME_NAME} ({t('admin-me')})
                        </span>
                      </span>
                      {(
                        soItem?.admins ??
                        (soKind === 'cat' || soKind === 'folder'
                          ? (so as Cat).admins
                          : undefined) ??
                        []
                      ).map((name) => (
                        <span
                          key={name}
                          className="inline-flex h-[34px] items-center gap-[7px] rounded-full bg-gray-50 pr-2 pl-1.5"
                        >
                          <span className="inline-flex size-6 items-center justify-center rounded-full bg-l-green text-[11px] font-bold text-on-pastel">
                            {name[0]}
                          </span>
                          <span className="text-[12.5px] text-gray-700">{name}</span>
                          <button
                            type="button"
                            aria-label={t('common-delete')}
                            onClick={() =>
                              patchSel({
                                admins: ((so as Item).admins ?? (so as Cat).admins ?? []).filter(
                                  (n) => n !== name,
                                ),
                              })
                            }
                            className="inline-flex size-[18px] items-center justify-center rounded-full text-gray-400 hover:text-destructive"
                          >
                            <XMini />
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => setPicker({ mode: 'admin', target: 'sel' })}
                        className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-dashed border-gray-300 px-[13px] text-[12.5px] font-semibold text-gray-500 hover:bg-gray-50"
                      >
                        <PlusMini /> {t('admin-add-manager')}
                      </button>
                    </div>
                    <span className="text-[11.5px] text-gray-400">{t('admin-managers-hint')}</span>
                  </Section>

                  {/* 게시판 설정 */}
                  {soKind === 'board' && soItem && (
                    <Section title={t('admin-board-settings')}>
                      <div className="flex flex-wrap items-center gap-[18px]">
                        <span className="w-[70px] flex-none text-[12.5px] text-gray-500">
                          {t('admin-type')}
                        </span>
                        {(['BOARD', 'PREVIEW', 'ALBUM'] as BType[]).map((bt) => (
                          <RadioRow
                            key={bt}
                            label={t(BTYPE_KEY[bt])}
                            on={soItem.btype === bt}
                            onClick={() => patchSel({ btype: bt })}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-[18px]">
                        <span className="w-[70px] flex-none text-[12.5px] text-gray-500">
                          {t('admin-alarm-new')}
                        </span>
                        <Toggle
                          on={!!soItem.alarm}
                          onClick={() => patchSel({ alarm: !soItem.alarm })}
                        />
                      </div>
                      <div className="flex items-center gap-[18px]">
                        <span className="w-[70px] flex-none text-[12.5px] text-gray-500">
                          {t('admin-active')}
                        </span>
                        <Toggle
                          on={soItem.active}
                          onClick={() => patchSel({ active: !soItem.active })}
                        />
                        <span className="text-xs text-gray-400">{t('admin-active-hint')}</span>
                      </div>
                    </Section>
                  )}

                  {/* 자료실 설정 */}
                  {soKind === 'drive' && soItem && (
                    <Section title={t('admin-drive-settings')}>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="w-[110px] flex-none text-[12.5px] text-gray-500">
                          {t('admin-file-max')}
                        </span>
                        {FILE_MAX_OPTS.map((v) => (
                          <CapChip
                            key={v}
                            label={v}
                            on={soItem.fileMax === v}
                            onClick={() => patchSel({ fileMax: v })}
                          />
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="w-[110px] flex-none text-[12.5px] text-gray-500">
                          {t('admin-total-max')}
                        </span>
                        {TOTAL_MAX_OPTS.map((v) => (
                          <CapChip
                            key={v}
                            label={v}
                            on={soItem.totalMax === v}
                            onClick={() => patchSel({ totalMax: v })}
                          />
                        ))}
                      </div>
                      <div className="flex flex-wrap items-start gap-3">
                        <span className="w-[110px] flex-none pt-1.5 text-[12.5px] text-gray-500">
                          {t('admin-ext-block')}
                        </span>
                        <div className="flex min-w-[200px] flex-1 flex-wrap items-center gap-1.5">
                          {(soItem.exts ?? []).map((x, i) => (
                            <span
                              key={x}
                              className="inline-flex h-[26px] items-center gap-1 rounded-full bg-l-gray pr-1 pl-2.5 text-xs font-semibold text-gray-700"
                            >
                              .{x}
                              <button
                                type="button"
                                aria-label={t('common-delete')}
                                onClick={() =>
                                  patchSel({ exts: (soItem.exts ?? []).filter((_, j) => j !== i) })
                                }
                                className="inline-flex size-[18px] items-center justify-center rounded-full text-gray-400 hover:text-destructive"
                              >
                                <XMini />
                              </button>
                            </span>
                          ))}
                          <input
                            value={extInput}
                            onChange={(e) =>
                              setExtInput(e.target.value.replace(/[^a-z0-9]/gi, '').toLowerCase())
                            }
                            onKeyDown={(e) => e.key === 'Enter' && addExt()}
                            placeholder="exe"
                            className="h-7 w-[70px] rounded-[5px] border border-gray-300 px-2.5 text-xs focus:border-primary focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={addExt}
                            className="inline-flex h-7 items-center rounded-[5px] bg-gray-100 px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                          >
                            {t('admin-add')}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-[110px] flex-none text-[12.5px] text-gray-500">
                          {t('admin-drive-alarm')}
                        </span>
                        <Toggle
                          on={!!soItem.alarm}
                          onClick={() => patchSel({ alarm: !soItem.alarm })}
                        />
                      </div>
                    </Section>
                  )}

                  {/* 저장 */}
                  <div className="flex justify-end border-t border-gray-100 pt-3.5">
                    <button
                      type="button"
                      onClick={() => showToast(t('admin-toast-saved'))}
                      className="inline-flex h-[38px] items-center rounded-[5px] bg-primary px-[18px] text-[13.5px] font-semibold text-white hover:bg-ov-blue-700"
                    >
                      {t('common-save')}
                    </button>
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-400">{t('admin-hint')}</span>
            </div>
          )}
        </div>
      </div>

      {/* 추가 모달 */}
      {addOpen && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--scrim-modal)] p-4"
          role="presentation"
        >
          <div className="flex max-h-[calc(100dvh-64px)] w-[420px] max-w-full flex-col rounded-lg bg-card shadow-[var(--shadow-modal)]">
            <div className="flex items-center border-b border-gray-100 px-5 pt-[18px] pb-3.5">
              <span className="text-[15px] font-bold">
                {t(TYPE_KEY[addKind])} {t('admin-add')}
              </span>
              <button
                type="button"
                aria-label={t('common-cancel')}
                onClick={() => setAddOpen(false)}
                className="ml-auto inline-flex size-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <XMini size={14} />
              </button>
            </div>
            <div className="flex flex-col gap-3.5 overflow-y-auto px-5 py-[18px]">
              {/* 위치 */}
              {addKind !== 'cat' && (
                <Field label={t('admin-loc')} required>
                  <span data-dd="aloc" className="relative block">
                    <button
                      type="button"
                      onClick={() => setALocOpen((v) => !v)}
                      className="flex h-10 w-full items-center gap-2 rounded-[5px] border border-gray-300 px-3"
                    >
                      <span className="flex-1 text-left text-[13.5px] text-gray-900">
                        {curLoc?.label}
                      </span>
                      <CaretDown
                        className={
                          aLocOpen ? 'rotate-180 transition-transform' : 'transition-transform'
                        }
                      />
                    </button>
                    {aLocOpen && (
                      <span className="absolute top-[calc(100%+4px)] right-0 left-0 z-[var(--z-dropdown)] block rounded-lg border border-gray-200 bg-card p-1 shadow-[var(--shadow-dropdown)]">
                        {locOpts.map((o) => (
                          <span
                            key={o.v}
                            onClick={() => {
                              setALoc(o.v)
                              setALocOpen(false)
                            }}
                            className={[
                              'flex h-[34px] cursor-pointer items-center rounded-[5px] px-2.5 text-[13px] hover:bg-gray-100',
                              aLoc === o.v ? 'font-semibold text-primary' : 'text-gray-800',
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
              <Field label={`${t(TYPE_KEY[addKind])}${t('admin-name-suffix')}`} required>
                <span className="relative block">
                  <input
                    value={aName}
                    onChange={(e) => setAName(Array.from(e.target.value).slice(0, 60).join(''))}
                    placeholder={t('admin-name-required')}
                    className="h-10 w-full rounded-[5px] border bg-card pr-16 pl-3 text-[13.5px] focus:outline-none"
                    style={{
                      borderColor:
                        aTried && !aName.trim()
                          ? 'var(--color-danger)'
                          : aName
                            ? 'var(--color-primary)'
                            : 'var(--color-gray-300)',
                    }}
                  />
                  <span className="absolute top-3 right-3 text-[11.5px] text-gray-400">
                    {Array.from(aName).length}/60
                  </span>
                </span>
                {aTried && !aName.trim() && (
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <ErrIcon /> {t('admin-name-required')}
                  </span>
                )}
              </Field>
              {/* 공개 범위 */}
              <Field label={t('admin-scope')} required>
                <div className="flex flex-wrap items-center gap-[18px]">
                  <RadioRow
                    label={t('admin-scope-all')}
                    on={aScope === 'all'}
                    onClick={() => setAScope('all')}
                  />
                  <RadioRow
                    label={t('admin-scope-org')}
                    on={aScope === 'org'}
                    onClick={() => setAScope('org')}
                  />
                  {aScope === 'org' && (
                    <button
                      type="button"
                      onClick={() => setPicker({ mode: 'scope', target: 'add' })}
                      className="inline-flex h-[30px] items-center gap-1.5 rounded-[5px] border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      <PersonIcon /> {aScopeLabel || t('admin-scope-default')}
                    </button>
                  )}
                </div>
              </Field>
              {/* 관리자 */}
              <Field label={t('admin-managers')}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex h-8 items-center gap-[7px] rounded-full bg-gray-50 pr-[11px] pl-[5px]">
                    <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-l-blue text-[10.5px] font-bold text-on-pastel">
                      {ME_NAME[0]}
                    </span>
                    <span className="text-[12.5px] text-gray-700">
                      {ME_NAME} ({t('admin-me')})
                    </span>
                  </span>
                  {aAdmins.map((name) => (
                    <span
                      key={name}
                      className="inline-flex h-8 items-center gap-[7px] rounded-full bg-gray-50 pr-[7px] pl-[5px]"
                    >
                      <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-l-green text-[10.5px] font-bold text-on-pastel">
                        {name[0]}
                      </span>
                      <span className="text-[12.5px] text-gray-700">{name}</span>
                      <button
                        type="button"
                        aria-label={t('common-delete')}
                        onClick={() => setAAdmins((prev) => prev.filter((n) => n !== name))}
                        className="inline-flex size-[17px] items-center justify-center rounded-full text-gray-400 hover:text-destructive"
                      >
                        <XMini />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPicker({ mode: 'admin', target: 'add' })}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-gray-300 px-3 text-xs font-semibold text-gray-500 hover:bg-gray-50"
                  >
                    <PlusMini /> {t('admin-add-manager')}
                  </button>
                </div>
              </Field>
              {/* 게시판 전용 */}
              {addKind === 'board' && (
                <>
                  <Field label={t('admin-board-desc')} optional>
                    <span className="relative block">
                      <textarea
                        value={aDesc}
                        onChange={(e) =>
                          setADesc(Array.from(e.target.value).slice(0, 300).join(''))
                        }
                        placeholder={t('admin-board-desc-ph')}
                        rows={2}
                        className="w-full resize-none rounded-[5px] border border-gray-300 px-3 py-2 text-[13.5px] focus:border-primary focus:outline-none"
                      />
                      <span className="absolute right-3 bottom-2.5 text-[11.5px] text-gray-400">
                        {Array.from(aDesc).length}/300
                      </span>
                    </span>
                  </Field>
                  <Field label={t('admin-type')}>
                    <div className="flex flex-wrap gap-[18px]">
                      {(['BOARD', 'PREVIEW', 'ALBUM'] as BType[]).map((bt) => (
                        <RadioRow
                          key={bt}
                          label={t(BTYPE_KEY[bt])}
                          on={aBtype === bt}
                          onClick={() => setABtype(bt)}
                        />
                      ))}
                    </div>
                  </Field>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-semibold text-gray-700">
                      {t('admin-alarm-new')}
                    </span>
                    <Toggle on={aAlarm} onClick={() => setAAlarm((v) => !v)} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-semibold text-gray-700">
                      {t('admin-active')}
                    </span>
                    <Toggle on={aActive} onClick={() => setAActive((v) => !v)} />
                    <span className="text-xs text-gray-400">{t('admin-active-hint')}</span>
                  </div>
                </>
              )}
              {/* 자료실 전용 */}
              {addKind === 'drive' && (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="w-[110px] flex-none text-[13px] font-semibold text-gray-700">
                      {t('admin-file-max')}
                    </span>
                    {FILE_MAX_OPTS.map((v) => (
                      <CapChip
                        key={v}
                        label={v}
                        on={aFileMax === v}
                        onClick={() => setAFileMax(v)}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="w-[110px] flex-none text-[13px] font-semibold text-gray-700">
                      {t('admin-total-max')}
                    </span>
                    {TOTAL_MAX_OPTS.map((v) => (
                      <CapChip
                        key={v}
                        label={v}
                        on={aTotalMax === v}
                        onClick={() => setATotalMax(v)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-[110px] flex-none text-[13px] font-semibold text-gray-700">
                      {t('admin-drive-alarm')}
                    </span>
                    <Toggle on={aAlarm} onClick={() => setAAlarm((v) => !v)} />
                  </div>
                  <Field label={`${t('admin-ext-block')} `} optional>
                    <input
                      value={aExt}
                      onChange={(e) => setAExt(e.target.value)}
                      placeholder={t('admin-ext-ph-modal')}
                      className="h-10 w-full rounded-[5px] border border-gray-300 px-3 text-[13.5px] focus:border-primary focus:outline-none"
                    />
                  </Field>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 pt-3.5 pb-[18px]">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="inline-flex h-[38px] items-center rounded-[5px] border border-gray-200 bg-card px-4 text-[13.5px] font-semibold text-gray-800 hover:bg-gray-100"
              >
                {t('common-cancel')}
              </button>
              <button
                type="button"
                onClick={aSave}
                className="inline-flex h-[38px] items-center rounded-[5px] bg-primary px-[18px] text-[13.5px] font-semibold text-white hover:bg-ov-blue-700"
              >
                {t('admin-add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 조직도 피커 (열릴 때마다 새로 마운트되어 선택 state 초기화) */}
      {picker && (
        <OrgPickerModal
          open
          mode={picker.mode}
          onClose={() => setPicker(null)}
          onConfirm={onPickerConfirm}
        />
      )}

      <Toast toast={toast} onClose={hideToast} />
    </div>
  )
}

// ── 소형 컴포넌트 ──
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
      <span className="text-[13px] font-bold">{title}</span>
      {children}
    </div>
  )
}

function Field({
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
      <span className="text-[13px] font-semibold text-gray-700">
        {label}
        {required && <span className="text-destructive"> *</span>}
        {optional && <span className="font-normal text-gray-400"> {t('admin-ext-optional')}</span>}
      </span>
      {children}
    </div>
  )
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

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[34px] w-full items-center rounded-[5px] px-2.5 text-[13px] text-gray-800 hover:bg-gray-100"
    >
      {children}
    </button>
  )
}

function RadioRow({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-[7px]">
      <span
        className="size-[17px] flex-none rounded-full"
        style={{
          border: on ? '5px solid var(--color-primary)' : '1.5px solid var(--color-gray-300)',
        }}
      />
      <span className="text-[13px]">{label}</span>
    </button>
  )
}

function CapChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold',
        on ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative h-[22px] w-[38px] flex-none rounded-full transition-colors"
      style={{ background: on ? 'var(--color-primary)' : 'var(--color-gray-200)' }}
      aria-pressed={on}
    >
      <span
        className="absolute top-[3px] size-4 rounded-full bg-white shadow transition-all"
        style={{ left: on ? '19px' : '3px' }}
      />
    </button>
  )
}

function NodeIcon({ kind, active }: { kind: NodeKind; active: boolean }) {
  const c = active ? 'var(--color-primary)' : 'var(--color-gray-500)'
  if (kind === 'cat')
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke={c}
        strokeWidth="1.8"
        strokeLinejoin="round"
        className="flex-none"
      >
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 9.5h16" />
      </svg>
    )
  if (kind === 'folder')
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-warning)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        className="flex-none"
      >
        <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2.5H19A1.5 1.5 0 0 1 20.5 9.5v9A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5z" />
      </svg>
    )
  if (kind === 'drive')
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke={c}
        strokeWidth="1.7"
        strokeLinejoin="round"
        className="flex-none"
      >
        <path d="M3.5 13.5L6 5.5h12l2.5 8" />
        <rect x="3.5" y="13.5" width="17" height="5.5" rx="1.5" />
        <path d="M16.5 16.2h.01M13.5 16.2h.01" />
      </svg>
    )
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth="1.7"
      strokeLinejoin="round"
      className="flex-none"
    >
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5" />
    </svg>
  )
}

function ScopedIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-gray-400)"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="flex-none"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.9-2.8 3-4.2 5.5-4.2s4.6 1.4 5.5 4.2" />
      <path d="M15.5 5.4a3.2 3.2 0 0 1 0 5.2M17.8 14.9c1.4.7 2.4 2 2.9 3.9" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg
      width="13"
      height="13"
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

function PlusIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function PlusMini() {
  return (
    <svg
      width="12"
      height="12"
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

function CaretDown({ className }: { className?: string }) {
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
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
    </svg>
  )
}

function XMini({ size = 9 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function ErrIcon() {
  return (
    <svg
      width="12"
      height="12"
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

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none"
    >
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  )
}
