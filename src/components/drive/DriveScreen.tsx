import { useEffect, useRef, useState } from 'react'

import { useSearch } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { Toast } from '@/components/common/Toast'
import {
  BookmarkIcon,
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  ImageIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from '@/components/common/icons'
import { useToast } from '@/components/common/useToast'
import {
  type DriveFile,
  EXT_BG,
  EXT_BG_DEFAULT,
  ME_NAME,
  STORAGE,
  fmtDate,
  fmtSize,
} from '@/components/drive/driveData'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useCategories } from '@/hooks/useCategories'
import { useDriveFiles } from '@/hooks/useDriveFiles'
import { getCurrentUserId } from '@/lib/authStorage'
import type { ApiDriveFile } from '@/types/drive'
import { findBoard } from '@/utils/category'

// API 파일 → 화면 뷰모델. 목록 응답엔 북마크 상태가 없어 bm은 로컬 오버레이로 채움.
function toFile(f: ApiDriveFile, meId: number | null): DriveFile {
  const ext = (f.extension ?? '').toUpperCase()
  return {
    id: f.id,
    name: f.origin_file_name,
    ext,
    tagBg: EXT_BG[ext] ?? EXT_BG_DEFAULT,
    by: f.user?.name ?? '',
    mine: meId != null && f.user_id === meId,
    date: fmtDate(f.created_at),
    size: fmtSize(f.size),
    state: 'idle',
  }
}

export function DriveScreen() {
  const { t } = useTranslation()
  // b = 사이드바에서 넘어온 자료실 게시판 id. 없으면 접근 가능한 전체 자료실.
  const { b } = useSearch({ from: '/drive' })
  const { data: tree } = useCategories()

  const { data, isLoading, isError, refetch } = useDriveFiles({
    board_id: b,
    sort: { by: 'created_at', order: 'desc' },
  })

  // 로컬 데모 오버레이 (업로드/삭제/북마크는 별도 API라 미배선 — 화면 동작만 데모)
  const [uploads, setUploads] = useState<DriveFile[]>([])
  const [deletedIds, setDeletedIds] = useState<Set<string | number>>(new Set())
  const [bookmarks, setBookmarks] = useState<Set<string | number>>(new Set())
  const [checked, setChecked] = useState<Set<string | number>>(new Set())
  const [delOpen, setDelOpen] = useState(false)
  const [dlOpen, setDlOpen] = useState(false)
  const [dlCancelAsk, setDlCancelAsk] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  // 미리보기 오버레이가 떠 있는 동안 배경 스크롤 잠금
  useBodyScrollLock(!!preview)
  const { toast, showToast, hideToast } = useToast()

  const meId = getCurrentUserId()
  const apiFiles = (data ?? []).map((f) => toFile(f, meId))
  const driveFiles: DriveFile[] = [...uploads, ...apiFiles]
    .filter((f) => !deletedIds.has(f.id))
    .map((f) => ({ ...f, bm: bookmarks.has(f.id) || f.bm }))
  const isEmpty = !isLoading && !isError && driveFiles.length === 0

  const uploadsRef = useRef(uploads)
  useEffect(() => {
    uploadsRef.current = uploads
  }, [uploads])
  const upRef = useRef<number>(undefined)
  useEffect(() => () => window.clearInterval(upRef.current), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPreview(null)
      setDelOpen(false)
      setDlOpen(false)
      setDlCancelAsk(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const curName = findBoard(tree, b)?.title ?? t('nav-drive')
  const checkedFiles = driveFiles.filter((f) => checked.has(f.id))
  const selCount = checkedFiles.length
  const selHasOthers = checkedFiles.some((f) => !f.mine)
  const allChecked = driveFiles.length > 0 && checkedFiles.length === driveFiles.length
  const allMixed = selCount > 0 && !allChecked

  const toggleFile = (id: string | number) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () =>
    setChecked((prev) => {
      if (allChecked) {
        const next = new Set(prev)
        driveFiles.forEach((f) => next.delete(f.id))
        return next
      }
      const next = new Set(prev)
      driveFiles.forEach((f) => next.add(f.id))
      return next
    })

  const setUpload = (id: string | number, patch: Partial<DriveFile>) =>
    setUploads((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))

  const upStart = () => {
    const id = Date.now()
    const newFile: DriveFile = {
      id,
      name: `새 업로드 파일_${String(id).slice(-4)}.pdf`,
      ext: 'PDF',
      tagBg: 'bg-l-red',
      by: ME_NAME,
      mine: true,
      date: '오늘',
      size: '2.1MB',
      state: 'up',
      pct: 0,
    }
    setUploads((prev) => [newFile, ...prev])
    window.clearInterval(upRef.current)
    upRef.current = window.setInterval(() => {
      const cur = uploadsRef.current.find((x) => x.id === id)
      if (!cur) {
        window.clearInterval(upRef.current)
        return
      }
      const pct = (cur.pct ?? 0) + 25
      if (pct >= 100) {
        window.clearInterval(upRef.current)
        setUpload(id, { state: 'done', pct: 100 })
        showToast(t('drive-up-toast', { n: 1 }))
        window.setTimeout(() => setUpload(id, { state: 'idle' }), 1600)
      } else {
        setUpload(id, { pct })
      }
    }, 350)
  }

  const doDelete = () => {
    const ids = checkedFiles.filter((f) => f.mine).map((f) => f.id)
    setDeletedIds((prev) => new Set([...prev, ...ids]))
    setUploads((prev) => prev.filter((f) => !ids.includes(f.id)))
    setChecked(new Set())
    setDelOpen(false)
    showToast(t('drive-deleted'))
  }
  const toggleBm = (f: DriveFile) => {
    setBookmarks((prev) => {
      const next = new Set(prev)
      if (next.has(f.id)) next.delete(f.id)
      else next.add(f.id)
      return next
    })
    showToast(t(f.bm ? 'drive-bm-remove' : 'drive-bm-add'))
  }

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col">
      {/* 헤더: 자료실명 + 자료 수 + 저장 용량 게이지 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-lg font-extrabold tracking-title">{curName}</span>
        <span className="text-s text-gray-400">
          {t('drive-file-count', { n: driveFiles.length })}
        </span>
        <div className="ml-auto flex w-[150px] flex-col gap-1.5">
          <div className="flex items-center justify-between text-2xs text-gray-500">
            <span>{t('drive-storage')}</span>
            <span className="font-semibold">
              {STORAGE.used} / {STORAGE.total}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-primary" style={{ width: `${STORAGE.pct}%` }} />
          </div>
        </div>
      </div>

      {/* 선택 툴바 + 업로드 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {selCount > 0 && (
          <>
            <span className="text-s text-gray-600">
              <b className="text-primary">{selCount}</b>
              {t('drive-selected-suffix')}
            </span>
            <button
              type="button"
              onClick={() => setDlOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-card px-3 text-s font-semibold text-gray-700 hover:bg-gray-100"
            >
              <DownloadIcon className="size-3" /> {t('file-download')}
            </button>
            <button
              type="button"
              disabled={selHasOthers}
              onClick={() => !selHasOthers && setDelOpen(true)}
              className={[
                'inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-card px-3 text-s font-semibold',
                selHasOthers
                  ? 'cursor-not-allowed text-gray-300'
                  : 'text-destructive hover:bg-destructive-bg',
              ].join(' ')}
            >
              <TrashIcon /> {t('common-delete')}
            </button>
            {selHasOthers && <span className="text-xs text-gray-400">{t('drive-del-note')}</span>}
          </>
        )}
        <button
          type="button"
          onClick={upStart}
          className="ml-auto inline-flex h-8 flex-none items-center gap-1.5 rounded-md bg-primary px-3.5 text-s font-semibold text-white hover:bg-ov-blue-700"
        >
          <UploadIcon className="size-3" /> {t('drive-upload')}
        </button>
      </div>

      {/* 파일 테이블 */}
      <div className="mt-3 overflow-x-auto bg-card">
        <div className="min-w-[720px]">
          {/* 헤더 행 */}
          <div className="flex h-10 items-center gap-2.5 border-b border-gray-200 px-1 text-xs text-gray-500">
            <span className="flex w-[26px] flex-none justify-center">
              <Checkbox
                checked={allChecked}
                mixed={allMixed}
                onClick={toggleAll}
                active={selCount > 0}
              />
            </span>
            <span className="w-[46px] flex-none">{t('col-ext')}</span>
            <span className="min-w-0 flex-1">{t('col-filename')}</span>
            <span className="w-[100px] flex-none">{t('col-uploader')}</span>
            <span className="w-[92px] flex-none">{t('col-regdate')}</span>
            <span className="w-[74px] flex-none">{t('drive-col-size')}</span>
            <span className="w-[104px] flex-none" />
          </div>

          {/* 파일 행 / 로딩·에러·빈 상태 */}
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex min-h-[46px] items-center gap-2.5 border-b border-gray-100 px-1"
              >
                <span className="w-[26px] flex-none" />
                <span className="h-5 w-[38px] flex-none animate-pulse rounded bg-gray-100" />
                <span className="h-3.5 flex-1 animate-pulse rounded bg-gray-100" />
                <span className="h-3 w-24 flex-none animate-pulse rounded bg-gray-100" />
              </div>
            ))
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 px-1 py-14 text-center">
              <span className="text-s text-gray-400">{t('list-error')}</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-card px-4 text-s font-semibold text-gray-700 hover:bg-gray-100"
              >
                {t('common-retry')}
              </button>
            </div>
          ) : isEmpty ? (
            <div className="px-1 py-14 text-center text-s text-gray-400">{t('drive-empty')}</div>
          ) : (
            driveFiles.map((f) => (
              <div
                key={f.id}
                className={[
                  'flex items-center gap-2.5 border-b border-gray-100 px-1 hover:bg-gray-100',
                  f.state === 'up' ? 'min-h-[52px]' : 'min-h-[46px]',
                  checked.has(f.id) ? 'bg-gray-50' : '',
                ].join(' ')}
              >
                <span className="flex w-[26px] flex-none justify-center">
                  <Checkbox
                    checked={checked.has(f.id)}
                    onClick={() => toggleFile(f.id)}
                    active={checked.has(f.id)}
                  />
                </span>
                <span className="w-[46px] flex-none">
                  <span
                    className={`inline-flex h-[19px] w-[38px] items-center justify-center rounded text-2xs font-bold text-on-pastel ${f.tagBg}`}
                  >
                    {f.ext}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1 pr-3">
                  <span
                    className={[
                      'truncate text-s',
                      f.state === 'up' ? 'text-gray-500' : 'text-gray-900',
                    ].join(' ')}
                  >
                    {f.name}
                  </span>
                  {f.state === 'up' && (
                    <span className="block h-1 overflow-hidden rounded-full bg-gray-100">
                      <span
                        className="block h-full rounded-full bg-primary transition-all"
                        style={{ width: `${f.pct ?? 0}%` }}
                      />
                    </span>
                  )}
                </span>
                <span className="w-[100px] flex-none truncate text-xs text-gray-600">{f.by}</span>
                <span className="w-[92px] flex-none text-xs text-gray-500">{f.date}</span>
                <span className="w-[74px] flex-none text-xs text-gray-500">{f.size}</span>
                <span className="flex w-[104px] flex-none items-center justify-end gap-0.5 pr-2">
                  <button
                    type="button"
                    onClick={() => toggleBm(f)}
                    aria-label={t('nav-favorites')}
                    className={`inline-flex size-[29px] items-center justify-center rounded-md hover:bg-gray-100 ${f.bm ? 'text-warning' : 'text-gray-400'}`}
                  >
                    <BookmarkIcon className="size-3.5" filled={!!f.bm} />
                  </button>
                  {f.state === 'idle' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreview(f.name)}
                        aria-label={t('file-preview')}
                        className="inline-flex size-[27px] items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                      >
                        <EyeIcon className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDlOpen(true)}
                        aria-label={t('file-download')}
                        className="inline-flex size-[27px] items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                      >
                        <DownloadIcon className="size-3" />
                      </button>
                    </>
                  )}
                  {f.state === 'up' && (
                    <span className="text-xs font-semibold whitespace-nowrap text-primary">
                      {t('drive-up-progress', { n: f.pct ?? 0 })}
                    </span>
                  )}
                  {f.state === 'done' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-success)]">
                      <CheckIcon /> {t('drive-up-done')}
                    </span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      <span className="mt-2.5 block text-xs text-gray-400">{t('drive-demo-note')}</span>

      {/* 삭제 확인 모달 */}
      {delOpen && (
        <Modal onClose={() => setDelOpen(false)}>
          <div className="flex w-[330px] flex-col items-center gap-2 rounded-lg bg-card px-[22px] pt-[26px] pb-[18px] shadow-[var(--shadow-modal)]">
            <span className="inline-flex size-[42px] items-center justify-center rounded-full bg-destructive-bg text-destructive">
              <TrashIcon size={20} />
            </span>
            <span className="mt-1 text-center text-sm font-semibold">
              {t('drive-del-confirm', { n: selCount })}
            </span>
            <span className="text-center text-s text-gray-500">{t('drive-del-sub')}</span>
            <div className="mt-2.5 flex w-full gap-2">
              <button
                type="button"
                onClick={() => setDelOpen(false)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-gray-200 bg-card text-sm font-semibold text-gray-800 hover:bg-gray-100"
              >
                {t('common-cancel')}
              </button>
              <button
                type="button"
                onClick={doDelete}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-destructive text-sm font-semibold text-white hover:bg-destructive-hover"
              >
                {t('common-delete')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 다운로드 진행 모달 */}
      {dlOpen && (
        <Modal onClose={() => setDlCancelAsk(true)}>
          <div className="flex w-[340px] flex-col gap-3.5 rounded-lg bg-card px-5 pt-[22px] pb-[18px] shadow-[var(--shadow-modal)]">
            <div className="flex items-center">
              <span className="text-sm font-bold">{t('drive-dl-title')}</span>
              <button
                type="button"
                aria-label={t('common-cancel')}
                onClick={() => setDlCancelAsk(true)}
                className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
              >
                <XIcon />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-s">
                <span className="text-gray-600">{t('drive-dl-progress')}</span>
                <span className="flex-none text-gray-500">82 %</span>
              </div>
              <span className="block h-1.5 overflow-hidden rounded-full bg-gray-100">
                <span className="block h-full w-[82%] rounded-full bg-primary" />
              </span>
            </div>
            {dlCancelAsk && (
              <div className="flex flex-col items-center gap-3 border-t border-gray-100 pt-3.5">
                <span className="text-center text-sm font-semibold">
                  {t('drive-dl-cancel-ask')}
                </span>
                <div className="flex w-full gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDlOpen(false)
                      setDlCancelAsk(false)
                      showToast(t('drive-dl-canceled'))
                    }}
                    className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-gray-200 bg-card text-s font-semibold text-gray-800 hover:bg-gray-100"
                  >
                    {t('common-cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDlCancelAsk(false)}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary text-s font-semibold text-white hover:bg-ov-blue-700"
                  >
                    <DownloadIcon className="size-3" /> {t('drive-dl-continue')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 미리보기 라이트박스 */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-[var(--z-modal)] flex cursor-zoom-out items-center justify-center bg-black/[0.78]"
          role="presentation"
        >
          <div className="absolute top-3.5 right-3.5 flex gap-1.5">
            <span className="inline-flex size-[34px] items-center justify-center rounded-md bg-white/15 text-white">
              <DownloadIcon className="size-3" />
            </span>
            <button
              type="button"
              aria-label={t('common-cancel')}
              onClick={() => setPreview(null)}
              className="inline-flex size-[34px] items-center justify-center rounded-md bg-white/15 text-white"
            >
              <XIcon />
            </button>
          </div>
          <div className="flex h-[62%] w-[min(58%,520px)] items-center justify-center rounded-lg bg-l-purple text-on-pastel">
            <ImageIcon size={44} className="opacity-70" />
          </div>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-s text-white/85">
            {preview}
          </span>
        </div>
      )}

      <Toast toast={toast} onClose={hideToast} />
    </div>
  )
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useBodyScrollLock(true)
  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--scrim-modal)] p-4"
      role="presentation"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}

function Checkbox({
  checked,
  mixed,
  onClick,
  active,
}: {
  checked: boolean
  mixed?: boolean
  onClick: () => void
  active: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex size-[15px] flex-none items-center justify-center rounded border-[1.5px] text-white',
        active
          ? 'border-primary bg-primary'
          : 'border-gray-300 bg-card hover:border-gray-400 hover:bg-gray-50',
      ].join(' ')}
    >
      {checked && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.5 12.5l5 5 10-11" />
        </svg>
      )}
      {!checked && mixed && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
        >
          <path d="M6 12h12" />
        </svg>
      )}
    </button>
  )
}
