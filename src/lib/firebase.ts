import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD9M4M_0I2LHyHwwBKv5tFiBZarq9lFC3U",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sentiment-pharma.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sentiment-pharma",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sentiment-pharma.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "449924197230",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:449924197230:web:e38bfc75f5392472316f7f",
};

let app;
let db;
let auth;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase initialization error:", error);
  // Create mock instances to prevent app crash
  app = null;
  db = null;
  auth = null;
}

export { db, auth };
export default app;
