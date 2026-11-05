import { AnnouncementCards } from "./AnnouncementCards";

export function NewsSection({ active, posts }) {
  return (
    <section id="newsSection" className={"section" + (active ? " active" : "")}>
      <div className="section-header">
        <h2>News &amp; Events</h2>
        <p>Library notices, upcoming events and learning opportunities.</p>
      </div>
      <AnnouncementCards
        id="announcementsList"
        items={posts}
        emptyText="News and events will appear here once the librarian publishes them."
      />
    </section>
  );
}
