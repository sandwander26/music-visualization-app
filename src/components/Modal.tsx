import { useEffect, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  onClose: () => void
  children: ReactNode
  zIndex?: number
  cardStyle?: CSSProperties
  overlayStyle?: CSSProperties
  closeOnBackdrop?: boolean
}

const BASE_OVERLAY: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
}

const BASE_CARD: CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  borderRadius: 18,
  border: '1px solid var(--border)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

export default function Modal({
  onClose,
  children,
  zIndex = 70,
  cardStyle,
  overlayStyle,
  closeOnBackdrop = true,
}: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={closeOnBackdrop ? onClose : undefined}
      style={{ ...BASE_OVERLAY, zIndex, ...overlayStyle }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...BASE_CARD, ...cardStyle }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
