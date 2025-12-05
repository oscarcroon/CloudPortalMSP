export type EmailProviderType = 'smtp' | 'graph';
export interface EmailRecipient {
    email: string;
    name?: string;
}
export interface EmailBranding {
    logoUrl?: string;
    accentColor?: string;
    backgroundColor?: string;
    logoBackgroundColor?: string;
    isDarkMode?: boolean;
    footerText?: string;
    footerTextPlain?: string;
}
export interface EmailContent {
    subject: string;
    html: string;
    text: string;
}
export interface EmailTemplateInput {
    subject?: string;
    pretitle?: string;
    title?: string;
    intro?: string;
    body: string[];
    action?: {
        label: string;
        url: string;
    };
    outro?: string[];
}
export interface InvitationTemplateInput {
    organisationName: string;
    invitedBy: string;
    role: string;
    expiresAt: string;
    acceptUrl: string;
    branding?: EmailBranding;
}
export interface PasswordResetTemplateInput {
    resetUrl: string;
    expiresAt: string;
    branding?: EmailBranding;
}
export interface SmtpAuthConfig {
    user: string;
    pass: string;
}
export interface SmtpConfig {
    host: string;
    port: number;
    secure?: boolean;
    auth?: SmtpAuthConfig | null;
    ignoreTls?: boolean;
}
export interface GraphConfig {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    fromEmail: string;
    scope?: string;
    endpoint?: string;
    senderUserId?: string;
}
export type ProviderSecrets = {
    type: 'smtp';
    config: SmtpConfig;
} | {
    type: 'graph';
    config: GraphConfig;
};
export type EmailProviderProfile = ProviderSecrets & {
    fromEmail: string;
    fromName?: string;
    replyToEmail?: string;
    branding?: EmailBranding;
};
export interface SendTemplatedEmailOptions {
    profile: EmailProviderProfile;
    to: EmailRecipient | EmailRecipient[];
    content: EmailContent;
    dryRunOutboxDir?: string;
    logger?: EmailLogger;
}
export interface OutboxMessage {
    to: EmailRecipient[];
    subject: string;
    html: string;
    text: string;
    meta?: Record<string, unknown>;
}
export type EmailLogger = (event: EmailLogEvent) => void;
export interface EmailLogEvent {
    level: 'info' | 'warn' | 'error';
    message: string;
    context?: Record<string, unknown>;
}
export interface EncryptedPayload {
    cipherText: string;
    iv: string;
    authTag: string;
}
//# sourceMappingURL=types.d.ts.map