import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebaseConfig';
import { 
  collection, 
  query as fsQuery, 
  orderBy, 
  onSnapshot, 
  limit, 
  startAfter,
  getDocs
} from 'firebase/firestore';
import JobItem from './JobItem';
import RefreshingCard from './RefreshingCard';
import { Colors, shared } from './Theme';
import { ListSkeleton } from './SkeletonLoader';
import { useDebouncedSearch } from '../hooks';
import { dataCache } from '../utils/dataCache';

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
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState({ jobs: true, accommodations: true });
  const [lastVisible, setLastVisible] = useState({ jobs: null, accommodations: null });
  
  const BATCH_SIZE = 10; // Smaller batch size for better initial load performance
  
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

  // Create display data with refreshing card when pulling to refresh
  const displayData = useMemo(() => {
    // If refreshing and we have existing data, show refreshing card first
    if (refreshing && filteredAndSortedJobs.length > 0) {
      return [
        { id: '__refreshing__', isRefreshingCard: true }, // Special marker for refreshing card
        ...filteredAndSortedJobs
      ];
    }
    
    // Otherwise just show the normal filtered data
    return filteredAndSortedJobs;
  }, [refreshing, filteredAndSortedJobs]);

  // Remove the old debounced query effect since we're using the hook
  // useEffect(() => {
  //   const timeoutId = setTimeout(() => {
  //     // Query change handled by memoized filteredAndSortedJobs
  //   }, 300);
  //   
  //   return () => clearTimeout(timeoutId);
  // }, [query]);

  // Load data from cache first, then network if needed
  const loadInitialData = useCallback(async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        // Try to load from cache first
        const [cachedJobs, cachedAccommodations] = await Promise.all([
          dataCache.getCachedJobs(),
          dataCache.getCachedAccommodations()
        ]);

        if (cachedJobs && cachedAccommodations) {
          // Use cached data
          const allJobs = [...cachedJobs.data, ...cachedAccommodations.data];
          setJobs(allJobs);
          setLoading(false);
          
          console.log('Loaded data from cache:', {
            jobs: cachedJobs.data.length,
            accommodations: cachedAccommodations.data.length,
            remainingTime: dataCache.formatRemainingTime(Math.min(cachedJobs.remainingTime, cachedAccommodations.remainingTime))
          });
          
          return; // Don't load from network
        }
      }

      // Load from network
      await loadFromNetwork();
      
    } catch (error) {
      console.warn('Error loading initial data:', error);
      setLoading(false);
    }
  }, []);

  // Load data from Firestore and cache it
  const loadFromNetwork = useCallback(async () => {
    setLoading(true);
    
    try {
      // Load jobs
      const jobsQuery = fsQuery(
        collection(db, 'jobs'), 
        orderBy('createdAt', 'desc'),
        limit(BATCH_SIZE)
      );
      
      const jobsSnapshot = await getDocs(jobsQuery);
      const jobsData = jobsSnapshot.docs.map(d => ({ 
        id: d.id, 
        kind: 'job',
        ...d.data() 
      }));
      
      // Load accommodations
      const accommodationsQuery = fsQuery(
        collection(db, 'accommodations'), 
        orderBy('createdAt', 'desc'),
        limit(BATCH_SIZE)
      );
      
      const accommodationsSnapshot = await getDocs(accommodationsQuery);
      const accommodationsData = accommodationsSnapshot.docs.map(d => ({ 
        id: d.id, 
        kind: 'accommodation',
        ...d.data() 
      }));

      // Combine and set jobs
      const allJobs = [...jobsData, ...accommodationsData];
      setJobs(allJobs);

      // Update pagination state
      const newLastVisible = {
        jobs: jobsSnapshot.docs[jobsSnapshot.docs.length - 1] || null,
        accommodations: accommodationsSnapshot.docs[accommodationsSnapshot.docs.length - 1] || null
      };
      setLastVisible(newLastVisible);
      
      const newHasMore = {
        jobs: jobsSnapshot.docs.length === BATCH_SIZE,
        accommodations: accommodationsSnapshot.docs.length === BATCH_SIZE
      };
      setHasMore(newHasMore);

      // Cache the data
      await Promise.all([
        dataCache.saveJobs(jobsData),
        dataCache.saveAccommodations(accommodationsData),
        dataCache.savePaginationState(newHasMore, newLastVisible)
      ]);

      console.log('Loaded data from network and cached:', {
        jobs: jobsData.length,
        accommodations: accommodationsData.length
      });
      
    } catch (error) {
      console.warn('Error loading from network:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh timer - check every minute if data needs refresh
  useEffect(() => {
    const checkForStaleData = async () => {
      const [cachedJobs, cachedAccommodations] = await Promise.all([
        dataCache.getCachedJobs(),
        dataCache.getCachedAccommodations()
      ]);
      
      // If either cache is stale, auto-refresh
      if (!cachedJobs || !cachedAccommodations) {
        console.log('Cache expired, auto-refreshing...');
        await loadInitialData(true);
      }
    };
    
    // Check every minute
    const interval = setInterval(checkForStaleData, 60000);
    
    return () => clearInterval(interval);
  }, [loadInitialData]);

  // Initial data load - try cache first, then network
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialData(true); // Force refresh from network
  }, [loadInitialData]);

  // Load more jobs when scrolling - with proper pagination
  const loadMoreJobs = useCallback(async () => {
    if (loadingMore || refreshing) return;
    
    // Check if we can load more of either type
    const canLoadMoreJobs = hasMore.jobs && lastVisible.jobs;
    const canLoadMoreAccommodations = hasMore.accommodations && lastVisible.accommodations;
    
    if (!canLoadMoreJobs && !canLoadMoreAccommodations) return;
    
    setLoadingMore(true);
    
    try {
      const newJobs = [];
      const newAccommodations = [];
      
      // Load more jobs if available
      if (canLoadMoreJobs) {
        const nextJobsQuery = fsQuery(
          collection(db, 'jobs'),
          orderBy('createdAt', 'desc'),
          startAfter(lastVisible.jobs),
          limit(BATCH_SIZE)
        );
        
        const jobsSnapshot = await getDocs(nextJobsQuery);
        const moreJobs = jobsSnapshot.docs.map(d => ({ 
          id: d.id, 
          kind: 'job',
          ...d.data() 
        }));
        
        newJobs.push(...moreJobs);
        
        // Update pagination state for jobs
        if (jobsSnapshot.docs.length > 0) {
          const lastJobDoc = jobsSnapshot.docs[jobsSnapshot.docs.length - 1];
          setLastVisible(prev => ({ ...prev, jobs: lastJobDoc }));
        }
        setHasMore(prev => ({ ...prev, jobs: jobsSnapshot.docs.length === BATCH_SIZE }));
      }
      
      // Load more accommodations if available
      if (canLoadMoreAccommodations) {
        const nextAccommodationsQuery = fsQuery(
          collection(db, 'accommodations'),
          orderBy('createdAt', 'desc'),
          startAfter(lastVisible.accommodations),
          limit(BATCH_SIZE)
        );
        
        const accommodationsSnapshot = await getDocs(nextAccommodationsQuery);
        const moreAccommodations = accommodationsSnapshot.docs.map(d => ({ 
          id: d.id, 
          kind: 'accommodation',
          ...d.data() 
        }));
        
        newAccommodations.push(...moreAccommodations);
        
        // Update pagination state for accommodations
        if (accommodationsSnapshot.docs.length > 0) {
          const lastAccDoc = accommodationsSnapshot.docs[accommodationsSnapshot.docs.length - 1];
          setLastVisible(prev => ({ ...prev, accommodations: lastAccDoc }));
        }
        setHasMore(prev => ({ ...prev, accommodations: accommodationsSnapshot.docs.length === BATCH_SIZE }));
      }
      
      // Add new items to existing jobs
      if (newJobs.length > 0 || newAccommodations.length > 0) {
        setJobs(prevJobs => [...prevJobs, ...newJobs, ...newAccommodations]);
      }
      
    } catch (error) {
      console.warn('Error loading more jobs:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, refreshing, hasMore, lastVisible]);

  // Memoized render item to prevent unnecessary re-renders
  const renderJobItem = useCallback(({ item }) => {
    // Render refreshing card for the special marker
    if (item.isRefreshingCard) {
      return (
        <View style={{ paddingHorizontal: 12 }}>
          <RefreshingCard />
        </View>
      );
    }
    
    // Render normal job item
    return (
      <View style={{ paddingHorizontal: 12 }}>
        <JobItem 
          item={item} 
          onOpen={onOpenJob} 
          onSave={onSaveJob} 
          saved={savedIds.includes(item.id)} 
          userLocation={userLocation} 
        />
      </View>
    );
  }, [onOpenJob, onSaveJob, savedIds, userLocation]);

  const keyExtractor = useCallback((item) => {
    // Handle refreshing card
    if (item.isRefreshingCard) {
      return '__refreshing__';
    }
    // Handle normal job items
    return item.id;
  }, []);

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
          data={displayData}
          keyExtractor={keyExtractor}
          renderItem={renderJobItem}
          contentContainerStyle={{ paddingVertical: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
              title="Pull to refresh"
              titleColor={Colors.muted}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ textAlign: 'center', color: Colors.muted, marginBottom: 8 }}>
                No jobs found
              </Text>
              {!loading && (
                <TouchableOpacity 
                  onPress={() => handleRefresh()}
                  style={[shared.smallButton, { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                >
                  <Text style={{ color: Colors.card }}>Refresh</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={8}
          getItemLayout={null} // Let FlatList calculate automatically for better performance
          onEndReached={loadMoreJobs}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ListSkeleton count={2} />
              </View>
            ) : (
              (hasMore.jobs || hasMore.accommodations) ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: Colors.muted, fontSize: 12 }}>
                    Pull up to load more...
                  </Text>
                </View>
              ) : (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: Colors.muted, fontSize: 12 }}>
                    No more jobs to load
                  </Text>
                </View>
              )
            )
          }
        />
      )}
    </View>
  );
}
