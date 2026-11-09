import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { dateMillis } from "../lib/format";
import { useAuth } from "./AuthProvider";
import { useToast } from "./ToastProvider";

const LibraryContext = createContext(null);

export function useLibrary() {
  return useContext(LibraryContext);
}

// Helper: extract paginated data array or plain array from a Laravel response
const extractList = (data) => Array.isArray(data) ? data : (data?.data ?? []);

export function LibraryProvider({ children }) {
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

  // ── Public data ───────────────────────────────────────────────────────────
  const refreshPublic = useCallback(async () => {
    try {
      const [booksData, postsData, ebooksData, settingsData] = await Promise.all([
        api.get("/books?per_page=1000"),
        api.get("/posts"),
        api.get("/ebooks?per_page=1000"),
        api.get("/settings"),
      ]);
      setBooks(extractList(booksData));

      // Posts endpoint returns a combined feed; split by type for compatibility
      const allPosts = Array.isArray(postsData) ? postsData : (postsData?.data ?? []);
      setAnnouncements(allPosts.filter(p => p.type === "announcement"));
      setEvents(allPosts.filter(p => p.type === "event"));

      setEbooks(extractList(ebooksData));
      setCapacity(Number(settingsData?.capacity ?? 100));
    } catch (err) {
      showToast(err.message || "Could not load library data.", "error");
    }
  }, [showToast]);

  // ── Member data ───────────────────────────────────────────────────────────
  const refreshMember = useCallback(async () => {
    if (!user) return;
    try {
      const [reqData, loanData] = await Promise.all([
        api.get("/my/requests?per_page=1000"),
        api.get("/my/loans?per_page=1000"),
      ]);
      setMyRequests(extractList(reqData));
      setMyLoans(extractList(loanData));
    } catch (err) {
      showToast(err.message || "Could not load your data.", "error");
    }
  }, [user, showToast]);

  // ── Admin data ────────────────────────────────────────────────────────────
  const refreshAdmin = useCallback(async () => {
    if (!librarian) return;
    try {
      const [membersData, reqData, loanData, attendData, ebooksData, postsData, settingsData] = await Promise.all([
        api.get("/members?per_page=1000"),
        api.get("/borrow-requests?per_page=1000"),
        api.get("/loans?per_page=1000"),
        api.get("/attendance?per_page=1000"),
        api.get("/ebooks?per_page=1000"),
        api.get("/posts"),
        api.get("/settings"),
      ]);
      setMembers(extractList(membersData));
      setRequests(extractList(reqData));
      setLoans(extractList(loanData));
      setAttendance(extractList(attendData));
      setEbooks(extractList(ebooksData));
      const allPosts = Array.isArray(postsData) ? postsData : (postsData?.data ?? []);
      setAnnouncements(allPosts.filter(p => p.type === "announcement"));
      setEvents(allPosts.filter(p => p.type === "event"));
      setCapacity(Number(settingsData?.capacity ?? 100));
    } catch (err) {
      showToast(err.message || "Could not load admin data.", "error");
    }
  }, [librarian, showToast]);

  useEffect(() => { void refreshPublic(); }, [refreshPublic]);
  useEffect(() => { if (user) void refreshMember(); }, [user, refreshMember]);
  useEffect(() => { if (librarian) void refreshAdmin(); }, [librarian, refreshAdmin]);

  // ── Borrow request ────────────────────────────────────────────────────────
  const requestBook = useCallback(async (bookId) => {
    if (!user || !profile) { showToast("Log in to request a book.", "error"); return; }
    if (!profile.is_approved && !profile.isApproved) {
      showToast("Your membership must be approved before borrowing.", "error"); return;
    }
    try {
      await api.post("/borrow-requests", { bookId });
      showToast("Borrow request sent to the librarian.");
      await refreshMember();
      await refreshPublic();
    } catch (err) {
      showToast(err.message || "Could not send borrow request.", "error");
    }
  }, [user, profile, refreshMember, refreshPublic, showToast]);

  // ── Membership review ─────────────────────────────────────────────────────
  const reviewLearner = useCallback(async (uid, decision) => {
    if (!librarian || !["Approved", "Denied"].includes(decision)) return;
    try {
      await api.post("/members/" + uid + "/review", { decision });
      showToast("Membership " + decision.toLowerCase() + " successfully.");
      await refreshAdmin();
    } catch (err) {
      showToast(err.message || "Membership review failed.", "error");
    }
  }, [librarian, refreshAdmin, showToast]);

  // ── Process borrow request (approve / decline) ────────────────────────────
  const processRequest = useCallback(async (requestId, status) => {
    if (!librarian) return;
    try {
      if (status === "Approved") {
        await api.post("/borrow-requests/" + requestId + "/approve");
      } else {
        await api.post("/borrow-requests/" + requestId + "/decline");
      }
      showToast(status === "Approved" ? "Request approved and book issued." : "Request declined.");
      await refreshPublic();
      await refreshAdmin();
    } catch (err) {
      showToast(err.message || "Could not process request.", "error");
    }
  }, [librarian, refreshPublic, refreshAdmin, showToast]);

  // ── Return loan ───────────────────────────────────────────────────────────
  const returnLoan = useCallback(async (_requestId, loanId) => {
    if (!librarian) return;
    try {
      await api.post("/loans/" + loanId + "/return");
      showToast("Book return recorded.");
      await refreshPublic();
      await refreshAdmin();
    } catch (err) {
      showToast(err.message || "Could not process return.", "error");
    }
  }, [librarian, refreshPublic, refreshAdmin, showToast]);

  // ── Register book ─────────────────────────────────────────────────────────
  const registerBook = useCallback(async ({ title, author, category, quantity, description, coverFile }) => {
    if (!librarian) return null;
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("quantity", String(quantity));
      if (author) form.append("author", author);
      if (category) form.append("category", category);
      if (description) form.append("description", description);
      if (coverFile) form.append("coverFile", coverFile);

      const data = await api.post("/books", form);
      showToast("Book registered. " + quantity + " individual copy barcodes generated.");
      await refreshPublic();
      await refreshAdmin();
      return { title, copies: data?.copies ?? [] };
    } catch (err) {
      showToast(err.message || "Could not register book.", "error");
      return null;
    }
  }, [librarian, refreshPublic, refreshAdmin, showToast]);

  // ── Delete book ───────────────────────────────────────────────────────────
  const deleteBook = useCallback(async (book) => {
    if (!librarian) return false;
    try {
      await api.delete("/books/" + book.id);
      showToast("Book removed from catalogue.");
      await refreshPublic();
      await refreshAdmin();
      return true;
    } catch (err) {
      showToast(err.message || "Could not delete book.", "error");
      return false;
    }
  }, [librarian, refreshPublic, refreshAdmin, showToast]);

  // ── Barcode circulation (check-in / check-out / issue / return) ───────────
  const processUnifiedCode = useCallback(async (rawCode, mode) => {
    if (!librarian) return;
    const code = String(rawCode || "").trim();
    if (!code) return;
    try {
      if (mode === "check-in") {
        await api.post("/attendance/check-in", { libraryNumber: code });
        showToast("Member checked in.");
      } else if (mode === "check-out") {
        await api.post("/attendance/check-out", { libraryNumber: code });
        showToast("Member checked out.");
      } else if (mode === "issue-book") {
        if (!scanMemberRef.current) {
          scanMemberRef.current = code;
          setScanMemberCode(code);
          showToast("Member scanned. Scan the book copy.");
          return;
        }
        await api.post("/circulation/issue", { libraryNumber: scanMemberRef.current, copyBarcode: code });
        scanMemberRef.current = "";
        setScanMemberCode("");
        showToast("Book issued.");
      } else if (mode === "return-book") {
        await api.post("/circulation/return", { copyBarcode: code });
        showToast("Book returned.");
      }
      await refreshPublic();
      await refreshAdmin();
    } catch (err) {
      scanMemberRef.current = "";
      setScanMemberCode("");
      showToast(err.message || "Operation failed.", "error");
    }
  }, [librarian, refreshPublic, refreshAdmin, showToast]);

  // ── Update capacity ───────────────────────────────────────────────────────
  const updateCapacity = useCallback(async (nextCapacity) => {
    if (!librarian) return false;
    if (!Number.isInteger(nextCapacity) || nextCapacity < 1 || nextCapacity > 10000) {
      showToast("Capacity must be between 1 and 10,000.", "error"); return false;
    }
    try {
      await api.put("/settings", { capacity: nextCapacity });
      setCapacity(nextCapacity);
      showToast("Library capacity updated.");
      await refreshAdmin();
      return true;
    } catch (err) {
      showToast(err.message || "Could not update capacity.", "error");
      return false;
    }
  }, [librarian, refreshAdmin, showToast]);

  // ── Upload e-book ─────────────────────────────────────────────────────────
  const uploadEbook = useCallback(async ({ title, category, file }) => {
    if (!librarian) return false;
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("category", category || "");
      form.append("file", file);
      await api.post("/ebooks", form);
      showToast("E-book uploaded.");
      await refreshAdmin();
      return true;
    } catch (err) {
      showToast(err.message || "Could not upload e-book.", "error");
      return false;
    }
  }, [librarian, refreshAdmin, showToast]);

  // ── Remove e-book ─────────────────────────────────────────────────────────
  const removeEbook = useCallback(async (book) => {
    if (!librarian) return;
    try {
      await api.delete("/ebooks/" + book.id);
      showToast("E-book removed.");
      await refreshAdmin();
    } catch (err) {
      showToast(err.message || "Could not remove e-book.", "error");
    }
  }, [librarian, refreshAdmin, showToast]);

  // ── Resolve e-book download URL ───────────────────────────────────────────
  const resolveEbookUrl = useCallback(async (book) => {
    if (!user) { showToast("Log in or create an account to download e-books.", "error"); return ""; }
    try {
      const data = await api.get("/ebooks/" + book.id + "/download-url");
      return data?.url || data?.download_url || "";
    } catch (err) {
      showToast(err.message || "Could not get download link.", "error");
      return "";
    }
  }, [user, showToast]);

  // ── Publish news / event ──────────────────────────────────────────────────
  const publishNews = useCallback(async ({ type, title, body, date }) => {
    if (!librarian) return false;
    try {
      await api.post("/posts", { type, title, body, date: date || null });
      showToast("Published successfully.");
      await refreshPublic();
      await refreshAdmin();
      return true;
    } catch (err) {
      showToast(err.message || "Could not publish post.", "error");
      return false;
    }
  }, [librarian, refreshPublic, refreshAdmin, showToast]);

  // ── Delete post ───────────────────────────────────────────────────────────
  const deletePost = useCallback(async (collectionOrType, id) => {
    if (!librarian) return;
    // collectionOrType is "announcements"/"events" from Firestore days;
    // map to the type string the Laravel endpoint expects
    const type = collectionOrType === "events" ? "event" : "announcement";
    try {
      await api.delete("/posts/" + type + "/" + id);
      showToast("Post deleted.");
      await refreshPublic();
      await refreshAdmin();
    } catch (err) {
      showToast(err.message || "Could not delete post.", "error");
    }
  }, [librarian, refreshPublic, refreshAdmin, showToast]);

  const resetScanMember = useCallback(() => {
    scanMemberRef.current = "";
    setScanMemberCode("");
  }, []);

  // Combined public posts feed (kept for component compatibility)
  const publicPosts = useMemo(() => [
    ...announcements.map(item => ({ ...item, announcementKind: "Announcement", source: "announcements" })),
    ...events.map(item => ({ ...item, announcementKind: "Event", source: "events" }))
  ].sort((a, b) => dateMillis(b.date || b.created_at || b.createdAt) - dateMillis(a.date || a.created_at || a.createdAt)),
    [announcements, events]);

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
