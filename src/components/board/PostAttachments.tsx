import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { ATTACHMENT_PREVIEW_ROWS } from './constants'
import { Modal } from '@/components/common/Modal'
import {
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  DashIcon,
  DownloadIcon,
  EyeIcon,
  PaperclipIcon,
} from '@/components/common/icons'
import { fmtSize } from '@/components/drive/driveData'
import { extBg } from '@/constants/fileExt'
import type { PostFile } from '@/types/post'

/** 확장자 칩·이름·용량 — 접힌 목록과 전체 모달이 같은 모양을 써야 한다. */
function FileMeta({ f, extFallback }: { f: PostFile; extFallback: string }) {
  return (
    <>
      <span
        className={`inline-flex h-5 w-[38px] flex-none items-center justify-center overflow-hidden rounded text-2xs font-bold text-on-pastel ${extBg(f.extension)}`}
      >
        {/* 확장자가 없는 파일(Makefile 등)은 칩을 비우지 않고 「파일」로 표시한다 */}
        <span className="truncate px-0.5">{(f.extension ?? '').toUpperCase() || extFallback}</span>
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-s text-gray-800">
        {f.origin_file_name}
      </span>
      {f.size !== undefined && (
        <span className="flex-none text-xs text-gray-400">{fmtSize(f.size)}</span>
      )}
    </>
  )
}

function PreviewBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex size-7 flex-none items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-primary"
    >
      <EyeIcon className="size-3" />
    </button>
  )
}

function DownloadBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex size-7 flex-none items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-primary"
    >
      <DownloadIcon />
    </button>
  )
}

/**
 * 첨부 박스. 정본은 3행만 보이고 나머지는 「외 N개 모두 보기」 → 전체 모달이다
 * (개선안 통합 앱.dc.html:528-541 · :1507-1540).
 */
export function PostAttachments({
  files,
  onDownload,
  onPreview,
}: {
  files: PostFile[]
  /** 여러 건이면 zip 으로 묶인다 — 판정은 useDriveDownload 안에 있다. */
  onDownload: (targets: PostFile[]) => void
  /** 내려받지 않고 보기 — 자료실과 같은 창을 쓴다(components/common/FilePreviewModal). */
  onPreview: (file: PostFile) => void
}) {
  const { t } = useTranslation()
  const [allOpen, setAllOpen] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const closeAll = useCallback(() => {
    setAllOpen(false)
    setChecked(new Set())
  }, [])

  // 공용 Modal 은 ESC 를 «호출부»에 맡긴다(중첩 모달에서 어느 것이 닫힐지 호출부가 정해야 하므로).
  // 이걸 빠뜨려 첨부 전체 모달만 ESC 로 안 닫혔다 — 이 화면의 다른 모달은 전부 처리한다.
  useEffect(() => {
    if (!allOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [allOpen, closeAll])

  // ⚠ 훅은 전부 이 위에 둔다 — 조기 반환 뒤에 두면 렌더마다 훅 순서가 달라진다
  //   (react-hooks/rules-of-hooks).
  if (files.length === 0) return null
  const rows = files.slice(0, ATTACHMENT_PREVIEW_ROWS)
  const hidden = files.length - rows.length
  const extFallback = t('file-generic')

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allChecked = checked.size === files.length
  const someChecked = checked.size > 0 && !allChecked
  const selected = files.filter((f) => checked.has(f.id))

  return (
    <>
      <div className="mt-2 flex flex-col overflow-hidden rounded-md border border-gray-200">
        <div className="flex h-[42px] items-center gap-[7px] border-b border-gray-200 bg-gray-50 px-[15px]">
          <PaperclipIcon className="size-3.5 flex-none text-gray-500" />
          <span className="flex-none text-s font-bold whitespace-nowrap">
            {t('detail-attachments')} <span className="text-primary">{files.length}</span>
          </span>
          <button
            type="button"
            onClick={() => onDownload(files)}
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-primary"
          >
            <DownloadIcon className="size-3.5" />
            {t('detail-att-all')}
          </button>
        </div>

        {rows.map((f, i) => (
          <div
            key={f.id}
            // ⚠ `last:border-b-0` 을 쓰면 안 된다 — 전체 모달에서는 행마다 부모가 달라
            //   모든 행이 «마지막»이 되어 구분선이 전부 사라진다. 인덱스로 명시한다.
            className={`flex h-[46px] items-center gap-[11px] px-[15px] hover:bg-gray-100 ${
              i < rows.length - 1 || hidden > 0 ? 'border-b border-gray-100' : ''
            }`}
          >
            <FileMeta f={f} extFallback={extFallback} />
            <PreviewBtn label={t('file-preview')} onClick={() => onPreview(f)} />
            <DownloadBtn
              label={`${f.origin_file_name} ${t('detail-att-dl-one')}`}
              onClick={() => onDownload([f])}
            />
          </div>
        ))}

        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setAllOpen(true)}
            // 정본: 모바일 h44 → 데스크톱 h42
            className="flex h-[44px] items-center justify-center gap-1.5 text-s font-semibold text-gray-600 hover:bg-gray-100 hover:text-primary min-[631px]:h-[42px]"
          >
            {t('detail-att-more', { n: hidden })}
            <ChevronIcon className="size-3" dir="right" small />
          </button>
        )}
      </div>

      {allOpen && (
        <Modal onClose={closeAll} labelledBy="att-all-title">
          <div className="flex max-h-[80vh] w-[min(520px,92vw)] flex-col overflow-hidden rounded-lg bg-card shadow-[var(--shadow-modal)]">
            {/* 정본 :1509-1513 — 헤더는 고정 높이가 아니라 padding 18/20/14, 제목 16/700 */}
            <div className="flex flex-none items-center gap-2.5 border-b border-gray-100 px-5 pt-[18px] pb-[14px]">
              <span id="att-all-title" className="text-base font-bold">
                {t('detail-attachments')} <span className="text-primary">{files.length}</span>
              </span>
              <button
                type="button"
                aria-label={t('common-close')}
                onClick={closeAll}
                className="ml-auto inline-flex size-[30px] flex-none items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
              >
                <CloseIcon />
              </button>
            </div>

            {/* 정본 :1517-1521 — 체크박스 + 「전체 선택」 «글자» + 「N개 선택」.
                글자를 aria-label 로만 넣으면 눈으로는 무엇을 고르는지 알 수 없다. */}
            <div className="flex h-10 flex-none items-center gap-[9px] border-b border-gray-100 px-5">
              <button
                type="button"
                role="checkbox"
                aria-checked={allChecked ? true : someChecked ? 'mixed' : false}
                onClick={() => setChecked(allChecked ? new Set() : new Set(files.map((f) => f.id)))}
                className="inline-flex items-center gap-2 rounded-md py-1 pr-2 text-s text-gray-800 hover:text-primary"
              >
                <Box checked={allChecked} mixed={someChecked} />
                {t('detail-att-select-all')}
              </button>
              <span className="ml-auto text-xs text-gray-500">
                <b className="font-semibold text-primary">{checked.size}</b>
                {t('drive-selected-suffix')}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {files.map((f, i) => {
                const on = checked.has(f.id)
                return (
                  <div
                    key={f.id}
                    className={`flex h-[46px] items-center gap-2.5 pr-5 hover:bg-gray-100 ${
                      i < files.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    {/* 정본은 «행 전체»가 토글이다(:1524 `onClick="{{ f.toggle }}"`).
                        다운로드 버튼을 그 안에 중첩하면 버튼 안의 버튼이 되므로 형제로 둔다. */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-label={f.origin_file_name}
                      onClick={() => toggle(f.id)}
                      className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-5"
                    >
                      <Box checked={on} />
                      <FileMeta f={f} extFallback={extFallback} />
                    </button>
                    <PreviewBtn label={t('file-preview')} onClick={() => onPreview(f)} />
                    <DownloadBtn
                      label={`${f.origin_file_name} ${t('detail-att-dl-one')}`}
                      onClick={() => onDownload([f])}
                    />
                  </div>
                )
              })}
            </div>

            <div className="flex flex-none gap-2 border-t border-gray-100 px-5 pt-[13px] pb-4">
              <button
                type="button"
                onClick={() => onDownload(files)}
                className="inline-flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-card text-s font-semibold text-gray-800 hover:bg-gray-100"
              >
                <DownloadIcon className="size-3.5" />
                {t('detail-att-all')}
              </button>
              <button
                type="button"
                onClick={() => onDownload(selected)}
                disabled={selected.length === 0}
                className="inline-flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-md bg-primary text-s font-semibold text-white hover:bg-ov-blue-700 disabled:bg-gray-100 disabled:text-gray-300"
              >
                <DownloadIcon className="size-3.5" />
                {t('detail-att-selected', { n: selected.length })}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

/** 체크 표시 «모양» — 색만으로 상태를 전하지 않기 위한 형태 신호. 정본 15px/radius 4. */
function Box({ checked, mixed }: { checked: boolean; mixed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={[
        // 정본 :1519·:1525 — 모달 안 체크는 17×17 (목록의 공용 Checkbox 15px 과 다르다)
        'inline-flex size-[17px] flex-none items-center justify-center rounded border-[1.5px] text-white',
        checked || mixed ? 'border-primary bg-primary' : 'border-gray-300 bg-card',
      ].join(' ')}
    >
      {checked ? <CheckIcon strokeWidth={3.4} /> : mixed ? <DashIcon /> : null}
    </span>
  )
}
