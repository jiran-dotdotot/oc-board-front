import { useEffect, useMemo, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { useBlocker, useNavigate } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { NamoEditor, type NamoEditorHandle } from './NamoEditor'
import {
  ATTACHMENT_MAX_COUNT,
  ATTACHMENT_MAX_TOTAL_BYTES,
  POST_ATTACHMENT_UPLOAD_ENABLED,
  POST_THUMBNAIL_UPLOAD_ENABLED,
  SCHEDULE_QUICK_TIMES,
  TITLE_MAX,
} from './constants'
import {
  type SaveIntent,
  type WriteFormValues,
  buildCreateBody,
  buildUpdateBody,
  emptyFormValues,
  isPastSchedule,
  mapWriteError,
  prefillFromPost,
  toLocalDate,
} from './writePayload'
import { Checkbox } from '@/components/common/Checkbox'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { DatePicker } from '@/components/common/DatePicker'
import { Dropdown } from '@/components/common/Dropdown'
import { Modal } from '@/components/common/Modal'
import { Radio } from '@/components/common/Radio'
import { Switch } from '@/components/common/Switch'
import { Toast } from '@/components/common/Toast'
import { AlertIcon, CalendarIcon, ImageIcon, PlusIcon, XIcon } from '@/components/common/icons'
import { useToast } from '@/components/common/useToast'
import { fmtSize } from '@/components/drive/driveData'
import { useCategories } from '@/hooks/useCategories'
import { usePostDetail, usePostWriteMutations } from '@/hooks/usePostDetail'
import { Route } from '@/routes/write'
import { uploadPostAttachments } from '@/services/postService'
import type { PostFile, PostThumbnail } from '@/types/post'
import { sanitizePostHtml } from '@/utils/postHtml'
import { writableBoards } from '@/utils/writeBoards'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

/**
 * 글쓰기 / 글 수정 (`/write?boardId=` · `/write?postId=`).
 * 정본: 개선안 통합 앱 web:624-815 · mobile:577-758 (모바일도 같은 인라인 구조, 하단 3버튼만 다르다).
 * 계약: docs/api/go/06-post-write.md — POST /boards/{id}/posts · PUT /posts/{id}. 본문은 서버가 살균하지
 * 않으므로(06:39) 저장 전 `sanitizePostHtml` 을 거친다. 첨부 업로드는 저장 성공 후 글 id 로 순차
 * 호출한다(POST /posts/{id}/attachments, BR-037). 대표이미지 «업로드»는 서버에 생성 경로가 없어 게이트다.
 */
const schema = z.object({
  boardId: z.string().min(1, 'write-board-required'),
  title: z.string().trim().min(1, 'write-title-required').max(TITLE_MAX),
})

type Picker = 'noticeFrom' | 'noticeTo' | 'scheduleAt' | null

/** 파일명 확장자(점 뒤). 서버가 확장자 없는 첨부를 400 으로 막으므로 선택 단계에서 미리 거른다. */
const extOf = (name: string): string | undefined => {
  const i = name.lastIndexOf('.')
  return i > 0 && i < name.length - 1 ? name.slice(i + 1) : undefined
}

export function WriteScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { boardId: presetBoardId, postId } = Route.useSearch()
  const editing = !!postId

  const { data: tree } = useCategories()
  const boards = useMemo(() => writableBoards(tree), [tree])
  const { data: post, error: loadError } = usePostDetail(postId)
  const loadStatus = (loadError as { response?: { status?: number } } | null)?.response?.status
  const m = usePostWriteMutations()
  const { toast, showToast, hideToast } = useToast()

  const form = useForm<WriteFormValues>({
    // 폼 스키마는 게시판·제목만 검증한다. 다른 필드는 자유값이라 zod 에 겹쳐 두지 않는다.
    resolver: zodResolver(schema) as never,
    defaultValues: emptyFormValues(presetBoardId ?? ''),
  })
  const { control, setValue, setError, clearErrors, formState } = form
  const v = useWatch({ control })
  const values = v as WriteFormValues

  // ── 수정 모드 프리필 — 데이터가 처음 도착했을 때 한 번. 내가 방금 만든 임시저장 글이 다시 로드될 때는
  //    사용자가 그 사이 고친 값을 덮지 않는다.
  const prefilled = useRef(false)
  const [existingFiles, setExistingFiles] = useState<PostFile[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([]) // 아직 업로드 전인 새 파일
  const [thumb, setThumb] = useState<PostThumbnail | null>(null)
  const [deleteFileIds, setDeleteFileIds] = useState<string[]>([])
  const [deleteThumbId, setDeleteThumbId] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!post || prefilled.current) return
    prefilled.current = true
    form.reset(prefillFromPost(post))
    setExistingFiles(post.files ?? [])
    setThumb(post.thumbnail ?? null)
  }, [post, form])

  const original = editing ? post : undefined
  const originalAct = original?.state === 'ACT'
  const boardLocked = editing && !!original && original.state !== 'SAVE'
  const board = boards.find((b) => b.id === values.boardId)
  // 공지 게이트 = 선택 게시판의 CanManage(06:228 — 아니면 서버가 403). 수정 중 트리에 없는 게시판이면 상세의 is_admin 으로.
  const canManage = board ? board.canManage : !!original?.is_admin

  // ── 이탈 확인. ⚠️ 가정(A4): dirty(폼 변경 또는 에디터 터치) 일 때만. 저장 직후·자기 자신(?postId) 이동은 통과.
  const editorTouched = useRef(false)
  const leaving = useRef(false)
  // RHF formState 는 프록시라 «렌더 중에 읽어야» 구독된다 — 콜백 안에서만 읽으면 늘 false 다.
  const isDirty = formState.isDirty
  const dirty = () => !leaving.current && (isDirty || editorTouched.current)
  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => next.pathname !== '/write' && dirty(),
    enableBeforeUnload: dirty,
    withResolver: true,
  })

  // ── 편집/미리보기 탭
  const editor = useRef<NamoEditorHandle>(null)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [previewHtml, setPreviewHtml] = useState('')
  const openPreview = async () => {
    try {
      setPreviewHtml(sanitizePostHtml(await editor.current!.getHtml()))
    } catch {
      setPreviewHtml('')
    }
    setTab('preview')
  }

  // ── 저장
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [notifyAsk, setNotifyAsk] = useState(false)
  const [picker, setPicker] = useState<Picker>(null)

  const validate = async (intent: SaveIntent) => {
    setFormError(null)
    // 임시저장은 제목 검증을 건너뛴다(레거시 :318) — 게시판만 필수.
    const ok = intent === 'draft' ? await form.trigger('boardId') : await form.trigger()
    if (!ok) return false
    if (
      intent === 'publish' &&
      values.publish === 'schedule' &&
      isPastSchedule(values.scheduleAt)
    ) {
      setError('scheduleAt', { message: 'write-schedule-past' })
      return false
    }
    return true
  }

  const save = async (intent: SaveIntent, notifyEdit = false) => {
    setSaving(true)
    let html: string
    try {
      html = sanitizePostHtml(await editor.current!.getHtml())
    } catch {
      setFormError('write-err-editor')
      setSaving(false)
      return
    }
    const sentBadges = values.noticeOn && canManage
    try {
      const r =
        postId && original
          ? await m.update.mutateAsync({
              postId,
              body: buildUpdateBody(values, html, intent, original, {
                canManage,
                notifyEdit,
                deleteFileIds,
                deleteThumbnailId: deleteThumbId,
              }),
            })
          : await m.create.mutateAsync({
              boardId: values.boardId,
              body: buildCreateBody(values, html, intent, canManage),
            })
      // 글이 저장됐다 — 이제 새 첨부를 올린다(글 id 필수). 한 건씩 순차, 실패분만 남긴다.
      // 본문·제목은 이미 서버에 있으므로 첨부가 일부 실패해도 글 자체는 유실되지 않는다.
      let failed: File[] = []
      if (pendingFiles.length) {
        const res = await uploadPostAttachments(r.id, pendingFiles)
        failed = res.failed
        // 응답은 id 뿐이라 File 메타로 행을 만들어 기존 첨부 목록에 즉시 반영한다.
        if (res.uploaded.length)
          setExistingFiles((fs) => [
            ...fs,
            ...res.uploaded.map(({ id, file }) => ({
              id,
              origin_file_name: file.name,
              extension: extOf(file.name),
              size: file.size,
            })),
          ])
        setPendingFiles(failed)
      }
      if (failed.length) {
        // 글은 저장됐는데 첨부 일부가 실패 — 화면에 남겨 재시도한다. 작성(create)이었다면 이제 글이
        // 존재하므로 수정 모드로 전환해, 재등록이 «중복 글»이 아니라 PUT + 업로드가 되게 한다.
        // ponytail: 부분 실패는 수동 재시도까지만 — 자동 재시도·롤백은 필요해지면 붙인다.
        setFormError('write-attach-upload-failed')
        if (!postId) {
          prefilled.current = true // 방금 저장한 화면 상태를 서버 프리필로 덮지 않는다
          navigate({ to: '/write', search: { postId: r.id }, replace: true })
        }
        return
      }
      if (intent === 'draft') {
        form.reset(values) // 저장한 값이 새 기준 — dirty 해제
        editorTouched.current = false
        setDeleteFileIds([])
        setDeleteThumbId(null)
        showToast(t('write-draft-saved-toast'))
        if (postId) qc.invalidateQueries({ queryKey: ['post', postId] })
        else navigate({ to: '/write', search: { postId: r.id }, replace: true })
      } else {
        leaving.current = true
        qc.removeQueries({ queryKey: ['post', r.id] })
        navigate({
          to: '/post/$postId',
          params: { postId: r.id },
          replace: true,
          state: {
            toast:
              r.state === 'SCHEDULED'
                ? 'write-scheduled-toast'
                : originalAct // 임시저장 글을 처음 발행하는 것은 «등록»이다
                  ? 'write-updated-toast'
                  : 'write-saved-toast',
          },
        })
      }
    } catch (e) {
      const info = mapWriteError(e, { sentBadges, editing })
      if (info.field === 'board') setError('boardId', { message: info.key })
      else if (info.field === 'schedule') setError('scheduleAt', { message: info.key })
      else if (info.field === 'notice') setError('noticeTo', { message: info.key })
      else setFormError(info.key)
    } finally {
      setSaving(false)
    }
  }

  const submit = async (intent: SaveIntent) => {
    if (!(await validate(intent))) return
    // 발행된 글을 고칠 때만 「수정 알림」을 묻는다(레거시 not_send_alarm, :267-272).
    if (intent === 'publish' && originalAct) setNotifyAsk(true)
    else save(intent)
  }

  const cancel = () =>
    navigate(
      values.boardId ? { to: '/board/$boardId', params: { boardId: values.boardId } } : { to: '/' },
    )

  // ── 첨부 선택 — 서버 계약(확장자 필수)과 우리 UX 상한(총 10개·총 100MB)을 미리 검사한 뒤 대기열에 넣는다.
  //    실제 업로드는 저장 성공 후 save() 가 글 id 로 순차 호출한다.
  const addFiles = (list: FileList | null) => {
    if (!POST_ATTACHMENT_UPLOAD_ENABLED || !list?.length) return
    const picked = Array.from(list)
    const withExt = picked.filter((f) => extOf(f.name))
    if (withExt.length < picked.length) showToast(t('write-attach-bad'))
    const room = ATTACHMENT_MAX_COUNT - existingFiles.length - pendingFiles.length
    const capped = withExt.slice(0, Math.max(0, room))
    if (withExt.length > capped.length)
      showToast(t('write-attach-too-many', { n: ATTACHMENT_MAX_COUNT }))
    let total =
      existingFiles.reduce((s, f) => s + (f.size ?? 0), 0) +
      pendingFiles.reduce((s, f) => s + f.size, 0)
    const accepted: File[] = []
    for (const f of capped) {
      if (f.size <= 0 || total + f.size > ATTACHMENT_MAX_TOTAL_BYTES) {
        showToast(t('write-attach-too-large'))
        break
      }
      total += f.size
      accepted.push(f)
    }
    if (accepted.length) {
      setPendingFiles((p) => [...p, ...accepted])
      editorTouched.current = true
    }
  }

  // ── 로드 실패(없는 글·권한 없음·타인 글)
  const blocked =
    editing && (loadStatus === 404 || loadStatus === 403 || (post && !post.is_mine))
      ? loadStatus === 403 || (post && !post.is_mine)
        ? 'write-err-not-author'
        : 'write-load-notfound'
      : null

  const err = (name: keyof WriteFormValues) => formState.errors[name]?.message as string | undefined
  const titleLen = Array.from(values.title ?? '').length
  const today = toLocalDate(new Date())
  const fileCount = existingFiles.length + pendingFiles.length
  const fileTotal =
    existingFiles.reduce((s, f) => s + (f.size ?? 0), 0) +
    pendingFiles.reduce((s, f) => s + f.size, 0)
  const submitLabel = originalAct ? t('write-edit-submit') : t('write-submit')

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="text-lg font-extrabold tracking-title">
        {t(editing ? 'write-edit-title' : 'write-page-title')}
      </h1>

      {blocked ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-gray-200 bg-card px-[26px] py-10">
          <span className="text-sm text-gray-600">{t(blocked)}</span>
          <button type="button" onClick={cancel} className={BTN_WHITE}>
            {t('common-confirm')}
          </button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            submit('publish')
          }}
          className="flex flex-col gap-[18px] rounded-lg border border-gray-200 bg-card px-[26px] py-6"
        >
          {/* 게시판 */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel required>{t('nav-board')}</FieldLabel>
            {boardLocked ? (
              <>
                <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-gray-100 px-3 text-sm text-gray-400 min-[631px]:w-[280px]">
                  <span className="truncate">{board?.label ?? original?.board?.title ?? ''}</span>
                </div>
                <span className="text-xs text-gray-400">{t('write-board-locked')}</span>
              </>
            ) : (
              <BoardSelect
                boards={boards}
                value={values.boardId}
                invalid={!!err('boardId')}
                onPick={(id) => {
                  setValue('boardId', id, { shouldDirty: true })
                  clearErrors('boardId')
                  // 게시판이 바뀌면 공지 설정을 초기화한다(레거시 :170-171) — 권한이 달라진다.
                  setValue('noticeOn', false)
                }}
              />
            )}
            {err('boardId') && <FieldError>{t(err('boardId') as never)}</FieldError>}
          </div>

          {/* 제목 */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel required>{t('write-title-label')}</FieldLabel>
            <div className="relative">
              <input
                {...form.register('title')}
                onChange={(e) => {
                  setValue('title', Array.from(e.target.value).slice(0, TITLE_MAX).join(''), {
                    shouldDirty: true,
                  })
                  clearErrors('title')
                }}
                placeholder={t('write-title-ph')}
                aria-invalid={!!err('title') || undefined}
                className={`h-11 w-full rounded-md border bg-card pr-[76px] pl-3.5 text-sm outline-none focus:border-primary ${err('title') ? 'border-destructive' : values.title ? 'border-primary' : 'border-gray-300'}`}
              />
              <span
                aria-live="polite"
                className={`absolute top-1/2 right-3.5 -translate-y-1/2 text-xs ${titleLen >= TITLE_MAX ? 'text-destructive' : titleLen >= TITLE_MAX - 6 ? 'text-warning' : 'text-gray-400'}`}
              >
                {titleLen}/{TITLE_MAX}
              </span>
            </div>
            {err('title') && <FieldError>{t(err('title') as never)}</FieldError>}
          </div>

          {/* 첨부 — 업로드는 저장 성공 후 글 id 로 순차(POST /posts/{id}/attachments, BR-037).
              기존 첨부 삭제는 delete_file_id 로(06:283). */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <FieldLabel>{t('write-attach')}</FieldLabel>
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = '' // 같은 파일 재선택도 onChange 가 다시 뜨도록
                }}
              />
              <button
                type="button"
                disabled={!POST_ATTACHMENT_UPLOAD_ENABLED}
                onClick={() => fileInput.current?.click()}
                className={BTN_SM}
              >
                {t('write-attach-pc')}
              </button>
              <button
                type="button"
                disabled={fileCount === 0}
                onClick={() => {
                  // 「전체 삭제」도 서버 반영 대상에 넣는다 — 레거시는 화면에서만 지웠다(:886).
                  setDeleteFileIds((ids) => [...ids, ...existingFiles.map((f) => f.id)])
                  setExistingFiles([])
                  setPendingFiles([])
                  editorTouched.current = true
                }}
                className={BTN_SM}
              >
                {t('write-attach-clear')}
              </button>
              <span className="ml-auto text-xs text-gray-500">
                {t('write-attach-count', { n: fileCount })} ({fmtSize(fileTotal)}/
                {fmtSize(ATTACHMENT_MAX_TOTAL_BYTES)})
              </span>
            </div>
            <div
              aria-disabled={!POST_ATTACHMENT_UPLOAD_ENABLED}
              onClick={() => POST_ATTACHMENT_UPLOAD_ENABLED && fileInput.current?.click()}
              onDragOver={(e) => {
                if (POST_ATTACHMENT_UPLOAD_ENABLED) e.preventDefault()
              }}
              onDrop={(e) => {
                if (!POST_ATTACHMENT_UPLOAD_ENABLED) return
                e.preventDefault()
                addFiles(e.dataTransfer.files)
              }}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-5 py-[26px] text-s text-gray-500 hover:border-primary hover:text-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:border-gray-300 aria-disabled:hover:text-gray-500"
            >
              {t('write-attach-dropzone')}
            </div>
            <span className="text-xs text-gray-400">
              {POST_ATTACHMENT_UPLOAD_ENABLED
                ? t('write-attach-note')
                : `${t('write-attach-gated')} (BR-037)`}
            </span>
            {fileCount > 0 && (
              <ul className="flex flex-col gap-1.5">
                {existingFiles.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-2.5 rounded-md border border-gray-200 px-3 py-2"
                  >
                    <span className="inline-flex h-5 w-10 flex-none items-center justify-center rounded bg-l-blue text-2xs font-extrabold text-on-pastel uppercase">
                      {f.extension ?? ''}
                    </span>
                    <span className="flex-1 truncate text-s text-gray-800">
                      {f.origin_file_name}
                    </span>
                    <span className="flex-none text-xs text-gray-400">{fmtSize(f.size ?? 0)}</span>
                    <button
                      type="button"
                      aria-label={t('write-attach-remove')}
                      onClick={() => {
                        setDeleteFileIds((ids) => [...ids, f.id])
                        setExistingFiles((fs) => fs.filter((x) => x.id !== f.id))
                        editorTouched.current = true
                      }}
                      className="inline-flex size-6 flex-none items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-destructive"
                    >
                      <XIcon />
                    </button>
                  </li>
                ))}
                {pendingFiles.map((f, i) => (
                  <li
                    key={`pending-${i}-${f.name}`}
                    className="flex items-center gap-2.5 rounded-md border border-primary/30 bg-ov-blue-50 px-3 py-2"
                  >
                    <span className="inline-flex h-5 w-10 flex-none items-center justify-center rounded bg-l-blue text-2xs font-extrabold text-on-pastel uppercase">
                      {extOf(f.name) ?? ''}
                    </span>
                    <span className="flex-1 truncate text-s text-gray-800">{f.name}</span>
                    <span className="flex-none rounded bg-primary px-1.5 text-2xs font-bold text-white">
                      {t('write-attach-new')}
                    </span>
                    <span className="flex-none text-xs text-gray-400">{fmtSize(f.size)}</span>
                    <button
                      type="button"
                      aria-label={t('write-attach-remove')}
                      onClick={() => setPendingFiles((fs) => fs.filter((_, x) => x !== i))}
                      className="inline-flex size-6 flex-none items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-destructive"
                    >
                      <XIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 본문 — 나모 에디터(툴바는 에디터 소유) + 편집/미리보기 탭 */}
          <div className="flex flex-col">
            <div className={tab === 'edit' ? 'flex flex-col' : 'hidden'}>
              <div className="h-2 rounded-t-md border border-b-0 border-gray-200 bg-gray-50" />
              <NamoEditor
                ref={editor}
                initialHtml={editing ? post?.content : undefined}
                onTouch={() => {
                  editorTouched.current = true
                }}
              />
            </div>
            {tab === 'preview' && (
              <div className="min-h-[240px] rounded-md border border-gray-200 bg-card p-4">
                {previewHtml ? (
                  <div
                    className="post-body text-sm leading-prose break-words text-gray-800"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                ) : (
                  <span className="text-sm text-gray-400">{t('write-preview-empty')}</span>
                )}
              </div>
            )}
            <div role="tablist" className="mt-1 flex gap-4 border-b border-gray-100">
              {(['edit', 'preview'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => (k === 'preview' ? openPreview() : setTab('edit'))}
                  className={`-mb-px border-b-2 px-1 py-2 text-s ${tab === k ? 'border-primary font-bold text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {t(k === 'edit' ? 'write-tab-edit' : 'write-tab-preview')}
                </button>
              ))}
            </div>
          </div>

          {/* 대표 이미지 — 서버에 «생성» 경로가 없어 업로드는 게이트(BR-037). 기존 썸네일 표시·삭제만
              가능하다(delete_thumbnail_id, 06:284 — 삭제는 계약 있음). */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{t('write-thumb')}</FieldLabel>
            <div className="flex items-end gap-3">
              {thumb ? (
                <span className="relative inline-flex size-24 flex-none items-center justify-center overflow-hidden rounded-md bg-l-purple text-on-pastel">
                  {thumb.url || thumb.src?.s ? (
                    <img
                      src={thumb.url ?? thumb.src?.s}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="size-6 opacity-65" />
                  )}
                  <button
                    type="button"
                    aria-label={t('write-thumb-remove')}
                    onClick={() => {
                      setDeleteThumbId(thumb.id)
                      setThumb(null)
                      editorTouched.current = true
                    }}
                    className="absolute top-1 right-1 inline-flex size-[22px] items-center justify-center rounded-full bg-gray-900 text-gray-50"
                  >
                    <XIcon />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={!POST_THUMBNAIL_UPLOAD_ENABLED}
                  aria-label={t('write-thumb-add')}
                  className="inline-flex size-24 flex-none items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-gray-300 disabled:hover:text-gray-400"
                >
                  <PlusIcon />
                </button>
              )}
              <span className="pb-1 text-xs text-gray-400">
                {POST_THUMBNAIL_UPLOAD_ENABLED
                  ? t('write-thumb-note')
                  : `${t('write-attach-gated')} (BR-037)`}
              </span>
            </div>
          </div>

          {/* 발행 옵션 */}
          <section className="flex flex-col gap-4 rounded-xl border border-gray-200 px-5 py-[18px]">
            <h2 className="text-sm font-bold tracking-title">{t('write-options')}</h2>

            <OptionRow label={t('write-comment-section')}>
              <label className="inline-flex items-center gap-2">
                <Checkbox
                  checked={values.allowComment}
                  onClick={() =>
                    setValue('allowComment', !values.allowComment, { shouldDirty: true })
                  }
                  label={t('write-comment-allow')}
                />
                <span className="text-sm text-gray-800">{t('write-comment-allow')}</span>
              </label>
              <span className="ml-3 inline-flex items-center gap-[9px]">
                <span className="text-sm text-gray-800">{t('write-comment-alarm')}</span>
                <Switch
                  on={values.allowComment && values.commentAlarm}
                  disabled={!values.allowComment}
                  onClick={() =>
                    setValue('commentAlarm', !values.commentAlarm, { shouldDirty: true })
                  }
                  label={t('write-comment-alarm')}
                />
              </span>
            </OptionRow>

            {canManage && (
              <>
                <Divider />
                <OptionRow label={t('write-notice')} alignTop>
                  <div className="flex min-w-[240px] flex-1 flex-col gap-2.5">
                    <label className="inline-flex w-fit items-center gap-2.5">
                      <Switch
                        on={values.noticeOn}
                        onClick={() =>
                          setValue('noticeOn', !values.noticeOn, { shouldDirty: true })
                        }
                        label={t('write-notice-on')}
                      />
                      <span className="text-sm text-gray-800">{t('write-notice-on')}</span>
                    </label>
                    {values.noticeOn && (
                      <div role="radiogroup" className="flex flex-wrap gap-5">
                        <Radio
                          on={values.noticeMode === 'always'}
                          onClick={() => setValue('noticeMode', 'always', { shouldDirty: true })}
                          label={t('write-notice-always')}
                        />
                        <Radio
                          on={values.noticeMode === 'period'}
                          onClick={() => setValue('noticeMode', 'period', { shouldDirty: true })}
                          label={t('write-notice-period')}
                        />
                      </div>
                    )}
                    {values.noticeOn && values.noticeMode === 'period' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <DateChip onClick={() => setPicker('noticeFrom')}>
                          {values.noticeFrom.replace(/-/g, '.')}
                        </DateChip>
                        <span className="text-gray-400">~</span>
                        <DateChip onClick={() => setPicker('noticeTo')}>
                          {values.noticeTo.replace(/-/g, '.')}
                        </DateChip>
                      </div>
                    )}
                    {err('noticeTo') && <FieldError>{t(err('noticeTo') as never)}</FieldError>}
                    <span className="text-xs text-gray-400">{t('write-notice-note')}</span>
                  </div>
                </OptionRow>
              </>
            )}

            {!originalAct && (
              <>
                <Divider />
                <OptionRow label={t('write-publish-time')}>
                  <div role="radiogroup" className="flex flex-wrap items-center gap-3">
                    <Radio
                      on={values.publish === 'now'}
                      onClick={() => {
                        setValue('publish', 'now', { shouldDirty: true })
                        clearErrors('scheduleAt')
                      }}
                      label={t('write-publish-now')}
                    />
                    <Radio
                      on={values.publish === 'schedule'}
                      onClick={() => setValue('publish', 'schedule', { shouldDirty: true })}
                      label={t('write-schedule')}
                    />
                    {values.publish === 'schedule' && (
                      <>
                        <DateChip
                          onClick={() => setPicker('scheduleAt')}
                          invalid={!!err('scheduleAt')}
                        >
                          {values.scheduleAt.replace('T', ' ').replace(/-/g, '.')}
                        </DateChip>
                        <span className="text-xs text-gray-400">{t('write-schedule-note')}</span>
                      </>
                    )}
                  </div>
                  {err('scheduleAt') && <FieldError>{t(err('scheduleAt') as never)}</FieldError>}
                </OptionRow>
              </>
            )}
          </section>

          {formError && (
            <div
              role="alert"
              className="rounded-md bg-destructive-bg px-3.5 py-2.5 text-s text-destructive"
            >
              {t(formError as never)}
            </div>
          )}

          {/* 버튼줄 — 데스크톱: 우측 정렬 h40 · 모바일: 3버튼 flex-1 h48(정본 46), 취소는 데스크톱만 */}
          <div className="-mx-[26px] -mb-6 flex gap-2 border-t border-gray-100 px-[26px] py-4 min-[631px]:justify-end min-[631px]:border-0 min-[631px]:p-0 min-[631px]:pt-0">
            <button type="button" onClick={cancel} className={`${BTN_WHITE} max-[630px]:hidden`}>
              {t('common-cancel')}
            </button>
            {!originalAct && (
              <button
                type="button"
                disabled={saving}
                onClick={() => submit('draft')}
                className={`${BTN_WHITE} flex-1 min-[631px]:flex-none`}
              >
                {t('write-draft-save')}
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={openPreview}
              className={`${BTN_WHITE} flex-1 min-[631px]:flex-none`}
            >
              {t('write-tab-preview')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-md bg-primary px-[22px] text-sm font-bold text-white hover:bg-ov-blue-700 disabled:opacity-60 min-[631px]:h-10 min-[631px]:flex-none min-[631px]:font-semibold"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      )}

      {/* 날짜 선택 */}
      {picker === 'noticeFrom' && (
        <DatePicker
          title={t('write-notice-start')}
          value={values.noticeFrom}
          min={today}
          max={values.noticeTo}
          onPick={(d) => {
            setValue('noticeFrom', d, { shouldDirty: true })
            clearErrors('noticeTo')
            setPicker(null)
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'noticeTo' && (
        <DatePicker
          title={t('write-notice-end')}
          value={values.noticeTo}
          min={values.noticeFrom}
          onPick={(d) => {
            setValue('noticeTo', d, { shouldDirty: true })
            clearErrors('noticeTo')
            setPicker(null)
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'scheduleAt' && (
        <DatePicker
          title={t('write-schedule-title')}
          value={values.scheduleAt}
          min={today}
          withTime
          quickTimes={SCHEDULE_QUICK_TIMES}
          onPick={(d) => {
            setValue('scheduleAt', d, { shouldDirty: true })
            clearErrors('scheduleAt')
          }}
          onClose={() => setPicker(null)}
        />
      )}

      {/* 수정 알림 — 발행된 글을 고칠 때만(not_send_alarm) */}
      {notifyAsk && (
        <ConfirmModal
          title={t('write-notify-title')}
          confirmLabel={t('write-notify-send')}
          cancelLabel={t('write-notify-skip')}
          onCancel={() => {
            setNotifyAsk(false)
            save('publish', false)
          }}
          onConfirm={() => {
            setNotifyAsk(false)
            save('publish', true)
          }}
        />
      )}

      {/* 이탈 확인 */}
      {blocker.status === 'blocked' && (
        <ConfirmModal
          title={t('write-leave-title')}
          sub={t('write-leave-sub')}
          confirmLabel={t('write-leave-go')}
          cancelLabel={t('write-leave-keep')}
          onCancel={blocker.reset}
          onConfirm={blocker.proceed}
        />
      )}

      {saving && (
        <Modal onClose={() => {}} label={t('write-saving')} role="alertdialog">
          <div className="flex flex-col items-center gap-3.5 rounded-lg bg-card px-[34px] py-7 shadow-[var(--shadow-modal)]">
            <svg
              className="size-[30px] animate-spin text-primary [animation-duration:0.8s]"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" stroke="var(--color-gray-200)" strokeWidth="3" />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-sm whitespace-nowrap text-gray-600">{t('write-saving')}</span>
          </div>
        </Modal>
      )}

      <Toast toast={toast} onClose={hideToast} />
    </div>
  )
}

/* ── 서브 컴포넌트 ── */
const BTN_WHITE =
  'inline-flex h-12 items-center justify-center rounded-md border border-gray-200 bg-card px-[18px] text-sm font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-60 min-[631px]:h-10'
const BTN_SM =
  'inline-flex h-8 items-center rounded-md border border-gray-200 bg-card px-3.5 text-s font-semibold text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card'

function BoardSelect({
  boards,
  value,
  invalid,
  onPick,
}: {
  boards: { id: string; label: string }[]
  value: string
  invalid: boolean
  onPick: (id: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const current = boards.find((b) => b.id === value)
  return (
    <Dropdown
      size="md"
      width="w-full min-[631px]:w-[280px]"
      label={current?.label ?? t('write-board-ph')}
      placeholder={!current}
      invalid={invalid}
      open={open}
      onToggle={() => setOpen((o) => !o)}
      onClose={() => setOpen(false)}
      options={boards.map((b) => ({
        key: b.id,
        label: b.label,
        selected: b.id === value,
        onPick: () => onPick(b.id),
      }))}
    />
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-s font-semibold text-gray-700">
      {children}
      {required && <span className="text-destructive"> *</span>}
    </span>
  )
}
function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className="flex items-center gap-1 text-xs text-destructive">
      <AlertIcon />
      {children}
    </span>
  )
}
function OptionRow({
  label,
  children,
  alignTop,
}: {
  label: string
  children: React.ReactNode
  alignTop?: boolean
}) {
  return (
    <div className={`flex flex-wrap gap-3 ${alignTop ? 'items-start' : 'items-center'}`}>
      <span
        className={`w-24 flex-none text-s font-semibold text-gray-700 ${alignTop ? 'pt-1' : ''}`}
      >
        {label}
      </span>
      {children}
    </div>
  )
}
function Divider() {
  return <span className="h-px bg-gray-100" />
}
function DateChip({
  children,
  onClick,
  invalid,
}: {
  children: React.ReactNode
  onClick: () => void
  invalid?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-s text-gray-800 hover:border-primary ${invalid ? 'border-destructive' : 'border-gray-200'}`}
    >
      <CalendarIcon />
      {children}
    </button>
  )
}
