import App from '@/App'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('App', () => {
  it('기본 언어(ko)로 앱 이름을 렌더링한다', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('OC 게시판')
  })
})
