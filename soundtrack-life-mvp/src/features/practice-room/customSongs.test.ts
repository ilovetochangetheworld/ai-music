import { describe, expect, it } from 'vitest'
import { parseLyrics } from './customSongs'

describe('custom song lyric conversion', () => {
  it('preserves LRC timestamps', () => {
    const result = parseLyrics('[00:10.50]第一句\n[00:14.20]第二句', 30)
    expect(result.mode).toBe('lrc')
    expect(result.lines[0]).toEqual({ start: 10.5, end: 14.12, text: '第一句' })
  })

  it('creates an explicitly distributed draft for plain lyrics', () => {
    const result = parseLyrics('第一句\n第二句', 24)
    expect(result.mode).toBe('distributed')
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0].start).toBe(2)
  })
})
