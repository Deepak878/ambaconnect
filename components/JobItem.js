import React, { memo, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shared, Colors } from './Theme';
import OptimizedImage from './OptimizedImage';
const placeholder = require('../assets/icon.png');

// Cached distance calculation to prevent recalculation
const distanceCache = new Map();
const toRad = (deg) => deg * Math.PI / 180;
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const key = `${lat1},${lon1},${lat2},${lon2}`;
  if (distanceCache.has(key)) {
    return distanceCache.get(key);
  }
  
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  distanceCache.set(key, distance);
  if (distanceCache.size > 500) {
    const firstKey = distanceCache.keys().next().value;
    distanceCache.delete(firstKey);
  }
  
  return distance;
};

const JobItem = memo(({ item, onOpen, onSave, saved, userLocation }) => {
  // Memoize distance calculation
  const distanceLabel = useMemo(() => {
    if (item._distanceKm !== undefined && item._distanceKm !== null) {
      return item._distanceKm < 1 
        ? `${Math.round(item._distanceKm * 1000)} m away` 
        : `${item._distanceKm.toFixed(1)} km away`;
    }
    
    if (userLocation && item.lat && item.lng) {
      try {
        const km = haversineKm(userLocation.latitude, userLocation.longitude, item.lat, item.lng);
        if (!isNaN(km)) {
          return km < 1 ? `${Math.round(km*1000)} m away` : `${km.toFixed(1)} km away`;
        }
      } catch (e) {}
    }
    
    return item.location || '';
  }, [item.location, item.lat, item.lng, item._distanceKm, userLocation]);

  // Memoize time ago calculation
  const timeAgoText = useMemo(() => {
    if (!item.createdAt) {
      console.warn(`No createdAt for item: ${item.title}`);
      return 'Recently posted'; // Fallback text instead of empty string
    }
    
    try {
      let date;
      
      // Handle Firestore timestamp objects
      if (typeof item.createdAt === 'object' && item.createdAt.toDate) {
        date = item.createdAt.toDate();
      } else if (typeof item.createdAt === 'object' && item.createdAt.seconds) {
        // Handle Firestore timestamp in seconds format
        date = new Date(item.createdAt.seconds * 1000);
      } else if (typeof item.createdAt === 'string' || typeof item.createdAt === 'number') {
        date = new Date(item.createdAt);
      } else {
        console.warn(`Unknown createdAt format for ${item.title}:`, item.createdAt);
        return 'Recently posted';
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date for ${item.title}:`, item.createdAt);
        return 'Recently posted';
      }
      
      const now = new Date();
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours}h ago`;
      
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) return `${diffInDays}d ago`;
      
      const diffInWeeks = Math.floor(diffInDays / 7);
      if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
      
      const diffInMonths = Math.floor(diffInDays / 30);
      return `${diffInMonths}mo ago`;
    } catch (error) {
      console.error(`Error calculating time for ${item.title}:`, error);
      return 'Recently posted';
    }
  }, [item.createdAt, item.title]);

  // Memoize category icon
  const categoryIcon = useMemo(() => {
    const titleLower = (item.title || '').toLowerCase();
    if (titleLower.includes('barista') || titleLower.includes('cafe') || titleLower.includes('restaurant')) return 'cafe';
    if (titleLower.includes('warehouse') || titleLower.includes('helper')) return 'cube';
    if (titleLower.includes('dog') || titleLower.includes('pet')) return 'paw';
    if (titleLower.includes('baby') || titleLower.includes('child')) return 'person';
    if (titleLower.includes('delivery') || titleLower.includes('driver')) return 'car';
    if (titleLower.includes('retail') || titleLower.includes('shop')) return 'storefront';
    if (titleLower.includes('tech') || titleLower.includes('support')) return 'laptop';
    if (titleLower.includes('clean')) return 'sparkles';
    return 'briefcase';
  }, [item.title]);

  return (
    <TouchableOpacity style={[shared.card, styles.jobCard]} onPress={() => onOpen(item)}>
      <View style={styles.cardContent}>
        {/* Compact header with title and actions */}
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.jobTitle} numberOfLines={2}>{item.title}</Text>
          </View>
          <View style={styles.rightActions}>
            <TouchableOpacity style={styles.typeButton}>
              <Ionicons 
                name={item.kind === 'accommodation' ? 'home' : 'briefcase'}
                size={16}
                color={Colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => onSave(item)} 
              style={[styles.saveButton, saved && styles.saveButtonActive]}
            >
              <Ionicons 
                name={saved ? "heart" : "heart-outline"} 
                size={16} 
                color={saved ? Colors.primary : Colors.muted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Job/Accommodation specific info */}
        {item.kind === 'accommodation' ? (
          <View style={styles.infoContainer}>
            <Text style={styles.primaryInfo}>
              {item.rent} {item.currency || 'USD'}/month
            </Text>
            <Text style={styles.secondaryInfo}>
              {item.accomType} • {item.availability}
            </Text>
          </View>
        ) : (
          <View style={styles.infoContainer}>
            <Text style={styles.primaryInfo}>
              {item.salary} {item.currency || 'USD'}
              {item.salaryType === 'hourly' ? '/hr' : item.salaryType === 'daily' ? '/day' : '/week'}
            </Text>
            <Text style={styles.secondaryInfo}>
              {item.type} • {item.experienceRequired ? 'Experience required' : 'No experience needed'}
            </Text>
          </View>
        )}

        {/* Location and time info row - Always show both */}
        <View style={styles.metaRow}>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={Colors.muted} />
            <Text style={styles.locationText}>{distanceLabel || item.location || 'Location not specified'}</Text>
          </View>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={12} color={Colors.muted} />
            <Text style={styles.timeText}>{timeAgoText}</Text>
          </View>
        </View>

        {/* Tags/Keywords if available */}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default JobItem;

const styles = StyleSheet.create({
  jobCard: { 
    marginBottom: 8, 
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardContent: {
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeButton: {
    backgroundColor: Colors.primary + '15',
    borderRadius: 16,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  jobTitle: { 
    fontWeight: '600', 
    fontSize: 16,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 2,
  },
  timeAgo: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: '400',
  },
  saveButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveButtonActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  infoContainer: {
    marginBottom: 8,
  },
  primaryInfo: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 3,
  },
  secondaryInfo: {
    fontSize: 12,
    color: Colors.muted,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationText: {
    fontSize: 12,
    color: Colors.muted,
    marginLeft: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  timeText: {
    fontSize: 12,
    color: Colors.muted,
    marginLeft: 4,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tag: {
    backgroundColor: Colors.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 3,
  },
  tagText: {
    fontSize: 10,
    color: Colors.muted,
  },
});
