// Firebase initialization (web/Expo compatible)
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// Auth not used client-side anymore; omit importing auth modules to avoid runtime issues

const firebaseConfig = {
  apiKey: "AIzaSyBAvfLB97sfLDSLHux4ueUx0Gw2flQROmQ",
  authDomain: "ambaconnect-ff4cd.firebaseapp.com",
  projectId: "ambaconnect-ff4cd",
  storageBucket: "ambaconnect-ff4cd.firebasestorage.app",
  messagingSenderId: "61933449945",
  appId: "1:61933449945:web:4475da6b84a78d321e04c8",
  measurementId: "G-N95EJ7R3NT"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Configure Firestore settings for better connectivity
import { connectFirestoreEmulator, enableNetwork, disableNetwork } from 'firebase/firestore';

// Test Firestore connectivity
export const testFirestoreConnection = async () => {
  try {
    // Try to enable network first
    await enableNetwork(db);
    return { success: true, message: 'Connected to Firestore' };
  } catch (error) {
    console.error('Firestore connection test failed:', error);
    return { success: false, message: error.message };
  }
};

// Enable network (useful for offline/online scenarios)
try {
  enableNetwork(db);
} catch (error) {
  console.error('Network enable error (can be ignored):', error);
}

// Initialize auth differently depending on environment.
// Avoid top-level import of 'firebase/auth/react-native' so the module doesn't
// cause bundling errors in web environments.
export { app, db, storage };
