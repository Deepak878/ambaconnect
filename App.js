import React, { useState, useEffect } from 'react';
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
import { UserProvider, useUser } from './context';

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
    // persistence removed: accept incoming user object and store in memory only
    if (u && u.guest) {
      setUser({ guest: true });
      setAuthVisible(false);
      return;
    }
    if (u) {
      // normalize phone into id if provided
      const id = u.id || (u.phone ? u.phone.replace(/[^0-9]/g, '') : undefined);
      const data = { id, name: u.name || 'Anonymous', phone: u.phone };
  setUser(data);
  setAuthVisible(false);
  setActiveTab('Jobs');
  // after login, subscriptions will pick up saved items (useEffect below)
      // perform pending action if any
      if (pendingAction) {
        const p = pendingAction;
        setPendingAction(null);
        if (p.type === 'save') saveJob(p.job);
        if (p.type === 'post') postJob(p.job);
      }
      return;
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
      if (savedIds.includes(job.id)) {
        // remove saved
        await deleteDoc(ref);
        setSavedIds(prev => prev.filter(id => id !== job.id));
      } else {
        await setDoc(ref, {
          userPhone,
          jobId: job.id,
          kind: job.kind || 'job',
          title: job.title || '',
          createdAt: serverTimestamp(),
        });
        setSavedIds(prev => [...prev, job.id]);
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

    // persistence removed: store new post in-memory
    const local = { ...job, createdAt: new Date().toISOString(), owner: user?.id || null, id: 'local_' + Date.now() };
    setJobs(prev => [local, ...prev]);
    setActiveTab('Jobs');
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
  const savedJobs = jobs.filter(j => savedIds.includes(j.id));

  useEffect(() => {
    let unsubSaved = null;
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
    // one-time seed of local initialJobs into Firestore if not seeded
    (async () => {
      try {
        const seeded = await AsyncStorage.getItem('seeded_firestore');
        if (!seeded) {
          // push each initial job into the appropriate collection using provided id (if any)
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
            const seeded = initialJobs.map(j => ({ ...j, createdAt: new Date().toISOString(), owner: j.owner || null, tags: makeTags(j), id: j.id || 'seed_' + Math.random().toString(36).slice(2,9) }));
            return [...seeded, ...prev];
          });
        }
      } catch (e) {}
    })();
    // persistence removed: no Firestore listeners or AsyncStorage read on startup
    return () => { if (locationSub && locationSub.remove) locationSub.remove(); if (unsubSaved) unsubSaved(); };
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
  {activeTab === 'Saved' && <SavedScreen savedJobs={savedJobs} onOpen={openJob} onSave={saveJob} />}
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

