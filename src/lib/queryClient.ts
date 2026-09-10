import { QueryClient } from '@tanstack/react-query'

// 앱 전역 단일 QueryClient.
// ⚠ staleTime:0 = «신선함 우선» — 마운트·창 포커스 복귀마다 재조회해 남이 바꾼 것도 바로 본다.
//   대신 요청이 는다. 화면별로 어느 정도 낡아도 되는지 팀과 조율한 뒤, 그런 화면은 개별 쿼리에
//   staleTime 을 올려 과다조회를 줄인다(전역은 0 으로 두고 예외만 늘리는 방향).
//   이미 개별 오버라이드가 있는 것은 이 전역값에 영향받지 않는다 —
//   상세(usePostDetail, staleTime:Infinity + refetch 전부 off: 조회수 부수효과 차단),
//   사이드바 트리·설정·부서(5분~Infinity), 내 활동 카운트(60초).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})
