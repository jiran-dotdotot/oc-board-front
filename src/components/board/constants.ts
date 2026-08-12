import type { Post } from './types'

// 백엔드 연동 전 데모용 샘플 데이터. (실서비스에서는 apiClient + useQuery로 대체)
export const SAMPLE_POSTS: Post[] = [
  { id: 1, title: '첫 번째 공지사항', author: '관리자', createdAt: '2026-08-01' },
  { id: 2, title: '게시판 리뉴얼 안내', author: '관리자', createdAt: '2026-08-05' },
  { id: 3, title: '자유게시판이 열렸습니다', author: 'OC', createdAt: '2026-08-10' },
]
