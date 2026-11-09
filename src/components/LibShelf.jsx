import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../store/AuthProvider";
import { useLibrary } from "../store/LibraryProvider";
import { BOOK_CATEGORIES } from "../lib/format";
import { DEMO_BOOKS } from "../lib/demoBooks";

const starKey = (uid) => "amg_starred_" + (uid || "guest");

function readStars(uid) {
  try {
    return JSON.parse(localStorage.getItem(starKey(uid)) || "[]");
  } catch (_) {
    return [];
  }
}

export function LibShelf({ active, onOpenAuth }) {
  const { user, profile } = useAuth();
  const { books, ebooks, requestBook, resolveEbookUrl } = useLibrary();
  // Until the librarian registers real books, the shelf previews its layout with
  // clearly marked sample cards. DEMO_BOOKS is never written to Firestore.
  const demoMode = books.length === 0;
  const catalogue = demoMode ? DEMO_BOOKS : books;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [stars, setStars] = useState(() => readStars(user?.uid));

  useEffect(() => {
    setStars(readStars(user?.uid));
  }, [user?.uid]);

  const toggleStar = (bookId) => {
    setStars(current => {
      const next = current.includes(bookId) ? current.filter(id => id !== bookId) : [...current, bookId];
      localStorage.setItem(starKey(user?.uid), JSON.stringify(next));
      return next;
    });
  };

  // The catalogue is public; the file behind it is only served to signed-in users.
  const openEbook = async (book) => {
    const url = await resolveEbookUrl(book);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return catalogue.filter(book => {
      const haystack = [book.title, book.author, book.category, book.description].join(" ").toLowerCase();
      const matchesSearch = !needle || haystack.includes(needle);
      const matchesCategory = category === "All" || category === "Starred" || book.category === category;
      const matchesStar = category !== "Starred" || stars.includes(book.id);
      return matchesSearch && matchesCategory && matchesStar;
    });
  }, [catalogue, search, category, stars]);

  return (
    <section id="libShelfSection" className={"section" + (active ? " active" : "")}>
      <div className="section-header">
        <h2>Lib Shelf</h2>
        <p>Search the catalogue, star favourites and request available books.</p>
      </div>

      {demoMode ? (
        <p className="notice notice-info">
          <strong>Sample catalogue.</strong> The librarian has not registered any books yet, so these
          cards only show how the shelf looks. Search and filters work; borrowing is disabled.
        </p>
      ) : null}

      <div className="toolbar">
        <input
          id="searchInput"
          className="search-input"
          type="search"
          placeholder="Search by book title, author or category…"
          aria-label="Search books"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
        <select
          id="categoryFilter"
          aria-label="Filter by category"
          value={category}
          onChange={event => setCategory(event.target.value)}
        >
          <option value="All">All categories</option>
          <option value="Starred">Starred</option>
          {BOOK_CATEGORIES.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      <div id="bookGrid" className="book-grid">
        {visible.length === 0 ? (
          <div className="empty-state">
            {catalogue.length
              ? "No books match your search."
              : "The library catalogue is empty. The librarian can register books from the Librarian Desk."}
          </div>
        ) : visible.map(book => {
          const available = Math.max(0, Number(book.available || 0));
          const starred = stars.includes(book.id);
          const borrowDisabled = Boolean(book.demo) || !user || !(profile?.isApproved ?? profile?.is_approved) || available < 1;
          const borrowHint = book.demo
            ? "Sample card — the librarian has not registered this book yet"
            : !user
              ? "Log in to request a book"
              : !(profile?.isApproved ?? profile?.is_approved) ? "Await librarian approval" : "Request this book";
          return (
            <article key={book.id} className="book-card">
              <div className="book-cover">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={"Cover of " + book.title} loading="lazy" />
                ) : book.demo ? (
                  <span className="demo-cover" style={{ "--demo-hue": String(book.hue) }}>
                    <span className="demo-cover-code">{book.code}</span>
                  </span>
                ) : (
                  <span>{book.icon || "BOOK"}</span>
                )}
                {book.demo ? (
                  <span className="book-demo-badge">Sample</span>
                ) : (
                  <button
                    className="star-btn"
                    type="button"
                    aria-label={starred ? "Remove from starred books" : "Star book"}
                    onClick={() => toggleStar(book.id)}
                  >
                    {starred ? "★" : "☆"}
                  </button>
                )}
              </div>
              <div className="book-details">
                <h3 className="book-title">{book.title}</h3>
                <p className="book-author">by {book.author || "Unknown author"}</p>
                <span className="book-category">{book.category || "Other"}</span>
                <p className="book-description">{book.description}</p>
                <p className="book-stock">
                  {book.demo
                    ? "Sample preview"
                    : available + " available of " + Math.max(0, Number(book.quantity || 0))}
                </p>
                <div className="book-actions">
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={borrowDisabled}
                    title={borrowHint}
                    onClick={() => { if (!book.demo) requestBook(book.id); }}
                  >
                    Borrow
                  </button>
                  {book.ebookUrl ? (
                    <a className="btn btn-outline" href={book.ebookUrl} target="_blank" rel="noopener noreferrer">E-book</a>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="panel">
        <div className="section-header">
          <h2>Digital library</h2>
          <p>E-books shared by the librarian.</p>
        </div>
        {!user && ebooks.length > 0 ? (
          <p className="muted">Browse freely — sign in to download the files.</p>
        ) : null}
        <div id="publicEbooks" className="announcement-grid">
          {ebooks.length === 0 ? (
            <p className="muted">No e-books have been uploaded yet.</p>
          ) : ebooks.map(book => (
            <article key={book.id} className="announcement-card">
              <h3>{book.title}</h3>
              <p>{book.category || "Digital resource"}</p>
              {user ? (
                <button className="btn btn-sm btn-outline" type="button" onClick={() => void openEbook(book)}>
                  Open / download
                </button>
              ) : (
                <button className="btn btn-sm btn-outline" type="button" onClick={() => onOpenAuth?.("login")}>
                  Sign in to download
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
