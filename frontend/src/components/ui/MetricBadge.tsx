import clsx from 'clsx'

interface MetricBadgeProps { label: string; value: string | number; color?: 'blue' | 'purple' | 'emerald' | 'gold' }

const colorMap = {
  blue: 'text-primary bg-primary/10 border-primary/20',
  purple: 'text-primary bg-primary/10 border-primary/20',
  emerald: 'text-success bg-success/10 border-success/20',
  gold: 'text-warning bg-warning/10 border-warning/20',
}

export function MetricBadge({ label, value, color = 'blue' }: MetricBadgeProps) {
  return (
    <div className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-mono', colorMap[color])}>
      <span className="opacity-60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
