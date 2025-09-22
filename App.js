import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import AuthScreen from './components/AuthScreen';
import JobsScreen from './components/JobsScreen';
import SavedScreen from './components/SavedScreen';
import PostScreen from './components/PostScreen';
import JobDetailModal from './components/JobDetailModal';
import MapScreen from './components/MapScreen';
import initialJobs from './data/jobs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, shared } from './components/Theme';
import { db } from './firebaseConfig';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, getDoc, setDoc, where, getDocs, deleteDoc } from 'firebase/firestore';
import Header from './components/Header';
import ProfileModal from './components/ProfileModal';

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

  const handleLogin = async (u) => {
    try {
      // If AuthScreen returned a user id, fetch full user record from Firestore
      if (u && u.id) {
        const userRef = doc(db, 'users', u.id);
        const snap = await getDoc(userRef);
        const data = snap.exists() ? { id: snap.id, ...snap.data() } : { id: u.id, name: u.name || 'Anonymous', phone: u.phone };
  setUser(data);
        try { await AsyncStorage.setItem('user', JSON.stringify(data)); } catch (e) {}

        // load saved items for this user from kind-specific saved collections
        try {
          const qJob = query(collection(db, 'savedjob'), where('userId', '==', data.id));
          const qAcc = query(collection(db, 'savedaccommodation'), where('userId', '==', data.id));
          const [sj, sa] = await Promise.all([getDocs(qJob), getDocs(qAcc)]);
          const sIds = [...sj.docs.map(d => d.data().postId), ...sa.docs.map(d => d.data().postId)];
          setSavedIds(sIds);
        } catch (se) {
          // ignore saved load errors
        }

        // if there was a pending action (save/post) perform it now
        setTimeout(() => {
          if (pendingAction) {
            const p = pendingAction;
            setPendingAction(null);
            setAuthVisible(false);
            if (p.type === 'save') saveJob(p.job);
            if (p.type === 'post') postJob(p.job);
          } else {
            setAuthVisible(false);
          }
        }, 250);
        return;
      }
    } catch (e) {
      // fallthrough to local set
    }
    // if a guest action (Continue as guest) was requested
    if (u && u.guest) {
      const guest = { guest: true };
      setUser(guest);
      setAuthVisible(false);
      return;
    }

    setUser(u);
    try { await AsyncStorage.setItem('user', JSON.stringify(u)); } catch (e) {}
  };
  const openJob = (job, opts) => { setDetailJob(job); setShowContact(!!(opts && opts.showContact)); };
  const saveJob = async (job) => {
    if (!user || !user.id) {
      // prompt login/register modal and remember intent
      setPendingAction({ type: 'save', job });
      setAuthVisible(true);
      return;
    }
    const col = job.kind === 'accommodation' ? 'savedaccommodation' : 'savedjob';
    const docId = `${user.id}_${job.id}`;
    const ref = doc(db, col, docId);
    try {
      if (savedIds.includes(job.id)) {
        // remove
        await deleteDoc(ref);
        const next = savedIds.filter(id => id !== job.id);
        setSavedIds(next);
      } else {
        // add
        await setDoc(ref, { userId: user.id, postId: job.id, kind: job.kind, createdAt: new Date().toISOString() });
        setSavedIds(prev => [...prev, job.id]);
      }
    } catch (e) {
      // fallback: update local state
      if (savedIds.includes(job.id)) setSavedIds(prev => prev.filter(id => id !== job.id));
      else setSavedIds(prev => [...prev, job.id]);
    }
  };

  const postJob = async (job) => {
    if (!user || !user.id) {
      setPendingAction({ type: 'post', job });
      setAuthVisible(true);
      return;
    }

    try {
      const payload = { ...job, createdAt: new Date().toISOString(), owner: user?.id || null };
      const col = job.kind === 'accommodation' ? 'accommodations' : 'jobs';
      await addDoc(collection(db, col), payload);
      setActiveTab('Jobs');
    } catch (e) {
      // fallback: put into local jobs
      setJobs(prev => {
        const local = { ...job, createdAt: new Date().toISOString(), owner: user?.id || null };
        const next = [local, ...prev];
        try { AsyncStorage.setItem('jobs', JSON.stringify(next)); } catch (e) {}
        return next;
      });
      setActiveTab('Jobs');
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
  const savedJobs = jobs.filter(j => savedIds.includes(j.id));

  useEffect(() => {
    // one-time seed of local initialJobs into Firestore if not seeded
    (async () => {
      try {
        const seeded = await AsyncStorage.getItem('seeded_firestore');
        if (!seeded) {
          // push each initial job into the appropriate collection
          for (const j of initialJobs) {
            const payload = { ...j, createdAt: new Date().toISOString(), owner: j.owner || null };
            const col = j.kind === 'accommodation' ? 'accommodations' : 'jobs';
            try { await addDoc(collection(db, col), payload); } catch (e) { /* ignore per-item errors */ }
          }
          await AsyncStorage.setItem('seeded_firestore', '1');
        }
      } catch (e) {}
    })();
    // listen for jobs and accommodations collection changes and merge
    const qJobs = query(collection(db, 'jobs'));
    const qAccom = query(collection(db, 'accommodations'));

    const unsubJobs = onSnapshot(qJobs, (snap) => {
      const arrJobs = snap.docs.map(d => ({ id: d.id, kind: 'job', ...d.data() }));
      setJobs(prev => {
        // merge with accom if present in prev
        const accom = prev.filter(p => p.kind === 'accommodation');
        const merged = [...arrJobs, ...accom];
        return merged.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      });
    }, (err) => {
      // ignore for now
    });

    const unsubAccom = onSnapshot(qAccom, (snap) => {
      const arrAcc = snap.docs.map(d => ({ id: d.id, kind: 'accommodation', ...d.data() }));
      setJobs(prev => {
        const jobsOnly = prev.filter(p => p.kind === 'job');
        const merged = [...jobsOnly, ...arrAcc];
        return merged.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      });
    }, (err) => {
      // ignore
    });

    // load cached user from AsyncStorage while Firestore may load later
    (async () => {
      try {
        const ru = await AsyncStorage.getItem('user');
        if (ru) {
          const parsed = JSON.parse(ru);
          setUser(parsed);
          if (parsed && parsed.id && Array.isArray(parsed.savedIds)) setSavedIds(parsed.savedIds);
        }
      } catch (e) {}
    })();

    return () => { unsubJobs(); unsubAccom(); };
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
        {activeTab === 'Jobs' && <JobsScreen jobs={jobs} onOpenJob={openJob} onSaveJob={saveJob} savedIds={savedIds} />}
  {activeTab === 'Saved' && <SavedScreen savedJobs={savedJobs} onOpen={openJob} onSave={saveJob} />}
        {activeTab === 'Post' && <PostScreen onPost={postJob} />}
        {activeTab === 'Map' && <MapScreen jobs={jobs} onOpenJob={openJob} />}
      </View>


  <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: Colors.bg, paddingBottom: 12, paddingTop: 6 }}>
        <TouchableOpacity style={{ flex:1, padding:12, alignItems:'center' }} onPress={() => setActiveTab('Jobs')}><Text style={activeTab==='Jobs'?{color:Colors.primary,fontWeight:'700'}:undefined}>Jobs</Text></TouchableOpacity>
        <TouchableOpacity style={{ flex:1, padding:12, alignItems:'center' }} onPress={() => setActiveTab('Saved')}><Text style={activeTab==='Saved'?{color:Colors.primary,fontWeight:'700'}:undefined}>Saved</Text></TouchableOpacity>
        <TouchableOpacity style={{ flex:1, padding:12, alignItems:'center' }} onPress={() => setActiveTab('Post')}><Text style={activeTab==='Post'?{color:Colors.primary,fontWeight:'700'}:undefined}>Post</Text></TouchableOpacity>
        <TouchableOpacity style={{ flex:1, padding:12, alignItems:'center' }} onPress={() => setActiveTab('Map')}><Text style={activeTab==='Map'?{color:Colors.primary,fontWeight:'700'}:undefined}>Map</Text></TouchableOpacity>
      </View>

  <JobDetailModal visibleJob={detailJob} onClose={() => setDetailJob(null)} showContact={showContact} setShowContact={setShowContact} user={user} onDelete={deletePost} />
  <ProfileModal visible={profileOpen} user={user} onClose={() => setProfileOpen(false)} onSave={async (u) => { 
        try {
          if (u && u.id) {
            const userRef = doc(db, 'users', u.id);
            await setDoc(userRef, { ...u }, { merge: true });
          }
        } catch (e) {
          // ignore firestore write error
        }
        setUser(u); try { await AsyncStorage.setItem('user', JSON.stringify(u)); } catch (e) {} }} />

  {authVisible ? <AuthScreen onLogin={handleLogin} onClose={() => setAuthVisible(false)} /> : null}

      <StatusBar style="auto" />
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

