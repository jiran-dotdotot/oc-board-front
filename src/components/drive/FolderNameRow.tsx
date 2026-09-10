import { useEffect, useRef, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { FolderIcon } from '@/components/common/icons'
import { FOLDER_NAME_MAX } from '@/components/drive/constants'

/* 폴더 이름 입력 인라인 행 — 새 폴더 만들기와 이름 변경이 같은 모양을 쓴다(정본).
   금지문자·중복 검사는 서버에도 없어 넣지 않는다. 공백뿐이면 저장할 수 없다. */
export function FolderNameRow({
  initial = '',
  onSubmit,
  onCancel,
  pending,
}: {
  initial?: string
  onSubmit: (title: string) => void
  onCancel: () => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])

  const trimmed = value.trim()
  const canSave = trimmed.length > 0 && !pending
  const save = () => canSave && onSubmit(trimmed)

  return (
    <div className="flex min-h-[46px] items-center gap-2.5 border-b border-gray-100 px-1">
      <span className="w-[26px] flex-none" />
      <span className="flex w-[46px] flex-none justify-center text-warning">
        <FolderIcon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2 pr-3">
        <input
          ref={ref}
          value={value}
          maxLength={FOLDER_NAME_MAX}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // 한글 IME 조합 확정 Enter 는 keydown 을 두 번 쏜다(조합확정 + 실제 Enter) — 조합 중엔
            //   무시해 «폴더 2개 생성»을 막는다. Escape 도 조합 취소 제스처가 행 취소로 새지 않게 가드.
            if (e.nativeEvent.isComposing) return
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') onCancel()
          }}
          placeholder={t('drive-folder-placeholder')}
          aria-label={t('drive-folder-placeholder')}
          className="h-8 w-full max-w-[300px] min-w-0 rounded-md border border-primary bg-card px-2.5 text-s outline-none"
        />
        <span className="flex-none text-2xs text-gray-400">
          {value.length}/{FOLDER_NAME_MAX}
        </span>
      </span>
      <span className="flex flex-none items-center gap-1.5 pr-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={save}
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-s font-semibold text-white hover:bg-ov-blue-700 disabled:bg-gray-200 disabled:text-gray-400"
        >
          {initial ? t('common-confirm') : t('drive-folder-create')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-card px-3 text-s font-semibold text-gray-700 hover:bg-gray-100"
        >
          {t('common-cancel')}
        </button>
      </span>
    </div>
  )
}
