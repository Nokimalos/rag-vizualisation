import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { GlossaryTerm } from '@/content/glossary'

export function TermTooltip({ term, label }: { term: GlossaryTerm; label: string }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-medium">{label}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{term}</span>
      <Tooltip>
        <TooltipTrigger aria-label={`${label} – info`}>
          <Info className="h-3 w-3 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] text-xs">{t(`glossary.${term}`)}</TooltipContent>
      </Tooltip>
    </span>
  )
}
