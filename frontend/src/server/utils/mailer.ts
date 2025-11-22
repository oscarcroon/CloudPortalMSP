import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '..', '..', '..', '..')
const uploadsRoot = path.join(repoRoot, 'uploads')
const outboxDir = path.join(uploadsRoot, 'outbox')

fs.mkdirSync(outboxDir, { recursive: true })

const DEFAULT_PORTAL_URL = 'http://localhost:3000'

const portalBaseUrl = (
  process.env.PASSWORD_RESET_BASE_URL ||
  process.env.PORTAL_BASE_URL ||
  process.env.NUXT_PUBLIC_APP_URL ||
  DEFAULT_PORTAL_URL
).replace(/\/$/, '')

export const buildPortalUrl = (pathname: string) => {
  if (!pathname) return portalBaseUrl
  return `${portalBaseUrl}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}

export const sendPasswordResetEmail = async (input: {
  to: string
  token: string
  expiresAt: number
}) => {
  const resetUrl = `${buildPortalUrl('/reset-password')}?token=${encodeURIComponent(input.token)}`
  const subject = 'Återställ lösenord'
  const lines = [
    `To: ${input.to}`,
    `Subject: ${subject}`,
    '',
    'Hej,',
    '',
    'Vi fick en begäran om att återställa ditt lösenord till Cloud Portal.',
    `Länken nedan är giltig fram till ${new Date(input.expiresAt).toLocaleString('sv-SE')}.`,
    '',
    resetUrl,
    '',
    'Om du inte har begärt detta kan du ignorera mejlet.',
    'Ditt lösenord förändras bara om du följer länken ovan och väljer ett nytt.'
  ]

  const payload = `${lines.join('\n')}\n`
  const filename = path.join(outboxDir, `password-reset-${input.token}.txt`)
  await fs.promises.writeFile(filename, payload, 'utf8')
  console.info(`[mail] Password reset email for ${input.to} stored at ${filename}`)
  return { resetUrl, filename }
}


