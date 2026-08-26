import { useMutation } from '@tanstack/react-query'

import { login } from '@/services/authService'
import type { LoginRequest, LoginResponse } from '@/types/auth'

// 로그인 뮤테이션. 성공 시 토큰은 authService에서 저장됨.
export function useLogin() {
  return useMutation<LoginResponse, unknown, LoginRequest>({
    mutationFn: login,
  })
}
