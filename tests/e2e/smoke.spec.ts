import { expect, test } from '@playwright/test'

// 앱이 부팅되고 라우터 레이아웃(헤더 h1 = 앱 이름)이 렌더링되는지 확인.
// 감지 언어에 따라 텍스트가 달라지므로 텍스트가 아닌 존재/가시성만 검증.
test('홈(게시판 목록)이 로드되고 헤더가 보인다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
