
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors, shared } from './Theme';
import { db } from '../firebaseConfig';
import { collection, query as fsQuery, orderBy, onSnapshot } from 'firebase/firestore';

export default function MapScreen({ jobs: propJobs = [], accommodations: propAccom = [], userLocation = null, onOpenJob = () => {}, onSave = null, savedIds = [] }) {
  const mapRef = useRef(null);
  const listRef = useRef(null);
  const [mode, setMode] = useState('all'); // 'all' | 'jobs' | 'accommodations'
  const [jobFilter, setJobFilter] = useState('all'); // 'all' | 'part' | 'full'
  const [accomFilter, setAccomFilter] = useState('all'); // 'all' | 'owned' | 'shared'
  const [selectedJobForPros, setSelectedJobForPros] = useState(null);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState(propJobs || []);
  const [accommodations, setAccommodations] = useState(propAccom || []);


  useEffect(() => {
    runSearch();
  }, [mode, jobFilter, jobs, accommodations, userLocation, accomFilter]);

  useEffect(() => {
    // subscribe to Firestore jobs and accommodations
    const qJobs = fsQuery(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const qAcc = fsQuery(collection(db, 'accommodations'), orderBy('createdAt', 'desc'));
    
    const unsubJobs = onSnapshot(qJobs, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}), kind: 'job' }));
      // Ensure unique jobs by id
      const uniqueJobs = arr.filter((job, index, self) => 
        index === self.findIndex(t => t.id === job.id)
      );
      setJobs(uniqueJobs);
    }, err => console.warn('jobs snapshot error', err));
    
    const unsubAcc = onSnapshot(qAcc, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}), kind: 'accommodation' }));
      // Ensure unique accommodations by id
      const uniqueAcc = arr.filter((acc, index, self) => 
        index === self.findIndex(t => t.id === acc.id)
      );
      setAccommodations(uniqueAcc);
    }, err => console.warn('accommodations snapshot error', err));

    return () => { unsubJobs(); unsubAcc(); };
  }, []);

  function runSearch() {
    console.log(`MapScreen runSearch - mode: ${mode}, accomFilter: ${accomFilter}, jobFilter: ${jobFilter}`);
    console.log(`Available accommodations: ${accommodations.length}`);
    
    let items = [];

    if (mode === 'jobs' || mode === 'all') {
      const found = (jobs || []).filter(j => {
        if (jobFilter === 'part') return (j.type || '').toLowerCase().includes('part');
        if (jobFilter === 'full') return (j.type || '').toLowerCase().includes('full');
        return true;
      }).map(j => ({ ...j, _type: 'job' }));
      console.log(`Found ${found.length} jobs after filtering`);
      items = items.concat(found);
    }

    if (mode === 'accommodations' || mode === 'all') {
      let found = (accommodations || []).map(a => ({ ...a, _type: 'accommodation' }));
      console.log(`Initial accommodations before filtering: ${found.length}`);
      
      // Debug: log first few accommodations to see their availability field
      found.slice(0, 3).forEach((acc, index) => {
        console.log(`Accommodation ${index + 1}: ${acc.title}, availability: "${acc.availability}"`);
      });

      if (mode === 'accommodations' && accomFilter === 'owned') {
        // Filter for "Whole" places (owned/private)
        found = found.filter(a => a.availability === 'Whole');
        console.log(`Found ${found.length} owned accommodations (availability === 'Whole')`);
      } else if (mode === 'accommodations' && accomFilter === 'shared') {
        // Filter for "Sharing" places
        found = found.filter(a => a.availability === 'Sharing');
        console.log(`Found ${found.length} shared accommodations (availability === 'Sharing')`);
      }
      

      items = items.concat(found);
    }

    // Remove duplicates based on id and _type combination
    const uniqueItems = items.filter((item, index, self) => 
      index === self.findIndex((t) => t.id === item.id && t._type === item._type)
    );

    console.log(`Total unique items after filtering: ${uniqueItems.length}`);

    const withDist = uniqueItems.map(it => {
      if (userLocation && it.lat != null && it.lng != null) {
        const dist = haversine(userLocation.latitude, userLocation.longitude, it.lat, it.lng);
        return { ...it, _distance: dist };
      }
      return it;
    });

    const sorted = (userLocation) ? withDist.sort((a,b) => (a._distance || 1e9) - (b._distance || 1e9)) : withDist;
    console.log(`Final sorted results: ${sorted.length}`);
    setResults(sorted);
    
    // Maintain selection if the selected item is still in results
    if (selected) {
      const stillExists = sorted.find(item => 
        item.id === selected.id && (item._type || item.kind) === (selected._type || selected.kind)
      );
      if (stillExists) {
        setSelected(stillExists);
      } else {
        // If selected item no longer exists, select first item
        setSelected(sorted.length ? sorted[0] : null);
      }
    } else if (sorted.length) {
      setSelected(sorted[0]);
    }
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const toRad = v => v * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function formatTimeAgo(createdAt) {
    if (!createdAt) return '';
    
    try {
      let date;
      // Handle Firestore timestamp objects
      if (typeof createdAt === 'object' && createdAt.toDate) {
        date = createdAt.toDate();
      } else {
        date = new Date(createdAt);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) return '';
      
      const now = new Date();
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
  }

  function centerOn(item) {
    if (!item || !mapRef.current) return;
    const lat = item.lat || item.latitude || (item.locationLat) || (item.coords && item.coords.latitude);
    const lng = item.lng || item.longitude || (item.locationLng) || (item.coords && item.coords.longitude);
    if (lat == null || lng == null) return;
    mapRef.current.animateToRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 400);
    setSelected(item);
  }

  function scrollToItem(item) {
    if (!item || !listRef.current || !results.length) return;
    
    const index = results.findIndex(r => r.id === item.id && (r._type || r.kind) === (item._type || item.kind));
    if (index !== -1) {
      listRef.current.scrollToIndex({ 
        index, 
        animated: true,
        viewPosition: 0.5 // Center the item in the view
      });
    }
  }

  function onMarkerPress(item) {
    setSelected(item);
    scrollToItem(item);
  }

  function onCardPress(item) {
    setSelected(item);
    centerOn(item);
  }

  function onCardDoublePress(item) {
    onOpenJob(item);
  }

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBar}>
        <View style={styles.segment}>
          <TouchableOpacity 
            style={[styles.segBtn, mode === 'all' && styles.segActive]} 
            onPress={() => { setMode('all'); }}
          >
            <Ionicons 
              name="apps" 
              size={16} 
              color={mode === 'all' ? Colors.card : Colors.text} 
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.segTxt, mode === 'all' && styles.segTxtActive]}>All</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.segBtn, mode === 'jobs' && styles.segActive]} 
            onPress={() => setMode('jobs')}
          >
            <Ionicons 
              name="briefcase" 
              size={16} 
              color={mode === 'jobs' ? Colors.card : Colors.text} 
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.segTxt, mode === 'jobs' && styles.segTxtActive]}>Jobs</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.segBtn, mode === 'accommodations' && styles.segActive]} 
            onPress={() => setMode('accommodations')}
          >
            <Ionicons 
              name="home" 
              size={16} 
              color={mode === 'accommodations' ? Colors.card : Colors.text} 
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.segTxt, mode === 'accommodations' && styles.segTxtActive]}>Housing</Text>
          </TouchableOpacity>
        </View>

        {/* Job and accommodation specific filters */}
        {mode !== 'all' && (
          <View style={styles.filterSection}>
            {mode === 'jobs' && (
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Job Type:</Text>
                <View style={styles.filterButtons}>
                  <TouchableOpacity 
                    style={[styles.filterBtn, jobFilter === 'all' && styles.filterActive]} 
                    onPress={() => setJobFilter('all')}
                  >
                    <Text style={[styles.filterTxt, jobFilter === 'all' && styles.filterTxtActive]}>All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.filterBtn, jobFilter === 'part' && styles.filterActive]} 
                    onPress={() => setJobFilter('part')}
                  >
                    <Text style={[styles.filterTxt, jobFilter === 'part' && styles.filterTxtActive]}>Part-time</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.filterBtn, jobFilter === 'full' && styles.filterActive]} 
                    onPress={() => setJobFilter('full')}
                  >
                    <Text style={[styles.filterTxt, jobFilter === 'full' && styles.filterTxtActive]}>Full-time</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {mode === 'accommodations' && (
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Type:</Text>
                <View style={styles.filterButtons}>
                  <TouchableOpacity 
                    style={[styles.filterBtn, accomFilter === 'all' && styles.filterActive]} 
                    onPress={() => setAccomFilter('all')}
                  >
                    <Text style={[styles.filterTxt, accomFilter === 'all' && styles.filterTxtActive]}>All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.filterBtn, accomFilter === 'owned' && styles.filterActive]} 
                    onPress={() => setAccomFilter('owned')}
                  >
                    <Text style={[styles.filterTxt, accomFilter === 'owned' && styles.filterTxtActive]}>Owned</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.filterBtn, accomFilter === 'shared' && styles.filterActive]} 
                    onPress={() => setAccomFilter('shared')}
                  >
                    <Text style={[styles.filterTxt, accomFilter === 'shared' && styles.filterTxtActive]}>Shared</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: userLocation?.latitude || 20,
          longitude: userLocation?.longitude || 0,
          latitudeDelta: 40,
          longitudeDelta: 40,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {results.map(r => {
          const lat = r.lat || r.latitude || r.locationLat;
          const lng = r.lng || r.longitude || r.locationLng;
          if (lat == null || lng == null) return null;
          
          const isAccommodation = r.kind === 'accommodation' || r._type === 'accommodation';
          const uniqueKey = `${r._type || r.kind || 'item'}-${r.id}`;
          
          return (
            <Marker 
              key={uniqueKey} 
              coordinate={{ latitude: lat, longitude: lng }} 
              onPress={() => { onMarkerPress(r); }}
            >
              <View style={[
                styles.customMarker, 
                { backgroundColor: isAccommodation ? Colors.secondary || '#FF6B6B' : Colors.primary },
                selected && selected.id === r.id && (selected._type || selected.kind) === (r._type || r.kind) && styles.selectedMarker
              ]}>
                <Ionicons 
                  name={isAccommodation ? 'home' : 'briefcase'} 
                  size={16} 
                  color={Colors.card} 
                />
              </View>
              <Callout onPress={() => onOpenJob(r)}>
                <View style={styles.calloutContainer}>
                  <View style={styles.calloutHeader}>
                    <Ionicons 
                      name={isAccommodation ? 'home' : 'briefcase'} 
                      size={16} 
                      color={Colors.primary} 
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.calloutTitle}>{r.name || r.title}</Text>
                  </View>
                  <Text style={styles.calloutLocation}>
                    {r._distance != null ? 
                      (r._distance < 1 ? `${Math.round(r._distance * 1000)} m away` : `${r._distance.toFixed(1)} km away`) : 
                      (r.location || r.country || '')
                    }
                  </Text>
                  {isAccommodation ? (
                    <Text style={styles.calloutPrice}>
                      {r.rent} {r.currency || 'USD'}/month
                    </Text>
                  ) : (
                    <Text style={styles.calloutPrice}>
                      {r.salary} {r.currency || 'USD'}
                      {r.salaryType === 'hourly' ? '/hr' : r.salaryType === 'daily' ? '/day' : '/week'}
                    </Text>
                  )}
                  {formatTimeAgo(r.createdAt) && (
                    <Text style={styles.calloutTime}>
                      {formatTimeAgo(r.createdAt)}
                    </Text>
                  )}
                  <Text style={styles.calloutAction}>Tap for details →</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* small info panel shown when marker/card selected */}
      {/* Marker popup removed — marker press now opens the job detail modal directly */}

      {/* Detail modal for full info */}
      {/* Full detail modal removed from here — Map markers/cards open the main JobDetailModal via onOpenJob */}

      <View style={styles.resultsContainer}>
        <View style={styles.resultsHeader}>
          <View style={styles.resultsHeaderContent}>
            <Text style={styles.resultsTitle}>
              {results.length} {mode === 'jobs' ? 'jobs' : mode === 'accommodations' ? 'accommodations' : 'listings'} found
            </Text>
            <Text style={styles.resultsSubtitle}>
              Tap card to center map • Tap ⓘ for details
            </Text>
          </View>
        </View>
        <FlatList
          ref={listRef}
          data={results}
          horizontal
          keyExtractor={(item) => `${item._type || item.kind || 'item'}-${item.id}`}
          showsHorizontalScrollIndicator={false}
          onScrollToIndexFailed={(info) => {
            // Handle scroll failure gracefully
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: true });
            });
          }}
          renderItem={({ item }) => {
            const isAccommodation = item.kind === 'accommodation' || item._type === 'accommodation';
            const isSaved = savedIds && savedIds.includes(item.id);
            
            return (
              <TouchableOpacity 
                onPress={() => onCardPress(item)}
                onLongPress={() => onCardDoublePress(item)}
                style={[
                  styles.resultCard, 
                  selected && selected.id === item.id && (selected._type || selected.kind) === (item._type || item.kind) && styles.resultActive
                ]}
              >
                <View style={styles.resultHeader}>
                  <View style={[styles.resultTypeIcon, { 
                    backgroundColor: isAccommodation ? (Colors.secondary || '#FF6B6B') + '20' : Colors.primary + '20' 
                  }]}>
                    <Ionicons 
                      name={isAccommodation ? 'home' : 'briefcase'} 
                      size={16} 
                      color={isAccommodation ? Colors.secondary || '#FF6B6B' : Colors.primary} 
                    />
                  </View>
                  {onSave && (
                    <TouchableOpacity 
                      onPress={() => onSave(item)} 
                      style={styles.resultSaveBtn}
                    >
                      <Ionicons 
                        name={isSaved ? "heart" : "heart-outline"} 
                        size={14} 
                        color={isSaved ? Colors.primary : Colors.muted} 
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    onPress={() => onCardDoublePress(item)} 
                    style={styles.resultDetailBtn}
                  >
                    <Ionicons 
                      name="information-circle-outline" 
                      size={14} 
                      color={Colors.primary} 
                    />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {item.name || item.title}
                </Text>
                
                <Text style={styles.resultPrice}>
                  {isAccommodation ? 
                    `${item.rent} ${item.currency || 'USD'}/month` :
                    `${item.salary} ${item.currency || 'USD'}${item.salaryType === 'hourly' ? '/hr' : item.salaryType === 'daily' ? '/day' : '/week'}`
                  }
                </Text>
                
                {/* Time and location row */}
                <View style={styles.resultMetaRow}>
                  <View style={styles.resultLocation}>
                    <Ionicons name="location-outline" size={12} color={Colors.muted} />
                    <Text style={styles.resultSub}>
                      {item._distance != null ? 
                        (item._distance < 1 ? `${Math.round(item._distance * 1000)} m` : `${item._distance.toFixed(1)} km`) : 
                        (item.location || item.country || '')
                      }
                    </Text>
                  </View>
                  
                  {/* Time display */}
                  {formatTimeAgo(item.createdAt) && (
                    <View style={styles.resultTime}>
                      <Ionicons name="time-outline" size={12} color={Colors.muted} />
                      <Text style={styles.resultSub}>
                        {formatTimeAgo(item.createdAt)}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    paddingTop: Platform.OS === 'ios' ? 18 : 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  segment: { 
    flexDirection: 'row', 
    marginBottom: 12 
  },
  segBtn: { 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
    borderRadius: 20, 
    marginRight: 8, 
    backgroundColor: Colors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segActive: { 
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  segTxt: { 
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  segTxtActive: {
    color: Colors.card,
  },
  filterSection: {
    marginBottom: 8,
  },
  filterRow: {
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  filterButtons: {
    flexDirection: 'row',
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterTxt: {
    fontSize: 12,
    color: Colors.text,
  },
  filterTxtActive: {
    color: Colors.card,
  },
  customMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  selectedMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: Colors.card,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
    transform: [{ scale: 1.1 }],
  },
  calloutContainer: {
    maxWidth: 240,
    minWidth: 200,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  calloutTitle: {
    fontWeight: '600',
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  calloutLocation: {
    color: Colors.muted,
    fontSize: 12,
    marginBottom: 4,
  },
  calloutPrice: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  calloutTime: {
    color: Colors.muted,
    fontSize: 11,
    marginBottom: 6,
  },
  calloutAction: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  resultsContainer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultsHeaderContent: {
    flexDirection: 'column',
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  resultsSubtitle: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 2,
  },
  resultCard: { 
    backgroundColor: Colors.card, 
    padding: 12, 
    marginRight: 12,
    marginLeft: 4,
    marginVertical: 8,
    borderRadius: 12, 
    width: 200,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultActive: { 
    borderWidth: 2, 
    borderColor: Colors.primary,
    shadowOpacity: 0.2,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultTypeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultSaveBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg,
  },
  resultDetailBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary + '20',
    marginLeft: 4,
  },
  resultTitle: { 
    fontWeight: '600',
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
    lineHeight: 18,
  },
  resultPrice: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  resultLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  resultTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultSub: { 
    color: Colors.muted, 
    fontSize: 12,
    marginLeft: 4,
  },
});
