import { type ReactNode } from 'react'
import clsx from 'clsx'

interface GlassCardProps { children: ReactNode; className?: string; padding?: boolean }

export function GlassCard({ children, className, padding = true }: GlassCardProps) {
  return <div className={clsx('bg-surface border border-border rounded-xl shadow-sm', padding && 'p-4', className)}>{children}</div>
}
