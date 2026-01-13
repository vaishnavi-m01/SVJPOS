import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, DEMO_ITEMS, DEMO_TAXES } from '../utils/constants';
import { Item, Tax, Order, Profile, BackupData, Category, User, StoreDetails, Expense } from '../types';

class StorageService {
  // Items
  async getItems(): Promise<Item[]> {
    try {
      const items = await AsyncStorage.getItem(STORAGE_KEYS.ITEMS);
      if (items) {
        const parsedItems: Item[] = JSON.parse(items);
        return Array.isArray(parsedItems) ? parsedItems : DEMO_ITEMS;
      }
      return DEMO_ITEMS;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error getting items:', errorMessage);
      return DEMO_ITEMS;
    }
  }

  async saveItems(items: Item[]): Promise<boolean> {
    try {
      if (!Array.isArray(items)) {
        throw new Error('Items must be an array');
      }
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error saving items:', errorMessage);
      return false;
    }
  }

  async addItem(item: Omit<Item, 'id'>): Promise<boolean> {
    const items = await this.getItems();
    if (items.length >= 10) return false;
    items.push({ ...item, id: Date.now().toString() });
    return await this.saveItems(items);
  }

  async updateItem(id: string, updatedItem: Partial<Item>): Promise<boolean> {
    const items = await this.getItems();
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updatedItem };
      return await this.saveItems(items);
    }
    return false;
  }

  async deleteItem(id: string): Promise<boolean> {
    const items = await this.getItems();
    const filtered = items.filter(item => item.id !== id);
    return await this.saveItems(filtered);
  }

  // Taxes
  async getTaxes(): Promise<Tax[]> {
    try {
      const taxes = await AsyncStorage.getItem(STORAGE_KEYS.TAXES);
      if (taxes) {
        const parsedTaxes: Tax[] = JSON.parse(taxes);
        return Array.isArray(parsedTaxes) ? parsedTaxes : DEMO_TAXES;
      }
      return DEMO_TAXES;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error getting taxes:', errorMessage);
      return DEMO_TAXES;
    }
  }

  async saveTaxes(taxes: Tax[]): Promise<boolean> {
    try {
      if (!Array.isArray(taxes)) {
        throw new Error('Taxes must be an array');
      }
      await AsyncStorage.setItem(STORAGE_KEYS.TAXES, JSON.stringify(taxes));
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error saving taxes:', errorMessage);
      return false;
    }
  }

  async addTax(tax: Omit<Tax, 'id'>): Promise<boolean> {
    const taxes = await this.getTaxes();
    taxes.push({ ...tax, id: Date.now().toString() });
    return await this.saveTaxes(taxes);
  }

  async updateTax(id: string, updatedTax: Partial<Tax>): Promise<boolean> {
    const taxes = await this.getTaxes();
    const index = taxes.findIndex(tax => tax.id === id);
    if (index !== -1) {
      taxes[index] = { ...taxes[index], ...updatedTax };
      return await this.saveTaxes(taxes);
    }
    return false;
  }

  async deleteTax(id: string): Promise<boolean> {
    const taxes = await this.getTaxes();
    const filtered = taxes.filter(tax => tax.id !== id);
    return await this.saveTaxes(filtered);
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    try {
      const orders = await AsyncStorage.getItem(STORAGE_KEYS.ORDERS);
      if (orders) {
        const parsedOrders: Order[] = JSON.parse(orders);
        return Array.isArray(parsedOrders) ? parsedOrders : [];
      }
      return [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error getting orders:', errorMessage);
      return [];
    }
  }

  async saveOrder(order: Omit<Order, 'id'>): Promise<boolean> {
    try {
      if (!order || typeof order !== 'object') {
        throw new Error('Order must be a valid object');
      }

      // Update stock for purchased items
      const items = await this.getItems();
      let stockUpdated = false;

      for (const orderItem of order.items) {
        // Find item by name (since cart item might only have name)
        // Ideally cart item should have ID, but based on current types:
        const itemIndex = items.findIndex(i => i.name === orderItem.name);
        if (itemIndex !== -1) {
          const currentStock = items[itemIndex].stock || 0;
          items[itemIndex].stock = Math.max(0, currentStock - orderItem.qty);
          stockUpdated = true;
        }
      }

      if (stockUpdated) {
        await this.saveItems(items);
      }

      const orders = await this.getOrders();
      const newOrder: Order = { ...order, id: Date.now().toString() };
      orders.unshift(newOrder);
      await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error saving order:', errorMessage);
      return false;
    }
  }

  // Profile
  async getProfile(): Promise<Profile> {
    const defaultProfile: Profile = { name: 'Store Owner', email: 'owner@svjpos.com' };
    try {
      const profile = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
      if (profile) {
        const parsedProfile: Profile = JSON.parse(profile);
        if (parsedProfile && typeof parsedProfile === 'object' && 'name' in parsedProfile && 'email' in parsedProfile) {
          return parsedProfile;
        }
      }
      return defaultProfile;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error getting profile:', errorMessage);
      return defaultProfile;
    }
  }

  async saveProfile(profile: Profile): Promise<boolean> {
    try {
      if (!profile || typeof profile !== 'object' || !('name' in profile) || !('email' in profile)) {
        throw new Error('Profile must be a valid Profile object');
      }
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error saving profile:', errorMessage);
      return false;
    }
  }

  // Backup/Restore
  async backupData(): Promise<string> {
    const data: BackupData = {
      items: await this.getItems(),
      taxes: await this.getTaxes(),
      orders: await this.getOrders(),
      categories: await this.getCategories(),
      expenses: await this.getExpenses(),
      profile: await this.getProfile(),
      users: await this.getUsers(),
      storeDetails: await this.getStoreDetails(),
      timestamp: new Date().toISOString(),
    };
    return JSON.stringify(data);
  }

  async restoreData(jsonData: string): Promise<boolean> {
    try {
      if (!jsonData || typeof jsonData !== 'string' || !jsonData.trim()) {
        throw new Error('Please paste the backup data first.');
      }

      let cleanData = jsonData.trim();

      // Attempt to find JSON if embedded in extra text
      const jsonStart = cleanData.indexOf('{');
      const jsonEnd = cleanData.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleanData = cleanData.substring(jsonStart, jsonEnd + 1);
      }

      let data: any;
      try {
        data = JSON.parse(cleanData);
      } catch (e) {
        throw new Error('Corrupted data: The code is incomplete or modified.');
      }

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid backup: The data format is not recognized.');
      }

      // Basic structure validation - must have at least items or orders
      if (!Array.isArray(data.items) && !Array.isArray(data.orders)) {
        throw new Error('Invalid backup: Essential data (Items or Orders) is missing.');
      }

      console.log('[Restore] Validated data. Starting database merge.');

      // Items, Taxes, Orders, Categories, Expenses
      await this.saveItems(Array.isArray(data.items) ? data.items : []);
      await this.saveTaxes(Array.isArray(data.taxes) ? data.taxes : []);
      await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(Array.isArray(data.orders) ? data.orders : []));
      await this.saveCategories(Array.isArray(data.categories) ? data.categories : []);
      await this.saveExpenses(Array.isArray(data.expenses) ? data.expenses : []);

      // Users
      await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(Array.isArray(data.users) ? data.users : []));

      // Store Details
      if (data.storeDetails) {
        await this.saveStoreDetails(data.storeDetails);
      }

      // Profile
      const defaultProfile: Profile = { name: 'Store Owner', email: 'owner@svjpos.com' };
      await this.saveProfile(
        data.profile && typeof data.profile === 'object' && 'name' in data.profile && 'email' in data.profile
          ? data.profile
          : defaultProfile
      );

      return true;
    } catch (error: any) {
      console.error('Error restoring data:', error.message);
      throw error;
    }
  }

  async clearAllData(): Promise<boolean> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ITEMS,
        STORAGE_KEYS.TAXES,
        STORAGE_KEYS.ORDERS,
        STORAGE_KEYS.PROFILE,
      ]);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error clearing data:', errorMessage);
      return false;
    }
  }
  // Categories
  async getCategories(): Promise<Category[]> {
    try {
      const categories = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (categories) {
        return JSON.parse(categories);
      }
      return [];
    } catch (error) {
      console.error('Error getting categories:', error);
      return [];
    }
  }

  async saveCategories(categories: Category[]): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
      return true;
    } catch (error) {
      console.error('Error saving categories:', error);
      return false;
    }
  }

  async addCategory(category: Omit<Category, 'id'>): Promise<boolean> {
    const categories = await this.getCategories();
    categories.push({ ...category, id: Date.now().toString() });
    return await this.saveCategories(categories);
  }

  async updateCategory(id: string, updatedCategory: Partial<Category>): Promise<boolean> {
    const categories = await this.getCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index !== -1) {
      categories[index] = { ...categories[index], ...updatedCategory };
      return await this.saveCategories(categories);
    }
    return false;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const categories = await this.getCategories();
    const filtered = categories.filter(c => c.id !== id);
    return await this.saveCategories(filtered);
  }

  // Users
  async getUsers(): Promise<User[]> {
    try {
      const users = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
      if (users) {
        return JSON.parse(users);
      }
      return [];
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  }

  async saveUser(user: User): Promise<boolean> {
    try {
      const users = await this.getUsers();
      users.push(user);
      await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      return true;
    } catch (error) {
      console.error('Error saving user:', error);
      return false;
    }
  }

  async setCurrentUser(user: User): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      return true;
    } catch (error) {
      console.error('Error setting current user:', error);
      return false;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const user = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (user) return JSON.parse(user);
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async logout(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      return true;
    } catch (error) {
      console.error('Error logging out:', error);
      return false;
    }
  }

  async getStoreDetails(): Promise<StoreDetails> {
    const defaultStore: StoreDetails = { name: '', location: '', phone: '' };
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.STORE_DETAILS);
      if (stored) {
        const parsed: StoreDetails = JSON.parse(stored);
        return parsed;
      }
      return defaultStore;
    } catch (error) {
      console.error('Error getting store details:', error);
      return defaultStore;
    }
  }

  // Save store details
  async saveStoreDetails(details: StoreDetails): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STORE_DETAILS, JSON.stringify(details));
      return true;
    } catch (error) {
      console.error('Error saving store details:', error);
      return false;
    }
  }


  // Users - Update password
  async updateUserPassword(identifier: string, newPassword: string): Promise<boolean> {
    try {
      const users = await this.getUsers();
      const index = users.findIndex(u => u.username === identifier || u.email === identifier);

      if (index === -1) return false;

      users[index] = {
        ...users[index],
        password: newPassword,
      };

      await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      return true;
    } catch (error) {
      console.error('Error updating password:', error);
      return false;
    }
  }

  // Unified Profile Update (Profile + Auth User)
  async updateUserProfile(oldEmail: string, newName: string, newEmail: string): Promise<boolean> {
    try {
      console.log(`[Storage] Updating profile: ${oldEmail} -> ${newEmail}`);

      // 1. Update Profile Key
      const profile: Profile = { name: newName, email: newEmail };
      await this.saveProfile(profile);

      // 2. Update Users List (Auth)
      const users = await this.getUsers();
      console.log('[Storage] Current users:', users);
      const userIndex = users.findIndex(u => u.email === oldEmail);
      console.log(`[Storage] User index for ${oldEmail}:`, userIndex);

      if (userIndex !== -1) {
        users[userIndex] = {
          ...users[userIndex],
          username: newName,
          email: newEmail
        };
        await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        console.log('[Storage] Users list updated');
      } else {
        console.warn(`[Storage] User with email ${oldEmail} not found in USERS list!`);
      }

      // 3. Update Current User Session
      const currentUser = await this.getCurrentUser();
      if (currentUser && currentUser.email === oldEmail) {
        const updatedUser = { ...currentUser, username: newName, email: newEmail };
        await this.setCurrentUser(updatedUser);
        console.log('[Storage] Current session updated');
      }

      return true;
    } catch (error) {
      console.error('Error updating unified profile:', error);
      return false;
    }
  }

  // Expenses
  async getExpenses(): Promise<Expense[]> {
    try {
      const expenses = await AsyncStorage.getItem(STORAGE_KEYS.EXPENSES);
      if (expenses) {
        return JSON.parse(expenses);
      }
      return [];
    } catch (error) {
      console.error('Error getting expenses:', error);
      return [];
    }
  }

  async saveExpenses(expenses: Expense[]): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
      return true;
    } catch (error) {
      console.error('Error saving expenses:', error);
      return false;
    }
  }

  async addExpense(expense: Omit<Expense, 'id'>): Promise<boolean> {
    const expenses = await this.getExpenses();
    const newExpense: Expense = { ...expense, id: Date.now().toString() };
    expenses.unshift(newExpense);
    return await this.saveExpenses(expenses);
  }

  async deleteExpense(id: string): Promise<boolean> {
    const expenses = await this.getExpenses();
    const filtered = expenses.filter(e => e.id !== id);
    return await this.saveExpenses(filtered);
  }
}





export default new StorageService();



