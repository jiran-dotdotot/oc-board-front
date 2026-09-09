// 아바타 원형의 파스텔 배경과 이니셜. 목록·상세·댓글·내역 모달이 같은 사람을 같은 색으로 그려야
// 하므로 «랜덤이 아니라» 시드에서 파생한다. 서버가 색을 주지 않아 만든 규칙이다.
const PASTELS = ['bg-l-blue', 'bg-l-green', 'bg-l-orange', 'bg-l-purple', 'bg-l-mint', 'bg-l-pink']

export function pastel(seed: string): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PASTELS[h % PASTELS.length]
}

/** 이름 첫 글자. 빈 이름(탈퇴·봇)은 '?' — 빈 원형을 그리면 무엇인지 알 수 없다. */
export function initial(name: string | undefined): string {
  return name && name.length > 0 ? name[0] : '?'
}
