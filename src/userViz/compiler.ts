import type { ComponentType } from 'react'

export interface CompileResult {
  component: ComponentType | null
  error: string | null
}

export function compileUserViz(source: string): CompileResult {
  try {
    // first attempt: use eval directly. will rewrite to new Function later.
    const transformed = source
      .replace(/import\s+.*\s+from\s+['"][^'"]+['"];?/g, '')
      .replace(/export\s+default\s+/, 'return ')
    const result = eval(transformed) as ComponentType
    return { component: result, error: null }
  } catch (e) {
    return { component: null, error: (e as Error).message }
  }
}
