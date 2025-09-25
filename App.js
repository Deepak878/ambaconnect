import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, Alert, Modal } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import AuthScreen from './components/AuthScreen';
import JobsScreen from './components/JobsScreen';
import SavedScreen from './components/SavedScreen';
import PostScreen from './components/PostScreen';
import JobDetailModal from './components/JobDetailModal';
import MapScreen from './components/MapScreen';
import initialJobs from './data/jobs';
import { Colors, shared } from './components/Theme';
import Header from './components/Header';
import * as Location from 'expo-location';
import ProfileModal from './components/ProfileModal';
import { db } from './firebaseConfig';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, query as fsQuery, where, onSnapshot, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [user, setUser] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [jobs, setJobs] = useState(initialJobs);
  const [savedIds, setSavedIds] = useState([]);
  const [activeTab, setActiveTab] = useState('Jobs');
  const [detailJob, setDetailJob] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  const handleLogin = async (u) => {
    try {
      if (u && u.guest) {
        const guestUser = { guest: true };
        setUser(guestUser);
        setAuthVisible(false);
        return;
      }
      
      if (u) {
        // normalize phone into id if provided
        const id = u.id || (u.phone ? u.phone.replace(/[^0-9]/g, '') : undefined);
        const userData = { id, name: u.name || 'Anonymous', phone: u.phone };
        
        // Save user to AsyncStorage for persistence
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        
        // Set user state
        setUser(userData);
        setAuthVisible(false);
        setActiveTab('Jobs');
        
        // perform pending action if any
        if (pendingAction) {
          const p = pendingAction;
          setPendingAction(null);
          if (p.type === 'save') await saveJob(p.job);
          if (p.type === 'post') await postJob(p.job);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };
  const openJob = useCallback(async (job, opts) => {
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
  }, []);
  const saveJob = useCallback(async (job) => {
    if (!user || !user.id) {
      // prompt login/register modal and remember intent
      setPendingAction({ type: 'save', job });
      setAuthVisible(true);
      return;
    }

    if (!job || !job.id) {
      Alert.alert('Error', 'Invalid job data');
      return;
    }

    try {
      const userPhone = user.phone ? ('' + user.phone).replace(/[^0-9]/g, '') : user.id;
      const docId = `${userPhone}_${job.id}`;
      const ref = doc(db, 'saved', docId);
      
      if (savedIds.includes(job.id)) {
        // remove saved
        await deleteDoc(ref);
        setSavedIds(prev => prev.filter(id => id !== job.id));
      } else {
        // add saved - store complete job/accommodation data
        const savedData = {
          userPhone,
          jobId: job.id,
          kind: job.kind || 'job',
          title: job.title || '',
          type: job.type || '',
          accomType: job.accomType || '',
          location: job.location || '',
          price: job.price || '',
          currency: job.currency || '',
          duration: job.duration || '',
          images: job.images || [],
          description: job.description || '',
          owner: job.owner || '',
          createdAt: serverTimestamp(),
        };
        
        await setDoc(ref, savedData);
        setSavedIds(prev => [...prev, job.id]);
        
        // Also ensure the job/accommodation exists in the appropriate collection
        try {
          const collectionName = job.kind === 'accommodation' ? 'accommodations' : 'jobs';
          const jobRef = doc(db, collectionName, job.id);
          
          // Check if the job/accommodation already exists in Firestore
          const jobSnap = await getDoc(jobRef);
          if (!jobSnap.exists()) {
            // If it doesn't exist, create it
            await setDoc(jobRef, {
              ...job,
              createdAt: job.createdAt || serverTimestamp(),
            });
          }
        } catch (collectionError) {
          console.warn('Failed to ensure job exists in collection:', collectionError);
          // Continue even if this fails, as the main save operation succeeded
        }
      }
    } catch (e) {
      console.error('Failed to update saved collection', e);
      Alert.alert('Error', 'Unable to update saved items');
    }
  }, [user, savedIds]);

  const postJob = useCallback(async (job) => {
    if (!user || !user.id) {
      setPendingAction({ type: 'post', job });
      setAuthVisible(true);
      return;
    }

    try {
      // Create a new job/accommodation with proper ID and data
      const jobData = { 
        ...job, 
        createdAt: new Date().toISOString(), 
        owner: user?.id || null, 
        id: 'local_' + Date.now() 
      };
      
      // Add to local state
      setJobs(prev => [jobData, ...prev]);
      setActiveTab('Jobs');
    } catch (error) {
      console.error('Failed to post job:', error);
      Alert.alert('Error', 'Unable to post job');
    }
  }, [user]);

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
  const savedJobs = jobs.filter(j => savedIds.includes(j.id));

  // Load user from AsyncStorage on app startup
  useEffect(() => {
    const loadUser = async () => {
      try {
        const local = await AsyncStorage.getItem('user');
        if (local) {
          const u = JSON.parse(local);
          setUser(u);
        }
      } catch (e) { 
        console.warn('Failed to load persisted user', e); 
      }
    };
    loadUser();
  }, []);

  // Set up saved items listener when user changes
  useEffect(() => {
    let unsubSaved = null;
    
    if (user && user.id) {
      const userPhone = user.phone ? ('' + user.phone).replace(/[^0-9]/g, '') : user.id;
      const q = fsQuery(collection(db, 'saved'), where('userPhone', '==', userPhone));
      unsubSaved = onSnapshot(q, snap => {
        const ids = snap.docs.map(d => d.data()?.jobId).filter(Boolean);
        setSavedIds(ids);
      }, err => console.warn('saved snapshot error', err));
    } else {
      setSavedIds([]);
    }

    return () => { 
      if (unsubSaved) unsubSaved(); 
    };
  }, [user?.id, user?.phone]); // Only depend on user.id and user.phone

  // Set up location tracking (one-time setup)
  useEffect(() => {
    let locationSub = null;
    
    const setupLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
          const initialLocation = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserLocation(initialLocation);
          
          // start watching for changes
          locationSub = await Location.watchPositionAsync({ 
            accuracy: Location.Accuracy.Highest, 
            distanceInterval: 10 
          }, (l) => {
            if (l && l.coords) {
              const newLocation = { latitude: l.coords.latitude, longitude: l.coords.longitude };
              setUserLocation(prevLocation => {
                // Only update if location has actually changed significantly
                if (!prevLocation || 
                    Math.abs(prevLocation.latitude - newLocation.latitude) > 0.0001 ||
                    Math.abs(prevLocation.longitude - newLocation.longitude) > 0.0001) {
                  return newLocation;
                }
                return prevLocation;
              });
            }
          });
        }
      } catch (e) {
        // ignore location errors
        console.warn('Location error:', e);
      }
    };

    setupLocation();

    return () => { 
      if (locationSub && locationSub.remove) locationSub.remove(); 
    };
  }, []);

  // One-time seed of local initialJobs (one-time setup)
  useEffect(() => {
    const seedInitialJobs = async () => {
      try {
        const seeded = await AsyncStorage.getItem('seeded_firestore');
        if (!seeded) {
          const makeTags = (j) => {
            const parts = [];
            if (j.title) parts.push(...j.title.split(/[^a-zA-Z0-9]+/));
            if (j.kind) parts.push(j.kind);
            if (j.type) parts.push(j.type);
            if (j.accomType) parts.push(j.accomType);
            if (j.location) parts.push(...j.location.split(/[^a-zA-Z0-9]+/));
            if (j.currency) parts.push(j.currency);
            const normalized = parts.map(p => (p || '').toString().toLowerCase()).filter(Boolean);
            return Array.from(new Set(normalized));
          };

          // seed into in-memory jobs list
          setJobs(prev => {
            const seeded = initialJobs.map(j => ({ 
              ...j, 
              createdAt: new Date().toISOString(), 
              owner: j.owner || null, 
              tags: makeTags(j), 
              id: j.id || 'seed_' + Math.random().toString(36).slice(2,9) 
            }));
            return [...seeded, ...prev];
          });
          
          await AsyncStorage.setItem('seeded_firestore', 'true');
        }
      } catch (e) {
        console.warn('Failed to seed initial jobs', e);
      }
    };

    seedInitialJobs();
  }, []);

  // Do not force auth on startup. Show AuthScreen modal when `authVisible` true.

  return (
    <SafeAreaProvider>
    <SafeAreaView style={shared.container}>
      <Header
        title="Amba connect"
        onProfile={() => setProfileOpen(true)}
        user={user}
        onBack={detailJob ? (() => setDetailJob(null)) : (activeTab !== 'Jobs' ? (() => setActiveTab('Jobs')) : null)}
      />

      <View style={{ flex: 1, padding: 12 }}>
        {activeTab === 'Jobs' && <JobsScreen jobs={jobs} onOpenJob={openJob} onSaveJob={saveJob} savedIds={savedIds} userLocation={userLocation} />}
        {activeTab === 'Saved' && <SavedScreen user={user} onOpen={openJob} onSave={saveJob} />}
        {activeTab === 'Post' && <PostScreen onPost={postJob} />}
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


  <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: Colors.bg, paddingBottom: 12, paddingTop: 6 }}>
        <TouchableOpacity style={{ flex:1, padding:12, alignItems:'center' }} onPress={() => setActiveTab('Jobs')}><Text style={activeTab==='Jobs'?{color:Colors.primary,fontWeight:'700'}:undefined}>Jobs</Text></TouchableOpacity>
        <TouchableOpacity style={{ flex:1, padding:12, alignItems:'center' }} onPress={() => setActiveTab('Saved')}><Text style={activeTab==='Saved'?{color:Colors.primary,fontWeight:'700'}:undefined}>Saved</Text></TouchableOpacity>
        <TouchableOpacity style={{ flex:1, padding:12, alignItems:'center' }} onPress={() => setActiveTab('Post')}><Text style={activeTab==='Post'?{color:Colors.primary,fontWeight:'700'}:undefined}>Post</Text></TouchableOpacity>
        <TouchableOpacity style={{ flex:1, padding:12, alignItems:'center' }} onPress={() => setActiveTab('Map')}><Text style={activeTab==='Map'?{color:Colors.primary,fontWeight:'700'}:undefined}>Map</Text></TouchableOpacity>
      </View>

  <JobDetailModal visibleJob={detailJob} onClose={() => setDetailJob(null)} showContact={showContact} setShowContact={setShowContact} user={user} onDelete={deletePost} />
  <ProfileModal visible={profileOpen} user={user} onClose={() => setProfileOpen(false)} onSave={(u) => { setUser(u); }} />

    <Modal visible={authVisible} animationType="slide" onRequestClose={() => setAuthVisible(false)}>
      <AuthScreen onLogin={handleLogin} onClose={() => setAuthVisible(false)} />
    </Modal>

      <StatusBar style="auto" />
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

