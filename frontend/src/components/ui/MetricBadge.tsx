import clsx from 'clsx'

interface MetricBadgeProps { label: string; value: string | number; color?: 'blue' | 'purple' | 'emerald' | 'gold' }

const colorMap = {
  blue: 'text-neon-blue bg-neon-blue/10 border-neon-blue/20',
  purple: 'text-neon-purple bg-neon-purple/10 border-neon-purple/20',
  emerald: 'text-neon-emerald bg-neon-emerald/10 border-neon-emerald/20',
  gold: 'text-neon-gold bg-neon-gold/10 border-neon-gold/20',
}

export function MetricBadge({ label, value, color = 'blue' }: MetricBadgeProps) {
  return (
    <div className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-mono', colorMap[color])}>
      <span className="opacity-60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
