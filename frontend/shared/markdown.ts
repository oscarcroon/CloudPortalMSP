import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

const allowedTags = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'em',
  'i',
  'li',
  'ol',
  'p',
  'strong',
  'ul'
]

const allowedAttributes: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'title', 'target', 'rel']
}

const allowedSchemes = ['http', 'https', 'mailto']

marked.setOptions({
  breaks: true,
  mangle: false,
  headerIds: false
})

export interface RenderedMarkdown {
  html: string
  text: string
}

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags,
  allowedAttributes,
  allowedSchemes
}

export const renderMarkdown = (value?: string | null): RenderedMarkdown => {
  if (!value) {
    return { html: '', text: '' }
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return { html: '', text: '' }
  }

  const rawHtml = marked.parse(trimmed)
  const safeHtml = sanitizeHtml(rawHtml, sanitizeOptions)
  const plainText = sanitizeHtml(safeHtml, { allowedTags: [], allowedAttributes: {} })
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { html: safeHtml, text: plainText }
}


