import { useState, type ReactNode } from 'react'

interface FilterChipProps {
  active: boolean
  premium?: boolean
  count?: number
  onClick: () => void
  children: ReactNode
}

export default function FilterChip({ active, premium = false, count, onClick, children }: FilterChipProps) {
  const [hover, setHover] = useState(false)

  let bg = 'var(--bg-soft)'
  let border = 'var(--border)'
  let color = 'var(--fg-soft)'

  if (premium) {
    if (active) {
      bg = 'var(--premium)'
      border = 'var(--premium)'
      color = 'var(--bg)'
    } else {
      bg = 'var(--premium-bg)'
      border = 'var(--premium-border)'
      color = 'var(--premium)'
    }
  } else if (active) {
    bg = 'var(--fg)'
    border = 'var(--fg)'
    color = 'var(--bg)'
  } else if (hover) {
    color = 'var(--fg)'
    border = 'var(--border-strong)'
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '7px 14px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 500,
        background: bg,
        border: `1px solid ${border}`,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        fontFamily: 'inherit',
      }}
    >
      <span>{children}</span>
      {typeof count === 'number' ? <span style={{ opacity: 0.55 }}>{count}</span> : null}
    </button>
  )
}
