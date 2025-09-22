// Firebase initialization (web/Expo compatible)
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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

export { app, db };
