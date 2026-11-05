import { useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { MemberCard } from "./MemberCard";
import { useToast } from "../store/ToastProvider";

/** Read-only membership card preview the librarian can download for a member. */
export function CardModal({ member, onClose }) {
  const cardRef = useRef(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!member) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [member, onClose]);

  if (!member) return null;

  const downloadCard = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.download = "AMG-Library-" + (member.libraryNumber || "Member") + ".png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (_) {
      showToast("Could not download the card. Check that the photo is accessible and try again.", "error");
    }
  };

  return (
    <div
      id="cardModal"
      className="modal show"
      role="dialog"
      aria-modal="true"
      aria-label={"Membership card for " + (member.fullName || "member")}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="modal-content card-modal-content">
        <button className="close-btn" type="button" onClick={onClose} aria-label="Close">×</button>
        <MemberCard ref={cardRef} profile={member} />
        <button className="btn btn-primary top-gap" type="button" onClick={downloadCard}>
          Download both sides
        </button>
      </div>
    </div>
  );
}
