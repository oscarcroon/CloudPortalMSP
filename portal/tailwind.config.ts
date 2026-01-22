import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

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
      // NOTE: Public API för plugins/layers. Ändra inte från en plugin:
      // - brand-färger används via klasser (text-brand, bg-brand/10 etc.)
      // - card-shadow används av kort/panel-komponenter
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--brand, 28 109 208) / <alpha-value>)',
          dark: 'rgb(var(--brand-dark, 15 59 115) / <alpha-value>)',
          light: 'rgb(var(--brand-light, 234 242 255) / <alpha-value>)'
        }
      },
      boxShadow: {
        card: '0 10px 30px rgba(15, 59, 115, 0.08)'
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'inherit',
            a: {
              color: 'rgb(var(--brand, 28 109 208))',
              textDecoration: 'underline',
              fontWeight: '500',
              '&:hover': {
                color: 'rgb(var(--brand, 28 109 208) / 0.8)'
              }
            },
            'code::before': {
              content: '""'
            },
            'code::after': {
              content: '""'
            },
            code: {
              backgroundColor: 'rgb(241 245 249)',
              color: 'rgb(30 41 59)',
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              fontSize: '0.875em',
              fontWeight: '500',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            },
            'pre code': {
              backgroundColor: 'transparent',
              color: 'inherit',
              padding: '0',
              fontSize: 'inherit'
            },
            pre: {
              backgroundColor: 'rgb(30 41 59)',
              color: 'rgb(226 232 240)',
              padding: '1rem',
              borderRadius: '0.5rem',
              overflowX: 'auto'
            },
            blockquote: {
              borderLeftColor: 'rgb(var(--brand, 28 109 208))',
              backgroundColor: 'rgb(239 246 255)',
              padding: '0.75rem 1rem',
              borderRadius: '0 0.375rem 0.375rem 0',
              color: 'rgb(30 64 175)',
              fontStyle: 'italic',
              borderLeftWidth: '4px'
            },
            'blockquote > :first-child': {
              marginTop: '0'
            },
            'blockquote > :last-child': {
              marginBottom: '0'
            },
            img: {
              borderRadius: '0.5rem',
              marginTop: '1.5rem',
              marginBottom: '1.5rem'
            },
            ul: {
              listStyleType: 'disc',
              paddingLeft: '1.5rem'
            },
            ol: {
              listStyleType: 'decimal',
              paddingLeft: '1.5rem'
            },
            li: {
              marginTop: '0.5rem',
              marginBottom: '0.5rem'
            }
          }
        },
        invert: {
          css: {
            code: {
              backgroundColor: 'rgb(30 41 59)',
              color: 'rgb(226 232 240)'
            },
            pre: {
              backgroundColor: 'rgb(15 23 42)',
              color: 'rgb(226 232 240)'
            },
            blockquote: {
              borderLeftColor: 'rgb(96 165 250)',
              backgroundColor: 'rgb(30 58 138 / 0.2)',
              color: 'rgb(191 219 254)'
            }
          }
        }
      }
    }
  },
  plugins: [typography]
}

