import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCtyKMjC_RkQgmSpCaYhpxcT1A9FFDcEjA",
  authDomain: "gen-lang-client-0810986569.firebaseapp.com",
  projectId: "gen-lang-client-0810986569",
  storageBucket: "gen-lang-client-0810986569.firebasestorage.app",
  messagingSenderId: "989195096905",
  appId: "1:989195096905:web:b8b098c7cfe9609181c098"
};

const app = initializeApp(firebaseConfig);

// Get Firestore reference for specific databaseId
const db = getFirestore(app, "ai-studio-64158c8b-4375-4a58-b775-9e3b8ce26df1");

export { db };
