import type { DriveFolder } from '@/types/drive'

/**
 * 하위 폴더를 가진 폴더의 id 집합. `GET /drive/{board}` 의 전체 트리(child_drive_folders)로 만든다.
 *
 * ⚠ 다건 폴더 삭제(`DELETE /drive/folder/board/{board}`)의 「하위 폴더 있으면 스킵」 판정은
 * «요청한 id 목록 안에» 자식이 있는지만 본다(docs/api/08-drive-folder.md:286).
 * 그래서 자식을 가진 부모를 «혼자» 보내면 서버가 그냥 지우고, 자식은 삭제된 부모를 가리켜
 * 현재 레벨 목록에도 트리에도 안 나온다 — 화면에서 영구 소실된다. 같은 문서가
 * 「프론트는 리프(말단)부터 삭제하거나 관리자 UI 흐름을 고려할 것」이라고 요구한다.
 *
 * ⚠ 트리는 레벨별로 필드가 불균일하다 — id / parent_drive_folder_id / title / child_drive_folders 만 신뢰한다.
 */
export function collectFolderParentIds(tree: DriveFolder[] | undefined): Set<string> {
  const parents = new Set<string>()
  const walk = (nodes: DriveFolder[]) => {
    for (const n of nodes) {
      const children = n.child_drive_folders
      if (children && children.length > 0) {
        parents.add(n.id)
        walk(children)
      }
    }
  }
  walk(tree ?? [])
  return parents
}
