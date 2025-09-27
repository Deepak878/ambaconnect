import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, Alert, Modal, ActivityIndicator, Linking, Platform } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AuthScreen from './components/AuthScreen';
import JobsScreen from './components/JobsScreen';
import SavedScreen from './components/SavedScreen';
import PostScreen from './components/PostScreen';
import JobDetailModal from './components/JobDetailModal';
import MapScreen from './components/MapScreen';
import ErrorBoundary from './components/ErrorBoundary';
import { Colors, shared } from './components/Theme';

import Header from './components/Header';
import * as Location from 'expo-location';
import ProfileModal from './components/ProfileModal';
import { db } from './firebaseConfig';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  collection, 
  query as fsQuery, 
  where, 
  onSnapshot, 
  getDoc,
  orderBy,
  addDoc
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [user, setUser] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [activeTab, setActiveTab] = useState('Jobs');
  const [detailJob, setDetailJob] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [locationLabel, setLocationLabel] = useState('Location off');
  const lastGeocodeRef = useRef({ timestamp: 0, latitude: null, longitude: null, label: 'Location off' });

  const handleLogin = async (u) => {
    // Handle null/undefined user (logout)
    if (!u) {
      setUser(null);
      setAuthVisible(false);
      return;
    }
    
    // Handle guest user
    if (u.guest) {
      setUser({ guest: true });
      setAuthVisible(false);
      return;
    }
    
    // Handle authenticated user - preserve all user data from AuthScreen
    console.log('handleLogin called with user:', u);
    
    // Use the complete user object from AuthScreen, just ensure ID is normalized
    const normalizedUser = {
      ...u, // Preserve all fields (name, phone, dob, privacySettings, etc.)
      id: u.id || (u.phone ? u.phone.replace(/[^0-9]/g, '') : undefined)
    };
    
    console.log('Setting user to:', normalizedUser);
    setUser(normalizedUser);
    
    // Close the auth modal with a small delay to ensure state updates
    setTimeout(() => {
      console.log('Closing auth modal');
      setAuthVisible(false);
    }, 100);
    
    // If user was on Post tab when they triggered login, stay there
    // The PostScreen will automatically re-render with the new user data
    
    // after login, subscriptions will pick up saved items (useEffect below)
    // perform pending action if any
    if (pendingAction) {
      const p = pendingAction;
      setPendingAction(null);
      if (p.type === 'save') saveJob(p.job);
      if (p.type === 'post') postJob(p.job);
    }
  };
  const openJob = async (job, opts) => {
    if (!job) return;
    try {
      // If this job has an id that looks like a remote doc (not a local placeholder), try to fetch latest from Firestore
      if (job.id && !String(job.id).startsWith('local_')) {
        const col = job.kind === 'accommodation' ? 'accommodations' : 'jobs';
        try {
          const snap = await getDoc(doc(db, col, job.id));
          if (snap && snap.exists && snap.exists()) {
            const data = snap.data() || {};
            setDetailJob({ id: snap.id, ...data });
            setShowContact(!!(opts && opts.showContact));
            return;
          }
        } catch (e) {
          console.warn('Failed to fetch latest job doc, falling back to provided object', e);
        }
      }
    } catch (e) {
      console.warn('openJob error', e);
    }
    // fallback to provided job object
    setDetailJob(job);
    setShowContact(!!(opts && opts.showContact));
  };

  const openInMaps = (item) => {
    if (!item || (!item.lat && !item.lng && !item.location)) {
      Alert.alert('Location Not Available', 'This item does not have location data to show on maps.');
      return;
    }

    const { lat, lng, location, title } = item;
    
    if (lat && lng) {
      // Use coordinates if available
      const label = encodeURIComponent(title || 'Location');
      let url;
      
      if (Platform.OS === 'ios') {
        // For iOS, use Apple Maps
        url = `maps://app?daddr=${lat},${lng}&q=${label}`;
      } else {
        // For Android, use Google Maps
        url = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
      }

      Linking.canOpenURL(url).then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // Fallback to web-based maps
          const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
          Linking.openURL(webUrl);
        }
      }).catch(err => {
        console.error('Error opening maps:', err);
        Alert.alert('Error', 'Unable to open maps application.');
      });
    } else if (location) {
      // Use location name if coordinates not available
      const query = encodeURIComponent(location);
      let url;
      
      if (Platform.OS === 'ios') {
        url = `maps://app?q=${query}`;
      } else {
        url = `geo:0,0?q=${query}`;
      }

      Linking.canOpenURL(url).then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // Fallback to web-based maps
          const webUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
          Linking.openURL(webUrl);
        }
      }).catch(err => {
        console.error('Error opening maps:', err);
        Alert.alert('Error', 'Unable to open maps application.');
      });
    }
  };

  const saveJob = async (job) => {
    if (!user || !user.id) {
      // prompt login/register modal and remember intent
      setPendingAction({ type: 'save', job });
      setAuthVisible(true);
      return;
    }
    try {
      const userPhone = user.phone ? ('' + user.phone).replace(/[^0-9]/g, '') : user.id;
      const docId = `${userPhone}_${job.id}`;
      const ref = doc(db, 'saved', docId);
      
      if (savedIds.includes(String(job.id))) {
        // remove saved
        await deleteDoc(ref);
        setSavedIds(prev => prev.filter(id => id !== String(job.id)));
      } else {
        await setDoc(ref, {
          userPhone,
          jobId: String(job.id),  // Ensure jobId is stored as string to match jobs array
          kind: job.kind || 'job',
          title: job.title || '',
          createdAt: serverTimestamp(),
        });
        setSavedIds(prev => [...prev, String(job.id)]);
      }
    } catch (e) {
      console.error('Failed to update saved collection', e);
      Alert.alert('Error', 'Unable to update saved items');
    }
  };

  const postJob = async (job) => {
    if (!user || !user.id) {
      setPendingAction({ type: 'post', job });
      setAuthVisible(true);
      return;
    }

    try {
      // Save to appropriate Firestore collection
      const collection_name = job.kind === 'accommodation' ? 'accommodations' : 'jobs';
      const docRef = await addDoc(collection(db, collection_name), {
        ...job,
        createdAt: serverTimestamp(),
        owner: user.id || null,
      });
      
      // The job will be automatically added to the jobs array via the onSnapshot listener
      setActiveTab('Jobs');
    } catch (error) {
      Alert.alert('Error', 'Unable to post job. Please try again.');
    }
  };

  const deletePost = async (post) => {
    if (!post) return;
    if (!user || !user.id) {
      Alert.alert('Not allowed', 'Only the post owner can delete this post');
      return;
    }
    if (post.owner !== user.id) {
      Alert.alert('Not allowed', 'Only the post owner can delete this post');
      return;
    }
    Alert.alert('Delete post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const col = post.kind === 'accommodation' ? 'accommodations' : 'jobs';
          await deleteDoc(doc(db, col, post.id));
          // remove locally
          setJobs(prev => prev.filter(p => p.id !== post.id));
          setDetailJob(null);
        } catch (e) {
          Alert.alert('Error', 'Unable to delete post');
        }
      }}
    ]);
  };
  const savedJobs = jobs.filter(j => savedIds.includes(String(j.id)));

  // Optimized Firestore connection setup function
  const setupFirestoreListeners = () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      // Use a single optimized query for better performance
      const jobsQuery = fsQuery(
        collection(db, 'jobs'), 
        orderBy('createdAt', 'desc')
      );
      
      const accommodationsQuery = fsQuery(
        collection(db, 'accommodations'), 
        orderBy('createdAt', 'desc')
      );

      const unsubJobs = onSnapshot(jobsQuery, (snapshot) => {
        const firestoreJobs = snapshot.docs.map(doc => ({
          id: doc.id,
          kind: 'job',
          ...doc.data()
        }));
        
        // Update jobs with proper deduplication
        setJobs(prevJobs => {
          const accommodations = prevJobs.filter(j => j.kind === 'accommodation');
          const allItems = [...firestoreJobs, ...accommodations];
          
          // Deduplicate by ID
          const uniqueItems = allItems.filter((item, index, self) => 
            index === self.findIndex(i => i.id === item.id)
          );
          
          return uniqueItems;
        });
        
        setIsConnecting(false);
        setConnectionError(null);
      }, (error) => {
        console.error('Jobs listener error:', error);
        setIsConnecting(false);
        setConnectionError('Failed to connect to jobs. Retrying...');
        setTimeout(setupFirestoreListeners, 5000);
      });

      const unsubAccommodations = onSnapshot(accommodationsQuery, (accomSnapshot) => {
        const firestoreAccommodations = accomSnapshot.docs.map(doc => ({
          id: doc.id,
          kind: 'accommodation',
          ...doc.data()
        }));
        
        // Update accommodations with proper deduplication
        setJobs(prevJobs => {
          const jobs = prevJobs.filter(j => j.kind === 'job');
          const allItems = [...jobs, ...firestoreAccommodations];
          
          // Deduplicate by ID
          const uniqueItems = allItems.filter((item, index, self) => 
            index === self.findIndex(i => i.id === item.id)
          );
          
          return uniqueItems;
        });
      }, (error) => {
        console.error('Accommodations listener error:', error);
        setConnectionError('Failed to load accommodations');
      });

      return { unsubJobs, unsubAccommodations };
    } catch (error) {
      console.error('Failed to setup Firestore listeners:', error);
      setIsConnecting(false);
      setConnectionError('Connection failed. Retrying...');
      setTimeout(setupFirestoreListeners, 10000);
      return { unsubJobs: null, unsubAccommodations: null };
    }
  };

  useEffect(() => {
    let unsubSaved = null;
    let unsubscriptions = null;
    
    // load persisted user from AsyncStorage for app persistence
    (async () => {
      try {
        const local = await AsyncStorage.getItem('user');
        if (local) {
          const u = JSON.parse(local);
          setUser(u);
        }
      } catch (e) { console.warn('Failed to load persisted user', e); }
    })();

    // Setup Firestore listeners
    unsubscriptions = setupFirestoreListeners();
    
    let locationSub = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          // start watching for changes
          locationSub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Highest, distanceInterval: 10 }, (l) => {
            if (l && l.coords) setUserLocation({ latitude: l.coords.latitude, longitude: l.coords.longitude });
          });
        }
      } catch (e) {
        // ignore location errors
      }
    })();
    
    return () => { 
      if (locationSub && locationSub.remove) locationSub.remove(); 
      if (unsubscriptions) {
        if (unsubscriptions.unsubJobs) unsubscriptions.unsubJobs();
        if (unsubscriptions.unsubAccommodations) unsubscriptions.unsubAccommodations();
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!userLocation) {
      setLocationLabel('Location off');
      lastGeocodeRef.current = { timestamp: 0, latitude: null, longitude: null, label: 'Location off' };
      return () => { cancelled = true; };
    }

    const { latitude, longitude } = userLocation;
    const fallbackLabel = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
    const now = Date.now();
    const last = lastGeocodeRef.current;
    const movedFar = !last.latitude || !last.longitude || Math.abs(latitude - last.latitude) > 0.002 || Math.abs(longitude - last.longitude) > 0.002;

    if (!movedFar && now - last.timestamp < 60000) {
      setLocationLabel(last.label || fallbackLabel);
      return () => { cancelled = true; };
    }

    setLocationLabel('Locating...');

    Location.reverseGeocodeAsync({ latitude, longitude })
      .then((results) => {
        if (cancelled) return;
        const place = results && results[0];
        const parts = [
          place?.city || place?.district || place?.name,
          place?.region || place?.subregion
        ].filter(Boolean);
        const label = parts.length ? parts.join(', ') : fallbackLabel;
        lastGeocodeRef.current = { timestamp: Date.now(), latitude, longitude, label };
        setLocationLabel(label);
      })
      .catch(() => {
        if (cancelled) return;
        const label = fallbackLabel;
        lastGeocodeRef.current = { timestamp: Date.now(), latitude, longitude, label };
        setLocationLabel(label);
      });

    return () => {
      cancelled = true;
    };
  }, [userLocation]);

  // Separate useEffect for saved jobs that depends on user state
  useEffect(() => {
    let unsubSaved = null;
    
    if (user && user.id) {
      const userPhone = user.phone ? ('' + user.phone).replace(/[^0-9]/g, '') : user.id;
      
      // Query ALL saved documents
      const q = fsQuery(collection(db, 'saved'));
      unsubSaved = onSnapshot(q, snap => {
        // Try to extract jobIds from document data first, then fallback to document ID
        const ids = snap.docs.map(d => {
          const docId = d.id;
          const first10 = docId.substring(0, 10);
          const belongsToUser = first10 === userPhone.substring(0, 10);
          
          if (!belongsToUser) {
            return null;
          }
          
          const data = d.data();
          // First try to get jobId from document data
          if (data?.jobId) {
            // Ensure jobId is a string to match jobs array
            return String(data.jobId);
          }
          // Fallback: extract jobId from document ID (userPhone_jobId format)
          if (docId.includes('_')) {
            const parts = docId.split('_');
            const jobId = parts[parts.length - 1]; // Take the last part as jobId
            // Ensure extracted jobId is a string to match jobs array
            return String(jobId);
          }
          return null;
        }).filter(Boolean);
        
        console.log('Loaded saved job IDs:', ids); // Debug log
        setSavedIds(ids);
      }, error => {
        console.error('Error listening to saved jobs:', error);
        setSavedIds([]);
      });
    } else {
      // If no user, clear saved jobs
      setSavedIds([]);
    }
    
    return () => {
      if (unsubSaved) unsubSaved();
    };
  }, [user]); // This useEffect depends on user state

  // Do not force auth on startup. Show AuthScreen modal when `authVisible` true.

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SafeAreaView style={shared.container}>
          <Header
            title="GenZ"
            onProfile={() => setProfileOpen(true)}
            user={user}
            locationLabel={locationLabel}
            />

          {/* Connection Status Indicator */}
          {(isConnecting || connectionError) && (
            <View style={{ 
              backgroundColor: connectionError ? '#FFE6E6' : '#E6F3FF', 
              padding: 8, 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderBottomWidth: 1,
              borderBottomColor: Colors.border
            }}>
              {isConnecting && <ActivityIndicator size="small" color="#007AFF" style={{ marginRight: 8 }} />}
              <Text style={{ 
                color: connectionError ? '#D32F2F' : '#1976D2', 
                fontSize: 12, 
                textAlign: 'center',
                flex: 1
              }}>
                {isConnecting ? 'Connecting to server...' : connectionError}
              </Text>
              {connectionError && !isConnecting && (
                <TouchableOpacity 
                  onPress={() => {
                    setConnectionError(null);
                    const newUnsubs = setupFirestoreListeners();
                    // Update the unsubscriptions reference if needed
                  }}
                  style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#1976D2', borderRadius: 4 }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={{ flex: 1, padding: 12 }}>
            {activeTab === 'Jobs' && <JobsScreen jobs={jobs} onOpenJob={openJob} onSaveJob={saveJob} savedIds={savedIds} userLocation={userLocation} isConnecting={isConnecting} />}
            {activeTab === 'Saved' && <SavedScreen savedJobs={savedJobs} onOpen={openJob} onSave={saveJob} user={user} userLocation={userLocation} />}
            {activeTab === 'Post' && <PostScreen onPost={postJob} onOpenAuth={() => setAuthVisible(true)} user={user} />}
            {activeTab === 'Map' && (
              <MapScreen
                jobs={jobs.filter(j => j.kind === 'job')}
                accommodations={jobs.filter(j => j.kind === 'accommodation')}
                userLocation={userLocation}
                onOpenJob={openJob}
                onSave={saveJob}
                savedIds={savedIds}
              />
            )}
          </View>

          <View style={{ 
            flexDirection: 'row', 
            borderTopWidth: 1, 
            borderColor: Colors.border, 
            paddingBottom: 12, 
            paddingTop: 6,
            backgroundColor: Colors.card,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 8,
          }}>
            <TouchableOpacity 
              style={{ flex:1, padding:12, alignItems:'center' }} 
              onPress={() => setActiveTab('Jobs')}
            >
              <View style={{ alignItems: 'center' }}>
                <Ionicons 
                  name="briefcase" 
                  size={20} 
                  color={activeTab === 'Jobs' ? Colors.primary : Colors.muted} 
                />
                <Text style={[
                  { fontSize: 12, marginTop: 4 },
                  activeTab === 'Jobs' ? { color: Colors.primary, fontWeight: '600' } : { color: Colors.muted }
                ]}>
                  Jobs
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ flex:1, padding:12, alignItems:'center' }} 
              onPress={() => setActiveTab('Saved')}
            >
              <View style={{ alignItems: 'center' }}>
                <Ionicons 
                  name={activeTab === 'Saved' ? "heart" : "heart-outline"} 
                  size={20} 
                  color={activeTab === 'Saved' ? Colors.primary : Colors.muted} 
                />
                <Text style={[
                  { fontSize: 12, marginTop: 4 },
                  activeTab === 'Saved' ? { color: Colors.primary, fontWeight: '600' } : { color: Colors.muted }
                ]}>
                  Saved
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ flex:1, padding:12, alignItems:'center' }} 
              onPress={() => setActiveTab('Post')}
            >
              <View style={{ alignItems: 'center' }}>
                <Ionicons 
                  name="add-circle" 
                  size={20} 
                  color={activeTab === 'Post' ? Colors.primary : Colors.muted} 
                />
                <Text style={[
                  { fontSize: 12, marginTop: 4 },
                  activeTab === 'Post' ? { color: Colors.primary, fontWeight: '600' } : { color: Colors.muted }
                ]}>
                  Post
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ flex:1, padding:12, alignItems:'center' }} 
              onPress={() => setActiveTab('Map')}
            >
              <View style={{ alignItems: 'center' }}>
                <Ionicons 
                  name="map" 
                  size={20} 
                  color={activeTab === 'Map' ? Colors.primary : Colors.muted} 
                />
                <Text style={[
                  { fontSize: 12, marginTop: 4 },
                  activeTab === 'Map' ? { color: Colors.primary, fontWeight: '600' } : { color: Colors.muted }
                ]}>
                  Map
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <JobDetailModal 
            visibleJob={detailJob} 
            onClose={() => setDetailJob(null)} 
            showContact={showContact} 
            setShowContact={setShowContact} 
            user={user} 
            onDelete={deletePost} 
            onSeeOnMap={openInMaps}
          />
          <ProfileModal visible={profileOpen} user={user} onClose={() => setProfileOpen(false)} onSave={(u) => { setUser(u); }} />

          <Modal visible={authVisible} animationType="slide" onRequestClose={() => setAuthVisible(false)}>
            <AuthScreen onLogin={handleLogin} onClose={() => setAuthVisible(false)} />
          </Modal>

          <StatusBar style="auto" />
        </SafeAreaView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

