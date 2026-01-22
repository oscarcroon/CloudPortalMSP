import type {
  EmailBranding,
  EmailContent,
  EmailTemplateInput,
  EmailLocale,
  InvitationTemplateInput,
  PasswordResetTemplateInput
} from './types.js'

const DEFAULT_ACCENT = '#2563eb'
const DEFAULT_BACKGROUND = '#f7f9fc' // Ljus bakgrund
const DEFAULT_TEXT = '#0f172a' // Mörk text
const DEFAULT_CARD_BG = '#1e293b' // Mörk kortbakgrund för logotyp-boxen (slate-800)
const DEFAULT_TEXT_SECONDARY = '#cbd5e1' // Sekundär text (slate-300)

const htmlEscapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => htmlEscapeMap[char])

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, '')

const normalizeLocale = (value?: EmailTemplateInput['locale'] | null): EmailLocale =>
  value === 'en' ? 'en' : 'sv'

const normalizeColor = (value: string | undefined, fallback: string) => {
  if (!value) return fallback
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : fallback
}

const blendWithWhite = (hex: string, amount = 0.12) => {
  if (!/^#/.test(hex)) return hex
  const value = hex.slice(1)
  const expanded = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const num = parseInt(expanded, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

const renderLines = (lines: string[], isDark = false) =>
  lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${isDark ? DEFAULT_TEXT_SECONDARY : '#0f172a'};">${escapeHtml(
          line
        )}</p>`
    )
    .join('')

const renderText = (
  intro: string[],
  body: string[],
  outro: string[],
  action?: { label: string; url: string }
) => {
  const result: string[] = [...intro, ...body]
  if (action) {
    result.push(`${action.label}: ${action.url}`)
  }
  result.push(...outro)
  return result.filter(Boolean).join('\n\n')
}

export const renderBrandedTemplate = (
  input: EmailTemplateInput,
  branding?: EmailBranding
): EmailContent => {
  const locale = normalizeLocale(input.locale)
  const accent = normalizeColor(branding?.accentColor, DEFAULT_ACCENT)
  const isDark = branding?.isDarkMode === true
  // Bakgrunden på e-postet ändras baserat på dark mode
  const background = isDark ? '#0f172a' : DEFAULT_BACKGROUND
  // Bakgrunden bakom loggan använder NavBar-färgen från brandingen
  // Use a darker default behind the logo even in light mode to ensure contrast
  const logoBackground = normalizeColor(
    branding?.logoBackgroundColor,
    DEFAULT_CARD_BG
  )
  const accentSoft = blendWithWhite(accent, 0.85)
  // Färger för dark mode
  const cardBackground = isDark ? '#1e293b' : '#fff'
  const textColor = isDark ? '#f1f5f9' : '#0f172a'
  const textSecondary = isDark ? '#cbd5e1' : '#475569'
  const borderColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.25)'
  const borderTopColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.08)'
  const introLines = input.intro ? [input.intro] : []
  const bodyLines = input.body ?? []
  const outroLines = input.outro ?? []
  let text = renderText(introLines, bodyLines, outroLines, input.action)
  const footerMessage: Record<EmailLocale, string> = {
    sv: 'Detta är ett automatiskt meddelande.',
    en: 'This is an automated message.'
  }
  if (branding?.footerTextPlain) {
    text = `${text}\n\n${branding.footerTextPlain}`
  } else if (branding?.footerText) {
    text = `${text}\n\n${stripHtml(branding.footerText)}`
  }
  
  const html = `
  <div style="margin:0;padding:0;background:${background};font-family:'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="text-align:center;margin-bottom:16px;padding:12px 16px;background:${logoBackground};border-radius:12px;border:1px solid rgba(148,163,184,0.1);">
        ${
          branding?.logoUrl
            ? `<img src="${escapeHtml(
                branding.logoUrl
              )}" alt="Logo" style="max-width:150px;max-height:60px;width:auto;height:auto;display:block;margin:0 auto;" />`
            : `<span style="display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:10px;background:${accentSoft};color:${accent};font-weight:600;font-size:14px;">Cloud Portal</span>`
        }
      </div>
      <div style="background:${cardBackground};border-radius:28px;padding:40px 36px;box-shadow:0 20px 65px rgba(15,23,42,0.08);border:1px solid ${borderColor};">
        ${
          input.pretitle
            ? `<p style="margin:0 0 12px;text-transform:uppercase;letter-spacing:0.24em;font-size:12px;color:${accent};font-weight:600;">${escapeHtml(
                input.pretitle
              )}</p>`
            : ''
        }
        ${
          input.title
            ? `<h1 style="margin:0 0 16px;font-size:26px;color:${textColor};line-height:1.3;">${escapeHtml(
                input.title
              )}</h1>`
            : ''
        }
        ${renderLines(introLines, isDark)}
        <div>${renderLines(bodyLines, isDark)}</div>
        ${
          input.action
            ? `<div style="margin:30px 0;text-align:center;">
                <a href="${escapeHtml(
                  input.action.url
                )}" style="display:inline-block;padding:14px 34px;border-radius:999px;background:${accent};color:#fff;font-weight:600;font-size:15px;text-decoration:none;transition:opacity 0.2s;">
                  ${escapeHtml(input.action.label)}
                </a>
              </div>`
            : ''
        }
        ${renderLines(outroLines, isDark)}
      </div>
      ${
        branding?.footerText
          ? `<div style="margin-top:18px;font-size:13px;color:${textSecondary};text-align:center;">${branding.footerText}</div>`
          : `<div style="margin-top:18px;font-size:13px;color:${textSecondary};text-align:center;">${footerMessage[locale]}</div>`
      }
    </div>
  </div>
  `.trim()

  return {
    subject: input.subject ?? '',
    html,
    text
  }
}

export const renderInvitationEmail = (input: InvitationTemplateInput): EmailContent => {
  const locale = normalizeLocale(input.locale)
  const copy: Record<EmailLocale, {
    subject: (org: string) => string
    pretitle: string
    intro: string
    invited: (invitedBy: string, org: string, role: string) => string
    expires: (date: string) => string
    action: string
    outro: string
  }> = {
    sv: {
      subject: (org) => `Inbjudan till ${org}`,
      pretitle: 'Inbjudan',
      intro: 'Hej!',
      invited: (invitedBy, org, role) =>
        `${invitedBy} har bjudit in dig till ${org} med rollen ${role}.`,
      expires: (date) => `Inbjudan är giltig till ${date}.`,
      action: 'Acceptera inbjudan',
      outro: 'Om du inte förväntade dig mejlet kan du ignorera det.'
    },
    en: {
      subject: (org) => `Invitation to ${org}`,
      pretitle: 'Invitation',
      intro: 'Hi!',
      invited: (invitedBy, org, role) =>
        `${invitedBy} has invited you to ${org} with the role ${role}.`,
      expires: (date) => `The invitation is valid until ${date}.`,
      action: 'Accept invitation',
      outro: 'If you were not expecting this email, you can ignore it.'
    }
  }

  const copyForLocale = copy[locale]
  const subject = copyForLocale.subject(input.organisationName)
  const base = renderBrandedTemplate(
    {
      locale,
      pretitle: copyForLocale.pretitle,
      title: input.organisationName,
      intro: copyForLocale.intro,
      body: [
        copyForLocale.invited(input.invitedBy, input.organisationName, input.role),
        copyForLocale.expires(input.expiresAt)
      ],
      action: { label: copyForLocale.action, url: input.acceptUrl },
      outro: [copyForLocale.outro]
    },
    input.branding
  )
  return { ...base, subject }
}

export const renderPasswordResetEmail = (input: PasswordResetTemplateInput): EmailContent => {
  const locale = normalizeLocale(input.locale)
  const copy: Record<EmailLocale, {
    subject: string
    pretitle: string
    title: string
    intro: string
    bodyReset: (expires: string) => string[]
    action: string
    outro: string
  }> = {
    sv: {
      subject: 'Återställ ditt lösenord',
      pretitle: 'Säkerhet',
      title: 'Återställ lösenord',
      intro: 'Hej!',
      bodyReset: (expires) => [
        'Vi tog emot en begäran om att återställa ditt lösenord.',
        `Länken är giltig till ${expires}.`
      ],
      action: 'Återställ lösenord',
      outro: 'Om du inte begärde detta kan du ignorera mejlet.'
    },
    en: {
      subject: 'Reset your password',
      pretitle: 'Security',
      title: 'Reset password',
      intro: 'Hi!',
      bodyReset: (expires) => [
        'We received a request to reset your password.',
        `The link is valid until ${expires}.`
      ],
      action: 'Reset password',
      outro: 'If you did not request this, you can ignore the email.'
    }
  }

  const copyForLocale = copy[locale]
  const subject = copyForLocale.subject
  const base = renderBrandedTemplate(
    {
      locale,
      pretitle: copyForLocale.pretitle,
      title: copyForLocale.title,
      intro: copyForLocale.intro,
      body: copyForLocale.bodyReset(input.expiresAt),
      action: { label: copyForLocale.action, url: input.resetUrl },
      outro: [copyForLocale.outro]
    },
    input.branding
  )
  return { ...base, subject }
}

export const buildTestEmail = (branding?: EmailBranding, locale: EmailLocale = 'sv'): EmailContent => {
  const selectedLocale = normalizeLocale(locale)
  const copy: Record<EmailLocale, {
    subject: string
    pretitle: string
    intro: string
    body: string[]
    outro: string[]
  }> = {
    sv: {
      subject: 'Testmail från Cloud Portal',
      pretitle: 'Testutskick',
      intro: 'Hej,',
      body: [
        'Detta är ett automatiskt testmeddelande som används för att verifiera att e-postkonfigurationen fungerar korrekt.',
        `Meddelandet skickades ${new Date().toLocaleString('sv-SE')}.`,
        'Om du kan läsa detta har testet lyckats och meddelanden kommer att levereras till dina användare på samma sätt (inklusive eventuell branding).'
      ],
      outro: [
        'Vänliga hälsningar'
      ]
    },
    en: {
      subject: 'Test email from Cloud Portal',
      pretitle: 'Test send',
      intro: 'Hi,',
      body: [
        'This is an automated test message used to verify that the email configuration works correctly.',
        `The message was sent ${new Date().toLocaleString('en-US')}.`,
        'If you can read this, the test succeeded and messages will be delivered to your users in the same way (including any branding).'
      ],
      outro: [
        'Best regards'
      ]
    }
  }

  const copyForLocale = copy[selectedLocale]

  return renderBrandedTemplate(
    {
      locale: selectedLocale,
      subject: copyForLocale.subject,
      pretitle: copyForLocale.pretitle,
      intro: copyForLocale.intro,
      body: copyForLocale.body,
      outro: copyForLocale.outro
    },
    branding
  )
}

