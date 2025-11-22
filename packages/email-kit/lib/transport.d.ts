import type { EmailProviderProfile, EmailRecipient } from './types.js';
export declare const sendViaSmtp: (profile: EmailProviderProfile, recipients: EmailRecipient[], subject: string, html: string, text: string) => Promise<import("nodemailer/lib/smtp-transport/index.js").SentMessageInfo>;
export declare const sendViaGraph: (profile: EmailProviderProfile, recipients: EmailRecipient[], subject: string, html: string, text: string) => Promise<{
    ok: boolean;
    message: string;
}>;
//# sourceMappingURL=transport.d.ts.map