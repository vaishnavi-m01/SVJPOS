import { Item, Tax } from '../types';

export const STORAGE_KEYS = {
  ITEMS: 'posItems',
  TAXES: 'posTaxes',
  ORDERS: 'posOrders',
  PROFILE: 'posProfile',
  CATEGORIES: 'posCategories',
  USERS: 'posUsers',
  CURRENT_USER: 'posCurrentUser',
  STORE_DETAILS: 'posStoreDetails',
  SECURITY_SETTINGS: 'posSecuritySettings',
  EXPENSES: 'posExpenses',
} as const;


export const TAX_RATE = 0.18; // 18% GST

export const DEMO_ITEMS: Item[] = [
  {
    id: '1',
    name: 'Coca Cola',
    code: 'ITM001',
    price: 45,
    taxId: '3', // GST 5%
    barcode: '1234567890123',
    description: '330ml Can',
    manageStock: true,
    stockQuantity: 100,
  },
  {
    id: '2',
    name: "Lay's Chips",
    code: 'ITM002',
    price: 35,
    taxId: '3', // GST 5%
    barcode: '9876543210987',
    description: '52g Pack',
    manageStock: true,
    stockQuantity: 50,
  },
  {
    id: '3',
    name: 'Dairy Milk',
    code: 'ITM003',
    price: 55,
    taxId: '3', // GST 5%
    barcode: '5678901234567',
    description: 'Chocolate Bar',
    manageStock: true,
    stockQuantity: 200,
  },
];

export const DEMO_TAXES: Tax[] = [
  {
    id: '1',
    name: 'GST 18%',
    rate: 18,
    description: 'Standard GST Rate',
    isDefault: true,
  },
  {
    id: '2',
    name: 'GST 12%',
    rate: 12,
    description: 'Reduced GST Rate',
    isDefault: false,
  },
  {
    id: '3',
    name: 'GST 5%',
    rate: 5,
    description: 'Lower GST Rate',
    isDefault: false,
  },
  {
    id: '4',
    name: 'No Tax',
    rate: 0,
    description: 'Tax Exempt Items',
    isDefault: false,
  },
];

