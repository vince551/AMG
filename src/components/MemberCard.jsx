import { forwardRef } from "react";
import { Barcode, QrCode } from "./Barcode";
import { avatarUrl, formatCardDate } from "../lib/format";

const RULES = [
  "This card is property of AMG Library.",
  "Must be presented to access library services.",
  "Report loss immediately.",
  "Valid while membership is active."
];

/** Front and back of the learner ID card, reused by the profile and the librarian modal. */
export const MemberCard = forwardRef(function MemberCard({ profile, className = "amg-card-pair" }, ref) {
  const libraryNumber = profile?.libraryNumber || "AMG-000000";
  const photoURL = profile?.photoURL || avatarUrl(libraryNumber);
  const issueDate = formatCardDate(profile?.approvedAt || profile?.decisionAt);

  return (
    <div ref={ref} className={className}>
      <article className="amg-id-card amg-id-front">
        <div className="amg-id-brand-panel">
          <div className="amg-id-bookmark" aria-hidden="true">▤</div>
          <div className="amg-id-brand-name">AMG LIBRARY</div>
          <div className="amg-id-tagline">YOUR LEARNING PARTNER</div>
          <div className="amg-id-stripes" aria-hidden="true"></div>
        </div>
        <div className="amg-id-front-content">
          <div className="amg-id-qr-block">
            <span>SCAN MEMBER ID</span>
            <QrCode value={libraryNumber} />
          </div>
          <div className="amg-id-person">
            <img className="amg-id-photo" src={photoURL} alt="Learner profile photo" />
            <div className="amg-id-details">
              <h3>{profile?.fullName || "Learner Name"}</h3>
              <div className="amg-id-pills">
                <span>{profile?.eduLevel || "Learner"}</span>
                <span>{profile?.studyLevel || "Study level"}</span>
              </div>
              <small>MEMBER NO.</small>
              <strong>{libraryNumber}</strong>
              <small>{profile?.school || "School"}</small>
            </div>
          </div>
          <div className="amg-id-front-barcode">
            <Barcode value={libraryNumber} />
          </div>
        </div>
      </article>

      <article className="amg-id-card amg-id-back">
        <header>AMG LIBRARY <span>•</span> LEARNER ID — BACK</header>
        <div className="amg-id-back-content">
          <section>
            <h3>LIBRARY RULES</h3>
            <ol>
              {RULES.map(rule => <li key={rule}>{rule}</li>)}
            </ol>
            <div className="amg-id-dates">
              <div><b>ISSUE DATE</b><strong>{issueDate}</strong></div>
              <div className="amg-id-signature">LIBRARIAN SIGNATURE: __________________</div>
            </div>
          </section>
          <section className="amg-id-back-code">
            <Barcode value={libraryNumber} height={34} width={1.1} />
            <strong>{libraryNumber}</strong>
          </section>
        </div>
        <footer>
          <span>edwinmuga99@gmail.com</span>
          <span>+254 726 908936</span>
          <b>LEARN • DISCOVER • GROW</b>
        </footer>
      </article>
    </div>
  );
});
