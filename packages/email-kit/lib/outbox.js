import fs from 'node:fs';
import path from 'node:path';
const DEFAULT_OUTBOX = path.resolve(process.cwd(), 'uploads', 'outbox');
const slugify = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'email';
export const writeOutboxPreview = async (message, dir = DEFAULT_OUTBOX) => {
    await fs.promises.mkdir(dir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${slugify(message.subject)}-${timestamp}.txt`;
    const filePath = path.join(dir, filename);
    const recipients = message.to
        .map((recipient) => recipient.email)
        .join(', ');
    const content = [
        `To: ${recipients}`,
        `Subject: ${message.subject}`,
        '',
        '--- TEXT ----------------------------------------------------------------',
        message.text,
        '',
        '--- HTML ----------------------------------------------------------------',
        message.html,
        '',
        message.meta ? JSON.stringify(message.meta, null, 2) : ''
    ].join('\n');
    await fs.promises.writeFile(filePath, content, 'utf8');
    return filePath;
};
