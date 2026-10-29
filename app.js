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
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const state = { app:null, auth:null, db:null, storage:null, user:null, profile:null, librarian:false,
  books:[], requests:[], members:[], loans:[], attendance:[], ebooks:[], announcements:[], events:[],
  capacity:100, scanner:null, scanStream:null, toastTimer:null };
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
  $("bookForm").addEventListener("submit", registerBook);
  $("attendanceForm").addEventListener("submit", recordAttendance);
  $("capacityForm").addEventListener("submit", updateCapacity);
  $("ebookForm").addEventListener("submit", uploadEbook);
  $("newsForm").addEventListener("submit", publishNews);
  $("profilePhotoInput").addEventListener("change", updatePhoto);
  $("startScannerBtn").addEventListener("click", startScanner);
  $("stopScannerBtn").addEventListener("click", stopScanner);
  $("authModal").addEventListener("click", (event) => { if (event.target === $("authModal")) closeAuthModal(); });
  $("cardModal").addEventListener("click", (event) => { if (event.target === $("cardModal")) closeCardModal(); });
  renderBooks();
  renderAnnouncements([]);
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
      if (user && state.profile) await refreshMemberData();
      if (state.librarian) await refreshAdminData();
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
    renderBooks();
    renderAnnouncements([...state.announcements, ...state.events].sort((a,b) => dateMillis(b.createdAt)-dateMillis(a.createdAt)));
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
  $("pendingApprovalNotice").classList.toggle("hidden", !signedIn || !state.profile || state.profile.isApproved);
  if (state.profile) renderProfileCard(state.profile);
  if (state.librarian) setText("librarianHeading", "Librarian Desk — " + (state.profile?.fullName || state.user.email));
}
function showSection(sectionId) {
  const section = $(sectionId);
  if (!section) return;
  if (sectionId === "profileSection" && !state.user) { openAuthModal("login"); showToast("Log in to view your profile.", "error"); return; }
  if (sectionId === "librarianSection" && !state.librarian) { showToast("Librarian access requires an authorized Firebase account.", "error"); openAuthModal("login"); return; }
  document.querySelectorAll(".section").forEach(el => el.classList.remove("active"));
  section.classList.add("active");
  if (sectionId === "profileSection") refreshMemberData();
  if (sectionId === "librarianSection") refreshAdminData();
  window.scrollTo({top:0,behavior:"smooth"});
}
function toggleDropdown() { $("dropdownMenu").classList.toggle("show"); }
function openAuthModal(mode="login") {
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
}
async function login(event) {
  event.preventDefault();
  if (!requireFirebase()) return;
  const form = new FormData(event.currentTarget);
  try {
    await signInWithEmailAndPassword(state.auth, String(form.get("email")).trim(), String(form.get("password")));
    closeAuthModal();
    showToast("Login successful.");
  } catch (error) { showToast(errorMessage(error), "error"); }
}
async function register(event) {
  event.preventDefault();
  if (!requireFirebase()) return;
  const form = new FormData(event.currentTarget);
  const fullName = String(form.get("fullName")).trim();
  const email = String(form.get("email")).trim().toLowerCase();
  const password = String(form.get("password"));
  const guardianPhone = String(form.get("guardianPhone")).trim();
  if (fullName.length < 2 || !guardianPhone || password.length < 8) {
    showToast("Complete all required fields and use a password of at least 8 characters.", "error"); return;
  }
  let credential;
  try {
    credential = await createUserWithEmailAndPassword(state.auth, email, password);
    await updateProfile(credential.user, {displayName:fullName});
    const libraryNumber = await makeUniqueMemberNumber();
    const profile = {
      uid:credential.user.uid, fullName, email,
      gender:String(form.get("gender")), school:String(form.get("school")).trim(),
      studyLevel:String(form.get("studyLevel")).trim(), eduLevel:String(form.get("eduLevel")),
      guardianName:String(form.get("guardianName")).trim(), guardianRelation:String(form.get("guardianRelation")),
      guardianPhone, libraryNumber, role:"learner", isApproved:false, photoURL:"",
      starredBookIds:[], createdAt:serverTimestamp(), updatedAt:serverTimestamp()
    };
    await setDoc(doc(state.db,"users",credential.user.uid), profile);
    const photo = form.get("photo");
    if (photo instanceof File && photo.size > 0) {
      if (!photo.type.startsWith("image/") || photo.size > 5*1024*1024) throw new Error("Profile photo must be an image smaller than 5 MB.");
      const target = storageRef(state.storage, "member-photos/"+credential.user.uid+"/"+photo.name.replace(/[^a-zA-Z0-9._-]/g,"_"));
      await uploadBytes(target, photo, {contentType:photo.type});
      const photoURL = await getDownloadURL(target);
      await updateDoc(doc(state.db,"users",credential.user.uid), {photoURL,updatedAt:serverTimestamp()});
    }
    event.currentTarget.reset();
    closeAuthModal();
    showToast("Registration submitted. Please wait for librarian approval.");
    await refreshMemberData();
  } catch (error) {
    // Auth account may exist if a later Firestore/photo step failed; never log credentials.
    showToast("Registration could not be completed: "+errorMessage(error), "error");
  }
}
async function makeUniqueMemberNumber() {
  // Random component avoids predictable sequential IDs; Firestore rules restrict who can create profiles.
  const prefix = "AMG-" + new Date().getFullYear() + "-";
  return prefix + Math.random().toString(36).slice(2,8).toUpperCase();
}
async function resetPassword() {
  if (!requireFirebase()) return;
  const email = $("loginForm").elements.email.value.trim();
  if (!email) { showToast("Enter your email address in the login form first.", "error"); return; }
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
function renderProfileCard(profile) {
  setText("cardFullName",profile.fullName);
  setText("cardSchool",profile.school);
  setText("cardStudyLevel",profile.studyLevel);
  setText("cardEduLevel",profile.eduLevel);
  setText("cardLibraryNum",profile.libraryNumber);
  $("cardImage").src = profile.photoURL || avatarUrl(profile.libraryNumber);
  makeBarcode(profile.libraryNumber,"memberBarcode");
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
function switchTab(tabId, button) {
  document.querySelectorAll("#librarianSection .tab-btn").forEach(el=>el.classList.remove("active"));
  document.querySelectorAll("#librarianSection .tab-content").forEach(el=>el.classList.remove("active"));
  if (button) button.classList.add("active");
  $(tabId)?.classList.add("active");
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
function renderBooks() {
  const grid = $("bookGrid");
  if (!grid) return;
  const search = ($("searchInput")?.value||"").trim().toLowerCase();
  const category = $("categoryFilter")?.value||"All";
  const stars = starredIds();
  const books = state.books.filter(book => {
    const text = [book.title,book.author,book.category,book.description].join(" ").toLowerCase();
    return (!search || text.includes(search)) && (category==="All"||book.category===category) && (category!=="Starred"||stars.includes(book.id));
  });
  grid.replaceChildren();
  if (!books.length) { grid.append(node("div",state.books.length?"No books match your search.":"The library catalogue is empty. The librarian can register books from the Librarian Desk.","empty-state")); return; }
  for (const book of books) {
    const card = node("article",null,"book-card");
    const cover = node("div",null,"book-cover");
    if (book.coverUrl) { const image=node("img"); image.src=book.coverUrl; image.alt="Cover of "+book.title; image.loading="lazy"; cover.append(image); }
    else cover.append(node("span",book.icon||"📚"));
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
  state.members.filter(m=>!m.isApproved).forEach(member=>{
    const row=node("tr"); addCell(row,member.fullName); addCell(row,member.school); addCell(row,member.eduLevel); addCell(row,(member.guardianName||"")+" · "+(member.guardianPhone||""));
    addAction(row,"Approve",()=>approveLearner(member.uid),"btn btn-sm btn-success"); pending.append(row);
  });
  const all=$("allLearnersTable"); all.replaceChildren();
  state.members.forEach(member=>{
    const row=node("tr"); addCell(row,member.libraryNumber); addCell(row,member.fullName); addCell(row,(member.school||"")+" / "+(member.eduLevel||"")); addCell(row,member.isApproved?"Approved":"Pending");
    addAction(row,"View / download card",()=>viewMemberCard(member)); all.append(row);
  });
  setStats("adminStats",[["Members",state.members.length],["Awaiting approval",state.members.filter(m=>!m.isApproved).length],["Book titles",state.books.length],["Pending requests",state.requests.filter(r=>r.status==="Pending").length],["Currently in library",state.attendance.filter(a=>a.status==="In library").length],["Available copies",state.books.reduce((n,b)=>n+Number(b.available||0),0)]]);
}
async function approveLearner(uid) {
  if(!state.librarian) return;
  try { await updateDoc(doc(state.db,"users",uid),{isApproved:true,approvedAt:serverTimestamp(),approvedBy:state.user.uid,updatedAt:serverTimestamp()}); showToast("Learner approved."); await refreshAdminData(); }
  catch(error) { showToast(errorMessage(error),"error"); }
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
  setText("adminCardName",member.fullName); setText("adminCardSchool",member.school); setText("adminCardStudy",member.studyLevel); setText("adminCardLevel",member.eduLevel); setText("adminCardNumber",member.libraryNumber);
  $("adminCardImage").src=member.photoURL||avatarUrl(member.libraryNumber);
  makeBarcode(member.libraryNumber,"adminMemberBarcode"); makeQr(member.libraryNumber,"adminMemberQr");
  $("cardModal").style.display="flex";
}
async function registerBook(event) {
  event.preventDefault(); if(!state.librarian) return;
  const form=new FormData(event.currentTarget);
  const title=String(form.get("title")).trim(), category=String(form.get("category"));
  const quantity=Number(form.get("quantity"));
  if(!title||!Number.isInteger(quantity)||quantity<1||quantity>5000) { showToast("Enter a title and a valid number of copies.","error"); return; }
  try {
    const prefix=initialsCategory(category);
    const barcode=prefix+"-"+new Date().getFullYear()+"-"+Math.random().toString(36).slice(2,8).toUpperCase();
    await addDoc(collection(state.db,"books"),{title,author:String(form.get("author")).trim(),category,quantity,available:quantity,barcode,libraryNumber:barcode,coverUrl:String(form.get("coverUrl")||"").trim(),description:String(form.get("description")||"").trim(),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),createdBy:state.user.uid});
    event.currentTarget.reset(); showToast("Book registered. Unique CODE-128 barcode: "+barcode);
    await refreshPublicData(); await refreshAdminData();
  } catch(error) { showToast(errorMessage(error),"error"); }
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
    await deleteDoc(doc(state.db,"books",book.id)); showToast("Book removed from catalogue."); await refreshPublicData(); await refreshAdminData();
  } catch(error) { showToast(errorMessage(error),"error"); }
}
async function recordAttendance(event) {
  event.preventDefault(); if(!state.librarian) return;
  const form=new FormData(event.currentTarget), libraryNumber=String(form.get("libraryNumber")).trim(), action=String(form.get("action"));
  try {
    const found=await getDocs(query(collection(state.db,"users"),where("libraryNumber","==",libraryNumber),limit(1)));
    if(found.empty) throw new Error("No registered member matches that library number.");
    const member={id:found.docs[0].id,...found.docs[0].data()};
    if(!member.isApproved) throw new Error("This member has not been approved.");
    const open=state.attendance.find(a=>a.uid===member.uid&&a.status==="In library");
    if(action==="check-in") {
      if(open) throw new Error("This member is already checked in.");
      await addDoc(collection(state.db,"attendance"),{uid:member.uid,memberName:member.fullName,libraryNumber:member.libraryNumber,checkInAt:serverTimestamp(),checkOutAt:null,status:"In library",recordedBy:state.user.uid});
      showToast(member.fullName+" checked in.");
    } else {
      if(!open) throw new Error("No open check-in was found for this member.");
      await updateDoc(doc(state.db,"attendance",open.id),{checkOutAt:serverTimestamp(),status:"Checked out",checkedOutBy:state.user.uid});
      showToast(member.fullName+" checked out.");
    }
    event.currentTarget.reset(); await refreshAdminData();
  } catch(error) { showToast(errorMessage(error),"error"); }
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
async function startScanner() {
  if(!state.librarian) return;
  if(!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) { showToast("Camera barcode scanning is not supported in this browser. Enter the library number manually.","error"); return; }
  try {
    const detector=new BarcodeDetector({formats:["code_128","qr_code","ean_13"]});
    state.scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
    const video=$("scannerVideo"); video.srcObject=state.scanStream; await video.play(); $("scannerBox").classList.remove("hidden");
    const scan=async()=>{
      if(!state.scanStream) return;
      try {
        const codes=await detector.detect(video);
        if(codes.length&&codes[0].rawValue) {
          $("attendanceForm").elements.libraryNumber.value=codes[0].rawValue;
          showToast("Barcode scanned. Choose check-in/check-out and submit.");
          await stopScanner(); return;
        }
      } catch(_){}
      state.scanner=requestAnimationFrame(scan);
    };
    scan();
  } catch(error) { await stopScanner(); showToast("Could not open camera: "+errorMessage(error),"error"); }
}
async function stopScanner() {
  if(state.scanner) cancelAnimationFrame(state.scanner);
  state.scanner=null;
  if(state.scanStream) state.scanStream.getTracks().forEach(track=>track.stop());
  state.scanStream=null;
  if($("scannerVideo")) $("scannerVideo").srcObject=null;
  $("scannerBox")?.classList.add("hidden");
}
async function uploadEbook(event) {
  event.preventDefault(); if(!state.librarian) return;
  const form=new FormData(event.currentTarget), file=form.get("file"), title=String(form.get("title")).trim(), category=String(form.get("category")).trim();
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
    event.currentTarget.reset(); showToast("E-book uploaded."); await refreshAdminData();
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
  const form=new FormData(event.currentTarget), type=String(form.get("type")), title=String(form.get("title")).trim(), body=String(form.get("body")).trim(), date=String(form.get("date")||"");
  try {
    const target=type==="event"?"events":"announcements";
    await addDoc(collection(state.db,target),{title,body,date:date||null,type,createdAt:serverTimestamp(),createdBy:state.user.uid});
    event.currentTarget.reset(); showToast("Published successfully."); await refreshPublicData(); await refreshAdminData();
  } catch(error) { showToast(errorMessage(error),"error"); }
}
function renderAnnouncements(items) {
  const home=$("homeAnnouncements"), all=$("announcementsList");
  [home,all].forEach(container=>{
    if(!container) return;
    container.replaceChildren();
    if(!items.length) { container.append(node("p","No announcements have been published yet.","muted")); return; }
    items.forEach(item=>{
      const card=node("article",null,"announcement-card");
      card.append(node("h3",item.title),node("time",item.date?formatDate(item.date):formatDate(item.createdAt)),node("p",item.body||""));
      container.append(card);
    });
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
  setStats("statisticsSummary",[["Registered members",state.members.length],["Approved members",state.members.filter(m=>m.isApproved).length],["Book titles",state.books.length],["Copies in stock",state.books.reduce((n,b)=>n+Number(b.available||0),0)],["Active loans",state.loans.filter(l=>l.status==="Borrowed").length],["Attendance records",state.attendance.length]]);
  renderBarChart("borrowChart",[["Pending",pending],["Approved",approved],["Declined",declined],["Returned",state.requests.filter(r=>r.status==="Returned").length]]);
  const levels={}; state.members.forEach(m=>{const key=m.eduLevel||"Unspecified"; levels[key]=(levels[key]||0)+1;});
  renderBarChart("educationChart",Object.entries(levels).sort((a,b)=>b[1]-a[1]));
  const days={}; state.attendance.forEach(a=>{const d=formatDate(a.checkInAt); if(d!=="—") days[d]=(days[d]||0)+1;});
  renderBarChart("attendanceChart",Object.entries(days).sort((a,b)=>dateMillis(a[0])-dateMillis(b[0])).slice(-7));
}
function renderInventoryPlaceholder() { /* Inventory is rendered with the admin data snapshot. */ }

window.AMG = {showSection,toggleDropdown,openAuthModal,closeAuthModal,setAuthMode,logout,resetPassword,downloadCard,closeCardModal,switchTab};
document.addEventListener("DOMContentLoaded",init);
