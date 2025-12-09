import type { EmailContent, InvitationTemplateInput, PasswordResetTemplateInput, SendTemplatedEmailOptions } from './types.js';
export declare const sendTemplatedEmail: (options: SendTemplatedEmailOptions) => Promise<{
    delivered: boolean;
    channel: string;
    storedAt?: undefined;
} | {
    delivered: boolean;
    storedAt: string;
    channel?: undefined;
}>;
export declare const buildInvitationEmail: (input: InvitationTemplateInput) => EmailContent;
export declare const buildPasswordResetEmail: (input: PasswordResetTemplateInput) => EmailContent;
//# sourceMappingURL=mailer.d.ts.map