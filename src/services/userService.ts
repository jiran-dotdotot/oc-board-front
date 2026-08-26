// 사용자 API 서비스. GET /api/v1/me (로그인 사용자 정보).
import { apiClient } from '@/lib/apiClient'
import { setStoredMe } from '@/lib/authStorage'
import type { Me } from '@/types/user'

export async function getMe(lang: string): Promise<Me> {
  const { data } = await apiClient.get<Me>('/me', { headers: { lang } })
  setStoredMe(data) // localStorage 캐시 → 새로고침 시 재호출 없이 재사용
  return data
}
