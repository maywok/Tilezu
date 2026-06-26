import React from 'react'

interface ErrorBoundaryState {
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Uncaught error in component tree', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  render() {
    const { error, errorInfo } = this.state

    if (error) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'radial-gradient(circle at top, rgba(32,36,52,1), rgba(8,10,18,1))',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ maxWidth: 720 }}>
            <h1 style={{ margin: 0, fontSize: '2.4rem' }}>Something went wrong</h1>
            <p style={{ marginTop: 12, lineHeight: 1.4 }}>An unexpected error occurred while starting the app. The details are shown below.</p>
            <pre style={{ marginTop: 16, whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.35)', padding: 16, borderRadius: 12, overflowX: 'auto' }}>
              {error.toString()}
              {errorInfo?.componentStack ? `\n\n${errorInfo.componentStack}` : ''}
            </pre>
            <button
              style={{
                marginTop: 16,
                padding: '0.75rem 1.25rem',
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 12,
                color: 'white',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
