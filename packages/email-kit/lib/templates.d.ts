import type { EmailBranding, EmailContent, EmailTemplateInput, EmailLocale, InvitationTemplateInput, PasswordResetTemplateInput } from './types.js';
export declare const renderBrandedTemplate: (input: EmailTemplateInput, branding?: EmailBranding) => EmailContent;
export declare const renderInvitationEmail: (input: InvitationTemplateInput) => EmailContent;
export declare const renderPasswordResetEmail: (input: PasswordResetTemplateInput) => EmailContent;
export declare const buildTestEmail: (branding?: EmailBranding, locale?: EmailLocale) => EmailContent;
//# sourceMappingURL=templates.d.ts.map