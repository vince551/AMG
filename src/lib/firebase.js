import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { firebaseConfig, isFirebaseConfigured } from "../../firebase-config.js";

export { firebaseConfig };
export const configured = isFirebaseConfigured();

let handle = null;

/**
 * One Firebase app per browser session. Returns null when the public web
 * configuration still holds placeholders, so the UI can show setup guidance
 * instead of throwing on import.
 */
export function getFirebase() {
  if (!configured) return null;
  if (!handle) {
    const app = initializeApp(firebaseConfig);
    handle = {
      app,
      auth: getAuth(app),
      db: getFirestore(app),
      storage: getStorage(app),
      functions: getFunctions(app)
    };
  }
  return handle;
}
