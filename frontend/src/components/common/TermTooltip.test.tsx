import { render, screen } from '@testing-library/react'
import '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TermTooltip } from './TermTooltip'

test('renders the visible label and the technical term', () => {
  render(
    <TooltipProvider>
      <TermTooltip term="chunking" label="Découpage" />
    </TooltipProvider>,
  )
  expect(screen.getByText('Découpage')).toBeInTheDocument()
  expect(screen.getByText('chunking')).toBeInTheDocument()
})
