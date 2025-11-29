import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  darkMode: 'class',
  content: [
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/plugins/**/*.{js,ts}',
    './app/app.vue'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--brand, 28 109 208) / <alpha-value>)',
          dark: 'rgb(var(--brand-dark, 15 59 115) / <alpha-value>)',
          light: 'rgb(var(--brand-light, 234 242 255) / <alpha-value>)'
        }
      },
      boxShadow: {
        card: '0 10px 30px rgba(15, 59, 115, 0.08)'
      }
    }
  },
  plugins: []
}

