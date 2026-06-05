import { render, screen } from '@testing-library/react'
import { Button } from './button'

test('renders a button with its label', () => {
  render(<Button>Lancer</Button>)
  expect(screen.getByRole('button', { name: 'Lancer' })).toBeInTheDocument()
})
