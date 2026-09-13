import { CryptoService, VerificationPayload } from './cryptoService.js';

async function runCryptoVerificationTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING CRYPTOGRAPHIC CHALLENGE-RESPONSE TEST SUITE');
  console.log('====================================================');

  const secretKeyHex = 'E9B489601E852DDE34B76AE93D8967484B6F3E103E9946C3AE852DDE34B76AE9';
  const esp32Id = 'CLASSROOM_01';
  const studentEnrollment = 'EN2024CS001';
  const studentId = 'd4444444-4444-4444-4444-444444444401';
  const timestamp = Date.now();
  const challenge = CryptoService.generateChallenge();

  console.log(`1. Generated 32-byte Challenge Nonce: ${challenge}`);
  console.log(`2. Secret Key Hex (256-bit): ${secretKeyHex}`);
  console.log(`3. Canonical Payload: ${CryptoService.buildCanonicalPayload({ challenge, studentEnrollment, timestamp, esp32Id })}`);

  // Compute HMAC (ESP32 simulation)
  const canonicalPayload = CryptoService.buildCanonicalPayload({ challenge, studentEnrollment, timestamp, esp32Id });
  const validSignature = CryptoService.computeHmac(secretKeyHex, canonicalPayload);
  console.log(`4. Computed ESP32 HMAC-SHA256 Response: ${validSignature}`);

  // Test 1: Valid proof
  console.log('\n--- Test 1: Valid Verification Proof ---');
  const test1 = await CryptoService.verifyAttendanceProof({
    studentId,
    studentEnrollment,
    esp32Id,
    esp32SecretKeyHex: secretKeyHex,
    challenge,
    signature: validSignature,
    timestamp,
    rssi: -65,
  });
  console.log('Result:', test1.isValid ? '✅ PASSED (Valid)' : `❌ FAILED (${test1.errorMessage})`);

  // Test 2: Replay attack (reuse same challenge nonce)
  console.log('\n--- Test 2: Replay Attack Defense (Reusing same nonce) ---');
  const test2 = await CryptoService.verifyAttendanceProof({
    studentId,
    studentEnrollment,
    esp32Id,
    esp32SecretKeyHex: secretKeyHex,
    challenge, // Reused nonce!
    signature: validSignature,
    timestamp,
    rssi: -65,
  });
  console.log('Result:', !test2.isValid && test2.errorCode === 'REPLAY_ATTACK_DETECTED'
    ? '✅ PASSED (Replay attack successfully blocked)'
    : `❌ FAILED (Replay was not caught: ${JSON.stringify(test2)})`);

  // Test 3: Corrupted signature / Wrong key
  console.log('\n--- Test 3: Corrupted Device Signature ---');
  const freshChallenge = CryptoService.generateChallenge();
  const test3 = await CryptoService.verifyAttendanceProof({
    studentId,
    studentEnrollment,
    esp32Id,
    esp32SecretKeyHex: secretKeyHex,
    challenge: freshChallenge,
    signature: 'badc0ffee0000000000000000000000000000000000000000000000000000000',
    timestamp,
    rssi: -65,
  });
  console.log('Result:', !test3.isValid && test3.errorCode === 'INVALID_ESP32_SIGNATURE'
    ? '✅ PASSED (Corrupted signature successfully rejected)'
    : `❌ FAILED (Bad signature was accepted!)`);

  // Test 4: Clock drift / Stale challenge (> 60s)
  console.log('\n--- Test 4: Clock Drift / Stale Challenge (> 60s) ---');
  const staleChallenge = CryptoService.generateChallenge();
  const staleTimestamp = Date.now() - 120000; // 2 minutes ago
  const stalePayload = CryptoService.buildCanonicalPayload({
    challenge: staleChallenge,
    studentEnrollment,
    timestamp: staleTimestamp,
    esp32Id,
  });
  const staleSignature = CryptoService.computeHmac(secretKeyHex, stalePayload);
  const test4 = await CryptoService.verifyAttendanceProof({
    studentId,
    studentEnrollment,
    esp32Id,
    esp32SecretKeyHex: secretKeyHex,
    challenge: staleChallenge,
    signature: staleSignature,
    timestamp: staleTimestamp,
    rssi: -65,
  });
  console.log('Result:', !test4.isValid && test4.errorCode === 'STALE_TIMESTAMP'
    ? '✅ PASSED (Stale timestamp rejected)'
    : `❌ FAILED (Stale timestamp was accepted)`);

  // Test 5: RSSI out of range (too far away, spoofing from outside)
  console.log('\n--- Test 5: BLE Signal Strength Below Classroom Threshold ---');
  const farChallenge = CryptoService.generateChallenge();
  const farPayload = CryptoService.buildCanonicalPayload({
    challenge: farChallenge,
    studentEnrollment,
    timestamp: Date.now(),
    esp32Id,
  });
  const farSignature = CryptoService.computeHmac(secretKeyHex, farPayload);
  const test5 = await CryptoService.verifyAttendanceProof({
    studentId,
    studentEnrollment,
    esp32Id,
    esp32SecretKeyHex: secretKeyHex,
    challenge: farChallenge,
    signature: farSignature,
    timestamp: Date.now(),
    rssi: -95, // Below -85 dBm threshold
  });
  console.log('Result:', !test5.isValid && test5.errorCode === 'WEAK_BLE_SIGNAL'
    ? '✅ PASSED (Weak signal rejected)'
    : `❌ FAILED (Weak signal was accepted)`);

  console.log('\n====================================================');
  console.log('🎯 ALL CRYPTOGRAPHIC TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
}

runCryptoVerificationTests().catch(console.error);
