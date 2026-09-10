import { type CategoryBoard, type CategoryTree, isDriveBoard } from '@/types/category'

/**
 * 글쓰기 게시판 후보. `GET {S}/categories` 트리(docs/api/go/03-category.md:180-183)를 평면화한다.
 *
 * - 트리는 **Read 기준**으로 걸러져 온다 → 쓰기 가능 여부는 `is_writable` 로 다시 거른다(03:189, 04:102).
 * - 자료실(DRIVE)은 글이 아니라 파일을 담는다 → 제외(레거시 AddPostView.vue:648·700·748 과 같다).
 * - Go 트리는 2단까지다(03:69) — public → 카테고리 → 직속 자식 순으로 편다.
 *
 * ⚠️ 가정(A9): 정본 드롭다운은 평면 라벨이다(web.html:637-643). 동명 게시판을 구분하기 위해
 *   카테고리 소속은 「카테고리 › 게시판」으로 적는다. 공용(category_id=null)은 제목만.
 */
export interface WriteBoardOption {
  id: string
  label: string
  /** 공지 설정 게이트 — badges 를 보내려면 CanManage 여야 한다(06-post-write.md:228). */
  canManage: boolean
}

const writable = (b: CategoryBoard) => !!b.is_writable && !isDriveBoard(b)

const option = (b: CategoryBoard, prefix?: string): WriteBoardOption => ({
  id: b.id,
  label: prefix ? `${prefix} › ${b.title}` : b.title,
  canManage: !!b.can_manage,
})

export function writableBoards(tree: CategoryTree | undefined): WriteBoardOption[] {
  if (!tree) return []
  const out: WriteBoardOption[] = tree.public_boards.filter(writable).map((b) => option(b))
  for (const c of tree.categories) {
    for (const b of c.boards) if (writable(b)) out.push(option(b, c.name))
    for (const child of c.child_categories)
      for (const b of child.boards)
        if (writable(b)) out.push(option(b, `${c.name} › ${child.name}`))
  }
  return out
}
