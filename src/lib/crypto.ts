import crypto from 'crypto';

/**
 * ============================================
 * GUVENLIK: AES-256-GCM Sifreleme
 * OWASP ve NIST Standartlarına Uygun
 * ============================================
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;       // 128 bit IV (NIST onerisi)
const SALT_LENGTH = 64;     // 512 bit salt
const TAG_LENGTH = 16;      // 128 bit auth tag
const KEY_LENGTH = 32;      // 256 bit key
const PBKDF2_ITERATIONS = 100000; // OWASP onerisi: min 100k

// Get key from env or fallback (INSECURE FALLBACK FOR DEV ONLY)
// Production'da ENCRYPTION_KEY mutlaka set edilmeli!
const secretKeyRaw = process.env.ENCRYPTION_KEY;

if (!secretKeyRaw) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('[CRITICAL SECURITY] ENCRYPTION_KEY is not set in production!');
    }
    console.warn('[SECURITY WARNING] ENCRYPTION_KEY is not set - using insecure fallback for development only');
}

// Fallback sadece development icin (sabit key = restart'lar arasi tutarli)
const keySource = secretKeyRaw || 'dev-only-insecure-key-not-for-production';

// GUVENLIK: PBKDF2 ile key derivation (SHA-512)
// Bu, brute-force saldırılarına karşı koruma sağlar
const MASTER_SALT = crypto.createHash('sha256').update('smmm-asistan-master-salt-v1').digest();
const SECRET_KEY = crypto.pbkdf2Sync(
    keySource,
    MASTER_SALT,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha512'
);

/**
 * Encrypts text using AES-256-GCM
 * GUVENLIK: Her sifreleme icin benzersiz IV kullanilir
 */
export function encrypt(text: string): string {
    // GUVENLIK: Her sifreleme icin cryptographically secure random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher with derived key
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);

    // Encrypt
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag (tamper protection)
    const tag = cipher.getAuthTag();

    // Return as JSON string containing all parts
    // Format: { iv, content, tag, v } - v = version for future migrations
    return JSON.stringify({
        v: 2, // Version 2: PBKDF2 key derivation
        iv: iv.toString('hex'),
        content: encrypted,
        tag: tag.toString('hex')
    });
}

/**
 * Decrypts text using AES-256-GCM
 * GUVENLIK: Auth tag dogrulamasi ile tamper detection
 */
export function decrypt(encryptedJson: string): string {
    try {
        const parsed = JSON.parse(encryptedJson);
        const { iv, content, tag } = parsed;

        // GUVENLIK: Gerekli alanlarin varligini kontrol et
        if (!iv || !content || !tag) {
            throw new Error('Invalid encrypted data structure');
        }

        const decipher = crypto.createDecipheriv(
            ALGORITHM,
            SECRET_KEY,
            Buffer.from(iv, 'hex')
        );

        // GUVENLIK: Auth tag ile veri butunlugu dogrulamasi
        decipher.setAuthTag(Buffer.from(tag, 'hex'));

        let decrypted = decipher.update(content, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        // GUVENLIK: Hata detaylarini client'a gosterme
        console.error('[Crypto] Decryption failed - possible tampering or wrong key');
        throw new Error('Decryption failed');
    }
}

/**
 * Hash sensitive data for comparison (one-way)
 * Kullanim: Duplicate kontrolu, arama vb.
 */
export function hashForComparison(text: string): string {
    return crypto
        .createHmac('sha256', SECRET_KEY)
        .update(text)
        .digest('hex');
}

/**
 * Mask sensitive data for display
 * Ornek: "12345678901" -> "123****8901"
 */
export function maskSensitiveData(text: string, visibleStart = 3, visibleEnd = 4): string {
    if (!text || text.length <= visibleStart + visibleEnd) {
        return '*'.repeat(text?.length || 0);
    }
    const start = text.substring(0, visibleStart);
    const end = text.substring(text.length - visibleEnd);
    const middle = '*'.repeat(Math.min(text.length - visibleStart - visibleEnd, 8));
    return `${start}${middle}${end}`;
}
