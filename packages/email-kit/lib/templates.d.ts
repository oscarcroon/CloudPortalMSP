import type { EmailBranding, EmailContent, EmailTemplateInput, InvitationTemplateInput, PasswordResetTemplateInput } from './types.js';
export declare const renderBrandedTemplate: (input: EmailTemplateInput, branding?: EmailBranding) => EmailContent;
export declare const renderInvitationEmail: (input: InvitationTemplateInput) => EmailContent;
export declare const renderPasswordResetEmail: (input: PasswordResetTemplateInput) => EmailContent;
//# sourceMappingURL=templates.d.ts.map