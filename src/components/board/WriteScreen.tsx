import { useEffect, useRef, useState } from 'react'

import { useNavigate } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import {
  BOARD_OPTIONS,
  DRAFT_COUNT,
  ORG_KIDS,
  ORG_ROOT,
  TITLE_MAX,
  WRITE_ATTACHMENTS,
} from './writeData'

export function WriteScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [board, setBoard] = useState<number | null>(null)
  const [boardOpen, setBoardOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [errBoard, setErrBoard] = useState(false)
  const [errTitle, setErrTitle] = useState(false)
  const [scope, setScope] = useState<'all' | 'org'>('all')
  const [orgChecks, setOrgChecks] = useState([true, true, false, false])
  const [orgOpen, setOrgOpen] = useState(false)
  const [noticeOn, setNoticeOn] = useState(true)
  const [ntMode, setNtMode] = useState<'always' | 'period'>('period')
  const [schOn, setSchOn] = useState(false)
  const [cmtAllow, setCmtAllow] = useState(true)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boardRef.current && !boardRef.current.contains(e.target as Node)) setBoardOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOrgOpen(false)
        setLeaveOpen(false)
        setBoardOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  const titleLen = Array.from(title).length
  const orgCount = orgChecks.filter(Boolean).length

  const submit = () => {
    const eb = board === null
    const et = !title.trim()
    setErrBoard(eb)
    setErrTitle(et)
    if (eb || et) return
    setSaving(true)
    window.setTimeout(() => {
      setSaving(false)
      setToast(true)
      window.setTimeout(() => setToast(false), 3000)
    }, 1100)
  }

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4">
      <span className="text-xl font-extrabold tracking-[-0.01em]">{t('write-page-title')}</span>

      {/* 본문 폼 */}
      <div className="flex flex-col gap-[18px] rounded-lg border border-gray-200 bg-card px-[26px] py-6">
        {/* 게시판 */}
        <label className="flex flex-col gap-[7px]">
          <FieldLabel required>{t('nav-board')}</FieldLabel>
          <div ref={boardRef} className="relative block max-w-[320px]">
            <button
              type="button"
              onClick={() => setBoardOpen((v) => !v)}
              className={`flex h-[42px] w-full items-center gap-2 rounded-[5px] border bg-card px-3 ${errBoard ? 'border-destructive' : board !== null || boardOpen ? 'border-primary' : 'border-gray-300'}`}
            >
              <span
                className={`flex-1 truncate text-left text-sm ${board === null ? 'text-gray-400' : 'text-gray-900'}`}
              >
                {board === null ? t('write-board-ph') : BOARD_OPTIONS[board]}
              </span>
              <ChevronDown open={boardOpen} />
            </button>
            {boardOpen && (
              <div className="absolute inset-x-0 top-[calc(100%+4px)] z-30 rounded-lg border border-gray-200 bg-card p-1 shadow-[0_4px_8px_rgba(0,0,0,0.1)]">
                {BOARD_OPTIONS.map((o, i) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => {
                      setBoard(i)
                      setBoardOpen(false)
                      setErrBoard(false)
                    }}
                    className={`flex h-9 w-full items-center rounded-md px-2.5 text-left text-[13.5px] hover:bg-gray-100 ${board === i ? 'font-semibold text-primary' : 'text-gray-800'}`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}
          </div>
          {errBoard && <FieldError>{t('write-board-required')}</FieldError>}
        </label>

        {/* 제목 */}
        <label className="flex flex-col gap-[7px]">
          <FieldLabel required>{t('write-title-label')}</FieldLabel>
          <div className="relative block">
            <input
              value={title}
              onChange={(e) => {
                setTitle(Array.from(e.target.value).slice(0, TITLE_MAX).join(''))
                setErrTitle(false)
              }}
              placeholder={t('write-title-ph')}
              className={`h-[42px] w-full rounded-[5px] border bg-card pr-[74px] pl-3 text-sm outline-none focus:border-primary ${errTitle ? 'border-destructive' : title ? 'border-primary' : 'border-gray-300'}`}
            />
            <span
              className={`absolute top-[13px] right-3 text-xs ${titleLen >= TITLE_MAX ? 'text-destructive' : titleLen >= 194 ? 'text-warning' : 'text-gray-400'}`}
            >
              {titleLen}/{TITLE_MAX}
            </span>
          </div>
          {errTitle && <FieldError>{t('write-title-required')}</FieldError>}
        </label>

        {/* 본문 에디터 */}
        <div className="flex flex-col">
          <div className="flex flex-wrap gap-0.5 rounded-t-[5px] border border-gray-200 bg-gray-50 px-2 py-1.5">
            <ToolBtn className="text-[13.5px] font-extrabold">B</ToolBtn>
            <ToolBtn className="text-[13.5px] font-semibold italic">I</ToolBtn>
            <ToolBtn className="text-[13.5px] underline">U</ToolBtn>
            <span className="mx-1 my-[5px] h-5 w-px bg-gray-200" />
            <ToolBtn>
              <LinkIcon />
            </ToolBtn>
            <ToolBtn>
              <ImageIcon />
            </ToolBtn>
            <ToolBtn>
              <ListIcon />
            </ToolBtn>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('write-body-ph')}
            className="min-h-[180px] w-full resize-y rounded-b-[5px] border border-t-0 border-gray-200 bg-card p-3.5 text-sm leading-[1.7] outline-none focus:border-primary"
          />
        </div>

        {/* 첨부 */}
        <div className="flex flex-col gap-2">
          <FieldLabel>{t('write-attach')}</FieldLabel>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-gray-300 p-[18px] text-[13px] text-gray-400 hover:border-primary hover:text-primary"
          >
            <UploadIcon />
            {t('write-dropzone')}
          </button>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            {WRITE_ATTACHMENTS.map((f, i) => (
              <div
                key={f.name}
                className={`flex items-center gap-2.5 px-3 ${f.progress == null ? 'h-[42px]' : 'h-[46px]'} ${i < WRITE_ATTACHMENTS.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span
                  className={`inline-flex h-5 w-10 flex-none items-center justify-center rounded text-[10px] font-bold text-on-pastel ${f.bg}`}
                >
                  {f.ext}
                </span>
                {f.progress == null ? (
                  <>
                    <span className="flex-1 truncate text-[13px] text-gray-800">{f.name}</span>
                    <span className="flex-none text-[11.5px] text-gray-400">{f.size}</span>
                  </>
                ) : (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                      <span className="truncate text-[13px] text-gray-800">{f.name}</span>
                      <span className="block h-1 overflow-hidden rounded-full bg-gray-100">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${f.progress}%` }}
                        />
                      </span>
                    </span>
                    <span className="flex-none text-xs font-semibold text-primary">
                      {f.progress}%
                    </span>
                  </>
                )}
                <button
                  type="button"
                  aria-label="remove"
                  className="inline-flex size-7 flex-none items-center justify-center rounded-[5px] text-gray-400 hover:bg-gray-100"
                >
                  <XIcon />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 발행 옵션 */}
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-card px-[26px] py-5">
        <span className="text-sm font-bold">{t('write-options')}</span>

        {/* 공개 범위 */}
        <OptionRow label={t('write-scope')} alignTop>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-5">
              <Radio
                on={scope === 'all'}
                onClick={() => setScope('all')}
                label={t('write-scope-all')}
              />
              <Radio
                on={scope === 'org'}
                onClick={() => setScope('org')}
                label={t('write-scope-org')}
              />
            </div>
            {scope === 'org' && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOrgOpen(true)}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-[5px] border border-gray-200 bg-card px-[13px] text-[13px] font-semibold text-gray-700 hover:bg-gray-100"
                >
                  <OrgIcon />
                  {t('write-pick-org')}
                </button>
                {orgCount > 0 &&
                  ORG_KIDS.filter((_, i) => orgChecks[i]).map((k) => (
                    <span
                      key={k.label}
                      className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-accent px-2.5 text-xs font-semibold text-primary"
                    >
                      {k.label}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </OptionRow>
        <Divider />

        {/* 공지 설정 */}
        <OptionRow label={t('write-notice')} alignTop>
          <div className="flex flex-col gap-2.5">
            <Toggle
              on={noticeOn}
              onClick={() => setNoticeOn((v) => !v)}
              label={t('write-notice-on')}
            />
            {noticeOn && (
              <div className="flex flex-wrap gap-5">
                <Radio
                  on={ntMode === 'always'}
                  onClick={() => setNtMode('always')}
                  label={t('write-notice-always')}
                />
                <Radio
                  on={ntMode === 'period'}
                  onClick={() => setNtMode('period')}
                  label={t('write-notice-period')}
                />
              </div>
            )}
            {noticeOn && ntMode === 'period' && (
              <div className="flex flex-wrap items-center gap-2">
                <DateChip>2026.08.11</DateChip>
                <span className="text-gray-400">~</span>
                <DateChip>2026.08.25</DateChip>
              </div>
            )}
          </div>
        </OptionRow>
        <Divider />

        {/* 예약 발행 */}
        <OptionRow label={t('write-schedule')} alignTop>
          <div className="flex flex-col gap-2.5">
            <Toggle on={schOn} onClick={() => setSchOn((v) => !v)} label={t('write-schedule-on')} />
            {schOn && <DateChip>2026.08.20 09:00</DateChip>}
          </div>
        </OptionRow>
        <Divider />

        {/* 댓글 */}
        <OptionRow label={t('write-comment')}>
          <Checkbox
            on={cmtAllow}
            onClick={() => setCmtAllow((v) => !v)}
            label={t('write-comment-allow')}
          />
        </OptionRow>
      </div>

      {/* 액션 바 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-10 items-center gap-1.5 rounded-[5px] border border-gray-200 bg-card px-4 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-100"
        >
          {t('write-draft-save')}
          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gray-100 px-1.5 text-[11px] font-bold text-gray-500">
            {DRAFT_COUNT}
          </span>
        </button>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setLeaveOpen(true)}
            className="inline-flex h-10 items-center rounded-[5px] border border-gray-200 bg-card px-[18px] text-sm font-semibold text-gray-800 hover:bg-gray-100"
          >
            {t('common-cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            className="inline-flex h-10 items-center rounded-[5px] bg-primary px-[22px] text-sm font-semibold text-white hover:bg-ov-blue-700"
          >
            {t('write-submit')}
          </button>
        </div>
      </div>

      {/* 조직도 모달 */}
      {orgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex max-h-[80vh] w-[420px] max-w-[92%] flex-col overflow-hidden rounded-lg bg-card shadow-[0_4px_18px_rgba(75,70,92,0.1)]">
            <div className="flex h-[54px] flex-none items-center border-b border-gray-100 px-5">
              <span className="text-[15px] font-bold">{t('write-org-modal-title')}</span>
              <button
                type="button"
                aria-label={t('common-cancel')}
                onClick={() => setOrgOpen(false)}
                className="ml-auto inline-flex size-[30px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <XIcon />
              </button>
            </div>
            <div className="flex flex-col gap-px overflow-y-auto p-4">
              <div className="flex h-9 items-center gap-1.5 rounded-lg px-2.5">
                <ChevronDown open className="text-gray-400" />
                <button
                  type="button"
                  onClick={() => setOrgChecks(orgChecks.map(() => orgCount < orgChecks.length))}
                  className={`inline-flex size-4 flex-none items-center justify-center rounded border-[1.5px] text-white ${orgCount > 0 ? 'border-primary bg-primary' : 'border-gray-300 bg-card'}`}
                >
                  {orgCount === orgChecks.length ? (
                    <CheckIcon />
                  ) : orgCount > 0 ? (
                    <DashIcon />
                  ) : null}
                </button>
                <span className="text-[13.5px] font-semibold text-gray-800">{ORG_ROOT}</span>
              </div>
              {ORG_KIDS.map((k, i) => (
                <button
                  key={k.label}
                  type="button"
                  onClick={() => {
                    const c = orgChecks.slice()
                    c[i] = !c[i]
                    setOrgChecks(c)
                  }}
                  className="flex h-9 items-center gap-1.5 rounded-lg pr-2.5 pl-10 hover:bg-gray-100"
                >
                  <span
                    className={`inline-flex size-4 flex-none items-center justify-center rounded border-[1.5px] text-white ${orgChecks[i] ? 'border-primary bg-primary' : 'border-gray-300 bg-card'}`}
                  >
                    {orgChecks[i] && <CheckIcon />}
                  </span>
                  <span className="text-[13.5px] text-gray-800">{k.label}</span>
                  <span className="text-xs text-gray-400">{k.count}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-none justify-end gap-2 border-t border-gray-100 px-4 pt-3 pb-4">
              <button
                type="button"
                onClick={() => setOrgOpen(false)}
                className="inline-flex h-[38px] items-center rounded-[5px] border border-gray-200 bg-card px-4 text-[13.5px] font-semibold text-gray-800 hover:bg-gray-100"
              >
                {t('common-cancel')}
              </button>
              <button
                type="button"
                onClick={() => setOrgOpen(false)}
                className="inline-flex h-[38px] items-center rounded-[5px] bg-primary px-[18px] text-[13.5px] font-semibold text-white hover:bg-ov-blue-700"
              >
                {t('write-apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 나가기 확인 */}
      {leaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex w-80 flex-col items-center gap-2 rounded-lg bg-card px-[22px] pt-[26px] pb-[18px] shadow-[0_4px_18px_rgba(75,70,92,0.1)]">
            <span className="text-center text-[14.5px] font-semibold text-gray-900">
              {t('write-leave-title')}
            </span>
            <span className="text-center text-[12.5px] text-gray-500">{t('write-leave-sub')}</span>
            <div className="mt-2.5 flex w-full gap-2">
              <button
                type="button"
                onClick={() => setLeaveOpen(false)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-[5px] border border-gray-200 bg-card text-sm font-semibold text-gray-800 hover:bg-gray-100"
              >
                {t('write-leave-keep')}
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: '/board/$boardId', params: { boardId: 'notice' } })}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-[5px] bg-destructive text-sm font-semibold text-white hover:opacity-90"
              >
                {t('write-leave-go')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 저장 로딩 */}
      {saving && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3.5 rounded-lg bg-card px-[34px] py-7 shadow-[0_4px_18px_rgba(75,70,92,0.1)]">
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
            <span className="text-[13.5px] whitespace-nowrap text-gray-600">
              {t('write-saving')}
            </span>
          </div>
        </div>
      )}

      {/* 성공 토스트 */}
      {toast && (
        <div className="fixed bottom-[18px] left-1/2 z-[56] flex h-[46px] max-w-[92%] -translate-x-1/2 animate-in items-center gap-2.5 rounded-lg bg-gray-900 px-4 text-gray-50 shadow-[0_4px_18px_rgba(75,70,92,0.1)] duration-200 fade-in-0 slide-in-from-bottom-2">
          <CheckIcon className="text-[color:var(--color-accent)]" />
          <span className="truncate text-[13px] font-medium">{t('write-saved-toast')}</span>
        </div>
      )}
    </div>
  )
}

/* ── 서브 컴포넌트 ── */
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-[13px] font-semibold text-gray-700">
      {children}
      {required && <span className="text-destructive"> *</span>}
    </span>
  )
}
function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex animate-in items-center gap-1.5 text-xs text-destructive duration-200 fade-in-0 slide-in-from-top-1">
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
    <div className={`flex flex-wrap gap-3.5 ${alignTop ? 'items-start' : 'items-center'}`}>
      <span
        className={`w-[88px] flex-none text-[13px] font-semibold text-gray-700 ${alignTop ? 'pt-1.5' : ''}`}
      >
        {label}
      </span>
      <div className="min-w-[240px] flex-1">{children}</div>
    </div>
  )
}
function Divider() {
  return <span className="h-px bg-gray-100" />
}
function Radio({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2 py-1.5">
      <span
        className={`box-border inline-block size-[18px] flex-none rounded-full bg-card ${on ? 'border-[5px] border-primary' : 'border-[1.5px] border-gray-300'}`}
      />
      <span className="text-[13.5px] text-gray-800">{label}</span>
    </button>
  )
}
function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex w-fit items-center gap-2.5">
      <span
        className={`relative h-6 w-[42px] flex-none rounded-full transition-colors ${on ? 'bg-primary' : 'bg-gray-200'}`}
      >
        <span
          className={`absolute top-[3px] size-[18px] rounded-full bg-white shadow-sm transition-all ${on ? 'left-[21px]' : 'left-[3px]'}`}
        />
      </span>
      <span className="text-[13.5px] text-gray-800">{label}</span>
    </button>
  )
}
function Checkbox({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2">
      <span
        className={`box-border inline-flex size-[18px] flex-none items-center justify-center rounded-[5px] border-[1.5px] text-white ${on ? 'border-primary bg-primary' : 'border-gray-300 bg-card'}`}
      >
        {on && <CheckIcon />}
      </span>
      <span className="text-[13.5px] text-gray-800">{label}</span>
    </button>
  )
}
function DateChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-[5px] border border-gray-200 bg-card px-3 text-[13px] text-gray-800">
      <CalendarIcon />
      {children}
    </span>
  )
}
function ToolBtn({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={`inline-flex size-[30px] items-center justify-center rounded-[5px] text-gray-600 hover:bg-gray-200 ${className ?? ''}`}
    >
      {children}
    </button>
  )
}

/* ── 아이콘 ── */
function ChevronDown({ open, className }: { open?: boolean; className?: string }) {
  return (
    <svg
      className={`size-[15px] flex-none text-gray-400 transition-transform ${open ? 'rotate-180' : ''} ${className ?? ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
function AlertIcon() {
  return (
    <svg
      className="size-[13px] flex-none"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path
        d="M12 6.5v7M12 16.4h.01"
        stroke="var(--color-white)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
function LinkIcon() {
  return (
    <svg
      className="size-[15px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.5 13.5a4 4 0 0 0 5.7 0l3.3-3.3a4 4 0 0 0-5.7-5.7l-1.6 1.6" />
      <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-3.3 3.3a4 4 0 0 0 5.7 5.7l1.6-1.6" />
    </svg>
  )
}
function ImageIcon() {
  return (
    <svg
      className="size-[15px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M3.5 16.5l5-4.5 4 3.5 3.5-3 4.5 4" />
    </svg>
  )
}
function ListIcon() {
  return (
    <svg
      className="size-[15px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h10M4 17h16" />
    </svg>
  )
}
function UploadIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V5M7.5 9.5L12 5l4.5 4.5" />
      <path d="M4.5 19.5h15" />
    </svg>
  )
}
function XIcon() {
  return (
    <svg
      className="size-[13px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
function OrgIcon() {
  return (
    <svg
      className="size-[14px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.9-2.8 3-4.2 5.5-4.2s4.6 1.4 5.5 4.2" />
      <path d="M15.5 5.4a3.2 3.2 0 0 1 0 5.2M17.8 14.9c1.4.7 2.4 2 2.9 3.9" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg
      className="size-[14px] flex-none text-gray-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" />
    </svg>
  )
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`size-[11px] ${className ?? ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  )
}
function DashIcon() {
  return (
    <svg
      className="size-[11px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 12h12" />
    </svg>
  )
}
