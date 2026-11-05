export const EDUCATION_LEVELS = [
  "PP / Pre-Primary", "Primary", "Junior Secondary",
  "Senior Secondary", "High School", "University"
];
export const BOOK_CATEGORIES = [...EDUCATION_LEVELS, "General / Fiction", "Other"];
export const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];
export const RELATIONSHIPS = ["Mother", "Father", "Guardian"];

export const AVATAR_SEEDS = {
  scholar: "AMG-Scholar",
  reader: "AMG-Book-Lover",
  explorer: "AMG-Explorer",
  creative: "AMG-Creative-Learner",
  classic: "AMG-Classic-Portrait"
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_EBOOK_BYTES = 30 * 1024 * 1024;
export const LOAN_DAYS = 14;

export const safeText = (value) => String(value ?? "");

const KNOWN_ERRORS = {
  "auth/email-already-in-use": "That email is already registered. Log in instead.",
  "auth/invalid-credential": "The email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/weak-password": "Use a password with at least 8 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a while and try again.",
  "permission-denied": "Firebase denied this action. Check your deployed Firestore/Storage rules and account permissions.",
  "storage/unauthorized": "Upload denied. Check the Storage rules and your permissions.",
  "unavailable": "The service is temporarily unavailable. Check your connection and try again."
};

export function errorMessage(error) {
  return KNOWN_ERRORS[error?.code] || error?.message || "Something went wrong. Please try again.";
}

export function dateMillis(value) {
  if (value?.toMillis) return value.toMillis();
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDate(value) {
  const millis = dateMillis(value);
  return millis ? new Date(millis).toLocaleDateString() : "—";
}

export function formatCardDate(value) {
  if (!value) return "Not set";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date).toUpperCase();
}

export function avatarUrl(seed) {
  return "https://api.dicebear.com/9.x/initials/svg?seed=" + encodeURIComponent(seed || "AMG Member");
}

export function avatarSeedUrl(choice) {
  const seed = AVATAR_SEEDS[choice] || AVATAR_SEEDS.scholar;
  return "https://api.dicebear.com/9.x/avataaars/svg?seed=" + encodeURIComponent(seed);
}

export function readingMinutes(body) {
  const words = safeText(body).trim() ? safeText(body).trim().split(/\s+/).filter(Boolean).length : 0;
  return Math.max(1, Math.ceil(words / 200));
}

export function safeFileName(name, fallback = "upload") {
  const cleaned = safeText(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || fallback;
}
