import { mapLimit, s3FileUrl, uniqueFileNames } from '@/utils/driveDownload'
import { describe, expect, it } from 'vitest'

describe('uniqueFileNames — zip 안 이름 충돌', () => {
  it('같은 이름은 확장자 앞에 번호를 붙인다', () => {
    expect(uniqueFileNames(['a.pdf', 'a.pdf', 'a.pdf'])).toEqual([
      'a.pdf',
      'a (1).pdf',
      'a (2).pdf',
    ])
  })

  it('확장자가 없으면 뒤에 붙인다', () => {
    expect(uniqueFileNames(['README', 'README'])).toEqual(['README', 'README (1)'])
  })

  it('점으로 시작하는 이름을 확장자로 오해하지 않는다', () => {
    expect(uniqueFileNames(['.env', '.env'])).toEqual(['.env', '.env (1)'])
  })

  it('서로 다른 이름은 그대로 둔다', () => {
    expect(uniqueFileNames(['a.pdf', 'b.pdf'])).toEqual(['a.pdf', 'b.pdf'])
  })

  it('이미 「(1)」 형태인 이름이 목록에 있으면 그것과도 안 부딪힌다', () => {
    // 회귀: 만들어 낸 이름을 taken 에 안 넣으면 a (1).pdf 가 둘 나와 zip 항목이 덮어써졌다
    expect(uniqueFileNames(['a.pdf', 'a.pdf', 'a (1).pdf'])).toEqual([
      'a.pdf',
      'a (1).pdf',
      'a (2).pdf',
    ])
  })

  it('결과에 중복이 하나도 남지 않는다', () => {
    const out = uniqueFileNames(['a.pdf', 'a (1).pdf', 'a.pdf', 'a.pdf', 'a (2).pdf'])
    expect(new Set(out).size).toBe(out.length)
  })
})

describe('s3FileUrl', () => {
  it('베이스 끝 슬래시와 키 앞 슬래시가 겹쳐도 하나만 남는다', () => {
    expect(s3FileUrl('https://cdn.test/', '/drive/1/2.pdf')).toBe('https://cdn.test/drive/1/2.pdf')
    expect(s3FileUrl('https://cdn.test', 'drive/1/2.pdf')).toBe('https://cdn.test/drive/1/2.pdf')
  })
})

describe('mapLimit — 동시 실행 제한', () => {
  it('결과는 입력 순서를 지킨다', async () => {
    const out = await mapLimit([3, 1, 2], 2, async (n) => {
      await new Promise((r) => setTimeout(r, n))
      return n * 10
    })
    expect(out).toEqual([30, 10, 20])
  })

  it('동시 실행 수가 한도를 넘지 않는다', async () => {
    let running = 0
    let peak = 0
    await mapLimit(
      Array.from({ length: 10 }, (_, i) => i),
      3,
      async () => {
        running += 1
        peak = Math.max(peak, running)
        await new Promise((r) => setTimeout(r, 1))
        running -= 1
        return null
      },
    )
    expect(peak).toBeLessThanOrEqual(3)
  })

  it('하나가 실패하면 전체가 실패한다(레거시 all-or-nothing)', async () => {
    await expect(
      mapLimit([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom')
        return n
      }),
    ).rejects.toThrow('boom')
  })
})
