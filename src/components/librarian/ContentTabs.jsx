import { useRef, useState } from "react";
import { useLibrary } from "../../store/LibraryProvider";
import { dateMillis, formatDate } from "../../lib/format";

export function EbooksTab({ active }) {
  const { ebooks, uploadEbook, removeEbook, resolveEbookUrl } = useLibrary();
  const formRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    setBusy(true);
    const ok = await uploadEbook({
      title: String(form.get("title") || "").trim(),
      category: String(form.get("category") || "").trim(),
      file: file instanceof File ? file : null
    });
    setBusy(false);
    if (ok) formRef.current?.reset();
  };

  const remove = (book) => {
    if (!window.confirm("Remove this e-book?")) return;
    void removeEbook(book);
  };

  const open = async (book) => {
    const url = await resolveEbookUrl(book);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div id="ebooksTab" className={"tab-content" + (active ? " active" : "")}>
      <h3>Upload e-books</h3>
      <form id="ebookForm" ref={formRef} className="form-grid" onSubmit={submit}>
        <label>Title<input name="title" required maxLength="160" /></label>
        <label>Category<input name="category" required maxLength="80" /></label>
        <label>
          PDF or EPUB file
          <input name="file" type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" required />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>Upload e-book</button>
      </form>

      <div id="ebooksList" className="stack-list top-gap">
        {ebooks.length === 0 ? <p className="muted">No e-books have been uploaded yet.</p> : null}
        {ebooks.map(book => (
          <div key={book.id} className="stack-item">
            <h4>{book.title}</h4>
            <p>{(book.category || "General") + " · " + (book.fileName || "E-book")}</p>
            <button className="btn btn-sm btn-outline" type="button" onClick={() => void open(book)}>Open / download e-book</button>
            <button className="btn btn-sm btn-danger top-gap" type="button" onClick={() => remove(book)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NewsAdminTab({ active }) {
  const { announcements, events, publishNews, deletePost } = useLibrary();
  const formRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const posts = [
    ...announcements.map(item => ({ ...item, source: "announcements" })),
    ...events.map(item => ({ ...item, source: "events" }))
  ].sort((a, b) => dateMillis(b.createdAt) - dateMillis(a.createdAt));

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const ok = await publishNews({
      type: String(form.get("type") || "announcement"),
      title: String(form.get("title") || "").trim(),
      body: String(form.get("body") || "").trim(),
      date: String(form.get("date") || "")
    });
    setBusy(false);
    if (ok) formRef.current?.reset();
  };

  const remove = (post) => {
    if (!window.confirm("Delete this post?")) return;
    void deletePost(post.source, post.id);
  };

  return (
    <div id="newsAdminTab" className={"tab-content" + (active ? " active" : "")}>
      <h3>Publish news or an event</h3>
      <form id="newsForm" ref={formRef} className="form-grid" onSubmit={submit}>
        <label>
          Type
          <select name="type" defaultValue="announcement">
            <option value="announcement">News / Announcement</option>
            <option value="event">Event</option>
          </select>
        </label>
        <label>Title<input name="title" required maxLength="160" /></label>
        <label>Event date (optional)<input name="date" type="date" /></label>
        <label className="full-span">Message<textarea name="body" rows="4" required maxLength="3000"></textarea></label>
        <button className="btn btn-primary" type="submit" disabled={busy}>Publish update</button>
      </form>

      <div id="adminNewsList" className="stack-list top-gap">
        {posts.map(post => (
          <div key={post.source + "-" + post.id} className="stack-item">
            <h4>{post.title}</h4>
            <p>
              {post.source === "events" ? "Event" : "Announcement"}
              {post.date ? " · " + formatDate(post.date) : ""}
            </p>
            <button className="btn btn-sm btn-danger top-gap" type="button" onClick={() => remove(post)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
