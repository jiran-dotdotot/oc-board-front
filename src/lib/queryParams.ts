// axios 쿼리 직렬화 (백엔드 규약): 배열은 key[]=v, 그 외 key=v, 빈값 생략.
// sort[by]/sort[order] 같은 브래킷 키는 문자열 키로 그대로 넘겨 인코딩됨.
export function serializeParams(params: Record<string, unknown>): string {
  const parts: string[] = []
  const add = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === '') return
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((item) => add(`${k}[]`, item))
    else add(k, v)
  }
  return parts.join('&')
}
