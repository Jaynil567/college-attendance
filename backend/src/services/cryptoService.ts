import crypto from 'crypto';
import { ENV } from '../config/env.js';
import { query } from '../config/db.js';

export interface VerificationPayload {
  challenge: string;          // 32-byte hex string (64 characters)
  studentEnrollment: string;  // e.g. "EN2024CS001"
  timestamp: number;          // Epoch timestamp in milliseconds
  esp32Id: string;            // e.g. "CLASSROOM_01"
}

export interface VerificationResult {
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export class CryptoService {
  /**
   * Generates a 32-byte cryptographically secure random challenge (64 hex characters)
   */
  static generateChallenge(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates a 256-bit (32-byte) hex secret key for an ESP32 device
   */
  static generateDeviceSecretKey(): string {
    return crypto.randomBytes(32).toString('hex').toUpperCase();
  }

  /**
   * Builds the canonical payload string to be signed by ESP32 and verified by Backend
   * Format: challenge:studentEnrollment:timestamp:esp32Id
   */
  static buildCanonicalPayload(data: VerificationPayload): string {
    return `${data.challenge.toLowerCase()}:${data.studentEnrollment.trim().toUpperCase()}:${data.timestamp}:${data.esp32Id.trim().toUpperCase()}`;
  }

  /**
   * Computes HMAC-SHA256 over canonical payload using the ESP32's 256-bit secret key
   * Exactly matches ESP32 mbedtls_md_hmac implementation
   */
  static computeHmac(secretKeyHex: string, canonicalPayload: string): string {
    const keyBuffer = Buffer.from(secretKeyHex, 'hex');
    const hmac = crypto.createHmac('sha256', keyBuffer);
    hmac.update(Buffer.from(canonicalPayload, 'utf-8'));
    return hmac.digest('hex').toLowerCase();
  }

  /**
   * Timing-safe verification of ESP32 HMAC response
   */
  static verifyHmacSignature(
    secretKeyHex: string,
    payload: VerificationPayload,
    receivedSignatureHex: string
  ): boolean {
    try {
      const canonicalPayload = this.buildCanonicalPayload(payload);
      const expectedSignatureHex = this.computeHmac(secretKeyHex, canonicalPayload);

      const expectedBuf = Buffer.from(expectedSignatureHex, 'hex');
      const receivedBuf = Buffer.from(receivedSignatureHex.toLowerCase(), 'hex');

      if (expectedBuf.length !== receivedBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, receivedBuf);
    } catch (err) {
      console.error('[CryptoService] HMAC verification error:', err);
      return false;
    }
  }

  /**
   * Verifies that the client timestamp is fresh within allowed clock drift
   */
  static verifyTimestampFreshness(clientTimestampMs: number): { isFresh: boolean; driftSeconds: number } {
    const nowMs = Date.now();
    const driftSeconds = Math.abs(nowMs - clientTimestampMs) / 1000;
    const isFresh = driftSeconds <= ENV.MAX_CLOCK_DRIFT_SECONDS;
    return { isFresh, driftSeconds };
  }

  /**
   * Checks for replay attacks by ensuring challenge nonce is used at most once
   */
  static async verifyAndConsumeNonce(
    nonce: string,
    studentId: string,
    esp32Id: string
  ): Promise<{ valid: boolean; reason?: string }> {
    const cleanNonce = nonce.trim().toLowerCase();

    // Check if nonce was already registered / used
    const existing = await query('SELECT id, used_at FROM challenge_nonces WHERE nonce = $1', [cleanNonce]);
    if (existing.rows && existing.rows.length > 0) {
      return {
        valid: false,
        reason: 'REPLAY_ATTACK_DETECTED: Challenge nonce has already been utilized.',
      };
    }

    // Register nonce as consumed
    const expiresAt = new Date(Date.now() + ENV.CHALLENGE_EXPIRY_SECONDS * 1000);
    await query(
      `INSERT INTO challenge_nonces (id, nonce, student_id, esp32_id, used_at, expires_at)
       VALUES ($1, $2, $3, $4, NOW(), $5)`,
      [crypto.randomUUID(), cleanNonce, studentId, esp32Id, expiresAt]
    );

    return { valid: true };
  }

  /**
   * Comprehensive verification pipeline for attendance marking
   */
  static async verifyAttendanceProof(params: {
    studentId: string;
    studentEnrollment: string;
    esp32Id: string;
    esp32SecretKeyHex: string;
    challenge: string;
    signature: string;
    timestamp: number;
    rssi: number;
  }): Promise<VerificationResult> {
    // 1. Proximity RSSI verification
    if (params.rssi < ENV.MIN_RSSI_DBM) {
      return {
        isValid: false,
        errorCode: 'WEAK_BLE_SIGNAL',
        errorMessage: `BLE signal strength (${params.rssi} dBm) is weaker than classroom threshold (${ENV.MIN_RSSI_DBM} dBm). You must be physically inside the room.`,
      };
    }

    // 2. Timestamp freshness check
    const { isFresh, driftSeconds } = this.verifyTimestampFreshness(params.timestamp);
    if (!isFresh) {
      return {
        isValid: false,
        errorCode: 'STALE_TIMESTAMP',
        errorMessage: `Timestamp drift of ${Math.round(driftSeconds)}s exceeds maximum allowed limit (${ENV.MAX_CLOCK_DRIFT_SECONDS}s). Ensure your device clock is synchronized.`,
      };
    }

    // 3. Challenge nonce length check
    if (!params.challenge || params.challenge.length < 32) {
      return {
        isValid: false,
        errorCode: 'INVALID_CHALLENGE',
        errorMessage: 'Challenge nonce must be a valid 32-byte cryptographic random token.',
      };
    }

    // 4. Replay attack defense check
    const nonceCheck = await this.verifyAndConsumeNonce(params.challenge, params.studentId, params.esp32Id);
    if (!nonceCheck.valid) {
      return {
        isValid: false,
        errorCode: 'REPLAY_ATTACK_DETECTED',
        errorMessage: nonceCheck.reason || 'Cryptographic nonce has already been used.',
      };
    }

    // 5. Cryptographic HMAC verification
    const isValidSignature = this.verifyHmacSignature(
      params.esp32SecretKeyHex,
      {
        challenge: params.challenge,
        studentEnrollment: params.studentEnrollment,
        timestamp: params.timestamp,
        esp32Id: params.esp32Id,
      },
      params.signature
    );

    if (!isValidSignature) {
      return {
        isValid: false,
        errorCode: 'INVALID_ESP32_SIGNATURE',
        errorMessage: 'ESP32 cryptographic response verification failed. Device signature does not match classroom key.',
      };
    }

    return { isValid: true };
  }
}
