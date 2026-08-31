import type { Post } from './types'

// 공지 배너 자동 순환 주기(ms). 디자인엔 자동 순환 규정이 없어 정한 값 —
// 제목 한 줄을 읽고 넘어가기에 충분한 간격. hover/포커스·모달 열림·prefers-reduced-motion
// 이면 멈추고, 수동으로 넘기면 타이머가 처음부터 다시 돈다.
export const NOTICE_ROTATE_MS = 5000

// 백엔드 연동 전 데모용 샘플 데이터. (실서비스에서는 apiClient + useQuery로 대체)
export const SAMPLE_POSTS: Post[] = [
  { id: 1, title: '첫 번째 공지사항', author: '관리자', createdAt: '2026-08-01' },
  { id: 2, title: '게시판 리뉴얼 안내', author: '관리자', createdAt: '2026-08-05' },
  { id: 3, title: '자유게시판이 열렸습니다', author: 'OC', createdAt: '2026-08-10' },
]
