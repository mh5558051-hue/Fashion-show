import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBTju6Ts2C1g4e694qbSJ6QN0IlXpgz2e4",
  authDomain: "fashion-show-7dead.firebaseapp.com",
  databaseURL: "https://fashion-show-7dead-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "fashion-show-7dead",
  storageBucket: "fashion-show-7dead.firebasestorage.app",
  messagingSenderId: "163396948189",
  appId: "1:163396948189:web:d75a835ef3eb13d86bcb34"
};

export const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const ADMIN_UID = "Ag8XJGbIgQg2oNN84b417eoxkl52";
