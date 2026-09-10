import { useState } from 'react'

import { useNavigate } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/common/Checkbox'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { NoticeBadge } from '@/components/common/NoticeBadge'
import { Pagination } from '@/components/common/Pagination'
import { Toast } from '@/components/common/Toast'
import { BookmarkIcon, PaperclipIcon, TrashIcon } from '@/components/common/icons'
import { useToast } from '@/components/common/useToast'
import {
  CHIP_LABEL_KEY,
  EMPTY_KEY,
  TAB_LABEL_KEY,
  TRASH_KEEP_DAYS,
  columnCfg,
} from '@/components/mypage/constants'
import { CHIP_ORDER, MY_TABS, hasTabs, resolveTab } from '@/components/mypage/myParams'
import { type MyRow, fileToRow, postToRow } from '@/components/mypage/rowMapper'
import { useDriveBookmarkMutation } from '@/hooks/useDriveFiles'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useMe } from '@/hooks/useMe'
import { useMyCounts, useMyList, useMyMutations, useMyTabCounts } from '@/hooks/useMyActivity'
import { usePostBookmarkMutation } from '@/hooks/usePosts'
import { type MySearch, Route } from '@/routes/my'
import type { ApiDriveFile } from '@/types/drive'
import type { DriveRestoreResult } from '@/types/drive'
import type { Post, PostBulkResult } from '@/types/post'
import { deviceDefaultLimit, readStoredLimit } from '@/utils/listLimit'

export function MyActivityScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = Route.useSearch()

  const chip = search.chip ?? 'important'
  const tab = resolveTab(chip, search.kind)
  const page = search.page ?? 1
  // 개수 기본값: URL → localStorage(레거시 'postLimit') → 기기폭(모바일 20 / 데스크톱 10)
  const [deviceLimit] = useState(deviceDefaultLimit)
  const [storedLimit] = useState(readStoredLimit)
  const perPage = search.limit ?? storedLimit ?? deviceLimit

  const setSearch = (patch: MySearch) =>
    navigate({ to: '/my', search: (prev: MySearch) => ({ ...prev, ...patch }) })

  // 모바일은 페이지네이션 대신 무한 스크롤(≤630px). 페이지를 이어 붙이는 대신 take 를 키워
  // 1페이지로 다시 받는다 — 누적 배열·중복 제거가 필요 없고 오프셋이 밀리지 않는다(게시판 목록과 동일).
  const isMobile = useIsMobile()
  const scope = `${chip}|${tab}|${perPage}`
  const [loaded, setLoaded] = useState({ scope, pages: 1 })
  const loadedPages = loaded.scope === scope ? loaded.pages : 1
  // 칩·탭·개수가 바뀌면 처음부터 다시 쌓는다. effect 로 하면 리셋 전 옛 묶음이 한 프레임 그려진다.
  if (loaded.scope !== scope) setLoaded({ scope, pages: 1 })

  // 선택도 같은 scope 에 묶는다 — 탭을 옮기면 다른 도메인의 id 가 남아 있으면 안 된다.
  const [sel, setSel] = useState<{ scope: string; ids: string[] }>({ scope, ids: [] })
  const selIds = sel.scope === scope ? sel.ids : []
  if (sel.scope !== scope) setSel({ scope, ids: [] })
  const setSelIds = (ids: string[]) => setSel({ scope, ids })

  const { data, isLoading, isError } = useMyList(
    chip,
    tab,
    isMobile ? 1 : page,
    isMobile ? perPage * loadedPages : perPage,
  )
  const counts = useMyCounts()
  // 하위탭 카운트 — 활성/비활성 둘 다 숫자를 보여 준다(클릭해야 뜨지 않도록)
  const tabCounts = useMyTabCounts(chip)
  const { data: me } = useMe()

  const isTrash = chip === 'trash'
  const isFileTab = tab === 'file'
  const untitled = t('my-untitled')
  const rows: MyRow[] = (data?.data ?? []).map((r) =>
    isFileTab ? fileToRow(r as ApiDriveFile, chip) : postToRow(r as Post, chip, untitled),
  )
  const total = data?.total ?? 0
  const totalPages = data?.last_page ?? 1
  const hasMore = isMobile && rows.length < total
  const sentinelRef = useInfiniteScroll(
    () => setLoaded({ scope, pages: loadedPages + 1 }),
    hasMore && !isLoading,
  )

  const selected = new Set(selIds)
  // 표시된 행만 센다 — 페이지를 옮기면 서버 응답에 없는 id 가 남을 수 있다.
  const visibleSel = rows.filter((r) => selected.has(r.id))
  const selCount = visibleSel.length
  const allChecked = rows.length > 0 && selCount === rows.length
  const allMixed = selCount > 0 && !allChecked

  const { toast, showToast, hideToast } = useToast()
  const { trash, purge, restore } = useMyMutations(isFileTab ? 'file' : 'post')
  const { mutate: togglePostBookmark } = usePostBookmarkMutation()
  const { mutate: toggleFileBookmark } = useDriveBookmarkMutation()
  const [purgeOpen, setPurgeOpen] = useState(false)

  const cfg = columnCfg(chip, tab)
  const ids = visibleSel.map((r) => r.id)

  /**
   * 일괄 결과 보고. 전건 거절도 200 이라 `affected` 로만 성공을 판정한다.
   * 제외 사유(권한·없음·이미 처리·용량)는 서버가 구분해 주지 않으므로 개수까지만 말한다.
   */
  const report = (base: 'restore' | 'purge' | 'trash', res: PostBulkResult) => {
    setSelIds([])
    const ignored = res.ignored_ids.length
    if (res.affected === 0) {
      showToast(t('my-toast-none'), 'error')
      return
    }
    const n = res.affected
    const m = ignored
    // 키를 템플릿으로 조립하지 않는다 — t() 의 키 타입 검사와 데드 키 스캔이 둘 다 눈이 먼다.
    const msg =
      base === 'restore'
        ? m > 0
          ? t('my-toast-restore-partial', { n, m })
          : t('my-toast-restore', { n })
        : base === 'purge'
          ? m > 0
            ? t('my-toast-purge-partial', { n, m })
            : t('my-toast-purge', { n })
          : m > 0
            ? t('my-toast-trash-partial', { n, m })
            : t('my-toast-trash', { n })
    showToast(msg)
  }
  const onError = () => showToast(t('my-action-failed'), 'error')

  const doRestore = () =>
    restore.mutate(ids, {
      onSuccess: (res) => {
        // 자료 복원만 「용량 초과」를 200 + fail_count 로 알린다(09:497) — 제외 개수와 뜻이 다르다.
        const quota = (res as DriveRestoreResult).fail_count ?? 0
        if (quota > 0) {
          setSelIds([])
          showToast(t('my-toast-restore-quota', { n: res.affected, m: quota }), 'error')
          return
        }
        report('restore', res)
      },
      onError,
    })
  const doPurge = () => {
    setPurgeOpen(false)
    purge.mutate(ids, { onSuccess: (res) => report('purge', res), onError })
  }
  const doTrash = () => trash.mutate(ids, { onSuccess: (res) => report('trash', res), onError })

  const openRow = (r: MyRow) => {
    if (r.kind !== 'post' || isTrash) return
    // 임시저장·예약 글은 상세가 아니라 «이어 쓰기»로 — 레거시 mypage.vue:427 과 같다.
    if (chip === 'draft' || chip === 'schedule') {
      navigate({ to: '/write', search: { postId: r.id } })
      return
    }
    // ⚠ 목록에 read gate 가 없어 상세가 403 일 수 있다(05:373·420) — 상세 화면이 안내를 띄운다.
    navigate({ to: '/post/$postId', params: { postId: r.id } })
  }

  const busy = trash.isPending || purge.isPending || restore.isPending
  const deptRank = [me?.member?.department?.name, me?.member?.rank?.name, me?.email]
    .filter(Boolean)
    .join(' · ')

  return (
    // 정본 본문은 width:100% 다 — 폭 제한·가운데 정렬이 없다(개선안 통합 앱.dc.html:1071).
    // 880px 은 「화면 08」 아트보드가 자기를 보여주려고 두른 «데모 프레임» 값이었다.
    <div className="flex w-full min-w-0 flex-col gap-3.5">
      <h1 className="text-lg font-extrabold tracking-[-0.01em]">{t('nav-my')}</h1>

      {/* 프로필 요약 카드 — /me 실데이터. 「댓글」 타일은 Go 에 집계가 없어 뺐다(BR-038) */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-card px-[22px] py-[18px]">
        {me?.profile_src ? (
          <img
            src={me.profile_src}
            alt=""
            className="size-[52px] flex-none rounded-full object-cover"
          />
        ) : (
          <span className="inline-flex size-[52px] flex-none items-center justify-center rounded-full bg-l-blue text-xl font-bold text-on-pastel">
            {me?.name?.trim().charAt(0) ?? ''}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-base font-bold tracking-[-0.01em]">{me?.name ?? ''}</span>
          <span className="truncate text-s text-gray-500">{deptRank}</span>
        </div>
        <div className="ml-auto flex flex-none gap-6">
          <Stat
            n={counts.my}
            label={t('my-chip-my')}
            onClick={() => setSearch({ chip: 'my', kind: undefined, page: undefined })}
          />
          <Stat
            n={counts.important}
            label={t('my-chip-important')}
            onClick={() => setSearch({ chip: undefined, kind: undefined, page: undefined })}
          />
        </div>
      </div>

      {/* 필터 칩 5종 — 정본은 다섯 개 «전부»에 카운트를 붙인다(개선안 통합 앱.dc.html:1086) */}
      <div className="flex flex-wrap gap-1.5">
        {CHIP_ORDER.map((c) => {
          const on = chip === c
          return (
            <button
              key={c}
              type="button"
              onClick={() => setSearch({ chip: c, kind: undefined, page: undefined })}
              className={[
                'inline-flex h-8 items-center gap-[5px] rounded-full px-3.5 text-s font-semibold whitespace-nowrap',
                on ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              ].join(' ')}
            >
              {t(CHIP_LABEL_KEY[c])}
              <span className="text-xs font-bold opacity-75">{counts[c]}</span>
            </button>
          )
        })}
      </div>

      {/* 게시글 / 자료 하위탭 — 두 도메인이 다 있는 칩에만(임시저장·예약은 게시글 전용) */}
      {hasTabs(chip) && (
        <div className="-mt-1 flex gap-5 border-b border-gray-200">
          {MY_TABS.map((tb) => {
            const on = tab === tb
            // 활성 탭은 방금 읽은 목록 total 을, 비활성 탭은 카운트 쿼리 값을 쓴다(둘 다 표시).
            const count = on ? total : ((tb === 'file' ? tabCounts?.file : tabCounts?.post) ?? 0)
            return (
              <button
                key={tb}
                type="button"
                onClick={() => setSearch({ kind: tb, page: undefined })}
                className={[
                  '-mb-px border-b-2 px-0.5 pb-[9px] text-sm font-semibold whitespace-nowrap',
                  on ? 'border-primary text-gray-900' : 'border-transparent text-gray-500',
                ].join(' ')}
              >
                {t(TAB_LABEL_KEY[tb])}
                <span className={`ml-1 ${on ? 'text-primary' : 'text-gray-400'}`}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {isError ? (
        <Notice text={t('my-load-failed')} />
      ) : isLoading ? (
        <Notice text={t('common-loading')} />
      ) : rows.length === 0 ? (
        <Notice text={t(EMPTY_KEY[chip])} icon />
      ) : (
        <>
          {isMobile ? (
            /* 모바일 정본은 «표가 아니다» — 테두리 카드 안에 「제목 + 메타 한 줄」 행이 쌓인다
               (개선안 통합 앱 mobile.dc.html:1037). 컬럼 헤더가 없고 전체선택은 아래 바로 내려간다. */
            <div className="overflow-hidden rounded-md border border-gray-200 bg-card">
              {rows.map((r) => {
                const checked = selected.has(r.id)
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-2.5 border-b border-gray-100 px-[18px] py-3.5 last:border-b-0 hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={checked}
                      onClick={() =>
                        setSelIds(checked ? selIds.filter((id) => id !== r.id) : [...selIds, r.id])
                      }
                      label={r.title}
                    />
                    {r.isNotice && <NoticeBadge />}
                    {r.isFile && (
                      <span
                        className={`inline-flex h-5 w-10 flex-none items-center justify-center rounded text-2xs font-bold text-on-pastel ${r.tagBg}`}
                      >
                        {r.ext}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => openRow(r)}
                      className="flex min-w-0 flex-1 flex-col gap-[3px] text-left"
                    >
                      <span className="truncate text-sm font-semibold text-gray-900">
                        {r.title}
                      </span>
                      <span className="truncate text-xs text-gray-400">{r.meta}</span>
                    </button>
                    {r.isBookmark && (
                      <button
                        type="button"
                        aria-label={t('drive-bm-remove')}
                        onClick={() =>
                          r.kind === 'file' ? toggleFileBookmark(r.id) : togglePostBookmark(r.id)
                        }
                        className="inline-flex size-[22px] flex-none items-center justify-center rounded-md text-warning hover:bg-gray-100"
                      >
                        <BookmarkIcon className="size-3.5 flex-none" filled />
                      </button>
                    )}
                    {cfg.action && (
                      <button
                        type="button"
                        onClick={() => navigate({ to: '/write' })}
                        className="inline-flex h-[29px] flex-none items-center rounded-md border border-gray-200 bg-card px-[11px] text-xs font-semibold whitespace-nowrap text-gray-700 hover:bg-gray-200"
                      >
                        {t('my-action-continue')}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            /* 데스크톱 정본은 표를 카드로 감싸지 않는다 — overflow-x 컨테이너 직속이고
               헤더에 배경이 없다(개선안 통합 앱.dc.html:1098). 면은 이미 main 의 bg-card 다. */
            <div className="overflow-x-auto">
              <div style={{ minWidth: cfg.minW }}>
                {/* 헤더 (컬럼 라벨) */}
                <div
                  className="grid h-10 items-center gap-2.5 border-b border-gray-200 px-1 text-xs text-gray-500"
                  style={{ gridTemplateColumns: cfg.cols }}
                >
                  <Checkbox
                    checked={allChecked}
                    mixed={allMixed}
                    onClick={() => setSelIds(allChecked ? [] : rows.map((r) => r.id))}
                    label={t('my-select-all')}
                  />
                  <span>{t('col-title')}</span>
                  <span>{t('col-location')}</span>
                  {cfg.trash && (
                    <>
                      <span>{t('my-col-deleter')}</span>
                      <span>{t('col-regdate')}</span>
                    </>
                  )}
                  <span>{t(cfg.dateKey)}</span>
                  {cfg.stats && (
                    <>
                      <span className="text-center">{t('col-views')}</span>
                      <span className="text-center">{t('col-likes')}</span>
                    </>
                  )}
                  {cfg.action && <span />}
                </div>
                {/* 행 */}
                {rows.map((r) => {
                  const checked = selected.has(r.id)
                  return (
                    <div
                      key={r.id}
                      className={[
                        'grid min-h-[46px] items-center gap-2.5 border-b border-gray-100 px-1 hover:bg-gray-50',
                        checked ? 'bg-gray-50' : '',
                      ].join(' ')}
                      style={{ gridTemplateColumns: cfg.cols }}
                    >
                      <Checkbox
                        checked={checked}
                        onClick={() =>
                          setSelIds(
                            checked ? selIds.filter((id) => id !== r.id) : [...selIds, r.id],
                          )
                        }
                        label={r.title}
                      />
                      {/* 제목 셀 */}
                      <span className="flex min-w-0 items-center gap-[7px] pr-3.5">
                        {r.isBookmark && (
                          <button
                            type="button"
                            aria-label={t('drive-bm-remove')}
                            onClick={() =>
                              r.kind === 'file'
                                ? toggleFileBookmark(r.id, {
                                    onSuccess: () => showToast(t('drive-bm-remove')),
                                  })
                                : togglePostBookmark(r.id, {
                                    onSuccess: () => showToast(t('drive-bm-remove')),
                                  })
                            }
                            className="inline-flex size-[22px] flex-none items-center justify-center rounded-md text-warning hover:bg-gray-200"
                          >
                            <BookmarkIcon className="size-3.5 flex-none" filled />
                          </button>
                        )}
                        {r.isFile && (
                          <span
                            className={`inline-flex h-5 w-10 flex-none items-center justify-center rounded text-2xs font-bold text-on-pastel ${r.tagBg}`}
                          >
                            {r.ext}
                          </span>
                        )}
                        {r.isNotice && <NoticeBadge />}
                        {r.kind === 'post' && !isTrash ? (
                          <button
                            type="button"
                            onClick={() => openRow(r)}
                            className="truncate text-left text-sm text-gray-900 hover:underline"
                          >
                            {r.title}
                          </button>
                        ) : (
                          <span className="truncate text-sm text-gray-900">{r.title}</span>
                        )}
                        {r.hasFile && <PaperclipIcon />}
                        {!!r.cmt && r.cmt > 0 && <CommentCount n={r.cmt} />}
                      </span>
                      {/* 위치 */}
                      <span className="truncate pr-2.5 text-s text-gray-500">{r.where}</span>
                      {/* 휴지통: 삭제자 · 등록일 */}
                      {cfg.trash && (
                        <>
                          <span className="truncate pr-2 text-s text-gray-600">{r.by}</span>
                          <span className="text-s whitespace-nowrap text-gray-500">
                            {r.created}
                          </span>
                        </>
                      )}
                      {/* 날짜 — 정본은 둘째 줄(dueLabel)을 허용한다. 보관 기간은 «자료»에만 붙인다:
                        게시글엔 30일 purge worker 자체가 없다(06-post-write.md:43) */}
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-s whitespace-nowrap text-gray-500">{r.when}</span>
                        {isTrash && isFileTab && (
                          <span className="text-2xs whitespace-nowrap text-gray-400">
                            {t('my-trash-keep', { n: TRASH_KEEP_DAYS })}
                          </span>
                        )}
                      </span>
                      {/* 조회 · 공감 */}
                      {cfg.stats && (
                        <>
                          <span className="text-center text-s text-gray-500">{r.views}</span>
                          <span className="text-center text-s text-gray-500">{r.likes}</span>
                        </>
                      )}
                      {/* 액션 (이어쓰기) */}
                      {cfg.action && (
                        <span className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => navigate({ to: '/write' })}
                            className="inline-flex h-[29px] flex-none items-center rounded-md border border-gray-200 bg-card px-[11px] text-xs font-semibold whitespace-nowrap text-gray-700 hover:bg-gray-100"
                          >
                            {t('my-action-continue')}
                          </button>
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 일괄 액션 — 정본은 표 «아래»에 두고 «항상» 렌더한다(비활성 상태로). 선택 개수만 조건부다.
              선택했을 때만 나타나면 무엇을 할 수 있는지 미리 알 수 없다(개선안 통합 앱.dc.html:1143). */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 모바일은 컬럼 헤더가 없으므로 전체선택이 이 바에 들어온다(모바일 정본 :1052) */}
            {isMobile && (
              <span className="flex flex-none items-center gap-[7px]">
                <Checkbox
                  checked={allChecked}
                  mixed={allMixed}
                  onClick={() => setSelIds(allChecked ? [] : rows.map((r) => r.id))}
                  label={t('my-select-all')}
                />
                <span className="text-s text-gray-600">{t('my-select-all')}</span>
              </span>
            )}
            {isTrash ? (
              <>
                <BulkBtn onClick={doRestore} disabled={selCount === 0 || busy}>
                  {t('my-restore')}
                </BulkBtn>
                <BulkBtn
                  onClick={() => setPurgeOpen(true)}
                  disabled={selCount === 0 || busy}
                  danger
                >
                  {t('my-purge')}
                </BulkBtn>
              </>
            ) : (
              <BulkBtn onClick={doTrash} disabled={selCount === 0 || busy} danger>
                {t('common-delete')}
              </BulkBtn>
            )}
            {selCount > 0 && (
              <span className="text-xs text-gray-500">
                <b className="text-primary">{selCount}</b>
                {t('drive-selected-suffix')}
              </span>
            )}
          </div>

          {/* 모바일 무한 스크롤 센티널 — 바닥 100px 전에 다음 묶음을 불러온다 */}
          {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />}

          {!isMobile && totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPick={(n) => setSearch({ page: n > 1 ? n : undefined })}
            />
          )}
        </>
      )}

      {purgeOpen && (
        <ConfirmModal
          title={t('my-purge-confirm', { n: selCount })}
          sub={t('my-purge-sub')}
          confirmLabel={t('my-purge')}
          icon={<TrashIcon size={20} />}
          busy={busy}
          onCancel={() => setPurgeOpen(false)}
          onConfirm={doPurge}
        />
      )}

      <Toast toast={toast} onClose={hideToast} />
    </div>
  )
}

function Stat({ n, label, onClick }: { n: number; label: string; onClick: () => void }) {
  // 정본은 통계 타일이 해당 칩으로 이동하는 버튼이다(myGoMine · myGoImportant).
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-extrabold text-primary">{n}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </button>
  )
}

/** 빈 상태 · 로딩 · 오류가 같은 면을 쓴다 — 배경(bg-card)을 반드시 깐다. */
function Notice({ text, icon }: { text: string; icon?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-gray-200 bg-card px-5 py-16">
      {icon && (
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <TrashIcon size={20} />
        </span>
      )}
      <span className="text-sm text-gray-500">{text}</span>
    </div>
  )
}

function BulkBtn({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  // 비활성은 «보이되 못 누르는» 상태다 — 색만 흐려지는 게 아니라 커서까지 바뀐다(정본 b.cur).
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex h-[34px] items-center rounded-md border border-gray-200 bg-card px-3.5 text-s font-semibold whitespace-nowrap',
        disabled
          ? 'cursor-not-allowed text-gray-300'
          : danger
            ? 'text-destructive hover:bg-destructive-bg'
            : 'text-gray-700 hover:bg-gray-100',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function CommentCount({ n }: { n: number }) {
  return (
    <span className="inline-flex flex-none items-center gap-0.5 text-xs font-semibold text-primary">
      <svg
        className="size-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M20.5 12.5c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20.5l1.5-3.6A6.6 6.6 0 0 1 3.5 12.5c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z" />
      </svg>
      {n}
    </span>
  )
}
