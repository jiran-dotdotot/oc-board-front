// docs/api/go/01-auth-user.md — GET /api/v1/board/me.
import { AUTH_PATHS } from '@/constants/auth'
import { apiClient, expireSession } from '@/lib/apiClient'
import { getAuthSession, getTokenIdentity } from '@/lib/authStorage'
import type { Me } from '@/types/user'
import { CanceledError } from 'axios'

export async function getMe(lang: string, signal?: AbortSignal): Promise<Me> {
  const session = getAuthSession()
  const identity = getTokenIdentity(session?.access_token)
  const { data } = await apiClient.get<Me>(AUTH_PATHS.me, { headers: { Lang: lang }, signal })
  if (!session || getAuthSession()?.id !== session.id) throw new CanceledError()
  // /me는 DB의 현재 회사, scoped API는 토큰의 회사를 사용한다. 변경 시 재인증한다.
  if (!identity || data.id !== identity.userId || data.company_id !== identity.companyId) {
    expireSession(session.id)
    throw new CanceledError('Board identity changed; sign in again')
  }
  return data
}
