/**
 * Encryption utility for sensitive data like API keys
 * Uses AES-256-GCM for symmetric encryption
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment variable
 * This should be a 32-byte hex string (64 characters)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a string value
 * Returns base64 encoded string: salt:iv:tag:encrypted
 */
export function encrypt(text: string): string {
  try {
    const masterKey = getEncryptionKey();

    // Generate random salt for key derivation
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key from master key and salt
    const key = crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get auth tag
    const tag = cipher.getAuthTag();

    // Combine all parts: salt:iv:tag:encrypted
    const combined = [
      salt.toString('base64'),
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted
    ].join(':');

    return combined;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt an encrypted string
 * Expects format: salt:iv:tag:encrypted (base64 encoded parts)
 */
export function decrypt(encryptedText: string): string {
  try {
    const masterKey = getEncryptionKey();

    // Split the combined string
    const parts = encryptedText.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }

    const [saltB64, ivB64, tagB64, encrypted] = parts;

    // Decode from base64
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');

    // Derive the same key
    const key = crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Check if a string is encrypted (has the expected format)
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  const parts = text.split(':');
  return parts.length === 4;
}

/**
 * Safely encrypt API key if not already encrypted
 */
export function encryptIfNeeded(apiKey: string | null | undefined): string | null {
  if (!apiKey) return null;
  if (isEncrypted(apiKey)) return apiKey;
  return encrypt(apiKey);
}

/**
 * Safely decrypt API key if encrypted
 */
export function decryptIfNeeded(apiKey: string | null | undefined): string | null {
  if (!apiKey) return null;
  if (!isEncrypted(apiKey)) return apiKey; // Return as-is if not encrypted (for migration)
  return decrypt(apiKey);
}

/**
 * Generate a new encryption key (for setup)
 * Run this once and store in .env as ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
