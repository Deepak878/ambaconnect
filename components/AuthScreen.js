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
import { validateField, rateLimiter, sanitizeInput } from '../utils/validation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { app, db } from '../firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function AuthScreen({ onLogin, onClose }) {
  const [isRegister, setIsRegister] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const inputAccessoryViewID = 'phoneAccessory';

  const validateInput = (field, value) => {
    const validation = validateField(field, value);
    setErrors(prev => ({
      ...prev,
      [field]: validation.isValid ? '' : validation.message
    }));
    return validation;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrors({});

    // Rate limiting check
    if (!rateLimiter.canMakeRequest('auth_attempt', 5, 300000)) { // 5 attempts per 5 minutes
      const remainingTime = Math.ceil(rateLimiter.getRemainingTime('auth_attempt', 300000) / 1000);
      Alert.alert('Too Many Attempts', `Please wait ${remainingTime} seconds before trying again.`);
      setLoading(false);
      return;
    }

    // Validate inputs
    const phoneValidation = validateField('phone', phone);
    const nameValidation = isRegister ? validateField('name', name) : { isValid: true };

    if (!phoneValidation.isValid) {
      setErrors(prev => ({ ...prev, phone: phoneValidation.message }));
      setLoading(false);
      return;
    }

    if (isRegister && !nameValidation.isValid) {
      setErrors(prev => ({ ...prev, name: nameValidation.message }));
      setLoading(false);
      return;
    }

    const sanitizedPhone = sanitizeInput(phoneValidation.sanitizedValue);
    const sanitizedName = isRegister ? sanitizeInput(nameValidation.sanitizedValue) : '';
    const sanitizedDob = sanitizeInput(dob);

    try {
      const id = sanitizedPhone;
      
      if (isRegister) {
        // Register user in Firestore
        try {
          const userRef = doc(db, 'users', id);
          const existing = await getDoc(userRef);
          
          if (existing && existing.exists()) {
            Alert.alert('Already registered', 'This phone number is already registered. Please login.');
            setLoading(false);
            return;
          }
          
          const payload = { 
            name: sanitizedName || 'Anonymous', 
            phone: sanitizedPhone, 
            dob: sanitizedDob || null, 
            createdAt: serverTimestamp(), 
            lastLogin: serverTimestamp(),
            privacySettings: {
              contactVisibility: 'registered', // Default to registered users only
              profileVisibility: 'public'
            }
          };
          
          await setDoc(userRef, payload, { merge: true });
          
          const out = { 
            id, 
            name: sanitizedName || 'Anonymous', 
            phone: sanitizedPhone, 
            dob: sanitizedDob || null, 
            createdAt: new Date().toISOString(), 
            lastLogin: new Date().toISOString() 
          };
          
          try { 
            await AsyncStorage.setItem('user', JSON.stringify(out)); 
          } catch (e) { 
            console.error('Failed to save local user', e); 
          }
          
          Alert.alert('Account Created', 'User registered successfully.');
          setName(''); 
          setPhone(''); 
          setDob('');
          onLogin(out);
          return;
        } catch (err) {
          console.error('Registration failed', err);
          Alert.alert('Error', 'Unable to create account. Please try again later.');
          setLoading(false);
          return;
        }
      } else {
        // Login flow
        try {
          const userRef = doc(db, 'users', id);
          const snap = await getDoc(userRef);
          
          if (snap && snap.exists()) {
            const serverData = snap.data() || {};
            
            // Update last login
            try {
              await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
            } catch (e) {
              console.warn('Failed to update last login', e);
            }
            
            const out = { 
              id, 
              name: serverData.name || sanitizedName || 'Anonymous', 
              phone: sanitizedPhone, 
              dob: serverData.dob || sanitizedDob || null,
              privacySettings: serverData.privacySettings || {
                contactVisibility: 'registered',
                profileVisibility: 'public'
              }
            };
            
            try { 
              await AsyncStorage.setItem('user', JSON.stringify(out)); 
            } catch (_) {}
            
            Alert.alert('Welcome', 'Logged in successfully.');
            setName(''); 
            setPhone(''); 
            setDob('');
            onLogin(out);
            return;
          } else {
            // Try local storage fallback
            const local = await AsyncStorage.getItem('user');
            if (!local) { 
              Alert.alert('Not found', 'Phone number not registered. Please sign up first.'); 
              setLoading(false);
              return; 
            }
            
            const serverData = JSON.parse(local);
            if (serverData.id !== id) { 
              Alert.alert('Not found', 'Phone number not registered. Please sign up first.'); 
              setLoading(false);
              return; 
            }
            
            const out = { 
              id, 
              name: serverData.name || sanitizedName || 'Anonymous', 
              phone: sanitizedPhone, 
              dob: serverData.dob || sanitizedDob || null 
            };
            
            Alert.alert('Welcome', 'Logged in locally.');
            setName(''); 
            setPhone(''); 
            setDob('');
            onLogin(out);
            return;
          }
        } catch (err) {
          console.warn('Firestore read failed, falling back to local', err);
          // Local login fallback
          try {
            const local = await AsyncStorage.getItem('user');
            if (!local) { 
              Alert.alert('Not found', 'No account found. Please register first.'); 
              setLoading(false);
              return; 
            }
            
            const serverData = JSON.parse(local);
            if (serverData.id !== id) { 
              Alert.alert('Not found', 'Phone number not registered. Please register first.'); 
              setLoading(false);
              return; 
            }
            
            const out = { 
              id, 
              name: serverData.name || sanitizedName || 'Anonymous', 
              phone: sanitizedPhone, 
              dob: serverData.dob || sanitizedDob || null 
            };
            
            Alert.alert('Welcome', 'Logged in locally.');
            setName(''); 
            setPhone(''); 
            setDob('');
            onLogin(out);
            return;
          } catch (err2) {
            console.error('Local login failed', err2);
            Alert.alert('Error', 'Unable to access account.');
            setLoading(false);
            return;
          }
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
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
              <>
                <TextInput
                  placeholder="Display name (optional)"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (errors.name) validateInput('name', text);
                  }}
                  style={[
                    shared.input, 
                    { marginTop: 12 },
                    errors.name && { borderColor: Colors.danger }
                  ]}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit
                  editable={!loading}
                />
                {errors.name ? (
                  <Text style={styles.errorText}>{errors.name}</Text>
                ) : null}
              </>
            )}

            <TextInput
              placeholder="Phone number"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (errors.phone) validateInput('phone', text);
              }}
              style={[
                shared.input, 
                { marginTop: 12 },
                errors.phone && { borderColor: Colors.danger }
              ]}
              keyboardType="phone-pad"
              inputAccessoryViewID={
                Platform.OS === 'ios' ? inputAccessoryViewID : undefined
              }
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
              editable={!loading}
            />
            {errors.phone ? (
              <Text style={styles.errorText}>{errors.phone}</Text>
            ) : null}

            <TextInput
              placeholder="Date of birth (YYYY-MM-DD)"
              value={dob}
              onChangeText={setDob}
              style={[shared.input, { marginTop: 12 }]}
              keyboardType="default"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
              editable={!loading}
            />

            <TouchableOpacity
              style={[
                shared.primaryButton, 
                { marginTop: 14, opacity: loading ? 0.7 : 1 }
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={shared.primaryButtonText}>
                {loading ? 'Processing...' : (isRegister ? 'Register' : 'Login')}
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

const styles = StyleSheet.create({
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});
