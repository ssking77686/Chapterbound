import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            fontFamily: 'system-ui, sans-serif',
            color: '#9B8E7E',
            background: '#F5F1EA',
            textAlign: 'center',
            padding: '2rem',
          }}
        >
          <div>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#3C3226', marginBottom: '0.5rem' }}>
              应用出错了
            </p>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              遇到了一个意外错误，请刷新页面重试。
            </p>
            <button
              onClick={() => {
                this.setState({ error: null })
                window.location.reload()
              }}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'var(--color-accent, #B69D6E)',
                color: '#fff',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
