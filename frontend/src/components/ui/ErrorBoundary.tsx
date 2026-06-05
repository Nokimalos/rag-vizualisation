import { Component, type ReactNode, type ErrorInfo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: Error | null }

function DefaultFallback({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="bg-surface border border-border rounded-xl p-6 max-w-md text-center">
        <p className="text-destructive text-lg font-medium mb-2">{t('common.errorTitle')}</p>
        <p className="text-muted-foreground text-sm mb-4">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      </div>
    </div>
  )
}

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
        <DefaultFallback
          message={this.state.error?.message}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      )
    }
    return this.props.children
  }
}
