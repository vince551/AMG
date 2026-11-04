import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, sendPasswordResetEmail, updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  deleteDoc, query, where, orderBy, limit, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const state = { app:null, auth:null, db:null, storage:null, functions:null, user:null, profile:null, librarian:false, scanMemberCode:"",
  books:[], requests:[], members:[], loans:[], attendance:[], ebooks:[], announcements:[], events:[],
  capacity:100, scanner:null, scanStream:null, scanControls:null, scanBusy:false, lastScanValue:"", lastScanAt:0, bookCoverFile:null, bookCoverPreviewUrl:"", toastTimer:null };
const categories = {
  "PP / Pre-Primary":"PP", "Primary":"PRI", "Junior Secondary":"JSS",
  "Senior Secondary":"SSS", "High School":"HS", "University":"UNI",
  "General / Fiction":"GEN", "Other":"OTH"
};

function safeText(value) { return String(value ?? ""); }
function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined && text !== null) item.textContent = safeText(text);
  if (className) item.className = className;
  return item;
}
function setText(id, value) { if ($(id)) $(id).textContent = safeText(value); }
function showToast(message, type="success") {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = "toast " + type;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.add("hidden"), 5200);
}
function errorMessage(error) {
  const known = {
    "auth/email-already-in-use":"That email is already registered. Log in instead.",
    "auth/invalid-credential":"The email or password is incorrect.",
    "auth/invalid-email":"Enter a valid email address.",
    "auth/weak-password":"Use a password with at least 8 characters.",
    "auth/too-many-requests":"Too many attempts. Wait a while and try again.",
    "permission-denied":"Firebase denied this action. Check your deployed Firestore/Storage rules and account permissions.",
    "storage/unauthorized":"Upload denied. Check the Storage rules and your permissions.",
    "unavailable":"The service is temporarily unavailable. Check your connection and try again."
  };
  return known[error?.code] || error?.message || "Something went wrong. Please try again.";
}
function requireFirebase() {
  if (!state.auth || !state.db) {
    showToast("Firebase is not configured yet. Follow the setup steps in README.md.", "error");
    return false;
  }
  return true;
}
function isReady() { return Boolean(state.auth && state.db && state.storage); }

function init() {
  $("year").textContent = new Date().getFullYear();
  $("searchInput").addEventListener("input", renderBooks);
  $("categoryFilter").addEventListener("change", renderBooks);
  $("loginForm").addEventListener("submit", login);
  $("registerForm").addEventListener("submit", register);
  document.querySelectorAll("[data-password-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.passwordToggle);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-label", show ? "Hide password" : "Show password");
      button.setAttribute("aria-pressed", String(show));
    });
  });
  $("avatarChoice").addEventListener("change", updateAvatarPreview);
  $("bookForm").addEventListener("submit", registerBook);
  $("bookCoverGalleryInput").addEventListener("change",event=>handleBookCoverSelection(event.currentTarget));
  $("bookCoverCameraInput").addEventListener("change",event=>handleBookCoverSelection(event.currentTarget));
  $("removeBookCoverBtn").addEventListener("click",clearBookCoverSelection);
  $("attendanceForm").addEventListener("submit", recordAttendance);
  $("capacityForm").addEventListener("submit", updateCapacity);
  $("ebookForm").addEventListener("submit", uploadEbook);
  $("newsForm").addEventListener("submit", publishNews);
  $("profilePhotoInput").addEventListener("change", updatePhoto);
  $("startScannerBtn").addEventListener("click", startScanner);
  $("stopScannerBtn").addEventListener("click", stopScanner);
  $("authModal").addEventListener("click", (event) => { if (event.target === $("authModal")) closeAuthModal(); });
  $("cardModal").addEventListener("click", (event) => { if (event.target === $("cardModal")) closeCardModal(); });
  document.addEventListener("click", (event) => {
    const header = document.querySelector(".navbar");
    if (!header) return;
    // Preserve the original click path: toggleMobileNav updates the button label,
    // so event.target may be detached before this document listener runs.
    const mobileToggle = header.querySelector(".mobile-nav-toggle");
    if (mobileToggle && event.composedPath().includes(mobileToggle)) return;
    if (!event.target.closest("#memberDropdown")) closeMemberDropdown();
    if (event.target.closest("#userBadge button")) closeMobileNav();
    if (!header.contains(event.target)) {
      closeMobileNav();
      closeMemberDropdown();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const mobileWasOpen = document.querySelector(".navbar")?.classList.contains("mobile-nav-open");
    const dropdownWasOpen = $("dropdownMenu")?.classList.contains("show");
    closeMobileNav();
    closeMemberDropdown();
    if (mobileWasOpen) document.querySelector(".mobile-nav-toggle")?.focus();
    else if (dropdownWasOpen) document.querySelector("#memberDropdown > button")?.focus();
  });
  renderBooks();
  renderAnnouncements([]);
  updateLiquidNav("heroSection");
  window.addEventListener("resize", () => updateLiquidNav());
  if (!isFirebaseConfigured()) {
    $("setupNotice").classList.remove("hidden");
    document.querySelectorAll("#authModal input, #bookForm input, #bookForm select, #attendanceForm input, #attendanceForm select, #ebookForm input, #newsForm input, #newsForm textarea").forEach(el => el.disabled = true);
    return;
  }
  try {
    state.app = initializeApp(firebaseConfig);
    state.auth = getAuth(state.app);
    state.db = getFirestore(state.app);
    state.storage = getStorage(state.app);
    state.functions = getFunctions(state.app);
    onAuthStateChanged(state.auth, async (user) => {
      state.user = user;
      state.profile = null;
      state.librarian = false;
      if (user) {
        try {
          const token = await user.getIdTokenResult(true);
          state.librarian = token.claims.librarian === true;
          const snap = await getDoc(doc(state.db, "users", user.uid));
          state.profile = snap.exists() ? snap.data() : null;
        } catch (error) { showToast(errorMessage(error), "error"); }
      }
      updateAuthUI();
      await refreshPublicData();

      // Route authenticated users to the workspace their verified account can access.
      // The librarian desk remains protected by the server-issued custom claim.
      if (user && state.librarian) {
        showSection("librarianSection");
      } else if (user && state.profile) {
        showSection("profileSection");
      } else if (user && user.email &&
        user.email.toLowerCase() === String(firebaseConfig.librarianEmail || "").trim().toLowerCase()) {
        showToast("You are signed in, but librarian permissions have not been assigned yet. The librarian account needs the secure librarian claim before the desk can open.", "error");
      }
    });
  } catch (error) {
    $("setupNotice").classList.remove("hidden");
    showToast("Firebase initialization failed: " + errorMessage(error), "error");
  }
}

async function refreshPublicData() {
  if (!isReady()) return;
  try {
    const [booksSnap, newsSnap, eventsSnap] = await Promise.all([
      getDocs(query(collection(state.db,"books"), orderBy("title"))),
      getDocs(query(collection(state.db,"announcements"), orderBy("createdAt","desc"), limit(20))),
      getDocs(query(collection(state.db,"events"), orderBy("createdAt","desc"), limit(20)))
    ]);
    state.books = booksSnap.docs.map(d => ({id:d.id,...d.data()}));
    state.announcements = newsSnap.docs.map(d => ({id:d.id,...d.data()}));
    state.events = eventsSnap.docs.map(d => ({id:d.id,...d.data()}));
    if (state.user) {
      const ebookSnap = await getDocs(query(collection(state.db,"ebooks"), orderBy("createdAt","desc"), limit(100)));
      state.ebooks = ebookSnap.docs.map(d => ({id:d.id,...d.data()}));
    } else {
      state.ebooks = [];
    }
    renderBooks();
    renderPublicEbooks();
    const publicPosts = [
      ...state.announcements.map(item=>({...item,announcementKind:"Announcement"})),
      ...state.events.map(item=>({...item,announcementKind:"Event"}))
    ].sort((a,b) => dateMillis(b.date||b.createdAt)-dateMillis(a.date||a.createdAt));
    renderAnnouncements(publicPosts);
  } catch (error) {
    // Empty collections may not have documents; permission errors are still surfaced.
    if (error.code !== "permission-denied") showToast(errorMessage(error), "error");
  }
}
function dateMillis(value) {
  if (value?.toMillis) return value.toMillis();
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}
function updateAuthUI() {
  const signedIn = Boolean(state.user);
  $("memberDropdown").classList.toggle("hidden", signedIn);
  $("userBadge").classList.toggle("hidden", !signedIn);
  $("navProfileBtn").classList.toggle("hidden", !signedIn || !state.profile);
  $("navLibrarianBtn").classList.toggle("hidden", !state.librarian);
  setText("navUserName", state.profile?.fullName || state.user?.email || "Member");
  $("pendingApprovalNotice").classList.toggle("hidden", !signedIn || !state.profile || state.profile.isApproved || state.profile.membershipStatus === "Denied");
  $("membershipDecisionNotice")?.classList.toggle("hidden", !signedIn || state.profile?.membershipStatus !== "Denied");
  if (state.profile) renderProfileCard(state.profile);
  if (state.librarian) setText("librarianHeading", "Librarian Desk — " + (state.profile?.fullName || state.user.email));
}
function showSection(sectionId) {
  const section = $(sectionId);
  if (!section) return;
  if (sectionId === "profileSection" && !state.user) { closeMobileNav(); closeMemberDropdown(); openAuthModal("login"); showToast("Log in to view your profile.", "error"); return; }
  if (sectionId === "librarianSection" && !state.librarian) { closeMobileNav(); closeMemberDropdown(); showToast("Librarian access requires an authorized Firebase account.", "error"); openAuthModal("login"); return; }
  document.querySelectorAll(".section").forEach(el => el.classList.remove("active"));
  section.classList.add("active");
  if (sectionId === "profileSection") refreshMemberData();
  if (sectionId === "librarianSection") refreshAdminData();
  updateLiquidNav(sectionId);
  closeMobileNav();
  closeMemberDropdown();
  window.scrollTo({top:0,behavior:"smooth"});
}
function closeMemberDropdown() {
  const menu = $("dropdownMenu");
  const trigger = document.querySelector("#memberDropdown > button");
  menu?.classList.remove("show");
  trigger?.setAttribute("aria-expanded", "false");
}
function toggleDropdown() {
  const menu = $("dropdownMenu");
  const trigger = document.querySelector("#memberDropdown > button");
  if (!menu) return;
  const open = menu.classList.toggle("show");
  trigger?.setAttribute("aria-expanded", String(open));
}
function openAuthModal(mode="login") {
  closeMobileNav();
  closeMemberDropdown();
  $("authModal").style.display = "flex";
  setAuthMode(mode);
  $("dropdownMenu").classList.remove("show");
}
function closeAuthModal() { $("authModal").style.display = "none"; }
function setAuthMode(mode) {
  const registerMode = mode === "register";
  $("loginForm").classList.toggle("hidden", registerMode);
  $("registerForm").classList.toggle("hidden", !registerMode);
  $("loginModeBtn").classList.toggle("active", !registerMode);
  $("registerModeBtn").classList.toggle("active", registerMode);
  setText("authTitle", registerMode ? "Register as an AMG Library Member" : "Member Log In");
  if (registerMode) setRegistrationStep(1);
}
async function login(event) {
  event.preventDefault();
  if (!requireFirebase()) return;
  const form = new FormData(event.currentTarget);
  const loginName = String(form.get("loginName") || "").trim();
  const password = String(form.get("password") || "");
  const isLibrarianLogin = loginName.toLowerCase() === "librarian";
  const email = isLibrarianLogin
    ? String(firebaseConfig.librarianEmail || "").trim()
    : (loginName.includes("@") ? loginName : "");
  if (!email || email.startsWith("REPLACE_")) {
    showToast(isLibrarianLogin
      ? "Librarian login is not configured yet. Set librarianEmail in firebase-config.js to the authorized Firebase account email."
      : "Member full-name login needs a secure username mapping service. Until it is configured, enter the email address linked to your account.", "error");
    return;
  }
  try {
    await signInWithEmailAndPassword(state.auth, email, password);
    closeAuthModal();
    showToast("Login successful.");
  } catch (error) { showToast(errorMessage(error), "error"); }
}
function setRegistrationStep(step) {
  const current = step === 2 ? 2 : 1;
  const first = $("registrationStepOne"), second = $("registrationStepTwo");
  if (!first || !second) return;
  first.classList.toggle("hidden", current !== 1);
  second.classList.toggle("hidden", current !== 2);
  first.setAttribute("aria-hidden", current === 1 ? "false" : "true");
  second.setAttribute("aria-hidden", current === 2 ? "false" : "true");
  first.querySelectorAll("input,select,textarea").forEach(el => {
    if (!("stepRequired" in el.dataset)) el.dataset.stepRequired = el.required ? "true" : "false";
    el.required = current === 1 && el.dataset.stepRequired === "true";
    el.disabled = false;
  });
  second.querySelectorAll("input,select,textarea").forEach(el => {
    if (!("stepRequired" in el.dataset)) el.dataset.stepRequired = el.required ? "true" : "false";
    el.required = current === 2 && el.dataset.stepRequired === "true";
    el.disabled = false;
  });
}
function nextRegistrationStep() {
  const first = $("registrationStepOne");
  if (!first) return;
  for (const field of first.querySelectorAll("input,select")) {
    if (field.required && !field.checkValidity()) { field.reportValidity(); field.focus(); return; }
  }
  setRegistrationStep(2);
  $("registrationStepTwo").querySelector("input,select")?.focus();
}
function previousRegistrationStep() { setRegistrationStep(1); }
function updateAvatarPreview() {
  const choice = $("avatarChoice")?.value || "scholar";
  const seeds = {scholar:"AMG-Scholar",reader:"AMG-Book-Lover",explorer:"AMG-Explorer",creative:"AMG-Creative-Learner",classic:"AMG-Classic-Portrait"};
  const preview = $("avatarPreview");
  if (preview) preview.src = "https://api.dicebear.com/9.x/avataaars/svg?seed=" + encodeURIComponent(seeds[choice] || seeds.scholar);
  // Changing to an avatar explicitly replaces any camera photo selected earlier.
  const cameraInput = $("registrationStepTwo")?.querySelector('input[name="photo"]');
  if (cameraInput) cameraInput.value = "";
}
function validateRegistrationStepTwo() {
  const second = $("registrationStepTwo");
  if (!second) return true;
  for (const field of second.querySelectorAll("input,select")) {
    if (field.required && !field.disabled && !field.checkValidity()) { field.reportValidity(); field.focus(); return false; }
  }
  return true;
}
async function createLearnerProfileOnSpark(uid, email, profileInput) {
  const userRef = doc(state.db, "users", uid);
  for (let attempt = 0; attempt < 30; attempt++) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const libraryNumber = "AMG-" + String(100000 + (random[0] % 900000));
    const numberRef = doc(state.db, "memberNumbers", libraryNumber);
    const result = await runTransaction(state.db, async (transaction) => {
      const [existingProfile, reservedNumber] = await Promise.all([
        transaction.get(userRef), transaction.get(numberRef)
      ]);
      if (existingProfile.exists()) {
        const existing = existingProfile.data();
        if (existing.role !== "learner" || existing.email !== email) {
          throw new Error("This account already has a different library profile. Please contact the librarian.");
        }
        return { profile: existing, created: false };
      }
      if (reservedNumber.exists()) return null;
      const timestamp = serverTimestamp();
      const profile = {
        uid, ...profileInput, email, libraryNumber,
        role: "learner", isApproved: false, membershipStatus: "Pending",
        photoURL: "", starredBookIds: [],
        createdAt: timestamp, updatedAt: timestamp
      };
      transaction.set(numberRef, { uid, createdAt: timestamp });
      transaction.set(userRef, profile);
      return { profile: { ...profile, createdAt: new Date(), updatedAt: new Date() }, created: true };
    });
    if (result) return result;
  }
  throw new Error("A library number could not be allocated. Please try again.");
}

async function register(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  if (!requireFirebase() || !validateRegistrationStepTwo()) return;
  const form = new FormData(formElement);
  const fullName = String(form.get("fullName")).trim();
  const email = String(form.get("email")).trim().toLowerCase();
  const password = String(form.get("password"));
  const guardianPhone = String(form.get("guardianPhone")).trim();
  if (fullName.length < 2 || !guardianPhone || password.length < 8) {
    showToast("Complete all required fields and use a password of at least 8 characters.", "error"); return;
  }
  let credential;
  try {
    try {
      credential = await createUserWithEmailAndPassword(state.auth, email, password);
    } catch (authError) {
      // Recover accounts created by an earlier attempt that failed before Firestore.
      if (authError?.code !== "auth/email-already-in-use") throw authError;
      credential = await signInWithEmailAndPassword(state.auth, email, password);
    }
    await updateProfile(credential.user, {displayName:fullName});
    const profileInput = {
      fullName, gender:String(form.get("gender")), school:String(form.get("school")).trim(),
      studyLevel:String(form.get("studyLevel")).trim(), eduLevel:String(form.get("eduLevel")),
      guardianName:String(form.get("guardianName")).trim(), guardianRelation:String(form.get("guardianRelation")),
      guardianPhone
    };
    const created = await createLearnerProfileOnSpark(credential.user.uid, email, profileInput);
    state.profile = { ...created.profile };
    updateAuthUI();
    const photo = form.get("photo");
    const avatarChoice = String(form.get("avatarChoice") || "scholar");
    const seeds = {scholar:"AMG-Scholar",reader:"AMG-Book-Lover",explorer:"AMG-Explorer",creative:"AMG-Creative-Learner",classic:"AMG-Classic-Portrait"};
    let photoURL = state.profile.photoURL || ("https://api.dicebear.com/9.x/avataaars/svg?seed=" + encodeURIComponent(seeds[avatarChoice] || seeds.scholar));
    if (photo instanceof File && photo.size > 0) {
      if (!photo.type.startsWith("image/") || photo.size > 5*1024*1024) {
        showToast("Profile photo was skipped. Choose an image smaller than 5 MB.", "error");
      } else {
        try {
          const target = storageRef(state.storage, "member-photos/"+credential.user.uid+"/"+photo.name.replace(/[^a-zA-Z0-9._-]/g,"_"));
          await uploadBytes(target, photo, {contentType:photo.type});
          photoURL = await getDownloadURL(target);
        } catch (photoError) {
          // Photo storage is optional; Spark-plan registration must still complete.
          console.warn("Optional registration photo upload failed:", photoError?.code || "unknown");
        }
      }
    }
    if (photoURL !== state.profile.photoURL) {
      await updateDoc(doc(state.db,"users",credential.user.uid), {photoURL,updatedAt:serverTimestamp()});
      state.profile.photoURL = photoURL;
    }
    formElement.reset();
    setRegistrationStep(1);
    updateAvatarPreview();
    closeAuthModal();
    showToast(created.created ? "Registration submitted. Please wait for librarian approval." : "Your existing membership profile has been restored.");
    await refreshMemberData();
  } catch (error) {
    showToast("Registration could not be completed: "+errorMessage(error), "error");
  }
}
async function resetPassword() {
  if (!requireFirebase()) return;
  const loginName = $("loginForm").elements.loginName.value.trim();
  const email = loginName.toLowerCase() === "librarian" ? String(firebaseConfig.librarianEmail || "").trim() : loginName;
  if (!email || !email.includes("@") || email.startsWith("REPLACE_")) { showToast("Enter the account email address to reset the password.", "error"); return; }
  try { await sendPasswordResetEmail(state.auth,email); showToast("If an account exists for that email, a password reset email has been sent."); }
  catch (error) { showToast(errorMessage(error),"error"); }
}
async function logout() {
  if (!state.auth) return;
  try { await stopScanner(); await signOut(state.auth); showSection("heroSection"); showToast("You have logged out."); }
  catch (error) { showToast(errorMessage(error),"error"); }
}
function initialsCategory(category) { return categories[category] || "OTH"; }
function makeBarcode(value, svgId) {
  const svg = $(svgId);
  if (!svg || !window.JsBarcode) return;
  try { window.JsBarcode(svg, value, {format:"CODE128",displayValue:false,margin:0,height:38,width:1.35,background:"#ffffff",lineColor:"#111827"}); }
  catch (_) { svg.textContent = value; }
}
function makeQr(value, containerId) {
  const target = $(containerId);
  if (!target) return;
  target.replaceChildren();
  if (window.QRCode) new window.QRCode(target,{text:value,width:68,height:68,colorDark:"#111827",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
}
async function updatePhoto(event) {
  const inputElement = event.currentTarget;
  const photo = inputElement.files?.[0];
  if (!photo) return;
  if (!state.user || !state.profile || !state.storage || !state.db) {
    showToast("Log in before updating your profile photo.", "error");
    inputElement.value = "";
    return;
  }
  if (!photo.type.startsWith("image/") || photo.size > 5*1024*1024) {
    showToast("Choose an image smaller than 5 MB.", "error");
    inputElement.value = "";
    return;
  }
  try {
    const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "profile-photo";
    const target = storageRef(state.storage, "member-photos/" + state.user.uid + "/" + Date.now() + "-" + safeName);
    await uploadBytes(target, photo, {contentType:photo.type});
    const photoURL = await getDownloadURL(target);
    await updateDoc(doc(state.db, "users", state.user.uid), {photoURL, updatedAt:serverTimestamp()});
    state.profile.photoURL = photoURL;
    renderProfileCard(state.profile);
    updateAuthUI();
    showToast("Profile photo updated.");
  } catch (error) {
    showToast("Photo could not be updated: " + errorMessage(error), "error");
  } finally {
    inputElement.value = "";
  }
}
function formatCardDate(value) {
  if (!value) return "Not set";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric"}).format(date).toUpperCase();
}
function renderProfileCard(profile) {
  setText("cardFullName",profile.fullName);
  setText("cardSchool",profile.school || "—");
  setText("cardStudyLevel",profile.studyLevel || "—");
  setText("cardEduLevel",profile.eduLevel || "Learner");
  setText("cardLibraryNum",profile.libraryNumber);
  setText("cardIssueDate",formatCardDate(profile.approvedAt || profile.decisionAt));
  setText("cardBackNumber",profile.libraryNumber);
  $("cardImage").src = profile.photoURL || avatarUrl(profile.libraryNumber);
  makeBarcode(profile.libraryNumber,"memberBarcode");
  makeBarcode(profile.libraryNumber,"memberBackBarcode");
  makeQr(profile.libraryNumber,"memberQr");
}
function avatarUrl(seed) { return "https://api.dicebear.com/9.x/initials/svg?seed="+encodeURIComponent(seed||"AMG Member"); }
async function downloadCard(elementId) {
  const target = $(elementId);
  if (!target || !window.html2canvas) { showToast("Card download library has not loaded. Refresh and try again.","error"); return; }
  try {
    const canvas = await window.html2canvas(target,{backgroundColor:"#ffffff",scale:2,useCORS:true});
    const link = document.createElement("a");
    link.download = "AMG-Library-"+safeText(state.profile?.libraryNumber||"Member")+".png";
    link.href = canvas.toDataURL("image/png"); link.click();
  } catch (error) { showToast("Could not download the card. Check that the photo is accessible and try again.","error"); }
}
function closeCardModal() { $("cardModal").style.display = "none"; }
function closeMobileNav() {
  const header = document.querySelector(".navbar");
  const toggle = document.querySelector(".mobile-nav-toggle");
  if (!header || !toggle) return;
  header.classList.remove("mobile-nav-open");
  toggle.setAttribute("aria-expanded", "false");
  toggle.textContent = "Menu";
}
function toggleMobileNav() {
  const header = document.querySelector(".navbar");
  const toggle = document.querySelector(".mobile-nav-toggle");
  if (!header || !toggle) return;
  const open = !header.classList.contains("mobile-nav-open");
  if (open) {
    header.classList.add("mobile-nav-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.textContent = "Close";
    requestAnimationFrame(() => updateLiquidNav());
  } else {
    closeMobileNav();
  }
}
function updateLiquidNav(sectionId) {
  const nav = $("mainNavLinks");
  if (!nav) return;
  const buttons = [...nav.querySelectorAll(".nav-btn[data-section]")];
  const target = buttons.find(button => button.dataset.section === sectionId)
    || buttons.find(button => button.classList.contains("active") && !button.classList.contains("hidden"))
    || buttons.find(button => !button.classList.contains("hidden"));
  buttons.forEach(button => {
    const active = button === target;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const indicator = nav.querySelector(".liquid-nav-indicator");
  if (!target || !indicator || nav.getClientRects().length === 0) return;
  const navRect = nav.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const x = targetRect.left - navRect.left - nav.clientLeft + nav.scrollLeft;
  const y = targetRect.top - navRect.top - nav.clientTop + nav.scrollTop;
  indicator.style.setProperty("--liquid-x", x + "px");
  indicator.style.setProperty("--liquid-y", y + "px");
  indicator.style.setProperty("--liquid-width", targetRect.width + "px");
  indicator.style.setProperty("--liquid-height", targetRect.height + "px");
  nav.dataset.liquidReady = "true";
  indicator.classList.remove("liquid-bounce");
  requestAnimationFrame(() => indicator.classList.add("liquid-bounce"));
}
function switchTab(tabId, button) {
  const librarianSection = $("librarianSection");
  const target = $(tabId);

  // Validate the destination before changing visibility so a bad ID can
  // never leave the entire librarian workspace blank.
  if (!librarianSection || !target ||
      !librarianSection.contains(target) ||
      !target.classList.contains("tab-content")) {
    showToast("That librarian section could not be opened. Please choose another section.", "error");
    return false;
  }

  librarianSection.querySelectorAll(".tab-content").forEach(panel => {
    panel.classList.remove("active");
  });
  librarianSection.querySelectorAll(".admin-tabs .tab-btn").forEach(tabButton => {
    tabButton.classList.toggle("active", tabButton.dataset.tabTarget === tabId);
  });

  // Keep compatibility with callers that explicitly pass a tab button,
  // but never mark dashboard shortcut buttons as the selected tab.
  if (button?.matches?.("#librarianSection .admin-tabs .tab-btn")) {
    button.classList.add("active");
  }

  target.classList.add("active");

  const mobilePicker = $("adminMobileTabSelect");
  if (mobilePicker && mobilePicker.value !== tabId) {
    mobilePicker.value = tabId;
  }
  return true;
}
function starredIds() {
  try { return JSON.parse(localStorage.getItem("amg_starred_"+(state.user?.uid||"guest"))||"[]"); } catch (_) { return []; }
}
function toggleStar(bookId) {
  const ids = starredIds();
  const next = ids.includes(bookId) ? ids.filter(id=>id!==bookId) : [...ids,bookId];
  localStorage.setItem("amg_starred_"+(state.user?.uid||"guest"),JSON.stringify(next));
  renderBooks();
}
function renderFeaturedBooks() {
  const container = $("homeFeaturedBooks");
  if (!container) return;
  container.replaceChildren();
  const books = state.books.slice(0, 4);
  const catalogueCounter = document.querySelector('[data-amg-count="books"]');
  if (catalogueCounter) catalogueCounter.dataset.countTarget = String(state.books.length);
  if (!books.length) {
    const message = node("p", "The featured collection will appear here when books are available in the library catalogue.", "featured-empty");
    const action = node("button", "Explore the Lib Shelf →", "btn btn-outline featured-empty-action");
    action.type = "button";
    action.addEventListener("click", () => showSection("libShelfSection"));
    container.append(message, action);
    return;
  }
  books.forEach(book => {
    const card = node("article", null, "featured-book-card");
    const cover = node("div", null, "featured-book-cover");
    if (book.coverUrl) {
      const image = node("img");
      image.src = book.coverUrl;
      image.alt = "Cover of " + (book.title || "book");
      image.loading = "lazy";
      cover.append(image);
    } else {
      cover.append(node("span", book.icon || "BOOK", "featured-cover-placeholder"));
    }
    const details = node("div", null, "featured-book-details");
    details.append(
      node("span", book.category || "Library collection", "featured-book-category"),
      node("h3", book.title || "Untitled book"),
      node("p", "by " + (book.author || "Unknown author"), "featured-book-author")
    );
    const available = Math.max(0, Number(book.available || 0));
    details.append(node("span", available > 0 ? "Available to request" : "Currently unavailable", "featured-availability" + (available > 0 ? " is-available" : "")));
    const action = node("button", "View in catalogue →", "featured-book-link");
    action.type = "button";
    action.addEventListener("click", () => showSection("libShelfSection"));
    details.append(action);
    card.append(cover, details);
    container.append(card);
  });
}
function renderBooks() {
  renderFeaturedBooks();
  const grid = $("bookGrid");
  if (!grid) return;
  const search = ($("searchInput")?.value||"").trim().toLowerCase();
  const category = $("categoryFilter")?.value||"All";
  const stars = starredIds();
  const books = state.books.filter(book => {
    const text = [book.title,book.author,book.category,book.description].join(" ").toLowerCase();
    return (!search || text.includes(search)) && (category==="All" || category==="Starred" || book.category===category) && (category!=="Starred" || stars.includes(book.id));
  });
  grid.replaceChildren();
  if (!books.length) { grid.append(node("div",state.books.length?"No books match your search.":"The library catalogue is empty. The librarian can register books from the Librarian Desk.","empty-state")); return; }
  for (const book of books) {
    const card = node("article",null,"book-card");
    const cover = node("div",null,"book-cover");
    if (book.coverUrl) { const image=node("img"); image.src=book.coverUrl; image.alt="Cover of "+book.title; image.loading="lazy"; cover.append(image); }
    else cover.append(node("span",book.icon||"BOOK"));
    const star=node("button",stars.includes(book.id)?"★":"☆","star-btn");
    star.type="button"; star.setAttribute("aria-label",stars.includes(book.id)?"Remove from starred books":"Star book");
    star.addEventListener("click",()=>toggleStar(book.id)); cover.append(star);
    const details=node("div",null,"book-details");
    details.append(node("h3",book.title,"book-title"),node("p","by "+(book.author||"Unknown author"),"book-author"),node("span",book.category||"Other","book-category"));
    details.append(node("p",book.description||"","book-description"));
    details.append(node("p",Math.max(0,Number(book.available||0))+" available of "+Math.max(0,Number(book.quantity||0)),"book-stock"));
    const actions=node("div",null,"book-actions");
    const borrow=node("button","Borrow","btn btn-primary");
    borrow.addEventListener("click",()=>requestBook(book.id));
    borrow.disabled=!state.user || !state.profile?.isApproved || Number(book.available||0)<1;
    borrow.title=!state.user?"Log in to request a book":!state.profile?.isApproved?"Await librarian approval":"Request this book";
    actions.append(borrow);
    if (book.ebookUrl) { const ebook=node("a","E-book","btn btn-outline"); ebook.href=book.ebookUrl; ebook.target="_blank"; ebook.rel="noopener noreferrer"; actions.append(ebook); }
    details.append(actions); card.append(cover,details); grid.append(card);
  }
}
async function requestBook(bookId) {
  if (!state.user || !state.profile) { openAuthModal("login"); showToast("Log in to request a book.","error"); return; }
  if (!state.profile.isApproved) { showToast("Your membership must be approved before borrowing.","error"); return; }
  const book=state.books.find(item=>item.id===bookId);
  if (!book || Number(book.available||0)<1) { showToast("This book is currently unavailable.","error"); return; }
  try {
    const existing=await getDocs(query(collection(state.db,"borrowRequests"),where("userId","==",state.user.uid),where("bookId","==",bookId),where("status","==","Pending")));
    if (!existing.empty) { showToast("You already have a pending request for this book.","error"); return; }
    await addDoc(collection(state.db,"borrowRequests"),{
      userId:state.user.uid,userName:state.profile.fullName,bookId,bookTitle:book.title,
      bookCategory:book.category||"Other",status:"Pending",createdAt:serverTimestamp()
    });
    showToast("Borrow request sent to the librarian.");
    await refreshMemberData();
  } catch(error) { showToast(errorMessage(error),"error"); }
}
async function refreshMemberData() {
  if (!state.user || !state.profile || !state.db) return;
  try {
    const [requestSnap,loanSnap] = await Promise.all([
      getDocs(query(collection(state.db,"borrowRequests"),where("userId","==",state.user.uid))),
      getDocs(query(collection(state.db,"loans"),where("userId","==",state.user.uid)))
    ]);
    const requests=requestSnap.docs.map(d=>({id:d.id,...d.data()}));
    const loans=loanSnap.docs.map(d=>({id:d.id,...d.data()}));
    renderMemberRequests(requests,loans);
    setStats("learnerStats",[
      ["Requests",requests.length],["Approved",requests.filter(r=>r.status==="Approved").length],
      ["Active loans",loans.filter(l=>l.status==="Borrowed").length],["Returned",loans.filter(l=>l.status==="Returned").length]
    ]);
    renderProfileCard(state.profile);
  } catch(error) { showToast(errorMessage(error),"error"); }
}
function renderMemberRequests(requests,loans) {
  const container=$("myLoansList"); container.replaceChildren();
  const items=[...requests.map(r=>({...r,kind:"Request"})),...loans.map(l=>({...l,kind:"Loan"}))].sort((a,b)=>dateMillis(b.createdAt)-dateMillis(a.createdAt));
  if (!items.length) { container.append(node("p","No requests or loans yet.","muted")); return; }
  items.forEach(item=>{
    const card=node("div",null,"stack-item");
    card.append(node("h4",item.bookTitle||"Library book"),node("p",item.kind+" · "+(item.status||"Pending")));
    if (item.dueAt) card.append(node("p","Due: "+formatDate(item.dueAt)));
    container.append(card);
  });
}
function formatDate(value) {
  const millis=dateMillis(value);
  return millis ? new Date(millis).toLocaleDateString() : "—";
}
async function refreshAdminData() {
  if (!state.librarian || !state.db) return;
  try {
    const [users,requests,loans,attendance,ebooks,news,events,settings] = await Promise.all([
      getDocs(query(collection(state.db,"users"),orderBy("createdAt","desc"),limit(1000))),
      getDocs(query(collection(state.db,"borrowRequests"),orderBy("createdAt","desc"),limit(1000))),
      getDocs(query(collection(state.db,"loans"),orderBy("createdAt","desc"),limit(1000))),
      getDocs(query(collection(state.db,"attendance"),orderBy("checkInAt","desc"),limit(500))),
      getDocs(query(collection(state.db,"ebooks"),orderBy("createdAt","desc"),limit(200))),
      getDocs(query(collection(state.db,"announcements"),orderBy("createdAt","desc"),limit(100))),
      getDocs(query(collection(state.db,"events"),orderBy("createdAt","desc"),limit(100))),
      getDoc(doc(state.db,"settings","library"))
    ]);
    state.members=users.docs.map(d=>({id:d.id,...d.data()}));
    state.requests=requests.docs.map(d=>({id:d.id,...d.data()}));
    state.loans=loans.docs.map(d=>({id:d.id,...d.data()}));
    state.attendance=attendance.docs.map(d=>({id:d.id,...d.data()}));
    state.ebooks=ebooks.docs.map(d=>({id:d.id,...d.data()}));
    state.announcements=news.docs.map(d=>({id:d.id,...d.data()}));
    state.events=events.docs.map(d=>({id:d.id,...d.data()}));
    state.capacity=settings.exists()?Number(settings.data().capacity||100):100;
    renderAdminTables(); renderInventory(); renderAttendance(); renderEbooks(); renderAdminNews(); renderStatistics();
  } catch(error) { showToast(errorMessage(error),"error"); }
}
function addCell(row,text) { row.append(node("td",text)); }
function addAction(row,label,handler,className="btn btn-sm btn-outline") {
  const td=node("td"); const button=node("button",label,className); button.type="button"; button.addEventListener("click",handler); td.append(button); row.append(td);
}
function renderDashboardOverview() {
  const date = $("adminWelcomeDate");
  if (date) date.textContent = new Intl.DateTimeFormat("en-KE", {weekday:"long", day:"numeric", month:"long", year:"numeric"}).format(new Date());
  const inside = state.attendance.filter(item => item.status === "In library").length;
  const capacity = Math.max(1, Number(state.capacity) || 100);
  setText("dashboardOccupancyCount", inside);
  setText("dashboardOccupancyCapacity", "of " + capacity + " places used");
  const bar = $("dashboardOccupancyBar");
  if (bar) {
    bar.style.width = Math.min(100, Math.round(inside / capacity * 100)) + "%";
    bar.classList.toggle("at-capacity", inside >= capacity);
  }
  const list = $("adminPriorityList");
  if (!list) return;
  list.replaceChildren();
  const pendingRequests = state.requests.filter(item => item.status === "Pending").length;
  const pendingMembers = state.members.filter(item => !item.isApproved && item.membershipStatus !== "Denied").length;
  const lowStock = state.books.filter(book => Number(book.available || 0) <= 1).length;
  const priorities = [
    {icon:"↗", title:"Borrow requests", detail:"Requests waiting for a decision", count:pendingRequests, tab:"borrowRequestsTab", tone:"blue"},
    {icon:"✓", title:"Learner approvals", detail:"Membership applications to review", count:pendingMembers, tab:"pendingLearnersTab", tone:"green"},
    {icon:"▤", title:"Low-stock titles", detail:"Books with one or fewer copies available", count:lowStock, tab:"booksAdminTab", tone:"amber"}
  ];
  priorities.forEach(item => {
    const row = node("div", null, "admin-priority-row");
    const icon = node("span", item.icon, "priority-icon priority-" + item.tone);
    const copy = node("span", null, "priority-copy");
    copy.append(node("b", item.title), node("small", item.detail));
    const count = node("span", item.count, "priority-count" + (item.count ? " has-work" : ""));
    const action = node("button", "Open →", "priority-open");
    action.type = "button";
    action.addEventListener("click", () => {
      const tabButton = document.querySelector('#librarianSection .admin-tabs .tab-btn[onclick*="' + item.tab + '"]');
      switchTab(item.tab, tabButton || null);
    });
    row.append(icon, copy, count, action);
    list.append(row);
  });
}
function renderAdminTables() {
  const reqTable=$("borrowRequestsTable"); reqTable.replaceChildren();
  state.requests.forEach(req=>{
    const row=node("tr"); addCell(row,req.userName); addCell(row,req.bookTitle); addCell(row,req.bookCategory); addCell(row,req.status);
    const td=node("td");
    if(req.status==="Pending") {
      const accept=node("button","Accept","btn btn-sm btn-success"); accept.addEventListener("click",()=>processRequest(req.id,"Approved")); td.append(accept);
      const decline=node("button","Decline","btn btn-sm btn-danger"); decline.addEventListener("click",()=>processRequest(req.id,"Declined")); td.append(decline);
    } else if(req.status==="Approved" && req.loanId) {
      const loan=state.loans.find(item=>item.id===req.loanId);
      if(loan && loan.status==="Borrowed") { const ret=node("button","Return book","btn btn-sm btn-outline"); ret.addEventListener("click",()=>returnLoan(req.id,req.loanId)); td.append(ret); }
      else td.textContent="Processed";
    } else td.textContent="Processed";
    row.append(td); reqTable.append(row);
  });
  const pending=$("pendingLearnersTable"); pending.replaceChildren();
  state.members.filter(m=>!m.isApproved && m.membershipStatus!=="Denied").forEach(member=>{
    const row=node("tr"); addCell(row,member.fullName); addCell(row,member.school); addCell(row,member.eduLevel); addCell(row,(member.guardianName||"")+" · "+(member.guardianPhone||""));
    const actions=node("td");
    const approve=node("button","Approve","btn btn-sm btn-success"); approve.type="button"; approve.addEventListener("click",()=>reviewLearner(member.uid,"Approved"));
    const deny=node("button","Deny","btn btn-sm btn-danger"); deny.type="button"; deny.addEventListener("click",()=>reviewLearner(member.uid,"Denied"));
    actions.append(approve,deny); row.append(actions); pending.append(row);
  });
  const all=$("allLearnersTable"); all.replaceChildren();
  state.members.forEach(member=>{
    const row=node("tr"); addCell(row,member.libraryNumber); addCell(row,member.fullName); addCell(row,(member.school||"")+" / "+(member.eduLevel||"")); addCell(row,member.isApproved?"Approved":member.membershipStatus==="Denied"?"Denied":"Pending");
    addAction(row,"View / download card",()=>viewMemberCard(member)); all.append(row);
  });
  setStats("adminStats",[["Members",state.members.length],["Awaiting approval",state.members.filter(m=>!m.isApproved && m.membershipStatus!=="Denied").length],["Book titles",state.books.length],["Pending requests",state.requests.filter(r=>r.status==="Pending").length],["Currently in library",state.attendance.filter(a=>a.status==="In library").length],["Available copies",state.books.reduce((n,b)=>n+Number(b.available||0),0)]]);
  renderDashboardOverview();
}
async function reviewLearner(uid,decision) {
  if(!state.librarian || !["Approved","Denied"].includes(decision)) return;
  const member=state.members.find(item=>item.uid===uid);
  const action=decision==="Approved"?"approve":"deny";
  if(!member || !confirm("Are you sure you want to "+action+" "+member.fullName+"'s membership?")) return;
  try {
    // Membership decisions are performed by the callable Admin SDK function.
    // This keeps approval writes out of the browser and enforces the librarian
    // custom claim on the server, even if deployed Firestore rules are stale.
    const reviewMembership=httpsCallable(state.functions,"reviewLearnerMembership");
    const result=await reviewMembership({uid,decision});
    showToast(result.data?.message || "Membership "+decision.toLowerCase()+" successfully.");
    await refreshAdminData();
  } catch(error) {
    console.error("Membership review failed:",error?.code || error?.message || error);
    showToast(errorMessage(error),"error");
  }
}
async function processRequest(requestId,status) {
  if(!state.librarian) return;
  const req=state.requests.find(r=>r.id===requestId); if(!req) return;
  try {
    if(status==="Declined") {
      await updateDoc(doc(state.db,"borrowRequests",requestId),{status:"Declined",processedAt:serverTimestamp(),processedBy:state.user.uid});
    } else {
      const loanRef=doc(collection(state.db,"loans"));
      await runTransaction(state.db,async transaction=>{
        const requestRef=doc(state.db,"borrowRequests",requestId);
        const bookRef=doc(state.db,"books",req.bookId);
        const [requestSnap,bookSnap]=await Promise.all([transaction.get(requestRef),transaction.get(bookRef)]);
        if(!requestSnap.exists()||!bookSnap.exists()) throw new Error("Request or book no longer exists.");
        const currentRequest=requestSnap.data(), book=bookSnap.data();
        if(currentRequest.status!=="Pending") throw new Error("This request has already been processed.");
        if(Number(book.available||0)<1) throw new Error("No copies of this book are available.");
        const dueDate=new Date(); dueDate.setDate(dueDate.getDate()+14);
        transaction.update(bookRef,{available:Number(book.available)-1,updatedAt:serverTimestamp()});
        transaction.set(loanRef,{userId:currentRequest.userId,userName:currentRequest.userName,bookId:currentRequest.bookId,bookTitle:currentRequest.bookTitle,bookCategory:currentRequest.bookCategory,status:"Borrowed",borrowedAt:serverTimestamp(),dueAt:dueDate.toISOString(),createdAt:serverTimestamp(),issuedBy:state.user.uid});
        transaction.update(requestRef,{status:"Approved",loanId:loanRef.id,processedAt:serverTimestamp(),processedBy:state.user.uid});
      });
    }
    showToast(status==="Approved"?"Request approved and book issued.":"Request declined.");
    await refreshPublicData(); await refreshAdminData();
  } catch(error) { showToast(errorMessage(error),"error"); }
}
async function returnLoan(requestId,loanId) {
  if(!state.librarian) return;
  try {
    await runTransaction(state.db,async transaction=>{
      const loanRef=doc(state.db,"loans",loanId);
      const loanSnap=await transaction.get(loanRef);
      if(!loanSnap.exists()||loanSnap.data().status!=="Borrowed") throw new Error("This loan is already returned or unavailable.");
      const bookRef=doc(state.db,"books",loanSnap.data().bookId);
      const bookSnap=await transaction.get(bookRef);
      if(!bookSnap.exists()) throw new Error("The book record is missing.");
      transaction.update(bookRef,{available:Number(bookSnap.data().available||0)+1,updatedAt:serverTimestamp()});
      transaction.update(loanRef,{status:"Returned",returnedAt:serverTimestamp(),returnedBy:state.user.uid});
      transaction.update(doc(state.db,"borrowRequests",requestId),{status:"Returned",returnedAt:serverTimestamp()});
    });
    showToast("Book return recorded."); await refreshPublicData(); await refreshAdminData();
  } catch(error) { showToast(errorMessage(error),"error"); }
}
function viewMemberCard(member) {
  setText("adminCardName",member.fullName); setText("adminCardSchool",member.school || "—"); setText("adminCardStudy",member.studyLevel || "—"); setText("adminCardLevel",member.eduLevel || "Learner"); setText("adminCardNumber",member.libraryNumber);
  setText("adminCardIssueDate",formatCardDate(member.approvedAt || member.decisionAt));
  setText("adminCardBackNumber",member.libraryNumber);
  $("adminCardImage").src=member.photoURL||avatarUrl(member.libraryNumber);
  makeBarcode(member.libraryNumber,"adminMemberBarcode"); makeBarcode(member.libraryNumber,"adminMemberBackBarcode"); makeQr(member.libraryNumber,"adminMemberQr");
  $("cardModal").style.display="flex";
}
function clearBookCoverSelection() {
  state.bookCoverFile = null;
  if (state.bookCoverPreviewUrl) URL.revokeObjectURL(state.bookCoverPreviewUrl);
  state.bookCoverPreviewUrl = "";
  ["bookCoverGalleryInput","bookCoverCameraInput"].forEach(id=>{ if($(id)) $(id).value=""; });
  if ($("bookCoverPreview")) $("bookCoverPreview").removeAttribute("src");
  $("bookCoverPreviewWrap")?.classList.add("hidden");
  setText("bookCoverFileName","Selected cover");
}
function handleBookCoverSelection(inputElement) {
  const file = inputElement.files?.[0];
  if (!file) return;
  const allowed = ["image/jpeg","image/png","image/webp"];
  if (!allowed.includes(file.type)) {
    inputElement.value = "";
    showToast("Choose a JPEG, PNG or WebP image for the book cover.","error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    inputElement.value = "";
    showToast("Book cover images must be 5 MB or smaller.","error");
    return;
  }
  state.bookCoverFile = file;
  ["bookCoverGalleryInput","bookCoverCameraInput"].forEach(id=>{ if($(id) && $(id)!==inputElement) $(id).value=""; });
  if (state.bookCoverPreviewUrl) URL.revokeObjectURL(state.bookCoverPreviewUrl);
  state.bookCoverPreviewUrl = URL.createObjectURL(file);
  $("bookCoverPreview").src = state.bookCoverPreviewUrl;
  setText("bookCoverFileName",file.name || "Camera photo");
  $("bookCoverPreviewWrap").classList.remove("hidden");
}
async function registerBook(event) {
  event.preventDefault(); if(!state.librarian) return;
  const formElement = event.currentTarget;
  const form=new FormData(formElement);
  const coverFile = state.bookCoverFile;
  const title=String(form.get("title")).trim(), category=String(form.get("category"));
  const quantity=Number(form.get("quantity"));
  if(!title||!Number.isInteger(quantity)||quantity<1||quantity>400) { showToast("Enter a title and between 1 and 400 physical copies.","error"); return; }
  let uploadedCover = null, bookCreated = false;
  try {
    if (coverFile) {
      const extension = coverFile.type==="image/png"?"png":coverFile.type==="image/webp"?"webp":"jpg";
      const path = "book-covers/"+state.user.uid+"/"+Date.now()+"-"+Math.random().toString(36).slice(2)+"."+extension;
      const target = storageRef(state.storage,path);
      await uploadBytes(target,coverFile,{contentType:coverFile.type});
      uploadedCover = {path:target.fullPath,url:await getDownloadURL(target)};
    }
    const createBook = httpsCallable(state.functions,"registerBookCopies");
    const result = await createBook({
      title,author:String(form.get("author")).trim(),category,quantity,
      coverUrl:uploadedCover?.url || "",coverStoragePath:uploadedCover?.path || "",
      description:String(form.get("description")||"").trim()
    });
    bookCreated = true;
    formElement.reset(); clearBookCoverSelection();
    renderCopyLabels(title, result.data.copies || []);
    showToast("Book registered. "+quantity+" individual copy barcodes generated.");
    await refreshPublicData(); await refreshAdminData();
  } catch(error) {
    if (uploadedCover && !bookCreated) {
      try { await deleteObject(storageRef(state.storage,uploadedCover.path)); } catch(_) {}
    }
    showToast(errorMessage(error),"error");
  }
}
function renderCopyLabels(title, copies) {
  const panel = $("copyLabelsPanel");
  if (!panel) return;
  panel.replaceChildren();
  if (!copies.length) return;
  const heading = node("h4", "Copy labels — " + title);
  const note = node("p", "Each label identifies one physical copy. Print and attach one label to each copy.", "muted");
  const printButton = node("button", "Print copy labels", "btn btn-outline top-gap");
  printButton.type = "button";
  printButton.addEventListener("click", () => window.print());
  const grid = node("div", null, "copy-label-grid");
  copies.forEach(copy => {
    const card = node("article", null, "copy-label");
    card.append(node("strong", "Copy " + copy.copyNumber));
    const barcode = node("svg");
    card.append(barcode);
    try { if (window.JsBarcode) window.JsBarcode(barcode, copy.barcode, {format:"CODE128",displayValue:false,margin:2,height:42,width:1.4}); } catch (_) {}
    card.append(node("small", copy.barcode));
    const qr = node("div", null, "copy-label-qr");
    if (window.QRCode) new window.QRCode(qr, {text:copy.barcode,width:88,height:88,colorDark:"#111827",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
    card.append(qr);
    grid.append(card);
  });
  panel.append(heading, note, printButton, grid);
  panel.classList.remove("hidden");
}
function renderInventory() {
  const table=$("inventoryTable"); table.replaceChildren();
  state.books.forEach(book=>{
    const row=node("tr");
    const codeCell=node("td"); codeCell.append(node("strong",book.libraryNumber||book.barcode)); const svg=node("svg"); svg.style.width="130px"; svg.style.height="35px"; codeCell.append(svg); row.append(codeCell);
    try { if(window.JsBarcode) window.JsBarcode(svg,book.barcode||book.libraryNumber,{format:"CODE128",displayValue:false,margin:0,height:30,width:1}); } catch(_){}
    addCell(row,book.title+" — "+(book.author||"Unknown author")); addCell(row,book.category); addCell(row,Number(book.available||0)+" / "+Number(book.quantity||0));
    addAction(row,"Remove",()=>deleteBook(book),"btn btn-sm btn-danger"); table.append(row);
  });
}
async function deleteBook(book) {
  if(!state.librarian || !confirm("Delete “"+book.title+"” from the catalogue? This is only allowed if the book has no active loans.")) return;
  try {
    if(Number(book.available||0)!==Number(book.quantity||0)) throw new Error("This book has active loans. Return all copies before deleting it.");
    await deleteDoc(doc(state.db,"books",book.id));
    if (book.coverStoragePath) { try { await deleteObject(storageRef(state.storage,book.coverStoragePath)); } catch(_) {} }
    showToast("Book removed from catalogue."); await refreshPublicData(); await refreshAdminData();
  } catch(error) { showToast(errorMessage(error),"error"); }
}
async function processUnifiedCode(rawCode, mode) {
  if (!state.librarian || !rawCode) return;
  const code = String(rawCode).trim();
  if (!code) return;
  try {
    if (mode === "check-in" || mode === "check-out") {
      const members=await getDocs(query(collection(state.db,"users"),where("libraryNumber","==",code),limit(1)));
      if(members.empty) throw new Error("No member matches that library number.");
      const memberDoc=members.docs[0], member=memberDoc.data();
      if(member.role!=="learner" || member.isApproved!==true) throw new Error("This member is not approved.");
      const presenceRef=doc(state.db,"memberPresence",memberDoc.id);
      const presenceSnap=await getDoc(presenceRef);
      const attendanceRef=presenceSnap.exists() && mode==="check-out"
        ? doc(state.db,"attendance",presenceSnap.data().attendanceId)
        : doc(collection(state.db,"attendance"));
      if(mode==="check-in") {
        if(presenceSnap.exists() && presenceSnap.data().status==="In library") throw new Error("This member is already checked in.");
        const active=await getDocs(query(collection(state.db,"memberPresence"),where("status","==","In library")));
        if(active.size>=state.capacity) throw new Error("The library has reached its configured capacity.");
      } else if(!presenceSnap.exists() || presenceSnap.data().status!=="In library" || !presenceSnap.data().attendanceId) {
        throw new Error("This member has no active check-in.");
      }
      await runTransaction(state.db,async transaction=>{
        const [latestPresence,latestMember]=await Promise.all([
          transaction.get(presenceRef),transaction.get(memberDoc.ref)
        ]);
        if(!latestMember.exists() || latestMember.data().isApproved!==true || latestMember.data().role!=="learner") {
          throw new Error("This member is not approved.");
        }
        if(mode==="check-in") {
          if(latestPresence.exists() && latestPresence.data().status==="In library") throw new Error("This member is already checked in.");
          transaction.set(attendanceRef,{
            uid:memberDoc.id,memberName:member.fullName,libraryNumber:member.libraryNumber,
            checkInAt:serverTimestamp(),checkOutAt:null,status:"In library",recordedBy:state.user.uid
          });
          transaction.set(presenceRef,{
            uid:memberDoc.id,attendanceId:attendanceRef.id,status:"In library",updatedAt:serverTimestamp()
          });
        } else {
          if(!latestPresence.exists() || latestPresence.data().status!=="In library") throw new Error("This member has no active check-in.");
          const activeAttendanceRef=doc(state.db,"attendance",latestPresence.data().attendanceId);
          const activeAttendance=await transaction.get(activeAttendanceRef);
          if(!activeAttendance.exists() || activeAttendance.data().status!=="In library") throw new Error("The active attendance record could not be found.");
          transaction.update(activeAttendanceRef,{
            checkOutAt:serverTimestamp(),status:"Checked out",checkedOutBy:state.user.uid
          });
          transaction.update(presenceRef,{status:"Checked out",updatedAt:serverTimestamp()});
        }
      });
      showToast(member.fullName+(mode==="check-in"?" checked in.":" checked out."));
    } else if (mode === "issue-book") {
      if (!state.scanMemberCode) {
        state.scanMemberCode = code;
        setText("scannerInstruction", "Member scanned. Now scan the individual book-copy barcode.");
        showToast("Member scanned. Scan the book copy.");
        return;
      }
      const call = httpsCallable(state.functions, "issueBookCopy");
      const result = await call({libraryNumber:state.scanMemberCode, copyBarcode:code});
      state.scanMemberCode = "";
      setText("scannerInstruction", "Scan a member and then a book copy.");
      showToast(result.data.message || "Book issued.");
    } else if (mode === "return-book") {
      const call = httpsCallable(state.functions, "returnBookCopy");
      const result = await call({copyBarcode:code});
      showToast(result.data.message || "Book returned.");
    }
    await refreshPublicData();
    await refreshAdminData();
  } catch(error) {
    state.scanMemberCode = "";
    setText("scannerInstruction", "Select an action, then scan the relevant membership card or book-copy label.");
    showToast(errorMessage(error), "error");
  }
}
async function recordAttendance(event) {
  event.preventDefault();
  if (!state.librarian) return;
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const code = String(form.get("libraryNumber") || "").trim();
  const mode = String(form.get("action") || "check-in");
  await processUnifiedCode(code, mode);
  formElement.reset();
  formElement.elements.action.value = mode;
  $("attendanceCodeInput")?.focus();
}
async function updateCapacity(event) {
  event.preventDefault(); if(!state.librarian) return;
  const capacity=Number(new FormData(event.currentTarget).get("capacity"));
  if(!Number.isInteger(capacity)||capacity<1||capacity>10000) { showToast("Capacity must be between 1 and 10,000.","error"); return; }
  try { await setDoc(doc(state.db,"settings","library"),{capacity,updatedAt:serverTimestamp(),updatedBy:state.user.uid},{merge:true}); state.capacity=capacity; showToast("Library capacity updated."); await refreshAdminData(); }
  catch(error) { showToast(errorMessage(error),"error"); }
}
function renderAttendance() {
  const table=$("attendanceTable"); table.replaceChildren();
  state.attendance.forEach(item=>{
    const row=node("tr"); addCell(row,item.memberName); addCell(row,item.libraryNumber); addCell(row,formatDate(item.checkInAt)); addCell(row,formatDate(item.checkOutAt)); addCell(row,item.status); table.append(row);
  });
  const inside=state.attendance.filter(a=>a.status==="In library").length;
  setText("currentCapacity","Library occupancy: "+inside+" / "+state.capacity+" · Remaining capacity: "+Math.max(0,state.capacity-inside));
  $("capacityForm").elements.capacity.value=state.capacity;
}
async function handleCameraScan(rawCode) {
  const code=String(rawCode||"").trim();
  if(!code||state.scanBusy) return;
  const now=Date.now();
  const mode=$("attendanceForm").elements.action.value;
  if(mode==="issue-book" && state.scanMemberCode && code===state.scanMemberCode) return;
  if(code===state.lastScanValue && now-state.lastScanAt<1600) return;
  state.lastScanValue=code; state.lastScanAt=now; state.scanBusy=true;
  try {
    await processUnifiedCode(code,mode);
    if(mode!=="issue-book" || !state.scanMemberCode) await stopScanner();
  } finally {
    state.scanBusy=false;
  }
}
async function startScanner() {
  if (!state.librarian) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("Camera access is unavailable. Use a USB barcode scanner connected to the code field.", "error");
    return;
  }
  const video=$("scannerVideo");
  $("scannerBox").classList.remove("hidden");
  setText("scannerInstruction","Starting camera. Allow camera access when your browser asks.");
  try {
    if ("BarcodeDetector" in window) {
      try {
        const formats=["code_128","qr_code","ean_13","ean_8","upc_a","upc_e"];
        const supported=await BarcodeDetector.getSupportedFormats?.();
        const usable=supported?formats.filter(format=>supported.includes(format)):formats;
        if(usable.length) {
          const detector=new BarcodeDetector({formats:usable});
          state.scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});
          video.srcObject=state.scanStream;
          await video.play();
          const scan=async()=>{
            if(!state.scanStream) return;
            try {
              if(!state.scanBusy) {
                const codes=await detector.detect(video);
                if(codes.length&&codes[0].rawValue) await handleCameraScan(codes[0].rawValue);
              }
            } catch(_) {}
            if(state.scanStream) state.scanner=requestAnimationFrame(scan);
          };
          setText("scannerInstruction","Camera ready. Scan a membership card or book-copy label.");
          scan();
          return;
        }
      } catch(nativeError) {
        if(state.scanStream) state.scanStream.getTracks().forEach(track=>track.stop());
        state.scanStream=null;
        video.srcObject=null;
      }
    }
    const {BrowserMultiFormatReader}=await import("https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm");
    const reader=new BrowserMultiFormatReader();
    setText("scannerInstruction","Loading the compatible barcode and QR camera reader…");
    state.scanControls=await reader.decodeFromVideoDevice(undefined,video,(result)=>{
      if(result) void handleCameraScan(result.getText());
    });
    setText("scannerInstruction","Camera ready. Scan a membership card or book-copy label.");
  } catch(error) {
    await stopScanner();
    showToast("Could not start camera scanning: "+errorMessage(error)+". Check camera permission and use HTTPS, or connect a USB scanner.","error");
  }
}
async function stopScanner() {
  if(state.scanner) cancelAnimationFrame(state.scanner);
  state.scanner=null;
  if(state.scanControls) { try { state.scanControls.stop(); } catch(_) {} }
  state.scanControls=null;
  if(state.scanStream) state.scanStream.getTracks().forEach(track=>track.stop());
  state.scanMemberCode="";
  state.scanStream=null;
  state.scanBusy=false;
  state.lastScanValue="";
  state.lastScanAt=0;
  if($("scannerVideo")) $("scannerVideo").srcObject=null;
  $("scannerBox")?.classList.add("hidden");
}

async function uploadEbook(event) {
  event.preventDefault(); if(!state.librarian) return;
  const formElement = event.currentTarget;
  const form=new FormData(formElement), file=form.get("file"), title=String(form.get("title")).trim(), category=String(form.get("category")).trim();
  if(!(file instanceof File)||!file.size) { showToast("Choose a PDF or EPUB file.","error"); return; }
  const isPdf=file.type==="application/pdf"||file.name.toLowerCase().endsWith(".pdf");
  const isEpub=file.type==="application/epub+zip"||file.name.toLowerCase().endsWith(".epub");
  if(!isPdf&&!isEpub) { showToast("Only PDF and EPUB files are allowed.","error"); return; }
  if(file.size>30*1024*1024) { showToast("E-books must be smaller than 30 MB.","error"); return; }
  try {
    const record=doc(collection(state.db,"ebooks"));
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
    const target=storageRef(state.storage,"ebooks/"+record.id+"-"+safeName);
    await uploadBytes(target,file,{contentType:isPdf?"application/pdf":"application/epub+zip"});
    const url=await getDownloadURL(target);
    await setDoc(record,{title,category,fileName:file.name,storagePath:target.fullPath,downloadUrl:url,size:file.size,uploadedBy:state.user.uid,createdAt:serverTimestamp()});
    formElement.reset(); showToast("E-book uploaded."); await refreshAdminData();
  } catch(error) { showToast(errorMessage(error),"error"); }
}
function renderEbooks() {
  const container=$("ebooksList"); container.replaceChildren();
  if(!state.ebooks.length) container.append(node("p","No e-books have been uploaded yet.","muted"));
  state.ebooks.forEach(book=>{
    const item=node("div",null,"stack-item"); item.append(node("h4",book.title),node("p",(book.category||"General")+" · "+(book.fileName||"E-book")));
    const link=node("a","Open / download e-book"); link.href=book.downloadUrl; link.target="_blank"; link.rel="noopener noreferrer"; item.append(link);
    const remove=node("button","Remove","btn btn-sm btn-danger top-gap"); remove.addEventListener("click",()=>removeEbook(book)); item.append(remove); container.append(item);
  });
}
async function removeEbook(book) {
  if(!state.librarian||!confirm("Remove this e-book?")) return;
  try {
    await deleteDoc(doc(state.db,"ebooks",book.id));
    if(book.storagePath) { try { await deleteObject(storageRef(state.storage,book.storagePath)); } catch(_){} }
    showToast("E-book removed."); await refreshAdminData();
  } catch(error) { showToast(errorMessage(error),"error"); }
}
async function publishNews(event) {
  event.preventDefault(); if(!state.librarian) return;
  const formElement = event.currentTarget;
  const form=new FormData(formElement), type=String(form.get("type")), title=String(form.get("title")).trim(), body=String(form.get("body")).trim(), date=String(form.get("date")||"");
  try {
    const target=type==="event"?"events":"announcements";
    await addDoc(collection(state.db,target),{title,body,date:date||null,type,createdAt:serverTimestamp(),createdBy:state.user.uid});
    formElement.reset(); showToast("Published successfully."); await refreshPublicData(); await refreshAdminData();
  } catch(error) { showToast(errorMessage(error),"error"); }
}
function renderAnnouncements(items) {
  const home=$("homeAnnouncements"), all=$("announcementsList");
  [home,all].forEach(container=>{
    if(!container) return;
    container.replaceChildren();
    if(!items.length) { container.append(node("p","No announcements have been published yet.","muted")); return; }
    items.forEach(item=>{
      const kind=item.announcementKind==="Event"?"Event":"Announcement";
      const body=String(item.body||"").trim();
      const words=body ? body.split(/\s+/).filter(Boolean).length : 0;
      const readingMinutes=Math.max(1,Math.ceil(words/200));
      const card=node("article",null,"announcement-card");
      card.dataset.kind=kind.toLowerCase();
      const meta=node("div",null,"announcement-card-meta");
      meta.append(node("span",kind,"announcement-kind"));
      meta.append(node("time",formatDate(item.date||item.createdAt)));
      const heading=node("h3",item.title||"Library update","announcement-card-title");
      const excerpt=node("p",body,"announcement-card-body");
      const footer=node("div",null,"announcement-card-footer");
      footer.append(node("span",readingMinutes+" min read"));
      card.append(meta,heading,excerpt,footer);
      container.append(card);
    });
  });
}
function renderPublicEbooks() {
  const container=$("publicEbooks");
  if (!container) return;
  container.replaceChildren();
  if (!state.user) { container.append(node("p","Log in to view available e-books.","muted")); return; }
  if (!state.ebooks.length) { container.append(node("p","No e-books have been uploaded yet.","muted")); return; }
  state.ebooks.forEach(book => {
    const card=node("article",null,"announcement-card");
    card.append(node("h3",book.title),node("p",book.category||"Digital resource"));
    const link=node("a","Open / download");
    link.href=book.downloadUrl; link.target="_blank"; link.rel="noopener noreferrer";
    card.append(link); container.append(card);
  });
}
function renderAdminNews() {
  const container=$("adminNewsList"); container.replaceChildren();
  [...state.announcements.map(i=>({...i,_collection:"announcements"})),...state.events.map(i=>({...i,_collection:"events"}))].sort((a,b)=>dateMillis(b.createdAt)-dateMillis(a.createdAt)).forEach(item=>{
    const row=node("div",null,"stack-item"); row.append(node("h4",item.title),node("p",item._collection==="events"?"Event":"Announcement"));
    const remove=node("button","Delete","btn btn-sm btn-danger top-gap");
    remove.addEventListener("click",async()=>{
      if(!confirm("Delete this post?")) return;
      try { await deleteDoc(doc(state.db,item._collection,item.id)); showToast("Post deleted."); await refreshPublicData(); await refreshAdminData(); }
      catch(error) { showToast(errorMessage(error),"error"); }
    });
    row.append(remove); container.append(row);
  });
}
function setStats(containerId, items) {
  const container=$(containerId); if(!container) return; container.replaceChildren();
  items.forEach(([label,value])=>{ const card=node("div",null,"stat-card"); card.append(node("strong",value),node("span",label)); container.append(card); });
}
function renderBarChart(containerId, entries) {
  const container=$(containerId); container.replaceChildren();
  const max=Math.max(1,...entries.map(([,value])=>Number(value)||0));
  if(!entries.length) { container.append(node("p","No data available yet.","muted")); return; }
  entries.forEach(([label,value])=>{
    const row=node("div",null,"bar-row"); row.append(node("span",label));
    const track=node("div",null,"bar-track"); const fill=node("div",null,"bar-fill"); fill.style.width=(Math.max(0,Number(value)||0)/max*100)+"%"; track.append(fill); row.append(track,node("strong",value)); container.append(row);
  });
}
function renderStatistics() {
  const pending=state.requests.filter(r=>r.status==="Pending").length, approved=state.requests.filter(r=>r.status==="Approved").length, declined=state.requests.filter(r=>r.status==="Declined").length;
  const approvalRate=state.requests.length?Math.round(approved/state.requests.length*100):0;
  setStats("statisticsSummary",[["Registered members",state.members.length],["Approved members",state.members.filter(m=>m.isApproved).length],["Book titles",state.books.length],["Copies in stock",state.books.reduce((n,b)=>n+Number(b.available||0),0)],["Active loans",state.loans.filter(l=>l.status==="Borrowed").length],["Borrow approval rate",approvalRate+"%"],["Attendance records",state.attendance.length]]);
  renderBarChart("borrowChart",[["Pending",pending],["Approved",approved],["Declined",declined],["Returned",state.requests.filter(r=>r.status==="Returned").length]]);
  const levels={}; state.members.forEach(m=>{const key=m.eduLevel||"Unspecified"; levels[key]=(levels[key]||0)+1;});
  renderBarChart("educationChart",Object.entries(levels).sort((a,b)=>b[1]-a[1]));
  const days={}; state.attendance.forEach(a=>{const d=formatDate(a.checkInAt); if(d!=="—") days[d]=(days[d]||0)+1;});
  renderBarChart("attendanceChart",Object.entries(days).sort((a,b)=>dateMillis(a[0])-dateMillis(b[0])).slice(-7));
  const categoryCounts={}; state.requests.forEach(r=>{const key=r.bookCategory||"Other";categoryCounts[key]=(categoryCounts[key]||0)+1;});
  renderBarChart("categoryBorrowChart",Object.entries(categoryCounts).sort((a,b)=>b[1]-a[1]));
  const genderCounts={}; state.members.forEach(m=>{const key=m.gender||"Unspecified";genderCounts[key]=(genderCounts[key]||0)+1;});
  renderBarChart("genderChart",Object.entries(genderCounts).sort((a,b)=>b[1]-a[1]));
}
function renderInventoryPlaceholder() { /* Inventory is rendered with the admin data snapshot. */ }

window.AMG = {showSection,toggleDropdown,toggleMobileNav,openAuthModal,closeAuthModal,setAuthMode,nextRegistrationStep,previousRegistrationStep,logout,resetPassword,downloadCard,closeCardModal,switchTab};
document.addEventListener("DOMContentLoaded",init);
