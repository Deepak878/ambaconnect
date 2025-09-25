


import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors, shared } from './Theme';
import { db } from '../firebaseConfig';
import { collection, query as fsQuery, orderBy, onSnapshot } from 'firebase/firestore';

export default function MapScreen({ jobs: propJobs = [], accommodations: propAccom = [], userLocation = null, onOpenJob = () => {}, onSave = null, savedIds = [] }) {
  const mapRef = useRef(null);
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
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      setJobs(arr);
    }, err => console.warn('jobs snapshot error', err));
    const unsubAcc = onSnapshot(qAcc, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      setAccommodations(arr);
    }, err => console.warn('accommodations snapshot error', err));

    return () => { unsubJobs(); unsubAcc(); };
  }, []);

  function runSearch() {
    let items = [];

    if (mode === 'jobs' || mode === 'all') {
      const found = (jobs || []).filter(j => {
        if (jobFilter === 'part') return (j.type || '').toLowerCase().includes('part');
        if (jobFilter === 'full') return (j.type || '').toLowerCase().includes('full');
        return true;
      }).map(j => ({ ...j, _type: 'job' }));
      items = items.concat(found);
    }

    if (mode === 'accommodations' || mode === 'all') {
      let found = (accommodations || []).map(a => ({ ...a, _type: 'accommodation' }));

      if (mode === 'accommodations' && accomFilter === 'owned') {
        found = found.filter(a => !!a.owner);
      } else if (mode === 'accommodations' && accomFilter === 'shared') {
        found = found.filter(a => a.shared === true);
      }

      items = items.concat(found);
    }

    // professionals removed — only jobs and accommodations are searched

    const withDist = items.map(it => {
      if (userLocation && it.lat != null && it.lng != null) {
        const dist = haversine(userLocation.latitude, userLocation.longitude, it.lat, it.lng);
        return { ...it, _distance: dist };
      }
      return it;
    });

    const sorted = (userLocation) ? withDist.sort((a,b) => (a._distance || 1e9) - (b._distance || 1e9)) : withDist;
    setResults(sorted);
    if (sorted.length) setSelected(sorted[0]);
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

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBar}>
        <View style={styles.segment}>
          <TouchableOpacity style={[styles.segBtn, mode === 'all' && styles.segActive]} onPress={() => { setMode('all'); setQuery(''); }}><Text style={styles.segTxt}>All</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.segBtn, mode === 'jobs' && styles.segActive]} onPress={() => setMode('jobs')}><Text style={styles.segTxt}>Jobs</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.segBtn, mode === 'accommodations' && styles.segActive]} onPress={() => setMode('accommodations')}><Text style={styles.segTxt}>Accom</Text></TouchableOpacity>
    {/* Professionals removed */}
        </View>

        {/* no professional categories */}

        {/* accomodation filter moved below to avoid duplication */}

        {/* Job filter (All / Part-time / Full-time) and accomodation filters */}
        {mode !== 'all' ? (
          <>
            {mode === 'jobs' && (
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <TouchableOpacity style={[styles.segBtn, jobFilter === 'all' ? styles.segActive : null, { marginRight: 8 }]} onPress={() => setJobFilter('all')}><Text style={styles.segTxt}>All</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.segBtn, jobFilter === 'part' ? styles.segActive : null, { marginRight: 8 }]} onPress={() => setJobFilter('part')}><Text style={styles.segTxt}>Part-time</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.segBtn, jobFilter === 'full' ? styles.segActive : null]} onPress={() => setJobFilter('full')}><Text style={styles.segTxt}>Full-time</Text></TouchableOpacity>
              </View>
            )}

            {mode === 'accommodations' && (
              <View style={styles.categoryRow}>
                <FlatList
                  horizontal
                  data={[{k:'all', t:'All'}, {k:'owned', t:'Owned'}, {k:'shared', t:'Shared'}]}
                  keyExtractor={c => c.k}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setAccomFilter(item.k)} style={[styles.catChip, item.k === accomFilter && styles.catActive]}>
                      <Text style={{ color: item.k === accomFilter ? '#fff' : '#333' }}>{item.t}</Text>
                    </TouchableOpacity>
                  )}
                  showsHorizontalScrollIndicator={false}
                />
              </View>
            )}
          </>
        ) : (
          <View style={{ paddingVertical: 8 }}>
            <Text style={{ color: '#444' }}>Please select Jobs or Accom to view markers.</Text>
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
      >
        {results.map(r => {
          const lat = r.lat || r.latitude || r.locationLat;
          const lng = r.lng || r.longitude || r.locationLng;
          if (lat == null || lng == null) return null;
            return (
                <Marker key={r.id} coordinate={{ latitude: lat, longitude: lng }} title={r.name || r.title} description={r.location || r.country || ''} onPress={() => { centerOn(r); }}>
                  <Callout onPress={() => onOpenJob(r)}>
                    <View style={{ maxWidth: 220 }}>
                      <Text style={{ fontWeight: '600' }}>{r.name || r.title}</Text>
                      <Text style={{ color: '#666', marginTop: 4 }}>{r.location || r.country || ''}</Text>
                      {r.duration ? <Text style={{ color: '#666', marginTop: 6 }}>Duration: {r.duration.start || 'N/A'} — {r.duration.end || 'N/A'}</Text> : null}
                      <Text style={{ color: '#2874ff', marginTop: 6 }}>See details</Text>
                    </View>
                  </Callout>
                </Marker>
          );
        })}

        {userLocation && (
          <Marker coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }} pinColor="blue" title="You" />
        )}
      </MapView>

      {/* small info panel shown when marker/card selected */}
      {/* Marker popup removed — marker press now opens the job detail modal directly */}

      {/* Detail modal for full info */}
      {/* Full detail modal removed from here — Map markers/cards open the main JobDetailModal via onOpenJob */}

      <View style={styles.resultsContainer}>
        <FlatList
          data={results}
          horizontal
          keyExtractor={it => it.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => onOpenJob(item)} style={[styles.resultCard, selected && selected.id === item.id && styles.resultActive]}>
              <Image source={{ uri: item.image || (item._type === 'job' ? item.image : undefined) }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle}>{item.name || item.title}</Text>
                    <Text style={styles.resultSub}>{item._distance != null ? (item._distance < 1 ? `${Math.round(item._distance * 1000)} m` : `${item._distance.toFixed(1)} km`) : (item.location || item.country || '')}</Text>
                    {item.duration ? <Text style={[styles.resultSub, { marginTop: 6 }]}>Duration: {item.duration.start || 'N/A'} — {item.duration.end || 'N/A'}</Text> : null}
                    <Text style={styles.resultType}>{item._type}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    paddingTop: Platform.OS === 'ios' ? 18 : 6,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    zIndex: 10,
  },
  segment: { flexDirection: 'row', marginBottom: 8 },
  segBtn: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, marginRight: 6, backgroundColor: '#f0f0f0' },
  segActive: { backgroundColor: '#2874ff' },
  segTxt: { color: '#000' },
  categoryRow: { marginBottom: 8 },
  catChip: { paddingVertical: 6, paddingHorizontal: 10, marginRight: 8, borderRadius: 20, backgroundColor: '#f0f0f0' },
  catActive: { backgroundColor: '#2874ff' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  input: { flex: 1, backgroundColor: '#f8f8f8', borderRadius: 8, paddingHorizontal: 12, height: 40 },
  searchBtn: { marginLeft: 8, backgroundColor: '#2874ff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  suggestionsBox: { backgroundColor: '#fff', borderRadius: 6, maxHeight: 160, borderWidth: 1, borderColor: '#eee', marginBottom: 8 },
  suggestionItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  resultsContainer: { position: 'absolute', bottom: 8, left: 0, right: 0, paddingHorizontal: 10 },
  resultCard: { backgroundColor: '#fff', padding: 10, marginRight: 10, borderRadius: 8, width: 260, flexDirection: 'row', alignItems: 'center' },
  resultActive: { borderWidth: 2, borderColor: '#2874ff' },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 10 },
  resultTitle: { fontWeight: '600' },
  resultSub: { color: '#666', fontSize: 12 },
  resultType: { marginTop: 4, fontSize: 11, color: '#333' },
});
