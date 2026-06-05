import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const LANGS = ['fr', 'en'] as const

export function LanguageToggle() {
  const { i18n } = useTranslation()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Language">
          <Languages className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-24 p-1">
        {LANGS.map((l) => (
          <button
            key={l}
            role="menuitem"
            onClick={() => i18n.changeLanguage(l)}
            className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            {l.toUpperCase()}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
