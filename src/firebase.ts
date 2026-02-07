// ================================
// Firebase Initialization
// ================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyDxriFdLP_255afyV758UUstBtPKmr2Iug',
  authDomain: 'tap-type-english.firebaseapp.com',
  projectId: 'tap-type-english',
  storageBucket: 'tap-type-english.firebasestorage.app',
  messagingSenderId: '712527926100',
  appId: '1:712527926100:web:b249cad923df53b6faeec1',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast1');

export default app;
