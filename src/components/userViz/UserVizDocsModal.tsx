import { type CSSProperties, type ReactNode } from 'react'
import { X } from 'lucide-react'
import Modal from '../Modal'

interface UserVizDocsModalProps {
  onClose: () => void
}

const MONO_LABEL: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--fg-mute)',
}

const UL_STYLE: CSSProperties = {
  paddingLeft: 18,
  marginTop: 6,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const EXAMPLE_CODE = `import { useEffect, useRef } from 'react'

export default function MyViz({ audioData, beat, energy, currentTime }) {
  const canvasRef = useRef(null)

  const audioRef = useRef({ audioData, beat, energy, currentTime })
  useEffect(() => {
    audioRef.current = { audioData, beat, energy, currentTime }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf = 0
    const draw = () => {
      const { energy, beat } = audioRef.current
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = beat ? '#fff' : '#7cf'
      const r = 40 + energy * 1200
      ctx.beginPath()
      ctx.arc(canvas.width / 2, canvas.height / 2, r, 0, Math.PI * 2)
      ctx.fill()
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={1920}
      height={1080}
      style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
    />
  )
}`

export default function UserVizDocsModal({ onClose }: UserVizDocsModalProps) {
  return (
    <Modal onClose={onClose} zIndex={75} cardStyle={{ maxWidth: 720, maxHeight: '86vh' }}>
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ ...MONO_LABEL, marginBottom: 4 }}>Документация</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em' }}>
              Как написать свой визуализатор
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-soft)',
              color: 'var(--fg-mute)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div
          style={{
            padding: 24,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            fontSize: 14,
            color: 'var(--fg-soft)',
            lineHeight: 1.55,
          }}
        >
          <Section title="Что приходит в компонент">
            <p>Любой виз получает четыре пропа от плеера:</p>
            <ul style={UL_STYLE}>
              <li><Code>audioData: Float32Array(1024)</Code> — нормализованный FFT-спектр.</li>
              <li><Code>beat: boolean</Code> — true на 10 кадров после удара.</li>
              <li><Code>energy: number</Code> — средняя энергия. Реальный диапазон 0.01–0.12 (не 0..1!).</li>
              <li><Code>currentTime: number</Code> — секунды воспроизведения.</li>
            </ul>
          </Section>

          <Section title="Главное правило · stale closure">
            <p style={{ marginBottom: 6 }}>
              Аудио-пропы обновляются каждый кадр. Если зачитать их прямо в
              {' '}<Code>useEffect</Code> с зависимостями <Code>[audioData, energy]</Code>{' '}
              — эффект будет пересоздаваться каждые ~16мс, и <Code>requestAnimationFrame</Code>
              {' '}успеет отмениться раньше, чем нарисует кадр. Виз застынет статичной картинкой.
            </p>
            <p style={{ marginBottom: 6 }}>Правильный паттерн:</p>
            <ul style={{ ...UL_STYLE, marginTop: 4, marginBottom: 6 }}>
              <li>держи свежий снимок аудио в <Code>useRef</Code>;</li>
              <li>обновляй <Code>audioRef.current</Code> в отдельном <Code>useEffect</Code> без массива зависимостей;</li>
              <li>запускай RAF-цикл один раз в <Code>useEffect(..., [])</Code> и читай <Code>audioRef.current</Code> на каждом кадре.</li>
            </ul>
            <p>
              Тот же приём работает для R3F: в <Code>useFrame</Code> читай из <Code>audioRef.current</Code>, а не из пропов.
            </p>
          </Section>

          <Section title="Минимальный пример">
            <pre
              style={{
                margin: 0,
                padding: 14,
                borderRadius: 10,
                background: 'var(--bg-soft)',
                border: '1px solid var(--border)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: 'var(--fg)',
                overflowX: 'auto',
                lineHeight: 1.45,
              }}
            >
{EXAMPLE_CODE}
            </pre>
          </Section>

          <Section title="Что доступно">
            <ul style={UL_STYLE}>
              <li>React и все его хуки (useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect, useReducer).</li>
              <li>Canvas 2D — <Code>getContext('2d')</Code>.</li>
              <li>WebGL и GLSL-шейдеры — <Code>getContext('webgl')</Code> или <Code>webgl2</Code>.</li>
              <li>Three.js: чистый <Code>three</Code> или <Code>@react-three/fiber</Code> с хелперами <Code>@react-three/drei</Code>, постпроцесс (<Code>@react-three/postprocessing</Code>, <Code>postprocessing</Code>) и слоистый материал <Code>lamina</Code>.</li>
            </ul>
          </Section>

          <Section title="Советы">
            <ul style={UL_STYLE}>
              <li>Корневой элемент должен занимать <Code>width: 100%; height: 100%</Code>.</li>
              <li>Для HiDPI умножай размер canvas на <Code>window.devicePixelRatio</Code>.</li>
              <li>Лучше реагировать на <Code>beat</Code> через ref-flash, чем на каждый перерендер.</li>
              <li>На паузе <Code>currentTime</Code> и <Code>energy</Code> не меняются — анимации замирают сами.</li>
            </ul>
          </Section>

          <Section title="Ограничения v1">
            <ul style={UL_STYLE}>
              <li>Импортировать можно только пакеты из списка выше. Другие не подключатся.</li>
              <li>Динамические <Code>import()</Code> не работают.</li>
              <li>Ошибки в рантайме ловятся — показывается заглушка «этот виз сломался».</li>
            </ul>
          </Section>
        </div>
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div style={{ ...MONO_LABEL, fontSize: 11, letterSpacing: '0.14em', marginBottom: 8 }}>{title}</div>
      {children}
    </section>
  )
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        padding: '1px 6px',
        borderRadius: 4,
        background: 'var(--bg-soft)',
        border: '1px solid var(--border)',
        color: 'var(--fg)',
      }}
    >
      {children}
    </code>
  )
}
