import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get the encryption key from environment variables.
 * The key should be a 32-byte hex string (64 characters).
 */
function getEncryptionKey(): Buffer {
    const key = process.env.CMS_ENCRYPTION_KEY;

    if (!key) {
        throw new Error('CMS_ENCRYPTION_KEY environment variable is not set');
    }

    // If key is hex-encoded (64 chars = 32 bytes)
    if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
        return Buffer.from(key, 'hex');
    }

    // If key is raw string, derive a key from it
    if (key.length >= 32) {
        return crypto.scryptSync(key, 'bt-cms-salt', 32);
    }

    throw new Error('CMS_ENCRYPTION_KEY must be at least 32 characters or a 64-char hex string');
}

/**
 * Encrypt a string value using AES-256-GCM.
 * Returns a base64-encoded string containing: salt + iv + authTag + ciphertext
 */
export function encrypt(value: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key with salt for extra security
    const derivedKey = crypto.scryptSync(key, salt, 32);

    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Combine: salt (32) + iv (16) + authTag (16) + ciphertext
    const combined = Buffer.concat([
        salt,
        iv,
        authTag,
        Buffer.from(encrypted, 'hex')
    ]);

    return combined.toString('base64');
}

/**
 * Decrypt a value that was encrypted with the encrypt function.
 */
export function decrypt(encryptedValue: string): string {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedValue, 'base64');

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    // Derive key with same salt
    const derivedKey = crypto.scryptSync(key, salt, 32);

    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
}

/**
 * Generate a secure random API key with a given prefix.
 * Format: prefix + random alphanumeric string (total ~40 chars)
 */
export function generateApiKey(prefix: 'bt_live_' | 'bt_test_' = 'bt_live_'): string {
    const randomBytes = crypto.randomBytes(24);
    const randomPart = randomBytes.toString('base64url').replace(/[_-]/g, '').substring(0, 32);
    return `${prefix}${randomPart}`;
}

/**
 * Generate a secure webhook secret.
 * Format: whsec_ + random alphanumeric string
 */
export function generateWebhookSecret(): string {
    const randomBytes = crypto.randomBytes(32);
    const randomPart = randomBytes.toString('base64url').replace(/[_-]/g, '').substring(0, 32);
    return `whsec_${randomPart}`;
}

/**
 * Verify an HMAC-SHA256 signature for webhook payloads.
 */
export function verifyWebhookSignature(
    payload: string,
    signature: string | null,
    secret: string
): boolean {
    if (!signature) return false;

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    // Remove 'sha256=' prefix if present
    const receivedSignature = signature.replace('sha256=', '');

    try {
        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(receivedSignature)
        );
    } catch {
        return false;
    }
}

/**
 * Create an HMAC-SHA256 signature for outgoing webhook payloads.
 */
export function createWebhookSignature(payload: string, secret: string): string {
    return 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
}
