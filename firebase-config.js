// AMG Library Firebase client configuration.
// These values are public client identifiers, NOT admin secrets.
// Replace the placeholders with the config from Firebase Console > Project settings > Your apps.
// Never place a service-account JSON, private key, or Admin SDK credential in this file.
export const firebaseConfig = {
  apiKey: "REPLACE_WITH_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_WITH_PROJECT_ID",
  storageBucket: "REPLACE_WITH_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "REPLACE_WITH_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_FIREBASE_APP_ID"
};

export const isFirebaseConfigured = () =>
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith("REPLACE_") &&
  firebaseConfig.projectId &&
  !firebaseConfig.projectId.startsWith("REPLACE_") &&
  firebaseConfig.appId &&
  !firebaseConfig.appId.startsWith("REPLACE_");
