import { StyleSheet } from 'react-native';

const Colors = {
  primary: '#3b82f6', // Modern blue
  secondary: '#06b6d4', // Teal
  accent: '#10b981', // Green
  warning: '#f59e0b', // Amber
  danger: '#ef4444', // Red
  success: '#22c55e', // Green success
  
  // Background colors
  bg: '#f8fafc', // Light gray background
  cardBg: '#ffffff', // White card background
  
  // Text colors
  text: '#1f2937', // Dark gray text
  textSecondary: '#6b7280', // Medium gray text
  textMuted: '#9ca3af', // Light gray text
  
  // UI colors
  card: '#ffffff',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  muted: '#6b7280',
  
  // Status colors
  online: '#22c55e',
  offline: '#9ca3af',
  
  // Gradients (for future use)
  gradientStart: '#3b82f6',
  gradientEnd: '#1d4ed8',
};

const shared = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors.bg 
  },
  
  // Card styles
  card: { 
    backgroundColor: Colors.card, 
    borderRadius: 16, 
    padding: 16, 
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 0.5,
    borderColor: Colors.borderLight,
  },
  
  cardSmall: {
    backgroundColor: Colors.card, 
    borderRadius: 12, 
    padding: 12, 
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  
  // Input styles
  input: { 
    borderWidth: 1.5, 
    borderColor: Colors.border, 
    padding: 14, 
    borderRadius: 12, 
    backgroundColor: Colors.card,
    fontSize: 16,
    color: Colors.text,
  },
  
  inputFocused: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  
  // Button styles
  primaryButton: { 
    backgroundColor: Colors.primary, 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  
  primaryButtonText: { 
    color: Colors.card, 
    fontWeight: '700', 
    fontSize: 16,
  },
  
  secondaryButton: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  
  secondaryButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  
  smallButton: { 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: Colors.border, 
    backgroundColor: Colors.card,
    alignItems: 'center',
  },
  
  // Text styles
  heading1: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 36,
  },
  
  heading2: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 28,
  },
  
  heading3: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 24,
  },
  
  bodyText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  
  bodyTextSecondary: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  
  captionText: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  
  // Layout helpers
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  spaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Spacing
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  mb20: { marginBottom: 20 },
  mb24: { marginBottom: 24 },
  
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  mt20: { marginTop: 20 },
  mt24: { marginTop: 24 },
  
  p8: { padding: 8 },
  p12: { padding: 12 },
  p16: { padding: 16 },
  p20: { padding: 20 },
  p24: { padding: 24 },
});

export { Colors, shared };
