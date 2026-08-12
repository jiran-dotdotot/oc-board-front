import App from '@/App'
import i18n from '@/lib/i18n'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

describe('App', () => {
  // Language detection may resolve to the environment's browser language, so
  // pin ko for a deterministic assertion.
  beforeEach(async () => {
    await i18n.changeLanguage('ko')
  })

  it('선택 언어(ko)로 앱 이름을 렌더링한다', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('OC 게시판')
  })
})
