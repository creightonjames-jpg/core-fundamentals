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
  apiKey: "AIzaSyDzdnWu2_iYXYw98B9FAgr9w40RwZdBxQo",
  authDomain: "cgp-core-fundamentals.firebaseapp.com",
  projectId: "cgp-core-fundamentals",
  storageBucket: "cgp-core-fundamentals.firebasestorage.app",
  messagingSenderId: "928709885735",
  appId: "1:928709885735:web:6d639ef56ff4952f447302"
};

// Firestore collection that assessment submissions are written to.
// Change this only if you also change it in firestore.rules.
export const SUBMISSIONS_COLLECTION = "submissions";

// Live. Set this back to false if you ever want to demo the assessment
// without recording submissions — scoring and the printable PDF keep working,
// only the Submit button goes into preview mode.
export const FIREBASE_ENABLED = true;
