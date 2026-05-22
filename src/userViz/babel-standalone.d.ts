declare module '@babel/standalone' {
  export interface BabelTransformOptions {
    filename?: string
    presets?: Array<string | [string, Record<string, unknown>]>
    plugins?: Array<string | [string, Record<string, unknown>]>
    sourceMaps?: boolean | 'inline' | 'both'
    sourceType?: 'module' | 'script' | 'unambiguous'
  }
  export interface BabelTransformResult {
    code: string | null
    map: unknown
    ast: unknown
  }
  export function transform(code: string, options?: BabelTransformOptions): BabelTransformResult
  export const availablePresets: Record<string, unknown>
  export const availablePlugins: Record<string, unknown>
  export function registerPreset(name: string, preset: unknown): void
  export function registerPlugin(name: string, plugin: unknown): void
}
