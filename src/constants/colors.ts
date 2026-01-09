export const COLORS = {
  primary: '#0A7EA4',
  primaryDark: '#075E7D',
  accent: '#FF6B35',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  background: '#F8FAFB',
  surface: '#FFFFFF',
  textPrimary: '#1A1D29',
  textSecondary: '#64748B',
  border: '#E2E8F0',
} as const;

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

