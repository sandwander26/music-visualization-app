export const TEMPLATE_CANVAS2D = `import { useEffect, useRef } from \'react\'

export default function MyCanvasViz({ audioData }: { audioData: Float32Array }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  return <canvas ref={canvasRef} width={1920} height={1080} />
}
`

export const TEMPLATE_R3F = `import { Canvas } from \'@react-three/fiber\'

export default function MyR3FViz() {
  return (
    <Canvas>
      <mesh>
        <boxGeometry />
        <meshStandardMaterial />
      </mesh>
    </Canvas>
  )
}
`

export const TEMPLATE_WEBGL = `// raw WebGL template
import { useEffect, useRef } from \'react\'

export default function MyWebGLViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  return <canvas ref={canvasRef} />
}
`

export type TemplateKind = \'canvas2d\' | \'r3f\' | \'webgl\'

const TEMPLATES: Record<TemplateKind, { name: string; src: string }> = {
  canvas2d: { name: \'loomi-canvas2d-template.tsx\', src: TEMPLATE_CANVAS2D },
  r3f: { name: \'loomi-r3f-template.tsx\', src: TEMPLATE_R3F },
  webgl: { name: \'loomi-webgl-template.tsx\', src: TEMPLATE_WEBGL },
}

export function downloadTemplate(kind: TemplateKind): void {
  const t = TEMPLATES[kind]
  const blob = new Blob([t.src], { type: \'text/plain;charset=utf-8\' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement(\'a\')
  a.href = url
  a.download = t.name
  a.click()
}
