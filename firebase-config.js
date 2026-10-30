// AMG Library Firebase client configuration.
// These values are public client identifiers, NOT admin secrets.
// Replace placeholders with Firebase Console > Project settings > Your apps.
// Never put a service-account JSON, private key, or Admin SDK credential here.
export const firebaseConfig = {
  apiKey: "AIzaSyAMOQlVeZ8PDGGC4wUyMnFmxYUG2sgcgB4",
  authDomain: "amglibra-76222.firebaseapp.com",
  projectId: "amglibra-76222",
  storageBucket: "amglibra-76222.firebasestorage.app",
  messagingSenderId: "71849525439",
  appId: "1:71849525439:web:c3e70a8802c5c313c8460a",
  // Set to the email of the Firebase Auth librarian account.
  librarianEmail: "Edwinmuga99@gmail.com"
};

export const isFirebaseConfigured = () =>
  Object.entries(firebaseConfig)
    .filter(([key]) => key !== "librarianEmail")
    .every(([, value]) => typeof value === "string" && value.length > 0 && !value.startsWith("REPLACE_"));
