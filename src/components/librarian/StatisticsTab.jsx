import { useLibrary } from "../../store/LibraryProvider";
import { dateMillis, formatDate } from "../../lib/format";

function BarChart({ id, entries }) {
  const max = Math.max(1, ...entries.map(([, value]) => Number(value) || 0));
  return (
    <div id={id} className="bar-chart">
      {entries.length === 0 ? <p className="muted">No data available yet.</p> : entries.map(([label, value]) => (
        <div key={label} className="bar-row">
          <span>{label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: (Math.max(0, Number(value) || 0) / max * 100) + "%" }}></div>
          </div>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function tally(items, keyOf) {
  const counts = {};
  items.forEach(item => {
    const key = keyOf(item) || "Unspecified";
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export function StatisticsTab({ active }) {
  const { members, books, requests, loans, attendance } = useLibrary();

  const approved = requests.filter(request => request.status === "Approved").length;
  const approvalRate = requests.length ? Math.round(approved / requests.length * 100) : 0;

  const summary = [
    ["Registered members", members.length],
    ["Approved members", members.filter(member => member.isApproved).length],
    ["Book titles", books.length],
    ["Copies in stock", books.reduce((total, book) => total + Number(book.available || 0), 0)],
    ["Active loans", loans.filter(loan => loan.status === "Borrowed").length],
    ["Borrow approval rate", approvalRate + "%"],
    ["Attendance records", attendance.length]
  ];

  const attendanceDays = Object.entries(attendance.reduce((days, record) => {
    const day = formatDate(record.checkInAt);
    if (day !== "—") days[day] = (days[day] || 0) + 1;
    return days;
  }, {})).sort((a, b) => dateMillis(a[0]) - dateMillis(b[0])).slice(-7);

  return (
    <div id="statisticsTab" className={"tab-content" + (active ? " active" : "")}>
      <h3>Library activity statistics</h3>
      <p className="muted">Statistics are calculated from Firestore records. They update when the dashboard is refreshed.</p>

      <div id="statisticsSummary" className="stats-grid">
        {summary.map(([label, value]) => (
          <div key={label} className="stat-card">
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="chart-panel">
        <h4>Borrow requests by status</h4>
        <BarChart id="borrowChart" entries={[
          ["Pending", requests.filter(request => request.status === "Pending").length],
          ["Approved", approved],
          ["Declined", requests.filter(request => request.status === "Declined").length],
          ["Returned", requests.filter(request => request.status === "Returned").length]
        ]} />
      </div>

      <div className="chart-panel">
        <h4>Members by education level</h4>
        <BarChart id="educationChart" entries={tally(members, member => member.eduLevel)} />
      </div>

      <div className="chart-panel">
        <h4>Attendance by day (latest records)</h4>
        <BarChart id="attendanceChart" entries={attendanceDays} />
      </div>

      <div className="chart-panel">
        <h4>Borrow requests by book category</h4>
        <BarChart id="categoryBorrowChart" entries={tally(requests, request => request.bookCategory)} />
      </div>

      <div className="chart-panel">
        <h4>Members by gender</h4>
        <BarChart id="genderChart" entries={tally(members, member => member.gender)} />
      </div>
    </div>
  );
}
