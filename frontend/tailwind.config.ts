import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  darkMode: 'class',
  content: [
    './src/components/**/*.{vue,js,ts}',
    './src/layouts/**/*.vue',
    './src/pages/**/*.vue',
    './src/plugins/**/*.{js,ts}',
    './src/app.vue'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1c6dd0',
          dark: '#0f3b73',
          light: '#eaf2ff'
        }
      },
      boxShadow: {
        card: '0 10px 30px rgba(15, 59, 115, 0.08)'
      }
    }
  },
  plugins: []
}

