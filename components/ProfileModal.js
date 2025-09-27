import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage, db } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
// persistence removed: no AsyncStorage usage here
import { shared, Colors } from './Theme';
import PrivacyPolicy from './PrivacyPolicy';

const placeholder = require('../assets/icon.png');

export default function ProfileModal({ visible, user = null, onClose, onSave }) {
  const [name, setName] = useState((user && user.name) ? user.name : '');
  const [email, setEmail] = useState((user && user.email) ? user.email : '');
  const [extraPhone, setExtraPhone] = useState((user && user.extraPhone) ? user.extraPhone : '');
  const [photo, setPhoto] = useState((user && user.photo) ? user.photo : null);
  const [locLoading, setLocLoading] = useState(false);
  const [city, setCity] = useState((user && user.city) ? user.city : '');
  const [country, setCountry] = useState((user && user.country) ? user.country : '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [newPhotoSelected, setNewPhotoSelected] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const loadUserProfile = async () => {
    if (!user || !user.id || !visible) return;

    setLoadingProfile(true);
    try {
      console.log('Loading user profile from Firestore for user:', user.id);
      
      const userDocRef = doc(db, 'users', user.id);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const firestoreUserData = userDocSnap.data();
        console.log('Loaded profile data from Firestore:', firestoreUserData);
        
        // Update state with Firestore data, fallback to original user data
        setName(firestoreUserData.name || (user && user.name) || '');
        setEmail(firestoreUserData.email || (user && user.email) || '');
        setExtraPhone(firestoreUserData.extraPhone || (user && user.extraPhone) || '');
        setPhoto(firestoreUserData.photo || (user && user.photo) || null);
        setCity(firestoreUserData.city || (user && user.city) || '');
        setCountry(firestoreUserData.country || (user && user.country) || '');
        
        // Update AsyncStorage with latest data from Firestore
        const updatedUser = { 
          ...user, 
          ...firestoreUserData,
          id: user.id, // Ensure ID is preserved
          phone: user.phone // Ensure phone is preserved
        };
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        
        console.log('Profile loaded successfully from Firestore');
      } else {
        console.log('No profile document found in Firestore, using local data');
        // Use local user data if no Firestore document exists
        setName((user && user.name) || '');
        setEmail((user && user.email) || '');
        setExtraPhone((user && user.extraPhone) || '');
        setPhoto((user && user.photo) || null);
        setCity((user && user.city) || '');
        setCountry((user && user.country) || '');
      }
    } catch (error) {
      console.error('Error loading user profile from Firestore:', error);
      // Fallback to local user data on error
      setName((user && user.name) || '');
      setEmail((user && user.email) || '');
      setExtraPhone((user && user.extraPhone) || '');
      setPhoto((user && user.photo) || null);
      setCity((user && user.city) || '');
      setCountry((user && user.country) || '');
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (visible && user && user.id) {
      loadUserProfile();
    } else {
      // Reset to local data when modal is not visible or no user
      setName((user && user.name) || '');
      setEmail((user && user.email) || '');
      setExtraPhone((user && user.extraPhone) || '');
      setPhoto((user && user.photo) || null);
      setCity((user && user.city) || '');
      setCountry((user && user.country) || '');
    }
    setNewPhotoSelected(false);
    setUploadingPhoto(false);
    setLoadingProfile(false);
  }, [user, visible]);

  const uploadPhotoToStorage = async (userId, photoUri) => {
    try {
      console.log(`Uploading profile photo for user: ${userId}`);
      
      const response = await fetch(photoUri);
      const blob = await response.blob();
      
      // Create filename with user ID
      const timestamp = Date.now();
      const fileName = `profile_${userId}_${timestamp}.jpg`;
      
      // Use 'profiles' folder for user profile pictures
      const storageRef = ref(storage, `profiles/${fileName}`);
      
      console.log(`Uploading profile photo to: profiles/${fileName}`);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      console.log(`Profile photo upload successful: ${downloadURL}`);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      
      // Provide specific error messages
      if (error.code === 'storage/unauthorized') {
        throw new Error('Upload permission denied. Please check Firebase Storage rules.');
      } else if (error.code === 'storage/canceled') {
        throw new Error('Upload was canceled.');
      } else if (error.code === 'storage/unknown') {
        throw new Error('Unknown error occurred during upload.');
      }
      
      throw error;
    }
  };

  const deletePhotoFromStorage = async (photoUrl) => {
    try {
      if (!photoUrl || !photoUrl.includes('firebasestorage.googleapis.com')) {
        return; // Not a Firebase Storage URL
      }
      
      // Extract the file path from the download URL
      const urlParts = photoUrl.split('/o/')[1]?.split('?')[0];
      if (!urlParts) {
        console.warn('Could not parse profile photo URL:', photoUrl);
        return;
      }
      
      // Decode the URL-encoded path
      const filePath = decodeURIComponent(urlParts);
      console.log(`Deleting old profile photo: ${filePath}`);
      
      const imageRef = ref(storage, filePath);
      await deleteObject(imageRef);
      
      console.log(`Successfully deleted old profile photo: ${filePath}`);
    } catch (error) {
      console.error('Error deleting old profile photo:', error);
      if (error.code === 'storage/object-not-found') {
        console.log('Old profile photo already deleted or does not exist');
      }
    }
  };

  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { 
        Alert.alert('Permission', 'Media library permission required'); 
        return; 
      }
      
      Alert.alert(
        'Select Photo',
        'Choose how you want to add your profile photo',
        [
          {
            text: 'Camera',
            onPress: async () => {
              try {
                // Request camera permissions first
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permission Required', 'Camera permission is required to take photos');
                  return;
                }

                const result = await ImagePicker.launchCameraAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [1, 1], // Square aspect ratio for profile pics
                  quality: 0.8,
                });

                if (!result.canceled && result.assets && result.assets[0]) {
                  setPhoto(result.assets[0].uri);
                  setNewPhotoSelected(true);
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to take photo');
              }
            }
          },
          {
            text: 'Photo Library',
            onPress: async () => {
              try {
                const res = await ImagePicker.launchImageLibraryAsync({ 
                  mediaTypes: ImagePicker.MediaTypeOptions.Images, 
                  allowsEditing: true,
                  aspect: [1, 1], // Square aspect ratio for profile pics
                  quality: 0.8 
                });
                
                if (res.cancelled) return;
                const uri = res.assets ? res.assets[0].uri : res.uri;
                setPhoto(uri);
                setNewPhotoSelected(true);
              } catch (error) {
                Alert.alert('Error', 'Failed to pick image');
              }
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
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

  const handleSave = async () => {
    if (!user || !user.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setUploadingPhoto(true);
      
      let finalPhotoUrl = photo;
      
      // If a new photo was selected and it's not a URL (i.e., it's a local file)
      if (newPhotoSelected && photo && !photo.startsWith('https://')) {
        try {
          // Delete old photo if it exists and is from Firebase Storage
          if (user.photo && user.photo.includes('firebasestorage.googleapis.com')) {
            await deletePhotoFromStorage(user.photo);
          }
          
          // Upload new photo
          finalPhotoUrl = await uploadPhotoToStorage(user.id, photo);
          
          Alert.alert('Success', 'Profile photo updated successfully');
        } catch (error) {
          console.error('Photo upload error:', error);
          Alert.alert(
            'Upload Error', 
            `Failed to upload profile photo: ${error.message}\n\nProfile will be saved without the new photo.`
          );
          // Keep the old photo URL if upload fails
          finalPhotoUrl = user.photo;
        }
      }

      // Prepare updated user data
      const updatedUser = { 
        ...user, 
        name, 
        email, 
        extraPhone, 
        photo: finalPhotoUrl, 
        city, 
        country 
      };

      try {
        // Check if user document exists in Firestore, create if it doesn't
        const userDocRef = doc(db, 'users', user.id);
        const userDocSnap = await getDoc(userDocRef);
        
        const userData = {
          name,
          email,
          extraPhone,
          photo: finalPhotoUrl,
          city,
          country,
          updatedAt: new Date().toISOString()
        };

        if (userDocSnap.exists()) {
          // Document exists, update it
          await updateDoc(userDocRef, userData);
          console.log('Profile updated in existing Firestore document');
        } else {
          // Document doesn't exist, create it with additional required fields
          await setDoc(userDocRef, {
            ...userData,
            id: user.id,
            phone: user.phone, // Preserve phone from original user data
            createdAt: new Date().toISOString()
          });
          console.log('Profile created in new Firestore document');
        }

        // Update in AsyncStorage
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        
        console.log('Profile updated successfully in Firestore and AsyncStorage');
        
        // Call parent onSave with updated user data
        onSave(updatedUser);
        onClose();
        
        if (!newPhotoSelected) {
          Alert.alert('Success', 'Profile updated successfully');
        }
        
      } catch (firestoreError) {
        console.error('Error updating profile in Firestore:', firestoreError);
        Alert.alert('Error', `Failed to save profile to database: ${firestoreError.message}\n\nPlease try again.`);
      }
      
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setUploadingPhoto(false);
      setNewPhotoSelected(false);
    }
  };

  const handleLogout = async () => {
    // Clear AsyncStorage
    await AsyncStorage.removeItem('user');
    // inform parent to clear user (in-memory)
    onSave(null);
    onClose();
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This will:\n\n• Delete your profile and all personal data\n• Remove all your job and accommodation posts\n• Delete all saved/bookmarked items\n• This action cannot be undone',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              setUploadingPhoto(true); // Reuse loading state
              
              if (!user || !user.id) {
                Alert.alert('Error', 'User not authenticated');
                return;
              }

              console.log('Starting account deletion process for user:', user.id);

              // Import necessary Firestore functions
              const { collection, query, where, getDocs, deleteDoc, doc: fsDoc, getDoc: fsGetDoc } = await import('firebase/firestore');
              
              // 1. Delete profile photo from storage
              if (user.photo && user.photo.includes('firebasestorage.googleapis.com')) {
                await deletePhotoFromStorage(user.photo);
                console.log('Profile photo deleted from storage');
              }

              // 2. Delete all user's job posts and their images
              const jobsQuery = query(collection(db, 'jobs'), where('createdById', '==', user.id));
              const jobsSnapshot = await getDocs(jobsQuery);
              console.log(`Found ${jobsSnapshot.docs.length} job posts to delete`);
              
              for (const jobDoc of jobsSnapshot.docs) {
                const jobData = jobDoc.data();
                // Delete job images from storage
                if (jobData.images && jobData.images.length > 0) {
                  for (const imageUrl of jobData.images) {
                    await deletePhotoFromStorage(imageUrl);
                  }
                }
                // Delete job document
                await deleteDoc(fsDoc(db, 'jobs', jobDoc.id));
              }

              // 3. Delete all user's accommodation posts and their images
              const accomQuery = query(collection(db, 'accommodations'), where('createdById', '==', user.id));
              const accomSnapshot = await getDocs(accomQuery);
              console.log(`Found ${accomSnapshot.docs.length} accommodation posts to delete`);
              
              for (const accomDoc of accomSnapshot.docs) {
                const accomData = accomDoc.data();
                // Delete accommodation images from storage
                if (accomData.images && accomData.images.length > 0) {
                  for (const imageUrl of accomData.images) {
                    await deletePhotoFromStorage(imageUrl);
                  }
                }
                // Delete accommodation document
                await deleteDoc(fsDoc(db, 'accommodations', accomDoc.id));
              }

              // 4. Delete all saved items by this user
              const savedQuery = query(collection(db, 'saved'), where('userId', '==', user.id));
              const savedSnapshot = await getDocs(savedQuery);
              console.log(`Found ${savedSnapshot.docs.length} saved items to delete`);
              
              for (const savedDoc of savedSnapshot.docs) {
                await deleteDoc(fsDoc(db, 'saved', savedDoc.id));
              }

              // 5. Delete user document from Firestore (if it exists)
              const userDocRef = fsDoc(db, 'users', user.id);
              const userDocSnap = await fsGetDoc(userDocRef);
              if (userDocSnap.exists()) {
                await deleteDoc(userDocRef);
                console.log('User document deleted from Firestore');
              } else {
                console.log('User document did not exist in Firestore');
              }

              // 6. Clear local storage
              await AsyncStorage.removeItem('user');
              console.log('User data cleared from AsyncStorage');

              Alert.alert(
                'Account Deleted',
                'Your account and all associated data have been permanently deleted.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Inform parent to clear user and close modal
                      onSave(null);
                      onClose();
                    }
                  }
                ]
              );

            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', `Failed to delete account: ${error.message}\n\nPlease try again or contact support.`);
            } finally {
              setUploadingPhoto(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={[shared.container, { padding: 16 }]}> 
        <View style={[shared.card, { alignItems: 'center', marginBottom: 12 }]}>
          <TouchableOpacity 
            onPress={pickPhoto} 
            style={{ alignItems: 'center' }}
            disabled={uploadingPhoto || loadingProfile}
          >
            <View style={{ position: 'relative' }}>
              <Image 
                source={photo ? { uri: photo } : placeholder} 
                style={{ 
                  width: 96, 
                  height: 96, 
                  borderRadius: 48, 
                  marginBottom: 8,
                  opacity: (uploadingPhoto || loadingProfile) ? 0.5 : 1 
                }} 
              />
              {(uploadingPhoto || loadingProfile) && (
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 8,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: 48,
                }}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                </View>
              )}
            </View>
            <Text style={{ 
              color: (uploadingPhoto || loadingProfile) ? Colors.muted : Colors.primary, 
              fontWeight: '700' 
            }}>
              {loadingProfile ? 'Loading...' : uploadingPhoto ? 'Uploading...' : 'Change Photo'}
            </Text>
          </TouchableOpacity>
          {newPhotoSelected && !uploadingPhoto && !loadingProfile && (
            <Text style={{ color: Colors.primary, fontSize: 12, marginTop: 4 }}>
              New photo selected - Save to upload
            </Text>
          )}
          {loadingProfile && (
            <Text style={{ color: Colors.muted, fontSize: 12, marginTop: 4 }}>
              Loading profile from server...
            </Text>
          )}
          <Text style={{ color: Colors.muted, marginTop: 8 }}>
            Phone: {user && user.phone ? user.phone : 'Not logged in'}
          </Text>
        </View>

        <View style={[shared.card, { marginBottom: 12 }]}> 
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>Display name</Text>
          <TextInput 
            value={name} 
            onChangeText={setName} 
            placeholder="Your name" 
            style={shared.input} 
            editable={!loadingProfile && !uploadingPhoto}
          />
          <Text style={{ fontWeight: '700', marginTop: 8 }}>Email (optional)</Text>
          <TextInput 
            value={email} 
            onChangeText={setEmail} 
            placeholder="you@example.com" 
            style={shared.input} 
            keyboardType="email-address"
            editable={!loadingProfile && !uploadingPhoto}
          />
          <Text style={{ fontWeight: '700', marginTop: 8 }}>Other phone (optional)</Text>
          <TextInput 
            value={extraPhone} 
            onChangeText={setExtraPhone} 
            placeholder="Secondary phone" 
            style={shared.input} 
            keyboardType="phone-pad"
            editable={!loadingProfile && !uploadingPhoto}
          />
        </View>

        <View style={[shared.card, { marginBottom: 12 }]}> 
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>Location</Text>
          {locLoading ? <ActivityIndicator /> : (
            <>
              <Text style={{ color: Colors.muted }}>{city ? `${city}${country ? ', ' + country : ''}` : 'No location set'}</Text>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <TouchableOpacity 
                  onPress={fetchLocation} 
                  style={[shared.smallButton, { marginRight: 8 }]}
                  disabled={loadingProfile || uploadingPhoto}
                >
                  <Text style={{ color: (loadingProfile || uploadingPhoto) ? Colors.muted : Colors.primary }}>
                    Detect Location
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => { setCity(''); setCountry(''); }} 
                  style={shared.smallButton}
                  disabled={loadingProfile || uploadingPhoto}
                >
                  <Text style={{ color: (loadingProfile || uploadingPhoto) ? Colors.muted : Colors.primary }}>
                    Clear
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <TouchableOpacity 
            onPress={onClose} 
            style={[shared.smallButton, { flex: 1, marginRight: 8 }]}
            disabled={uploadingPhoto || loadingProfile}
          >
            <Text style={{ color: (uploadingPhoto || loadingProfile) ? Colors.muted : Colors.primary }}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleSave} 
            style={[
              shared.primaryButton, 
              { 
                flex: 1, 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center',
                opacity: (uploadingPhoto || loadingProfile) ? 0.7 : 1
              }
            ]}
            disabled={uploadingPhoto || loadingProfile}
          >
            {(uploadingPhoto || loadingProfile) && (
              <ActivityIndicator 
                size="small" 
                color={Colors.card} 
                style={{ marginRight: 8 }} 
              />
            )}
            <Text style={shared.primaryButtonText}>
              {loadingProfile ? 'Loading...' : uploadingPhoto ? 'Saving...' : 'Save Profile'}
            </Text>
          </TouchableOpacity>
        </View>
        {user ? (
          <View style={{ marginTop: 12 }}>
            <TouchableOpacity 
              onPress={handleLogout} 
              style={[
                shared.smallButton, 
                { 
                  backgroundColor: Colors.card, 
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center'
                }
              ]}
              disabled={uploadingPhoto || loadingProfile}
            >
              <Ionicons 
                name="log-out-outline" 
                size={16} 
                color={(uploadingPhoto || loadingProfile) ? Colors.muted : Colors.primary} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: (uploadingPhoto || loadingProfile) ? Colors.muted : Colors.primary }}>
                Logout
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setShowPrivacyPolicy(true)} 
              style={[
                shared.smallButton, 
                { 
                  backgroundColor: Colors.card, 
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center'
                }
              ]}
              disabled={uploadingPhoto || loadingProfile}
            >
              <Ionicons 
                name="shield-checkmark-outline" 
                size={16} 
                color={(uploadingPhoto || loadingProfile) ? Colors.muted : Colors.primary} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: (uploadingPhoto || loadingProfile) ? Colors.muted : Colors.primary }}>
                Privacy Policy
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={handleDeleteAccount} 
              style={[
                shared.smallButton, 
                { 
                  backgroundColor: '#FF3B30',
                  borderColor: '#FF3B30',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center'
                }
              ]}
              disabled={uploadingPhoto || loadingProfile}
            >
              <Ionicons 
                name="trash-outline" 
                size={16} 
                color={(uploadingPhoto || loadingProfile) ? Colors.muted : '#fff'} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: (uploadingPhoto || loadingProfile) ? Colors.muted : '#fff', fontWeight: '600' }}>
                Delete Account
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      
      {/* Privacy Policy Modal */}
      <PrivacyPolicy 
        visible={showPrivacyPolicy} 
        onClose={() => setShowPrivacyPolicy(false)} 
      />
    </Modal>
  );
}
