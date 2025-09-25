import React, { useState, useMemo, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebaseConfig';
import { collection, query as fsQuery, orderBy, onSnapshot } from 'firebase/firestore';
import JobItem from './JobItem';
import { Colors, shared } from './Theme';
import { ListSkeleton } from './SkeletonLoader';

const toRad = (deg) => deg * Math.PI / 180;
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default function JobsScreen({ jobs: propJobs, onOpenJob, onSaveJob, savedIds, filters, userLocation }) {
  const [query, setQuery] = useState('');
  const [partTimeOnly, setPartTimeOnly] = useState(filters?.partTimeOnly || false);
  const [filterKind, setFilterKind] = useState('all'); // 'all' | 'job' | 'accommodation'
  const [sortBy, setSortBy] = useState('distance'); // 'distance' | 'time'
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const enriched = useMemo(() => {
    return jobs.map(j => {
      let distance = null;
      if (userLocation && j.lat && j.lng) {
        try { distance = haversineKm(userLocation.latitude, userLocation.longitude, j.lat, j.lng); } catch (e) { distance = null; }
      }
      return { ...j, _distanceKm: distance };
    });
  }, [jobs, userLocation]);

  useEffect(() => {
    let hasJobsData = false;
    let hasAccommodationsData = false;
    
    const checkLoadingComplete = () => {
      if (hasJobsData && hasAccommodationsData) {
        setLoading(false);
      }
    };

    // subscribe to jobs and accommodations collections and merge
    const jobsQ = fsQuery(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const accQ = fsQuery(collection(db, 'accommodations'), orderBy('createdAt', 'desc'));

    const unsubJobs = onSnapshot(jobsQ, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      setJobs(prev => {
        // merge while keeping accommodations present
        const other = prev.filter(p => p.kind === 'accommodation');
        return [...arr, ...other];
      });
      hasJobsData = true;
      checkLoadingComplete();
    }, err => {
      console.warn('jobs snapshot error', err);
      hasJobsData = true;
      checkLoadingComplete();
    });

    const unsubAcc = onSnapshot(accQ, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      setJobs(prev => {
        const other = prev.filter(p => p.kind === 'job');
        return [...other, ...arr];
      });
      hasAccommodationsData = true;
      checkLoadingComplete();
    }, err => {
      console.warn('accommodations snapshot error', err);
      hasAccommodationsData = true;
      checkLoadingComplete();
    });

    return () => { unsubJobs(); unsubAcc(); };
  }, []);

  const filtered = useMemo(() => {
    return enriched.filter(j => {
      const matchQuery = (j.title + ' ' + (j.description || '') + ' ' + (j.location || '')).toLowerCase().includes(query.toLowerCase());
      const matchType = partTimeOnly ? (j.type || '').toLowerCase().includes('part') : true;
      const matchKind = filterKind === 'all' ? true : (j.kind === (filterKind === 'job' ? 'job' : 'accommodation'));
      return matchQuery && matchType && matchKind;
    }).sort((a, b) => {
      if (sortBy === 'distance') {
        // Sort by distance (nearest to farthest)
        if (a._distanceKm == null && b._distanceKm == null) return 0;
        if (a._distanceKm == null) return 1; // items without distance go to end
        if (b._distanceKm == null) return -1;
        return a._distanceKm - b._distanceKm;
      } else {
        // Sort by time (latest to oldest)
        try {
          let dateA, dateB;
          
          // Parse date A
          if (a.createdAt) {
            if (typeof a.createdAt === 'object' && a.createdAt.toDate) {
              dateA = a.createdAt.toDate();
            } else {
              dateA = new Date(a.createdAt);
            }
          }
          
          // Parse date B  
          if (b.createdAt) {
            if (typeof b.createdAt === 'object' && b.createdAt.toDate) {
              dateB = b.createdAt.toDate();
            } else {
              dateB = new Date(b.createdAt);
            }
          }
          
          // Handle cases where dates are missing or invalid
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1; // items without date go to end
          if (!dateB) return -1;
          if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
          if (isNaN(dateA.getTime())) return 1;
          if (isNaN(dateB.getTime())) return -1;
          
          // Latest first (descending)
          return dateB - dateA;
        } catch (error) {
          console.warn('Error sorting by time:', error);
          return 0;
        }
      }
    });
  }, [enriched, query, partTimeOnly, filterKind, sortBy]);

  return (
    <View style={{ flex: 1 }}>
      {/* Search Input */}
      <View style={{ flexDirection: 'row', padding: 12, alignItems: 'center' }}>
        <TextInput placeholder="Search jobs or location" value={query} onChangeText={setQuery} style={[shared.input, { flex: 1 }]} />
      </View>

      {/* Filters and Sort */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, alignItems: 'center' }}>
        <TouchableOpacity onPress={() => setFilterKind('all')} style={[shared.smallButton, { marginRight: 8, backgroundColor: filterKind==='all'?Colors.primary:Colors.card, borderColor: filterKind==='all'?Colors.primary:Colors.border }]}>
          <Text style={{ color: filterKind==='all'?Colors.card:Colors.muted }}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFilterKind('job')} style={[shared.smallButton, { marginRight: 8, backgroundColor: filterKind==='job'?Colors.primary:Colors.card, borderColor: filterKind==='job'?Colors.primary:Colors.border }]}>
          <Text style={{ color: filterKind==='job'?Colors.card:Colors.muted }}>Jobs</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFilterKind('accommodation')} style={[shared.smallButton, { marginRight: 8, backgroundColor: filterKind==='accommodation'?Colors.primary:Colors.card, borderColor: filterKind==='accommodation'?Colors.primary:Colors.border }]}>
          <Text style={{ color: filterKind==='accommodation'?Colors.card:Colors.muted }}>Accommodation</Text>
        </TouchableOpacity>
        
        
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={[shared.smallButton, { marginRight: 8, backgroundColor: partTimeOnly ? Colors.primary : Colors.card, borderColor: partTimeOnly ? Colors.primary : Colors.border }]} onPress={() => setPartTimeOnly(!partTimeOnly)}>
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
            style={{ marginRight: 0 }}
          />

        </TouchableOpacity>
      </View>

      {/* Show skeleton loading cards when loading */}
      {loading ? (
        <ListSkeleton count={6} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <View key={item.id} style={{ paddingHorizontal: 12 }}>
              <JobItem item={item} onOpen={onOpenJob} onSave={onSaveJob} saved={savedIds.includes(item.id)} userLocation={userLocation} />
            </View>
          )}
          contentContainerStyle={{ paddingVertical: 12 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: Colors.muted }}>No jobs found</Text>}
        />
      )}
    </View>
  );
}
