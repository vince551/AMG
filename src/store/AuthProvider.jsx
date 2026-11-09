import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "../lib/api";
import { useToast } from "./ToastProvider";

/**
 * Normalize a Laravel user (snake_case) into the camelCase shape the
 * existing UI components expect.
 */
function normalizeUser(u) {
  if (!u) return null;
  return {
    // keep raw fields too so nothing breaks if a component uses either form
    ...u,
    uid: u.uid,
    email: u.email,
    role: u.role,
    fullName: u.full_name ?? u.fullName ?? "",
    photoURL: u.photo_url ?? u.photoURL ?? "",
    libraryNumber: u.library_number ?? u.libraryNumber ?? "",
    isApproved: u.is_approved ?? u.isApproved ?? false,
    membershipStatus: u.membership_status ?? u.membershipStatus ?? "Pending",
    starredBookIds: u.starred_book_ids ?? u.starredBookIds ?? [],
    school: u.school ?? "",
    studyLevel: u.study_level ?? u.studyLevel ?? "",
    eduLevel: u.edu_level ?? u.eduLevel ?? "",
    guardianName: u.guardian_name ?? u.guardianName ?? "",
    guardianRelation: u.guardian_relation ?? u.guardianRelation ?? "",
    guardianPhone: u.guardian_phone ?? u.guardianPhone ?? "",
    approvedAt: u.approved_at ?? u.approvedAt ?? null,
    createdAt: u.created_at ?? u.createdAt ?? null,
  };
}

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const { showToast } = useToast();

  const [user, setUser] = useState(null);   // raw Laravel user object
  const [profile, setProfile] = useState(null);   // same object, aliased for compatibility
  const [librarian, setLibrarian] = useState(false);
  const [ready, setReady] = useState(false);

  // ── Bootstrap: restore session from stored JWT ───────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) { setReady(true); return; }

    api.get("/auth/me")
      .then((data) => {
        const u = normalizeUser(data?.user ?? data);
        setUser(u);
        setProfile(u);
        setLibrarian(u?.role === "librarian");
      })
      .catch(() => {
        setToken(null);
      })
      .finally(() => setReady(true));
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (loginName, password) => {
    const trimmed = String(loginName || "").trim();
    const email = trimmed.includes("@") ? trimmed : "";
    if (!email) {
      showToast("Enter the email address linked to your account.", "error");
      return false;
    }

    try {
      const data = await api.post("/auth/login", { email, password });
      setToken(data.token);
      const u = normalizeUser(data.user);
      setUser(u);
      setProfile(u);
      setLibrarian(u?.role === "librarian");
      showToast("Login successful.");
      return true;
    } catch (err) {
      showToast(err.message || "The email or password is incorrect.", "error");
      return false;
    }
  }, [showToast]);

  // ── Register ─────────────────────────────────────────────────────────────
  const register = useCallback(async (formData) => {
    // formData is a FormData instance from the existing AuthModal
    try {
      const data = await api.post("/auth/register", formData);
      setToken(data.token);
      const u = normalizeUser(data.user);
      setUser(u);
      setProfile(u);
      setLibrarian(u?.role === "librarian");
      if (data.warning) showToast(data.warning, "error");
      showToast("Registration submitted. Please wait for librarian approval.");
      return true;
    } catch (err) {
      // Surface validation errors if present
      if (err.errors) {
        const first = Object.values(err.errors)[0];
        showToast(Array.isArray(first) ? first[0] : first, "error");
      } else {
        showToast(err.message || "Registration could not be completed.", "error");
      }
      return false;
    }
  }, [showToast]);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setProfile(null);
    setLibrarian(false);
    showToast("You have logged out.");
  }, [showToast]);

  // ── Password reset ───────────────────────────────────────────────────────
  const resetPassword = useCallback(async (loginName) => {
    const trimmed = String(loginName || "").trim();
    const email = trimmed.toLowerCase() === "librarian" ? "" : trimmed;
    if (!email || !email.includes("@")) {
      showToast("Enter the account email address to reset the password.", "error");
      return;
    }
    try {
      await api.post("/auth/password-reset", { email });
      showToast("If an account exists for that email, a password reset email has been sent.");
    } catch {
      // Intentionally silent — don't leak email existence
      showToast("If an account exists for that email, a password reset email has been sent.");
    }
  }, [showToast]);

  // ── Update photo ─────────────────────────────────────────────────────────
  const updatePhoto = useCallback(async (file) => {
    if (!user) { showToast("Log in before updating your profile photo.", "error"); return false; }
    if (!file) return false;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      showToast("Choose an image smaller than 5 MB.", "error");
      return false;
    }
    try {
      const form = new FormData();
      form.append("photo", file);
      const data = await api.post("/auth/me/photo", form);
      const updated = normalizeUser({ ...user, photo_url: data.photoURL });
      setUser(updated);
      setProfile(updated);
      showToast("Profile photo updated.");
      return true;
    } catch (err) {
      showToast(err.message || "Photo could not be updated.", "error");
      return false;
    }
  }, [user, showToast]);

  // ── Refresh profile ──────────────────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (!getToken()) return null;
    try {
      const data = await api.get("/auth/me");
      const u = normalizeUser(data?.user ?? data);
      setUser(u);
      setProfile(u);
      return u;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(() => ({
    user, profile, librarian, ready,
    login, register, logout, resetPassword, updatePhoto, refreshProfile, setProfile
  }), [user, profile, librarian, ready, login, register, logout, resetPassword, updatePhoto, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
