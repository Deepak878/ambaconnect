import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
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

export default function JobItem({ item, onOpen, onSave, saved, userLocation }) {
  const primaryImage = (item.images && item.images.length && item.images[0]) || item.image || placeholder;
  let distanceLabel = item.location || '';
  if (userLocation && item.lat && item.lng) {
    try {
      const km = haversineKm(userLocation.latitude, userLocation.longitude, item.lat, item.lng);
      if (!isNaN(km)) {
        distanceLabel = km < 1 ? `${Math.round(km*1000)} m away` : `${km.toFixed(1)} km away`;
      }
    } catch (e) {}
  }

  return (
    <TouchableOpacity style={[shared.card, styles.jobCard]} onPress={() => onOpen(item)}>
      <Image source={typeof primaryImage === 'string' ? { uri: primaryImage } : primaryImage} style={styles.avatar} />
      <View style={{ flex: 1 }}>
        <Text style={styles.jobTitle}>{item.title}</Text>
        {item.kind === 'accommodation' ? (
          <>
            <Text style={styles.jobMeta}>Rent: {item.rent} {item.currency ? item.currency : ''} • {distanceLabel}</Text>
            {item.availability ? <Text style={styles.jobMeta}>Availability: {item.availability}</Text> : null}
          </>
        ) : (
          <>
            <Text style={styles.jobMeta}>{item.type} • {distanceLabel}</Text>
            <Text style={styles.jobMeta}>{item.salary} {item.currency ? item.currency : ''} {item.salaryType === 'hourly' ? '/hr' : '/week'}</Text>
          </>
        )}
      </View>
      <TouchableOpacity onPress={() => onSave(item)} style={[styles.saveButton, saved ? { backgroundColor: Colors.accent, borderColor: Colors.accent } : { backgroundColor: Colors.card, borderColor: Colors.primary }]}>
        <Text style={{ color: saved ? Colors.card : Colors.primary, fontWeight: '700' }}>{saved ? 'Saved' : 'Save'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  jobCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 12, marginRight: 12 },
  jobTitle: { fontWeight: '800', fontSize: 16 },
  jobMeta: { color: Colors.muted, marginTop: 6 },
  saveButton: { padding: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.card },
});
