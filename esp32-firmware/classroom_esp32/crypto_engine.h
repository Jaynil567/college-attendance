#ifndef CRYPTO_ENGINE_H
#define CRYPTO_ENGINE_H

#include <Arduino.h>
#include "mbedtls/md.h"
#include <string.h>

class CryptoEngine {
public:
  /**
   * Converts a hexadecimal string into raw bytes
   */
  static bool hexToBytes(const char* hex, uint8_t* bytes, size_t maxBytes) {
    size_t hexLen = strlen(hex);
    if (hexLen % 2 != 0 || hexLen / 2 > maxBytes) {
      return false;
    }
    for (size_t i = 0; i < hexLen; i += 2) {
      char byteStr[3] = { hex[i], hex[i + 1], '\0' };
      bytes[i / 2] = (uint8_t)strtol(byteStr, NULL, 16);
    }
    return true;
  }

  /**
   * Converts raw byte buffer into a lowercase hex string
   */
  static void bytesToHex(const uint8_t* bytes, size_t len, char* hexOutput) {
    for (size_t i = 0; i < len; i++) {
      sprintf(hexOutput + (i * 2), "%02x", bytes[i]);
    }
    hexOutput[len * 2] = '\0';
  }

  /**
   * Hardware-accelerated HMAC-SHA256 calculation using ESP32 mbedTLS
   * @param secretKeyHex 64-character hex secret key (256-bit)
   * @param payload Canonical string payload: challenge:studentEnrollment:timestamp:esp32Id
   * @param outputHexBuffer Buffer of at least 65 bytes for null-terminated 64-char hex response
   * @return true if HMAC successfully computed
   */
  static bool computeHmac(const char* secretKeyHex, const char* payload, char* outputHexBuffer) {
    uint8_t keyBytes[32];
    if (!hexToBytes(secretKeyHex, keyBytes, sizeof(keyBytes))) {
      Serial.println("[Crypto] Error: Invalid secret key hex string length or format.");
      return false;
    }

    uint8_t hmacResult[32];
    mbedtls_md_context_t ctx;
    mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

    mbedtls_md_init(&ctx);

    int ret = mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
    if (ret != 0) {
      Serial.printf("[Crypto] mbedTLS setup failed: %d\n", ret);
      mbedtls_md_free(&ctx);
      return false;
    }

    ret = mbedtls_md_hmac_starts(&ctx, keyBytes, sizeof(keyBytes));
    if (ret != 0) {
      Serial.printf("[Crypto] mbedTLS hmac_starts failed: %d\n", ret);
      mbedtls_md_free(&ctx);
      return false;
    }

    ret = mbedtls_md_hmac_update(&ctx, (const unsigned char*)payload, strlen(payload));
    if (ret != 0) {
      Serial.printf("[Crypto] mbedTLS hmac_update failed: %d\n", ret);
      mbedtls_md_free(&ctx);
      return false;
    }

    ret = mbedtls_md_hmac_finish(&ctx, hmacResult);
    if (ret != 0) {
      Serial.printf("[Crypto] mbedTLS hmac_finish failed: %d\n", ret);
      mbedtls_md_free(&ctx);
      return false;
    }

    mbedtls_md_free(&ctx);

    // Convert 32-byte binary HMAC to 64-character lowercase hex string
    bytesToHex(hmacResult, 32, outputHexBuffer);
    return true;
  }
};

#endif // CRYPTO_ENGINE_H
