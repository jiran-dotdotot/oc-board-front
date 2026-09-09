import { useCallback, useRef, useState, useSyncExternalStore } from 'react'

import { getAttachmentDownloadUrl, getDriveFileDownloadUrl } from '@/services/driveService'
import {
  DOWNLOAD_CONCURRENCY,
  type S3Scope,
  mapLimit,
  saveBlob,
  uniqueFileNames,
} from '@/utils/driveDownload'
import axios from 'axios'

export interface DownloadTarget {
  id: string // 자료실은 drive_file id, 게시글은 «첨부» id (post id 가 아니다 — 05:495)
  name: string // origin_file_name
}

/** presign 발급기가 서버에 설정되지 않으면 503 이다(docs/api/go/09-drive-file.md:25). 그 경우만 'unavailable'. */
function isUnavailable(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 503
}

export interface DownloadProgress {
  done: number // 다 받은 파일 수
  total: number
  percent: number // 전체 진행률(파일별 % 평균)
}

const IDLE: DownloadProgress = { done: 0, total: 0, percent: 0 }

/**
 * 선택한 파일을 내려받는다. 1건이면 그대로 저장하고, 2건 이상이면 zip 으로 묶는다.
 * 취소는 «실패»가 아니다 — 레거시는 abort 를 catch 로 받아 「다운로드 실패」 알럿을 띄웠는데,
 * 사용자가 직접 누른 취소라 오해를 준다. 여기서는 취소와 실패를 갈라 돌려준다.
 */
export function useDriveDownload() {
  // ⚠ 진행률은 «리액트 상태가 아니다». 정수 %마다 올라오는데(파일 수만큼 곱해진다) 상태로 두면
  //   그 틱마다 화면 전체 — 상세라면 댓글 트리까지 — 가 다시 그려진다. 구독한 컴포넌트만
  //   다시 그리도록 외부 스토어로 두고, «열림»만 상태로 둔다(열고 닫을 때 2회만 바뀐다).
  const [open, setOpen] = useState(false)
  const progressRef = useRef<DownloadProgress>(IDLE)
  const listeners = useRef(new Set<() => void>())
  const subscribe = useCallback((l: () => void) => {
    listeners.current.add(l)
    return () => void listeners.current.delete(l)
  }, [])
  const getProgress = useCallback(() => progressRef.current, [])
  const setProgress = (next: DownloadProgress) => {
    progressRef.current = next
    listeners.current.forEach((l) => l())
  }

  const abortRef = useRef<AbortController | null>(null)
  const canceledRef = useRef(false)

  const idle = () => {
    setProgress(IDLE)
    setOpen(false)
  }

  const cancel = () => {
    canceledRef.current = true
    abortRef.current?.abort()
    idle()
  }

  const start = async (
    files: DownloadTarget[],
    zipName: string,
    /** 엔드포인트 선택. 자료실은 기본값, 게시글 첨부는 'post' 다. */
    scope: S3Scope = 'drive',
  ): Promise<'done' | 'canceled' | 'unavailable' | 'failed'> => {
    if (files.length === 0) return 'done'

    const controller = new AbortController()
    abortRef.current = controller
    canceledRef.current = false
    const pcts = new Array<number>(files.length).fill(0)
    setProgress({ done: 0, total: files.length, percent: 0 })
    setOpen(true)
    let live = true
    const publish = () => {
      if (!live) return
      const sum = pcts.reduce((a, c) => a + c, 0)
      setProgress({
        done: pcts.filter((p) => p >= 100).length,
        total: files.length,
        percent: Math.round(sum / files.length),
      })
    }

    try {
      const blobs = await mapLimit(files, DOWNLOAD_CONCURRENCY, async (f, i) => {
        // 파일마다 5분짜리 presigned URL 을 따로 받는다. SDK 가 조립한 쿼리를
        // 파싱·재조합하지 않고 그대로 쓴다(09:620) — 캐시 버스터도 붙이지 않는다.
        const issued =
          scope === 'post'
            ? await getAttachmentDownloadUrl(f.id)
            : await getDriveFileDownloadUrl(f.id)
        const res = await axios.get<Blob>(issued.url, {
          responseType: 'blob',
          signal: controller.signal,
          onDownloadProgress(e) {
            const next = e.total ? Math.round((e.loaded * 100) / e.total) : 0
            // 정수 %가 바뀔 때만 렌더한다 — progress 이벤트는 초당 수십 번 오고
            // 파일 수만큼 곱해지는데, 같은 값으로 다시 그릴 이유가 없다.
            if (next === pcts[i]) return
            pcts[i] = next
            publish()
          },
        })
        pcts[i] = 100
        publish()
        return res.data
      })

      // 네트워크가 이미 끝난 뒤(zip 생성 중)에는 abort 가 아무것도 throw 하지 않는다 →
      // 성공 경로에서도 취소를 «명시적으로» 봐야 한다. 안 보면 취소했는데 파일이 저장되고
      // 「취소되었습니다」와 「N개 내려받았습니다」가 연달아 뜬다.
      if (canceledRef.current) {
        idle()
        return 'canceled'
      }
      if (files.length === 1) {
        saveBlob(blobs[0], files[0].name)
      } else {
        // zip 은 여기서만 쓰므로 지연 로드 — 첫 화면 번들에 들어가지 않게 한다.
        const { default: JSZip } = await import('jszip')
        const zip = new JSZip()
        const names = uniqueFileNames(files.map((f) => f.name))
        blobs.forEach((blob, i) => zip.file(names[i], blob))
        const archive = await zip.generateAsync({ type: 'blob' })
        // zip 생성은 수 초 걸린다 — 그 사이 취소를 눌렀으면 저장하지 않는다.
        if (canceledRef.current) {
          idle()
          return 'canceled'
        }
        saveBlob(archive, `${zipName}.zip`)
      }
      idle()
      return 'done'
    } catch (err) {
      const canceled = canceledRef.current
      if (!canceled && isUnavailable(err)) {
        controller.abort()
        idle()
        return 'unavailable'
      }
      // 실패해도 «남은 요청»을 끊어야 한다 — 안 끊으면 살아 있는 progress 콜백이
      // publish() 로 open:true 를 다시 켜서 닫힌 진행 모달이 되살아난다(스크롤 잠금째로).
      controller.abort()
      idle()
      return canceled ? 'canceled' : 'failed'
    } finally {
      live = false
      abortRef.current = null
    }
  }

  return { open, start, cancel, subscribe, getProgress }
}

/** 진행률 구독 — 이 훅을 «부르는 컴포넌트만» % 틱마다 다시 그려진다. */
export function useDownloadProgress(
  dl: Pick<ReturnType<typeof useDriveDownload>, 'subscribe' | 'getProgress'>,
) {
  return useSyncExternalStore(dl.subscribe, dl.getProgress, dl.getProgress)
}
