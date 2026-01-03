import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true
})

// Configure DOMPurify
const purifyConfig = {
  ALLOWED_TAGS: [
    'a',
    'b',
    'blockquote',
    'br',
    'code',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'li',
    'ol',
    'p',
    'pre',
    'span',
    'strong',
    'ul'
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false
}

export interface RenderedMarkdown {
  html: string
  text: string
}

export const renderMarkdown = (value?: string | null): RenderedMarkdown => {
  if (!value) {
    return { html: '', text: '' }
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return { html: '', text: '' }
  }

  // marked.parse returns string synchronously in this setup
  const rawHtml = marked.parse(trimmed) as string
  const safeHtml = DOMPurify.sanitize(rawHtml, purifyConfig)

  // Extract plain text by stripping HTML tags
  const plainText = safeHtml
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { html: safeHtml, text: plainText }
}
