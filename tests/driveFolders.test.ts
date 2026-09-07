import type { DriveFolder } from '@/types/drive'
import { collectFolderParentIds } from '@/utils/driveFolders'
import { describe, expect, it } from 'vitest'

const f = (id: string, children?: DriveFolder[]): DriveFolder => ({
  id,
  parent_drive_folder_id: null,
  title: id,
  child_drive_folders: children,
})

describe('collectFolderParentIds — 고아 폴더 방지 가드', () => {
  it('자식이 있는 폴더만 모은다', () => {
    const tree = [f('a', [f('a1'), f('a2')]), f('b')]
    expect([...collectFolderParentIds(tree)]).toEqual(['a'])
  })

  it('깊이 제한 없이 재귀한다', () => {
    const tree = [f('a', [f('a1', [f('a1x', [f('a1x1')])])])]
    expect(collectFolderParentIds(tree)).toEqual(new Set(['a', 'a1', 'a1x']))
  })

  it('빈 배열 자식은 «자식 없음»으로 본다', () => {
    expect([...collectFolderParentIds([f('a', [])])]).toEqual([])
  })

  it('child_drive_folders 가 아예 없어도(레벨별 필드 불균일) 터지지 않는다', () => {
    expect([...collectFolderParentIds([f('a')])]).toEqual([])
  })

  it('트리가 undefined 면 빈 집합', () => {
    expect(collectFolderParentIds(undefined).size).toBe(0)
  })
})
