import * as Babel from '@babel/standalone'
import React, { type ComponentType } from 'react'
import * as ReactThreeFiber from '@react-three/fiber'
import * as ReactThreeDrei from '@react-three/drei'
import * as ReactThreePost from '@react-three/postprocessing'
import * as Postprocessing from 'postprocessing'
import * as Lamina from 'lamina'
import * as THREE_NS from 'three'
import type { UserVizProps } from './types'

interface CompileResult {
  component: ComponentType<UserVizProps> | null
  error: string | null
}

const MODULES: Record<string, { global: string; value: unknown }> = {
  react: { global: '__react', value: React },
  '@react-three/fiber': { global: '__r3f', value: ReactThreeFiber },
  '@react-three/drei': { global: '__drei', value: ReactThreeDrei },
  '@react-three/postprocessing': { global: '__rpost', value: ReactThreePost },
  postprocessing: { global: '__post', value: Postprocessing },
  lamina: { global: '__lamina', value: Lamina },
  three: { global: '__three', value: THREE_NS },
}
const MODULE_GLOBALS = Object.fromEntries(Object.entries(MODULES).map(([k, v]) => [k, v.global]))

function rewriteImports(src: string): { code: string; warnings: string[] } {
  const warnings: string[] = []
  const lines = src.split('\n')
  const out: string[] = []
  const importRe = /^\s*import\s+(.+?)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/
  const sideEffectRe = /^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/

  for (const raw of lines) {
    const sideEffect = raw.match(sideEffectRe)
    if (sideEffect) continue

    const m = raw.match(importRe)
    if (!m) {
      out.push(raw)
      continue
    }
    const clause = m[1].trim()
    const moduleName = m[2]
    const globalName = MODULE_GLOBALS[moduleName]
    if (!globalName) {
      warnings.push(`Импорт из "${moduleName}" не поддерживается. Доступны только: react, @react-three/fiber, @react-three/drei, three.`)
      continue
    }

    const namespaceMatch = clause.match(/^\*\s+as\s+(\w+)$/)
    if (namespaceMatch) {
      out.push(`const ${namespaceMatch[1]} = ${globalName};`)
      continue
    }

    const defaultAndNamed = clause.match(/^(\w+)\s*,\s*\{([^}]+)\}$/)
    if (defaultAndNamed) {
      out.push(`const ${defaultAndNamed[1]} = ${globalName}.default ?? ${globalName};`)
      out.push(`const { ${defaultAndNamed[2].trim()} } = ${globalName};`)
      continue
    }

    const namedMatch = clause.match(/^\{([^}]+)\}$/)
    if (namedMatch) {
      out.push(`const { ${namedMatch[1].trim()} } = ${globalName};`)
      continue
    }

    const defaultMatch = clause.match(/^(\w+)$/)
    if (defaultMatch) {
      out.push(`const ${defaultMatch[1]} = ${globalName}.default ?? ${globalName};`)
      continue
    }

    warnings.push(`Не распознан импорт: ${raw.trim()}`)
  }

  return { code: out.join('\n'), warnings }
}

function rewriteExportDefault(src: string): { code: string; defaultName: string | null } {
  let out = src
  let defaultName: string | null = null

  const fnDefault = out.match(/(^|\n)\s*export\s+default\s+function\s+(\w+)/)
  if (fnDefault) {
    defaultName = fnDefault[2]
    out = out.replace(/(^|\n)\s*export\s+default\s+function\s+(\w+)/, '$1function $2')
  }

  if (!defaultName) {
    const idDefault = out.match(/(^|\n)\s*export\s+default\s+(\w+)\s*;?/)
    if (idDefault) {
      defaultName = idDefault[2]
      out = out.replace(/(^|\n)\s*export\s+default\s+\w+\s*;?/, '$1')
    }
  }

  if (!defaultName) {
    if (/(^|\n)\s*export\s+default\s+/.test(out)) {
      defaultName = '__default__'
      out = out.replace(/(^|\n)\s*export\s+default\s+/, '$1const __default__ = ')
    }
  }

  out = out.replace(/(^|\n)\s*export\s+(const|let|var|function|class)\s+/g, '$1$2 ')

  return { code: out, defaultName }
}

export function compileUserViz(tsxSource: string): CompileResult {
  try {
    const { code: importsRewritten } = rewriteImports(tsxSource)
    const { code: prepared, defaultName } = rewriteExportDefault(importsRewritten)
    if (!defaultName) {
      return {
        component: null,
        error: 'Не нашёл default export. Объяви компонент через `export default function Name(...)`.',
      }
    }

    const result = Babel.transform(prepared, {
      filename: 'user-viz.tsx',
      presets: [
        ['typescript', { isTSX: true, allExtensions: true, onlyRemoveTypeImports: false }],
        ['react', { runtime: 'classic' }],
      ],
    })
    const code = result.code
    if (!code) {
      return { component: null, error: 'Babel вернул пустой результат' }
    }

    const body = `"use strict";\n${code}\nreturn ${defaultName};`

    const moduleEntries = Object.values(MODULES)
    const factory = new Function('React', ...moduleEntries.map((m) => m.global), body) as (
      ...args: unknown[]
    ) => ComponentType<UserVizProps>
    const Component = factory(React, ...moduleEntries.map((m) => m.value))

    if (typeof Component !== 'function') {
      return { component: null, error: 'default export не является компонентом' }
    }

    return { component: Component, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { component: null, error: message }
  }
}
