import { render, screen } from '@testing-library/react'
import '@/i18n'
import { ConnectionStatus } from './ConnectionStatus'

test('shows connected state', () => {
  render(<ConnectionStatus connected />)
  expect(screen.getByText(/connecté|connected/i)).toBeInTheDocument()
})
