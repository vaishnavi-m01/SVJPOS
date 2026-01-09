export const generateOrderNumber = (): string => `ORD-${Date.now().toString().slice(-6)}`;

export const formatCurrency = (amount: number): string => `₹${amount.toFixed(2)}`;

export const formatDate = (date: string | Date): string => new Date(date).toLocaleDateString();

export const formatTime = (date: string | Date): string => new Date(date).toLocaleTimeString();

export const calculateTax = (subtotal: number, taxRate: number): number => (subtotal * taxRate) / 100;
