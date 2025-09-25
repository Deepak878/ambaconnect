// import React, { useState } from 'react';
// import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Keyboard, Platform, TouchableWithoutFeedback, KeyboardAvoidingView, InputAccessoryView } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Colors, shared } from './Theme';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { app, db } from '../firebaseConfig';
// import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
// import { getAuth, signInAnonymously } from 'firebase/auth';

// export default function AuthScreen({ onLogin, onClose }) {
//   const [isRegister, setIsRegister] = useState(false);
//   const [phone, setPhone] = useState('');
//   const [name, setName] = useState('');
//   const inputAccessoryViewID = 'phoneAccessory';

//   const handleSubmit = async () => {
//     const normalized = phone.replace(/[^0-9]/g, '');
//     if (normalized.length < 7) {
//       Alert.alert('Invalid phone', 'Please enter a valid phone number');
//       return;
//     }
    
//     try {
//       const id = normalized;
//       const userRef = doc(db, 'users', id);
//       if (isRegister) {
//         const payload = { name: name || 'Anonymous', phone: normalized, createdAt: serverTimestamp(), lastLogin: serverTimestamp() };
//         // Try direct write
//         try {
//           await setDoc(userRef, payload, { merge: true });
//         } catch (err) {
//           console.error('Firestore write failed, attempting anonymous auth and retry', err);
//           // Try anonymous sign-in then retry (useful if rules require authenticated users)
//           try {
//             const auth = getAuth(app);
//             await signInAnonymously(auth);
//             await setDoc(userRef, payload, { merge: true });
//           } catch (err2) {
//             console.error('Retry after anonymous auth failed, attempting ISO fallback', err2);
//             // Try ISO timestamp fallback
//             try {
//               await setDoc(userRef, { name: name || 'Anonymous', phone: normalized, createdAt: new Date().toISOString(), lastLogin: new Date().toISOString() }, { merge: true });
//             } catch (err3) {
//               console.error('ISO fallback failed', err3);
//               Alert.alert('Error', 'Unable to save account to backend: ' + (err3.message || err2.message || err.message));
//               const fallback = { id, name: name || 'Anonymous', phone: normalized };
//               try { await AsyncStorage.setItem('user', JSON.stringify(fallback)); } catch (_) {}
//               onLogin(fallback);
//               return;
//             }
//           }
//         }

//         // Persist locally and proceed
//         const out = { id, name: name || 'Anonymous', phone: normalized, createdAt: new Date().toISOString(), lastLogin: new Date().toISOString() };
//         await AsyncStorage.setItem('user', JSON.stringify(out));
//         onLogin(out);
//       } else {
//         // login flow: try to read the user doc from Firestore
//         try {
//           let snap = await getDoc(userRef);
//           if (!snap.exists()) {
//             Alert.alert('Not found', 'Phone number not registered. Please sign up first.');
//             return;
//           }
//           // update lastLogin
//           try {
//             await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
//           } catch (err) {
//             console.error('lastLogin update failed, trying anonymous auth then ISO fallback', err);
//             try {
//               const auth = getAuth(app);
//               await signInAnonymously(auth);
//               await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
//             } catch (err2) {
//               console.error('Retry lastLogin failed, attempting ISO fallback', err2);
//               try { await setDoc(userRef, { lastLogin: new Date().toISOString() }, { merge: true }); } catch (err3) { console.error('ISO lastLogin failed', err3); }
//             }
//           }

//           const serverData = snap.data() || {};
//           const out = { id, name: serverData.name || name || 'Anonymous', phone: normalized, lastLogin: new Date().toISOString(), createdAt: serverData.createdAt ? new Date().toISOString() : new Date().toISOString() };
//           await AsyncStorage.setItem('user', JSON.stringify(out));
//           onLogin(out);
//         } catch (readErr) {
//           console.error('Error reading user doc, attempting anonymous auth then local fallback', readErr);
//           try {
//             const auth = getAuth(app);
//             await signInAnonymously(auth);
//             const snap2 = await getDoc(userRef);
//             if (!snap2.exists()) {
//               Alert.alert('Not found', 'Phone number not registered. Please sign up first.');
//               return;
//             }
//             const serverData = snap2.data() || {};
//             const out = { id, name: serverData.name || name || 'Anonymous', phone: normalized, lastLogin: new Date().toISOString(), createdAt: serverData.createdAt || new Date().toISOString() };
//             await AsyncStorage.setItem('user', JSON.stringify(out));
//             onLogin(out);
//           } catch (err) {
//             console.error('Retry read failed', err);
//             Alert.alert('Error', 'Unable to contact backend. Using local fallback.');
//             const fallback = { id, phone: normalized, name: name || 'Anonymous' };
//             try { await AsyncStorage.setItem('user', JSON.stringify(fallback)); } catch (_) {}
//             onLogin(fallback);
//             return;
//           }
//         }
//       }
//     } catch (e) {
//       Alert.alert('Error', 'Unable to save user to backend');
//       const fallback = { id: normalized, phone: normalized, name: name || 'Anonymous' };
//       try { await AsyncStorage.setItem('user', JSON.stringify(fallback)); } catch (_) {}
//       onLogin(fallback);
//     }
//   };

//   return (
//     <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
//       <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
//         <SafeAreaView style={[shared.container, { alignItems: 'center' }]}> 
//           <View style={[shared.card, { width: '94%', marginTop: 40 }]}> 
//             <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
//               <View style={{ width: 40 }} />
//               <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.primary }}>{isRegister ? 'Create account' : 'Welcome back'}</Text>
//               <TouchableOpacity onPress={() => { if (onClose) onClose(); else setIsRegister(false); }} style={{ width: 40, alignItems: 'flex-end' }}>
//                 <Text style={{ fontSize: 20, color: Colors.primary }}>✕</Text>
//               </TouchableOpacity>
//             </View>
//             <Text style={{ color: Colors.muted, marginTop: 6 }}>{isRegister ? 'Create an account to post jobs anonymously' : 'Login with your phone number'}</Text>

//             {isRegister && (
//               <TextInput placeholder="Display name (optional)" value={name} onChangeText={setName} style={[shared.input, { marginTop: 12 }]} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} blurOnSubmit />
//             )}

//             <TextInput placeholder="Phone number" value={phone} onChangeText={setPhone} style={[shared.input, { marginTop: 12 }]} keyboardType="phone-pad" inputAccessoryViewID={Platform.OS === 'ios' ? inputAccessoryViewID : undefined} returnKeyType="done" blurOnSubmit onSubmitEditing={() => Keyboard.dismiss()} />

//             <TouchableOpacity style={[shared.primaryButton, { marginTop: 14 }]} onPress={() => { Keyboard.dismiss(); handleSubmit(); }}>
//               <Text style={shared.primaryButtonText}>{isRegister ? 'Register' : 'Login'}</Text>
//             </TouchableOpacity>

//             <TouchableOpacity onPress={() => setIsRegister(!isRegister)} style={{ marginTop: 12, alignItems: 'center' }}>
//               <Text style={{ color: Colors.primary }}>{isRegister ? 'Already have an account? Login' : "Don't have an account? Create one"}</Text>
//             </TouchableOpacity>
//             {/* Guest access removed to force login/register */}
//             {onClose ? (
//               <TouchableOpacity onPress={() => onClose()} style={{ marginTop: 12, alignItems: 'center' }}>
//                 <Text style={{ color: Colors.primary }}>Close</Text>
//               </TouchableOpacity>
//             ) : null}
//           </View>

//           {Platform.OS === 'ios' ? (
//             <InputAccessoryView nativeID={inputAccessoryViewID}>
//               <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 8, borderTopWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card }}>
//                 <TouchableOpacity onPress={() => Keyboard.dismiss()} style={{ paddingHorizontal: 12 }}>
//                   <Text style={{ color: Colors.primary, fontWeight: '700' }}>Done</Text>
//                 </TouchableOpacity>
//               </View>
//             </InputAccessoryView>
//           ) : null}
//         </SafeAreaView>
//       </TouchableWithoutFeedback>
//     </KeyboardAvoidingView>
//   );
// }

// const styles = StyleSheet.create({});





import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Keyboard,
  Platform,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  InputAccessoryView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, shared } from './Theme';
// Firestore usage for users collection
import AsyncStorage from '@react-native-async-storage/async-storage';
import { app, db } from '../firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function AuthScreen({ onLogin, onClose }) {
  const [isRegister, setIsRegister] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const inputAccessoryViewID = 'phoneAccessory';

  const handleSubmit = async () => {
    const normalized = phone.replace(/[^0-9]/g, '');
    console.log('Auth submit:', { phone: normalized, dob });

    if (normalized.length < 7) {
      Alert.alert('Invalid phone', 'Please enter a valid phone number');
      return;
    }

    try {
      const id = normalized;
      if (isRegister) {
        // Register user in Firestore
        try {
          const userRef = doc(db, 'users', id);
          const existing = await getDoc(userRef);
          if (existing && existing.exists && existing.exists()) {
            Alert.alert('Already registered', 'This phone number is already registered. Please login.');
            return;
          }
          const payload = { name: name || 'Anonymous', phone: normalized, dob: dob || null, createdAt: serverTimestamp(), lastLogin: serverTimestamp() };
          await setDoc(userRef, payload, { merge: true });
          const out = { id, name: name || 'Anonymous', phone: normalized, dob: dob || null, createdAt: new Date().toISOString(), lastLogin: new Date().toISOString() };
          try { await AsyncStorage.setItem('user', JSON.stringify(out)); } catch (e) { console.error('Failed to save local user', e); }
          Alert.alert('Account Created', 'User registered successfully.');
          setName(''); setPhone(''); setDob('');
          onLogin(out);
          return;
        } catch (err) {
          console.error('Registration failed', err);
          Alert.alert('Error', 'Unable to create account on server. Please try again later.');
          return;
        }
      } else {
        // Try Firestore users collection first (if available)
        try {
          const userRef = doc(db, 'users', id);
          const snap = await getDoc(userRef);
          if (snap && snap.exists && snap.exists()) {
            const serverData = snap.data() || {};
            const out = { id, name: serverData.name || name || 'Anonymous', phone: normalized, dob: serverData.dob || dob || null };
            try { await AsyncStorage.setItem('user', JSON.stringify(out)); } catch (_) {}
            Alert.alert('Welcome', 'Logged in.');
            setName(''); setPhone(''); setDob('');
            onLogin(out);
            return;
          } else {
            // Not in Firestore — fall back to local storage
            const local = await AsyncStorage.getItem('user');
            if (!local) { Alert.alert('Not found', 'Phone number not registered. Please sign up first.'); return; }
            const serverData = JSON.parse(local);
            if (serverData.id !== id) { Alert.alert('Not found', 'Phone number not registered. Please sign up first.'); return; }
            const out = { id, name: serverData.name || name || 'Anonymous', phone: normalized, dob: serverData.dob || dob || null };
            Alert.alert('Welcome', 'Logged in locally.');
            setName(''); setPhone(''); setDob('');
            onLogin(out);
            return;
          }
        } catch (err) {
          console.warn('Firestore read failed, falling back to local', err);
          // fallback local login
          try {
            const local = await AsyncStorage.getItem('user');
            if (!local) { Alert.alert('Not found', 'No local account found. Please register first.'); return; }
            const serverData = JSON.parse(local);
            if (serverData.id !== id) { Alert.alert('Not found', 'Phone number not registered locally. Please register first.'); return; }
            const out = { id, name: serverData.name || name || 'Anonymous', phone: normalized, dob: serverData.dob || dob || null };
            Alert.alert('Welcome', 'Logged in locally.');
            setName(''); setPhone(''); setDob('');
            onLogin(out);
            return;
          } catch (err2) {
            console.error('Local login failed', err2);
            Alert.alert('Error', 'Unable to read local account.');
            return;
          }
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
   
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <SafeAreaView style={[shared.container, { alignItems: 'center' }]}>
          <View style={[shared.card, { width: '94%', marginTop: 40 }]}>
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ width: 40 }} />
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '800',
                  color: Colors.primary,
                }}
              >
                {isRegister ? 'Create account' : 'Welcome back'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (onClose) onClose();
                  else setIsRegister(false);
                }}
                style={{ width: 40, alignItems: 'flex-end' }}
              >
                <Text style={{ fontSize: 20, color: Colors.primary }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: Colors.muted, marginTop: 6 }}>
              {isRegister
                ? 'Create an account to post jobs anonymously'
                : 'Login with your phone number'}
            </Text>

            {isRegister && (
              <TextInput
                placeholder="Display name (optional)"
                value={name}
                onChangeText={setName}
                style={[shared.input, { marginTop: 12 }]}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                blurOnSubmit
              />
            )}

            <TextInput
              placeholder="Phone number"
              value={phone}
              onChangeText={setPhone}
              style={[shared.input, { marginTop: 12 }]}
              keyboardType="phone-pad"
              inputAccessoryViewID={
                Platform.OS === 'ios' ? inputAccessoryViewID : undefined
              }
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            <TextInput
              placeholder="Date of birth (YYYY-MM-DD)"
              value={dob}
              onChangeText={setDob}
              style={[shared.input, { marginTop: 12 }]}
              keyboardType="default"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            <TouchableOpacity
              style={[shared.primaryButton, { marginTop: 14 }]}
              onPress={() => {
                Keyboard.dismiss();
                handleSubmit();
              }}
            >
              <Text style={shared.primaryButtonText}>
                {isRegister ? 'Register' : 'Login'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIsRegister(!isRegister)}
              style={{ marginTop: 12, alignItems: 'center' }}
            >
              <Text style={{ color: Colors.primary }}>
                {isRegister
                  ? 'Already have an account? Login'
                  : "Don't have an account? Create one"}
              </Text>
            </TouchableOpacity>

            {onClose ? (
              <TouchableOpacity
                onPress={() => onClose()}
                style={{ marginTop: 12, alignItems: 'center' }}
              >
                <Text style={{ color: Colors.primary }}>Close</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {Platform.OS === 'ios' ? (
            <InputAccessoryView nativeID={inputAccessoryViewID}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  padding: 8,
                  borderTopWidth: 1,
                  borderColor: Colors.border,
                  backgroundColor: Colors.card,
                }}
              >
                <TouchableOpacity
                  onPress={() => Keyboard.dismiss()}
                  style={{ paddingHorizontal: 12 }}
                >
                  <Text style={{ color: Colors.primary, fontWeight: '700' }}>
                    Done
                  </Text>
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
