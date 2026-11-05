import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut, updateProfile
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { firebaseConfig, getFirebase } from "../lib/firebase";
import { createLearnerProfile } from "../lib/learnerProfile";
import { MAX_IMAGE_BYTES, avatarSeedUrl, errorMessage, safeFileName } from "../lib/format";
import { useToast } from "./ToastProvider";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

const NOT_CONFIGURED = "Firebase is not configured yet. Follow the setup steps in README.md.";

export function AuthProvider({ children }) {
  const { showToast } = useToast();
  const fb = getFirebase();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [librarian, setLibrarian] = useState(false);
  const [ready, setReady] = useState(!fb);

  useEffect(() => {
    if (!fb) return undefined;
    return onAuthStateChanged(fb.auth, async (nextUser) => {
      setUser(nextUser);
      setProfile(null);
      setLibrarian(false);
      if (nextUser) {
        try {
          const token = await nextUser.getIdTokenResult(true);
          setLibrarian(token.claims.librarian === true);
          const snap = await getDoc(doc(fb.db, "users", nextUser.uid));
          setProfile(snap.exists() ? snap.data() : null);
        } catch (error) {
          showToast(errorMessage(error), "error");
        }
      }
      setReady(true);
    });
  }, [fb, showToast]);

  const refreshProfile = useCallback(async () => {
    if (!fb || !user) return null;
    const snap = await getDoc(doc(fb.db, "users", user.uid));
    const next = snap.exists() ? snap.data() : null;
    setProfile(next);
    return next;
  }, [fb, user]);

  const login = useCallback(async (loginName, password) => {
    if (!fb) {
      showToast(NOT_CONFIGURED, "error");
      return false;
    }
    const trimmed = String(loginName || "").trim();
    const isLibrarianLogin = trimmed.toLowerCase() === "librarian";
    // The librarian username maps to the authorized account email; member
    // full-name login still needs a secure username mapping service.
    const email = isLibrarianLogin
      ? String(firebaseConfig.librarianEmail || "").trim()
      : (trimmed.includes("@") ? trimmed : "");
    if (!email || email.startsWith("REPLACE_")) {
      showToast(isLibrarianLogin
        ? "Librarian login is not configured yet. Set librarianEmail in firebase-config.js to the authorized Firebase account email."
        : "Member full-name login needs a secure username mapping service. Until it is configured, enter the email address linked to your account.", "error");
      return false;
    }
    try {
      await signInWithEmailAndPassword(fb.auth, email, password);
      showToast("Login successful.");
      return true;
    } catch (error) {
      showToast(errorMessage(error), "error");
      return false;
    }
  }, [fb, showToast]);

  const register = useCallback(async (formData) => {
    if (!fb) {
      showToast(NOT_CONFIGURED, "error");
      return false;
    }
    const fullName = String(formData.get("fullName") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const guardianPhone = String(formData.get("guardianPhone") || "").trim();
    if (fullName.length < 2 || !guardianPhone || password.length < 8) {
      showToast("Complete all required fields and use a password of at least 8 characters.", "error");
      return false;
    }

    try {
      let credential;
      try {
        credential = await createUserWithEmailAndPassword(fb.auth, email, password);
      } catch (authError) {
        if (authError?.code !== "auth/email-already-in-use") throw authError;
        // Recover accounts created by an earlier attempt that failed before Firestore.
        credential = await signInWithEmailAndPassword(fb.auth, email, password);
      }
      await updateProfile(credential.user, { displayName: fullName });

      const profileInput = {
        fullName,
        gender: String(formData.get("gender") || ""),
        school: String(formData.get("school") || "").trim(),
        studyLevel: String(formData.get("studyLevel") || "").trim(),
        eduLevel: String(formData.get("eduLevel") || ""),
        guardianName: String(formData.get("guardianName") || "").trim(),
        guardianRelation: String(formData.get("guardianRelation") || ""),
        guardianPhone
      };

      const created = await createLearnerProfile(fb.db, credential.user.uid, email, profileInput);
      let nextProfile = { ...created.profile };

      const photo = formData.get("photo");
      const avatarChoice = String(formData.get("avatarChoice") || "scholar");
      let photoURL = nextProfile.photoURL || avatarSeedUrl(avatarChoice);

      if (photo instanceof File && photo.size > 0) {
        if (!photo.type.startsWith("image/") || photo.size > MAX_IMAGE_BYTES) {
          showToast("Profile photo was skipped. Choose an image smaller than 5 MB.", "error");
        } else {
          try {
            const target = storageRef(fb.storage, "member-photos/" + credential.user.uid + "/" + safeFileName(photo.name, "profile-photo"));
            await uploadBytes(target, photo, { contentType: photo.type });
            photoURL = await getDownloadURL(target);
          } catch (photoError) {
            // Photo storage is optional; registration must still complete.
            console.warn("Optional registration photo upload failed:", photoError?.code || "unknown");
          }
        }
      }

      if (photoURL !== nextProfile.photoURL) {
        await updateDoc(doc(fb.db, "users", credential.user.uid), { photoURL, updatedAt: serverTimestamp() });
        nextProfile = { ...nextProfile, photoURL };
      }

      setProfile(nextProfile);
      showToast(created.created
        ? "Registration submitted. Please wait for librarian approval."
        : "Your existing membership profile has been restored.");
      return true;
    } catch (error) {
      showToast("Registration could not be completed: " + errorMessage(error), "error");
      return false;
    }
  }, [fb, showToast]);

  const logout = useCallback(async () => {
    if (!fb) return;
    try {
      await signOut(fb.auth);
      showToast("You have logged out.");
    } catch (error) {
      showToast(errorMessage(error), "error");
    }
  }, [fb, showToast]);

  const resetPassword = useCallback(async (loginName) => {
    if (!fb) {
      showToast(NOT_CONFIGURED, "error");
      return;
    }
    const trimmed = String(loginName || "").trim();
    const email = trimmed.toLowerCase() === "librarian"
      ? String(firebaseConfig.librarianEmail || "").trim()
      : trimmed;
    if (!email || !email.includes("@") || email.startsWith("REPLACE_")) {
      showToast("Enter the account email address to reset the password.", "error");
      return;
    }
    try {
      await sendPasswordResetEmail(fb.auth, email);
      showToast("If an account exists for that email, a password reset email has been sent.");
    } catch (error) {
      showToast(errorMessage(error), "error");
    }
  }, [fb, showToast]);

  const updatePhoto = useCallback(async (file) => {
    if (!fb || !user) {
      showToast("Log in before updating your profile photo.", "error");
      return false;
    }
    if (!file) return false;
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) {
      showToast("Choose an image smaller than 5 MB.", "error");
      return false;
    }
    try {
      const target = storageRef(fb.storage, "member-photos/" + user.uid + "/" + Date.now() + "-" + safeFileName(file.name, "profile-photo"));
      await uploadBytes(target, file, { contentType: file.type });
      const photoURL = await getDownloadURL(target);
      await updateDoc(doc(fb.db, "users", user.uid), { photoURL, updatedAt: serverTimestamp() });
      setProfile(current => (current ? { ...current, photoURL } : current));
      showToast("Profile photo updated.");
      return true;
    } catch (error) {
      showToast("Photo could not be updated: " + errorMessage(error), "error");
      return false;
    }
  }, [fb, user, showToast]);

  const value = useMemo(() => ({
    user, profile, librarian, ready,
    login, register, logout, resetPassword, updatePhoto, refreshProfile, setProfile
  }), [user, profile, librarian, ready, login, register, logout, resetPassword, updatePhoto, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
