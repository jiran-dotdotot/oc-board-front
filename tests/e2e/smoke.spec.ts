import { expect, test } from '@playwright/test'

// 앱이 부팅되고 공통 셸(톱바)이 렌더되는지 확인.
// 감지 언어에 따라 문구가 달라지므로, 언어 무관한 브랜드 로고(OfficeNEXT)의 가시성만 검증.
test('앱 셸이 로드되고 헤더 로고가 보인다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'OfficeNEXT' }).first()).toBeVisible()
})
