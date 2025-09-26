import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shared, Colors } from './Theme';
const placeholder = require('../assets/icon.png');

const toRad = (deg) => deg * Math.PI / 180;
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default function SavedScreen({ savedJobs = [], onOpen, onSave, user, userLocation }) {
  const [items, setItems] = useState([]);

  // Calculate distances for saved items just like JobsScreen does
  const enrichedItems = useMemo(() => {
    return items.map(item => {
      let distance = null;
      let distanceLabel = item.location || '';
      
      if (userLocation && item.lat && item.lng) {
        try {
          distance = haversineKm(userLocation.latitude, userLocation.longitude, item.lat, item.lng);
          if (!isNaN(distance)) {
            distanceLabel = distance < 1 ? `${Math.round(distance*1000)} m away` : `${distance.toFixed(1)} km away`;
          }
        } catch (e) {
          console.warn('Error calculating distance:', e);
        }
      }
      
      return { ...item, _distanceKm: distance, _distanceLabel: distanceLabel };
    });
  }, [items, userLocation]);

  const getTimeAgo = (dateInput) => {
    if (!dateInput) return '';
    
    try {
      let date;
      
      // Handle Firestore timestamp objects
      if (typeof dateInput === 'object' && dateInput.toDate) {
        date = dateInput.toDate();
      } else {
        date = new Date(dateInput);
      }
      
      const now = new Date();
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return '';
      }
      
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours}h ago`;
      
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) return `${diffInDays}d ago`;
      
      const diffInWeeks = Math.floor(diffInDays / 7);
      return `${diffInWeeks}w ago`;
    } catch (error) {
      return '';
    }
  };

  useEffect(() => {
    if (!user || !user.phone) {
      setItems([]);
      return;
    }
    
    setItems(savedJobs || []);
  }, [savedJobs, user]);

  if (!enrichedItems || !enrichedItems.length) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="heart-outline" size={48} color={Colors.muted} />
        <Text style={styles.emptyTitle}>No saved items yet</Text>
        <Text style={styles.emptySubtext}>
          Save jobs and accommodations to view them here
        </Text>
      </View>
    );
  }

  const renderItem = ({ item }) => {
    const isAccommodation = item.kind === 'accommodation';
    
    return (
      <TouchableOpacity 
        style={styles.itemCard} 
        onPress={() => onOpen(item)}
      >
        <View style={styles.itemHeader}>
          <View style={[styles.typeIcon, { 
            backgroundColor: isAccommodation ? (Colors.secondary || '#FF6B6B') + '20' : Colors.primary + '20' 
          }]}>
            <Ionicons 
              name={isAccommodation ? 'home' : 'briefcase'} 
              size={18} 
              color={isAccommodation ? Colors.secondary || '#FF6B6B' : Colors.primary} 
            />
          </View>
          
          {onSave && (
            <TouchableOpacity 
              onPress={() => onSave(item)} 
              style={styles.unsaveButton}
            >
              <Ionicons name="heart" size={16} color={Colors.primary} />
              <Text style={styles.unsaveText}>Saved</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        
        <Text style={styles.itemSubtitle}>
          {isAccommodation 
            ? `${item.accomType || 'Accommodation'} • ${item.location}` 
            : `${item.type} • ${item.location}`
          }
        </Text>

        <Text style={styles.itemPrice}>
          {isAccommodation 
            ? `${item.rent} ${item.currency || 'USD'}/month`
            : `${item.salary} ${item.currency || 'USD'}${item.salaryType === 'hourly' ? '/hr' : item.salaryType === 'daily' ? '/day' : '/week'}`
          }
        </Text>

        <View style={styles.itemFooter}>
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={12} color={Colors.muted} />
            <Text style={styles.locationText}>{item._distanceLabel}</Text>
          </View>
          
          {item.createdAt && (
            <Text style={styles.dateText}>
              {getTimeAgo(item.createdAt)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {enrichedItems.length} saved item{enrichedItems.length !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.headerSubtitle}>
          Jobs and accommodations you've saved
        </Text>
      </View>
      
      <FlatList
        data={enrichedItems}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.muted,
  },
  listContainer: {
    padding: 12,
  },
  itemCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unsaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.primary + '15',
  },
  unsaveText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
    lineHeight: 22,
  },
  itemSubtitle: {
    fontSize: 14,
    color: Colors.muted,
    marginBottom: 8,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 12,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationText: {
    fontSize: 12,
    color: Colors.muted,
    marginLeft: 4,
  },
  dateText: {
    fontSize: 12,
    color: Colors.muted,
  },
});
