import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { isAuthenticated } from '@/lib/authStorage'
import {
  createDriveFolder,
  deleteDriveFiles,
  deleteDriveFolders,
  renameDriveFolder,
  selectDriveFilePage,
  selectDriveFiles,
  toggleDriveFileBookmark,
} from '@/services/driveService'
import type { DriveFileListParams } from '@/types/drive'

// 자료실 파일 목록 조회. lang 헤더=현재 언어, 토큰 있을 때만 호출.
export function useDriveFiles(params: DriveFileListParams, enabled = true) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['drive-files', params, i18n.language],
    queryFn: () => selectDriveFiles(params, i18n.language),
    placeholderData: keepPreviousData,
    enabled: enabled && isAuthenticated(),
  })
}

// 「최근 자료」 목록 — take/page 페이지네이션 응답(Paginated).
export function useDriveFilePage(params: DriveFileListParams, enabled = true) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['drive-file-page', params, i18n.language],
    queryFn: () => selectDriveFilePage(params, i18n.language),
    placeholderData: keepPreviousData,
    enabled: enabled && isAuthenticated(),
  })
}

// 자료실 파일 북마크 토글. 현재 상태는 목록의 is_bookmark 가 정본이라 목록 쿼리를 무효화한다.
export function useDriveBookmarkMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fileId: string) => toggleDriveFileBookmark(fileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drive-file-page'] })
      qc.invalidateQueries({ queryKey: ['drive-files'] })
    },
  })
}

// 자료실 삭제 — 파일(휴지통)과 폴더(하드)는 엔드포인트가 갈라져 있다.
// 폴더 삭제는 «지워진 id 배열»을 돌려주므로 호출 쪽에서 남은 선택을 처리해야 한다.
export function useDriveDeleteMutation() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['drive-file-page'] })
    qc.invalidateQueries({ queryKey: ['drive-files'] })
    qc.invalidateQueries({ queryKey: ['drive'] })
  }
  const files = useMutation({
    mutationFn: ({ boardId, ids }: { boardId: string; ids: string[] }) =>
      deleteDriveFiles(boardId, ids),
    onSuccess: invalidate,
  })
  const folders = useMutation({
    mutationFn: ({ boardId, ids }: { boardId: string; ids: string[] }) =>
      deleteDriveFolders(boardId, ids),
    onSuccess: invalidate,
  })
  return { files, folders }
}

// 폴더 생성 · 이름 변경. 응답을 로컬에 반영하지 않고 ['drive'] 를 무효화한다 —
// 레거시는 응답 후 drive_folders 만 직접 고쳐서 트리(child_drive_folders)가 옛 이름으로 남았다.
export function useDriveFolderMutation() {
  const qc = useQueryClient()
  const { i18n } = useTranslation()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['drive'] })
  const create = useMutation({
    mutationFn: ({
      boardId,
      title,
      parentFolderId,
    }: {
      boardId: string
      title: string
      parentFolderId?: string
    }) => createDriveFolder(boardId, title, parentFolderId, i18n.language),
    onSuccess: invalidate,
  })
  const rename = useMutation({
    mutationFn: ({ folderId, title }: { folderId: string; title: string }) =>
      renameDriveFolder(folderId, title, i18n.language),
    onSuccess: invalidate,
  })
  return { create, rename }
}
