import React, { useState, useEffect } from 'react';
import { ScrollView, TextInput, TouchableOpacity, Text, View, Alert, Modal, FlatList, Switch, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, shared } from './Theme';
import { app, db, storage } from '../firebaseConfig';
import { serverTimestamp, doc, getDoc, setDoc, collection, query as fsQuery, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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

export default function PostScreen({ onPost, onOpenAuth, user }) {
  const [checkingAuth, setCheckingAuth] = useState(false);
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

  // Photo upload fields
  const [photos, setPhotos] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [removedImages, setRemovedImages] = useState([]);

  // My Posts modal
  const [showMyPosts, setShowMyPosts] = useState(false);
  const [myPosts, setMyPosts] = useState([]);
  const [loadingMyPosts, setLoadingMyPosts] = useState(false);
  const [editingPost, setEditingPost] = useState(null);

  // Check authentication status when user prop changes
  useEffect(() => {
    // The PostScreen will automatically re-render when user prop changes
    // No need for additional authentication checking since user is passed as prop
    setCheckingAuth(false);
  }, [user]);

  // Computed value to check if we're in editing mode
  const isEditing = editingPost !== null;

  const validateInput = (field, value) => {
    const validation = validateField(field, value);
    setErrors(prev => ({
      ...prev,
      [field]: validation.isValid ? '' : validation.message
    }));
    return validation;
  };

  const generateTags = (title, description) => {
    // No tags needed for now
    return [];
  };

  const pickImages = async () => {
    if (photos.length >= 5) {
      Alert.alert('Limit Reached', 'You can upload maximum 5 photos');
      return;
    }

    Alert.alert(
      'Select Photos',
      'Choose how you want to add photos',
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
                aspect: [4, 3],
                quality: 0.8,
              });

              if (!result.canceled && result.assets && result.assets[0]) {
                const remainingSlots = 5 - photos.length;
                if (remainingSlots > 0) {
                  setPhotos(prev => [...prev, result.assets[0]]);
                }
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
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
                aspect: [4, 3],
              });

              if (!result.canceled && result.assets) {
                const remainingSlots = 5 - photos.length;
                const newPhotos = result.assets.slice(0, remainingSlots);
                setPhotos(prev => [...prev, ...newPhotos]);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to pick images');
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const removePhoto = async (index) => {
    const photoToRemove = photos[index];
    
    // If it's an existing photo from storage (during edit), we should track it for deletion
    if (photoToRemove.uri.startsWith('https://') && isEditing) {
      console.log(`Marking image for removal: ${photoToRemove.uri}`);
      // Store removed images to delete them when post is updated
      if (!removedImages) {
        setRemovedImages([photoToRemove.uri]);
      } else {
        setRemovedImages(prev => [...prev, photoToRemove.uri]);
      }
    }
    
    console.log(`Removing photo ${index + 1} from UI`);
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotosToStorage = async (listingId, listingType = 'accommodations') => {
    if (photos.length === 0) return [];

    setUploadingPhotos(true);
    
    try {
      // Get user info for authentication context
      const localUser = JSON.parse(await AsyncStorage.getItem('user') || '{}');
      if (!localUser.id) {
        throw new Error('User not authenticated. Please login again.');
      }

      console.log(`Starting upload for user: ${localUser.id}, type: ${listingType}`);
      
      const uploadPromises = photos.map(async (photo, index) => {
        try {
          // Check if photo is already uploaded (existing photo during edit)
          if (photo.uri.startsWith('https://')) {
            console.log(`Photo ${index} already uploaded: ${photo.uri}`);
            return photo.uri;
          }

          console.log(`Uploading photo ${index + 1}/${photos.length}...`);
          
          const response = await fetch(photo.uri);
          const blob = await response.blob();
          
          // Create filename with user ID and better structure
          const timestamp = Date.now();
          const fileName = `${localUser.id}_${listingId}_${index}_${timestamp}.jpg`;
          
          // Use appropriate folder based on listing type
          const folderName = listingType === 'job' ? 'jobs' : 'accommodations';
          const storageRef = ref(storage, `${folderName}/${fileName}`);
          
          console.log(`Uploading to: ${folderName}/${fileName}`);
          
          await uploadBytes(storageRef, blob);
          const downloadURL = await getDownloadURL(storageRef);
          
          console.log(`Upload successful: ${downloadURL}`);
          return downloadURL;
        } catch (error) {
          console.error(`Error uploading photo ${index}:`, error);
          
          // Provide more specific error messages
          if (error.code === 'storage/unauthorized') {
            throw new Error('Upload permission denied. Please check Firebase Storage rules.');
          } else if (error.code === 'storage/canceled') {
            throw new Error('Upload was canceled.');
          } else if (error.code === 'storage/unknown') {
            throw new Error('Unknown upload error. Please try again.');
          }
          
          throw error;
        }
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const validUrls = uploadedUrls.filter(url => url !== null);
      
      console.log(`Successfully uploaded ${validUrls.length} out of ${photos.length} photos`);
      return validUrls;
      
    } catch (error) {
      console.error('Error in upload process:', error);
      Alert.alert(
        'Upload Error', 
        `Failed to upload photos: ${error.message}\n\nPlease check your internet connection and Firebase configuration.`
      );
      return [];
    } finally {
      setUploadingPhotos(false);
    }
  };

  const deleteImagesFromStorage = async (imageUrls) => {
    if (!imageUrls || imageUrls.length === 0) return;

    console.log(`Deleting ${imageUrls.length} images from storage...`);
    
    const deletePromises = imageUrls.map(async (imageUrl) => {
      try {
        // Extract the file path from the download URL
        // Firebase Storage URLs have this format:
        // https://firebasestorage.googleapis.com/v0/b/bucket/o/folder%2Ffilename?alt=media&token=...
        const urlParts = imageUrl.split('/o/')[1]?.split('?')[0];
        if (!urlParts) {
          console.warn('Could not parse image URL:', imageUrl);
          return;
        }
        
        // Decode the URL-encoded path
        const filePath = decodeURIComponent(urlParts);
        console.log(`Deleting image: ${filePath}`);
        
        const imageRef = ref(storage, filePath);
        await deleteObject(imageRef);
        
        console.log(`Successfully deleted: ${filePath}`);
      } catch (error) {
        console.error('Error deleting image:', imageUrl, error);
        // Don't throw error here - continue with other deletions
        if (error.code === 'storage/object-not-found') {
          console.log('Image already deleted or does not exist:', imageUrl);
        }
      }
    });

    try {
      await Promise.all(deletePromises);
      console.log('Finished deleting images from storage');
    } catch (error) {
      console.error('Some images could not be deleted:', error);
    }
  };

  const loadMyPosts = async () => {
    setLoadingMyPosts(true);
    try {
      const localUser = JSON.parse(await AsyncStorage.getItem('user'));
      if (!localUser || !localUser.id) {
        Alert.alert('Login Required', 'Please login to view your posts');
        setLoadingMyPosts(false);
        return;
      }

      // Query jobs collection
      const jobsQuery = fsQuery(collection(db, 'jobs'), where('createdById', '==', localUser.id));
      const jobsSnapshot = await getDocs(jobsQuery);
      const userJobs = jobsSnapshot.docs.map(doc => ({
        id: doc.id,
        kind: 'job',
        ...doc.data()
      }));

      // Query accommodations collection
      const accomQuery = fsQuery(collection(db, 'accommodations'), where('createdById', '==', localUser.id));
      const accomSnapshot = await getDocs(accomQuery);
      const userAccommodations = accomSnapshot.docs.map(doc => ({
        id: doc.id,
        kind: 'accommodation',
        ...doc.data()
      }));

      const allPosts = [...userJobs, ...userAccommodations].sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA; // Latest first
      });

      setMyPosts(allPosts);
    } catch (error) {
      Alert.alert('Error', 'Failed to load your posts');
    }
    setLoadingMyPosts(false);
  };

  const deletePost = async (post) => {
    Alert.alert(
      'Delete Post',
      `Are you sure you want to delete "${post.title}"? This will also delete all associated photos.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingMyPosts(true);
              
              const collection_name = post.kind === 'accommodation' ? 'accommodations' : 'jobs';
              console.log('Deleting post:', post.id, 'from collection:', collection_name);
              
              // First, delete associated images from storage
              if (post.images && post.images.length > 0) {
                console.log(`Deleting ${post.images.length} images for post: ${post.id}`);
                await deleteImagesFromStorage(post.images);
              }
              
              // Then delete the post document
              await deleteDoc(doc(db, collection_name, post.id));
              
              // Remove from local state
              setMyPosts(prev => prev.filter(p => p.id !== post.id));
              
              Alert.alert('Success', `Post and ${post.images?.length || 0} associated images deleted successfully`);
            } catch (error) {
              console.error('Delete post error:', error);
              Alert.alert('Error', `Failed to delete post: ${error.message}`);
            } finally {
              setLoadingMyPosts(false);
            }
          }
        }
      ]
    );
  };

  const editPost = (post) => {
    // Populate form with existing data
    setPostKind(post.kind);
    setTitle(post.title);
    setDescription(post.description || '');
    setContact(post.contact || '');
    setCity(post.location?.split(' ')[0] || '');
    
    // Set location data (lat/lng) if available
    if (post.lat && post.lng) {
      setPickerMarker({
        latitude: post.lat,
        longitude: post.lng
      });
      setPickerCity(post.location?.split(' ')[0] || '');
      // Calculate distance if user location is available
      if (userLocation) {
        try {
          const km = haversineKm(userLocation.latitude, userLocation.longitude, post.lat, post.lng);
          setPickerDistanceKm(km);
        } catch (e) {
          console.log('Error calculating distance:', e);
        }
      }
    }
    
    if (post.kind === 'job') {
      setType(post.type || 'Part-time');
      setSalary(post.salary?.toString() || '');
      setSalaryType(post.salaryType || 'hourly');
    } else {
      setAccomType(post.accomType || '1BHK');
      setRent(post.rent?.toString() || '');
      setAccomAvailability(post.availability || 'Sharing');
    }
    
    // Set duration data if available
    if (post.duration) {
      setDurationEnabled(true);
      setStartDate(post.duration.start || '');
      setEndDate(post.duration.end || '');
    } else {
      setDurationEnabled(false);
      setStartDate('');
      setEndDate('');
    }
    
    // Set existing images if available
    if (post.images && post.images.length > 0) {
      // Convert image URLs to the format expected by the photo picker
      const existingPhotos = post.images.map((url, index) => ({
        uri: url,
        type: 'image',
        fileName: `existing_image_${index}.jpg`
      }));
      setPhotos(existingPhotos);
    } else {
      setPhotos([]);
    }
    
    setCurrency(post.currency || 'USD');
    setRemovedImages([]);
    setEditingPost(post);
    setShowMyPosts(false);
    
    Alert.alert('Edit Mode', 'Form loaded with existing data. Make changes and submit to update.');
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

        // Create job ID for photo upload (use existing ID if editing)
        const jobId = isEditing ? editingPost.id : `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Upload photos if any (handle both new photos and existing ones during edit)
        let imageUrls = [];
        
        if (photos.length > 0) {
          try {
            // Separate existing and new photos
            const existingImages = photos.filter(photo => photo.uri.startsWith('https://')).map(photo => photo.uri);
            const newPhotos = photos.filter(photo => !photo.uri.startsWith('https://'));
            
            console.log(`Job Edit: ${existingImages.length} existing images, ${newPhotos.length} new photos`);
            console.log(`Job Edit: ${removedImages.length} images to remove`);
            
            // Start with existing images that are still in photos array (not removed)
            imageUrls = [...existingImages];
            
            // Upload new photos if any
            if (newPhotos.length > 0) {
              const newImageUrls = await uploadPhotosToStorage(jobId, 'job');
              imageUrls = [...imageUrls, ...newImageUrls];
            }
            
            console.log(`Job Edit: Final image count: ${imageUrls.length}`);
          } catch (error) {
            console.error('Photo upload error:', error);
            Alert.alert('Upload Error', 'Failed to upload some photos. Job will be posted without new images.');
            // Fallback to existing images only
            imageUrls = photos.filter(photo => photo.uri.startsWith('https://')).map(photo => photo.uri);
          }
        } else if (isEditing) {
          console.log('Job Edit: All photos removed, images array will be empty');
        }

        // Handle removed images during edit
        if (isEditing && removedImages.length > 0) {
          await deleteImagesFromStorage(removedImages);
          console.log(`Deleted ${removedImages.length} removed images from storage`);
        }

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
          images: imageUrls,
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

          if (isEditing) {
            // Update existing job
            await updateDoc(doc(db, 'jobs', editingPost.id), {
              ...payload,
              updatedAt: serverTimestamp()
            });
            Alert.alert('Success', `Job updated successfully${imageUrls.length > 0 ? ` with ${imageUrls.length} photo(s)` : ''}`);
          } else {
            // Create new job
            const docId = `${localUser.id}_${Date.now()}`;
            await setDoc(doc(db, 'jobs', docId), payload);
            onPost && onPost({ ...job, id: docId });
            Alert.alert('Success', `Job posted successfully${imageUrls.length > 0 ? ` with ${imageUrls.length} photo(s)` : ''}`);
          }
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

        // Create accommodation ID for photo upload (use existing ID if editing)
        const accomId = isEditing ? editingPost.id : `accom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Upload photos (handle both new photos and existing ones during edit)
        let imageUrls = [];
        
        if (photos.length > 0) {
          try {
            // Separate existing and new photos
            const existingImages = photos.filter(photo => photo.uri.startsWith('https://')).map(photo => photo.uri);
            const newPhotos = photos.filter(photo => !photo.uri.startsWith('https://'));
            
            console.log(`Accommodation Edit: ${existingImages.length} existing images, ${newPhotos.length} new photos`);
            console.log(`Accommodation Edit: ${removedImages.length} images to remove`);
            
            // Start with existing images that are still in photos array (not removed)
            imageUrls = [...existingImages];
            
            // Upload new photos if any
            if (newPhotos.length > 0) {
              const newImageUrls = await uploadPhotosToStorage(accomId, 'accommodation');
              imageUrls = [...imageUrls, ...newImageUrls];
            }
            
            console.log(`Accommodation Edit: Final image count: ${imageUrls.length}`);
          } catch (error) {
            console.error('Photo upload error:', error);
            Alert.alert('Upload Error', 'Failed to upload some photos. Accommodation will be posted without new images.');
            // Fallback to existing images only
            imageUrls = photos.filter(photo => photo.uri.startsWith('https://')).map(photo => photo.uri);
          }
        } else if (isEditing) {
          console.log('Accommodation Edit: All photos removed, images array will be empty');
        }

        // Handle removed images during edit
        if (isEditing && removedImages.length > 0) {
          await deleteImagesFromStorage(removedImages);
          console.log(`Deleted ${removedImages.length} removed images from storage`);
        }

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
          images: imageUrls,
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

          if (isEditing) {
            // Update existing accommodation
            await updateDoc(doc(db, 'accommodations', editingPost.id), {
              ...payload,
              updatedAt: serverTimestamp()
            });
            Alert.alert('Success', `Accommodation updated successfully${imageUrls.length > 0 ? ` with ${imageUrls.length} photo(s)` : ''}`);
          } else {
            // Create new accommodation
            const docId = `${localUser.id}_${Date.now()}`;
            await setDoc(doc(db, 'accommodations', docId), payload);
            onPost && onPost({ ...accom, id: docId });
            Alert.alert('Success', `Accommodation posted successfully${imageUrls.length > 0 ? ` with ${imageUrls.length} photo(s)` : ''}`);
          }
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
      setPhotos([]);
      setUploadingPhotos(false);
      setRemovedImages([]);
      setErrors({});
      setEditingPost(null);
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

  // Show login prompt if user is not authenticated
  if (!user || !user.id) {
    return (
      <View style={styles.loginPromptContainer}>
        <View style={styles.loginPromptCard}>
          <Ionicons 
            name="lock-closed-outline" 
            size={64} 
            color={Colors.primary} 
            style={styles.loginPromptIcon} 
          />
          <Text style={styles.loginPromptTitle}>Login Required</Text>
          <Text style={styles.loginPromptSubtitle}>
            You need to be logged in to create and post jobs or accommodations. 
            Please login or create an account to continue.
          </Text>
          <TouchableOpacity 
            style={[shared.primaryButton, styles.loginButton]}
            onPress={() => {
              // Open the auth modal from the parent component
              if (onOpenAuth) {
                onOpenAuth();
              } else {
                Alert.alert('Login Required', 'Please implement authentication flow');
              }
            }}
          >
            <Ionicons name="log-in" size={20} color={Colors.card} style={{ marginRight: 8 }} />
            <Text style={shared.primaryButtonText}>Login / Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Header with My Posts button */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={[shared.title, { fontSize: 24, color: Colors.primary }]}>
          {isEditing ? 'Edit Post' : 'Create Post'}
        </Text>
        <TouchableOpacity 
          onPress={() => {
            setShowMyPosts(true);
            loadMyPosts();
          }}
          style={[shared.secondaryButton, { paddingHorizontal: 12, paddingVertical: 8 }]}
        >
          <Text style={[shared.secondaryButtonText, { fontSize: 14 }]}>My Posts</Text>
        </TouchableOpacity>
      </View>
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

      {/* 30-Day Visibility Notice */}
      <View style={{
        backgroundColor: '#FFF3CD',
        borderLeftWidth: 4,
        borderLeftColor: '#FFC107',
        padding: 12,
        marginBottom: 16,
        borderRadius: 4,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Ionicons name="information-circle" size={16} color="#856404" style={{ marginRight: 6 }} />
          <Text style={{ fontWeight: '600', fontSize: 14, color: '#856404' }}>
            Visibility Notice
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: '#856404', lineHeight: 16 }}>
          Your {postKind === 'job' ? 'job posting' : 'accommodation listing'} will be visible to users for 30 days from the date of posting. After 30 days, it will automatically be hidden from search results.
        </Text>
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

          {/* Photo Upload Section for Jobs */}
          <View style={shared.mb16}>
            <Text style={shared.heading3}>Photos (Optional, Max 5)</Text>
            <Text style={[shared.captionText, { color: Colors.muted, marginBottom: 8 }]}>
              Add photos of the workplace, environment, or job-related images
            </Text>
            <TouchableOpacity 
              onPress={pickImages}
              style={[shared.secondaryButton, shared.mt8, { flexDirection: 'row', alignItems: 'center' }]}
              disabled={photos.length >= 5}
            >
              <Ionicons name="camera" size={16} color={photos.length >= 5 ? Colors.muted : Colors.primary} style={{ marginRight: 6 }} />
              <Text style={[shared.secondaryButtonText, { color: photos.length >= 5 ? Colors.muted : Colors.primary }]}>
                {photos.length === 0 ? 'Add Photos' : `${photos.length}/5 Photos`}
              </Text>
            </TouchableOpacity>
            
            {photos.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                {photos.map((photo, index) => (
                  <View key={index} style={{ marginRight: 8, marginBottom: 8, position: 'relative' }}>
                    <Image 
                      source={{ uri: photo.uri }} 
                      style={{ 
                        width: 80, 
                        height: 80, 
                        borderRadius: 8, 
                        backgroundColor: Colors.border 
                      }} 
                    />
                    <TouchableOpacity 
                      onPress={() => removePhoto(index)}
                      style={{
                        position: 'absolute',
                        top: -5,
                        right: -5,
                        backgroundColor: '#FF6B6B',
                        borderRadius: 12,
                        width: 24,
                        height: 24,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="close" size={14} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
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

          {/* Photo Upload Section */}
          <View style={shared.mb16}>
            <Text style={shared.heading3}>Photos (Max 5)</Text>
            <TouchableOpacity 
              onPress={pickImages}
              style={[shared.secondaryButton, shared.mt8, { flexDirection: 'row', alignItems: 'center' }]}
              disabled={photos.length >= 5}
            >
              <Ionicons name="camera" size={16} color={photos.length >= 5 ? Colors.muted : Colors.primary} style={{ marginRight: 6 }} />
              <Text style={[shared.secondaryButtonText, { color: photos.length >= 5 ? Colors.muted : Colors.primary }]}>
                {photos.length === 0 ? 'Add Photos' : `${photos.length}/5 Photos`}
              </Text>
            </TouchableOpacity>
            
            {photos.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                {photos.map((photo, index) => (
                  <View key={index} style={{ marginRight: 8, marginBottom: 8, position: 'relative' }}>
                    <Image 
                      source={{ uri: photo.uri }} 
                      style={{ 
                        width: 80, 
                        height: 80, 
                        borderRadius: 8, 
                        backgroundColor: Colors.border 
                      }} 
                    />
                    <TouchableOpacity 
                      onPress={() => removePhoto(index)}
                      style={{
                        position: 'absolute',
                        top: -5,
                        right: -5,
                        backgroundColor: '#FF6B6B',
                        borderRadius: 12,
                        width: 24,
                        height: 24,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="close" size={14} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
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
        <View style={shared.mb16}>
          <View style={[shared.row, { marginBottom: 8 }]}>
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
          
          {/* Start Date Picker - positioned right below start date button */}
          {showStartPicker && (
            <View style={{ marginBottom: 8 }}>
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
            </View>
          )}

          {/* End Date Picker - positioned right below end date button */}
          {showEndPicker && (
            <View style={{ marginBottom: 8 }}>
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
            </View>
          )}
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
        disabled={loading || uploadingPhotos}
      >
        {(loading || uploadingPhotos) ? (
          <>
            <ActivityIndicator size="small" color={Colors.card} style={{ marginRight: 8 }} />
            <Text style={shared.primaryButtonText}>
              {uploadingPhotos ? 'Uploading Photos...' : 'Posting...'}
            </Text>
          </>
        ) : (
          <>
            <Ionicons 
              name={postKind === 'job' ? "briefcase" : "home"} 
              size={16} 
              color={Colors.card}
              style={{ marginRight: 8 }}
            />
            <Text style={shared.primaryButtonText}>
              {isEditing 
                ? `Update ${postKind === 'job' ? 'Job' : 'Housing'}`
                : `Post ${postKind === 'job' ? 'Job' : 'Housing'}`
              }
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Photo Upload Progress */}
      {uploadingPhotos && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
          <Text style={[shared.captionText, { color: Colors.primary }]}>
            Uploading {photos.length} photo{photos.length !== 1 ? 's' : ''} to Google Cloud Storage...
          </Text>
        </View>
      )}

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

      {/* My Posts Modal */}
      <Modal visible={showMyPosts} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowMyPosts(false)}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>My Posts</Text>
            <View style={styles.headerSpacer} />
          </View>
          
          {loadingMyPosts ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading your posts...</Text>
            </View>
          ) : (
            <FlatList
              data={myPosts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <View style={styles.postTypeIndicator}>
                      <Ionicons 
                        name={item.kind === 'job' ? 'briefcase' : 'home'} 
                        size={16} 
                        color={Colors.primary} 
                      />
                      <Text style={styles.postTypeText}>
                        {item.kind === 'job' ? 'Job' : 'Accommodation'}
                      </Text>
                    </View>
                    <Text style={styles.postDate}>
                      {item.createdAt ? new Date(item.createdAt.toDate ? item.createdAt.toDate() : item.createdAt).toLocaleDateString() : ''}
                    </Text>
                  </View>
                  
                  <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
                  
                  {item.description && (
                    <Text style={styles.postDescription} numberOfLines={3}>
                      {item.description}
                    </Text>
                  )}
                  
                  {/* Post Details */}
                  <View style={styles.postDetails}>
                    {item.kind === 'job' ? (
                      <View style={styles.detailRow}>
                        <Ionicons name="cash-outline" size={14} color={Colors.muted} />
                        <Text style={styles.detailText}>
                          {item.salary} {item.currency || 'USD'}
                          {item.salaryType === 'hourly' ? '/hr' : item.salaryType === 'daily' ? '/day' : '/week'}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.detailRow}>
                        <Ionicons name="cash-outline" size={14} color={Colors.muted} />
                        <Text style={styles.detailText}>
                          {item.rent} {item.currency || 'USD'}/month
                        </Text>
                      </View>
                    )}
                    
                    {item.location && (
                      <View style={styles.detailRow}>
                        <Ionicons name="location-outline" size={14} color={Colors.muted} />
                        <Text style={styles.detailText} numberOfLines={1}>
                          {item.location}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.postActions}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => {
                        editPost(item);
                        setShowMyPosts(false);
                      }}
                    >
                      <Ionicons name="create-outline" size={16} color="#fff" />
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deletePost(item)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-outline" size={64} color={Colors.muted} />
                  <Text style={styles.emptyTitle}>No posts yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Create your first job or accommodation post to see it here
                  </Text>
                  <TouchableOpacity 
                    style={styles.createButton}
                    onPress={() => setShowMyPosts(false)}
                  >
                    <Text style={styles.createButtonText}>Create Post</Text>
                  </TouchableOpacity>
                </View>
              }
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Login prompt styles
  loginPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.bg,
  },
  loginPromptCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: 320,
    width: '100%',
  },
  loginPromptIcon: {
    marginBottom: 24,
  },
  loginPromptTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  loginPromptSubtitle: {
    fontSize: 16,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },

  // Modal styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.muted,
    fontSize: 16,
  },
  
  // Post card styles
  postCard: {
    backgroundColor: Colors.card,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  postTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  postTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 4,
  },
  postDate: {
    fontSize: 12,
    color: Colors.muted,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    lineHeight: 24,
  },
  postDescription: {
    fontSize: 14,
    color: Colors.muted,
    lineHeight: 20,
    marginBottom: 12,
  },
  
  // Post details
  postDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 8,
    flex: 1,
  },
  
  // Action buttons
  postActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  createButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});