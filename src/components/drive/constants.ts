// 마지막으로 본 자료실. 사이드바·모바일 하단탭은 `?b=` 없이 /drive 로 오므로,
// 어느 자료실을 열지 정해 줘야 한다(폴더·용량·권한 API 가 board uuid 를 요구한다).
export const LAST_DRIVE_KEY = 'lastDriveBoard'

export function readLastDrive(): string | undefined {
  try {
    return localStorage.getItem(LAST_DRIVE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function writeLastDrive(boardId: string): void {
  try {
    localStorage.setItem(LAST_DRIVE_KEY, boardId)
  } catch {
    /* 사파리 프라이빗 등 — 기억 못 해도 화면은 동작한다 */
  }
}

// 폴더명 길이 상한. 서버는 `title` required 검증만 하고 길이 제한이 없다 — 프론트 규칙(레거시와 동일).
export const FOLDER_NAME_MAX = 30
