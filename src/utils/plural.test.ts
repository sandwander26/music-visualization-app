import { describe, it, expect } from 'vitest'
import { pluralTrack } from './plural'

describe('pluralTrack', () => {
  it('единственное число', () => {
    expect(pluralTrack(1)).toBe('трек')
    expect(pluralTrack(21)).toBe('трек')
    expect(pluralTrack(101)).toBe('трек')
  })

  it('форма "трека" для 2-4', () => {
    expect(pluralTrack(2)).toBe('трека')
    expect(pluralTrack(3)).toBe('трека')
    expect(pluralTrack(4)).toBe('трека')
    expect(pluralTrack(22)).toBe('трека')
    expect(pluralTrack(103)).toBe('трека')
  })

  it('форма "треков" для 5-20 и нуля', () => {
    expect(pluralTrack(0)).toBe('треков')
    expect(pluralTrack(5)).toBe('треков')
    expect(pluralTrack(11)).toBe('треков')
    expect(pluralTrack(12)).toBe('треков')
    expect(pluralTrack(13)).toBe('треков')
    expect(pluralTrack(14)).toBe('треков')
    expect(pluralTrack(20)).toBe('треков')
    expect(pluralTrack(100)).toBe('треков')
  })
})
