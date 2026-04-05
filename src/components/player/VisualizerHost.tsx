import type { CSSProperties } from 'react'
import { renderVisualizer, type VisualizerMode } from '../../vizItems'

interface VisualizerHostProps {
  vizId: string
  className?: string
  style?: CSSProperties
}

// блок для fixed-позиции
export default function VisualizerHost({ vizId, className, style }: VisualizerHostProps) {
  return (
    <div
      className={`viz-host ${className ?? ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        contain: 'layout style paint size',
        isolation: 'isolate',
        background: '#000',
        ...style,
      }}
    >
      {renderVisualizer(vizId as VisualizerMode)}
    </div>
  )
}
