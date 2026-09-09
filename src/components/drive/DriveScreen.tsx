import { useEffect, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { BlockedModal } from '@/components/common/BlockedModal'
import { Checkbox } from '@/components/common/Checkbox'
import { Dropdown } from '@/components/common/Dropdown'
import { Modal } from '@/components/common/Modal'
import { Pagination } from '@/components/common/Pagination'
import { Toast } from '@/components/common/Toast'
import { NEW_BADGE } from '@/components/common/constants'
import {
  BookmarkIcon,
  ChevronIcon,
  DownloadIcon,
  DriveIcon,
  EyeIcon,
  FolderIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from '@/components/common/icons'
import { useToast } from '@/components/common/useToast'
import { FolderNameRow } from '@/components/drive/FolderNameRow'
import { UploadModal } from '@/components/drive/UploadModal'
import { readLastDrive, writeLastDrive } from '@/components/drive/constants'
import {
  DRIVE_SORTS,
  DRIVE_SORT_LABEL,
  DRIVE_SORT_PARAMS,
  type DriveFile,
  type DriveFolderRow,
  type DriveSearch,
  type DriveSort,
  EXT_BG,
  EXT_BG_DEFAULT,
  fmtDate,
  fmtSize,
} from '@/components/drive/driveData'
import { type PreviewKind, previewKind } from '@/components/drive/preview'
import { DEFAULT_LIMIT_DAY } from '@/constants/post'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useCategories } from '@/hooks/useCategories'
import { useDrive } from '@/hooks/useDrive'
import { useDriveDownload } from '@/hooks/useDriveDownload'
import {
  useDriveBookmarkMutation,
  useDriveDeleteMutation,
  useDriveFilePage,
  useDriveFolderMutation,
} from '@/hooks/useDriveFiles'
import { useDriveUpload } from '@/hooks/useDriveUpload'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useMe } from '@/hooks/useMe'
import { getCurrentUserId } from '@/lib/authStorage'
import { getDriveFileDownloadUrl } from '@/services/driveService'
import { isDriveBoard } from '@/types/category'
import type { ApiDriveFile, DriveFolder } from '@/types/drive'
import { collectBoards, findBoard } from '@/utils/category'
import { collectFolderParentIds } from '@/utils/driveFolders'
import type { UploadLimits } from '@/utils/driveUpload'
import {
  LIMIT_OPTIONS,
  deviceDefaultLimit,
  readStoredLimit,
  writeStoredLimit,
} from '@/utils/listLimit'

// Go 파일 → 화면 뷰모델. src는 없으며 다운로드 URL 연결은 별도 전환 대상이다.
function toFile(f: ApiDriveFile, meId: number | null): DriveFile {
  const ext = (f.extension ?? '').toUpperCase()
  return {
    id: f.id,
    name: f.origin_file_name,
    ext,
    tagBg: EXT_BG[ext] ?? EXT_BG_DEFAULT,
    board: f.board?.title ?? '',
    by: f.user?.name ?? '',
    mine: meId != null && f.user_id === meId,
    date: fmtDate(f.created_at),
    size: fmtSize(f.size),
    bm: !!f.is_bookmark,
  }
}

// 폴더 → 표 상단 고정 행. 수정 이력이 있으면 그쪽을 쓴다(정본이 「수정자·수정일」을 보여준다).
function toFolder(d: DriveFolder, meId: number | null): DriveFolderRow {
  // 컬럼 헤더가 「업로더·등록일」이므로 «생성자·생성일»을 넣는다.
  // last_drive_folder_log 는 최근 «수정» 이력이라 여기에 덮어쓰면 A 가 만든 폴더를
  // B 가 이름만 바꿔도 업로더가 영구히 B 로 보이고 생성일을 어디서도 볼 수 없다.
  // (삭제 권한은 d.user_id=생성자로 판정하므로 「B 로 보이는데 B 는 못 지운다」는 모순이 생겼다.)
  return {
    id: d.id,
    name: d.title,
    by: d.user?.name ?? '',
    date: fmtDate(d.created_at ?? ''),
    mine: meId != null && d.user_id === meId,
  }
}

// recent = 홈 「최근 자료 · 더보기」가 여는 «최근 자료» 목록(정본 isRecentFiles).
// 같은 표를 쓰되 위치 컬럼을 달고 용량을 빼며, 폴더·업로드·용량바가 없다.
export function DriveScreen({ recent = false }: { recent?: boolean }) {
  const { t } = useTranslation()
  // ⚠ strict:false — /drive 와 /drive/recent 두 라우트에서 함께 쓴다.
  const search = useSearch({ strict: false }) as DriveSearch
  const b = recent ? undefined : search.b
  const folderId = recent ? undefined : search.f
  const { data: tree } = useCategories()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { toast, showToast, hideToast } = useToast()

  // 사이드바·모바일 하단탭은 `?b=` 없이 /drive 로 온다 → 마지막 방문(없으면 첫) 자료실로 보낸다.
  const driveBoards = collectBoards(tree).filter(isDriveBoard)
  const firstDriveId = (driveBoards.find((x) => x.id === readLastDrive()) ?? driveBoards[0])?.id
  useEffect(() => {
    if (recent || b || !firstDriveId) return
    navigate({ to: '/drive', search: { b: firstDriveId }, replace: true })
  }, [recent, b, firstDriveId, navigate])
  useEffect(() => {
    if (!recent && b) writeLastDrive(b)
  }, [recent, b])

  // 노출 기간은 회사 설정(latest_post_day) — 정본 안내문 「최근 30일…」이 가리키는 값.
  const { data: me } = useMe()
  const limitDay = me?.company_setting?.latest_post_day ?? DEFAULT_LIMIT_DAY

  const sortKey: DriveSort = search.sort ?? 'new'
  const page = search.page ?? 1
  const [deviceLimit] = useState(deviceDefaultLimit)
  const [storedLimit] = useState(readStoredLimit)
  const perPage = search.limit ?? storedLimit ?? deviceLimit
  const [countOpen, setCountOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const isMobile = useIsMobile()

  // 모바일 무한 스크롤 — 목록 화면과 같은 방식(take 를 키워 1페이지로 다시 받는다).
  const scope = `${b ?? ''}|${folderId ?? ''}|${sortKey}|${perPage}`
  const [loaded, setLoaded] = useState({ scope, pages: 1 })
  const loadedPages = loaded.scope === scope ? loaded.pages : 1
  if (loaded.scope !== scope) setLoaded({ scope, pages: 1 })

  // 기본은 push — 정렬·개수·페이지·폴더 이동은 뒤로 가기로 되돌릴 수 있어야 한다.
  // replace 는 «사용자가 의도하지 않은 자동 이동»에만 쓴다(없는 폴더에서 빠져나오기 등).
  const setSearch = (patch: Partial<DriveSearch>, opts?: { replace?: boolean }) =>
    navigate({
      to: recent ? '/drive/recent' : '/drive',
      search: (prev: DriveSearch) => ({ ...prev, ...patch }),
      replace: opts?.replace,
    })

  // 폴더·용량·권한은 GET /drive/{board} 한 번에 온다(현재 레벨 폴더 + path 브레드크럼 포함).
  const { data: drive, error: driveError } = useDrive(b, folderId)
  // 삭제된 자료실(404)·권한 없음(403)을 그냥 두면 «빈 자료실»처럼 보인다 → 알리고 홈으로.
  // (게시판 목록과 같은 규약 — BoardListScreen 의 blockedMessage)
  const driveErrStatus = (driveError as { response?: { status?: number } } | null)?.response?.status
  const blockedMessage =
    driveErrStatus === 404
      ? t('drive-board-deleted')
      : driveErrStatus === 403
        ? t('drive-board-forbidden')
        : null
  const { data, isLoading, isError, refetch } = useDriveFilePage(
    {
      board_id: b,
      drive_folder_id: folderId,
      // 루트에서는 하위 폴더 파일이 섞이지 않도록 서버가 drive_folder_id=null 을 강제하게 한다.
      is_drive_root: !recent && !!b && !folderId,
      limit_day: recent ? limitDay : undefined,
      take: isMobile ? perPage * loadedPages : perPage,
      page: isMobile ? 1 : page,
      sort: DRIVE_SORT_PARAMS[sortKey],
    },
    recent || !!b,
  )
  const totalPages = data?.last_page ?? 1
  const totalCount = data?.total ?? 0

  const meId = getCurrentUserId()
  const files: DriveFile[] = (data?.data ?? []).map((f) => toFile(f, meId))
  // 폴더는 표 상단 고정 — 페이징 대상이 아니다(정본 주석: 「폴더 = 목록 상단 고정(페이징 제외)」).
  const folders: DriveFolderRow[] = (drive?.drive_folders ?? []).map((d) => toFolder(d, meId))
  const isEmpty = !isLoading && !isError && files.length === 0 && folders.length === 0
  const hasMore = isMobile && files.length < totalCount
  const sentinelRef = useInfiniteScroll(
    () => setLoaded({ scope, pages: loadedPages + 1 }),
    hasMore && !isLoading,
  )

  // 선택은 파일/폴더를 따로 담는다(삭제 API 가 갈라져 있고, 폴더는 다운로드 대상이 아니다).
  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set())
  const [checkedFolders, setCheckedFolders] = useState<Set<string>>(new Set())
  // 폴더·정렬·개수·게시판이 바뀌면 선택을 버린다(레거시는 remount 로 같은 효과를 냈다).
  const [selScope, setSelScope] = useState(scope)
  if (selScope !== scope) {
    setSelScope(scope)
    setCheckedFiles(new Set())
    setCheckedFolders(new Set())
  }

  const selFiles = files.filter((f) => checkedFiles.has(String(f.id)))
  const selCount = selFiles.length + checkedFolders.size
  // 삭제 허용 판정. 레거시는 drive.is_admin(=게시판 관리자)만 봤지만, 서버는
  // /drive/file/board/{board} 에서 isBoardAdmin ‖ isAdminUser(회사 관리자) ‖ isCategoryAdmin 을 허용한다
  // (docs/api/09-drive-file.md §7) → 회사 관리자가 프론트에서만 막히던 갭을 메운다.
  const isDriveAdmin = !!drive?.is_admin || !!me?.is_admin
  // 삭제는 「내 것 또는 자료실 관리자」만 — 정본은 경고 문구를 선택 즉시 띄운다.
  const selHasOthers =
    !isDriveAdmin &&
    (selFiles.some((f) => !f.mine) || folders.some((d) => checkedFolders.has(d.id) && !d.mine))
  const rowCount = files.length + folders.length
  const allChecked = rowCount > 0 && selCount === rowCount
  const allMixed = selCount > 0 && !allChecked

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }
  const toggleAll = () => {
    if (allChecked) {
      setCheckedFiles(new Set())
      setCheckedFolders(new Set())
      return
    }
    setCheckedFiles(new Set(files.map((f) => String(f.id))))
    setCheckedFolders(new Set(folders.map((d) => d.id)))
  }

  const { mutate: toggleBookmark } = useDriveBookmarkMutation()
  // 성공을 «단언»하지 않는다 — mutate 는 즉시 반환하므로 서버가 거절해도 성공 문구가 떴다.
  const onBookmark = (f: DriveFile) => {
    toggleBookmark(String(f.id), {
      onSuccess: () => showToast(t(f.bm ? 'drive-bm-remove' : 'drive-bm-add')),
      onError: () => showToast(t('drive-bm-failed'), 'error'),
    })
  }

  // ── 다운로드 ─────────────────────────────────────────────────────────────
  const { state: dl, start: startDownload, cancel: cancelDownload } = useDriveDownload()
  const [dlCancelAsk, setDlCancelAsk] = useState(false)
  // 폴더는 내려받을 수 없다 — 하나라도 섞이면 비활성(레거시와 동일).
  const dlBlocked = checkedFolders.size > 0
  // 비활성 사유 — 있으면 버튼 옆에 «글자로» 띄우고 aria-describedby 로도 묶는다.
  // presign 설정 여부는 발급을 요청해 봐야 알 수 있어(503) 사전 비활성 조건이 아니다.
  const dlOff = selFiles.length === 0 || dlBlocked || dl.open
  const delOff = selCount === 0 || selHasOthers
  const dlDisabledReason = dlBlocked ? t('drive-dl-folder-note') : null

  const runDownload = async (targets: DriveFile[]) => {
    const files = targets.map((f) => ({ id: f.id, name: f.name }))
    const r = await startDownload(files, t('drive-zip-name'))
    setDlCancelAsk(false)
    if (r === 'unavailable') showToast(t('drive-dl-unavailable'), 'error')
    else if (r === 'canceled') showToast(t('drive-dl-canceled'))
    else if (r === 'failed') showToast(t('drive-dl-fail'), 'error')
    // 완료도 알린다 — 모달이 스스로 닫히기만 하면 끝났는지 알 수 없다(토스트는 aria-live).
    else showToast(t('drive-dl-done', { n: files.length }))
  }

  // ── 폴더 만들기 · 이름 변경 ──────────────────────────────────────────────
  const { create: createFolder, rename: renameFolder } = useDriveFolderMutation()
  const [newFolder, setNewFolder] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  // ⚠ 권한·확장자·파일당 상한은 최상위가 아니라 board 관계에 있다(실측 2026-09-09).
  const driveMeta = drive?.board
  const canWrite = !!driveMeta?.is_writable

  const submitNewFolder = (title: string) => {
    if (!b) return
    createFolder.mutate(
      { boardId: b, title, parentFolderId: folderId },
      {
        onSuccess: () => {
          setNewFolder(false)
          showToast(t('drive-folder-created'))
        },
        onError: () => showToast(t('drive-folder-failed'), 'error'),
      },
    )
  }
  const submitRename = (folderRowId: string, title: string) =>
    renameFolder.mutate(
      { folderId: folderRowId, title },
      {
        onSuccess: () => {
          setRenaming(null)
          showToast(t('drive-folder-renamed'))
        },
        onError: () => showToast(t('drive-folder-failed'), 'error'),
      },
    )

  // ── 업로드 ──────────────────────────────────────────────────────────────
  const [upOpen, setUpOpen] = useState(false)
  const upload = useDriveUpload(b, folderId)
  // 검증 한도는 자료실(board) 설정에서 온다. size_limit 은 -1(무제한)로 오기도 한다.
  const uploadLimits: UploadLimits = {
    exceptExtension: driveMeta?.except_extension ?? [],
    sizeLimitPerFile: driveMeta?.size_limit_per_file ?? 0,
    sizeLimit: drive?.size_limit ?? 0,
    usedSize: drive?.total_usage_size ?? 0,
  }
  const openUpload = () => {
    // 진행 중에 다시 열면 «그 진행 상황»을 보여줘야 한다 — reset 하면 행이 사라지고
    // 이후 patch 가 없는 key 를 찾아 no-op 이 되어 진행률이 영구히 안 보인다.
    if (!upload.running) upload.reset()
    setUpOpen(true)
  }
  const runUpload = async () => {
    const ok = await upload.start()
    if (ok > 0) showToast(t('drive-up-toast', { n: ok }))
  }
  // 재등록도 «실제로 올린다» — 상태만 되돌리면 버튼을 두 번 눌러야 한다.
  const retryUpload = async () => {
    const ok = await upload.retryFailed()
    if (ok > 0) showToast(t('drive-up-toast', { n: ok }))
  }

  // ── 미리보기 ─────────────────────────────────────────────────────────────
  // 지금은 브라우저 기본 렌더러만 쓴다(이미지·동영상·PDF). 한글·오피스는 추후 확장 —
  // 그때까지 열 수 없는 형식은 「다운로드하세요」로 보낸다(레거시와 같은 처리).
  // 대상 파일을 그대로 들고 있는다 — 이름으로 목록을 다시 뒤지면 동명 파일에서 다른 파일이 잡히고,
  // 재검증으로 그 이름이 페이지에서 사라지면 다운로드 버튼이 조용히 죽는다.
  const [preview, setPreview] = useState<{
    url: string
    kind: PreviewKind
    file: DriveFile
  } | null>(null)
  useBodyScrollLock(!!preview)
  // 미리보기도 5분 presign 을 따로 받는다 — 공개 S3 주소를 조립하지 않는다(09:185).
  const openPreview = async (f: DriveFile) => {
    const kind = previewKind(f.ext)
    if (kind === 'none') return showToast(t('drive-preview-unsupported'))
    try {
      const issued = await getDriveFileDownloadUrl(f.id)
      setPreview({ url: issued.url, kind, file: f })
    } catch {
      showToast(t('drive-dl-unavailable'), 'error')
    }
  }

  // ── 삭제 ────────────────────────────────────────────────────────────────
  const { files: delFiles, folders: delFolders } = useDriveDeleteMutation()
  const [delOpen, setDelOpen] = useState(false)
  const [notice, setNotice] = useState<{ title: string; desc: string } | null>(null)

  // 자식 폴더를 가진 폴더는 «혼자» 지우면 자식이 고아가 돼 화면에서 사라진다 → 프론트에서 막는다.
  const folderParentIds = collectFolderParentIds(drive?.child_drive_folders)

  // 파일만이면 휴지통(복원 가능), 폴더가 섞이면 폴더는 되돌릴 수 없다 —
  // 폴더 복원 API 자체가 없다(docs/guides/api-catalog.md §9 에 /drive/file/restore 만 있다).
  // 「복구 가능」을 약속하고 되돌릴 수 없는 삭제를 시키면 데이터 손실로 이어진다.
  // 개수 보간도 되살린다 — 파괴적 작업은 대상 규모를 화면에 남겨야 한다(HEAD 문구가 그랬다).
  const delHasFolder = checkedFolders.size > 0
  const delTitle = delHasFolder
    ? t('drive-del-confirm-mixed', { n: selCount })
    : t('drive-del-confirm', { n: selCount })
  const delDesc = delHasFolder ? t('drive-del-sub-mixed') : t('drive-del-sub')

  const doDelete = async () => {
    setDelOpen(false)
    if (!b) return
    // 권한: 내 것이거나 자료실 관리자. 하나라도 걸리면 배치 전체를 중단한다(레거시 규칙).
    if (selHasOthers) {
      setNotice({ title: t('drive-del-forbidden'), desc: t('drive-del-forbidden-sub') })
      return
    }
    const folderIds = [...checkedFolders]
    const fileIds = selFiles.map((f) => String(f.id))
    try {
      let skipped = 0
      if (fileIds.length > 0) {
        // 부분 실패도 200 이다 — 권한 밖·이미 휴지통 id 는 ignored_ids 로만 온다(09:407).
        const res = await delFiles.mutateAsync({ ids: fileIds })
        skipped = res.ignored_ids.length
      }
      setCheckedFiles(new Set())
      if (skipped > 0) {
        setNotice({ title: t('drive-del-forbidden'), desc: t('drive-del-forbidden-sub') })
        return
      }
      if (folderIds.length > 0) {
        // 자식 폴더를 가진 것은 서버에 보내지 않는다 — 보내면 그냥 지워지고 자식이 고아가 된다.
        const leaves = folderIds.filter((id) => !folderParentIds.has(id))
        const blocked = folderIds.filter((id) => folderParentIds.has(id))
        // 하위 «파일»이 남은 폴더는 서버가 조용히 건너뛴다 → 못 지운 id 는 선택에 남기고 안내한다.
        const deleted =
          leaves.length > 0 ? await delFolders.mutateAsync({ ids: leaves }) : []
        const skippedLeaves = leaves.filter((id) => !deleted.includes(id))
        const left = [...blocked, ...skippedLeaves]
        setCheckedFolders(new Set(left))
        if (left.length > 0) {
          // 사유가 둘이다 — 하위 «폴더» 때문(프론트 가드)과 하위 «파일» 때문(서버 스킵).
          // 같은 문구를 쓰면 자료가 0건인 폴더에 「자료를 지우라」고 안내해 지울 방법을 못 찾는다.
          setNotice(
            blocked.length > 0
              ? {
                  title: t('drive-folder-del-has-subfolder'),
                  desc: t('drive-folder-del-has-subfolder-sub'),
                }
              : {
                  title: t('drive-folder-del-blocked'),
                  desc: t('drive-folder-del-blocked-sub'),
                },
          )
          return
        }
      }
      showToast(t('drive-deleted'))
    } catch {
      setNotice({ title: t('drive-del-forbidden'), desc: t('drive-del-forbidden-sub') })
    }
  }

  // ESC — 겹친 오버레이의 «최상위 하나»만 닫는다. 전부 닫으면 위 모달을 남기고
  // 배경을 닫아 버린다. 다운로드 진행 모달은 X 와 같게 «취소 확인»을 먼저 띄운다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (notice) return setNotice(null)
      if (dlCancelAsk) return setDlCancelAsk(false)
      if (dl.open) return setDlCancelAsk(true)
      if (delOpen) return setDelOpen(false)
      if (upOpen) return setUpOpen(false)
      if (preview) return setPreview(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [notice, dlCancelAsk, dl.open, delOpen, upOpen, preview])

  const curName = recent ? t('home-recent-files') : (findBoard(tree, b)?.title ?? t('nav-drive'))
  const crumbs = drive?.path ?? []
  const goFolder = (id: string | undefined, opts?: { replace?: boolean }) =>
    setSearch({ f: id, page: undefined }, opts)

  // 서버는 없는 drive_folder_id 에 대해 에러가 아니라 drive_folders=[] · path=[] 를 준다
  // (docs/api/08-drive-folder.md §7). f 가 있는데 path 가 비면 «삭제된 폴더» 이므로
  // 루트처럼 보이게 두면 브레드크럼도 없는 유령 폴더에 갇힌다 → 루트로 되돌린다.
  const ghostFolder = !!folderId && !!drive && crumbs.length === 0
  useEffect(() => {
    if (!ghostFolder) return
    showToast(t('drive-folder-gone'))
    // replace — push 하면 뒤로 가기가 삭제된 폴더로 돌아오고 effect 가 또 튕겨내
    // f=DEAD ↔ 루트를 무한 왕복하며 이전 화면에 도달할 수 없다.
    goFolder(undefined, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostFolder])

  // 저장 용량 — size_limit=0 은 무제한이라 게이지 대신 사용량만 보여준다.
  const usage = drive?.total_usage_size ?? 0
  const quota = drive?.size_limit ?? 0
  const usagePct = quota > 0 ? Math.min(100, Math.round((usage / quota) * 100)) : 0

  return (
    <div className="flex w-full flex-col">
      {/* 헤더: 브레드크럼(자료실명 › 폴더) + 자료 수 + 저장 용량 게이지 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* 모바일에서 폴더 안이면 루트 버튼 앞에 «뒤로» 셰브런이 붙는다(모바일 정본) */}
        <button
          type="button"
          onClick={() => goFolder(undefined)}
          disabled={crumbs.length === 0}
          className={`inline-flex items-center gap-1.5 text-lg font-extrabold tracking-title ${
            crumbs.length > 0 ? 'text-gray-500 hover:text-gray-900' : 'text-gray-900'
          }`}
        >
          {crumbs.length > 0 && <ChevronIcon className="size-3.5 rotate-180 min-[631px]:hidden" />}
          {curName}
        </button>
        {/* 경로가 깊어지면 상위로 돌아갈 수단이 필요하다 — 정본은 1단 예시만 그려 놨고,
            레거시는 마지막 3단을 각각 클릭 가능하게 두고 넘치면 `...` 로 줄인다(index.vue:279-290). */}
        {crumbs.length > 0 && (
          <span className="flex min-w-0 items-center gap-2">
            {crumbs.length > 3 && (
              <>
                <ChevronIcon className="size-3 flex-none text-gray-300" />
                <span className="flex-none text-base text-gray-400">…</span>
              </>
            )}
            {crumbs.slice(-3).map((c, i, arr) => {
              const isLast = i === arr.length - 1
              return (
                <span key={c.id} className="flex min-w-0 items-center gap-2">
                  <ChevronIcon className="size-3 flex-none text-gray-300" />
                  {isLast ? (
                    <span
                      aria-current="page"
                      className="truncate text-base font-bold text-gray-900"
                    >
                      {c.title}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => goFolder(c.id)}
                      className="truncate text-base font-bold text-gray-500 hover:text-gray-900"
                    >
                      {c.title}
                    </button>
                  )}
                </span>
              )
            })}
          </span>
        )}
        {recent && <span className={`${NEW_BADGE} bg-primary`}>NEW</span>}
        <span className="text-s text-gray-400">{t('drive-file-count', { n: totalCount })}</span>

        {!recent && (
          <div className="ml-auto flex w-[150px] flex-none flex-col gap-1.5">
            <div className="flex items-center justify-between text-2xs text-gray-500">
              <span>{t('drive-storage')}</span>
              <span className="font-semibold">
                {quota > 0 ? `${fmtSize(usage)} / ${fmtSize(quota)}` : fmtSize(usage)}
              </span>
            </div>
            {quota > 0 && (
              <div className="h-1 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full ${usagePct >= 90 ? 'bg-destructive' : 'bg-primary'}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 노출 기간 안내 — 회사 설정(환경 설정 · 메인화면)이 정한다(정본 문구) */}
      {recent && (
        <span className="mt-1.5 text-xs text-gray-400">
          {t('recent-files-desc', { n: limitDay })}
        </span>
      )}

      {/* 툴바 — 좌: 선택 액션 / 우: 정렬 · 개수 · 새 폴더 · 업로드 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* 모바일은 표 헤더를 감추므로 그 안의 «전체 선택» 체크박스가 사라진다 →
            툴바에 복원한다. 없으면 모바일에서 일괄 다운로드·삭제를 아예 못 한다. */}
        {rowCount > 0 && (
          <span className="mr-1 inline-flex items-center gap-1.5 min-[631px]:hidden">
            <Checkbox
              checked={allChecked}
              mixed={allMixed}
              onClick={toggleAll}
              label={t('drive-select-all')}
            />
            <span className="text-xs text-gray-500">{t('drive-select-all')}</span>
          </span>
        )}
        {/* 정본은 「N개 선택」만 조건부고 다운로드·삭제는 «항상» 렌더한다 — 버튼이 사라지면
            무엇을 할 수 있는 화면인지 알 수 없다. 선택 0건이면 비활성으로 남긴다. */}
        {selCount > 0 && (
          <span className="text-s text-gray-600">
            <b className="text-primary">{selCount}</b>
            {t('drive-selected-suffix')}
          </span>
        )}
        {/* 정본은 「N개 선택」만 조건부고 다운로드·삭제는 «항상» 렌더한다 — 버튼이 사라지면
            무엇을 할 수 있는 화면인지 알 수 없다. 선택 0건이면 비활성으로 남긴다. */}
        <button
          type="button"
          disabled={dlOff}
          // 비활성 이유는 title 이 아니라 접근 이름·보이는 글자로 전한다 —
          // title 은 모바일에 hover 가 없어 못 보고, 스크린리더도 읽지 않는 경우가 많다.
          aria-describedby={dlDisabledReason ? 'drive-dl-reason' : undefined}
          onClick={() => runDownload(selFiles)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-card px-3 text-s font-semibold ${
            dlOff ? 'cursor-not-allowed text-gray-300' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <DownloadIcon className="size-3" /> {t('file-download')}
        </button>
        {dlDisabledReason && (
          <span id="drive-dl-reason" className="text-xs text-gray-400">
            {dlDisabledReason}
          </span>
        )}
        {/* 최근 자료는 정본대로 다운로드만 — 삭제는 자료실에서 한다 */}
        {!recent && (
          <>
            <button
              type="button"
              disabled={delOff}
              aria-describedby={selHasOthers ? 'drive-del-reason' : undefined}
              onClick={() => setDelOpen(true)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-card px-3 text-s font-semibold ${
                delOff
                  ? 'cursor-not-allowed text-gray-300'
                  : 'text-destructive hover:bg-destructive-bg'
              }`}
            >
              <TrashIcon /> {t('common-delete')}
            </button>
            {selHasOthers && (
              <span id="drive-del-reason" className="text-xs text-gray-400">
                {t('drive-del-note')}
              </span>
            )}
          </>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Dropdown
            label={t(DRIVE_SORT_LABEL[sortKey])}
            open={sortOpen}
            onToggle={() => setSortOpen((v) => !v)}
            onClose={() => setSortOpen(false)}
            width="w-[150px]"
            options={DRIVE_SORTS.map((s) => ({
              key: s,
              label: t(DRIVE_SORT_LABEL[s]),
              selected: s === sortKey,
              onPick: () => setSearch({ sort: s === 'new' ? undefined : s, page: undefined }),
            }))}
          />
          <Dropdown
            label={t('list-per-page', { n: perPage })}
            open={countOpen}
            onToggle={() => setCountOpen((v) => !v)}
            onClose={() => setCountOpen(false)}
            width="w-[130px]"
            options={LIMIT_OPTIONS.map((v) => ({
              key: String(v),
              label: t('list-per-page', { n: v }),
              selected: v === perPage,
              onPick: () => {
                // 선택은 기기에 남는다(게시글 목록과 같은 키) + URL 에도 실어 공유 가능하게.
                writeStoredLimit(v)
                setSearch({ limit: v, page: undefined })
              },
            }))}
          />
          {!recent && (
            <>
              <span className="mx-0.5 h-4 w-px flex-none bg-gray-200" />
              <button
                type="button"
                disabled={!canWrite || newFolder}
                onClick={() => {
                  setRenaming(null)
                  setNewFolder(true)
                }}
                className="inline-flex h-8 flex-none items-center gap-1.5 rounded-md border border-gray-200 bg-card px-3 text-s font-semibold text-gray-700 hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-card"
              >
                <PlusIcon className="size-3" /> {t('drive-add-folder')}
              </button>
              <button
                type="button"
                disabled={!canWrite}
                onClick={openUpload}
                className="inline-flex h-8 flex-none items-center gap-1.5 rounded-md bg-primary px-3.5 text-s font-semibold text-white hover:bg-ov-blue-700 disabled:bg-gray-200 disabled:text-gray-400"
              >
                <UploadIcon className="size-3" /> {t('drive-upload')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 표 — 모바일 정본은 목록 전체를 테두리 카드로 감싼다(데스크톱 정본엔 테두리가 없다).
          0건일 때만 카드가 보이던 역전을 없앤다. */}
      <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-card min-[631px]:rounded-none min-[631px]:border-0">
        {/* 720px 하한은 데스크톱에서만 — 모바일은 컬럼을 접어 가로스크롤을 없앤다(정본 모바일) */}
        <div className="min-[631px]:min-w-[720px]">
          {/* 헤더 행 — 최근 자료는 모바일에서 표 헤더를 감춘다(행이 한 줄로 접히므로) */}
          <div className="hidden h-10 items-center gap-2.5 border-b border-gray-200 px-1 text-xs text-gray-500 min-[631px]:flex">
            <span className="flex w-[26px] flex-none justify-center">
              <Checkbox
                checked={allChecked}
                mixed={allMixed}
                onClick={toggleAll}
                label={t('drive-select-all')}
              />
            </span>
            <span className="w-[46px] flex-none">{t('col-ext')}</span>
            <span className="min-w-0 flex-1">{t('col-filename')}</span>
            {/* 최근 자료는 게시판이 섞이므로 '위치'가 붙고 용량이 빠진다(정본 isRecentFiles) */}
            {recent && <span className="w-[120px] flex-none">{t('col-location')}</span>}
            <span className="w-[100px] flex-none">{t('col-uploader')}</span>
            <span className="w-[92px] flex-none">{t('col-regdate')}</span>
            {!recent && <span className="w-[74px] flex-none">{t('drive-col-size')}</span>}
            <span className="w-[104px] flex-none" />
          </div>

          {/* 새 폴더 — 목록 맨 위 인라인 행(정본). 빈 자료실에서도 떠야 한다. */}
          {newFolder && (
            <FolderNameRow
              onSubmit={submitNewFolder}
              onCancel={() => setNewFolder(false)}
              pending={createFolder.isPending}
            />
          )}

          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex min-h-[46px] items-center gap-2.5 border-b border-gray-100 px-1"
              >
                <span className="w-[26px] flex-none" />
                <span className="h-5 w-[38px] flex-none animate-pulse rounded bg-gray-100" />
                <span className="h-3.5 flex-1 animate-pulse rounded bg-gray-100" />
                <span className="h-3 w-24 flex-none animate-pulse rounded bg-gray-100" />
              </div>
            ))
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 px-1 py-14 text-center">
              <span className="text-s text-gray-400">{t('list-error')}</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-card px-4 text-s font-semibold text-gray-700 hover:bg-gray-100"
              >
                {t('common-retry')}
              </button>
            </div>
          ) : isEmpty && !newFolder ? (
            <div className="mt-3 flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-card px-5 py-16 text-center">
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <DriveIcon className="size-5" />
              </span>
              <span className="text-s text-gray-400">{t('drive-empty')}</span>
              {!recent && canWrite && (
                <button
                  type="button"
                  onClick={openUpload}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-s font-semibold text-white hover:bg-ov-blue-700"
                >
                  <UploadIcon className="size-3" /> {t('drive-upload')}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* 폴더 행 — 목록 상단 고정, 페이징 제외 */}
              {folders.map((d) =>
                renaming === d.id ? (
                  <FolderNameRow
                    key={d.id}
                    initial={d.name}
                    onSubmit={(title) => submitRename(d.id, title)}
                    onCancel={() => setRenaming(null)}
                    pending={renameFolder.isPending}
                  />
                ) : (
                  <div
                    key={d.id}
                    onClick={() => goFolder(d.id)}
                    role="presentation"
                    className={`flex min-h-[46px] cursor-pointer items-center gap-2.5 border-b border-gray-100 px-1 hover:bg-gray-100 ${
                      checkedFolders.has(d.id)
                        ? 'bg-ov-blue-50 hover:bg-ov-blue-100'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <span
                      className="flex w-[26px] flex-none justify-center"
                      onClick={(e) => e.stopPropagation()}
                      role="presentation"
                    >
                      <Checkbox
                        checked={checkedFolders.has(d.id)}
                        onClick={() => setCheckedFolders((s) => toggle(s, d.id))}
                        label={d.name}
                      />
                    </span>
                    <span className="flex w-[46px] flex-none justify-center text-warning">
                      <FolderIcon className="size-4" />
                    </span>
                    {/* 폴더 이름 자체를 버튼으로 둔다 — 행 클릭(마우스)만 두면 키보드로 폴더에 들어갈
                        수단이 없어진다(WCAG 2.1.1). 행에도 체크박스·연필 버튼이 있어 행 전체를
                        role="button" 으로 만들면 중첩 인터랙티브가 되므로 이름만 버튼으로 만든다. */}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 pr-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          goFolder(d.id)
                        }}
                        className="truncate text-left text-s font-semibold text-gray-900"
                      >
                        {d.name}
                      </button>
                      {/* 모바일: 숨는 컬럼을 한 줄로 접는다 */}
                      <span className="truncate text-xs text-gray-400 min-[631px]:hidden">
                        {t('drive-folder-meta', { author: d.by, date: d.date })}
                      </span>
                    </span>
                    {recent && <span className="hidden w-[120px] flex-none min-[631px]:block" />}
                    <span className="hidden w-[100px] flex-none truncate text-xs text-gray-600 min-[631px]:block">
                      {d.by}
                    </span>
                    <span className="hidden w-[92px] flex-none text-xs text-gray-500 min-[631px]:block">
                      {d.date}
                    </span>
                    {!recent && (
                      <span className="hidden w-[74px] flex-none text-xs text-gray-400 min-[631px]:block">
                        —
                      </span>
                    )}
                    <span className="flex w-[104px] flex-none items-center justify-end gap-0.5 pr-2">
                      <button
                        type="button"
                        disabled={!canWrite}
                        aria-label={t('drive-rename-folder')}
                        onClick={(e) => {
                          e.stopPropagation()
                          setNewFolder(false)
                          setRenaming(d.id)
                        }}
                        className="inline-flex size-[27px] items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 disabled:text-gray-300 disabled:hover:bg-transparent"
                      >
                        <PencilIcon className="size-3.5" />
                      </button>
                    </span>
                  </div>
                ),
              )}

              {/* 파일 행 */}
              {files.map((f) => (
                <div
                  key={f.id}
                  className={[
                    'flex min-h-[46px] items-center gap-2.5 border-b border-gray-100 px-1',
                    checkedFiles.has(String(f.id))
                      ? 'bg-ov-blue-50 hover:bg-ov-blue-100'
                      : 'hover:bg-gray-100',
                  ].join(' ')}
                >
                  <span className="flex w-[26px] flex-none justify-center">
                    <Checkbox
                      checked={checkedFiles.has(String(f.id))}
                      onClick={() => setCheckedFiles((s) => toggle(s, String(f.id)))}
                      label={f.name}
                    />
                  </span>
                  <span className="w-[46px] flex-none">
                    {/* 서버는 우리가 보낸 extension 을 그대로 저장·반환한다 — 점 없는 파일명
                        (`Makefile`)이면 이름 전체가 확장자로 들어와 38px 칩을 넘친다.
                        넘친 글자가 놓이는 면은 파스텔이 아니라 --card 라 text-on-pastel 이
                        다크에서 사라진다(1.4.3) → 칩 안에서 잘라 낸다. */}
                    <span
                      className={`inline-flex h-[19px] w-[38px] items-center justify-center overflow-hidden rounded px-0.5 text-2xs font-bold text-on-pastel ${f.tagBg}`}
                      title={f.ext}
                    >
                      <span className="truncate">{f.ext}</span>
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1 pr-3">
                    <span className="truncate text-s text-gray-900">{f.name}</span>
                    {/* 모바일: 숨는 컬럼을 한 줄로 접는다(모바일 정본 f.mMeta).
                        최근 자료는 위치가 붙고 용량 컬럼이 없다 / 자료실은 용량이 붙는다. */}
                    <span className="truncate text-xs text-gray-400 min-[631px]:hidden">
                      {recent
                        ? t('drive-file-meta', { board: f.board, author: f.by, date: f.date })
                        : t('drive-meta-mobile', { author: f.by, date: f.date, size: f.size })}
                    </span>
                  </span>
                  {recent && (
                    <span className="hidden w-[120px] flex-none truncate text-xs text-gray-500 min-[631px]:block">
                      {f.board}
                    </span>
                  )}
                  <span className="hidden w-[100px] flex-none truncate text-xs text-gray-600 min-[631px]:block">
                    {f.by}
                  </span>
                  <span className="hidden w-[92px] flex-none text-xs text-gray-500 min-[631px]:block">
                    {f.date}
                  </span>
                  {!recent && (
                    <span className="hidden w-[74px] flex-none text-xs text-gray-500 min-[631px]:block">
                      {f.size}
                    </span>
                  )}
                  <span className="flex w-[104px] flex-none items-center justify-end gap-0.5 pr-2">
                    <button
                      type="button"
                      onClick={() => onBookmark(f)}
                      aria-label={t('nav-favorites')}
                      className={`inline-flex size-[29px] items-center justify-center rounded-md hover:bg-gray-100 ${f.bm ? 'text-warning' : 'text-gray-400'}`}
                    >
                      <BookmarkIcon className="size-3.5" filled={f.bm} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openPreview(f)}
                      aria-label={t('file-preview')}
                      className="inline-flex size-[27px] items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                    >
                      <EyeIcon className="size-3" />
                    </button>
                    <button
                      type="button"
                      disabled={dl.open}
                      onClick={() => runDownload([f])}
                      aria-label={t('file-download')}
                      className={`inline-flex size-[27px] items-center justify-center rounded-md ${
                        dl.open ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <DownloadIcon className="size-3" />
                    </button>
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* 모바일 무한 스크롤 센티널 — 바닥 전에 다음 묶음을 불러온다 */}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />}

      {/* 페이지네이션 — 데스크톱 전용. 모바일은 무한 스크롤이다. */}
      {!isMobile && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPick={(n) => setSearch({ page: n > 1 ? n : undefined })}
        />
      )}

      {/* 삭제 확인 — 문구는 레거시 그대로(단건·다건 동일, 개수 보간 없음) */}
      {delOpen && (
        <Modal onClose={() => setDelOpen(false)} label={delTitle}>
          <div className="flex w-[330px] flex-col items-center gap-2 rounded-lg bg-card px-[22px] pt-[26px] pb-[18px] shadow-[var(--shadow-modal)]">
            <span className="inline-flex size-[42px] items-center justify-center rounded-full bg-destructive-bg text-destructive">
              <TrashIcon size={20} />
            </span>
            <span className="mt-1 text-center text-sm font-semibold">{delTitle}</span>
            <span className="text-center text-s text-gray-500">{delDesc}</span>
            <div className="mt-2.5 flex w-full gap-2">
              <button
                type="button"
                onClick={() => setDelOpen(false)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-gray-200 bg-card text-sm font-semibold text-gray-800 hover:bg-gray-100"
              >
                {t('common-cancel')}
              </button>
              <button
                type="button"
                onClick={doDelete}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-destructive text-sm font-semibold text-white hover:bg-destructive-hover"
              >
                {t('common-delete')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 다운로드 진행 — X 를 누르면 바로 끊지 않고 취소 확인을 먼저 띄운다(정본) */}
      {dl.open && (
        <Modal onClose={() => setDlCancelAsk(true)} labelledBy="drive-dl-title">
          <div className="flex w-[340px] flex-col gap-3.5 rounded-lg bg-card px-5 pt-[22px] pb-[18px] shadow-[var(--shadow-modal)]">
            <div className="flex items-center">
              <span id="drive-dl-title" className="text-sm font-bold">
                {t('drive-dl-title')}
              </span>
              <button
                type="button"
                aria-label={t('common-cancel')}
                onClick={() => setDlCancelAsk(true)}
                className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
              >
                <XIcon />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-s">
                {/* 진행 문구는 폴라이트로 읽는다 — % 는 너무 잦아 aria-live 대상에서 뺀다 */}
                <span className="text-gray-600" role="status" aria-live="polite">
                  {t('drive-dl-progress-n', { done: dl.done, total: dl.total })}
                </span>
                <span className="flex-none text-gray-500" aria-hidden="true">
                  {dl.percent} %
                </span>
              </div>
              <span className="block h-1.5 overflow-hidden rounded-full bg-gray-100">
                <span
                  className="block h-full rounded-full bg-primary transition-all"
                  style={{ width: `${dl.percent}%` }}
                />
              </span>
            </div>
            {dlCancelAsk && (
              <div className="flex flex-col items-center gap-3 border-t border-gray-100 pt-3.5">
                <span className="text-center text-sm font-semibold">
                  {t('drive-dl-cancel-ask')}
                </span>
                <div className="flex w-full gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // 토스트는 띄우지 않는다 — start() 의 반환값('canceled')이
                      // runDownload 에서 한 번만 알린다(두 곳에서 띄우면 이중 호출).
                      setDlCancelAsk(false)
                      cancelDownload()
                    }}
                    className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-gray-200 bg-card text-s font-semibold text-gray-800 hover:bg-gray-100"
                  >
                    {t('common-cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDlCancelAsk(false)}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary text-s font-semibold text-white hover:bg-ov-blue-700"
                  >
                    <DownloadIcon className="size-3" /> {t('drive-dl-continue')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 삭제된 자료실 · 권한 없는 자료실 — 알린 뒤 사이드바 캐시를 갱신하고 홈으로 */}
      {blockedMessage && (
        <BlockedModal
          message={blockedMessage}
          onClose={() => {
            qc.invalidateQueries({ queryKey: ['categories'] })
            qc.invalidateQueries({ queryKey: ['boards', 'bookmarked'] })
            navigate({ to: '/' })
          }}
        />
      )}

      {upOpen && (
        <UploadModal
          limits={uploadLimits}
          rows={upload.rows}
          running={upload.running}
          onAdd={upload.add}
          onRemove={upload.remove}
          onStart={runUpload}
          onRetry={retryUpload}
          onClose={() => setUpOpen(false)}
        />
      )}

      {/* 미리보기 — 공용 Modal 을 쓴다. 직접 만들면 dialog 시맨틱·초점 이동·트랩이 빠진다.
          스크림만 어둡게 덮어쓴다(이미지·영상을 보는 화면이라 배경을 죽여야 한다). */}
      {preview && (
        <Modal onClose={() => setPreview(null)} label={preview.file.name} scrim="bg-black/[0.78]">
          <div className="relative flex max-h-[82dvh] w-[min(92vw,900px)] flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-s text-white/85">
                {preview.file.name}
              </span>
              <button
                type="button"
                aria-label={t('file-download')}
                disabled={dl.open}
                onClick={() => {
                  // 진행 모달과 겹치지 않게 미리보기를 먼저 닫는다 — 두 모달이 함께 뜨면
                  // 스택 순서(진행 모달이 위)와 페인트 순서(미리보기가 위)가 어긋나고,
                  // 초점·Tab 이 어느 패널에 속하는지도 모호해진다.
                  const f = preview.file
                  setPreview(null)
                  runDownload([f])
                }}
                className="inline-flex size-[34px] flex-none items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25 disabled:text-white/40 disabled:hover:bg-white/15"
              >
                <DownloadIcon className="size-3" />
              </button>
              <button
                type="button"
                aria-label={t('common-close')}
                onClick={() => setPreview(null)}
                className="inline-flex size-[34px] flex-none items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25"
              >
                <XIcon />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {preview.kind === 'image' && (
                <img
                  src={preview.url}
                  alt={preview.file.name}
                  className="max-h-[72dvh] max-w-full rounded-lg object-contain"
                />
              )}
              {preview.kind === 'video' && (
                // 자막 트랙은 API 가 주지 않는다 — 생기면 <track> 을 붙인다.
                <video src={preview.url} controls className="max-h-[72dvh] max-w-full rounded-lg" />
              )}
              {preview.kind === 'pdf' && (
                <iframe
                  src={preview.url}
                  title={preview.file.name}
                  className="h-[72dvh] w-full rounded-lg bg-white"
                />
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* 안내(삭제 권한 없음 · 폴더가 비어 있지 않음) */}
      {notice && (
        <Modal onClose={() => setNotice(null)} label={notice.title}>
          <div className="flex w-[330px] flex-col items-center gap-2 rounded-lg bg-card px-[22px] pt-[26px] pb-[18px] shadow-[var(--shadow-modal)]">
            <span className="mt-1 text-center text-sm font-semibold whitespace-pre-line">
              {notice.title}
            </span>
            <span className="text-center text-s text-gray-500">{notice.desc}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="mt-2.5 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-white hover:bg-ov-blue-700"
            >
              {t('common-confirm')}
            </button>
          </div>
        </Modal>
      )}

      <Toast toast={toast} onClose={hideToast} />
    </div>
  )
}
