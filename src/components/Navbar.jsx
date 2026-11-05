import { useEffect, useRef, useState } from "react";
import { useAuth } from "../store/AuthProvider";

const SECTIONS = [
  { id: "heroSection", label: "Home" },
  { id: "libShelfSection", label: "Lib Shelf" },
  { id: "newsSection", label: "News & Events" },
  { id: "profileSection", label: "My Profile", learnerOnly: true },
  { id: "librarianSection", label: "Librarian Desk", librarianOnly: true }
];

export function Navbar({ section, onNavigate, onOpenAuth }) {
  const { user, profile, librarian, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef(null);
  const indicatorRef = useRef(null);
  const dropdownRef = useRef(null);
  const toggleRef = useRef(null);
  const buttonRefs = useRef({});

  useEffect(() => {
    let queued = false;
    const update = () => {
      queued = false;
      setScrolled(window.scrollY > 28);
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Position the sliding pill behind the active nav button.
  useEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    const target = buttonRefs.current[section];
    if (!nav || !indicator || !target || nav.getClientRects().length === 0) return;

    const navRect = nav.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    indicator.style.setProperty("--liquid-x", targetRect.left - navRect.left - nav.clientLeft + nav.scrollLeft + "px");
    indicator.style.setProperty("--liquid-y", targetRect.top - navRect.top - nav.clientTop + nav.scrollTop + "px");
    indicator.style.setProperty("--liquid-width", targetRect.width + "px");
    indicator.style.setProperty("--liquid-height", targetRect.height + "px");
    nav.dataset.liquidReady = "true";
    indicator.classList.remove("liquid-bounce");
    window.requestAnimationFrame(() => indicator.classList.add("liquid-bounce"));
  }, [section, user, profile, librarian, mobileOpen]);

  useEffect(() => {
    const onDocumentClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setDropdownOpen(false);
      if (navRef.current?.contains(event.target) || toggleRef.current?.contains(event.target)) return;
      setMobileOpen(false);
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      const mobileWasOpen = mobileOpen;
      setMobileOpen(false);
      setDropdownOpen(false);
      if (mobileWasOpen) toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const navigate = (id) => {
    setMobileOpen(false);
    setDropdownOpen(false);
    onNavigate(id);
  };

  const visibleSections = SECTIONS.filter(item => {
    if (item.learnerOnly) return Boolean(user && profile);
    if (item.librarianOnly) return librarian;
    return true;
  });

  return (
    <header className={"navbar" + (scrolled ? " amg-scrolled" : "") + (mobileOpen ? " mobile-nav-open" : "")}>
      <button className="nav-brand" type="button" onClick={() => navigate("heroSection")} aria-label="AMG Library home">
        <img src="AMG.images/logo.jpg" alt="" className="brand-mark" />
        <span>AMG <b>LIBRARY KIBRA</b></span>
      </button>

      <button
        ref={toggleRef}
        className="mobile-nav-toggle"
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="mainNavLinks"
        onClick={() => setMobileOpen(open => !open)}
      >
        <span>{mobileOpen ? "Close" : "Menu"}</span>
      </button>

      <nav id="mainNavLinks" ref={navRef} className="nav-links liquid-nav" aria-label="Main navigation">
        <span ref={indicatorRef} className="liquid-nav-indicator" aria-hidden="true"></span>

        {visibleSections.map(item => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              ref={(element) => { buttonRefs.current[item.id] = element; }}
              className={"nav-btn" + (active ? " active" : "")}
              data-section={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <span>{item.label}</span>
            </button>
          );
        })}

        {user ? (
          <div id="userBadge" className="user-badge">
            <span>{profile?.fullName || user.email || "Member"}</span>
            <button className="btn btn-sm btn-outline" type="button" onClick={logout}>Logout</button>
          </div>
        ) : (
          <div id="memberDropdown" ref={dropdownRef} className="dropdown">
            <button
              className="btn btn-primary"
              type="button"
              aria-expanded={dropdownOpen}
              aria-controls="dropdownMenu"
              onClick={() => setDropdownOpen(open => !open)}
            >
              <span>Become a Member</span>
            </button>
            <div id="dropdownMenu" className={"dropdown-content" + (dropdownOpen ? " show" : "")}>
              <button type="button" onClick={() => { setDropdownOpen(false); onOpenAuth("login"); }}><span>Log In</span></button>
              <button type="button" onClick={() => { setDropdownOpen(false); onOpenAuth("register"); }}><span>Register</span></button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
