const DEFAULT_ACCENT = '#2563eb';
const DEFAULT_BACKGROUND = '#f7f9fc'; // Ljus bakgrund
const DEFAULT_TEXT = '#0f172a'; // Mörk text
const DEFAULT_CARD_BG = '#1e293b'; // Mörk kortbakgrund för logotyp-boxen (slate-800)
const DEFAULT_TEXT_SECONDARY = '#cbd5e1'; // Sekundär text (slate-300)
const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};
const escapeHtml = (value) => value.replace(/[&<>'"]/g, (char) => htmlEscapeMap[char]);
const stripHtml = (value) => value.replace(/<[^>]+>/g, '');
const normalizeColor = (value, fallback) => {
    if (!value)
        return fallback;
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : fallback;
};
const blendWithWhite = (hex, amount = 0.12) => {
    if (!/^#/.test(hex))
        return hex;
    const value = hex.slice(1);
    const expanded = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
    const num = parseInt(expanded, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const mix = (channel) => Math.round(channel + (255 - channel) * amount);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
};
const renderLines = (lines, isDark = false) => lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${isDark ? DEFAULT_TEXT_SECONDARY : '#0f172a'};">${escapeHtml(line)}</p>`)
    .join('');
const renderText = (intro, body, outro, action) => {
    const result = [...intro, ...body];
    if (action) {
        result.push(`${action.label}: ${action.url}`);
    }
    result.push(...outro);
    return result.filter(Boolean).join('\n\n');
};
export const renderBrandedTemplate = (input, branding) => {
    const accent = normalizeColor(branding?.accentColor, DEFAULT_ACCENT);
    const isDark = branding?.isDarkMode === true;
    // Bakgrunden på e-postet ändras baserat på dark mode
    const background = isDark ? '#0f172a' : DEFAULT_BACKGROUND;
    // Bakgrunden bakom loggan använder NavBar-färgen från brandingen
    const logoBackground = normalizeColor(branding?.logoBackgroundColor, isDark ? DEFAULT_CARD_BG : DEFAULT_BACKGROUND);
    const accentSoft = blendWithWhite(accent, 0.85);
    // Färger för dark mode
    const cardBackground = isDark ? '#1e293b' : '#fff';
    const textColor = isDark ? '#f1f5f9' : '#0f172a';
    const textSecondary = isDark ? '#cbd5e1' : '#475569';
    const borderColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.25)';
    const borderTopColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.08)';
    const introLines = input.intro ? [input.intro] : [];
    const bodyLines = input.body ?? [];
    const outroLines = input.outro ?? [];
    let text = renderText(introLines, bodyLines, outroLines, input.action);
    if (branding?.footerTextPlain) {
        text = `${text}\n\n${branding.footerTextPlain}`;
    }
    else if (branding?.footerText) {
        text = `${text}\n\n${stripHtml(branding.footerText)}`;
    }
    const html = `
  <div style="margin:0;padding:0;background:${background};font-family:'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="text-align:center;margin-bottom:16px;padding:12px 16px;background:${logoBackground};border-radius:12px;border:1px solid rgba(148,163,184,0.1);">
        ${branding?.logoUrl
        ? `<img src="${escapeHtml(branding.logoUrl)}" alt="Logo" style="max-width:150px;max-height:60px;width:auto;height:auto;display:block;margin:0 auto;" />`
        : `<span style="display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:10px;background:${accentSoft};color:${accent};font-weight:600;font-size:14px;">Cloud Portal</span>`}
      </div>
      <div style="background:${cardBackground};border-radius:28px;padding:40px 36px;box-shadow:0 20px 65px rgba(15,23,42,0.08);border:1px solid ${borderColor};">
        ${input.pretitle
        ? `<p style="margin:0 0 12px;text-transform:uppercase;letter-spacing:0.24em;font-size:12px;color:${accent};font-weight:600;">${escapeHtml(input.pretitle)}</p>`
        : ''}
        ${input.title
        ? `<h1 style="margin:0 0 16px;font-size:26px;color:${textColor};line-height:1.3;">${escapeHtml(input.title)}</h1>`
        : ''}
        ${renderLines(introLines, isDark)}
        <div>${renderLines(bodyLines, isDark)}</div>
        ${input.action
        ? `<div style="margin:30px 0;text-align:center;">
                <a href="${escapeHtml(input.action.url)}" style="display:inline-block;padding:14px 34px;border-radius:999px;background:${accent};color:#fff;font-weight:600;font-size:15px;text-decoration:none;transition:opacity 0.2s;">
                  ${escapeHtml(input.action.label)}
                </a>
              </div>`
        : ''}
        ${renderLines(outroLines, isDark)}
        ${branding?.footerText
        ? `<div style="margin-top:36px;padding-top:20px;border-top:1px solid ${borderTopColor};font-size:13px;color:${textSecondary};">${branding.footerText}</div>`
        : ''}
      </div>
      <p style="text-align:center;font-size:12px;color:#94a3b8;margin-top:20px;">Det här meddelandet skickades automatiskt – svara bara om du behöver hjälp.</p>
    </div>
  </div>
  `.trim();
    return {
        subject: input.subject ?? '',
        html,
        text
    };
};
export const renderInvitationEmail = (input) => {
    const subject = `Inbjudan till ${input.organisationName}`;
    const base = renderBrandedTemplate({
        pretitle: 'Inbjudan',
        title: input.organisationName,
        intro: 'Hej!',
        body: [
            `${input.invitedBy} har bjudit in dig till ${input.organisationName} med rollen ${input.role}.`,
            `Inbjudan är giltig till ${input.expiresAt}.`
        ],
        action: { label: 'Acceptera inbjudan', url: input.acceptUrl },
        outro: ['Om du inte förväntade dig mejlet kan du ignorera det.']
    }, input.branding);
    return { ...base, subject };
};
export const renderPasswordResetEmail = (input) => {
    const subject = 'Återställ ditt lösenord';
    const base = renderBrandedTemplate({
        pretitle: 'Säkerhet',
        title: 'Återställ lösenord',
        intro: 'Hej!',
        body: [
            'Vi tog emot en begäran om att återställa ditt lösenord.',
            `Länken är giltig till ${input.expiresAt}.`
        ],
        action: { label: 'Återställ lösenord', url: input.resetUrl },
        outro: ['Om du inte begärde detta kan du ignorera mejlet.']
    }, input.branding);
    return { ...base, subject };
};
