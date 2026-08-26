// 글 상세(화면 04) 데모 데이터 (백엔드 연동 전 — 추후 apiClient + useQuery)

export const POST = {
  board: '공지사항',
  notice: true,
  title: '[필독] 사내 보안 정책 개정 안내 (VPN 접속 절차 변경)',
  author: '이서연',
  authorInitial: '이',
  meta: '정보보안팀 · 2026.08.03 14:32 · 조회 1,284',
  paragraphs: [
    '안녕하세요, 정보보안팀입니다. 8월 18일(화)부터 사외에서 사내망에 접속할 때 새 VPN 클라이언트를 사용해야 합니다. 기존 클라이언트는 8월 31일자로 지원이 종료됩니다.',
    '설치 파일과 단계별 가이드는 첨부파일을 확인해주세요. 설치 과정에서 기존 클라이언트를 먼저 제거해야 하며, 소요 시간은 약 10분입니다.',
    '문의는 정보보안팀 헬프데스크(#2580)로 부탁드립니다. 원활한 전환을 위해 8월 둘째 주 안에 설치를 완료해주세요.',
  ],
  imageBg: 'bg-l-orange',
  likeCount: 8,
  likersCount: 14,
}

export const REACTIONS: { emoji: string; count: number }[] = [
  { emoji: '👍', count: 4 },
  { emoji: '🎉', count: 2 },
]

export const ATTACHMENTS: { ext: string; name: string; size: string; bg: string }[] = [
  { ext: 'PDF', name: 'VPN 설치 가이드_v2.pdf', size: '1.8MB', bg: 'bg-l-red' },
  { ext: 'PNG', name: '설정 화면 캡쳐 모음.png', size: '5.1MB', bg: 'bg-l-purple' },
]

export interface DetailComment {
  id: number
  author: string
  initial: string
  avatarBg: string
  time: string
  text: string
  likes: number
  own?: boolean
  replies?: DetailComment[]
}

export const COMMENTS: DetailComment[] = [
  {
    id: 1,
    author: '박지훈',
    initial: '박',
    avatarBg: 'bg-l-purple',
    time: '08.03 15:12',
    text: '기존 클라이언트 제거 후 재부팅이 꼭 필요한가요? 가이드에는 언급이 없어서 문의드립니다.',
    likes: 2,
    own: true,
    replies: [
      {
        id: 2,
        author: '정다은',
        initial: '정',
        avatarBg: 'bg-l-orange',
        time: '08.03 16:40',
        text: '재부팅 없이도 동작하지만, 네트워크 어댑터가 꼬이는 경우가 있어 재부팅을 권장드립니다.',
        likes: 0,
      },
    ],
  },
  {
    id: 3,
    author: '최현우',
    initial: '최',
    avatarBg: 'bg-l-mint',
    time: '08.04 09:21',
    text: '설치 완료했습니다. 접속 속도가 체감될 정도로 빨라졌네요.',
    likes: 0,
  },
]

export const LIKERS: { name: string; dept: string; initial: string; bg: string; emoji: string }[] =
  [
    { name: '김민준', dept: '경영지원본부 · 과장', initial: '김', bg: 'bg-l-blue', emoji: '❤️' },
    { name: '박지훈', dept: '개발본부 · 책임', initial: '박', bg: 'bg-l-purple', emoji: '👍' },
    { name: '정다은', dept: '경영지원본부 · 대리', initial: '정', bg: 'bg-l-orange', emoji: '❤️' },
    { name: '최현우', dept: '디자인팀 · 매니저', initial: '최', bg: 'bg-l-mint', emoji: '🎉' },
    { name: '이서연', dept: '정보보안팀 · 팀장', initial: '이', bg: 'bg-l-green', emoji: '👍' },
  ]
