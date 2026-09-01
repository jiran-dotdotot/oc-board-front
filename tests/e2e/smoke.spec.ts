import { expect, test } from '@playwright/test'

// 앱이 부팅되고 공통 셸(톱바)이 렌더되는지 확인.
// 감지 언어에 따라 문구가 달라지므로, 언어 무관한 브랜드 로고(OfficeNEXT)의 가시성만 검증.
// ⚠ 헤더는 모바일/데스크톱 두 벌이 «둘 다» DOM 에 있고 CSS 로 한쪽만 보인다(min-[631px]).
//    모바일 헤더가 DOM 상 먼저라 .first() 는 데스크톱 뷰포트에서 «숨겨진» 쪽을 집는다
//    → visible 필터로 실제 보이는 로고만 고른다.
test('앱 셸이 로드되고 헤더 로고가 보인다', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('link', { name: 'OfficeNEXT' }).filter({ visible: true }),
  ).toBeVisible()
})
