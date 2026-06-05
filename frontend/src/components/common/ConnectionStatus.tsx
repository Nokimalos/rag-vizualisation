import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function ConnectionStatus({ connected }: { connected: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium">
      <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-success' : 'bg-muted-foreground')} />
      <span className={connected ? 'text-success' : 'text-muted-foreground'}>
        {connected ? t('common.connected') : t('common.disconnected')}
      </span>
    </div>
  )
}
