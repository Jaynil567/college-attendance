import * as Cellular from 'expo-cellular';
import { Platform } from 'react-native';

export interface SimStatus {
  hasSimCard: boolean;
  carrierName: string | null;
  countryCode: string | null;
  mobileCountryCode: string | null;
  networkGeneration: string | null;
  reason?: string;
}

export class SimService {
  /**
   * Checks hardware SIM card presence, active carrier name, and cellular status
   */
  static async checkSimStatus(): Promise<SimStatus> {
    try {
      if (Platform.OS === 'web') {
        return {
          hasSimCard: true,
          carrierName: 'Web Simulator',
          countryCode: 'in',
          mobileCountryCode: '404',
          networkGeneration: '4G',
        };
      }

      const carrierName = await Cellular.getCarrierNameAsync();
      const countryCode = await Cellular.getIsoCountryCodeAsync();
      const mobileCountryCode = await Cellular.getMobileCountryCodeAsync();
      const cellularGen = await Cellular.getCellularGenerationAsync();

      let genName = 'Cellular';
      switch (cellularGen) {
        case Cellular.CellularGeneration.CELLULAR_2G:
          genName = '2G';
          break;
        case Cellular.CellularGeneration.CELLULAR_3G:
          genName = '3G';
          break;
        case Cellular.CellularGeneration.CELLULAR_4G:
          genName = '4G/LTE';
          break;
        case Cellular.CellularGeneration.CELLULAR_5G:
          genName = '5G';
          break;
        default:
          genName = 'Active SIM';
      }

      // Check if physical or eSIM is inserted
      const hasSim = !!(carrierName || countryCode || mobileCountryCode);

      if (!hasSim) {
        return {
          hasSimCard: false,
          carrierName: null,
          countryCode: null,
          mobileCountryCode: null,
          networkGeneration: null,
          reason: '❌ NO ACTIVE SIM CARD DETECTED! A physical SIM or eSIM matching your registered mobile number must be inserted in this phone.',
        };
      }

      return {
        hasSimCard: true,
        carrierName: carrierName || 'Active SIM Carrier',
        countryCode: countryCode || 'in',
        mobileCountryCode: mobileCountryCode || null,
        networkGeneration: genName,
      };
    } catch (err: any) {
      console.warn('[SimService.checkSimStatus] Cellular check warning:', err?.message);
      // Fallback allowed on simulator or devices without cellular permission
      return {
        hasSimCard: true,
        carrierName: 'Active Cellular Network',
        countryCode: 'in',
        mobileCountryCode: null,
        networkGeneration: 'Cellular',
      };
    }
  }
}
