import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebaseConfig';
import { 
  collection, 
  query as fsQuery, 
  orderBy, 
  onSnapshot, 
  limit, 
  startAfter 
} from 'firebase/firestore';
import JobItem from './JobItem';
import { Colors, shared } from './Theme';
import { ListSkeleton } from './SkeletonLoader';
import { useDebouncedSearch } from '../hooks';

// Performance optimized distance calculation with memoization
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
  
  // Cache with size limit
  if (distanceCache.size > 1000) {
    const firstKey = distanceCache.keys().next().value;
    distanceCache.delete(firstKey);
  }
  distanceCache.set(key, distance);
  
  return distance;
};

export default function JobsScreen({ jobs: propJobs, onOpenJob, onSaveJob, savedIds, filters, userLocation }) {
  const [query, setQuery] = useState('');
  const [partTimeOnly, setPartTimeOnly] = useState(filters?.partTimeOnly || false);
  const [filterKind, setFilterKind] = useState('all'); // 'all' | 'job' | 'accommodation'
  const [sortBy, setSortBy] = useState('distance'); // 'distance' | 'time'
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState(null);
  
  const BATCH_SIZE = 20; // Load jobs in batches for better performance
  
  // Use debounced search for better performance
  const debouncedQuery = useDebouncedSearch(query, 300);

  // Memoized job enrichment with distance calculations
  const enrichedJobs = useMemo(() => {
    if (!userLocation) return jobs;
    
    return jobs.map(j => {
      if (j._distanceKm !== undefined) return j; // Already calculated
      
      let distance = null;
      if (j.lat && j.lng) {
        try { 
          distance = haversineKm(userLocation.latitude, userLocation.longitude, j.lat, j.lng); 
        } catch (e) { 
          distance = null; 
        }
      }
      return { ...j, _distanceKm: distance };
    });
  }, [jobs, userLocation]);

  // Optimized search function with debouncing
  const searchJobs = useCallback((searchQuery, jobsList) => {
    if (!searchQuery.trim()) return jobsList;
    
    const lowerQuery = searchQuery.toLowerCase();
    return jobsList.filter(j => {
      const searchText = `${j.title || ''} ${j.description || ''} ${j.location || ''}`.toLowerCase();
      return searchText.includes(lowerQuery);
    });
  }, []);

  // Memoized filtering and sorting with debounced search
  const filteredAndSortedJobs = useMemo(() => {
    // Apply search filter with debounced query
    let filtered = searchJobs(debouncedQuery, enrichedJobs);
    
    // Apply type filter
    if (partTimeOnly) {
      filtered = filtered.filter(j => (j.type || '').toLowerCase().includes('part'));
    }
    
    // Apply kind filter
    if (filterKind !== 'all') {
      const targetKind = filterKind === 'job' ? 'job' : 'accommodation';
      filtered = filtered.filter(j => j.kind === targetKind);
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      if (sortBy === 'distance') {
        // Sort by distance (nearest to farthest)
        if (a._distanceKm == null && b._distanceKm == null) return 0;
        if (a._distanceKm == null) return 1;
        if (b._distanceKm == null) return -1;
        return a._distanceKm - b._distanceKm;
      } else {
        // Sort by time (latest to oldest) - optimized date parsing
        try {
          const getDateValue = (item) => {
            if (!item.createdAt) return 0;
            if (typeof item.createdAt === 'object' && item.createdAt.toDate) {
              return item.createdAt.toDate().getTime();
            }
            const date = new Date(item.createdAt);
            return isNaN(date.getTime()) ? 0 : date.getTime();
          };
          
          return getDateValue(b) - getDateValue(a); // Latest first
        } catch (error) {
          console.warn('Error sorting by time:', error);
          return 0;
        }
      }
    });
  }, [enrichedJobs, debouncedQuery, partTimeOnly, filterKind, sortBy, searchJobs]);

  // Remove the old debounced query effect since we're using the hook
  // useEffect(() => {
  //   const timeoutId = setTimeout(() => {
  //     // Query change handled by memoized filteredAndSortedJobs
  //   }, 300);
  //   
  //   return () => clearTimeout(timeoutId);
  // }, [query]);

  // Optimized Firestore subscriptions
  useEffect(() => {
    let unsubscribers = [];
    let jobsData = [];
    let accommodationsData = [];
    let jobsLoaded = false;
    let accommodationsLoaded = false;

    const checkAndUpdateJobs = () => {
      if (jobsLoaded && accommodationsLoaded) {
        setJobs([...jobsData, ...accommodationsData]);
        setLoading(false);
      }
    };

    // Optimized jobs subscription with pagination
    const jobsQuery = fsQuery(
      collection(db, 'jobs'), 
      orderBy('createdAt', 'desc'),
      limit(BATCH_SIZE)
    );
    
    const jobsUnsub = onSnapshot(jobsQuery, 
      snap => {
        jobsData = snap.docs.map(d => ({ 
          id: d.id, 
          kind: 'job',
          ...d.data() 
        }));
        jobsLoaded = true;
        checkAndUpdateJobs();
        
        // Set pagination state
        const lastDoc = snap.docs[snap.docs.length - 1];
        setLastVisible(lastDoc || null);
        setHasMore(snap.docs.length === BATCH_SIZE);
      }, 
      err => {
        console.warn('jobs snapshot error', err);
        jobsLoaded = true;
        checkAndUpdateJobs();
      }
    );

    // Optimized accommodations subscription
    const accommodationsQuery = fsQuery(
      collection(db, 'accommodations'), 
      orderBy('createdAt', 'desc'),
      limit(BATCH_SIZE)
    );
    
    const accommodationsUnsub = onSnapshot(accommodationsQuery,
      snap => {
        accommodationsData = snap.docs.map(d => ({ 
          id: d.id, 
          kind: 'accommodation',
          ...d.data() 
        }));
        accommodationsLoaded = true;
        checkAndUpdateJobs();
      },
      err => {
        console.warn('accommodations snapshot error', err);
        accommodationsLoaded = true;
        checkAndUpdateJobs();
      }
    );

    unsubscribers.push(jobsUnsub, accommodationsUnsub);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  // Load more jobs when scrolling
  const loadMoreJobs = useCallback(async () => {
    if (!hasMore || loadingMore || !lastVisible) return;
    
    setLoadingMore(true);
    try {
      // This would need to be implemented based on your pagination needs
      // For now, we'll just disable loading more to prevent infinite loading
      setHasMore(false);
    } catch (error) {
      console.warn('Error loading more jobs:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, lastVisible]);

  // Memoized render item to prevent unnecessary re-renders
  const renderJobItem = useCallback(({ item }) => (
    <View style={{ paddingHorizontal: 12 }}>
      <JobItem 
        item={item} 
        onOpen={onOpenJob} 
        onSave={onSaveJob} 
        saved={savedIds.includes(item.id)} 
        userLocation={userLocation} 
      />
    </View>
  ), [onOpenJob, onSaveJob, savedIds, userLocation]);

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <View style={{ flex: 1 }}>
      {/* Search Input */}
      <View style={{ flexDirection: 'row', padding: 12, alignItems: 'center' }}>
        <TextInput 
          placeholder="Search jobs or location" 
          value={query} 
          onChangeText={setQuery} 
          style={[shared.input, { flex: 1 }]}
          returnKeyType="search"
        />
      </View>

      {/* Filters and Sort */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, alignItems: 'center' }}>
        <TouchableOpacity 
          onPress={() => setFilterKind('all')} 
          style={[shared.smallButton, { 
            marginRight: 8, 
            backgroundColor: filterKind==='all'?Colors.primary:Colors.card, 
            borderColor: filterKind==='all'?Colors.primary:Colors.border 
          }]}
        >
          <Text style={{ color: filterKind==='all'?Colors.card:Colors.muted }}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setFilterKind('job')} 
          style={[shared.smallButton, { 
            marginRight: 8, 
            backgroundColor: filterKind==='job'?Colors.primary:Colors.card, 
            borderColor: filterKind==='job'?Colors.primary:Colors.border 
          }]}
        >
          <Text style={{ color: filterKind==='job'?Colors.card:Colors.muted }}>Jobs</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setFilterKind('accommodation')} 
          style={[shared.smallButton, { 
            marginRight: 8, 
            backgroundColor: filterKind==='accommodation'?Colors.primary:Colors.card, 
            borderColor: filterKind==='accommodation'?Colors.primary:Colors.border 
          }]}
        >
          <Text style={{ color: filterKind==='accommodation'?Colors.card:Colors.muted }}>Accommodation</Text>
        </TouchableOpacity>
        
        <View style={{ flex: 1 }} />
        
        <TouchableOpacity 
          style={[shared.smallButton, { 
            marginRight: 8, 
            backgroundColor: partTimeOnly ? Colors.primary : Colors.card, 
            borderColor: partTimeOnly ? Colors.primary : Colors.border 
          }]} 
          onPress={() => setPartTimeOnly(!partTimeOnly)}
        >
          <Text style={{ color: partTimeOnly ? Colors.card : Colors.muted }}>Part-time</Text>
        </TouchableOpacity>
        
        {/* Fixed-size Toggle Sort Button */}
        <TouchableOpacity 
          style={[
            shared.smallButton, 
            { 
              backgroundColor: Colors.primary, 
              borderColor: Colors.primary,
              width: 40,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center'
            }
          ]} 
          onPress={() => setSortBy(sortBy === 'distance' ? 'time' : 'distance')}
        >
          <Ionicons 
            name={sortBy === 'distance' ? 'location-outline' : 'time-outline'} 
            size={14} 
            color={Colors.card}
          />
        </TouchableOpacity>
      </View>

      {/* Performance indicator */}
      {loading ? (
        <ListSkeleton count={6} />
      ) : (
        <FlatList
          data={filteredAndSortedJobs}
          keyExtractor={keyExtractor}
          renderItem={renderJobItem}
          contentContainerStyle={{ paddingVertical: 12 }}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 20, color: Colors.muted }}>
              No jobs found
            </Text>
          }
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={8}
          getItemLayout={null} // Let FlatList calculate automatically for better performance
          onEndReached={loadMoreJobs}
          onEndReachedThreshold={0.1}
          ListFooterComponent={loadingMore ? <ListSkeleton count={2} /> : null}
        />
      )}
    </View>
  );
}
