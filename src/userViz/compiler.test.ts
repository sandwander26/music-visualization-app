import { describe, it, expect } from 'vitest'
import { compileUserViz } from './compiler'

const VALID_VIZ = `
import { createElement } from 'react'

export default function MyViz() {
  return createElement('div', null, 'hello')
}
`

const BROKEN_VIZ = `
export default function {{{ broken syntax
`

const NO_DEFAULT_EXPORT = `
export function NotDefault() {
  return null
}
`

describe('compileUserViz', () => {
  it('компилирует валидный TSX и возвращает компонент', () => {
    const result = compileUserViz(VALID_VIZ)
    expect(result.error).toBeNull()
    expect(typeof result.component).toBe('function')
  })

  it('возвращает ошибку при сломанном синтаксисе', () => {
    const result = compileUserViz(BROKEN_VIZ)
    expect(result.component).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('возвращает ошибку если нет default export', () => {
    const result = compileUserViz(NO_DEFAULT_EXPORT)
    expect(result.component).toBeNull()
    expect(result.error).toContain('default export')
  })
})
