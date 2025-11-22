import { ClientSecretCredential } from '@azure/identity';
import nodemailer from 'nodemailer';
const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const GRAPH_ENDPOINT = 'https://graph.microsoft.com/v1.0';
const credentialCache = new Map();
const getCredential = (tenantId, clientId, clientSecret) => {
    const key = `${tenantId}:${clientId}:${clientSecret}`;
    if (!credentialCache.has(key)) {
        credentialCache.set(key, new ClientSecretCredential(tenantId, clientId, clientSecret));
    }
    return credentialCache.get(key);
};
const formatAddress = (email, name) => (name ? `${name} <${email}>` : email);
const recipientsToString = (recipients) => recipients.map((recipient) => formatAddress(recipient.email, recipient.name)).join(', ');
export const sendViaSmtp = async (profile, recipients, subject, html, text) => {
    if (profile.type !== 'smtp') {
        throw new Error('SMTP profile required.');
    }
    const transporter = nodemailer.createTransport({
        host: profile.config.host,
        port: profile.config.port,
        secure: profile.config.secure ?? profile.config.port === 465,
        auth: profile.config.auth ?? undefined,
        tls: profile.config.ignoreTls ? { rejectUnauthorized: false } : undefined
    });
    return transporter.sendMail({
        from: formatAddress(profile.fromEmail, profile.fromName),
        to: recipientsToString(recipients),
        subject,
        html,
        text,
        replyTo: profile.replyToEmail ?? profile.fromEmail
    });
};
export const sendViaGraph = async (profile, recipients, subject, html, text) => {
    if (profile.type !== 'graph') {
        throw new Error('Graph profile required.');
    }
    const { tenantId, clientId, clientSecret, fromEmail, senderUserId } = profile.config;
    const scope = profile.config.scope ?? GRAPH_SCOPE;
    const endpoint = (profile.config.endpoint ?? GRAPH_ENDPOINT).replace(/\/$/, '');
    const credential = getCredential(tenantId, clientId, clientSecret);
    const token = await credential.getToken(scope);
    if (!token?.token) {
        throw new Error('Kunde inte hämta Graph-token.');
    }
    const sendUrl = `${endpoint}/users/${encodeURIComponent(senderUserId ?? fromEmail)}/sendMail`;
    const payload = {
        message: {
            subject,
            body: {
                contentType: 'HTML',
                content: html
            },
            toRecipients: recipients.map((recipient) => ({
                emailAddress: {
                    address: recipient.email,
                    name: recipient.name ?? recipient.email
                }
            })),
            replyTo: profile.replyToEmail
                ? [
                    {
                        emailAddress: {
                            address: profile.replyToEmail,
                            name: profile.fromName ?? profile.replyToEmail
                        }
                    }
                ]
                : undefined
        },
        saveToSentItems: false
    };
    const response = await fetch(sendUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Graph sendMail misslyckades: ${response.status} ${errorText}`);
    }
    return { ok: true, message: 'graph' };
};
