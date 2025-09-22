import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shared, Colors } from './Theme';

const placeholder = require('../assets/icon.png');

export default function ProfileModal({ visible, user = null, onClose, onSave }) {
  const [name, setName] = useState((user && user.name) ? user.name : '');
  const [email, setEmail] = useState((user && user.email) ? user.email : '');
  const [extraPhone, setExtraPhone] = useState((user && user.extraPhone) ? user.extraPhone : '');
  const [photo, setPhoto] = useState((user && user.photo) ? user.photo : null);
  const [locLoading, setLocLoading] = useState(false);
  const [city, setCity] = useState((user && user.city) ? user.city : '');
  const [country, setCountry] = useState((user && user.country) ? user.country : '');

  useEffect(() => {
    setName((user && user.name) ? user.name : ''); setEmail((user && user.email) ? user.email : ''); setExtraPhone((user && user.extraPhone) ? user.extraPhone : ''); setPhoto((user && user.photo) ? user.photo : null);
    setCity((user && user.city) ? user.city : ''); setCountry((user && user.country) ? user.country : '');
  }, [user, visible]);

  const pickPhoto = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission', 'Media library permission required'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      if (res.cancelled) return;
      const uri = res.assets ? res.assets[0].uri : res.uri;
      setPhoto(uri);
    } catch (e) {
      Alert.alert('Error', 'Image picker not available');
    }
  };

  const fetchLocation = async () => {
    setLocLoading(true);
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      if (res.status !== 'granted') { Alert.alert('Permission', 'Location permission required'); setLocLoading(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const rev = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const first = rev && rev[0];
      setCity(first?.city || first?.region || first?.name || '');
      setCountry(first?.country || '');
    } catch (e) {
      Alert.alert('Error', 'Unable to fetch location');
    }
    setLocLoading(false);
  };

  const handleSave = () => {
    const updated = { ...user, name, email, extraPhone, photo, city, country };
    onSave(updated);
    onClose();
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('user');
    } catch (e) {}
    // inform parent to clear user
    onSave(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={[shared.container, { padding: 16 }]}> 
        <View style={[shared.card, { alignItems: 'center', marginBottom: 12 }]}>
          <TouchableOpacity onPress={pickPhoto} style={{ alignItems: 'center' }}>
            <Image source={photo ? { uri: photo } : placeholder} style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 8 }} />
            <Text style={{ color: Colors.primary, fontWeight: '700' }}>Change Photo</Text>
          </TouchableOpacity>
          <Text style={{ color: Colors.muted, marginTop: 8 }}>Phone: {user && user.phone ? user.phone : 'Not logged in'}</Text>
        </View>

        <View style={[shared.card, { marginBottom: 12 }]}> 
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>Display name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Your name" style={shared.input} />
          <Text style={{ fontWeight: '700', marginTop: 8 }}>Email (optional)</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" style={shared.input} keyboardType="email-address" />
          <Text style={{ fontWeight: '700', marginTop: 8 }}>Other phone (optional)</Text>
          <TextInput value={extraPhone} onChangeText={setExtraPhone} placeholder="Secondary phone" style={shared.input} keyboardType="phone-pad" />
        </View>

        <View style={[shared.card, { marginBottom: 12 }]}> 
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>Location</Text>
          {locLoading ? <ActivityIndicator /> : (
            <>
              <Text style={{ color: Colors.muted }}>{city ? `${city}${country ? ', ' + country : ''}` : 'No location set'}</Text>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <TouchableOpacity onPress={fetchLocation} style={[shared.smallButton, { marginRight: 8 }]}>
                  <Text>Detect Location</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setCity(''); setCountry(''); }} style={shared.smallButton}>
                  <Text>Clear</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <TouchableOpacity onPress={onClose} style={[shared.smallButton, { flex: 1, marginRight: 8 }]}>
            <Text>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} style={[shared.primaryButton, { flex: 1 }]}>
            <Text style={shared.primaryButtonText}>Save Profile</Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 12 }}>
          <TouchableOpacity onPress={handleLogout} style={[shared.smallButton, { backgroundColor: Colors.card }]}>
            <Text style={{ color: Colors.primary }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
