import {PermissionsAndroid, Platform} from 'react-native';

export interface BarcodeResult {
  code: string;
  isValid: boolean;
}

export type BarcodeFormat = 'EAN_13' | 'EAN_8' | 'UPC_A' | 'UPC_E' | 'CODE_128' | 'CODE_39' | 'ITF' | 'QR_CODE';

class BarcodeService {
  async requestCameraPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'SVJPOS needs camera access to scan barcodes',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Camera permission error:', errorMessage);
        return false;
      }
    }
    return true;
  }

  parseBarcode(data: string): BarcodeResult {
    if (!data || typeof data !== 'string') {
      return {
        code: '',
        isValid: false,
      };
    }

    const trimmedData: string = data.trim();
    const isValid: boolean = trimmedData.length > 0 && this.validateBarcodeFormat(trimmedData);

    return {
      code: trimmedData,
      isValid,
    };
  }

  private validateBarcodeFormat(code: string): boolean {
    // Basic validation: check if it's numeric (for EAN/UPC) or alphanumeric (for CODE_128/CODE_39)
    // EAN-13: 13 digits
    // EAN-8: 8 digits
    // UPC-A: 12 digits
    // CODE_128/CODE_39: alphanumeric
    
    if (code.length === 0) {
      return false;
    }

    // Check for common barcode formats
    const numericPattern: RegExp = /^\d+$/;
    const alphanumericPattern: RegExp = /^[A-Za-z0-9\-\.\s]+$/;

    // EAN-13, EAN-8, UPC-A should be numeric
    if (code.length === 13 || code.length === 8 || code.length === 12) {
      return numericPattern.test(code);
    }

    // CODE_128, CODE_39 can be alphanumeric
    if (code.length >= 1 && code.length <= 48) {
      return alphanumericPattern.test(code);
    }

    // QR Code can be any string
    return code.length > 0;
  }

  formatBarcodeForDisplay(code: string): string {
    if (!code || code.length === 0) {
      return '';
    }

    // Format EAN-13/UPC-A with spaces for readability
    if (code.length === 13 && /^\d+$/.test(code)) {
      return `${code.slice(0, 1)} ${code.slice(1, 7)} ${code.slice(7, 13)}`;
    }

    if (code.length === 12 && /^\d+$/.test(code)) {
      return `${code.slice(0, 1)} ${code.slice(1, 6)} ${code.slice(6, 11)} ${code.slice(11)}`;
    }

    return code;
  }
}

export default new BarcodeService();

