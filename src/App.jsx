import { useCallback, useEffect, useRef, useState } from "react";
import { ToastProvider, useToast } from "./store/ToastProvider";
import { AuthProvider, useAuth } from "./store/AuthProvider";
import { LibraryProvider, useLibrary } from "./store/LibraryProvider";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { LibShelf } from "./components/LibShelf";
import { MemberProfile } from "./components/MemberProfile";
import { NewsSection } from "./components/NewsSection";
import { AuthModal } from "./components/AuthModal";
import { Desk } from "./components/librarian/Desk";

function Shell() {
  const { user, profile, librarian, ready } = useAuth();
  const { books, publicPosts } = useLibrary();
  const { showToast } = useToast();

  const [section, setSection] = useState("heroSection");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const routedUid = useRef("");

  // Route a visitor to the workspace their verified account can access, then
  // leave them in control. The librarian desk still requires the claim.
  useEffect(() => {
    if (!ready) return;
    if (!user) {
      if (routedUid.current !== "") {
        routedUid.current = "";
        setSection("heroSection");
      }
      return;
    }
    if (routedUid.current === user.uid) return;
    const isLibrarian = user.role === "librarian";
    if (isLibrarian) {
      routedUid.current = user.uid;
      setSection("librarianSection");
      return;
    }
    if (user) {
      routedUid.current = user.uid;
      setSection("profileSection");
    }
  }, [ready, user, librarian]);

  const showSection = useCallback((id) => {
    if (id === "profileSection" && !user) {
      setAuthMode("login");
      setAuthOpen(true);
      showToast("Log in to view your profile.", "error");
      return;
    }
    if (id === "librarianSection" && !librarian) {
      showToast("Librarian access requires an authorized account.", "error");
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }
    setSection(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [user, librarian, showToast]);

  const openAuth = useCallback((mode = "login") => {
    setAuthMode(mode);
    setAuthOpen(true);
  }, []);

  return (
    <>
      <Navbar section={section} onNavigate={showSection} onOpenAuth={openAuth} />

      <main className="container">
        {section === "heroSection" && null}

        <Hero
          active={section === "heroSection"}
          onNavigate={showSection}
          onOpenAuth={openAuth}
          books={books}
          posts={publicPosts}
        />
        <LibShelf active={section === "libShelfSection"} onOpenAuth={openAuth} />
        <MemberProfile active={section === "profileSection"} />
        <NewsSection active={section === "newsSection"} posts={publicPosts} />
        <Desk active={section === "librarianSection"} />
      </main>

      <footer className="site-footer">
        <span>© <span id="year">{new Date().getFullYear()}</span> AMG Library</span>
        <span>Learn. Discover. Grow.</span>
      </footer>

      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onModeChange={setAuthMode}
      />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <LibraryProvider>
          <Shell />
        </LibraryProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
