import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount React trees after every test to avoid cross-test leakage
afterEach(() => {
  cleanup()
})
