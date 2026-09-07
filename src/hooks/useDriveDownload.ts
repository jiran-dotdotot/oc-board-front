import { useRef, useState } from 'react'

import {
  DOWNLOAD_CONCURRENCY,
  mapLimit,
  s3BaseUrl,
  s3FileUrl,
  saveBlob,
  uniqueFileNames,
} from '@/utils/driveDownload'
import axios from 'axios'

export interface DownloadTarget {
  src: string // S3 오브젝트 키
  name: string // origin_file_name
}

export interface DownloadState {
  open: boolean
  done: number // 다 받은 파일 수
  total: number
  percent: number // 전체 진행률(파일별 % 평균)
}

const IDLE: DownloadState = { open: false, done: 0, total: 0, percent: 0 }

/**
 * 선택한 파일을 내려받는다. 1건이면 그대로 저장하고, 2건 이상이면 zip 으로 묶는다.
 * 취소는 «실패»가 아니다 — 레거시는 abort 를 catch 로 받아 「다운로드 실패」 알럿을 띄웠는데,
 * 사용자가 직접 누른 취소라 오해를 준다. 여기서는 취소와 실패를 갈라 돌려준다.
 */
export function useDriveDownload() {
  const [state, setState] = useState<DownloadState>(IDLE)
  const abortRef = useRef<AbortController | null>(null)
  const canceledRef = useRef(false)

  const cancel = () => {
    canceledRef.current = true
    abortRef.current?.abort()
    setState(IDLE)
  }

  const start = async (
    files: DownloadTarget[],
    zipName: string,
  ): Promise<'done' | 'canceled' | 'unavailable' | 'failed'> => {
    const base = s3BaseUrl()
    if (!base) return 'unavailable'
    if (files.length === 0) return 'done'

    const controller = new AbortController()
    abortRef.current = controller
    canceledRef.current = false
    const pcts = new Array<number>(files.length).fill(0)
    setState({ open: true, done: 0, total: files.length, percent: 0 })
    let live = true
    const publish = () => {
      if (!live) return
      const sum = pcts.reduce((a, c) => a + c, 0)
      setState({
        open: true,
        done: pcts.filter((p) => p >= 100).length,
        total: files.length,
        percent: Math.round(sum / files.length),
      })
    }

    try {
      const blobs = await mapLimit(files, DOWNLOAD_CONCURRENCY, async (f, i) => {
        // 캐시된 응답이 Content-Length 를 안 주면 진행률이 죽으므로 캐시 버스터를 붙인다(레거시와 동일).
        const url = `${s3FileUrl(base, f.src)}?t=${Date.now()}${i}`
        const res = await axios.get<Blob>(url, {
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
        setState(IDLE)
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
          setState(IDLE)
          return 'canceled'
        }
        saveBlob(archive, `${zipName}.zip`)
      }
      setState(IDLE)
      return 'done'
    } catch {
      const canceled = canceledRef.current
      // 실패해도 «남은 요청»을 끊어야 한다 — 안 끊으면 살아 있는 progress 콜백이
      // publish() 로 open:true 를 다시 켜서 닫힌 진행 모달이 되살아난다(스크롤 잠금째로).
      controller.abort()
      setState(IDLE)
      return canceled ? 'canceled' : 'failed'
    } finally {
      live = false
      abortRef.current = null
    }
  }

  return { state, start, cancel }
}
