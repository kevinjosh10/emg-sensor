import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

// Helper function to get database references
export const dbRef = (path) => ref(db, path);

console.log("[SynapseLink] Firebase initialized ✓ project:", firebaseConfig.projectId);

export { db, set, push, onValue, serverTimestamp, runTransaction };
