import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, FlatList, RefreshControl, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebaseConfig';
import { 
  collection, 
  query as fsQuery, 
  orderBy, 
  limit, 
  startAfter,
  getDocs,
  where,
  Timestamp
} from 'firebase/firestore';
import JobItem from './JobItem';
import { Colors, shared } from './Theme';
import { ListSkeleton, JobItemSkeleton } from './SkeletonLoader';
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

// Utility function to check if a post is within the last 30 days
const isPostWithinLast30Days = (createdAt) => {
  if (!createdAt) return false;
  
  try {
    let postDate;
    if (typeof createdAt === 'object' && createdAt.toDate) {
      postDate = createdAt.toDate();
    } else {
      postDate = new Date(createdAt);
    }
    
    if (isNaN(postDate.getTime())) return false;
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    return postDate >= thirtyDaysAgo;
  } catch (error) {
    console.warn('Error checking post date:', error);
    return false;
  }
};

const toFirestoreTimestamp = (value) => {
  if (value == null) return null;
  if (value.toMillis) return value;
  if (typeof value === 'number') {
    return Timestamp.fromMillis(value);
  }
  if (typeof value === 'object') {
    const seconds = value.seconds ?? value._seconds;
    const nanoseconds = value.nanoseconds ?? value._nanoseconds ?? 0;
    if (typeof seconds === 'number') {
      return new Timestamp(seconds, nanoseconds);
    }
    if (typeof value.toDate === 'function') {
      return value;
    }
  }
  return null;
};

export default function JobsScreen({ jobs: propJobs, onOpenJob, onSaveJob, savedIds, filters, userLocation, isConnecting }) {
  const [query, setQuery] = useState('');
  const [partTimeOnly, setPartTimeOnly] = useState(filters?.partTimeOnly || false);
  const [filterKind, setFilterKind] = useState('all'); // 'all' | 'job' | 'accommodation'
  const [sortBy, setSortBy] = useState(() => (userLocation ? 'distance' : 'time'));
  const [jobs, setJobs] = useState([]); // Internal state for jobs
  const [loading, setLoading] = useState(propJobs === undefined || isConnecting); // Show loading if standalone mode or parent is connecting
  const [hasLoadedOnce, setHasLoadedOnce] = useState(propJobs !== undefined ? !isConnecting : false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState({ jobs: true, accommodations: true });
  const [lastVisible, setLastVisible] = useState({ jobs: null, accommodations: null });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const hasManuallySelectedSort = useRef(false);
  
  // Advanced filter states
  const [selectedDays, setSelectedDays] = useState([]);
  const [accommodationType, setAccommodationType] = useState('all'); // 'all' | 'owned' | 'sharing'
  
  // Use propJobs when provided by parent, fallback to internal jobs state for standalone mode
  const activeJobs = useMemo(() => {
    const jobsToUse = propJobs !== undefined ? propJobs : jobs;
    
    // Deduplicate by ID to prevent duplicate key errors
    const uniqueJobs = jobsToUse.filter((job, index, self) => 
      index === self.findIndex(j => j.id === job.id)
    );
    
    return uniqueJobs;
  }, [propJobs, jobs]);
  
  // Update loading state based on whether we have data
  useEffect(() => {
    if (propJobs !== undefined) {
      if (isConnecting) {
        setLoading(true);
        setHasLoadedOnce(false);
        return;
      }

      if (propJobs.length > 0) {
        setLoading(false);
        setHasLoadedOnce(true);
      } else {
        // Parent finished loading but no data available
        setLoading(false);
        setHasLoadedOnce(true);
      }
    } else if (jobs.length > 0) {
      // We have internal data, clear loading
      setLoading(false);
      setHasLoadedOnce(true);
    }
    // If in standalone mode and no data, keep loading true until data is fetched
  }, [propJobs, jobs.length, isConnecting]);
  
  const BATCH_SIZE = 10; // Smaller batch size for better initial load performance
  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Use debounced search for better performance
  const debouncedQuery = useDebouncedSearch(query, 300);
  

  
  // Handle sort toggle
  const handleSortToggle = useCallback(() => {
    if (!userLocation) {
      setSortBy('time');
      hasManuallySelectedSort.current = false;
      return;
    }

    hasManuallySelectedSort.current = true;
    setSortBy(prev => (prev === 'distance' ? 'time' : 'distance'));
  }, [userLocation]);

  useEffect(() => {
    if (userLocation) {
      if (!hasManuallySelectedSort.current) {
        setSortBy(prev => (prev === 'distance' ? prev : 'distance'));
      }
    } else {
      setSortBy('time');
      hasManuallySelectedSort.current = false;
    }
  }, [userLocation]);

  // Memoized job enrichment with distance calculations - only when needed
  const enrichedJobs = useMemo(() => {
    // If not sorting by distance, skip expensive distance calculations
    if (sortBy !== 'distance') {
      return activeJobs.map(j => ({ ...j, _distanceKm: j._distanceKm || null }));
    }
    
    if (!userLocation) {
      // Still return jobs but with _distanceKm set to null for consistency
      return activeJobs.map(j => ({ ...j, _distanceKm: null }));
    }
    
    const enriched = activeJobs.map(j => {
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
    
    return enriched;
  }, [activeJobs, userLocation, sortBy]);

  // Optimized search function with debouncing and caching
  const searchJobs = useCallback((searchQuery, jobsList) => {
    if (!searchQuery.trim()) return jobsList;
    
    const lowerQuery = searchQuery.toLowerCase().trim();
    
    // Use a simple filter with early returns for better performance
    return jobsList.filter(j => {
      // Quick checks first (title is most commonly searched)
      if (j.title && j.title.toLowerCase().includes(lowerQuery)) return true;
      if (j.location && j.location.toLowerCase().includes(lowerQuery)) return true;
      if (j.description && j.description.toLowerCase().includes(lowerQuery)) return true;
      
      return false;
    });
  }, []);

  // Memoized filtering and sorting with debounced search
  const filteredAndSortedJobs = useMemo(() => {
    // Apply search filter with debounced query
    let filtered = searchJobs(debouncedQuery, enrichedJobs);
    
    // Apply 30-day filter - only show posts from last 30 days
    filtered = filtered.filter(job => {
      return isPostWithinLast30Days(job.createdAt);
    });
    
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
      // Helper function to get date value consistently
      const getDateValue = (item) => {
        if (!item.createdAt) return 0;
        try {
          if (typeof item.createdAt === 'object' && item.createdAt.toDate) {
            return item.createdAt.toDate().getTime();
          }
          if (typeof item.createdAt === 'string' || typeof item.createdAt === 'number') {
            const date = new Date(item.createdAt);
            return isNaN(date.getTime()) ? 0 : date.getTime();
          }
          return 0;
        } catch (error) {
          console.warn('Error parsing date for item:', item.title, error);
          return 0;
        }
      };

      if (sortBy === 'distance') {
        // If no user location is available, fall back to time sorting
        if (!userLocation) {
          return getDateValue(b) - getDateValue(a); // Latest first when no location
        }
        
        // Sort by distance (nearest to farthest) - ascending order
        if (a._distanceKm == null && b._distanceKm == null) {
          // If both items don't have distance, sort by time (recent first) as secondary sort
          return getDateValue(b) - getDateValue(a); // Latest first for items without distance
        }
        if (a._distanceKm == null) return 1; // Items without distance go to end
        if (b._distanceKm == null) return -1; // Items with distance come first
        
        // Ascending order: nearest (smallest distance) first
        return a._distanceKm - b._distanceKm;
      } else {
        // Sort by time (latest to oldest) - recent posts first
        const dateA = getDateValue(a);
        const dateB = getDateValue(b);
        
        return dateB - dateA; // Latest first (most recent)
      }
    });

    return sorted;
  }, [enrichedJobs, debouncedQuery, partTimeOnly, filterKind, sortBy, searchJobs, selectedDays, accommodationType, userLocation]);

  // Create display data with refreshing card when pulling to refresh
  const displayData = useMemo(() => {
    let dataToDisplay = filteredAndSortedJobs;
    
    // Final deduplication step to prevent duplicate keys in FlatList
    dataToDisplay = dataToDisplay.filter((item, index, self) => 
      index === self.findIndex(i => i.id === item.id)
    );
    
    if (refreshing) {
      const skeletonPlaceholder = { id: '__refreshing_skeleton__', isSkeleton: true };
      if (dataToDisplay.length > 0) {
        return [skeletonPlaceholder, ...dataToDisplay];
      }
      return [skeletonPlaceholder];
    }

    // Otherwise just show the normal filtered data
    return dataToDisplay;
  }, [refreshing, filteredAndSortedJobs]);

  // Remove the old debounced query effect since we're using the hook
  // useEffect(() => {
  //   const timeoutId = setTimeout(() => {
  //     // Query change handled by memoized filteredAndSortedJobs
  //   }, 300);
  //   
  //   return () => clearTimeout(timeoutId);
  // }, [query]);

  // Load data from Firestore and cache it
  const loadFromNetwork = useCallback(async ({ silent = false } = {}) => {
    // Only set loading to true if not already refreshing or when not in silent mode
    if (!silent && !refreshing) {
      setLoading(true);
    }
    
    try {
      // Calculate 30 days ago timestamp for Firestore query
      const thirtyDaysAgo = Timestamp.fromDate(new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)));
      
      // Load jobs from last 30 days only
      const jobsQuery = fsQuery(
        collection(db, 'jobs'), 
        orderBy('createdAt', 'desc'),
        where('createdAt', '>=', thirtyDaysAgo),
        limit(BATCH_SIZE)
      );
      
      const jobsSnapshot = await getDocs(jobsQuery);
      const jobsData = jobsSnapshot.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          kind: 'job',
          ...data
        };
      });
      
      // Load accommodations from last 30 days only
      const accommodationsQuery = fsQuery(
        collection(db, 'accommodations'), 
        orderBy('createdAt', 'desc'),
        where('createdAt', '>=', thirtyDaysAgo),
        limit(BATCH_SIZE)
      );
      
      const accommodationsSnapshot = await getDocs(accommodationsQuery);
      const accommodationsData = accommodationsSnapshot.docs.map(d => {
        const data = d.data();
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

      // Set the jobs data
      setJobs(uniqueJobs);

      // Update pagination state
      const lastJobDoc = jobsSnapshot.docs[jobsSnapshot.docs.length - 1];
      const lastAccommodationDoc = accommodationsSnapshot.docs[accommodationsSnapshot.docs.length - 1];

      const newLastVisible = {
        jobs: lastJobDoc ? toFirestoreTimestamp(lastJobDoc.data()?.createdAt) : null,
        accommodations: lastAccommodationDoc ? toFirestoreTimestamp(lastAccommodationDoc.data()?.createdAt) : null
      };
      setLastVisible(newLastVisible);
      
      const newHasMore = {
        jobs: jobsSnapshot.docs.length === BATCH_SIZE,
        accommodations: accommodationsSnapshot.docs.length === BATCH_SIZE
      };
      setHasMore(newHasMore);

      // Cache the data
      const jobsOnly = uniqueJobs.filter(item => item.kind === 'job');
      const accommodationsOnly = uniqueJobs.filter(item => item.kind === 'accommodation');
      await Promise.all([
        dataCache.saveJobs(jobsOnly),
        dataCache.saveAccommodations(accommodationsOnly),
        dataCache.savePaginationState(newHasMore, newLastVisible)
      ]);

      
    } catch (error) {
      console.error('Error loading from network:', error);
    } finally {
      // Always clear loading states
      if (!silent) {
        setLoading(false);
      }
      setRefreshing(false);
      setHasLoadedOnce(true);
    }
  }, [refreshing]); // Removed jobs.length dependency to avoid issues

  // Load data from cache first, then network if needed
  const loadInitialData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      setLoading(true);
    }

    try {
      let cacheUsed = false;

      if (!forceRefresh) {
        const [cachedJobs, cachedAccommodations, cachedPagination] = await Promise.all([
          dataCache.getCachedJobs(),
          dataCache.getCachedAccommodations(),
          dataCache.getCachedPaginationState()
        ]);

        const cachedItems = [
          ...(cachedJobs?.data || []),
          ...(cachedAccommodations?.data || [])
        ];

        if (cachedItems.length > 0) {
          const uniqueCachedItems = cachedItems.filter((job, index, self) =>
            index === self.findIndex(j => j.id === job.id)
          );

          const recentJobs = uniqueCachedItems.filter(job => isPostWithinLast30Days(job.createdAt));

          setJobs(recentJobs);
          setHasLoadedOnce(true);

          if (cachedPagination) {
            setHasMore(cachedPagination.hasMore || { jobs: true, accommodations: true });
            setLastVisible({
              jobs: toFirestoreTimestamp(cachedPagination.lastVisible?.jobs),
              accommodations: toFirestoreTimestamp(cachedPagination.lastVisible?.accommodations)
            });
          } else {
            setHasMore({ jobs: true, accommodations: true });
            setLastVisible({ jobs: null, accommodations: null });
          }

          setLoading(false);
          cacheUsed = true;
        }
      }

      await loadFromNetwork({ silent: cacheUsed && !forceRefresh });

    } catch (error) {
      console.error('Error loading initial data:', error);
      setLoading(false);
      setRefreshing(false);
      setHasLoadedOnce(true);
    }
  }, [loadFromNetwork]);

  // Auto-refresh timer - check every minute if data needs refresh
  useEffect(() => {
    const checkForStaleData = async () => {
      const [cachedJobs, cachedAccommodations] = await Promise.all([
        dataCache.getCachedJobs(),
        dataCache.getCachedAccommodations()
      ]);
      
      // If either cache is stale, auto-refresh
      if (!cachedJobs || !cachedAccommodations) {
        await loadInitialData(true);
      }
    };
    
    // Check every minute
    const interval = setInterval(checkForStaleData, 60000);
    
    return () => clearInterval(interval);
  }, [loadInitialData]);

  // Initial data load - only if propJobs is not available
  useEffect(() => {
    // If we have propJobs (from parent component), use them and don't fetch independently
    if (propJobs !== undefined) {
      // Parent handles loading state through isConnecting effect above
      setHasLoadedOnce(propJobs.length > 0);
      return;
    }
    
    // Only fetch data if no propJobs are provided (standalone mode)
    if (propJobs === undefined && jobs.length === 0) {
      loadInitialData().catch((error) => {
        console.error('Initial load failed:', error);
      });
    } else if (propJobs === undefined) {
      // We already have internal data, just clear loading
      setLoading(false);
    }
  }, [propJobs, jobs.length, loadInitialData]);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    
    // If propJobs are provided (parent manages data), refresh is handled by parent
    if (propJobs !== undefined) {
      // Just clear the refreshing state after a short delay
      setTimeout(() => {
        setRefreshing(false);
      }, 1000);
    } else {
      // We're in standalone mode, refresh from network
      await loadInitialData(true); // Force refresh from network
    }
  }, [loadInitialData, propJobs]);

  // Load more jobs when scrolling - with proper pagination
  const loadMoreJobs = useCallback(async () => {
    if (loadingMore || refreshing) return;
    
    const canLoadMoreJobs = hasMore.jobs && lastVisible.jobs;
    const canLoadMoreAccommodations = hasMore.accommodations && lastVisible.accommodations;
    
    if (!canLoadMoreJobs && !canLoadMoreAccommodations) return;
    
    setLoadingMore(true);
    
    try {
      const newJobs = [];
      const newAccommodations = [];
      let jobsSnapshot = null;
      let accommodationsSnapshot = null;
      
      const thirtyDaysAgo = Timestamp.fromDate(new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)));
      
      if (canLoadMoreJobs) {
        const nextJobsQuery = fsQuery(
          collection(db, 'jobs'),
          orderBy('createdAt', 'desc'),
          where('createdAt', '>=', thirtyDaysAgo),
          startAfter(lastVisible.jobs),
          limit(BATCH_SIZE)
        );
        
        jobsSnapshot = await getDocs(nextJobsQuery);
        const moreJobs = jobsSnapshot.docs.map(d => ({
          id: d.id,
          kind: 'job',
          ...d.data()
        }));
        newJobs.push(...moreJobs);
      }
      
      if (canLoadMoreAccommodations) {
        const nextAccommodationsQuery = fsQuery(
          collection(db, 'accommodations'),
          orderBy('createdAt', 'desc'),
          where('createdAt', '>=', thirtyDaysAgo),
          startAfter(lastVisible.accommodations),
          limit(BATCH_SIZE)
        );
        
        accommodationsSnapshot = await getDocs(nextAccommodationsQuery);
        const moreAccommodations = accommodationsSnapshot.docs.map(d => ({
          id: d.id,
          kind: 'accommodation',
          ...d.data()
        }));
        newAccommodations.push(...moreAccommodations);
      }
      
      const hasNewData = newJobs.length > 0 || newAccommodations.length > 0;
      const jobsDocsLength = jobsSnapshot ? jobsSnapshot.docs.length : 0;
      const accommodationsDocsLength = accommodationsSnapshot ? accommodationsSnapshot.docs.length : 0;

      if (hasNewData) {
        const updatedJobsList = (() => {
          const allJobs = [...jobs, ...newJobs, ...newAccommodations];
          return allJobs.filter((job, index, self) => index === self.findIndex(j => j.id === job.id));
        })();

        setJobs(updatedJobsList);

        const updatedLastVisible = {
          jobs: jobsSnapshot && jobsDocsLength > 0
            ? toFirestoreTimestamp(jobsSnapshot.docs[jobsDocsLength - 1].data()?.createdAt)
            : lastVisible.jobs,
          accommodations: accommodationsSnapshot && accommodationsDocsLength > 0
            ? toFirestoreTimestamp(accommodationsSnapshot.docs[accommodationsDocsLength - 1].data()?.createdAt)
            : lastVisible.accommodations
        };
        setLastVisible(updatedLastVisible);

        const updatedHasMore = {
          jobs: canLoadMoreJobs ? jobsDocsLength === BATCH_SIZE : hasMore.jobs,
          accommodations: canLoadMoreAccommodations ? accommodationsDocsLength === BATCH_SIZE : hasMore.accommodations
        };
        setHasMore(updatedHasMore);

        await Promise.all([
          dataCache.saveJobs(updatedJobsList.filter(item => item.kind === 'job')),
          dataCache.saveAccommodations(updatedJobsList.filter(item => item.kind === 'accommodation')),
          dataCache.savePaginationState(updatedHasMore, updatedLastVisible)
        ]);
      } else {
        const fallbackHasMore = {
          jobs: canLoadMoreJobs && jobsSnapshot ? jobsDocsLength === BATCH_SIZE : hasMore.jobs,
          accommodations: canLoadMoreAccommodations && accommodationsSnapshot ? accommodationsDocsLength === BATCH_SIZE : hasMore.accommodations
        };

        if (canLoadMoreJobs && jobsSnapshot) {
          setHasMore(prev => ({ ...prev, jobs: fallbackHasMore.jobs }));
        }
        if (canLoadMoreAccommodations && accommodationsSnapshot) {
          setHasMore(prev => ({ ...prev, accommodations: fallbackHasMore.accommodations }));
        }

        await dataCache.savePaginationState(fallbackHasMore, lastVisible);
      }
      
    } catch (error) {
      console.warn('Error loading more jobs:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, refreshing, hasMore, lastVisible, jobs]);

  // Memoized render item to prevent unnecessary re-renders
  const renderJobItem = useCallback(({ item }) => {
    // Render skeleton placeholder while refreshing
    if (item.isSkeleton) {
      return (
        <View style={{ paddingHorizontal: 12 }}>
          <JobItemSkeleton />
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
    // Handle skeleton placeholder
    if (item.isSkeleton) {
      return '__refreshing_skeleton__';
    }
    // Handle normal job items
    return item.id ? String(item.id) : '__unknown_item__';
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
              opacity: !userLocation ? 0.6 : 1,
            }
          ]}
          disabled={!userLocation}
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


      {/* Show skeleton loading when connecting or initially loading */}
      {loading ? (
        <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
          <ListSkeleton count={6} />
        </View>
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={keyExtractor}
          renderItem={renderJobItem}
          contentContainerStyle={{ paddingTop: refreshing ? 20 : 12, paddingBottom: 12 }}
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
          ListEmptyComponent={!loading && hasLoadedOnce ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ textAlign: 'center', color: Colors.muted, marginBottom: 8 }}>
                No jobs found
              </Text>
              <TouchableOpacity 
                onPress={() => handleRefresh()}
                style={[shared.smallButton, { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
              >
                <Text style={{ color: Colors.card }}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : null}
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
