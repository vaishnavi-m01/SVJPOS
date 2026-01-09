// Type definitions for SVJ POS app

export interface Category {
  id: string;
  name: string;
}

export interface Item {
  id: string;
  name: string;
  code: string;
  price: number;
  purchasePrice?: number; // Added for profit calculation
  taxId?: string;
  barcode: string;
  description: string;
  categoryId?: string;
  stock?: number;
  mrp?: number;
  manageStock?: boolean;
  stockQuantity?: number;
}

export interface CartItem extends Item {
  quantity: number;
  mrp?: number;
  rate?: number;
}

export interface Tax {
  id: string;
  name: string;
  rate: number;
  description: string;
  isDefault: boolean;
}

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
  purchasePrice?: number; // Added to capture cost at time of sale
  mrp?: number;
  rate?: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
}

export interface Order {
  id?: string;
  orderNumber: string;
  date: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  payment: string;
  gstSummary?: {
    perc: number;
    taxable: number;
    sgst: number;
    cgst: number;
  }[];
}

export interface Profile {
  name: string;
  email: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  password: string;
  businessName?: string;
}

export interface Notification {
  id: string;
  type: 'printer' | 'stock' | 'sales' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
  severity: 'info' | 'warning' | 'error' | 'success';
}

export interface BackupData {
  items: Item[];
  taxes: Tax[];
  orders: Order[];
  categories: Category[];
  expenses: Expense[];
  profile: Profile;
  users: User[];
  storeDetails: StoreDetails;
  timestamp: string;
}

export interface SecuritySettings {
  biometricAuth: boolean;
}

// Navigation types
export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Sales: undefined;
  Items: undefined;
  TaxMaster: undefined;
  Printer: undefined;
  ItemForm: { item?: Item };
  CategoryMaster: undefined;
  TaxForm: { tax?: Tax };
  Tabs: undefined;
  Notifications: undefined;
  HelpScreen: undefined;
  PrivacySecurity: undefined;
  StoreDetails: undefined;
  LegalScreen: { type: 'privacy' | 'terms' };
  Expenses: undefined;
  Backup: undefined;
};

export type RootTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  ReportsTab: undefined;
  AccountTab: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootTabParamList { }
  }
}


export type StoreDetails = {
  name: string;
  location: string;
  phone: string;
};