import React, { useState } from 'react';
import { ScrollView, TextInput, TouchableOpacity, Text, View, Alert, Modal, FlatList, Switch, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors, shared } from './Theme';
import { app, db } from '../firebaseConfig';
import { serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';


function haversineKm(a, b) {
  const toRad = x => (x * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const aa = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
  return R * c;
}

const currencyList = [ 'USD','EUR','GBP','INR','NPR','AUD','CAD','JPY','CNY','SGD','HKD','ZAR','BRL','RUB','MXN','KRW','AED','SAR','TRY','CHF','SEK','NOK','DKK','PLN','IDR','MYR','THB','VND','PHP','KES','NGN' ];

export default function PostScreen({ onPost }) {
  const [postKind, setPostKind] = useState('job'); // 'job' | 'accommodation'

  // common
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');

  // job
  const [type, setType] = useState('Part-time');
  const [salary, setSalary] = useState('');
  const [salaryType, setSalaryType] = useState('hourly');
  const [currency, setCurrency] = useState('NPR');

  // weekly schedule for job postings
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const [schedule, setSchedule] = useState(() => {
    const s = {};
    days.forEach(d => { s[d] = { enabled: false, start: '', end: '' }; });
    return s;
  });

  const toggleDay = (d) => {
    setSchedule(prev => ({ ...prev, [d]: { ...prev[d], enabled: !prev[d].enabled } }));
  };

  const setDayTime = (d, field, value) => {
    setSchedule(prev => ({ ...prev, [d]: { ...prev[d], [field]: value } }));
  };

  // accommodation
  const [accomType, setAccomType] = useState('1BHK');
  const [rent, setRent] = useState('');
  const [accomAvailability, setAccomAvailability] = useState('Sharing');

  // profile (optional)
  // profile (optional) removed

  // shared UI state
  const [userLocation, setUserLocation] = useState(null);
  const [pickerMarker, setPickerMarker] = useState(null);
  const [pickerCity, setPickerCity] = useState('');
  const [pickerDistanceKm, setPickerDistanceKm] = useState(null);
  const [pickerRegion, setPickerRegion] = useState(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  // optional duration for job/accommodation
  const [durationEnabled, setDurationEnabled] = useState(false);
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // profile photo picker removed

  const openMapPicker = async () => {
    // Show the modal immediately so the user sees the map UI fast.
    setShowMapPicker(true);
    setPickerMarker(null); setPickerDistanceKm(null); setPickerCity('');

    // Try a fast path: use last known position first
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last && last.coords) {
        setUserLocation({ latitude: last.coords.latitude, longitude: last.coords.longitude });
        setPickerRegion({ latitude: last.coords.latitude, longitude: last.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 });
        return;
      }
    } catch (_) {
      // ignore
    }

    // Otherwise request permission and current position with a short timeout
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      if (res.status !== 'granted') { Alert.alert('Permission', 'Location permission required to pick a point on map');
        // set a reasonable default region so the map still appears
        setPickerRegion({ latitude: 27.7172, longitude: 85.3240, latitudeDelta: 0.1, longitudeDelta: 0.1 });
        return; }

      // race between getting position and a short timeout to avoid long waits
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ]);

      if (pos && pos.coords) {
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setPickerRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 });
      } else {
        setPickerRegion({ latitude: 27.7172, longitude: 85.3240, latitudeDelta: 0.1, longitudeDelta: 0.1 });
      }
    } catch (e) {
      // On timeout or error, set a default region so map loads immediately
      setPickerRegion({ latitude: 27.7172, longitude: 85.3240, latitudeDelta: 0.1, longitudeDelta: 0.1 });
    }
  };

  const submit = async () => {
    try {
      if (postKind === 'job') {
        if (!title || !salary) { Alert.alert('Missing', 'Provide job title and salary'); return; }
        if (!pickerMarker) { Alert.alert('Location Required', 'Please pick a location on the map for this job post'); return; }
        const job = {
          kind: 'job',
          title,
          type,
          salary: Number(salary),
          salaryType,
          currency,
          schedule,
          location: pickerMarker ? `${pickerDistanceKm ? pickerDistanceKm.toFixed(1) + ' km away' : (pickerCity || city || 'Nearby')}` : (city || 'Nearby'),
          description,
          contact: contact || 'Hidden until profile tapped',
          lat: pickerMarker ? pickerMarker.latitude : (userLocation ? userLocation.latitude + (Math.random() - 0.5) * 0.02 : 37.78825),
          lng: pickerMarker ? pickerMarker.longitude : (userLocation ? userLocation.longitude + (Math.random() - 0.5) * 0.02 : -122.4324),
          createdAt: new Date().toISOString(),
          images: [],
          duration: durationEnabled ? { start: startDate || null, end: endDate || null } : null,
        };
        // write to Firestore `jobs` collection
        try {
          const payload = { ...job, createdAt: serverTimestamp() };
          // Require a logged-in user (stored locally). If none, prompt to login/register.
          let localUser = null;
          try {
            const local = await AsyncStorage.getItem('user');
            if (local) { localUser = JSON.parse(local); payload.createdBy = localUser; }
          } catch (_) { /* ignore */ }

          if (!localUser || !localUser.id) {
            Alert.alert('Login required', 'Please login or register before posting.');
            return;
          }

          try {
            const userDocRef = doc(db, 'users', localUser.id);
            const userSnap = await getDoc(userDocRef);
            if (userSnap && userSnap.exists && typeof userSnap.exists === 'function' ? userSnap.exists() : userSnap.exists) {
              const serverUser = userSnap.data() || {};
              payload.userPhone = serverUser.phone || localUser.phone || localUser.id;
              payload.createdById = localUser.id;
            } else {
              payload.userPhone = localUser.phone || localUser.id;
              payload.createdById = localUser.id;
            }
          } catch (readErr) {
            console.warn('Failed to read users doc, using local phone', readErr);
            payload.userPhone = localUser.phone || localUser.id;
            payload.createdById = localUser.id;
          }
          const docId = `${localUser.id}_${Date.now()}`;
          await setDoc(doc(db, 'jobs', docId), payload);
          onPost && onPost({ ...job, id: docId });
          Alert.alert('Posted', 'Job posted');
        } catch (err) {
          console.error('Failed to write job to Firestore', err);
          Alert.alert('Error', 'Unable to save job to server.');
        }
      } else if (postKind === 'accommodation') {
        if (!accomType || !rent || !city || !accomAvailability) { Alert.alert('Missing', 'Provide BHK, rent, city and availability'); return; }
        if (!pickerMarker) { Alert.alert('Location Required', 'Please pick a location on the map for this accommodation post'); return; }
        const accom = {
          kind: 'accommodation',
          title: `${accomType} available in ${city}`,
          accomType,
          rent: Number(rent),
          currency,
          availability: accomAvailability,
          location: pickerMarker ? `${pickerCity || city} ${pickerDistanceKm ? '(' + pickerDistanceKm.toFixed(1) + ' km away)' : ''}` : `${street || ''} ${city}`.trim(),
          description: description || 'Sharing available',
          contact: contact || 'Hidden until profile tapped',
          lat: pickerMarker.latitude,
          lng: pickerMarker.longitude,
          createdAt: new Date().toISOString(),
          images: [],
          duration: durationEnabled ? { start: startDate || null, end: endDate || null } : null,
        };
        // write to Firestore `accommodations` collection
        try {
          const payload = { ...accom, createdAt: serverTimestamp() };
          // require local user similar to job posting
          let localUser = null;
          try {
            const local = await AsyncStorage.getItem('user');
            if (local) { localUser = JSON.parse(local); payload.createdBy = localUser; }
          } catch (_) { /* ignore */ }

          if (!localUser || !localUser.id) {
            Alert.alert('Login required', 'Please login or register before posting.');
            return;
          }

          try {
            const userDocRef = doc(db, 'users', localUser.id);
            const userSnap = await getDoc(userDocRef);
            if (userSnap && (typeof userSnap.exists === 'function' ? userSnap.exists() : userSnap.exists)) {
              const serverUser = userSnap.data() || {};
              payload.userPhone = serverUser.phone || localUser.phone || localUser.id;
            } else {
              payload.userPhone = localUser.phone || localUser.id;
            }
            payload.createdById = localUser.id;
          } catch (readErr) {
            console.warn('Failed to read users doc, using local phone', readErr);
            payload.userPhone = localUser.phone || localUser.id;
            payload.createdById = localUser.id;
          }

          const docId = `${localUser.id}_${Date.now()}`;
          await setDoc(doc(db, 'accommodations', docId), payload);
          onPost && onPost({ ...accom, id: docId });
          Alert.alert('Posted', 'Accommodation posted');
        } catch (err) {
          console.error('Failed to write accommodation to Firestore', err);
          Alert.alert('Error', 'Unable to save accommodation to server.');
        }
      }

  // reset some fields
  setTitle(''); setDescription(''); setContact(''); setCity(''); setStreet(''); setSalary(''); setRent('');
  setPickerMarker(null); setPickerCity(''); setPickerDistanceKm(null);
  setDurationEnabled(false); setStartDate(''); setEndDate('');
    } catch (err) {
      console.error('Firestore write failed', err);
      Alert.alert('Error', 'Failed to post — please try again');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        <TouchableOpacity onPress={() => setPostKind('job')} style={[shared.smallButton, { backgroundColor: postKind==='job' ? Colors.primary : Colors.card, marginRight: 8 }]}>
          <Text style={{ color: postKind==='job' ? Colors.card : Colors.primary }}>Post Job</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPostKind('accommodation')} style={[shared.smallButton, { backgroundColor: postKind==='accommodation' ? Colors.primary : Colors.card }]}>
          <Text style={{ color: postKind==='accommodation' ? Colors.card : Colors.primary }}>Post Accommodation</Text>
        </TouchableOpacity>
      </View>

      {postKind === 'job' && (
        <>
          <TextInput placeholder="Job title" value={title} onChangeText={setTitle} style={shared.input} />

          <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setShowCurrencyPicker(true)} style={[shared.smallButton, { marginRight: 8 }]}>
              <Text style={{ color: Colors.primary }}>{currency}</Text>
            </TouchableOpacity>
            <Text style={{ color: Colors.muted }}>Currency</Text>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <TextInput placeholder="Salary" value={salary} onChangeText={setSalary} style={[shared.input, { flex: 1 }]} keyboardType="numeric" />
            <TouchableOpacity style={[shared.smallButton, { marginLeft: 8 }]} onPress={() => {
              // cycle hourly -> daily -> weekly -> hourly
              setSalaryType(prev => prev === 'hourly' ? 'daily' : (prev === 'daily' ? 'weekly' : 'hourly'))
            }}>
              <Text>{salaryType === 'hourly' ? '/hr' : (salaryType === 'daily' ? '/day' : '/week')}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 8 }}>
            <TouchableOpacity onPress={openMapPicker} style={[shared.smallButton, { alignSelf: 'flex-start' }]}>
              <Text>Pick location on map</Text>
            </TouchableOpacity>
            {pickerMarker && (
              <Text style={{ marginTop: 8, color: Colors.muted }}>Picked: {pickerCity || 'Picked location'} {pickerDistanceKm ? '— ' + pickerDistanceKm.toFixed(1) + ' km away' : ''}</Text>
            )}
          </View>

          <TextInput placeholder="Address" value={city} onChangeText={setCity} style={[shared.input, { marginTop: 8 }]} />
          <View style={{ marginTop: 8 }}>
            <Text style={{ marginBottom: 6, fontWeight: '600' }}>Schedule (optional)</Text>
            {days.map(d => (
              <View key={d} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Switch value={schedule[d].enabled} onValueChange={() => toggleDay(d)} />
                <Text style={{ width: 36, marginLeft: 8 }}>{d}</Text>
                <TextInput placeholder="Start (e.g. 10 am)" value={schedule[d].start} onChangeText={v => setDayTime(d, 'start', v)} style={[shared.input, { flex: 1, marginLeft: 8 }]} />
                <TextInput placeholder="End (e.g. 6 pm)" value={schedule[d].end} onChangeText={v => setDayTime(d, 'end', v)} style={[shared.input, { flex: 1, marginLeft: 8 }]} />
              </View>
            ))}
          </View>
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Switch value={durationEnabled} onValueChange={setDurationEnabled} />
              <Text style={{ marginLeft: 8 }}>Set duration (start / end dates)</Text>
            </View>
            {durationEnabled ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <TouchableOpacity onPress={() => setShowStartPicker(true)} style={[shared.smallButton, { marginRight: 8 }]}>
                    <Text>{startDate ? startDate : 'Pick start date'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowEndPicker(true)} style={shared.smallButton}>
                    <Text>{endDate ? endDate : 'Pick end date'}</Text>
                  </TouchableOpacity>
                </View>
                {showStartPicker && (
                  <DateTimePicker
                    value={startDate ? new Date(startDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={(e, d) => {
                      setShowStartPicker(false);
                      if (d) {
                        const iso = d.toISOString().slice(0,10);
                        setStartDate(iso);
                      }
                    }}
                  />
                )}
                {showEndPicker && (
                  <DateTimePicker
                    value={endDate ? new Date(endDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={(e, d) => {
                      setShowEndPicker(false);
                      if (d) {
                        const iso = d.toISOString().slice(0,10);
                        setEndDate(iso);
                      }
                    }}
                  />
                )}
              </View>
            ) : null}
          </View>
        </>
      )}

      {postKind === 'accommodation' && (
        <>
          <TextInput placeholder="BHK / Room (e.g. 1BHK, Single Room)" value={accomType} onChangeText={setAccomType} style={shared.input} />
          <TextInput placeholder="Monthly Rent" value={rent} onChangeText={setRent} style={[shared.input, { marginTop: 8 }]} keyboardType="numeric" />
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <TouchableOpacity style={[shared.smallButton, { backgroundColor: accomAvailability==='Sharing' ? Colors.primary : Colors.card, marginRight: 8 }]} onPress={() => setAccomAvailability('Sharing')}>
              <Text style={{ color: accomAvailability==='Sharing' ? Colors.card : Colors.primary }}>Sharing</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[shared.smallButton, { backgroundColor: accomAvailability==='Whole' ? Colors.primary : Colors.card }]} onPress={() => setAccomAvailability('Whole')}>
              <Text style={{ color: accomAvailability==='Whole' ? Colors.card : Colors.primary }}>Whole</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={openMapPicker} style={[shared.smallButton, { alignSelf: 'flex-start', marginTop: 8 }]}>
            <Text>Pick location on map</Text>
          </TouchableOpacity>
          {pickerMarker && (
            <Text style={{ marginTop: 8, color: Colors.muted }}>Picked: {pickerCity || 'Picked location'} {pickerDistanceKm ? '— ' + pickerDistanceKm.toFixed(1) + ' km away' : ''}</Text>
          )}
          <TextInput placeholder="City" value={city} onChangeText={setCity} style={[shared.input, { marginTop: 8 }]} />
          <TextInput placeholder="Street / Area (don't put full home address)" value={street} onChangeText={setStreet} style={[shared.input, { marginTop: 8 }]} />
        </>
      )}

      {/* shared duration UI for accommodations (in case user toggles on accom specific) */}
      {postKind === 'accommodation' && (
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Switch value={durationEnabled} onValueChange={setDurationEnabled} />
            <Text style={{ marginLeft: 8 }}>Set duration (start / end dates)</Text>
          </View>
          {durationEnabled ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <TouchableOpacity onPress={() => setShowStartPicker(true)} style={[shared.smallButton, { marginRight: 8 }]}>
                  <Text>{startDate ? startDate : 'Pick start date'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowEndPicker(true)} style={shared.smallButton}>
                  <Text>{endDate ? endDate : 'Pick end date'}</Text>
                </TouchableOpacity>
              </View>
              {showStartPicker && (
                <DateTimePicker
                  value={startDate ? new Date(startDate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(e, d) => {
                    setShowStartPicker(false);
                    if (d) setStartDate(d.toISOString().slice(0,10));
                  }}
                />
              )}
              {showEndPicker && (
                <DateTimePicker
                  value={endDate ? new Date(endDate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(e, d) => {
                    setShowEndPicker(false);
                    if (d) setEndDate(d.toISOString().slice(0,10));
                  }}
                />
              )}
            </View>
          ) : null}
        </View>
      )}

  {/* Professional posting UI removed */}

      <TextInput placeholder="Description / details about Job and other stuffs" value={description} onChangeText={setDescription} style={[shared.input, { marginTop: 8, height: 100 }]} multiline />
  <TextInput placeholder="Contact (phone or email)" value={contact} onChangeText={setContact} style={[shared.input, { marginTop: 8 }]} keyboardType="default" autoCapitalize="none" />

      {/* location picker moved above Address input */}

      {/* Images removed — not required per spec */}

      <TouchableOpacity style={[shared.primaryButton, { marginTop: 12 }]} onPress={submit}>
        <Text style={shared.primaryButtonText}>{postKind === 'job' ? 'Post Job' : 'Post Accommodation'}</Text>
      </TouchableOpacity>

      {/* Map picker modal for post location */}
      <Modal visible={showMapPicker} animationType="slide">
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            {pickerRegion ? (
              <MapView style={{ flex: 1 }} initialRegion={pickerRegion} onPress={async (e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                const marker = { latitude, longitude };
                setPickerMarker(marker);
                try {
                  const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
                  const first = rev && rev[0];
                  const cityName = first?.city || first?.subregion || first?.region || first?.name || '';
                  setPickerCity(cityName);
                } catch (err) { setPickerCity(''); }
                if (userLocation) { const d = haversineKm(userLocation, { latitude, longitude }); setPickerDistanceKm(d); }
              }}>
                <UrlTile urlTemplate="https://c.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
                {userLocation && <Marker key="you-marker" coordinate={userLocation} pinColor="blue" title="You" />}
                {pickerMarker && <Marker key="picker-marker" coordinate={pickerMarker} pinColor="red" />}
              </MapView>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ marginTop: 8 }}>Preparing map — acquiring location...</Text>
              </View>
            )}
          </View>

          <View style={{ padding: 12, borderTopWidth: 1, borderColor: Colors.border }}>
            <Text style={{ marginBottom: 8, color: Colors.muted }}>Tap on the map to place a marker. Blue marker = your location. Pick a nearby point, don't share full home address.</Text>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity onPress={() => setShowMapPicker(false)} style={[shared.smallButton, { marginRight: 8 }]}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowMapPicker(false); if (pickerCity) setCity(pickerCity); }} style={[shared.primaryButton, { flex: 1 }]}>
                <Text style={shared.primaryButtonText}>Use this location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

  {/* Profile map picker removed */}

      <Modal visible={showCurrencyPicker} animationType="slide">
        <View style={{ flex: 1 }}>
          <View style={{ padding: 12, flex: 1 }}>
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Select currency</Text>
            <FlatList nestedScrollEnabled data={currencyList} keyExtractor={c => c} renderItem={({ item }) => (
              <TouchableOpacity key={item} onPress={() => { setCurrency(item); setShowCurrencyPicker(false); }} style={[shared.smallButton, { marginBottom: 8 }]}>
                <Text>{item}</Text>
              </TouchableOpacity>
            )} />
          </View>
          <View style={{ padding: 12 }}>
            <TouchableOpacity onPress={() => setShowCurrencyPicker(false)} style={[shared.smallButton]}>
              <Text>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
