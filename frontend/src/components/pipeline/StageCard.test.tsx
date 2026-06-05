import { render, screen } from '@testing-library/react'
import '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { FileText } from 'lucide-react'
import { StageCard } from './StageCard'

function renderCard(props: Partial<React.ComponentProps<typeof StageCard>> = {}) {
  return render(
    <TooltipProvider>
      <StageCard icon={FileText} label="Découpage" term="chunking" status="done" metric="24" {...props} />
    </TooltipProvider>,
  )
}

test('shows label, technical term and metric', () => {
  renderCard()
  expect(screen.getByText('Découpage')).toBeInTheDocument()
  expect(screen.getByText('chunking')).toBeInTheDocument()
  expect(screen.getByText('24')).toBeInTheDocument()
})

test('marks the active stage with aria-current', () => {
  renderCard({ status: 'processing' })
  expect(screen.getByRole('listitem')).toHaveAttribute('aria-current', 'step')
})
