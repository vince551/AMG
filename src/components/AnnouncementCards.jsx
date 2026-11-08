import { formatDate, readingMinutes } from "../lib/format";

/** Shared announcement grid used by the home page and the News & Events section. */
export function AnnouncementCards({ id, items = [], emptyText }) {
  if (!items.length) {
    return (
      <div id={id} className="announcement-grid">
        <div className="news-empty-state" role="status">
          <span className="news-empty-mark" aria-hidden="true">AMG</span>
          <h3>Something to look forward to</h3>
          <p>{emptyText || "No announcements have been published yet."}</p>
        </div>
      </div>
    );
  }

  return (
    <div id={id} className="announcement-grid">
      {items.map((item, index) => {
        const kind = item.announcementKind === "Event" ? "Event" : "Announcement";
        return (
          <article
            key={item.id || `${kind}-${index}`}
            className="announcement-card"
            data-kind={kind.toLowerCase()}
          >
            <div className="announcement-card-meta">
              <span className="announcement-kind">{kind}</span>
              <time>{formatDate(item.date || item.createdAt)}</time>
            </div>
            <h3 className="announcement-card-title">{item.title || "Library update"}</h3>
            <p className="announcement-card-body">{item.body}</p>
            <div className="announcement-card-footer">
              <span>{readingMinutes(item.body)} min read</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
