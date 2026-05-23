import { describe, expect, it } from 'vitest'
import {
  buildLrclibSearchQueries,
  parseArtistTitleFromFilename,
} from '../../utils/filenameMeta'

describe('parseArtistTitleFromFilename (автор: пользователь — metadata)', () => {
  it('разбирает имя файла вида Artist - Title.mp3', () => {
    expect(parseArtistTitleFromFilename('Radiohead - Creep.mp3')).toEqual({
      artist: 'Radiohead',
      title: 'Creep',
    })
  })

  it('чистит спам и подчёркивания в имени файла', () => {
    expect(parseArtistTitleFromFilename('Artist_Name - Cool_Track (www.spam.cc).mp3')).toEqual({
      artist: 'Artist Name',
      title: 'Cool Track',
    })
  })
})

describe('buildLrclibSearchQueries (автор: пользователь — lyrics search)', () => {
  it('строит поисковые запросы из тегов и имени файла', () => {
    const queries = buildLrclibSearchQueries({
      tagArtist: 'Daft Punk',
      tagTitle: 'Get Lucky',
      sourceFileName: 'Daft Punk - Get Lucky.mp3',
    })

    expect(queries).toContain('Daft Punk Get Lucky')
    expect(queries).toContain('Daft Punk - Get Lucky')
    expect(queries).toContain('Get Lucky')
  })
})
