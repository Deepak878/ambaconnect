import { StyleSheet } from 'react-native';

const Colors = {
  primary: '#2563eb', // blue
  secondary: '#06b6d4', // teal
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e6e9ef',
  muted: '#6b7280',
  accent: '#10b981', // green
  danger: '#ef4444',
};

const shared = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  card: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, shadowColor: 'rgba(0,0,0,0.04)', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  input: { borderWidth: 1, borderColor: Colors.border, padding: 12, borderRadius: 10, backgroundColor: Colors.card },
  primaryButton: { backgroundColor: Colors.primary, padding: 12, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: Colors.card, fontWeight: '700' },
  smallButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
});

export { Colors, shared };
