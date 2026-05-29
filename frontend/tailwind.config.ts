import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { primary: '#0a0a0f', secondary: '#12121a', tertiary: '#1a1a2e' },
        neon: { blue: '#00d4ff', purple: '#8b5cf6', emerald: '#10b981', gold: '#f59e0b' },
        glass: { bg: 'rgba(255, 255, 255, 0.05)', border: 'rgba(255, 255, 255, 0.1)' },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: { '0%': { boxShadow: '0 0 5px currentColor' }, '100%': { boxShadow: '0 0 20px currentColor, 0 0 40px currentColor' } },
      },
    },
  },
  plugins: [],
} satisfies Config
