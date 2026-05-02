import { transform } from '@babel/standalone'
import type { ComponentType } from 'react'
import React from 'react'

export interface CompileResult {
  component: ComponentType | null
  error: string | null
}

export function compileUserViz(source: string): CompileResult {
  try {
    const transformed = transform(source, {
      presets: ['typescript', 'react'],
      filename: 'userViz.tsx',
    }).code ?? ''

    const stripped = transformed
      .replace(/import\s+.*?\s+from\s+['"][^'"]+['"];?/g, '')
      .replace(/export\s+default\s+function\s+(\w+)/, 'function $1\nconst __default = $1')
      .replace(/export\s+default\s+(\w+)/, 'const __default = $1')

    const factory = new Function('React', stripped + '\nreturn __default')
    const result = factory(React) as ComponentType
    return { component: result, error: null }
  } catch (e) {
    return { component: null, error: (e as Error).message }
  }
}
