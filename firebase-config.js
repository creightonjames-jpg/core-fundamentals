// ---------------------------------------------------------------------------
// Century Golf Partners — Core Fundamentals Self-Assessment
// Firebase configuration
// ---------------------------------------------------------------------------
// REPLACE the placeholder values below with the config object from your own
// Firebase project:
//
//   Firebase Console  ->  Project settings (gear icon)  ->  General tab
//   ->  scroll to "Your apps"  ->  click the web app  ->  "SDK setup and
//       configuration"  ->  choose "Config"  ->  copy the object.
//
// NOTE: These values are PUBLIC by design. Every Firebase web app ships its
// config in the browser. They are identifiers, not secrets. What actually
// protects your data is the Firestore security rules in firestore.rules —
// make sure you publish those. Do not skip that step.
// ---------------------------------------------------------------------------

export const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

// Firestore collection that assessment submissions are written to.
// Change this only if you also change it in firestore.rules.
export const SUBMISSIONS_COLLECTION = "submissions";

// Set to true once you have pasted your real config above. While this is
// false, the assessment still calculates and prints scores perfectly — it
// just skips the "Submit" step instead of throwing errors. This lets you
// test the page before Firebase is wired up.
export const FIREBASE_ENABLED = false;
