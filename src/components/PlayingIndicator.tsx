interface PlayingIndicatorProps {
  color?: string
}

export default function PlayingIndicator({ color = 'var(--fg)' }: PlayingIndicatorProps) {
  const barStyle = {
    width: 2,
    height: 12,
    background: color,
    borderRadius: 1,
    transformOrigin: 'bottom',
    display: 'inline-block',
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        gap: 2,
        height: 12,
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <span style={{ ...barStyle, animation: 'eqA 0.8s ease-in-out infinite' }} />
      <span style={{ ...barStyle, animation: 'eqB 0.8s ease-in-out infinite 0.15s' }} />
      <span style={{ ...barStyle, animation: 'eqC 0.8s ease-in-out infinite 0.3s' }} />
      <style>{`
        @keyframes eqA { 0%,100% { transform: scaleY(0.4) } 50% { transform: scaleY(1) } }
        @keyframes eqB { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(0.4) } }
        @keyframes eqC { 0%,100% { transform: scaleY(0.5) } 50% { transform: scaleY(0.95) } }
      `}</style>
    </span>
  )
}
