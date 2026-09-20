/**
 * BLE Service — Production Build with Teacher BLE Advertising
 * 
 * Teacher Side: Uses react-native-ble-advertiser to broadcast auditorium UUID
 * Student Side: Uses react-native-ble-plx to scan for teacher's specific UUID
 * 
 * Student MUST detect teacher's specific BLE beacon = physical presence verified.
 * NO simulation. NO fallbacks. NO "any device" detection.
 */

import { Platform, PermissionsAndroid } from 'react-native';

export interface BleScanResult {
  found: boolean;
  deviceName: string;
  rssi: number;
  devicesDetected: number;
  serviceUuid?: string;
}

export class BleService {
  private static _isAdvertising = false;

  /**
   * Request ALL BLE permissions (scan + advertise + location)
   */
  private static async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return Object.values(granted).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if Bluetooth hardware is powered ON and required permissions are granted
   */
  public static async isBluetoothEnabled(): Promise<{ enabled: boolean; reason?: string }> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      return { enabled: false, reason: 'Bluetooth & Location permissions are not granted in phone settings.' };
    }

    try {
      const { BleManager } = require('react-native-ble-plx');
      const manager = new BleManager();

      let state = await manager.state();

      // If state is Unknown or Resetting initially, wait up to 1 second for state update
      if (state === 'Unknown' || state === 'Resetting') {
        await new Promise<void>((resolve) => {
          const subscription = manager.onStateChange((newState: string) => {
            if (newState !== 'Unknown' && newState !== 'Resetting') {
              state = newState;
              subscription.remove();
              resolve();
            }
          }, true);
          setTimeout(() => {
            subscription.remove();
            resolve();
          }, 1000);
        });
      }

      manager.destroy();

      if (state === 'PoweredOn') {
        return { enabled: true };
      } else if (state === 'PoweredOff') {
        return { enabled: false, reason: 'Bluetooth is turned OFF on your phone.' };
      } else if (state === 'Unauthorized') {
        return { enabled: false, reason: 'Bluetooth permission is unauthorized on your phone.' };
      } else if (state === 'Unsupported') {
        return { enabled: false, reason: 'Bluetooth Low Energy is not supported on this device.' };
      } else {
        return { enabled: false, reason: `Bluetooth state is ${state}. Please make sure Bluetooth is ON.` };
      }
    } catch (err: any) {
      console.warn('[BLE] Could not check Bluetooth state:', err?.message || err);
      return { enabled: false, reason: 'Could not determine Bluetooth hardware status. Please turn on Bluetooth.' };
    }
  }

  // ══════════════════════════════════════════════════════════
  // TEACHER SIDE — BLE Advertising
  // ══════════════════════════════════════════════════════════

  /**
   * Start BLE advertising with the auditorium's service UUID.
   * Teacher's phone becomes a BLE beacon that students can detect.
   */
  public static async startAdvertising(serviceUuid: string): Promise<{ success: boolean; error?: string }> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.error('[BLE] Permissions denied for advertising');
      return { success: false, error: 'Permissions (BLUETOOTH_ADVERTISE/SCAN/LOCATION) denied.' };
    }

    try {
      const BLEAdvertiser = require('react-native-ble-advertiser');
      
      // Set company ID (using 0x004C for Apple/general purpose)
      BLEAdvertiser.setCompanyId(0x004C);

      // Start broadcasting the auditorium UUID
      await BLEAdvertiser.broadcast(serviceUuid, [], {
        advertiseMode: 2,       // ADVERTISE_MODE_LOW_LATENCY
        txPowerLevel: 3,        // ADVERTISE_TX_POWER_HIGH
        connectable: false,
        includeDeviceName: false,
        includeTxPowerLevel: false,
      });

      this._isAdvertising = true;
      console.log('[BLE] Teacher advertising started:', serviceUuid);
      return { success: true };
    } catch (err: any) {
      const errMsg = err?.message || err?.toString() || 'Unknown BLE Advertiser error';
      console.error('[BLE] Failed to start advertising:', errMsg);
      this._isAdvertising = false;
      return { success: false, error: errMsg };
    }
  }

  /**
   * Stop BLE advertising
   */
  public static async stopAdvertising(): Promise<void> {
    try {
      const BLEAdvertiser = require('react-native-ble-advertiser');
      await BLEAdvertiser.stopBroadcast();
      this._isAdvertising = false;
      console.log('[BLE] Teacher advertising stopped');
    } catch (err: any) {
      console.error('[BLE] Failed to stop advertising:', err.message);
    }
  }

  /**
   * Check if currently advertising
   */
  public static getIsAdvertising(): boolean {
    return this._isAdvertising;
  }

  // ══════════════════════════════════════════════════════════
  // STUDENT SIDE — BLE Scanning for Teacher's Beacon
  // ══════════════════════════════════════════════════════════

  /**
   * Scan specifically for the teacher's BLE beacon (auditorium UUID).
   * Only succeeds if teacher's phone is broadcasting that exact UUID.
   * This proves student is physically in the same room as teacher.
   * 
   * @param serviceUuid - The auditorium-specific UUID to look for
   * @param timeoutMs - Scan duration (default 12 seconds)
   */
  public static async scanForTeacherBeacon(
    serviceUuid: string,
    timeoutMs: number = 12000
  ): Promise<BleScanResult> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      return { found: false, deviceName: 'Permission denied', rssi: -100, devicesDetected: 0 };
    }

    try {
      const { BleManager } = require('react-native-ble-plx');
      const manager = new BleManager();

      return new Promise<BleScanResult>((resolve) => {
        let resolved = false;
        let bestRssi = -100;
        let bestName = '';
        let matchedDevices = 0;

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            manager.stopDeviceScan();
            manager.destroy();
            resolve({
              found: matchedDevices > 0,
              deviceName: bestName || 'No beacon found',
              rssi: bestRssi,
              devicesDetected: matchedDevices,
              serviceUuid: serviceUuid,
            });
          }
        }, timeoutMs);

        // First: try scanning with UUID filter (exact teacher beacon)
        manager.startDeviceScan(
          [serviceUuid],
          { allowDuplicates: false },
          (error: any, device: any) => {
            if (error) {
              console.warn('[BLE] UUID-filtered scan error:', error.message);
              // Fallback: scan broadly and check service UUIDs manually
              if (!resolved) {
                manager.stopDeviceScan();
                this.broadScanFallback(manager, serviceUuid, timeoutMs - 3000, timeout, resolve, resolved);
              }
              return;
            }

            if (device && !resolved) {
              const rssi = device.rssi || -100;
              const name = device.name || device.localName || 'Teacher Beacon';
              matchedDevices++;

              if (rssi > bestRssi) {
                bestRssi = rssi;
                bestName = name;
              }

              // Found teacher's beacon! Resolve immediately
              resolved = true;
              clearTimeout(timeout);
              manager.stopDeviceScan();
              manager.destroy();
              resolve({
                found: true,
                deviceName: bestName,
                rssi: bestRssi,
                devicesDetected: matchedDevices,
                serviceUuid: serviceUuid,
              });
            }
          }
        );

        // After 4 seconds, if UUID filter found nothing, switch to broad scan
        setTimeout(() => {
          if (!resolved && matchedDevices === 0) {
            console.log('[BLE] UUID filter found nothing, switching to broad scan...');
            manager.stopDeviceScan();
            this.broadScanFallback(manager, serviceUuid, timeoutMs - 4000, timeout, resolve, resolved);
          }
        }, 4000);
      });
    } catch (err: any) {
      console.error('[BLE] BLE error:', err.message);
      return { found: false, deviceName: 'BLE error: ' + err.message, rssi: -100, devicesDetected: 0 };
    }
  }

  /**
   * Broad scan fallback — scan all devices and check serviceUUIDs manually
   */
  private static broadScanFallback(
    manager: any,
    targetUuid: string,
    remainingMs: number,
    existingTimeout: ReturnType<typeof setTimeout>,
    resolve: (result: BleScanResult) => void,
    alreadyResolved: boolean
  ): void {
    if (alreadyResolved || remainingMs <= 0) return;

    let resolved: boolean = alreadyResolved;
    const targetLower = targetUuid.toLowerCase();

    manager.startDeviceScan(
      null,
      { allowDuplicates: false },
      (error: any, device: any) => {
        if (error || resolved) return;

        if (device) {
          // Check if this device's service UUIDs contain our target
          const uuids = device.serviceUUIDs || [];
          const hasTargetUuid = uuids.some(
            (uuid: string) => uuid.toLowerCase() === targetLower
          );

          if (hasTargetUuid) {
            resolved = true;
            clearTimeout(existingTimeout);
            manager.stopDeviceScan();
            manager.destroy();
            resolve({
              found: true,
              deviceName: device.name || device.localName || 'Teacher Beacon',
              rssi: device.rssi || -65,
              devicesDetected: 1,
              serviceUuid: targetUuid,
            });
          }
        }
      }
    );
  }
}
