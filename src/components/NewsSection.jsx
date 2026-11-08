import { AnnouncementCards } from "./AnnouncementCards";
import "../styles/news-events.css";

export function NewsSection({ active, posts = [] }) {
  const announcementCount = posts.length;
  const eventCount = posts.filter((post) => post.announcementKind === "Event").length;

  return (
    <section id="newsSection" className={"section" + (active ? " active" : "")}>
      <div className="section-header news-page-header">
        <div className="news-header-copy">
          <span className="news-eyebrow">FROM THE LIBRARY</span>
          <h2>News &amp; Events</h2>
          <p>Stay connected with library notices, upcoming events and opportunities to learn, participate and grow.</p>
        </div>
        <div className="news-header-stats" aria-label="Published updates">
          <span className="news-stat">
            <strong>{announcementCount}</strong>
            <span>{announcementCount === 1 ? "Published update" : "Published updates"}</span>
          </span>
          <span className="news-stat-divider" aria-hidden="true" />
          <span className="news-stat">
            <strong>{eventCount}</strong>
            <span>{eventCount === 1 ? "Event" : "Events"}</span>
          </span>
        </div>
        <span className="news-header-orbit news-orbit-one" aria-hidden="true" />
        <span className="news-header-orbit news-orbit-two" aria-hidden="true" />
      </div>

      <div className="news-list-heading">
        <div>
          <span className="news-eyebrow">THE LATEST</span>
          <h3>What’s happening at AMG</h3>
        </div>
        <span className="news-list-note">Updates from your library</span>
      </div>

      <AnnouncementCards
        id="announcementsList"
        items={posts}
        emptyText="There are no updates just yet. Check back soon for library news, events and learning opportunities."
      />
    </section>
  );
}
