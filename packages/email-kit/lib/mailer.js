import { writeOutboxPreview } from './outbox.js';
import { renderInvitationEmail, renderPasswordResetEmail } from './templates.js';
import { sendViaGraph, sendViaSmtp } from './transport.js';
const toArray = (value) => Array.isArray(value) ? value : [value];
const logSafeError = (error) => error instanceof Error ? { message: error.message, name: error.name } : { message: String(error) };
export const sendTemplatedEmail = async (options) => {
    const recipients = toArray(options.to);
    const { profile, content, dryRunOutboxDir, logger } = options;
    const deliver = async () => {
        if (profile.type === 'smtp') {
            await sendViaSmtp(profile, recipients, content.subject, content.html, content.text);
            return 'smtp';
        }
        await sendViaGraph(profile, recipients, content.subject, content.html, content.text);
        return 'graph';
    };
    try {
        const channel = await deliver();
        logger?.({
            level: 'info',
            message: `E-post skickades via ${channel}.`,
            context: { providerType: profile.type }
        });
        return { delivered: true, channel };
    }
    catch (error) {
        logger?.({
            level: 'error',
            message: 'E-postutskick misslyckades.',
            context: { providerType: profile.type, error: logSafeError(error) }
        });
        if (dryRunOutboxDir) {
            const storedAt = await writeOutboxPreview({
                to: recipients,
                subject: content.subject,
                html: content.html,
                text: content.text,
                meta: { providerType: profile.type, fallback: true, error: logSafeError(error) }
            }, dryRunOutboxDir);
            return { delivered: false, storedAt };
        }
        throw error;
    }
};
export const buildInvitationEmail = (input) => {
    return renderInvitationEmail(input);
};
export const buildPasswordResetEmail = (input) => {
    return renderPasswordResetEmail(input);
};
