// firebase.js - Fashion Show Project

import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBTju6Ts2C1g4e694qbSJ6QN0IlXpgz2e4",
  authDomain: "fashion-show-7dead.firebaseapp.com",
  projectId: "fashion-show-7dead",
  storageBucket: "fashion-show-7dead.firebasestorage.app",
  messagingSenderId: "163396948189",
  appId: "1:163396948189:web:d75a835ef3eb13d86bcb34",

  // Realtime Database URL - তুমি যেটা দিছিলা
  databaseURL: "https://fashion-show-7dead-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
export const db = getDatabase(app);
export default app;
