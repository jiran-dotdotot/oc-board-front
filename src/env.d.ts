// 타입이 지정된 Vite 환경변수 (.env.example 참고). vite/client의 ImportMetaEnv에 병합됨.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
