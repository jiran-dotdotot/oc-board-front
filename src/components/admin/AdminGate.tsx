import { useTranslation } from 'react-i18next'

import { AdminScreen } from '@/components/admin/AdminScreen'
import { useMe } from '@/hooks/useMe'
import { isAnyAdmin } from '@/types/user'

// 라우트 가드가 아니라 is_admin 플래그 트리거로 화면 자체를 제어.
export function AdminGate() {
  const { data: me, isLoading } = useMe()
  if (isLoading) return null // /me 로딩 중엔 그리지 않음(깜빡임 방지). 보통 셸에서 캐시됨.
  if (!isAnyAdmin(me)) return <NoAdminAccess />
  return <AdminScreen />
}

function NoAdminAccess() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <svg
          className="size-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold text-gray-800">{t('admin-no-access-title')}</span>
      <span className="text-[13px] text-gray-500">{t('admin-no-access-desc')}</span>
    </div>
  )
}
