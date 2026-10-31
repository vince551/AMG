import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { randomBytes, randomInt } from "node:crypto";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "amglibra-76222";
let services;

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getServices() {
  if (services) return services;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new ApiError(503, "backend/not-configured", "The secure library backend is not configured yet.");
  let account;
  try {
    account = JSON.parse(raw);
  } catch {
    throw new ApiError(503, "backend/invalid-credentials", "The secure library backend credentials are invalid.");
  }
  if (account.project_id !== PROJECT_ID) {
    throw new ApiError(503, "backend/wrong-project", "The backend credentials do not match the AMG Firebase project.");
  }
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert(account), projectId: PROJECT_ID });
  services = { auth: getAuth(app), db: getFirestore(app) };
  return services;
}

function clean(value, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}
function requireValue(condition, message) {
  if (!condition) throw new ApiError(400, "invalid-argument", message);
}
function bearerToken(req) {
  const value = req.headers.authorization || req.headers.Authorization || "";
  const match = String(value).match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, "unauthenticated", "Sign in to continue.");
  return match[1];
}
async function authenticate(req) {
  const { auth } = getServices();
  try {
    return await auth.verifyIdToken(bearerToken(req));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "unauthenticated", "Your session is invalid or expired. Please sign in again.");
  }
}
function requireLibrarian(decoded) {
  if (decoded.librarian !== true) throw new ApiError(403, "permission-denied", "Authorized librarian access is required.");
}
async function findMember(db, code) {
  const snap = await db.collection("users").where("libraryNumber", "==", clean(code, 180)).limit(1).get();
  if (snap.empty) throw new ApiError(404, "not-found", "No member matches that library number.");
  const member = snap.docs[0];
  if (member.data().isApproved !== true) throw new ApiError(412, "failed-precondition", "This member is not approved.");
  return member;
}
async function findCopy(db, code) {
  const snap = await db.collection("bookCopies").where("barcode", "==", clean(code, 100)).limit(1).get();
  if (snap.empty) throw new ApiError(404, "not-found", "No physical book copy matches that barcode.");
  return snap.docs[0];
}
function makeCopyBarcode() {
  return "AMG-COPY-" + randomBytes(9).toString("hex").toUpperCase();
}

async function createLearnerProfile(db, decoded, input) {
  const uid = decoded.uid;
  const email = clean(decoded.email, 254).toLowerCase();
  if (!email) throw new ApiError(412, "failed-precondition", "The signed-in account must have an email address.");
  const fullName = clean(input.fullName, 120);
  const school = clean(input.school, 160);
  const studyLevel = clean(input.studyLevel, 80);
  const guardianName = clean(input.guardianName, 120);
  const guardianPhone = clean(input.guardianPhone, 30);
  requireValue(fullName.length >= 2 && school && studyLevel && guardianName && guardianPhone,
    "Complete all required learner and guardian details.");
  const allowedGender = ["Male", "Female", "Other", "Prefer not to say"];
  const allowedRelation = ["Mother", "Father", "Guardian"];
  const allowedLevel = ["PP / Pre-Primary", "Primary", "Junior Secondary", "Senior Secondary", "High School", "University"];
  const gender = clean(input.gender, 30);
  const guardianRelation = clean(input.guardianRelation, 30);
  const eduLevel = clean(input.eduLevel, 50);
  requireValue(allowedGender.includes(gender) && allowedRelation.includes(guardianRelation) && allowedLevel.includes(eduLevel),
    "Choose valid learner and guardian options.");
  const userRef = db.collection("users").doc(uid);
  for (let attempt = 0; attempt < 30; attempt++) {
    const libraryNumber = "AMG-" + randomInt(100000, 1000000);
    const numberRef = db.collection("memberNumbers").doc(libraryNumber);
    const result = await db.runTransaction(async tx => {
      const existing = await tx.get(userRef);
      if (existing.exists) {
        const current = existing.data();
        if (current.role !== "learner" || current.email !== email) {
          throw new ApiError(409, "already-exists", "A membership profile already exists for this account.");
        }
        if (!current.libraryNumber) {
          throw new ApiError(409, "profile/incomplete", "Your existing membership profile needs librarian assistance.");
        }
        return { libraryNumber: current.libraryNumber, alreadyExists: true };
      }
      const [reserved, existingNumber] = await Promise.all([
        tx.get(numberRef),
        tx.get(db.collection("users").where("libraryNumber", "==", libraryNumber).limit(1))
      ]);
      if (reserved.exists || !existingNumber.empty) return null;
      const profile = {
        uid, fullName, email, gender, school, studyLevel, eduLevel, guardianName, guardianRelation, guardianPhone,
        libraryNumber, role: "learner", isApproved: false, membershipStatus: "Pending",
        photoURL: "", starredBookIds: [], createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
      };
      tx.create(numberRef, { uid, createdAt: FieldValue.serverTimestamp() });
      tx.create(userRef, profile);
      return { libraryNumber, alreadyExists: false };
    });
    if (result) return result;
  }
  throw new ApiError(503, "resource-exhausted", "A unique membership number could not be allocated. Please try again.");
}

async function reviewLearnerMembership(db, decoded, input) {
  requireLibrarian(decoded);
  const uid = clean(input.uid, 128);
  const decision = clean(input.decision, 20);
  requireValue(uid && ["Approved", "Denied"].includes(decision), "Choose a learner and approve or deny the application.");
  const userRef = db.collection("users").doc(uid);
  await db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new ApiError(404, "not-found", "The learner profile no longer exists.");
    const member = snap.data();
    if (member.role !== "learner") throw new ApiError(412, "failed-precondition", "Only learner membership applications can be reviewed.");
    if (member.isApproved === true || member.membershipStatus === "Denied") {
      throw new ApiError(412, "failed-precondition", "This membership application has already been decided.");
    }
    tx.update(userRef, {
      isApproved: decision === "Approved",
      membershipStatus: decision,
      decisionAt: FieldValue.serverTimestamp(),
      decisionBy: decoded.uid,
      updatedAt: FieldValue.serverTimestamp(),
      ...(decision === "Approved" ? { approvedAt: FieldValue.serverTimestamp() } : { deniedAt: FieldValue.serverTimestamp() })
    });
  });
  return { decision, message: "Membership " + decision.toLowerCase() + " successfully." };
}

async function registerBookCopies(db, decoded, input) {
  requireLibrarian(decoded);
  const title = clean(input.title);
  const author = clean(input.author, 120);
  const category = clean(input.category, 80);
  const quantity = Number(input.quantity);
  requireValue(title && Number.isInteger(quantity) && quantity >= 1 && quantity <= 400,
    "Provide a title and between 1 and 400 physical copies.");
  const batch = db.batch();
  const bookRef = db.collection("books").doc();
  const titleCode = "AMG-TITLE-" + randomBytes(6).toString("hex").toUpperCase();
  batch.create(bookRef, {
    title, author, category, quantity, available: quantity, barcode: titleCode, libraryNumber: titleCode,
    coverUrl: clean(input.coverUrl, 1000), description: clean(input.description, 500),
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), createdBy: decoded.uid
  });
  const copies = [];
  for (let i = 1; i <= quantity; i++) {
    const ref = db.collection("bookCopies").doc();
    const barcode = makeCopyBarcode();
    batch.create(ref, { bookId: bookRef.id, title, barcode, copyNumber: i, status: "Available", createdAt: FieldValue.serverTimestamp() });
    copies.push({ copyNumber: i, barcode });
  }
  await batch.commit();
  return { bookId: bookRef.id, bookBarcode: titleCode, copies, message: quantity + " individual copy barcodes created." };
}

async function recordMemberAttendance(db, decoded, input) {
  requireLibrarian(decoded);
  const action = clean(input.action, 20);
  requireValue(["check-in", "check-out"].includes(action), "Choose check-in or check-out.");
  const member = await findMember(db, input.libraryNumber);
  const presenceRef = db.collection("memberPresence").doc(member.id);
  const attendanceRef = db.collection("attendance").doc();
  await db.runTransaction(async tx => {
    const presence = await tx.get(presenceRef);
    const settings = await tx.get(db.collection("settings").doc("library"));
    if (action === "check-in") {
      if (presence.exists && presence.data().status === "In library") {
        throw new ApiError(409, "already-exists", "This member is already checked in.");
      }
      const capacity = Math.max(1, Number(settings.data()?.capacity || 100));
      const active = await tx.get(db.collection("memberPresence").where("status", "==", "In library"));
      if (active.size >= capacity) throw new ApiError(429, "resource-exhausted", "The library has reached its configured capacity.");
      tx.create(attendanceRef, {
        uid: member.id, memberName: member.data().fullName, libraryNumber: member.data().libraryNumber,
        checkInAt: FieldValue.serverTimestamp(), checkOutAt: null, status: "In library", recordedBy: decoded.uid
      });
      tx.set(presenceRef, { uid: member.id, attendanceId: attendanceRef.id, status: "In library", updatedAt: FieldValue.serverTimestamp() });
    } else {
      if (!presence.exists || presence.data().status !== "In library") {
        throw new ApiError(412, "failed-precondition", "This member has no active check-in.");
      }
      const activeAttendanceRef = db.collection("attendance").doc(presence.data().attendanceId);
      const activeAttendance = await tx.get(activeAttendanceRef);
      if (!activeAttendance.exists) throw new ApiError(404, "not-found", "The active attendance record could not be found.");
      tx.update(activeAttendanceRef, {
        checkOutAt: FieldValue.serverTimestamp(), status: "Checked out", checkedOutBy: decoded.uid
      });
      tx.set(presenceRef, { uid: member.id, status: "Checked out", updatedAt: FieldValue.serverTimestamp() });
    }
  });
  return { message: member.data().fullName + (action === "check-in" ? " checked in." : " checked out.") };
}

async function issueBookCopy(db, decoded, input) {
  requireLibrarian(decoded);
  const member = await findMember(db, input.libraryNumber);
  const copy = await findCopy(db, input.copyBarcode);
  const loanRef = db.collection("loans").doc();
  await db.runTransaction(async tx => {
    const memberRef = db.collection("users").doc(member.id);
    const bookRef = db.collection("books").doc(copy.data().bookId);
    const [memberSnap, copySnap, bookSnap] = await Promise.all([
      tx.get(memberRef), tx.get(copy.ref), tx.get(bookRef)
    ]);
    if (!memberSnap.exists || memberSnap.data().isApproved !== true) {
      throw new ApiError(412, "failed-precondition", "This member is not approved.");
    }
    if (!copySnap.exists || copySnap.data().status !== "Available") {
      throw new ApiError(412, "failed-precondition", "This physical copy is already on loan.");
    }
    if (!bookSnap.exists || Number(bookSnap.data().available || 0) < 1) {
      throw new ApiError(412, "failed-precondition", "No available stock remains for this title.");
    }
    const due = new Date();
    due.setDate(due.getDate() + 14);
    tx.update(copy.ref, { status: "Borrowed", borrowedBy: member.id, borrowedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.update(bookRef, { available: Number(bookSnap.data().available) - 1, updatedAt: FieldValue.serverTimestamp() });
    tx.create(loanRef, {
      userId: member.id, userName: memberSnap.data().fullName, bookId: bookSnap.id, bookTitle: bookSnap.data().title,
      bookCopyId: copy.id, copyBarcode: copySnap.data().barcode, status: "Borrowed",
      borrowedAt: FieldValue.serverTimestamp(), dueAt: due.toISOString(), createdAt: FieldValue.serverTimestamp(), issuedBy: decoded.uid
    });
  });
  return { message: member.data().fullName + " — " + copy.data().title + " issued." };
}

async function returnBookCopy(db, decoded, input) {
  requireLibrarian(decoded);
  const copy = await findCopy(db, input.copyBarcode);
  const matches = await db.collection("loans").where("bookCopyId", "==", copy.id).get();
  const loanDoc = matches.docs.find(doc => doc.data().status === "Borrowed");
  if (!loanDoc) throw new ApiError(412, "failed-precondition", "This copy has no active loan.");
  await db.runTransaction(async tx => {
    const bookRef = db.collection("books").doc(copy.data().bookId);
    const [copySnap, loanSnap, bookSnap] = await Promise.all([
      tx.get(copy.ref), tx.get(loanDoc.ref), tx.get(bookRef)
    ]);
    if (!copySnap.exists || copySnap.data().status !== "Borrowed" || !loanSnap.exists || loanSnap.data().status !== "Borrowed") {
      throw new ApiError(412, "failed-precondition", "This copy was already returned or its loan changed.");
    }
    if (!bookSnap.exists) throw new ApiError(404, "not-found", "The title record is missing.");
    tx.update(copy.ref, { status: "Available", returnedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.update(bookRef, { available: Number(bookSnap.data().available || 0) + 1, updatedAt: FieldValue.serverTimestamp() });
    tx.update(loanDoc.ref, { status: "Returned", returnedAt: FieldValue.serverTimestamp(), returnedBy: decoded.uid });
  });
  return { message: copy.data().title + " returned successfully." };
}

const actions = {
  createLearnerProfile,
  reviewLearnerMembership,
  registerBookCopies,
  recordMemberAttendance,
  issueBookCopy,
  returnBookCopy
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed.", code: "method-not-allowed" });
  }
  try {
    const decoded = await authenticate(req);
    const action = clean(req.body?.action, 80);
    const operation = actions[action];
    if (!operation) throw new ApiError(400, "invalid-argument", "Unknown library operation.");
    const result = await operation(getServices().db, decoded, req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    return res.status(500).json({ error: "The library service encountered an unexpected error.", code: "internal" });
  }
}
