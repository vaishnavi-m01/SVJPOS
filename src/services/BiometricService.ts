import ReactNativeBiometrics from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rnBiometrics = new ReactNativeBiometrics();

const FINGERPRINT_USER_KEY = '@svjpos_fingerprint_user';
const BIOMETRIC_ENABLED_KEY = '@svjpos_biometric_enabled';

class BiometricService {

  static async isBiometricAvailable() {
    return await rnBiometrics.isSensorAvailable();
  }

  // ✅ Enable AFTER login
  static async enableFingerprint(username: string) {
    const { success } = await rnBiometrics.simplePrompt({
      promptMessage: 'Confirm Fingerprint'
    });

    if (success) {
      await AsyncStorage.setItem(FINGERPRINT_USER_KEY, username);
      // Mark that biometric login has been enabled once
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      return true;
    }
    return false;
  }

  static async isFingerprintEnabled() {
    const user = await AsyncStorage.getItem(FINGERPRINT_USER_KEY);
    return !!user;
  }

  // Check if one-time login was completed (for auto-trigger on app start)
  static async hasCompletedBiometricSetup() {
    const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return enabled === 'true';
  }

  static async authenticate() {
    const { success } = await rnBiometrics.simplePrompt({
      promptMessage: 'Login with Fingerprint'
    });

    if (!success) return null;

    const username = await AsyncStorage.getItem(FINGERPRINT_USER_KEY);
    return username;
  }

  // Disable biometric login (logout) - clears both flags
  static async disableBiometric() {
    await AsyncStorage.removeItem(FINGERPRINT_USER_KEY);
    await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  }
}

export default BiometricService;
