import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shared, Colors } from './Theme';

const RefreshingCard = () => {
  return (
    <View style={[shared.card, styles.refreshCard]}>
      <View style={styles.cardContent}>
        <View style={styles.refreshHeader}>
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.refreshText}>Refreshing jobs...</Text>
        </View>
        
        <View style={styles.refreshInfo}>
          <Ionicons name="cloud-download-outline" size={16} color={Colors.muted} />
          <Text style={styles.refreshSubText}>Getting latest jobs and accommodations</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  refreshCard: { 
    marginBottom: 8, 
    marginHorizontal: 4,
    backgroundColor: Colors.primary + '08', // Very light primary color
    borderColor: Colors.primary + '20',
    borderWidth: 1,
    shadowColor: Colors.primary,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardContent: {
    padding: 16,
    alignItems: 'center',
  },
  refreshHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  refreshText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  refreshInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshSubText: {
    fontSize: 12,
    color: Colors.muted,
    marginLeft: 6,
  },
});

export default RefreshingCard;