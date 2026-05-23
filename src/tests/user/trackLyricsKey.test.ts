import { describe, expect, it } from 'vitest'
import { makeTrackLyricsKey } from '../../utils/trackLyricsKey'

describe('makeTrackLyricsKey (автор: пользователь — lyrics cache)', () => {
  it('формирует ключ из имени файла и размера', () => {
    expect(makeTrackLyricsKey('song.mp3', 123456)).toBe('song.mp3\u0000123456')
  })

  it('различает файлы с одинаковым именем, но разным размером', () => {
    const a = makeTrackLyricsKey('track.mp3', 100)
    const b = makeTrackLyricsKey('track.mp3', 200)

    expect(a).not.toBe(b)
  })
})
