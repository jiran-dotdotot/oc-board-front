import { expect, test } from '@playwright/test'

// 앱이 부팅되는지 확인. 세션이 없으면 루트 가드가 /login 으로 보내므로(routes/__root.tsx)
// «셸이 뜬다»가 아니라 «로그인 폼이 뜬다»가 미인증 부팅의 정상 상태다.
// 셸(헤더 로고)은 로그인 픽스처가 있는 go-main.spec.ts 가 본다.
test('미인증 부팅 — /login 으로 보내고 로그인 폼이 보인다', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.locator('#login-email')).toBeVisible()
})
