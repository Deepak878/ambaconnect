// Firebase initialization (web/Expo compatible)
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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

// Initialize auth differently depending on environment.
// Avoid top-level import of 'firebase/auth/react-native' so the module doesn't
// cause bundling errors in web environments.
export { app, db };
