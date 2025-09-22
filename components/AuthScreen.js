import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Keyboard, Platform, TouchableWithoutFeedback, KeyboardAvoidingView, InputAccessoryView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, shared } from './Theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export default function AuthScreen({ onLogin, onClose }) {
  const [isRegister, setIsRegister] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const inputAccessoryViewID = 'phoneAccessory';

  const handleSubmit = async () => {
    const normalized = phone.replace(/[^0-9]/g, '');
    if (normalized.length < 7) {
      Alert.alert('Invalid phone', 'Please enter a valid phone number');
      return;
    }
    try {
      // Use normalized phone as the Firestore document id and canonical user id
      const id = normalized;
      const payload = { name: name || 'Anonymous', phone: normalized, createdAt: new Date().toISOString() };
      const userRef = doc(db, 'users', id);
      const snap = await getDoc(userRef);
      if (isRegister) {
        // create or merge new user
        if (snap.exists()) {
          await setDoc(userRef, { ...snap.data(), ...payload }, { merge: true });
        } else {
          await setDoc(userRef, payload);
        }
        const out = { id, ...payload };
        await AsyncStorage.setItem('user', JSON.stringify(out));
        onLogin(out);
      } else {
        // login flow: only allow if user exists
        if (!snap.exists()) {
          Alert.alert('Not found', 'Phone number not registered. Please sign up first.');
          return;
        }
        const data = { id, ...snap.data() };
        // ensure phone stored locally is normalized id
        data.phone = data.phone ? data.phone.replace(/[^0-9]/g, '') : id;
        await AsyncStorage.setItem('user', JSON.stringify(data));
        onLogin(data);
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to save user to backend');
      const fallback = { id: normalized, phone: normalized, name: name || 'Anonymous' };
      try { await AsyncStorage.setItem('user', JSON.stringify(fallback)); } catch (_) {}
      onLogin(fallback);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <SafeAreaView style={[shared.container, { alignItems: 'center' }]}> 
          <View style={[shared.card, { width: '94%', marginTop: 40 }]}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.primary }}>{isRegister ? 'Create account' : 'Welcome back'}</Text>
            <Text style={{ color: Colors.muted, marginTop: 6 }}>{isRegister ? 'Create an account to post jobs anonymously' : 'Login with your phone number'}</Text>

            {isRegister && (
              <TextInput placeholder="Display name (optional)" value={name} onChangeText={setName} style={[shared.input, { marginTop: 12 }]} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} blurOnSubmit />
            )}

            <TextInput placeholder="Phone number" value={phone} onChangeText={setPhone} style={[shared.input, { marginTop: 12 }]} keyboardType="phone-pad" inputAccessoryViewID={Platform.OS === 'ios' ? inputAccessoryViewID : undefined} returnKeyType="done" blurOnSubmit onSubmitEditing={() => Keyboard.dismiss()} />

            <TouchableOpacity style={[shared.primaryButton, { marginTop: 14 }]} onPress={() => { Keyboard.dismiss(); handleSubmit(); }}>
              <Text style={shared.primaryButtonText}>{isRegister ? 'Register' : 'Login'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsRegister(!isRegister)} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: Colors.primary }}>{isRegister ? 'Already have an account? Login' : "Don't have an account? Create one"}</Text>
            </TouchableOpacity>
            {/* Guest access removed to force login/register */}
            {onClose ? (
              <TouchableOpacity onPress={() => onClose()} style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ color: Colors.primary }}>Close</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {Platform.OS === 'ios' ? (
            <InputAccessoryView nativeID={inputAccessoryViewID}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 8, borderTopWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card }}>
                <TouchableOpacity onPress={() => Keyboard.dismiss()} style={{ paddingHorizontal: 12 }}>
                  <Text style={{ color: Colors.primary, fontWeight: '700' }}>Done</Text>
                </TouchableOpacity>
              </View>
            </InputAccessoryView>
          ) : null}
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({});
