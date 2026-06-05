import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './useTheme'

function Probe() {
  const { theme, toggle } = useTheme()
  return <button onClick={toggle}>{theme}</button>
}

beforeEach(() => { localStorage.clear(); document.documentElement.classList.remove('dark') })

test('defaults to light and toggles to dark, persisting and setting the class', async () => {
  render(<ThemeProvider><Probe /></ThemeProvider>)
  expect(screen.getByRole('button')).toHaveTextContent('light')
  expect(document.documentElement.classList.contains('dark')).toBe(false)

  await userEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('button')).toHaveTextContent('dark')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(localStorage.getItem('theme')).toBe('dark')
})

test('reads persisted theme on mount', () => {
  localStorage.setItem('theme', 'dark')
  render(<ThemeProvider><Probe /></ThemeProvider>)
  expect(screen.getByRole('button')).toHaveTextContent('dark')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
})
