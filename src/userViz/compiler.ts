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