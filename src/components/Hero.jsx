import { useRef } from "react";
import { AnimatedCounter } from "./AnimatedCounter";
import { AnnouncementCards } from "./AnnouncementCards";
import { FeaturedBooks } from "./FeaturedBooks";
import { useHeroParallax, useRevealTargets } from "../hooks/useHeroEffects";

const LEVELS = [
  "PP & Pre-Primary", "Primary", "Junior Secondary", "Senior Secondary",
  "High School", "University", "General Reading"
];

const JOURNEY = [
  { title: "Register", body: "Share your learner and parent or guardian details to request membership." },
  { title: "Get approved", body: "The librarian reviews your request before borrowing features are unlocked." },
  { title: "Read and grow", body: "Explore the catalogue, request books and keep your membership card handy." }
];

const SERVICES = [
  { title: "Explore the Lib Shelf", body: "Search books by title, author or category and discover your next read." },
  { title: "Digital membership", body: "Receive a member card with a unique library number, barcode and QR code." },
  { title: "Book borrowing", body: "Request available books and follow the status of requests and loans." },
  { title: "Digital resources", body: "Access e-books and learning materials shared by the library." },
  { title: "Learning activity", body: "Keep track of your library activity and build consistent reading habits." },
  { title: "Community updates", body: "Stay informed about announcements, reading activities and library events." }
];

const VALUES = [
  { title: "Inclusive access", body: "Learning should welcome people from different backgrounds and at different stages." },
  { title: "Curiosity and discovery", body: "We encourage questions, exploration and the joy of finding something new in a book." },
  { title: "Responsibility and care", body: "Members and staff share responsibility for respecting books, people and library spaces." }
];

export function Hero({ active, onNavigate, onOpenAuth, books, posts }) {
  const galleryRef = useRef(null);
  useHeroParallax(galleryRef);
  useRevealTargets(`${books.length}-${posts.length}`);

  const browse = () => onNavigate("libShelfSection");

  return (
    <section id="heroSection" className={"section" + (active ? " active" : "")}>
      <div className="hero hero-editorial">
        <div className="hero-copy">
          <p className="eyebrow">AMG LIBRARY · YOUR GATEWAY TO KNOWLEDGE</p>
          <h1>Open a Book.<br /><span>Unlock a World.</span></h1>
          <p className="hero-description">Discover books, explore new ideas and build a lifelong love of learning with AMG Library — from PP to university.</p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" type="button" onClick={browse}>
              Explore the Library <span aria-hidden="true">→</span>
            </button>
            <button className="btn btn-secondary btn-lg" type="button" onClick={() => onOpenAuth("login")}>
              Learner Sign In
            </button>
          </div>
          <div className="hero-proof" aria-label="AMG Library benefits">
            <span><i aria-hidden="true">✓</i> Discover books</span>
            <span><i aria-hidden="true">✓</i> Access learning resources</span>
            <span><i aria-hidden="true">✓</i> Grow through reading</span>
          </div>
        </div>

        <div className="hero-gallery" ref={galleryRef} aria-label="Learning at AMG Library">
          <img src="AMG.images/learn.jpg" alt="Learners discovering new knowledge" fetchPriority="high" />
          <img src="AMG.images/soma.jpg" alt="Reading and study resources" loading="lazy" />
          <img src="AMG.images/toto.jpg" alt="Learning for young readers" loading="lazy" />
          <div className="hero-image-note">
            <span className="hero-note-icon" aria-hidden="true">✦</span>
            <span><strong>Every page opens a possibility.</strong><small>Learn · Discover · Grow</small></span>
          </div>
        </div>

        <div className="hero-bottom-line">
          <span>KNOWLEDGE FOR EVERY LEARNER</span>
          <span>AMG LIBRARY <b>✳</b> LEARN. DISCOVER. GROW.</span>
        </div>
      </div>

      <div className="amg-counter-strip" aria-label="AMG Library at a glance">
        <AnimatedCounter value={books.length} label="Books in catalogue" />
        <AnimatedCounter value={LEVELS.length} label="Learning stages" />
        <AnimatedCounter value={JOURNEY.length} label="Steps to get started" />
      </div>

      <section className="home-featured-section" aria-labelledby="featuredBooksTitle">
        <div className="featured-heading">
          <div>
            <p className="eyebrow">FIND YOUR NEXT READ</p>
            <h2 id="featuredBooksTitle">Stories, ideas and knowledge await.</h2>
            <p>Explore books from the AMG Library catalogue.</p>
          </div>
          <button className="text-link-button" type="button" onClick={browse}>
            Browse all books <span aria-hidden="true">↗</span>
          </button>
        </div>
        <FeaturedBooks books={books} onBrowse={browse} />
      </section>

      <section className="home-intro panel" aria-labelledby="aboutAmgTitle">
        <p className="eyebrow">ABOUT AMG LIBRARY</p>
        <h2 id="aboutAmgTitle">A welcoming space to learn, read and grow</h2>
        <p>AMG Library connects learners with books, digital learning resources and a supportive reading community. From early learning to university, we help every member discover knowledge, build confidence and develop lifelong learning habits.</p>
      </section>

      <div className="home-purpose-grid">
        <article className="purpose-card mission-card">
          <p className="eyebrow">OUR MISSION</p>
          <h2>Make knowledge accessible</h2>
          <p>To provide an inclusive, learner-centred library where people of every learning level can access useful books, reliable resources and opportunities to grow through reading.</p>
        </article>
        <article className="purpose-card vision-card">
          <p className="eyebrow">OUR VISION</p>
          <h2>A community of confident readers</h2>
          <p>To nurture curious, informed and empowered learners who use knowledge, creativity and lifelong reading to build brighter futures for themselves and their communities.</p>
        </article>
      </div>

      <section className="home-services panel" aria-labelledby="servicesTitle">
        <div className="section-header">
          <p className="eyebrow">WHAT YOU CAN DO HERE</p>
          <h2 id="servicesTitle">More than a bookshelf</h2>
          <p>Practical library services designed around the learner.</p>
        </div>
        <div className="home-feature-grid">
          {SERVICES.map(item => (
            <article className="home-feature" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-journey panel" aria-labelledby="journeyTitle">
        <div className="section-header">
          <p className="eyebrow">GETTING STARTED</p>
          <h2 id="journeyTitle">Your library journey in three steps</h2>
        </div>
        <div className="journey-grid">
          {JOURNEY.map((step, index) => (
            <article key={step.title}>
              <span className="journey-number">{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-levels panel" aria-labelledby="levelsTitle">
        <div className="section-header">
          <p className="eyebrow">LEARNING FOR EVERY STAGE</p>
          <h2 id="levelsTitle">A place for every learner</h2>
          <p>Explore resources that support different stages of education.</p>
        </div>
        <div className="level-chips">
          {LEVELS.map(level => <span key={level}>{level}</span>)}
        </div>
      </section>

      <section className="home-values panel" aria-labelledby="valuesTitle">
        <div className="section-header">
          <p className="eyebrow">OUR COMMITMENT</p>
          <h2 id="valuesTitle">A library built around learners</h2>
        </div>
        <div className="values-grid">
          {VALUES.map(item => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-cta">
        <div>
          <p className="eyebrow">START YOUR NEXT CHAPTER</p>
          <h2>There is always something new to discover.</h2>
          <p>Join the AMG Library community and make reading part of your growth.</p>
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary btn-lg" type="button" onClick={browse}>Browse books</button>
          <button className="btn btn-secondary btn-lg" type="button" onClick={() => onOpenAuth("register")}>Join the library</button>
        </div>
      </section>

      <section className="panel" aria-labelledby="announcementsTitle">
        <div className="section-header">
          <h2 id="announcementsTitle">Library announcements</h2>
          <p>Latest news and notices from AMG Library.</p>
        </div>
        <AnnouncementCards
          id="homeAnnouncements"
          items={posts}
          emptyText="Announcements will appear here once the librarian publishes them."
        />
      </section>
    </section>
  );
}
