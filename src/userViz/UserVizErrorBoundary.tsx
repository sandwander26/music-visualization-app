import React from 'react'

interface Props {
  resetKey: string
  children: React.ReactNode
}

interface State {
  error: Error | null
}

export class UserVizErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.warn('[userViz] runtime error:', error.message, info.componentStack)
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error !== null) {
      this.setState({ error: null })
    }
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return <UserVizErrorFallback message={this.state.error.message} />
    }
    return this.props.children
  }
}

interface FallbackProps {
  message?: string
}

export function UserVizErrorFallback({ message }: FallbackProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        color: '#fff',
        background: 'radial-gradient(circle at center, rgba(40,0,0,0.6) 0%, #000 70%)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          opacity: 0.6,
        }}
      >
        Ошибка
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
        Этот визуализатор сломался
      </div>
      {message ? (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            opacity: 0.55,
            maxWidth: 480,
            wordBreak: 'break-word',
          }}
        >
          {message}
        </div>
      ) : null}
    </div>
  )
}
