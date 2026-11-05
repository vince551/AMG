import { useLibrary } from "../../store/LibraryProvider";

const tabClass = (active) => "tab-content" + (active ? " active" : "");

const memberStatus = (member) => {
  if (member.isApproved) return "Approved";
  return member.membershipStatus === "Denied" ? "Denied" : "Pending";
};

export function BorrowRequestsTab({ active }) {
  const { requests, loans, processRequest, returnLoan } = useLibrary();

  return (
    <div id="borrowRequestsTab" className={tabClass(active)}>
      <h3>Borrowing requests</h3>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr><th>Learner</th><th>Book</th><th>Category</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody id="borrowRequestsTable">
            {requests.map(request => {
              const loan = request.loanId ? loans.find(item => item.id === request.loanId) : null;
              return (
                <tr key={request.id}>
                  <td>{request.userName}</td>
                  <td>{request.bookTitle}</td>
                  <td>{request.bookCategory}</td>
                  <td>{request.status}</td>
                  <td>
                    {request.status === "Pending" ? (
                      <>
                        <button className="btn btn-sm btn-success" type="button" onClick={() => processRequest(request.id, "Approved")}>Accept</button>
                        <button className="btn btn-sm btn-danger" type="button" onClick={() => processRequest(request.id, "Declined")}>Decline</button>
                      </>
                    ) : request.status === "Approved" && loan && loan.status === "Borrowed" ? (
                      <button className="btn btn-sm btn-outline" type="button" onClick={() => returnLoan(request.id, request.loanId)}>Return book</button>
                    ) : "Processed"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PendingLearnersTab({ active }) {
  const { members, reviewLearner } = useLibrary();
  const pending = members.filter(member => !member.isApproved && member.membershipStatus !== "Denied");

  const decide = (member, decision) => {
    const action = decision === "Approved" ? "approve" : "deny";
    if (!window.confirm("Are you sure you want to " + action + " " + member.fullName + "'s membership?")) return;
    void reviewLearner(member.uid, decision);
  };

  return (
    <div id="pendingLearnersTab" className={tabClass(active)}>
      <h3>Learners awaiting approval</h3>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>School</th><th>Level</th><th>Guardian contact</th><th>Actions</th></tr>
          </thead>
          <tbody id="pendingLearnersTable">
            {pending.map(member => (
              <tr key={member.uid}>
                <td>{member.fullName}</td>
                <td>{member.school}</td>
                <td>{member.eduLevel}</td>
                <td>{(member.guardianName || "") + " · " + (member.guardianPhone || "")}</td>
                <td>
                  <button className="btn btn-sm btn-success" type="button" onClick={() => decide(member, "Approved")}>Approve</button>
                  <button className="btn btn-sm btn-danger" type="button" onClick={() => decide(member, "Denied")}>Deny</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AllLearnersTab({ active, onViewCard }) {
  const { members } = useLibrary();

  return (
    <div id="allLearnersTab" className={tabClass(active)}>
      <h3>Registered members</h3>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr><th>Library #</th><th>Name</th><th>School / Level</th><th>Status</th><th>Card</th></tr>
          </thead>
          <tbody id="allLearnersTable">
            {members.map(member => (
              <tr key={member.id || member.uid}>
                <td>{member.libraryNumber}</td>
                <td>{member.fullName}</td>
                <td>{(member.school || "") + " / " + (member.eduLevel || "")}</td>
                <td>{memberStatus(member)}</td>
                <td>
                  <button className="btn btn-sm btn-outline" type="button" onClick={() => onViewCard(member)}>
                    View / download card
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
