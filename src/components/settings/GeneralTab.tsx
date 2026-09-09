import { useState } from 'react'

import { useTranslation } from 'react-i18next'

import { Switch } from '@/components/common/Switch'
import { BoardIcon, DriveIcon } from '@/components/common/icons'
import { useMemberCategories } from '@/hooks/useCategories'
import { useMe } from '@/hooks/useMe'
import { useBoardAlarmMutation } from '@/hooks/useSettings'
import { MEMBER_SETTINGS_UNSUPPORTED } from '@/services/settingService'
import { type CategoryBoard, isDriveBoard } from '@/types/category'
import type { UserSettingPayload } from '@/types/setting'
import { flattenCategories } from '@/utils/category'

type UserFlag = keyof UserSettingPayload
type BoardFlag = 'is_post_alarm' | 'is_notice_alarm'

// 환경 설정 › 일반. 개인 알림 4종(POST /management/user-setting/{companySetting})과
// 게시판별 알림(POST /board/member/{board}) — 둘 다 토글 즉시 저장.
export function GeneralTab({ onToast }: { onToast: (msg: string) => void }) {
  const { t } = useTranslation()
  const { data: me } = useMe()
  const { data: tree, isError } = useMemberCategories()

  const us = me?.company_user_setting
  const boardMut = useBoardAlarmMutation()

  const [boardDraft, setBoardDraft] = useState<Record<string, boolean>>({})

  // 개인 설정 기본값은 true (서버 기본값과 동일). 저장 경로가 없어 «읽기 전용»이다.
  const userOn = (k: UserFlag) => us?.[k] !== false
  // 저장은 member 토큰 전용 경로라 이 앱에서 불가능하다 — 스위치는 비활성 + 사유 문구다.
  const noop = () => {}

  // 게시판별 값도 서버가 COALESCE(..., true) 로 내려준다 → falsy만 off
  const boardKey = (id: string, f: BoardFlag) => `${id}:${f}`
  const boardOn = (b: CategoryBoard, f: BoardFlag) => {
    const draft = boardDraft[boardKey(b.id, f)]
    if (draft !== undefined) return draft
    return !!(f === 'is_post_alarm' ? b.is_board_member_post_alarm : b.is_board_member_notice_alarm)
  }
  const setBoard = (b: CategoryBoard, f: BoardFlag, next: boolean) => {
    const key = boardKey(b.id, f)
    setBoardDraft((d) => ({ ...d, [key]: next }))
    boardMut.mutate(
      { boardId: b.id, payload: { [f]: next } },
      {
        onError: () => {
          setBoardDraft((d) => ({ ...d, [key]: !next }))
          onToast(t('env-error'))
        },
      },
    )
  }

  // 정본은 중지된 게시판을 알림 표에서 뺀다(`active!==false`). 공용에만 걸려 있던 필터를
  // 카테고리 소속 게시판에도 똑같이 적용한다.
  const sections = flattenCategories(tree?.categories).map((s) => ({
    ...s,
    boards: s.boards.filter((b) => b.is_active !== false),
  }))
  const publicBoards = (tree?.public_boards ?? []).filter((b) => b.is_active !== false)

  return (
    <div className="flex max-w-[860px] flex-col">
      <span className="px-0 pt-1.5 pb-0.5 text-base font-bold">{t('env-gen-title')}</span>

      <SwitchRow
        title={t('env-gen-comment')}
        desc={t('env-gen-comment-desc')}
        on={userOn('is_comment_alarm')}
        onClick={noop}
        divider
        disabled={MEMBER_SETTINGS_UNSUPPORTED}
        unsupportedDesc={t('env-member-token-only')}
      />
      <SwitchRow
        title={t('env-gen-like')}
        desc={t('env-gen-like-desc')}
        on={userOn('is_like_alarm')}
        onClick={noop}
        disabled={MEMBER_SETTINGS_UNSUPPORTED}
        unsupportedDesc={t('env-member-token-only')}
      />

      <div className="flex flex-wrap items-start gap-3 pt-[18px]">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className="text-base font-bold">{t('env-gen-board-title')}</span>
          <span className="text-xs leading-relaxed text-gray-400">{t('env-gen-board-desc')}</span>
        </div>
        {/* 정본은 웹에서 우측 정렬, 모바일에서 아래로 내려온다(mob:1123). */}
        <div className="flex flex-none flex-col items-end gap-1 pt-[3px] max-[630px]:w-full max-[630px]:items-start min-[631px]:ml-auto">
          <div className="flex items-center gap-4">
            <InlineSwitch
              label={t('env-gen-allow-notice')}
              on={userOn('is_notice_alarm')}
              onClick={noop}
              disabled={MEMBER_SETTINGS_UNSUPPORTED}
            />
            <InlineSwitch
              label={t('env-gen-allow-alarm')}
              on={userOn('is_post_alarm')}
              onClick={noop}
              disabled={MEMBER_SETTINGS_UNSUPPORTED}
            />
          </div>
          {/* 비활성 이유를 색·opacity 밖으로 — 이 두 스위치에는 사유 문구가 없었다. */}
          {MEMBER_SETTINGS_UNSUPPORTED && (
            <span className="text-2xs text-gray-400">{t('env-member-token-only')}</span>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="grid h-10 grid-cols-[minmax(0,1fr)_56px_56px] items-center border-b border-gray-200 text-xs text-gray-500 max-[630px]:grid-cols-[minmax(0,1fr)_48px_48px]">
          <span>{t('env-gen-col-board')}</span>
          <span className="text-center">{t('env-gen-col-notice')}</span>
          <span className="text-center">{t('env-gen-col-alarm')}</span>
        </div>

        {isError && <div className="py-6 text-s text-gray-500">{t('env-error')}</div>}

        {!isError && !sections.some((s) => s.boards.length > 0) && publicBoards.length === 0 && (
          <div className="py-6 text-s text-gray-500">{t('env-gen-empty')}</div>
        )}

        {publicBoards.length > 0 && (
          <Group name={t('nav-public')}>
            {publicBoards.map((b) => (
              <BoardRow key={b.id} board={b} on={boardOn} onToggle={setBoard} />
            ))}
          </Group>
        )}
        {sections
          .filter((s) => s.boards.length > 0)
          .map((s) => (
            <Group key={s.id} name={s.name}>
              {s.boards.map((b) => (
                <BoardRow key={b.id} board={b} on={boardOn} onToggle={setBoard} />
              ))}
            </Group>
          ))}
      </div>
    </div>
  )
}

function Group({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <>
      <div className="flex h-[38px] items-center border-b border-gray-100 text-s font-semibold text-gray-500">
        {name}
      </div>
      {children}
    </>
  )
}

function BoardRow({
  board,
  on,
  onToggle,
}: {
  board: CategoryBoard
  on: (b: CategoryBoard, f: BoardFlag) => boolean
  onToggle: (b: CategoryBoard, f: BoardFlag, next: boolean) => void
}) {
  const drive = isDriveBoard(board)
  return (
    <div className="grid h-11 grid-cols-[minmax(0,1fr)_56px_56px] items-center border-b border-gray-100 max-[630px]:h-[46px] max-[630px]:grid-cols-[minmax(0,1fr)_48px_48px]">
      <span className="flex min-w-0 items-center gap-2.5 pl-1.5">
        {drive ? (
          <DriveIcon className="size-3.5 flex-none text-gray-400" />
        ) : (
          <BoardIcon className="size-3.5 flex-none text-gray-400" />
        )}
        <span className="truncate text-sm text-gray-800">{board.title}</span>
      </span>
      {/* 자료실은 공지 개념이 없어 체크박스를 두지 않는다 (디자인 동일) */}
      <span className="flex justify-center">
        {!drive && (
          <Check
            on={on(board, 'is_notice_alarm')}
            onClick={() => onToggle(board, 'is_notice_alarm', !on(board, 'is_notice_alarm'))}
          />
        )}
      </span>
      <span className="flex justify-center">
        <Check
          on={on(board, 'is_post_alarm')}
          onClick={() => onToggle(board, 'is_post_alarm', !on(board, 'is_post_alarm'))}
        />
      </span>
    </div>
  )
}

function SwitchRow({
  title,
  desc,
  on,
  onClick,
  divider,
  disabled,
  unsupportedDesc,
}: {
  title: string
  desc: string
  on: boolean
  onClick: () => void
  divider?: boolean
  disabled?: boolean
  unsupportedDesc?: string
}) {
  return (
    <div
      className={['flex items-center gap-3 py-3.5', divider ? 'border-b border-gray-100' : ''].join(
        ' ',
      )}
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        {/* 사유 문구가 설명을 «대체»하면 그 스위치가 무엇을 켜고 끄는지 읽을 수 없다 —
            정본은 설명을 상시 노출한다. 사유는 아래 줄에 덧붙인다. */}
        <span className="text-xs text-gray-400">{desc}</span>
        {disabled && unsupportedDesc && (
          <span className="text-xs text-gray-500">{unsupportedDesc}</span>
        )}
      </span>
      <span className="ml-auto flex-none">
        <Switch on={on} onClick={onClick} label={title} disabled={disabled} />
      </span>
    </div>
  )
}

function InlineSwitch({
  label,
  on,
  onClick,
  disabled,
}: {
  label: string
  on: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-[7px]">
      <span className="text-s text-gray-600">{label}</span>
      <Switch on={on} onClick={onClick} label={label} disabled={disabled} />
    </span>
  )
}

function Check({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={[
        'inline-flex size-[18px] items-center justify-center rounded border-[1.5px] text-white',
        on
          ? 'border-primary bg-primary'
          : 'border-gray-300 bg-card hover:border-gray-400 hover:bg-gray-50',
      ].join(' ')}
    >
      {on && (
        <svg
          className="size-3"
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
      )}
    </button>
  )
}
