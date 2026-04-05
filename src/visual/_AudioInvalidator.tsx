import { useThree } from '@react-three/fiber'
import { useEffect, type MutableRefObject } from 'react'

interface ComposerLike {
  render: (deltaTime?: number) => void
}

interface Props {
  composerRef?: MutableRefObject<ComposerLike | null>
}

export function AudioInvalidator({}: Props) {
  const setFrameloop = useThree((s) => s.setFrameloop)
  const advance = useThree((s) => s.advance)

  useEffect(() => {
    const onStart = () => {
      setFrameloop('never')
    }
    const onTick = (e: Event) => {
      const t = e instanceof CustomEvent && typeof e.detail === 'number'
        ? e.detail
        : performance.now() / 1000
      try {
        advance(t, true)
      } catch (err) {
        console.error('[ai] advance error', err)
      }
    }
    const onEnd = () => {
      setFrameloop('always')
    }
    window.addEventListener('mvapp-export-start', onStart)
    window.addEventListener('mvapp-export-tick', onTick)
    window.addEventListener('mvapp-export-end', onEnd)
    return () => {
      window.removeEventListener('mvapp-export-start', onStart)
      window.removeEventListener('mvapp-export-tick', onTick)
      window.removeEventListener('mvapp-export-end', onEnd)
    }
  }, [setFrameloop, advance])

  return null
}
