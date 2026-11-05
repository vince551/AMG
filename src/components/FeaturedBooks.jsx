export function FeaturedBooks({ books, onBrowse }) {
  const featured = books.slice(0, 4);

  return (
    <div id="homeFeaturedBooks" className="featured-books-grid" aria-live="polite">
      {featured.length === 0 ? (
        <>
          <p className="featured-empty">The featured collection will appear here when books are available in the library catalogue.</p>
          <button className="btn btn-outline featured-empty-action" type="button" onClick={onBrowse}>
            Explore the Lib Shelf →
          </button>
        </>
      ) : featured.map(book => {
        const available = Math.max(0, Number(book.available || 0));
        return (
          <article key={book.id} className="featured-book-card">
            <div className="featured-book-cover">
              {book.coverUrl
                ? <img src={book.coverUrl} alt={"Cover of " + (book.title || "book")} loading="lazy" />
                : <span className="featured-cover-placeholder">{book.icon || "BOOK"}</span>}
            </div>
            <div className="featured-book-details">
              <span className="featured-book-category">{book.category || "Library collection"}</span>
              <h3>{book.title || "Untitled book"}</h3>
              <p className="featured-book-author">by {book.author || "Unknown author"}</p>
              <span className={"featured-availability" + (available > 0 ? " is-available" : "")}>
                {available > 0 ? "Available to request" : "Currently unavailable"}
              </span>
              <button className="featured-book-link" type="button" onClick={onBrowse}>
                View in catalogue →
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
