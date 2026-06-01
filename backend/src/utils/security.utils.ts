import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Decrypts data that was encrypted with a shared secret.
 * The format expected is "iv:encryptedData"
 */
export const decrypt = (text: string): string => {
    try {
        const secretKey = process.env.SECURE_ENCRYPTION_KEY;
        if (!secretKey || secretKey.length !== 32) {
            throw new Error('SECURE_ENCRYPTION_KEY must be 32 characters long');
        }

        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift()!, 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(secretKey), iv);
        
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted.toString();
    } catch (error) {
        console.error('Decryption failed:', error);
        throw new Error('Failed to decrypt data');
    }
};

/**
 * Encrypts data with a shared secret (useful for testing or backend-to-backend)
 */
export const encrypt = (text: string): string => {
    const secretKey = process.env.SECURE_ENCRYPTION_KEY!;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(secretKey), iv);
    
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};
