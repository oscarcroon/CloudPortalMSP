import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '~~/shared/markdown'

describe('renderMarkdown', () => {
  it('sanitiserar farliga taggar men behåller markdown', () => {
    const { html, text } = renderMarkdown(
      'Hejsan **värld** <script>alert(1)</script> [länk](https://example.com)'
    )
    expect(html).toContain('<strong>värld</strong>')
    expect(html).toContain('<a href="https://example.com"')
    expect(html).not.toContain('<script>')
    expect(text).toContain('länk')
  })
})

