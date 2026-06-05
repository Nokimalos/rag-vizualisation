import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { LanguageToggle } from './LanguageToggle'

test('switches the active language', async () => {
  await i18n.changeLanguage('fr')
  render(<LanguageToggle />)
  await userEvent.click(screen.getByRole('button', { name: /langue|language/i }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'EN' }))
  expect(i18n.language).toBe('en')
})
