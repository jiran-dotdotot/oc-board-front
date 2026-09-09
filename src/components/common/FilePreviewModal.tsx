import { useTranslation } from 'react-i18next'

import { Modal } from '@/components/common/Modal'
import { DownloadIcon, XIcon } from '@/components/common/icons'
import type { PreviewKind } from '@/utils/filePreview'

/**
 * 파일 미리보기 — 자료실과 게시글 첨부가 «같은» 창을 쓴다.
 * URL 은 호출부가 5분 presign 으로 따로 받아 넘긴다(공개 S3 주소를 조립하지 않는다, 09:185).
 */
export function FilePreviewModal({
  url,
  kind,
  name,
  onClose,
  onDownload,
  downloadDisabled,
}: {
  url: string
  kind: PreviewKind
  name: string
  onClose: () => void
  onDownload: () => void
  downloadDisabled?: boolean
}) {
  const { t } = useTranslation()
  const BTN =
    'inline-flex size-[34px] flex-none items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25 disabled:text-white/40 disabled:hover:bg-white/15'

  return (
    <Modal onClose={onClose} label={name} scrim="bg-black/[0.78]">
      <div className="relative flex max-h-[82dvh] w-[min(92vw,900px)] flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-s text-white/85">{name}</span>
          <button
            type="button"
            aria-label={t('file-download')}
            disabled={downloadDisabled}
            onClick={onDownload}
            className={BTN}
          >
            <DownloadIcon className="size-3" />
          </button>
          <button type="button" aria-label={t('common-close')} onClick={onClose} className={BTN}>
            <XIcon />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {kind === 'image' && (
            <img
              src={url}
              alt={name}
              className="max-h-[72dvh] max-w-full rounded-lg object-contain"
            />
          )}
          {kind === 'video' && (
            // 자막 트랙은 API 가 주지 않는다 — 생기면 <track> 을 붙인다.
            <video src={url} controls className="max-h-[72dvh] max-w-full rounded-lg" />
          )}
          {kind === 'pdf' && (
            <iframe src={url} title={name} className="h-[72dvh] w-full rounded-lg bg-white" />
          )}
        </div>
      </div>
    </Modal>
  )
}
