import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  STORE_DETAILS: '@store_details',
};

// Type definition
export type StoreDetails = {
  name: string;
  location: string;
  phone: string;
};

// Service class
class StoreService {
  // Get store details
  async getStoreDetails(): Promise<StoreDetails> {
    const defaultStore: StoreDetails = { name: '', location: '', phone: '' };
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.STORE_DETAILS);
      if (stored) {
        const parsed: StoreDetails = JSON.parse(stored);
        if (
          parsed &&
          typeof parsed === 'object' &&
          'name' in parsed &&
          'location' in parsed &&
          'phone' in parsed
        ) {
          return parsed;
        }
      }
      return defaultStore;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error getting store details:', msg);
      return defaultStore;
    }
  }

  // Save store details
  async saveStoreDetails(details: StoreDetails): Promise<boolean> {
    try {
      if (
        !details ||
        typeof details !== 'object' ||
        !('name' in details) ||
        !('location' in details) ||
        !('phone' in details)
      ) {
        throw new Error('Invalid store details object');
      }
      await AsyncStorage.setItem(STORAGE_KEYS.STORE_DETAILS, JSON.stringify(details));
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error saving store details:', msg);
      return false;
    }
  }
}

export default new StoreService();
