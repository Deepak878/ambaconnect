import React, { useState, useEffect } from 'react';
import { ScrollView, TextInput, TouchableOpacity, Text, View, Alert, Image, Modal, FlatList } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors, shared } from './Theme';

const placeholder = require('../assets/icon.png');

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

export default function PostScreen({ onPost }) {
  const [postKind, setPostKind] = useState('job'); // 'job' or 'accommodation'

  // common
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');

  // job-specific
  const [type, setType] = useState('Part-time');
  const [salary, setSalary] = useState('');
  const [salaryType, setSalaryType] = useState('hourly');

  // accommodation-specific
  const [accomType, setAccomType] = useState('1BHK');
  const [rent, setRent] = useState('');

  const [accomAvailability, setAccomAvailability] = useState('Sharing'); // 'Sharing' or 'Whole'

  const [image, setImage] = useState(placeholder);
  const [images, setImages] = useState([placeholder]);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickerRegion, setPickerRegion] = useState(null);
  const [pickerMarker, setPickerMarker] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [pickerCity, setPickerCity] = useState('');
  const [pickerDistanceKm, setPickerDistanceKm] = useState(null);
  const [currency, setCurrency] = useState('USD');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const currencyList = [
    'USD','EUR','GBP','INR','NPR','AUD','CAD','JPY','CNY','SGD','HKD','ZAR','BRL','RUB','MXN','KRW','AED','SAR','TRY','CHF','SEK','NOK','DKK','PLN','IDR','MYR','THB','VND','PHP','KES','NGN'
  ];

  useEffect(() => {
    // cache user location so picker opens fast
    (async () => {
      try {
        const res = await Location.getForegroundPermissionsAsync?.() || await Location.requestForegroundPermissionsAsync();
        if (res.status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          setPickerRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 });
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const submit = () => {
    if (postKind === 'job') {
      if (!title || !salary) { Alert.alert('Missing', 'Provide job title and salary'); return; }
      const job = {
        kind: 'job',
        title,
        type,
        salary: Number(salary),
        salaryType,
        currency,
        location: pickerMarker ? `${pickerDistanceKm ? pickerDistanceKm.toFixed(1) + ' km away' : (pickerCity || city || 'Nearby')}` : (city || 'Nearby'),
        description,
        contact: contact || 'Hidden until profile image tapped',
        lat: pickerMarker ? pickerMarker.latitude : 37.78825 + (Math.random() - 0.5) * 0.02,
        lng: pickerMarker ? pickerMarker.longitude : -122.4324 + (Math.random() - 0.5) * 0.02,
        images: images && images.length ? images : [placeholder],
      };
      onPost(job);
      Alert.alert('Posted', 'Job posted');
    } else {
      if (!accomType || !rent || !city || !accomAvailability) { Alert.alert('Missing', 'Provide BHK, rent, city and availability'); return; }
      const accom = {
        kind: 'accommodation',
        title: `${accomType} available in ${city}`,
        accomType,
        rent: Number(rent),
        currency,
        availability: accomAvailability,
        location: pickerMarker ? `${pickerCity || city} ${pickerDistanceKm ? '(' + pickerDistanceKm.toFixed(1) + ' km away)' : ''}` : `${street || ''} ${city}`.trim(),
        description: description || 'Sharing available',
        contact: contact || 'Hidden until profile image tapped',
        lat: pickerMarker ? pickerMarker.latitude : 37.78825 + (Math.random() - 0.5) * 0.02,
        lng: pickerMarker ? pickerMarker.longitude : -122.4324 + (Math.random() - 0.5) * 0.02,
        images: images && images.length ? images : [placeholder],
      };
      onPost(accom);
      Alert.alert('Posted', 'Accommodation posted (in-memory)');
    }

    // reset
    setTitle(''); setDescription(''); setContact(''); setCity(''); setStreet(''); setSalary(''); setRent(''); setAccomAvailability('Sharing');
    setPickerMarker(null); setPickerCity(''); setPickerDistanceKm(null);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity onPress={() => setPostKind('job')} style={[shared.smallButton, { backgroundColor: postKind==='job' ? Colors.primary : Colors.card, marginRight: 8 }]}>
          <Text style={{ color: postKind==='job' ? Colors.card : Colors.primary, fontWeight: '700' }}>Post Job</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPostKind('accommodation')} style={[shared.smallButton, { backgroundColor: postKind==='accommodation' ? Colors.primary : Colors.card }]}>
          <Text style={{ color: postKind==='accommodation' ? Colors.card : Colors.primary, fontWeight: '700' }}>Post Accommodation</Text>
        </TouchableOpacity>
      </View>

      {postKind === 'job' ? (
        <>
          <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setShowCurrencyPicker(true)} style={[shared.smallButton, { marginRight: 8 }]}>
              <Text style={{ color: Colors.primary }}>Currency: {currency}</Text>
            </TouchableOpacity>
            <Text style={{ color: Colors.muted }}>Choose currency for salary</Text>
          </View>
          <TextInput placeholder="Job title" value={title} onChangeText={setTitle} style={shared.input} />
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <TouchableOpacity style={[shared.smallButton, { backgroundColor: type==='Part-time'? Colors.primary : Colors.card, marginRight:8 }]} onPress={() => setType('Part-time')}>
              <Text style={{ color: type==='Part-time' ? Colors.card : Colors.primary }}>Part-time</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[shared.smallButton, { backgroundColor: type==='Full-time'? Colors.primary : Colors.card }]} onPress={() => setType('Full-time')}>
              <Text style={{ color: type==='Full-time' ? Colors.card : Colors.primary }}>Full-time</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <TextInput placeholder="Salary" value={salary} onChangeText={setSalary} style={[shared.input, { flex: 1 }]} keyboardType="numeric" />
            <TouchableOpacity style={[shared.smallButton, { backgroundColor: salaryType==='hourly'? Colors.primary : Colors.card, marginLeft:8 }]} onPress={() => setSalaryType('hourly')}>
              <Text style={{ color: salaryType==='hourly' ? Colors.card : Colors.primary }}>/hr</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[shared.smallButton, { backgroundColor: salaryType==='weekly'? Colors.primary : Colors.card, marginLeft:8 }]} onPress={() => setSalaryType('weekly')}>
              <Text style={{ color: salaryType==='weekly' ? Colors.card : Colors.primary }}>/week</Text>
            </TouchableOpacity>
          </View>

          <TextInput placeholder="City" value={city} onChangeText={setCity} style={[shared.input, { marginTop: 8 }]} />
        </>
      ) : (
        <>
          <TextInput placeholder="BHK / Room (e.g. 1BHK, Single Room)" value={accomType} onChangeText={setAccomType} style={shared.input} />
          <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setShowCurrencyPicker(true)} style={[shared.smallButton, { marginRight: 8 }]}>
              <Text style={{ color: Colors.primary }}>Currency: {currency}</Text>
            </TouchableOpacity>
            <Text style={{ color: Colors.muted }}>Choose currency for rent</Text>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <TextInput placeholder="Monthly Rent" value={rent} onChangeText={setRent} style={[shared.input, { flex: 1 }]} keyboardType="numeric" />
          </View>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <TouchableOpacity style={[shared.smallButton, { backgroundColor: accomAvailability==='Sharing' ? Colors.primary : Colors.card, marginRight: 8 }]} onPress={() => setAccomAvailability('Sharing')}>
              <Text style={{ color: accomAvailability==='Sharing' ? Colors.card : Colors.primary }}>Sharing</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[shared.smallButton, { backgroundColor: accomAvailability==='Whole' ? Colors.primary : Colors.card }]} onPress={() => setAccomAvailability('Whole')}>
              <Text style={{ color: accomAvailability==='Whole' ? Colors.card : Colors.primary }}>Whole apartment</Text>
            </TouchableOpacity>
          </View>
          <TextInput placeholder="City" value={city} onChangeText={setCity} style={[shared.input, { marginTop: 8 }]} />
          <TextInput placeholder="Street / Area (don't put full home address)" value={street} onChangeText={setStreet} style={[shared.input, { marginTop: 8 }]} />
        </>
      )}

      <TextInput placeholder="Description / Sharing details" value={description} onChangeText={setDescription} style={[shared.input, { marginTop: 8, height: 100 }]} multiline />

      <TextInput placeholder="Contact (optional)" value={contact} onChangeText={setContact} style={[shared.input, { marginTop: 8 }]} keyboardType="phone-pad" />

      

      <View style={{ marginTop: 8 }}>
        <TouchableOpacity onPress={async () => {
          try {
            const res = await Location.requestForegroundPermissionsAsync();
            if (res.status !== 'granted') { Alert.alert('Permission', 'Location permission required to pick a point on map'); return; }
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            setPickerRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 });
            setShowMapPicker(true);
          } catch (e) {
            Alert.alert('Error', 'Unable to get location');
          }
        }} style={[shared.smallButton, { alignSelf: 'flex-start' }]}>
          <Text>Pick location on map</Text>
        </TouchableOpacity>
        {pickerMarker && (
          <Text style={{ marginTop: 8, color: Colors.muted }}>Picked: {pickerCity || 'Unknown city'} — {pickerDistanceKm ? pickerDistanceKm.toFixed(1) + ' km away' : ''} (Lat: {pickerMarker.latitude.toFixed(4)}, Lng: {pickerMarker.longitude.toFixed(4)})</Text>
        )}
      </View>

      <View style={{ marginTop: 8 }}>
        <Text style={{ marginBottom: 8 }}>Images (up to 5):</Text>
  <FlatList horizontal nestedScrollEnabled data={images} keyExtractor={(i, idx) => (i.uri || i) + idx} renderItem={({ item, index }) => (
          <View style={{ marginRight: 8, alignItems: 'center' }}>
            <Image source={typeof item === 'string' ? { uri: item } : item} style={{ width: 120, height: 90, borderRadius: 8 }} />
            <Text style={{ fontSize: 11, marginTop: 4 }}>{index === 0 ? 'Primary' : `#${index+1}`}</Text>
          </View>
        )} />
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <TouchableOpacity onPress={async () => {
            try {
              const ImagePicker = await import('expo-image-picker');
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) { Alert.alert('Permission', 'Media library permission required'); return; }
              const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.7 });
              if (res.cancelled) return;
              let picked = [];
              if (res.assets) picked = res.assets.map(a => a.uri);
              else if (res.uri) picked = [res.uri];
              const combined = [...images.filter(i => i !== placeholder), ...picked].slice(0,5);
              setImages(combined.length ? combined : [placeholder]);
            } catch (e) {
              Alert.alert('Error', 'Image picker not available');
            }
          }} style={[shared.smallButton, { marginRight: 8 }]}>
            <Text>Select Images</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setImages([placeholder]); }} style={shared.smallButton}>
            <Text>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={[shared.primaryButton, { marginTop: 12 }]} onPress={submit}>
        <Text style={shared.primaryButtonText}>{postKind === 'job' ? 'Post Job' : 'Post Accommodation'}</Text>
      </TouchableOpacity>

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
                } catch (err) {
                  setPickerCity('');
                }
                if (userLocation) {
                  const d = haversineKm(userLocation, { latitude, longitude });
                  setPickerDistanceKm(d);
                }
              }}>
                <UrlTile urlTemplate="https://c.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
                {userLocation && <Marker key="you-marker" coordinate={userLocation} pinColor="blue" title="You" />}
                {pickerMarker && <Marker key="picker-marker" coordinate={pickerMarker} pinColor="red" />}
              </MapView>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text>Preparing map...</Text>
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
