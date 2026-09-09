// 타입이 지정된 Vite 환경변수 (.env.example 참고). vite/client의 ImportMetaEnv에 병합됨.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** 자료실 파일용 공개 S3/CDN 주소 (API 의 CDN_DRIVE_URL). 미설정 시 다운로드 비활성. */
  readonly VITE_S3_FILE_BASE_URL?: string
  /** 게시글 첨부용 공개 S3/CDN 주소 (API 의 CDN_URL) — 자료실과 «다른 버킷»이다. */
  readonly VITE_S3_POST_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
