import type { EncryptedPayload } from './types.js';
export declare class EmailCryptoError extends Error {
    constructor(message: string);
}
export declare function encryptConfig<T>(value: T, secret: string): EncryptedPayload;
export declare function decryptConfig<T>(payload: EncryptedPayload, secret: string): T;
//# sourceMappingURL=crypto.d.ts.map