import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../config/db.js';
import { CryptoService } from '../services/cryptoService.js';

const deviceCreateSchema = z.object({
  esp32Id: z.string().min(3, 'Device ID is required (e.g. CLASSROOM_01)'),
  deviceName: z.string().min(2, 'Device name is required'),
  classroomId: z.string().min(2, 'Classroom ID is required (e.g. ROOM_302)'),
  firmwareVersion: z.string().default('1.0.0'),
  customSecretKey: z.string().length(64, 'Secret key must be 64 hex characters').optional(),
});

export class DeviceController {
  /**
   * Register a new ESP32 classroom attendance device
   */
  static async registerDevice(req: Request, res: Response): Promise<void> {
    try {
      const parsed = deviceCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.format(),
        });
        return;
      }

      const { esp32Id, deviceName, classroomId, firmwareVersion, customSecretKey } = parsed.data;
      const cleanEsp32Id = esp32Id.trim().toUpperCase();

      // Check for duplicate esp32_id
      const existing = await query('SELECT id FROM esp32_devices WHERE esp32_id = $1', [cleanEsp32Id]);
      if (existing.rows && existing.rows.length > 0) {
        res.status(409).json({
          success: false,
          error: 'DEVICE_EXISTS',
          message: `Device with ID '${cleanEsp32Id}' already exists.`,
        });
        return;
      }

      // Generate cryptographically secure UUIDs and 256-bit Hex secret key
      const serviceUuid = crypto.randomUUID();
      const charChallengeUuid = crypto.randomUUID();
      const charResponseUuid = crypto.randomUUID();
      const secretKey = customSecretKey || CryptoService.generateDeviceSecretKey();
      const id = crypto.randomUUID();

      const result = await query(
        `INSERT INTO esp32_devices (
          id, esp32_id, device_name, classroom_id, service_uuid,
          char_challenge_uuid, char_response_uuid, secret_key,
          device_status, firmware_version, last_seen_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, NOW(), NOW(), NOW())
        RETURNING *`,
        [id, cleanEsp32Id, deviceName.trim(), classroomId.trim().toUpperCase(), serviceUuid, charChallengeUuid, charResponseUuid, secretKey, firmwareVersion]
      );

      res.status(201).json({
        success: true,
        message: 'ESP32 device registered successfully',
        device: result.rows[0],
        arduinoConfigSnippet: {
          esp32Id: cleanEsp32Id,
          serviceUuid,
          charChallengeUuid,
          charResponseUuid,
          secretKeyHex: secretKey,
        },
      });
    } catch (err: any) {
      console.error('[DeviceController.registerDevice]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Get all registered ESP32 devices
   */
  static async getDevices(req: Request, res: Response): Promise<void> {
    try {
      const result = await query(
        `SELECT id, esp32_id, device_name, classroom_id, service_uuid,
                char_challenge_uuid, char_response_uuid, secret_key,
                device_status, firmware_version, last_seen_at, created_at, updated_at
         FROM esp32_devices
         ORDER BY classroom_id ASC, esp32_id ASC`
      );

      res.status(200).json({
        success: true,
        devices: result.rows || [],
      });
    } catch (err: any) {
      console.error('[DeviceController.getDevices]', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Rotate device secret key
   */
  static async rotateKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const newSecretKey = CryptoService.generateDeviceSecretKey();

      const result = await query(
        `UPDATE esp32_devices
         SET secret_key = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, esp32_id, classroom_id, service_uuid, secret_key`,
        [newSecretKey, id]
      );

      if (!result.rows || result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Device not found' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'ESP32 cryptographic secret key rotated successfully. Remember to reflash the device firmware.',
        device: result.rows[0],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * Device Heartbeat (can be called if device is Wi-Fi enabled or via mobile proxy)
   */
  static async heartbeat(req: Request, res: Response): Promise<void> {
    try {
      const { esp32Id, firmwareVersion } = req.body;
      if (!esp32Id) {
        res.status(400).json({ success: false, error: 'DEVICE_ID_REQUIRED' });
        return;
      }

      await query(
        `UPDATE esp32_devices
         SET last_seen_at = NOW(),
             firmware_version = COALESCE($1, firmware_version),
             device_status = 'active'
         WHERE esp32_id = $2`,
        [firmwareVersion || null, esp32Id.toUpperCase()]
      );

      res.status(200).json({ success: true, message: 'Heartbeat acknowledged' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
  }
}
