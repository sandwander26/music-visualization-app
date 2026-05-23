import { describe, expect, it } from 'vitest'
import { findActiveLrcIndex, parseLrc } from '../../utils/lrcParser'

describe('parseLrc (автор: пользователь — модуль lyrics)', () => {
  it('парсит строки с таймкодами и игнорирует мета-теги', () => {
    const raw = `[ar:Artist]
[00:01.00] Первая строка
[00:03.50] Вторая строка`

    const lines = parseLrc(raw)

    expect(lines).toHaveLength(2)
    expect(lines[0].text).toBe('Первая строка')
    expect(lines[0].time).toBeCloseTo(1, 2)
    expect(lines[1].text).toBe('Вторая строка')
    expect(lines[1].time).toBeCloseTo(3.5, 2)
  })

  it('поддерживает несколько таймкодов на одной строке', () => {
    const lines = parseLrc('[00:01.00][00:05.00] Повтор')

    expect(lines).toHaveLength(2)
    expect(lines.every((l) => l.text === 'Повтор')).toBe(true)
    expect(lines[0].time).toBeCloseTo(1, 2)
    expect(lines[1].time).toBeCloseTo(5, 2)
  })
})

describe('findActiveLrcIndex (автор: пользователь — модуль lyrics)', () => {
  it('возвращает индекс активной строки по текущему времени', () => {
    const lines = parseLrc('[00:01.00] A\n[00:03.00] B\n[00:06.00] C')

    expect(findActiveLrcIndex(lines, 0.5)).toBe(-1)
    expect(findActiveLrcIndex(lines, 2)).toBe(0)
    expect(findActiveLrcIndex(lines, 4)).toBe(1)
    expect(findActiveLrcIndex(lines, 10)).toBe(2)
  })
})
