import { useRef, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { Modal } from '@/components/common/Modal'
import { CheckIcon, ErrorIcon, UploadIcon, XMini } from '@/components/common/icons'
import { fmtSize } from '@/components/drive/driveData'
import type { UploadRow } from '@/hooks/useDriveUpload'
import {
  MAX_UPLOAD_FILES,
  type UploadLimits,
  type UploadReject,
  convertHeicFiles,
  isHeic,
  validateUpload,
} from '@/utils/driveUpload'

/* 자료실 업로드. 대상 폴더는 «현재 보고 있는 폴더»로 고정한다
   (레거시의 드라이브·폴더 선택 드롭다운은 정본에 없다 — 화면이 이미 그 폴더다). */
export function UploadModal({
  limits,
  rows,
  running,
  onAdd,
  onRemove,
  onStart,
  onRetry,
  onClose,
}: {
  limits: UploadLimits
  rows: UploadRow[]
  running: boolean
  onAdd: (files: File[]) => void
  onRemove: (key: string) => void
  onStart: () => void
  onRetry: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [reject, setReject] = useState<UploadReject | null>(null)
  const [dragging, setDragging] = useState(false)
  const [converting, setConverting] = useState(false)

  const done = rows.length > 0 && rows.every((r) => r.status === 'success' || r.status === 'fail')
  const failed = rows.filter((r) => r.status === 'fail')
  const succeeded = rows.filter((r) => r.status === 'success')

  // 한 건이라도 걸리면 묶음 전체를 받지 않는다(레거시와 동일) — 무엇이 빠졌는지 모른 채 올리는 사고를 막는다.
  // ⚠ HEIC 변환을 «고르는 시점»에 끝낸다. 변환은 이름·확장자·크기를 모두 바꾸는데 presign 은
  // 변환된 값으로 나가므로, 원본으로 검증하면 프론트와 서버 판정이 양방향으로 어긋난다
  // (4MB HEIC → 6MB jpg 는 통과시켰다가 서버가 거부 / except_extension=HEIC 는 프론트가
  // 거부하는데 서버가 받는 값은 jpg). 목록에 보이는 크기·확장자도 실제 올라가는 것과 맞는다.
  const take = async (list: FileList | null) => {
    const picked = [...(list ?? [])]
    if (inputRef.current) inputRef.current.value = ''
    if (picked.length === 0) return
    setConverting(picked.some(isHeic))
    const files = await convertHeicFiles(picked)
    setConverting(false)
    // 이미 «성공한» 행은 서버에 다시 보내지 않는다(useDriveUpload 의 targets 가 제외).
    // 상한 계산에 넣으면 서버가 이미 반영한 usedSize 와 이중 계상돼,
    // 실제로는 여유가 있는데도 「용량이 부족합니다」로 묶음 전체가 거부된다.
    const pending = rows.filter((r) => r.status !== 'success').map((r) => r.file)
    const bad = validateUpload(files, limits, pending)
    setReject(bad)
    if (!bad) onAdd(files)
  }

  const rejectText = (r: UploadReject) => {
    if (r.code === 'count') return t('drive-up-err-count', { n: MAX_UPLOAD_FILES })
    if (r.code === 'quota') return t('drive-up-err-quota')
    const names = r.names.join(', ')
    return r.code === 'extension'
      ? `${t('drive-up-err-extension')} (${names})`
      : `${t('drive-up-err-per-file')} (${names})`
  }

  return (
    // 스크림 클릭은 진행 중 무효(오조작 방지). 탈출은 X 버튼과 ESC 로 한다.
    <Modal onClose={running ? () => {} : onClose} labelledBy="drive-up-title">
      <div className="flex max-h-[80dvh] w-[min(92vw,900px)] flex-col rounded-lg bg-card shadow-[var(--shadow-modal)]">
        <div className="flex items-center border-b border-gray-200 px-5 py-3.5">
          <span id="drive-up-title" className="text-sm font-bold">
            {t('drive-up-title')}
          </span>
          {/* 진행 중에도 닫을 수 있어야 한다 — 안 그러면 키보드 사용자가 다이얼로그에 갇힌다
              (WCAG 2.1.2). 업로드는 취소할 수 없으므로(레거시 파리티) 닫기는 «취소»가 아니라
              «배경으로 보내기»다. 완료 토스트는 모달과 무관하게 뜬다. */}
          <button
            type="button"
            aria-label={running ? t('drive-up-close-running') : t('common-close')}
            title={running ? t('drive-up-close-running') : undefined}
            onClick={onClose}
            className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
          >
            <XMini />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {/* 드롭 존 */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              if (!running && !converting) setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              if (!running && !converting) void take(e.dataTransfer.files)
            }}
            role="presentation"
            className={`flex flex-col items-center gap-2 rounded-lg border border-dashed px-5 py-8 text-center ${
              dragging ? 'border-primary bg-ov-blue-50' : 'border-gray-300 bg-gray-50'
            }`}
          >
            <UploadIcon className="size-5 text-gray-400" />
            <span className="text-s text-gray-500">
              {converting ? t('drive-up-heic') : t('drive-up-drop')}
            </span>
            <button
              type="button"
              disabled={running || converting}
              onClick={() => inputRef.current?.click()}
              className="mt-1 inline-flex h-8 items-center rounded-md border border-gray-200 bg-card px-3 text-s font-semibold text-gray-700 hover:bg-gray-100 disabled:text-gray-300"
            >
              {t('drive-up-pick')}
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => void take(e.target.files)}
            />
            <span className="text-2xs text-gray-400">
              {t('drive-up-limit', { n: MAX_UPLOAD_FILES })}
            </span>
            {limits.exceptExtension.length > 0 && (
              <span className="text-2xs text-gray-400">
                {t('drive-up-banned', { list: limits.exceptExtension.join(', ') })}
              </span>
            )}
          </div>

          {/* 고른 묶음이 거부된 이유 — 눈으로 못 보는 사용자에게도 즉시 읽혀야 한다(WCAG 4.1.3) */}
          <div role="alert" aria-live="assertive">
            {/* 색만으로 전하지 않는다 — 아이콘·좌측 띠가 «형태» 신호, 글자는 고대비 본문색.
                text-destructive on bg-destructive-bg 은 라이트 2.82:1 · 다크 3.76:1 로
                13px 본문 기준 4.5:1 을 두 모드 모두 못 넘긴다(WCAG 1.4.3). */}
            {reject && (
              <div className="flex items-start gap-2 rounded-md border-l-[3px] border-destructive bg-destructive-bg px-3 py-2 text-s text-gray-900">
                <ErrorIcon className="mt-0.5 size-3.5 flex-none text-destructive" />
                <span>{rejectText(reject)}</span>
              </div>
            )}
          </div>

          {/* 대기·진행·결과 목록 */}
          {rows.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              {rows.map((r) => (
                <div
                  key={r.key}
                  className="flex items-center gap-3 border-b border-gray-100 px-3 py-2.5 last:border-b-0"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-s text-gray-900">{r.file.name}</span>
                    {(r.status === 'uploading' || r.status === 'converting') && (
                      <span className="block h-1 overflow-hidden rounded-full bg-gray-100">
                        <span
                          className="block h-full rounded-full bg-primary transition-all"
                          style={{ width: `${r.percent}%` }}
                        />
                      </span>
                    )}
                    {r.status === 'fail' && r.errorKey && (
                      <span className="truncate text-2xs text-gray-600">{t(r.errorKey)}</span>
                    )}
                  </span>
                  <span className="w-[70px] flex-none text-right text-xs text-gray-500">
                    {fmtSize(r.file.size)}
                  </span>
                  <span className="flex w-[92px] flex-none items-center justify-end gap-1 text-xs font-semibold">
                    {r.status === 'wait' && (
                      <span className="text-gray-400">{t('drive-up-wait')}</span>
                    )}
                    {r.status === 'converting' && (
                      <span className="text-gray-500">{t('drive-up-heic')}</span>
                    )}
                    {r.status === 'uploading' && (
                      <span className="text-primary">
                        {t('drive-up-progress', { n: r.percent })}
                      </span>
                    )}
                    {r.status === 'success' && (
                      <span className="inline-flex items-center gap-1 text-[var(--color-success)]">
                        <CheckIcon /> {t('drive-up-done')}
                      </span>
                    )}
                    {r.status === 'fail' && (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <ErrorIcon /> {t('drive-up-failed')}
                      </span>
                    )}
                  </span>
                  <span className="w-6 flex-none">
                    {r.status === 'wait' && !running && (
                      <button
                        type="button"
                        aria-label={t('common-delete')}
                        onClick={() => onRemove(r.key)}
                        className="inline-flex size-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100"
                      >
                        <XMini />
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 진행·결과 요약을 소리로도 전한다. 개별 행의 % 는 너무 잦아 읽지 않고, 여기서만 알린다. */}
          {/* 진행·결과를 소리로 전한다. % 는 초당 여러 번 바뀌어 폴라이트 큐를 도배하므로
              시작·종료만 알린다. 전건 성공에 부분실패 문구를 읽으면 시각 사용자와 결과가 갈린다. */}
          <div role="status" aria-live="polite" className="sr-only">
            {running
              ? t('drive-up-running', { n: rows.filter((r) => r.status !== 'success').length })
              : !done
                ? ''
                : failed.length > 0
                  ? t('drive-up-partial', { ok: succeeded.length, total: rows.length })
                  : t('drive-up-toast', { n: succeeded.length })}
          </div>
          {done && failed.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border-l-[3px] border-destructive bg-destructive-bg px-3 py-2 text-s text-gray-900">
              <ErrorIcon className="mt-0.5 size-3.5 flex-none text-destructive" />
              <span>{t('drive-up-partial', { ok: succeeded.length, total: rows.length })}</span>
            </div>
          )}
        </div>

        {/* 진행 중에는 버튼을 감춘다 — 취소가 없으므로(레거시와 동일) 누를 게 없다. */}
        {!running && (
          <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-md border border-gray-200 bg-card px-4 text-sm font-semibold text-gray-800 hover:bg-gray-100"
            >
              {done && failed.length === 0 ? t('common-close') : t('common-cancel')}
            </button>
            {/* 전건 성공이면 올릴 것이 없다 — 「등록」을 남기면 눌려도 아무 일이 없는 죽은 버튼이 된다.
                실패가 있으면 재등록, 아직 안 올렸으면 등록. */}
            {done && failed.length === 0 ? null : done && failed.length > 0 ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-white hover:bg-ov-blue-700"
              >
                {t('drive-up-retry')}
              </button>
            ) : (
              <button
                type="button"
                disabled={rows.length === 0}
                onClick={onStart}
                className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-white hover:bg-ov-blue-700 disabled:bg-gray-200 disabled:text-gray-400"
              >
                {t('drive-up-submit')}
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
