import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { OrganisationMemberRole } from '../types/domain.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const uploadsRoot = path.resolve(currentDir, '..', '..', 'uploads')
const outboxDir = path.join(uploadsRoot, 'outbox')
fs.mkdirSync(outboxDir, { recursive: true })

const DEFAULT_PORTAL_URL = 'http://localhost:3000'

const acceptBaseUrl = (process.env.INVITE_ACCEPT_BASE_URL || DEFAULT_PORTAL_URL).replace(/\/$/, '')

export async function sendInvitationEmail({
  to,
  role,
  organisationName,
  invitedBy,
  expiresAt,
  token
}: {
  to: string
  role: OrganisationMemberRole
  organisationName: string
  invitedBy: string
  expiresAt: string
  token: string
}) {
  const link = `${acceptBaseUrl}/invite/accept?token=${encodeURIComponent(token)}`
  const subject = `Invitation to ${organisationName}`
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    '',
    `Hi,`,
    '',
    `${invitedBy} invited you to join ${organisationName} as ${role}.`,
    `Follow the link below to accept the invitation before ${expiresAt}.`,
    '',
    link,
    '',
    `If you did not expect this invitation you can ignore this email.`
  ]
  const payload = `${lines.join('\n')}\n`
  const filename = path.join(outboxDir, `invite-${token}.txt`)
  await fs.promises.writeFile(filename, payload, 'utf8')
  console.info(`[mail] Invitation for ${to} stored at ${filename}`)
  return { link, filename }
}


