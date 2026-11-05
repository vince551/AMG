import { useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { useAuth } from "../store/AuthProvider";
import { useLibrary } from "../store/LibraryProvider";
import { useToast } from "../store/ToastProvider";
import { MemberCard } from "./MemberCard";
import { dateMillis, formatDate } from "../lib/format";

export function MemberProfile({ active }) {
  const { user, profile, updatePhoto } = useAuth();
  const { myRequests, myLoans, refreshMember } = useLibrary();
  const { showToast } = useToast();
  const cardRef = useRef(null);

  useEffect(() => {
    if (active) void refreshMember();
  }, [active, refreshMember]);

  const downloadCard = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.download = "AMG-Library-" + (profile?.libraryNumber || "Member") + ".png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (_) {
      showToast("Could not download the card. Check that the photo is accessible and try again.", "error");
    }
  };

  const items = [
    ...myRequests.map(item => ({ ...item, kind: "Request" })),
    ...myLoans.map(item => ({ ...item, kind: "Loan" }))
  ].sort((a, b) => dateMillis(b.createdAt) - dateMillis(a.createdAt));

  const stats = [
    ["Requests", myRequests.length],
    ["Approved", myRequests.filter(item => item.status === "Approved").length],
    ["Active loans", myLoans.filter(item => item.status === "Borrowed").length],
    ["Returned", myLoans.filter(item => item.status === "Returned").length]
  ];

  return (
    <section id="profileSection" className={"section" + (active ? " active" : "")}>
      <div className="section-header">
        <h2>My learner profile</h2>
        <p>Your membership information, card, requests and loan history.</p>
      </div>

      {user && profile && !profile.isApproved && profile.membershipStatus !== "Denied" ? (
        <div id="pendingApprovalNotice" className="notice notice-warning">
          Your registration is awaiting librarian approval. You can explore the catalogue while you wait.
        </div>
      ) : null}
      {user && profile?.membershipStatus === "Denied" ? (
        <div id="membershipDecisionNotice" className="notice notice-warning">
          Your membership application was denied. Please contact the librarian for assistance.
        </div>
      ) : null}

      <div className="profile-layout">
        <div className="card-preview-wrapper">
          <MemberCard ref={cardRef} profile={profile} />
          <div className="card-actions">
            <button className="btn btn-primary" type="button" onClick={downloadCard}>Download both sides</button>
            <label className="btn btn-outline upload-label">
              Update photo
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={event => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void updatePhoto(file);
                }}
              />
            </label>
          </div>
        </div>

        <div className="panel">
          <h3>My requests and loans</h3>
          <div id="myLoansList" className="stack-list">
            {items.length === 0 ? (
              <p className="muted">No requests or loans yet.</p>
            ) : items.map(item => (
              <div key={item.id} className="stack-item">
                <h4>{item.bookTitle || "Library book"}</h4>
                <p>{item.kind} · {item.status || "Pending"}</p>
                {item.dueAt ? <p>Due: {formatDate(item.dueAt)}</p> : null}
              </div>
            ))}
          </div>
          <div className="section-header top-gap"><h3>My library activity</h3></div>
          <div id="learnerStats" className="stats-grid">
            {stats.map(([label, value]) => (
              <div key={label} className="stat-card">
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
