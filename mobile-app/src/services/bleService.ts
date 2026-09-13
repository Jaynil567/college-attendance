/**
 * BLE Service — Anti-Cheat Production Build
 * 
 * Teacher Side: BLE Advertising (beacon broadcasting)
 * Student Side: BLE Scanning (detect teacher's phone)
 * 
 * NO simulation mode. NO hardcoded keys. NO fallbacks.
 */

export interface BleScanResult {
  found: boolean;
  deviceName: string;
  rssi: number;
  serviceUuid?: string;
}

export class BleService {
  private static isAdvertising = false;

  /**
   * TEACHER SIDE: Start BLE advertising as a beacon
   * Called when teacher starts an attendance session
   */
  public static async startAdvertising(serviceUuid: string): Promise<boolean> {
    try {
      const BleAdvertiser = require('react-native-ble-advertiser').default;
      
      // Set company ID (use a generic one for our app)
      BleAdvertiser.setCompanyId(0x4C00); // Apple format for broad compatibility
      
      // Start broadcasting with the auditorium-specific UUID
      await BleAdvertiser.broadcast(serviceUuid, [], {
        advertiseMode: 1,        // ADVERTISE_MODE_BALANCED
        txPowerLevel: 2,         // ADVERTISE_TX_POWER_MEDIUM
        connectable: false,
        includeDeviceName: true,
      });
      
      this.isAdvertising = true;
      console.log('[BLE] Advertising started with UUID:', serviceUuid);
      return true;
    } catch (err: any) {
      console.error('[BLE] Failed to start advertising:', err.message);
      this.isAdvertising = false;
      return false;
    }
  }

  /**
   * TEACHER SIDE: Stop BLE advertising
   * Called when teacher ends the session
   */
  public static async stopAdvertising(): Promise<void> {
    try {
      const BleAdvertiser = require('react-native-ble-advertiser').default;
      await BleAdvertiser.stopBroadcast();
      this.isAdvertising = false;
      console.log('[BLE] Advertising stopped');
    } catch (err: any) {
      console.error('[BLE] Failed to stop advertising:', err.message);
      this.isAdvertising = false;
    }
  }

  /**
   * Check if currently advertising
   */
  public static getIsAdvertising(): boolean {
    return this.isAdvertising;
  }

  /**
   * STUDENT SIDE: Scan for teacher's BLE beacon
   * Returns scan result with proximity info
   * 
   * @param serviceUuid - The auditorium-specific UUID to scan for
   * @param timeoutMs - How long to scan before giving up (default 8 seconds)
   * @returns BleScanResult with found status and RSSI
   */
  public static async scanForTeacherBeacon(
    serviceUuid: string,
    timeoutMs: number = 8000
  ): Promise<BleScanResult> {
    try {
      const { BleManager } = require('react-native-ble-plx');
      const manager = new BleManager();

      return new Promise<BleScanResult>((resolve) => {
        let resolved = false;

        // Timeout — beacon not found
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            manager.stopDeviceScan();
            manager.destroy();
            resolve({
              found: false,
              deviceName: '',
              rssi: -100,
            });
          }
        }, timeoutMs);

        // Start scanning for the specific service UUID
        manager.startDeviceScan(
          [serviceUuid],
          { allowDuplicates: false },
          (error: any, device: any) => {
            if (error) {
              console.error('[BLE Scan] Error:', error.message);
              return;
            }

            if (device && !resolved) {
              const rssi = device.rssi || -100;
              
              // RSSI threshold check: must be within ~10 meters (-80 dBm)
              if (rssi >= -80) {
                resolved = true;
                clearTimeout(timeout);
                manager.stopDeviceScan();
                manager.destroy();
                resolve({
                  found: true,
                  deviceName: device.name || device.localName || 'Teacher Phone',
                  rssi: rssi,
                  serviceUuid: serviceUuid,
                });
              }
            }
          }
        );
      });
    } catch (err: any) {
      console.error('[BLE Scan] Native BLE unavailable:', err.message);
      return {
        found: false,
        deviceName: '',
        rssi: -100,
      };
    }
  }
}
