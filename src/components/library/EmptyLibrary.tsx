import { Music, Plus } from 'lucide-react'

interface EmptyLibraryProps {
  onPick: () => void
}

export default function EmptyLibrary({ onPick }: EmptyLibraryProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center mx-auto"
      style={{ padding: '60px 24px', gap: 16, maxWidth: 480 }}
    >
      <Music size={48} style={{ color: 'var(--fg-mute)' }} strokeWidth={1.4} />
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
        Пока пусто
      </div>
      <div style={{ fontSize: 14, color: 'var(--fg-soft)' }}>
        Закинь сюда mp3, чтобы собрать библиотеку
      </div>
      <button
        type="button"
        onClick={onPick}
        className="hov-active-bg t-bg-border"
        style={{
          marginTop: 8,
          padding: '20px 32px',
          borderRadius: 12,
          border: '1px dashed var(--border-strong)',
          background: 'transparent',
          color: 'var(--fg)',
          fontSize: 14,
          fontWeight: 500,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Plus size={16} />
        Добавить треки
      </button>
    </div>
  )
}
