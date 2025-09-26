import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, FlatList, RefreshControl, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const [sortBy, setSortBy] = useState(userLocation ? 'distance' : 'time'); // 'distance' | 'time' - default to distance if location available
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState({ jobs: true, accommodations: true });
  const [lastVisible, setLastVisible] = useState({ jobs: null, accommodations: null });
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // Advanced filter states
  const [selectedDays, setSelectedDays] = useState([]);
  const [accommodationType, setAccommodationType] = useState('all'); // 'all' | 'owned' | 'sharing'
  
  const BATCH_SIZE = 10; // Smaller batch size for better initial load performance
  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Use debounced search for better performance
  const debouncedQuery = useDebouncedSearch(query, 300);
  
  // Handle sort toggle with debugging
  const handleSortToggle = useCallback(() => {
    const newSortBy = sortBy === 'distance' ? 'time' : 'distance';
    console.log(`Sort button clicked: ${sortBy} -> ${newSortBy}`);
    setSortBy(newSortBy);
  }, [sortBy]);

  // Memoized job enrichment with distance calculations
  const enrichedJobs = useMemo(() => {
    console.log(`Enriching jobs: ${jobs.length} jobs, userLocation:`, userLocation ? 'available' : 'not available');
    
    if (!userLocation) {
      console.log('No user location, returning jobs without distance calculation');
      // Still return jobs but with _distanceKm set to null for consistency
      return jobs.map(j => ({ ...j, _distanceKm: null }));
    }
    
    const enriched = jobs.map(j => {
      if (j._distanceKm !== undefined) return j; // Already calculated
      
      let distance = null;
      if (j.lat && j.lng) {
        try { 
          distance = haversineKm(userLocation.latitude, userLocation.longitude, j.lat, j.lng); 
          console.log(`Distance calculated for ${j.title}: ${distance.toFixed(2)} km`);
        } catch (e) { 
          console.log(`Error calculating distance for ${j.title}:`, e);
          distance = null; 
        }
      } else {
        console.log(`No lat/lng for job: ${j.title}`);
      }
      return { ...j, _distanceKm: distance };
    });
    
    console.log(`Enriched ${enriched.length} jobs, ${enriched.filter(j => j._distanceKm !== null).length} with valid distances`);
    return enriched;
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

    // Apply days of week filter for jobs
    if (selectedDays.length > 0 && filterKind !== 'accommodation') {
      filtered = filtered.filter(j => {
        if (j.kind !== 'job') return true; // Keep accommodations when kind is 'all'
        
        // Check if job has schedule data
        if (!j.schedule || typeof j.schedule !== 'object') return false;
        
        // Convert full day names to short names to match PostScreen format
        const dayMapping = {
          'Monday': 'Mon',
          'Tuesday': 'Tue', 
          'Wednesday': 'Wed',
          'Thursday': 'Thu',
          'Friday': 'Fri',
          'Saturday': 'Sat',
          'Sunday': 'Sun'
        };
        
        // Check if any selected day matches enabled days in job schedule
        return selectedDays.some(selectedDay => {
          const shortDay = dayMapping[selectedDay];
          return j.schedule[shortDay] && j.schedule[shortDay].enabled === true;
        });
      });
    }

    // Apply accommodation type filter
    if (accommodationType !== 'all' && filterKind !== 'job') {
      filtered = filtered.filter(j => {
        if (j.kind !== 'accommodation') return true; // Keep jobs when kind is 'all'
        
        // Check the 'availability' field from PostScreen
        if (accommodationType === 'owned') {
          return j.availability && j.availability.toLowerCase() === 'whole';
        } else if (accommodationType === 'sharing') {
          return j.availability && j.availability.toLowerCase() === 'sharing';
        }
        return true;
      });
    }

    // Apply sorting
    const sorted = filtered.sort((a, b) => {
      if (sortBy === 'distance') {
        // If no user location is available, fall back to time sorting
        if (!userLocation) {
          try {
            const getDateValue = (item) => {
              if (!item.createdAt) return 0;
              if (typeof item.createdAt === 'object' && item.createdAt.toDate) {
                return item.createdAt.toDate().getTime();
              }
              const date = new Date(item.createdAt);
              return isNaN(date.getTime()) ? 0 : date.getTime();
            };
            return getDateValue(b) - getDateValue(a); // Latest first when no location
          } catch (error) {
            return 0;
          }
        }
        
        // Sort by distance (nearest to farthest) - ascending order
        if (a._distanceKm == null && b._distanceKm == null) {
          // If both items don't have distance, sort by time (recent first) as secondary sort
          try {
            const getDateValue = (item) => {
              if (!item.createdAt) return 0;
              if (typeof item.createdAt === 'object' && item.createdAt.toDate) {
                return item.createdAt.toDate().getTime();
              }
              const date = new Date(item.createdAt);
              return isNaN(date.getTime()) ? 0 : date.getTime();
            };
            return getDateValue(b) - getDateValue(a); // Latest first for items without distance
          } catch (error) {
            return 0;
          }
        }
        if (a._distanceKm == null) return 1; // Items without distance go to end
        if (b._distanceKm == null) return -1; // Items with distance come first
        
        // Ascending order: nearest (smallest distance) first
        return a._distanceKm - b._distanceKm;
      } else {
        // Sort by time (latest to oldest) - recent posts first
        try {
          const getDateValue = (item) => {
            if (!item.createdAt) return 0;
            if (typeof item.createdAt === 'object' && item.createdAt.toDate) {
              return item.createdAt.toDate().getTime();
            }
            const date = new Date(item.createdAt);
            return isNaN(date.getTime()) ? 0 : date.getTime();
          };
          
          return getDateValue(b) - getDateValue(a); // Latest first (most recent)
        } catch (error) {
          console.warn('Error sorting by time:', error);
          return 0;
        }
      }
    });

    // Debug logging for sorting results
    console.log(`Current sort by: ${sortBy}, filtered jobs count: ${filtered.length}`);
    if (sortBy === 'distance' && sorted.length > 0) {
      console.log('Distance sorting results (nearest first):');
      sorted.slice(0, 5).forEach((item, index) => {
        console.log(`${index + 1}. ${item.title} - ${item._distanceKm ? item._distanceKm.toFixed(2) + ' km' : 'No location data'}`);
      });
    } else if (sortBy === 'time' && sorted.length > 0) {
      console.log('Time sorting results (most recent first):');
      sorted.slice(0, 5).forEach((item, index) => {
        let timeStr = 'No time';
        if (item.createdAt) {
          try {
            let date;
            if (typeof item.createdAt === 'object' && item.createdAt.toDate) {
              date = item.createdAt.toDate();
            } else {
              date = new Date(item.createdAt);
            }
            if (!isNaN(date.getTime())) {
              const now = new Date();
              const diffInMinutes = Math.floor((now - date) / (1000 * 60));
              if (diffInMinutes < 60) timeStr = `${diffInMinutes}m ago`;
              else if (diffInMinutes < 1440) timeStr = `${Math.floor(diffInMinutes / 60)}h ago`;
              else timeStr = `${Math.floor(diffInMinutes / 1440)}d ago`;
            }
          } catch (e) {
            timeStr = 'Invalid time';
          }
        }
        console.log(`${index + 1}. ${item.title} - ${timeStr}`);
      });
    }

    return sorted;
  }, [enrichedJobs, debouncedQuery, partTimeOnly, filterKind, sortBy, searchJobs, selectedDays, accommodationType, userLocation]);

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
          // Use cached data - deduplicate by ID
          const allJobs = [...cachedJobs.data, ...cachedAccommodations.data];
          const uniqueJobs = allJobs.filter((job, index, self) => 
            index === self.findIndex(j => j.id === job.id)
          );

          // Debug logging for cached data to check createdAt field
          console.log('Cached data load - checking createdAt fields:');
          uniqueJobs.slice(0, 3).forEach((job, index) => {
            console.log(`Cached Job ${index + 1}: ${job.title}`);
            console.log(`  - createdAt:`, job.createdAt);
            console.log(`  - createdAt type:`, typeof job.createdAt);
            console.log(`  - createdAt has toDate:`, job.createdAt && typeof job.createdAt.toDate === 'function');
          });

          setJobs(uniqueJobs);
          setLoading(false);
          
          console.log('Loaded data from cache:', {
            jobs: cachedJobs.data.length,
            accommodations: cachedAccommodations.data.length,
            totalUnique: uniqueJobs.length,
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
      const jobsData = jobsSnapshot.docs.map(d => {
        const data = d.data();
        console.log(`Job loaded: ${data.title}, lat: ${data.lat}, lng: ${data.lng}, createdAt: ${data.createdAt}`);
        return { 
          id: d.id, 
          kind: 'job',
          ...data
        };
      });
      
      // Load accommodations
      const accommodationsQuery = fsQuery(
        collection(db, 'accommodations'), 
        orderBy('createdAt', 'desc'),
        limit(BATCH_SIZE)
      );
      
      const accommodationsSnapshot = await getDocs(accommodationsQuery);
      const accommodationsData = accommodationsSnapshot.docs.map(d => {
        const data = d.data();
        console.log(`Accommodation loaded: ${data.title}, lat: ${data.lat}, lng: ${data.lng}, createdAt: ${data.createdAt}`);
        return { 
          id: d.id, 
          kind: 'accommodation',
          ...data
        };
      });

      // Combine and set jobs - deduplicate by ID
      const allJobs = [...jobsData, ...accommodationsData];
      const uniqueJobs = allJobs.filter((job, index, self) => 
        index === self.findIndex(j => j.id === job.id)
      );

      // Debug logging for initial load to check createdAt field
      console.log('Initial network load - checking createdAt fields:');
      uniqueJobs.slice(0, 3).forEach((job, index) => {
        console.log(`Job ${index + 1}: ${job.title}`);
        console.log(`  - createdAt:`, job.createdAt);
        console.log(`  - createdAt type:`, typeof job.createdAt);
        console.log(`  - createdAt has toDate:`, job.createdAt && typeof job.createdAt.toDate === 'function');
      });

      setJobs(uniqueJobs);

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
        accommodations: accommodationsData.length,
        totalUnique: uniqueJobs.length
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
      
      // Add new items to existing jobs - deduplicate by ID
      if (newJobs.length > 0 || newAccommodations.length > 0) {
        setJobs(prevJobs => {
          const allJobs = [...prevJobs, ...newJobs, ...newAccommodations];
          // Remove duplicates based on ID
          const uniqueJobs = allJobs.filter((job, index, self) => 
            index === self.findIndex(j => j.id === job.id)
          );
          return uniqueJobs;
        });
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
      {/* Search Input with Filter Button */}
      <View style={{ flexDirection: 'row', padding: 12, alignItems: 'center' }}>
        <TextInput 
          placeholder="Search jobs or location" 
          value={query} 
          onChangeText={setQuery} 
          style={[shared.input, { flex: 1, marginRight: 8 }]}
          returnKeyType="search"
        />
        <TouchableOpacity
          onPress={() => setShowFilterModal(true)}
          style={[
            shared.smallButton,
            {
              backgroundColor: (selectedDays.length > 0 || accommodationType !== 'all') ? Colors.primary : Colors.card,
              borderColor: (selectedDays.length > 0 || accommodationType !== 'all') ? Colors.primary : Colors.border,
              width: 40,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
            }
          ]}
        >
          <Ionicons
            name="filter-outline"
            size={20}
            color={(selectedDays.length > 0 || accommodationType !== 'all') ? Colors.card : Colors.muted}
          />
        </TouchableOpacity>
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
        
        {/* Sort Button with better visual feedback */}
        <TouchableOpacity 
          onPress={handleSortToggle}
          style={[
            shared.smallButton, 
            { 
              backgroundColor: Colors.primary, 
              borderColor: Colors.primary,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              minWidth: 80,
              opacity: (sortBy === 'distance' && !userLocation) ? 0.6 : 1,
            }
          ]}
        >
          <Ionicons 
            name={sortBy === 'distance' ? 'location-outline' : 'time-outline'} 
            size={14} 
            color={Colors.card}
            style={{ marginRight: 6 }}
          />
          <Text style={{ 
            color: Colors.card, 
            fontSize: 12, 
            fontWeight: '600' 
          }}>
            {sortBy === 'distance' ? (userLocation ? 'Nearest' : 'Recent*') : 'Recent'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Location info message */}
      {sortBy === 'distance' && !userLocation && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          <Text style={{ fontSize: 11, color: Colors.muted, textAlign: 'center' }}>
            * Enable location permission for distance-based sorting
          </Text>
        </View>
      )}

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

      {/* Advanced Filter Modal */}
      <Modal visible={showFilterModal} animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderColor: Colors.border,
            backgroundColor: Colors.card,
          }}>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Ionicons name="close-outline" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={{ fontWeight: '600', fontSize: 18, color: Colors.text }}>
              Filter Options
            </Text>
            <TouchableOpacity 
              onPress={() => {
                setSelectedDays([]);
                setAccommodationType('all');
              }}
            >
              <Text style={{ color: Colors.primary, fontSize: 16 }}>Clear All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: 16 }}>
            {/* Filter Type Selection */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 12 }}>
                Filter Type
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {['Jobs', 'Accommodation'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => {
                      const newKind = type.toLowerCase() === 'jobs' ? 'job' : 'accommodation';
                      setFilterKind(newKind);
                      // Clear opposite filters when switching
                      if (newKind === 'job') {
                        setAccommodationType('all');
                      } else {
                        setSelectedDays([]);
                      }
                    }}
                    style={[
                      shared.smallButton,
                      {
                        marginRight: 8,
                        marginBottom: 8,
                        backgroundColor: filterKind === (type.toLowerCase() === 'jobs' ? 'job' : 'accommodation') 
                          ? Colors.primary 
                          : Colors.card,
                        borderColor: filterKind === (type.toLowerCase() === 'jobs' ? 'job' : 'accommodation') 
                          ? Colors.primary 
                          : Colors.border,
                      }
                    ]}
                  >
                    <Text style={{
                      color: filterKind === (type.toLowerCase() === 'jobs' ? 'job' : 'accommodation') 
                        ? Colors.card 
                        : Colors.muted
                    }}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Job Days Filter - Only show when filtering jobs */}
            {(filterKind === 'job' || filterKind === 'all') && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 12 }}>
                  Available Days (Jobs)
                </Text>
                <Text style={{ fontSize: 12, color: Colors.muted, marginBottom: 8 }}>
                  Select days you're interested to work
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {DAYS_OF_WEEK.map((day) => (
                    <TouchableOpacity
                      key={day}
                      onPress={() => {
                        if (selectedDays.includes(day)) {
                          setSelectedDays(prev => prev.filter(d => d !== day));
                        } else {
                          setSelectedDays(prev => [...prev, day]);
                        }
                      }}
                      style={[
                        shared.smallButton,
                        {
                          marginRight: 8,
                          marginBottom: 8,
                          backgroundColor: selectedDays.includes(day) ? Colors.primary : Colors.card,
                          borderColor: selectedDays.includes(day) ? Colors.primary : Colors.border,
                        }
                      ]}
                    >
                      <Text style={{
                        color: selectedDays.includes(day) ? Colors.card : Colors.muted,
                        fontSize: 12
                      }}>
                        {day.substring(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Accommodation Type Filter - Only show when filtering accommodations */}
            {(filterKind === 'accommodation' || filterKind === 'all') && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 12 }}>
                  Accommodation Type
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {[
                    { key: 'all', label: 'All Types' },
                    { key: 'owned', label: 'Owned/Private' },
                    { key: 'sharing', label: 'Sharing' }
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      onPress={() => setAccommodationType(option.key)}
                      style={[
                        shared.smallButton,
                        {
                          marginRight: 8,
                          marginBottom: 8,
                          backgroundColor: accommodationType === option.key ? Colors.primary : Colors.card,
                          borderColor: accommodationType === option.key ? Colors.primary : Colors.border,
                        }
                      ]}
                    >
                      <Text style={{
                        color: accommodationType === option.key ? Colors.card : Colors.muted
                      }}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Current Filter Summary */}
            {(selectedDays.length > 0 || accommodationType !== 'all') && (
              <View style={{
                padding: 12,
                backgroundColor: Colors.card,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: Colors.border,
              }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 }}>
                  Active Filters:
                </Text>
                {selectedDays.length > 0 && (
                  <Text style={{ fontSize: 12, color: Colors.muted, marginBottom: 4 }}>
                    Days: {selectedDays.join(', ')}
                  </Text>
                )}
                {accommodationType !== 'all' && (
                  <Text style={{ fontSize: 12, color: Colors.muted }}>
                    Accommodation: {accommodationType === 'owned' ? 'Owned/Private' : 'Sharing'}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          {/* Apply Button */}
          <View style={{ padding: 16 }}>
            <TouchableOpacity
              onPress={() => setShowFilterModal(false)}
              style={[
                shared.primaryButton,
                { backgroundColor: Colors.primary, borderColor: Colors.primary }
              ]}
            >
              <Text style={[shared.primaryButtonText, { color: Colors.card, fontWeight: '600', textAlign: 'center' }]}>
                Apply Filters
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
