// AMG Library Firebase client configuration.
// These values are public client identifiers, NOT admin secrets.
// Replace placeholders with Firebase Console > Project settings > Your apps.
// Never put a service-account JSON, private key, or Admin SDK credential here.
export const firebaseConfig = {
  apiKey: "REPLACE_WITH_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_WITH_PROJECT_ID",
  storageBucket: "REPLACE_WITH_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "REPLACE_WITH_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_FIREBASE_APP_ID",
  // Set to the email of the Firebase Auth librarian account.
  librarianEmail: "REPLACE_WITH_LIBRARIAN_ACCOUNT_EMAIL"
};

export const isFirebaseConfigured = () =>
  Object.entries(firebaseConfig)
    .filter(([key]) => key !== "librarianEmail")
    .every(([, value]) => typeof value === "string" && value.length > 0 && !value.startsWith("REPLACE_"));
