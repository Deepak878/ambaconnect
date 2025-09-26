import AsyncStorage from '@react-native-async-storage/async-storage';

// Data cache utility for storing jobs and accommodations locally
class DataCache {
  constructor() {
    this.CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
    this.CACHE_KEYS = {
      JOBS: '@jobs_cache',
      ACCOMMODATIONS: '@accommodations_cache',
      JOBS_TIMESTAMP: '@jobs_timestamp',
      ACCOMMODATIONS_TIMESTAMP: '@accommodations_timestamp',
      PAGINATION_STATE: '@pagination_state'
    };
  }

  // Check if cached data is still valid (within 15 minutes)
  isDataFresh(timestamp) {
    if (!timestamp) return false;
    const now = Date.now();
    return (now - timestamp) < this.CACHE_DURATION;
  }

  // Save jobs to cache with timestamp
  async saveJobs(jobs) {
    try {
      const timestamp = Date.now();
      await AsyncStorage.multiSet([
        [this.CACHE_KEYS.JOBS, JSON.stringify(jobs)],
        [this.CACHE_KEYS.JOBS_TIMESTAMP, timestamp.toString()]
      ]);
    } catch (error) {
      console.warn('Failed to save jobs to cache:', error);
    }
  }

  // Save accommodations to cache with timestamp
  async saveAccommodations(accommodations) {
    try {
      const timestamp = Date.now();
      await AsyncStorage.multiSet([
        [this.CACHE_KEYS.ACCOMMODATIONS, JSON.stringify(accommodations)],
        [this.CACHE_KEYS.ACCOMMODATIONS_TIMESTAMP, timestamp.toString()]
      ]);
    } catch (error) {
      console.warn('Failed to save accommodations to cache:', error);
    }
  }

  // Get cached jobs if still fresh
  async getCachedJobs() {
    try {
      const [[, jobsData], [, timestamp]] = await AsyncStorage.multiGet([
        this.CACHE_KEYS.JOBS,
        this.CACHE_KEYS.JOBS_TIMESTAMP
      ]);
      
      if (!jobsData || !timestamp) return null;
      
      const timestampNum = parseInt(timestamp, 10);
      if (!this.isDataFresh(timestampNum)) {
        return null; // Data is stale
      }
      
      return {
        data: JSON.parse(jobsData),
        timestamp: timestampNum,
        remainingTime: this.CACHE_DURATION - (Date.now() - timestampNum)
      };
    } catch (error) {
      console.warn('Failed to get cached jobs:', error);
      return null;
    }
  }

  // Get cached accommodations if still fresh
  async getCachedAccommodations() {
    try {
      const [[, accommodationsData], [, timestamp]] = await AsyncStorage.multiGet([
        this.CACHE_KEYS.ACCOMMODATIONS,
        this.CACHE_KEYS.ACCOMMODATIONS_TIMESTAMP
      ]);
      
      if (!accommodationsData || !timestamp) return null;
      
      const timestampNum = parseInt(timestamp, 10);
      if (!this.isDataFresh(timestampNum)) {
        return null; // Data is stale
      }
      
      return {
        data: JSON.parse(accommodationsData),
        timestamp: timestampNum,
        remainingTime: this.CACHE_DURATION - (Date.now() - timestampNum)
      };
    } catch (error) {
      console.warn('Failed to get cached accommodations:', error);
      return null;
    }
  }

  // Save pagination state
  async savePaginationState(hasMore, lastVisible) {
    try {
      const paginationState = {
        hasMore,
        lastVisible: lastVisible ? {
          jobs: lastVisible.jobs ? {
            id: lastVisible.jobs.id,
            // Store minimal data needed for pagination
            createdAt: lastVisible.jobs.data()?.createdAt
          } : null,
          accommodations: lastVisible.accommodations ? {
            id: lastVisible.accommodations.id,
            createdAt: lastVisible.accommodations.data()?.createdAt
          } : null
        } : null,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem(
        this.CACHE_KEYS.PAGINATION_STATE, 
        JSON.stringify(paginationState)
      );
    } catch (error) {
      console.warn('Failed to save pagination state:', error);
    }
  }

  // Get cached pagination state
  async getCachedPaginationState() {
    try {
      const stateData = await AsyncStorage.getItem(this.CACHE_KEYS.PAGINATION_STATE);
      if (!stateData) return null;
      
      const state = JSON.parse(stateData);
      if (!this.isDataFresh(state.timestamp)) {
        return null; // Pagination state is stale
      }
      
      return state;
    } catch (error) {
      console.warn('Failed to get cached pagination state:', error);
      return null;
    }
  }

  // Clear all cache
  async clearCache() {
    try {
      await AsyncStorage.multiRemove(Object.values(this.CACHE_KEYS));
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  // Get cache info for debugging
  async getCacheInfo() {
    try {
      const jobs = await this.getCachedJobs();
      const accommodations = await this.getCachedAccommodations();
      
      return {
        jobs: jobs ? {
          count: jobs.data.length,
          remainingTime: Math.round(jobs.remainingTime / 1000 / 60), // minutes
          timestamp: new Date(jobs.timestamp).toLocaleTimeString()
        } : null,
        accommodations: accommodations ? {
          count: accommodations.data.length,
          remainingTime: Math.round(accommodations.remainingTime / 1000 / 60), // minutes
          timestamp: new Date(accommodations.timestamp).toLocaleTimeString()
        } : null
      };
    } catch (error) {
      console.warn('Failed to get cache info:', error);
      return null;
    }
  }

  // Format remaining time for display
  formatRemainingTime(remainingTimeMs) {
    const minutes = Math.floor(remainingTimeMs / 1000 / 60);
    const seconds = Math.floor((remainingTimeMs % (1000 * 60)) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

export const dataCache = new DataCache();
export default dataCache;