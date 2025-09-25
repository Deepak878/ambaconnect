import React, { useState } from 'react';
import { ScrollView, TextInput, TouchableOpacity, Text, View, Alert, Modal, FlatList, Switch, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors, shared } from './Theme';
import { app, db } from '../firebaseConfig';
import { serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateField, sanitizeInput, ContentFilter } from '../utils/validation';
import { LoadingSpinner } from './LoadingSpinner';

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
  const [postKind, setPostKind] = useState('job');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Common fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');

  // Job fields
  const [type, setType] = useState('Part-time');
  const [salary, setSalary] = useState('');
  const [salaryType, setSalaryType] = useState('hourly');
  const [currency, setCurrency] = useState('USD');

  // Accommodation fields
  const [accomType, setAccomType] = useState('1BHK');
  const [rent, setRent] = useState('');
  const [accomAvailability, setAccomAvailability] = useState('Sharing');

  // Schedule for jobs
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const [schedule, setSchedule] = useState(() => {
    const s = {};
    days.forEach(d => { s[d] = { enabled: false, start: '', end: '' }; });
    return s;
  });

  // Location and UI states
  const [userLocation, setUserLocation] = useState(null);
  const [pickerMarker, setPickerMarker] = useState(null);
  const [pickerCity, setPickerCity] = useState('');
  const [pickerDistanceKm, setPickerDistanceKm] = useState(null);
  const [pickerRegion, setPickerRegion] = useState(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  // Duration fields
  const [durationEnabled, setDurationEnabled] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const validateInput = (field, value) => {
    const validation = validateField(field, value);
    setErrors(prev => ({
      ...prev,
      [field]: validation.isValid ? '' : validation.message
    }));
    return validation;
  };

  const generateTags = (title, description) => {
    const text = (title + ' ' + description).toLowerCase();
    const words = text.split(/\s+/).filter(word => word.length > 2);
    return [...new Set(words)].slice(0, 10);
  };

  const toggleDay = (d) => {
    setSchedule(prev => ({ ...prev, [d]: { ...prev[d], enabled: !prev[d].enabled } }));
  };

  const setDayTime = (d, field, value) => {
    setSchedule(prev => ({ ...prev, [d]: { ...prev[d], [field]: value } }));
  };

  const openMapPicker = async () => {
    setShowMapPicker(true);
    setPickerMarker(null);
    setPickerDistanceKm(null);
    setPickerCity('');

    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last && last.coords) {
        setUserLocation({ latitude: last.coords.latitude, longitude: last.coords.longitude });
        setPickerRegion({ latitude: last.coords.latitude, longitude: last.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 });
        return;
      }
    } catch (_) {}

    try {
      const res = await Location.requestForegroundPermissionsAsync();
      if (res.status !== 'granted') {
        Alert.alert('Permission', 'Location permission required to pick a point on map');
        setPickerRegion({ latitude: 27.7172, longitude: 85.3240, latitudeDelta: 0.1, longitudeDelta: 0.1 });
        return;
      }

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
      setPickerRegion({ latitude: 27.7172, longitude: 85.3240, latitudeDelta: 0.1, longitudeDelta: 0.1 });
    }
  };

  const submit = async () => {
    setLoading(true);
    setErrors({});

    if (ContentFilter.containsInappropriateContent(title) || ContentFilter.containsInappropriateContent(description)) {
      Alert.alert('Content Policy Violation', 'Your post contains inappropriate content. Please review and edit your submission.');
      setLoading(false);
      return;
    }

    try {
      if (postKind === 'job') {
        const titleValidation = validateField('jobTitle', title);
        const salaryValidation = validateField('salary', salary);
        
        if (!titleValidation.isValid) {
          setErrors(prev => ({ ...prev, title: titleValidation.message }));
          setLoading(false);
          return;
        }
        
        if (!salaryValidation.isValid) {
          setErrors(prev => ({ ...prev, salary: salaryValidation.message }));
          setLoading(false);
          return;
        }
        
        if (!pickerMarker) {
          Alert.alert('Location Required', 'Please pick a location on the map for this job post');
          setLoading(false);
          return;
        }

        const sanitizedTitle = sanitizeInput(titleValidation.sanitizedValue);
        const sanitizedDescription = sanitizeInput(description);
        const sanitizedContact = sanitizeInput(contact);

        const job = {
          kind: 'job',
          title: sanitizedTitle,
          type,
          salary: Number(salaryValidation.sanitizedValue),
          salaryType,
          currency,
          schedule,
          location: pickerMarker ? `${pickerDistanceKm ? pickerDistanceKm.toFixed(1) + ' km away' : (pickerCity || city || 'Nearby')}` : (city || 'Nearby'),
          description: sanitizedDescription,
          contact: sanitizedContact || 'Hidden until profile tapped',
          lat: pickerMarker ? pickerMarker.latitude : (userLocation ? userLocation.latitude + (Math.random() - 0.5) * 0.02 : 37.78825),
          lng: pickerMarker ? pickerMarker.longitude : (userLocation ? userLocation.longitude + (Math.random() - 0.5) * 0.02 : -122.4324),
          createdAt: new Date().toISOString(),
          images: [],
          duration: durationEnabled ? { start: startDate || null, end: endDate || null } : null,
          tags: generateTags(sanitizedTitle, sanitizedDescription),
        };

        try {
          const payload = { ...job, createdAt: serverTimestamp() };
          let localUser = null;
          
          try {
            const local = await AsyncStorage.getItem('user');
            if (local) {
              localUser = JSON.parse(local);
              payload.createdBy = localUser;
            }
          } catch (_) {}

          if (!localUser || !localUser.id) {
            Alert.alert('Login required', 'Please login or register before posting.');
            setLoading(false);
            return;
          }

          payload.userPhone = localUser.phone || localUser.id;
          payload.createdById = localUser.id;

          const docId = `${localUser.id}_${Date.now()}`;
          await setDoc(doc(db, 'jobs', docId), payload);
          
          onPost && onPost({ ...job, id: docId });
          Alert.alert('Posted', 'Job posted successfully');
        } catch (err) {
          console.error('Failed to write job to Firestore', err);
          Alert.alert('Error', 'Unable to save job to server.');
          setLoading(false);
          return;
        }
      } else if (postKind === 'accommodation') {
        if (!accomType || !rent || !city || !accomAvailability) {
          Alert.alert('Missing', 'Provide BHK, rent, city and availability');
          setLoading(false);
          return;
        }
        
        if (!pickerMarker) {
          Alert.alert('Location Required', 'Please pick a location on the map for this accommodation post');
          setLoading(false);
          return;
        }

        const sanitizedDescription = sanitizeInput(description);
        const sanitizedContact = sanitizeInput(contact);
        const sanitizedCity = sanitizeInput(city);

        const accom = {
          kind: 'accommodation',
          title: `${accomType} available in ${sanitizedCity}`,
          accomType,
          rent: Number(rent),
          currency,
          availability: accomAvailability,
          location: pickerMarker ? `${pickerCity || sanitizedCity} ${pickerDistanceKm ? '(' + pickerDistanceKm.toFixed(1) + ' km away)' : ''}` : `${street || ''} ${sanitizedCity}`.trim(),
          description: sanitizedDescription || 'Sharing available',
          contact: sanitizedContact || 'Hidden until profile tapped',
          lat: pickerMarker.latitude,
          lng: pickerMarker.longitude,
          createdAt: new Date().toISOString(),
          images: [],
          duration: durationEnabled ? { start: startDate || null, end: endDate || null } : null,
          tags: generateTags(accomType, sanitizedDescription),
        };

        try {
          const payload = { ...accom, createdAt: serverTimestamp() };
          let localUser = null;
          
          try {
            const local = await AsyncStorage.getItem('user');
            if (local) {
              localUser = JSON.parse(local);
              payload.createdBy = localUser;
            }
          } catch (_) {}

          if (!localUser || !localUser.id) {
            Alert.alert('Login required', 'Please login or register before posting.');
            setLoading(false);
            return;
          }

          payload.userPhone = localUser.phone || localUser.id;
          payload.createdById = localUser.id;

          const docId = `${localUser.id}_${Date.now()}`;
          await setDoc(doc(db, 'accommodations', docId), payload);
          
          onPost && onPost({ ...accom, id: docId });
          Alert.alert('Posted', 'Accommodation posted successfully');
        } catch (err) {
          console.error('Failed to write accommodation to Firestore', err);
          Alert.alert('Error', 'Unable to save accommodation to server.');
          setLoading(false);
          return;
        }
      }

      // Reset form
      setTitle('');
      setDescription('');
      setContact('');
      setCity('');
      setStreet('');
      setSalary('');
      setRent('');
      setPickerMarker(null);
      setPickerCity('');
      setPickerDistanceKm(null);
      setDurationEnabled(false);
      setStartDate('');
      setEndDate('');
      setErrors({});
      // Reset schedule
      const resetSchedule = {};
      days.forEach(d => { resetSchedule[d] = { enabled: false, start: '', end: '' }; });
      setSchedule(resetSchedule);
      
    } catch (err) {
      console.error('Posting failed', err);
      Alert.alert('Error', 'Failed to post — please try again');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Posting your listing..." />;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Post Type Selector */}
      <View style={{ flexDirection: 'row', marginBottom: 16 }}>
        <TouchableOpacity 
          onPress={() => setPostKind('job')} 
          style={[
            shared.smallButton, 
            { 
              backgroundColor: postKind==='job' ? Colors.primary : Colors.card, 
              marginRight: 8,
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }
          ]}
        >
          <Ionicons 
            name="briefcase" 
            size={16} 
            color={postKind==='job' ? Colors.card : Colors.primary}
            style={{ marginRight: 6 }}
          />
          <Text style={{ 
            color: postKind==='job' ? Colors.card : Colors.primary,
            fontWeight: '600',
          }}>
            Post Job
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setPostKind('accommodation')} 
          style={[
            shared.smallButton, 
            { 
              backgroundColor: postKind==='accommodation' ? Colors.primary : Colors.card,
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }
          ]}
        >
          <Ionicons 
            name="home" 
            size={16} 
            color={postKind==='accommodation' ? Colors.card : Colors.primary}
            style={{ marginRight: 6 }}
          />
          <Text style={{ 
            color: postKind==='accommodation' ? Colors.card : Colors.primary,
            fontWeight: '600',
          }}>
            Post Housing
          </Text>
        </TouchableOpacity>
      </View>

      {/* Job Form */}
      {postKind === 'job' && (
        <>
          <View style={shared.mb16}>
            <Text style={shared.heading3}>Job Details</Text>
            <TextInput 
              placeholder="Job title (e.g., Barista, Warehouse Helper)" 
              value={title} 
              onChangeText={(text) => {
                setTitle(text);
                if (errors.title) validateInput('jobTitle', text);
              }}
              style={[
                shared.input, 
                { marginTop: 8 },
                errors.title && { borderColor: Colors.danger }
              ]}
            />
            {errors.title && (
              <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4 }}>
                {errors.title}
              </Text>
            )}
          </View>

          <View style={[shared.row, shared.mb12]}>
            <TouchableOpacity 
              onPress={() => setShowCurrencyPicker(true)} 
              style={[shared.smallButton, { marginRight: 8 }]}
            >
              <Text style={{ color: Colors.primary }}>{currency}</Text>
            </TouchableOpacity>
            <TextInput 
              placeholder="Salary amount" 
              value={salary} 
              onChangeText={(text) => {
                setSalary(text);
                if (errors.salary) validateInput('salary', text);
              }}
              style={[
                shared.input, 
                { flex: 1, marginRight: 8 },
                errors.salary && { borderColor: Colors.danger }
              ]} 
              keyboardType="numeric" 
            />
            <TouchableOpacity 
              style={shared.smallButton} 
              onPress={() => {
                setSalaryType(prev => 
                  prev === 'hourly' ? 'daily' : 
                  (prev === 'daily' ? 'weekly' : 'hourly')
                );
              }}
            >
              <Text>{salaryType === 'hourly' ? '/hr' : (salaryType === 'daily' ? '/day' : '/week')}</Text>
            </TouchableOpacity>
          </View>
          {errors.salary && (
            <Text style={{ color: Colors.danger, fontSize: 12, marginBottom: 12 }}>
              {errors.salary}
            </Text>
          )}

          <View style={shared.mb12}>
            <TouchableOpacity 
              onPress={openMapPicker} 
              style={[shared.secondaryButton, { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' }]}
            >
              <Ionicons name="location" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={shared.secondaryButtonText}>Pick location on map</Text>
            </TouchableOpacity>
            {pickerMarker && (
              <Text style={[shared.captionText, shared.mt8]}>
                Selected: {pickerCity || 'Picked location'} 
                {pickerDistanceKm ? ` — ${pickerDistanceKm.toFixed(1)} km away` : ''}
              </Text>
            )}
          </View>

          <TextInput 
            placeholder="Address/Area" 
            value={city} 
            onChangeText={setCity} 
            style={[shared.input, shared.mb12]} 
          />
        </>
      )}

      {/* Accommodation Form */}
      {postKind === 'accommodation' && (
        <>
          <View style={shared.mb16}>
            <Text style={shared.heading3}>Housing Details</Text>
            <TextInput 
              placeholder="Type (e.g., 1BHK, Single Room, Studio)" 
              value={accomType} 
              onChangeText={setAccomType} 
              style={[shared.input, shared.mt8]} 
            />
          </View>

          <View style={[shared.row, shared.mb12]}>
            <TextInput 
              placeholder="Monthly rent" 
              value={rent} 
              onChangeText={setRent} 
              style={[shared.input, { flex: 1, marginRight: 8 }]} 
              keyboardType="numeric" 
            />
            <TouchableOpacity 
              onPress={() => setShowCurrencyPicker(true)}
              style={shared.smallButton}
            >
              <Text style={{ color: Colors.primary }}>{currency}</Text>
            </TouchableOpacity>
          </View>

          <View style={[shared.row, shared.mb12]}>
            <TouchableOpacity 
              style={[
                shared.smallButton, 
                { 
                  backgroundColor: accomAvailability==='Sharing' ? Colors.primary : Colors.card, 
                  marginRight: 8, 
                  flex: 1 
                }
              ]} 
              onPress={() => setAccomAvailability('Sharing')}
            >
              <Text style={{ 
                color: accomAvailability==='Sharing' ? Colors.card : Colors.primary,
                textAlign: 'center'
              }}>
                Sharing
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                shared.smallButton, 
                { 
                  backgroundColor: accomAvailability==='Whole' ? Colors.primary : Colors.card,
                  flex: 1
                }
              ]} 
              onPress={() => setAccomAvailability('Whole')}
            >
              <Text style={{ 
                color: accomAvailability==='Whole' ? Colors.card : Colors.primary,
                textAlign: 'center'
              }}>
                Whole Place
              </Text>
            </TouchableOpacity>
          </View>

          <View style={shared.mb12}>
            <TouchableOpacity 
              onPress={openMapPicker} 
              style={[shared.secondaryButton, { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' }]}
            >
              <Ionicons name="location" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={shared.secondaryButtonText}>Pick location on map</Text>
            </TouchableOpacity>
            {pickerMarker && (
              <Text style={[shared.captionText, shared.mt8]}>
                Selected: {pickerCity || 'Picked location'} 
                {pickerDistanceKm ? ` — ${pickerDistanceKm.toFixed(1)} km away` : ''}
              </Text>
            )}
          </View>

          <TextInput 
            placeholder="City" 
            value={city} 
            onChangeText={setCity} 
            style={[shared.input, shared.mb8]} 
          />
          <TextInput 
            placeholder="Street/Area (don't include full address)" 
            value={street} 
            onChangeText={setStreet} 
            style={[shared.input, shared.mb12]} 
          />
        </>
      )}

      {/* Common Fields */}
      <TextInput 
        placeholder="Description and additional details" 
        value={description} 
        onChangeText={setDescription} 
        style={[shared.input, { height: 100, textAlignVertical: 'top' }, shared.mb12]} 
        multiline 
        numberOfLines={4}
      />

      <TextInput 
        placeholder="Contact (phone or email)" 
        value={contact} 
        onChangeText={setContact} 
        style={[shared.input, shared.mb12]} 
        keyboardType="default" 
        autoCapitalize="none" 
      />

      {/* Duration Toggle */}
      <View style={[shared.row, shared.mb12]}>
        <Switch 
          value={durationEnabled} 
          onValueChange={setDurationEnabled} 
        />
        <Text style={[shared.bodyText, { marginLeft: 8 }]}>
          Set duration (start/end dates)
        </Text>
      </View>

      {durationEnabled && (
        <View style={[shared.row, shared.mb16]}>
          <TouchableOpacity 
            onPress={() => setShowStartPicker(true)} 
            style={[shared.smallButton, { marginRight: 8, flex: 1 }]}
          >
            <Text style={{ textAlign: 'center' }}>
              {startDate ? startDate : 'Start Date'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setShowEndPicker(true)} 
            style={[shared.smallButton, { flex: 1 }]}
          >
            <Text style={{ textAlign: 'center' }}>
              {endDate ? endDate : 'End Date'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Schedule Section for Jobs */}
      {postKind === 'job' && (
        <View style={shared.mb16}>
          <Text style={[shared.heading3, shared.mb12]}>Working Schedule (Optional)</Text>
          <Text style={[shared.captionText, { color: Colors.muted, marginBottom: 12 }]}>
            Set working hours for specific days
          </Text>
          
          {days.map(day => {
            const daySchedule = schedule[day] || { enabled: false, start: '', end: '' };
            return (
              <View key={day} style={{ marginBottom: 12 }}>
                <View style={[shared.row, { alignItems: 'center', marginBottom: 8 }]}>
                  <TouchableOpacity
                    onPress={() => toggleDay(day)}
                    style={[
                      shared.smallButton,
                      {
                        backgroundColor: daySchedule.enabled ? Colors.primary : Colors.bg,
                        borderColor: daySchedule.enabled ? Colors.primary : Colors.border,
                        minWidth: 60,
                        marginRight: 12,
                      }
                    ]}
                  >
                    <Text style={{
                      color: daySchedule.enabled ? Colors.card : Colors.text,
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: '600'
                    }}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                  
                  {daySchedule.enabled && (
                    <>
                      <TextInput
                        placeholder="Start (e.g., 9:00 AM)"
                        value={daySchedule.start}
                        onChangeText={(text) => setDayTime(day, 'start', text)}
                        style={[shared.input, { flex: 1, marginRight: 8, fontSize: 12 }]}
                      />
                      <Text style={{ color: Colors.muted }}>to</Text>
                      <TextInput
                        placeholder="End (e.g., 5:00 PM)"
                        value={daySchedule.end}
                        onChangeText={(text) => setDayTime(day, 'end', text)}
                        style={[shared.input, { flex: 1, marginLeft: 8, fontSize: 12 }]}
                      />
                    </>
                  )}
                </View>
              </View>
            );
          })}
          
          <Text style={[shared.captionText, { color: Colors.muted, fontSize: 11 }]}>
            Tap day buttons to enable/disable. Add times like "9:00 AM" or "09:00"
          </Text>
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity 
        style={[shared.primaryButton, shared.mt16, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} 
        onPress={submit}
        disabled={loading}
      >
        <Ionicons 
          name={postKind === 'job' ? "briefcase" : "home"} 
          size={16} 
          color={Colors.card}
          style={{ marginRight: 8 }}
        />
        <Text style={shared.primaryButtonText}>
          {postKind === 'job' ? 'Post Job' : 'Post Housing'}
        </Text>
      </TouchableOpacity>

      {/* Map Picker Modal */}
      <Modal visible={showMapPicker} animationType="slide">
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            {pickerRegion ? (
              <MapView 
                style={{ flex: 1 }} 
                initialRegion={pickerRegion} 
                onPress={async (e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  const marker = { latitude, longitude };
                  setPickerMarker(marker);
                  
                  try {
                    const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
                    const first = rev && rev[0];
                    const cityName = first?.city || first?.subregion || first?.region || first?.name || '';
                    setPickerCity(cityName);
                  } catch (err) { 
                    setPickerCity(''); 
                  }
                  
                  if (userLocation) { 
                    const d = haversineKm(userLocation, { latitude, longitude }); 
                    setPickerDistanceKm(d); 
                  }
                }}
                showsUserLocation={true}
                showsMyLocationButton={true}
              >
                {pickerMarker && (
                  <Marker 
                    key="picker-marker" 
                    coordinate={pickerMarker} 
                    pinColor="red" 
                    title="Selected Location"
                  />
                )}
              </MapView>
            ) : (
              <LoadingSpinner message="Loading map..." />
            )}
          </View>

          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: Colors.border }}>
            <Text style={[shared.captionText, shared.mb12]}>
              Tap on the map to place a marker at your desired location.
            </Text>
            <View style={shared.row}>
              <TouchableOpacity 
                onPress={() => setShowMapPicker(false)} 
                style={[shared.smallButton, { marginRight: 8, flex: 1 }]}
              >
                <Text style={{ textAlign: 'center' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => { 
                  setShowMapPicker(false); 
                  if (pickerCity) setCity(pickerCity); 
                }} 
                style={[shared.primaryButton, { flex: 1 }]}
                disabled={!pickerMarker}
              >
                <Text style={[shared.primaryButtonText, { textAlign: 'center' }]}>
                  Use Location
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Currency Picker Modal */}
      <Modal visible={showCurrencyPicker} animationType="slide">
        <View style={{ flex: 1 }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
            <Text style={shared.heading2}>Select Currency</Text>
          </View>
          <FlatList 
            data={currencyList} 
            keyExtractor={c => c} 
            renderItem={({ item }) => (
              <TouchableOpacity 
                key={item} 
                onPress={() => { 
                  setCurrency(item); 
                  setShowCurrencyPicker(false); 
                }} 
                style={[shared.smallButton, { margin: 8 }]}
              >
                <Text style={{ textAlign: 'center' }}>{item}</Text>
              </TouchableOpacity>
            )} 
          />
          <View style={{ padding: 16 }}>
            <TouchableOpacity 
              onPress={() => setShowCurrencyPicker(false)} 
              style={shared.secondaryButton}
            >
              <Text style={shared.secondaryButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={startDate ? new Date(startDate) : new Date()}
          mode="date"
          display="default"
          onChange={(e, d) => {
            setShowStartPicker(false);
            if (d) {
              setStartDate(d.toISOString().slice(0,10));
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
              setEndDate(d.toISOString().slice(0,10));
            }
          }}
        />
      )}
    </ScrollView>
  );
}