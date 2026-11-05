import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy,
  query, runTransaction, serverTimestamp, setDoc, updateDoc, where
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { getFirebase } from "../lib/firebase";
import { LOAN_DAYS, MAX_EBOOK_BYTES, dateMillis, errorMessage, safeFileName } from "../lib/format";
import { useAuth } from "./AuthProvider";
import { useToast } from "./ToastProvider";

const LibraryContext = createContext(null);

export function useLibrary() {
  return useContext(LibraryContext);
}

const asDocuments = (snap) => snap.docs.map(item => ({ id: item.id, ...item.data() }));

export function LibraryProvider({ children }) {
  const fb = getFirebase();
  const { showToast } = useToast();
  const { user, profile, librarian } = useAuth();

  const [books, setBooks] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [ebooks, setEbooks] = useState([]);
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loans, setLoans] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [capacity, setCapacity] = useState(100);
  const [myRequests, setMyRequests] = useState([]);
  const [myLoans, setMyLoans] = useState([]);
  const [scanMemberCode, setScanMemberCode] = useState("");
  const scanMemberRef = useRef("");

  const refreshPublic = useCallback(async () => {
    if (!fb) return;
    try {
      const [booksSnap, newsSnap, eventsSnap] = await Promise.all([
        getDocs(query(collection(fb.db, "books"), orderBy("title"))),
        getDocs(query(collection(fb.db, "announcements"), orderBy("createdAt", "desc"), limit(20))),
        getDocs(query(collection(fb.db, "events"), orderBy("createdAt", "desc"), limit(20)))
      ]);
      setBooks(asDocuments(booksSnap));
      setAnnouncements(asDocuments(newsSnap));
      setEvents(asDocuments(eventsSnap));
    } catch (error) {
      // Permission noise for empty collections is expected; anything else is surfaced.
      if (error.code !== "permission-denied") showToast(errorMessage(error), "error");
    }
    // Guests browse the e-book catalogue too; the files stay behind Storage rules.
    // Kept in its own block so a rules revision that still guards the collection
    // cannot take the book catalogue and announcements down with it.
    try {
      const ebookSnap = await getDocs(query(collection(fb.db, "ebooks"), orderBy("createdAt", "desc"), limit(100)));
      setEbooks(asDocuments(ebookSnap));
    } catch (error) {
      if (error.code !== "permission-denied") showToast(errorMessage(error), "error");
    }
  }, [fb, showToast]);

  const refreshMember = useCallback(async () => {
    if (!fb || !user || !profile) return;
    try {
      const [requestSnap, loanSnap] = await Promise.all([
        getDocs(query(collection(fb.db, "borrowRequests"), where("userId", "==", user.uid))),
        getDocs(query(collection(fb.db, "loans"), where("userId", "==", user.uid)))
      ]);
      setMyRequests(asDocuments(requestSnap));
      setMyLoans(asDocuments(loanSnap));
    } catch (error) {
      showToast(errorMessage(error), "error");
    }
  }, [fb, user, profile, showToast]);

  const refreshAdmin = useCallback(async () => {
    if (!fb || !librarian) return;
    try {
      const [users, requestSnap, loanSnap, attendanceSnap, ebookSnap, newsSnap, eventsSnap, settings] = await Promise.all([
        getDocs(query(collection(fb.db, "users"), orderBy("createdAt", "desc"), limit(1000))),
        getDocs(query(collection(fb.db, "borrowRequests"), orderBy("createdAt", "desc"), limit(1000))),
        getDocs(query(collection(fb.db, "loans"), orderBy("createdAt", "desc"), limit(1000))),
        getDocs(query(collection(fb.db, "attendance"), orderBy("checkInAt", "desc"), limit(500))),
        getDocs(query(collection(fb.db, "ebooks"), orderBy("createdAt", "desc"), limit(200))),
        getDocs(query(collection(fb.db, "announcements"), orderBy("createdAt", "desc"), limit(100))),
        getDocs(query(collection(fb.db, "events"), orderBy("createdAt", "desc"), limit(100))),
        getDoc(doc(fb.db, "settings", "library"))
      ]);
      setMembers(asDocuments(users));
      setRequests(asDocuments(requestSnap));
      setLoans(asDocuments(loanSnap));
      setAttendance(asDocuments(attendanceSnap));
      setEbooks(asDocuments(ebookSnap));
      setAnnouncements(asDocuments(newsSnap));
      setEvents(asDocuments(eventsSnap));
      setCapacity(settings.exists() ? Number(settings.data().capacity || 100) : 100);
    } catch (error) {
      showToast(errorMessage(error), "error");
    }
  }, [fb, librarian, showToast]);

  useEffect(() => {
    void refreshPublic();
  }, [refreshPublic]);

  const requestBook = useCallback(async (bookId) => {
    if (!fb || !user || !profile) {
      showToast("Log in to request a book.", "error");
      return;
    }
    if (!profile.isApproved) {
      showToast("Your membership must be approved before borrowing.", "error");
      return;
    }
    const book = books.find(item => item.id === bookId);
    if (!book || Number(book.available || 0) < 1) {
      showToast("This book is currently unavailable.", "error");
      return;
    }
    try {
      const existing = await getDocs(query(
        collection(fb.db, "borrowRequests"),
        where("userId", "==", user.uid),
        where("bookId", "==", bookId),
        where("status", "==", "Pending")
      ));
      if (!existing.empty) {
        showToast("You already have a pending request for this book.", "error");
        return;
      }
      await addDoc(collection(fb.db, "borrowRequests"), {
        userId: user.uid,
        userName: profile.fullName,
        bookId,
        bookTitle: book.title,
        bookCategory: book.category || "Other",
        status: "Pending",
        createdAt: serverTimestamp()
      });
      showToast("Borrow request sent to the librarian.");
      await refreshMember();
    } catch (error) {
      showToast(errorMessage(error), "error");
    }
  }, [fb, user, profile, books, refreshMember, showToast]);

  const reviewLearner = useCallback(async (uid, decision) => {
    if (!fb || !librarian || !["Approved", "Denied"].includes(decision)) return;
    try {
      // Membership decisions run in the Admin SDK callable so the librarian
      // custom claim is enforced on the server, even if deployed rules are stale.
      const reviewMembership = httpsCallable(fb.functions, "reviewLearnerMembership");
      const result = await reviewMembership({ uid, decision });
      showToast(result.data?.message || "Membership " + decision.toLowerCase() + " successfully.");
      await refreshAdmin();
    } catch (error) {
      console.error("Membership review failed:", error?.code || error?.message || error);
      showToast(errorMessage(error), "error");
    }
  }, [fb, librarian, refreshAdmin, showToast]);

  const processRequest = useCallback(async (requestId, status) => {
    if (!fb || !librarian || !user) return;
    const request = requests.find(item => item.id === requestId);
    if (!request) return;
    try {
      if (status === "Declined") {
        await updateDoc(doc(fb.db, "borrowRequests", requestId), {
          status: "Declined", processedAt: serverTimestamp(), processedBy: user.uid
        });
      } else {
        const loanRef = doc(collection(fb.db, "loans"));
        await runTransaction(fb.db, async (transaction) => {
          const requestRef = doc(fb.db, "borrowRequests", requestId);
          const bookRef = doc(fb.db, "books", request.bookId);
          const [requestSnap, bookSnap] = await Promise.all([transaction.get(requestRef), transaction.get(bookRef)]);
          if (!requestSnap.exists() || !bookSnap.exists()) throw new Error("Request or book no longer exists.");
          const currentRequest = requestSnap.data();
          const book = bookSnap.data();
          if (currentRequest.status !== "Pending") throw new Error("This request has already been processed.");
          if (Number(book.available || 0) < 1) throw new Error("No copies of this book are available.");
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + LOAN_DAYS);
          transaction.update(bookRef, { available: Number(book.available) - 1, updatedAt: serverTimestamp() });
          transaction.set(loanRef, {
            userId: currentRequest.userId,
            userName: currentRequest.userName,
            bookId: currentRequest.bookId,
            bookTitle: currentRequest.bookTitle,
            bookCategory: currentRequest.bookCategory,
            status: "Borrowed",
            borrowedAt: serverTimestamp(),
            dueAt: dueDate.toISOString(),
            createdAt: serverTimestamp(),
            issuedBy: user.uid
          });
          transaction.update(requestRef, {
            status: "Approved", loanId: loanRef.id,
            processedAt: serverTimestamp(), processedBy: user.uid
          });
        });
      }
      showToast(status === "Approved" ? "Request approved and book issued." : "Request declined.");
      await refreshPublic();
      await refreshAdmin();
    } catch (error) {
      showToast(errorMessage(error), "error");
    }
  }, [fb, librarian, user, requests, refreshPublic, refreshAdmin, showToast]);

  const returnLoan = useCallback(async (requestId, loanId) => {
    if (!fb || !librarian || !user) return;
    try {
      await runTransaction(fb.db, async (transaction) => {
        const loanRef = doc(fb.db, "loans", loanId);
        const loanSnap = await transaction.get(loanRef);
        if (!loanSnap.exists() || loanSnap.data().status !== "Borrowed") throw new Error("This loan is already returned or unavailable.");
        const bookRef = doc(fb.db, "books", loanSnap.data().bookId);
        const bookSnap = await transaction.get(bookRef);
        if (!bookSnap.exists()) throw new Error("The book record is missing.");
        transaction.update(bookRef, { available: Number(bookSnap.data().available || 0) + 1, updatedAt: serverTimestamp() });
        transaction.update(loanRef, { status: "Returned", returnedAt: serverTimestamp(), returnedBy: user.uid });
        transaction.update(doc(fb.db, "borrowRequests", requestId), { status: "Returned", returnedAt: serverTimestamp() });
      });
      showToast("Book return recorded.");
      await refreshPublic();
      await refreshAdmin();
    } catch (error) {
      showToast(errorMessage(error), "error");
    }
  }, [fb, librarian, user, refreshPublic, refreshAdmin, showToast]);

  const registerBook = useCallback(async ({ title, author, category, quantity, description, coverFile }) => {
    if (!fb || !librarian || !user) return null;
    if (!title || !Number.isInteger(quantity) || quantity < 1 || quantity > 400) {
      showToast("Enter a title and between 1 and 400 physical copies.", "error");
      return null;
    }
    let uploadedCover = null;
    let bookCreated = false;
    try {
      if (coverFile) {
        const extension = coverFile.type === "image/png" ? "png" : coverFile.type === "image/webp" ? "webp" : "jpg";
        const path = "book-covers/" + user.uid + "/" + Date.now() + "-" + Math.random().toString(36).slice(2) + "." + extension;
        const target = storageRef(fb.storage, path);
        await uploadBytes(target, coverFile, { contentType: coverFile.type });
        uploadedCover = { path: target.fullPath, url: await getDownloadURL(target) };
      }
      const createBook = httpsCallable(fb.functions, "registerBookCopies");
      const result = await createBook({
        title,
        author,
        category,
        quantity,
        coverUrl: uploadedCover?.url || "",
        coverStoragePath: uploadedCover?.path || "",
        description: description || ""
      });
      bookCreated = true;
      showToast("Book registered. " + quantity + " individual copy barcodes generated.");
      await refreshPublic();
      await refreshAdmin();
      return { title, copies: result.data.copies || [] };
    } catch (error) {
      if (uploadedCover && !bookCreated) {
        try { await deleteObject(storageRef(fb.storage, uploadedCover.path)); } catch (_) { /* best effort */ }
      }
      showToast(errorMessage(error), "error");
      return null;
    }
  }, [fb, librarian, user, refreshPublic, refreshAdmin, showToast]);

  const deleteBook = useCallback(async (book) => {
    if (!fb || !librarian) return false;
    try {
      if (Number(book.available || 0) !== Number(book.quantity || 0)) {
        throw new Error("This book has active loans. Return all copies before deleting it.");
      }
      await deleteDoc(doc(fb.db, "books", book.id));
      if (book.coverStoragePath) {
        try { await deleteObject(storageRef(fb.storage, book.coverStoragePath)); } catch (_) { /* best effort */ }
      }
      showToast("Book removed from catalogue.");
      await refreshPublic();
      await refreshAdmin();
      return true;
    } catch (error) {
      showToast(errorMessage(error), "error");
      return false;
    }
  }, [fb, librarian, refreshPublic, refreshAdmin, showToast]);

  const processUnifiedCode = useCallback(async (rawCode, mode) => {
    if (!fb || !librarian || !user) return;
    const code = String(rawCode || "").trim();
    if (!code) return;
    try {
      if (mode === "check-in" || mode === "check-out") {
        const members = await getDocs(query(collection(fb.db, "users"), where("libraryNumber", "==", code), limit(1)));
        if (members.empty) throw new Error("No member matches that library number.");
        const memberDoc = members.docs[0];
        const member = memberDoc.data();
        if (member.role !== "learner" || member.isApproved !== true) throw new Error("This member is not approved.");
        const presenceRef = doc(fb.db, "memberPresence", memberDoc.id);
        const presenceSnap = await getDoc(presenceRef);
        const attendanceRef = presenceSnap.exists() && mode === "check-out"
          ? doc(fb.db, "attendance", presenceSnap.data().attendanceId)
          : doc(collection(fb.db, "attendance"));

        if (mode === "check-in") {
          if (presenceSnap.exists() && presenceSnap.data().status === "In library") throw new Error("This member is already checked in.");
          const active = await getDocs(query(collection(fb.db, "memberPresence"), where("status", "==", "In library")));
          if (active.size >= capacity) throw new Error("The library has reached its configured capacity.");
        } else if (!presenceSnap.exists() || presenceSnap.data().status !== "In library" || !presenceSnap.data().attendanceId) {
          throw new Error("This member has no active check-in.");
        }

        await runTransaction(fb.db, async (transaction) => {
          const [latestPresence, latestMember] = await Promise.all([
            transaction.get(presenceRef),
            transaction.get(memberDoc.ref)
          ]);
          if (!latestMember.exists() || latestMember.data().isApproved !== true || latestMember.data().role !== "learner") {
            throw new Error("This member is not approved.");
          }
          if (mode === "check-in") {
            if (latestPresence.exists() && latestPresence.data().status === "In library") throw new Error("This member is already checked in.");
            transaction.set(attendanceRef, {
              uid: memberDoc.id, memberName: member.fullName, libraryNumber: member.libraryNumber,
              checkInAt: serverTimestamp(), checkOutAt: null, status: "In library", recordedBy: user.uid
            });
            transaction.set(presenceRef, {
              uid: memberDoc.id, attendanceId: attendanceRef.id, status: "In library", updatedAt: serverTimestamp()
            });
          } else {
            if (!latestPresence.exists() || latestPresence.data().status !== "In library") throw new Error("This member has no active check-in.");
            const activeAttendanceRef = doc(fb.db, "attendance", latestPresence.data().attendanceId);
            const activeAttendance = await transaction.get(activeAttendanceRef);
            if (!activeAttendance.exists() || activeAttendance.data().status !== "In library") {
              throw new Error("The active attendance record could not be found.");
            }
            transaction.update(activeAttendanceRef, {
              checkOutAt: serverTimestamp(), status: "Checked out", checkedOutBy: user.uid
            });
            transaction.update(presenceRef, { status: "Checked out", updatedAt: serverTimestamp() });
          }
        });
        showToast(member.fullName + (mode === "check-in" ? " checked in." : " checked out."));
      } else if (mode === "issue-book") {
        if (!scanMemberRef.current) {
          scanMemberRef.current = code;
          setScanMemberCode(code);
          showToast("Member scanned. Scan the book copy.");
          return;
        }
        const call = httpsCallable(fb.functions, "issueBookCopy");
        const result = await call({ libraryNumber: scanMemberRef.current, copyBarcode: code });
        scanMemberRef.current = "";
        setScanMemberCode("");
        showToast(result.data.message || "Book issued.");
      } else if (mode === "return-book") {
        const call = httpsCallable(fb.functions, "returnBookCopy");
        const result = await call({ copyBarcode: code });
        showToast(result.data.message || "Book returned.");
      }
      await refreshPublic();
      await refreshAdmin();
    } catch (error) {
      scanMemberRef.current = "";
      setScanMemberCode("");
      showToast(errorMessage(error), "error");
    }
  }, [fb, librarian, user, capacity, refreshPublic, refreshAdmin, showToast]);

  const updateCapacity = useCallback(async (nextCapacity) => {
    if (!fb || !librarian || !user) return false;
    if (!Number.isInteger(nextCapacity) || nextCapacity < 1 || nextCapacity > 10000) {
      showToast("Capacity must be between 1 and 10,000.", "error");
      return false;
    }
    try {
      await setDoc(doc(fb.db, "settings", "library"), {
        capacity: nextCapacity, updatedAt: serverTimestamp(), updatedBy: user.uid
      }, { merge: true });
      setCapacity(nextCapacity);
      showToast("Library capacity updated.");
      await refreshAdmin();
      return true;
    } catch (error) {
      showToast(errorMessage(error), "error");
      return false;
    }
  }, [fb, librarian, user, refreshAdmin, showToast]);

  const uploadEbook = useCallback(async ({ title, category, file }) => {
    if (!fb || !librarian || !user) return false;
    if (!(file instanceof File) || !file.size) {
      showToast("Choose a PDF or EPUB file.", "error");
      return false;
    }
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isEpub = file.type === "application/epub+zip" || file.name.toLowerCase().endsWith(".epub");
    if (!isPdf && !isEpub) {
      showToast("Only PDF and EPUB files are allowed.", "error");
      return false;
    }
    if (file.size > MAX_EBOOK_BYTES) {
      showToast("E-books must be smaller than 30 MB.", "error");
      return false;
    }
    try {
      const record = doc(collection(fb.db, "ebooks"));
      const target = storageRef(fb.storage, "ebooks/" + record.id + "-" + safeFileName(file.name, "ebook"));
      await uploadBytes(target, file, { contentType: isPdf ? "application/pdf" : "application/epub+zip" });
      // Only the storage path is stored. A Firebase download URL carries its own
      // access token, so persisting one on a publicly readable document would hand
      // the file to guests and bypass the account requirement.
      await setDoc(record, {
        title, category, fileName: file.name, storagePath: target.fullPath,
        size: file.size, uploadedBy: user.uid, createdAt: serverTimestamp()
      });
      showToast("E-book uploaded.");
      await refreshAdmin();
      return true;
    } catch (error) {
      showToast(errorMessage(error), "error");
      return false;
    }
  }, [fb, librarian, user, refreshAdmin, showToast]);

  const removeEbook = useCallback(async (book) => {
    if (!fb || !librarian) return;
    try {
      await deleteDoc(doc(fb.db, "ebooks", book.id));
      if (book.storagePath) {
        try { await deleteObject(storageRef(fb.storage, book.storagePath)); } catch (_) { /* best effort */ }
      }
      showToast("E-book removed.");
      await refreshAdmin();
    } catch (error) {
      showToast(errorMessage(error), "error");
    }
  }, [fb, librarian, refreshAdmin, showToast]);

  /**
   * The e-book catalogue is public but the files are not: Storage only serves
   * /ebooks to signed-in users, so the download URL is resolved on demand
   * instead of being stored on the document.
   */
  const resolveEbookUrl = useCallback(async (book) => {
    if (!fb || !book) return "";
    if (!user) {
      showToast("Log in or create an account to download e-books.", "error");
      return "";
    }
    if (book.storagePath) {
      try {
        return await getDownloadURL(storageRef(fb.storage, book.storagePath));
      } catch (error) {
        showToast(errorMessage(error), "error");
        return "";
      }
    }
    // Legacy records saved before the tokenised URL stopped being persisted.
    return book.downloadUrl || "";
  }, [fb, user, showToast]);

  const publishNews = useCallback(async ({ type, title, body, date }) => {
    if (!fb || !librarian || !user) return false;
    try {
      const target = type === "event" ? "events" : "announcements";
      await addDoc(collection(fb.db, target), {
        title, body, date: date || null, type, createdAt: serverTimestamp(), createdBy: user.uid
      });
      showToast("Published successfully.");
      await refreshPublic();
      await refreshAdmin();
      return true;
    } catch (error) {
      showToast(errorMessage(error), "error");
      return false;
    }
  }, [fb, librarian, user, refreshPublic, refreshAdmin, showToast]);

  const deletePost = useCallback(async (collectionName, id) => {
    if (!fb || !librarian) return;
    try {
      await deleteDoc(doc(fb.db, collectionName, id));
      showToast("Post deleted.");
      await refreshPublic();
      await refreshAdmin();
    } catch (error) {
      showToast(errorMessage(error), "error");
    }
  }, [fb, librarian, refreshPublic, refreshAdmin, showToast]);

  const resetScanMember = useCallback(() => {
    scanMemberRef.current = "";
    setScanMemberCode("");
  }, []);

  const publicPosts = useMemo(() => [
    ...announcements.map(item => ({ ...item, announcementKind: "Announcement", source: "announcements" })),
    ...events.map(item => ({ ...item, announcementKind: "Event", source: "events" }))
  ].sort((a, b) => dateMillis(b.date || b.createdAt) - dateMillis(a.date || a.createdAt)), [announcements, events]);

  const value = useMemo(() => ({
    books, announcements, events, ebooks, members, requests, loans, attendance,
    capacity, myRequests, myLoans, publicPosts, scanMemberCode,
    refreshPublic, refreshMember, refreshAdmin, resetScanMember,
    requestBook, reviewLearner, processRequest, returnLoan,
    registerBook, deleteBook, processUnifiedCode, updateCapacity,
    uploadEbook, removeEbook, resolveEbookUrl, publishNews, deletePost
  }), [
    books, announcements, events, ebooks, members, requests, loans, attendance,
    capacity, myRequests, myLoans, publicPosts, scanMemberCode,
    refreshPublic, refreshMember, refreshAdmin, resetScanMember,
    requestBook, reviewLearner, processRequest, returnLoan,
    registerBook, deleteBook, processUnifiedCode, updateCapacity,
    uploadEbook, removeEbook, resolveEbookUrl, publishNews, deletePost
  ]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
