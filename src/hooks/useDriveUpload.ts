import { useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { getDrivePresignedUrls, postDriveCallback, putFileToS3 } from '@/services/driveService'
import {
  type UploadErrorKey,
  convertHeicFiles,
  isHeic,
  presignFailKey,
  uploadExtension,
} from '@/utils/driveUpload'

export type UploadStatus = 'wait' | 'converting' | 'uploading' | 'success' | 'fail'

export interface UploadRow {
  /** 렌더 키. 같은 이름을 두 번 골라도 겹치지 않게 별도로 매긴다. */
  key: string
  file: File
  status: UploadStatus
  percent: number
  /** 실패 사유 i18n 키 */
  errorKey?: UploadErrorKey
}

let seq = 0
export const makeUploadRow = (file: File): UploadRow => ({
  key: `${Date.now()}-${seq++}`,
  file,
  status: 'wait',
  percent: 0,
})

/**
 * presign → S3 PUT → callback. 파일 단위로 독립이라 한 건이 실패해도 나머지는 계속된다.
 * 취소는 지원하지 않는다(레거시도 없다) — 진행 중에는 닫기·등록 버튼을 감춘다.
 */
export function useDriveUpload(boardId: string | undefined, folderId: string | undefined) {
  const { i18n } = useTranslation()
  const qc = useQueryClient()
  const [rows, setRows] = useState<UploadRow[]>([])
  const [running, setRunning] = useState(false)

  const patch = (key: string, p: Partial<UploadRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)))

  const add = (files: File[]) => setRows((prev) => [...prev, ...files.map(makeUploadRow)])
  const remove = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key))
  const reset = () => setRows([])
  /** 재등록 — 성공분은 빼고 실패분만 다시 «올린다». 상태만 되돌리면 버튼이 자기 라벨만
      「등록」으로 바꿔 놓고 아무 일도 안 해, 사용자가 한 번 더 눌러야 실제로 올라간다. */
  const retryFailed = async (): Promise<number> => {
    const retry = rows
      .filter((r) => r.status !== 'success')
      .map((r) => ({ ...r, status: 'wait' as const, percent: 0, errorKey: undefined }))
    setRows(retry)
    return startWith(retry)
  }

  /** @returns 성공 건수 */
  const start = async (): Promise<number> => {
    // rows 는 매 렌더의 최신값 — 모달은 항상 최신 start 를 호출하므로 클로저가 낡지 않는다.
    return startWith(rows)
  }

  /** 대상 배열을 «인자로» 받는다 — setRows 는 비동기라 재등록이 최신 rows 를 못 기다린다. */
  const startWith = async (source: UploadRow[]): Promise<number> => {
    if (!boardId) return 0
    const targets = source.filter((r) => r.status !== 'success')
    if (targets.length === 0) return 0
    setRunning(true)
    // 성공 건수는 상태가 아니라 지역 변수로 센다 — setState 는 비동기라 반환 시점에 아직 안 반영된다.
    let success = 0
    try {
      // HEIC 변환은 «고르는 시점»(UploadModal.take)에 이미 끝났다 — 검증·표시·presign 이
      // 같은 파일을 보게 하려면 그래야 한다. 여기서는 혹시 남은 것만 보수적으로 한 번 더 돌린다
      // (다른 경로로 rows 에 들어온 HEIC 가 있으면 여기서 걸린다).
      targets.forEach((r) =>
        patch(r.key, { status: isHeic(r.file) ? 'converting' : 'uploading', percent: 0 }),
      )
      const converted = await convertHeicFiles(targets.map((r) => r.file))
      converted.forEach((file, i) => {
        if (file !== targets[i].file) patch(targets[i].key, { file })
      })
      targets.forEach((r) => patch(r.key, { status: 'uploading' }))

      const presigned = await getDrivePresignedUrls(
        boardId,
        converted.map((file) => ({
          // NFC 정규화 — macOS 가 자모를 분리해 보내면 서버·S3 키에서 이름이 깨진다(레거시 동일).
          file_name: file.name.normalize('NFC'),
          // 사전검증(validateUpload)과 «같은» 규칙. 빈 문자열은 필수 검증 400 을 부른다.
          extension: uploadExtension(file.name),
          size: file.size,
        })),
        folderId,
        i18n.language,
      )

      await Promise.all(
        targets.map(async (row, i) => {
          // ⚠ HTTP 는 200 이어도 원소별로 실패할 수 있다 — result.state 로만 판정한다.
          const result = presigned[i]?.result
          if (!result || result.state !== 'success') {
            patch(row.key, {
              status: 'fail',
              percent: 0,
              errorKey: presignFailKey(result?.state === 'fail' ? result.message : ''),
            })
            return
          }
          try {
            let shown = -1
            await putFileToS3(result.url, converted[i], (pct) => {
              // 정수 %가 바뀔 때만 렌더 (progress 이벤트는 매우 잦다)
              if (pct === shown) return
              shown = pct
              patch(row.key, { percent: pct })
            })
            // 확정은 HTTP 코드가 아니라 응답 state 로 본다.
            const saved = await postDriveCallback({
              file_id: result.file_id,
              object_key: result.object_key,
            })
            if (saved?.state !== 'ACT') throw new Error('not-act')
            success += 1
            patch(row.key, { status: 'success', percent: 100 })
          } catch {
            patch(row.key, { status: 'fail', errorKey: 'drive-up-err-unknown' })
          }
        }),
      )
    } catch {
      // presign 자체가 막힌 경우(400 자료실 아님 / 403 권한 없음) — 전부 실패로 표시한다.
      targets.forEach((r) => patch(r.key, { status: 'fail', errorKey: 'drive-up-err-unknown' }))
    } finally {
      setRunning(false)
      qc.invalidateQueries({ queryKey: ['drive-file-page'] })
      qc.invalidateQueries({ queryKey: ['drive-files'] })
      qc.invalidateQueries({ queryKey: ['drive'] })
    }
    return success
  }

  return { rows, running, add, remove, reset, retryFailed, start }
}
