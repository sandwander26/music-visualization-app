import { describe, it, expect } from 'vitest'
import { formatDuration } from './format'

describe('formatDuration', () => {
  it('форматирует целые минуты', () => {
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(120)).toBe('2:00')
  })

  it('форматирует минуты и секунды', () => {
    expect(formatDuration(75)).toBe('1:15')
    expect(formatDuration(222)).toBe('3:42')
  })

  it('добавляет ведущий ноль к секундам', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(309)).toBe('5:09')
  })

  it('возвращает прочерк для невалидной длительности', () => {
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(-10)).toBe('—')
    expect(formatDuration(NaN)).toBe('—')
    expect(formatDuration(Infinity)).toBe('—')
  })
})
