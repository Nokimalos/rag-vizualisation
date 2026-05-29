import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex items-center justify-center h-full p-8">
          <div className="glass rounded-xl p-6 max-w-md text-center">
            <p className="text-red-400 text-lg font-medium mb-2">Something went wrong</p>
            <p className="text-gray-500 text-sm mb-4">{this.state.error?.message}</p>
            <button onClick={() => this.setState({ hasError: false, error: null })} className="px-4 py-2 bg-neon-blue/20 text-neon-blue rounded-lg text-sm hover:bg-neon-blue/30">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
