import { useEffect, useState } from "react";
import { useAuth } from "../../store/AuthProvider";
import { useLibrary } from "../../store/LibraryProvider";
import { CardModal } from "../CardModal";
import { AllLearnersTab, BorrowRequestsTab, PendingLearnersTab } from "./MembershipTabs";
import { BooksTab } from "./BooksTab";
import { AttendanceTab } from "./AttendanceTab";
import { EbooksTab, NewsAdminTab } from "./ContentTabs";
import { StatisticsTab } from "./StatisticsTab";

const TABS = [
  { id: "borrowRequestsTab", label: "Borrow requests" },
  { id: "pendingLearnersTab", label: "Learner approvals" },
  { id: "allLearnersTab", label: "Members & cards" },
  { id: "booksAdminTab", label: "Book inventory" },
  { id: "attendanceTab", label: "Attendance" },
  { id: "ebooksTab", label: "E-books" },
  { id: "newsAdminTab", label: "News & events" },
  { id: "statisticsTab", label: "Statistics" }
];

const QUICK_ACTIONS = [
  { tab: "borrowRequestsTab", icon: "↗", tone: "quick-blue", title: "Circulation desk", detail: "Review and process requests" },
  { tab: "pendingLearnersTab", icon: "✓", tone: "quick-green", title: "Member approvals", detail: "Welcome new learners" },
  { tab: "ebooksTab", icon: "▤", tone: "quick-violet", title: "Digital library", detail: "Publish reading resources" },
  { tab: "statisticsTab", icon: "⌁", tone: "quick-amber", title: "Library insights", detail: "Explore usage and trends" }
];

const formatToday = () => new Intl.DateTimeFormat("en-KE", {
  weekday: "long", day: "numeric", month: "long", year: "numeric"
}).format(new Date());

export function Desk({ active }) {
  const { profile, user } = useAuth();
  const { members, books, requests, loans, attendance, capacity, refreshAdmin } = useLibrary();
  const [tab, setTab] = useState("borrowRequestsTab");
  const [cardMember, setCardMember] = useState(null);

  useEffect(() => {
    if (active) void refreshAdmin();
  }, [active, refreshAdmin]);

  const pendingRequests = requests.filter(request => request.status === "Pending").length;
  const pendingMembers = members.filter(member =>
    !(member.isApproved ?? member.is_approved) &&
    (member.membershipStatus ?? member.membership_status) !== "Denied"
  ).length;
  const lowStock = books.filter(book => Number(book.available || 0) <= 1).length;
  const inside = attendance.filter(record => record.status === "In library").length;
  const places = Math.max(1, Number(capacity) || 100);
  const occupancy = Math.min(100, Math.round(inside / places * 100));

  const priorities = [
    { icon: "↗", tone: "blue", title: "Borrow requests", detail: "Requests waiting for a decision", count: pendingRequests, tab: "borrowRequestsTab" },
    { icon: "✓", tone: "green", title: "Learner approvals", detail: "Membership applications to review", count: pendingMembers, tab: "pendingLearnersTab" },
    { icon: "▤", tone: "amber", title: "Low-stock titles", detail: "Books with one or fewer copies available", count: lowStock, tab: "booksAdminTab" }
  ];

  const stats = [
    ["Members", members.length],
    ["Awaiting approval", pendingMembers],
    ["Book titles", books.length],
    ["Pending requests", pendingRequests],
    ["Currently in library", inside],
    ["Available copies", books.reduce((total, book) => total + Number(book.available || 0), 0)]
  ];

  const staffName = profile?.fullName || user?.email || "";

  return (
    <section id="librarianSection" className={"section" + (active ? " active" : "")}>
      <div className="section-header">
        <p className="eyebrow">STAFF WORKSPACE</p>
        <h2 id="librarianHeading">Librarian Desk{staffName ? " — " + staffName : ""}</h2>
        <p>Manage membership, catalogue, circulation, e-books, attendance and library statistics.</p>
      </div>

      <section className="admin-welcome" aria-labelledby="adminWelcomeTitle">
        <div className="admin-welcome-copy">
          <span className="admin-live"><i></i> LIBRARY OPERATIONS</span>
          <h2 id="adminWelcomeTitle">Your library, at a glance.</h2>
          <p>Keep books moving, welcome learners and stay on top of the day’s priorities.</p>
          <div className="admin-welcome-actions">
            <button className="btn btn-primary" type="button" onClick={() => setTab("booksAdminTab")}>＋ Add a book</button>
            <button className="btn admin-ghost" type="button" onClick={() => setTab("attendanceTab")}>⌁ Open attendance</button>
          </div>
        </div>
        <div className="admin-welcome-art" aria-hidden="true">
          <div className="admin-art-orbit orbit-one"></div>
          <div className="admin-art-orbit orbit-two"></div>
          <div className="admin-art-book book-back"></div>
          <div className="admin-art-book book-front">
            <span>AMG</span><b>READ<br />GROW<br />LEAD</b><small>LIBRARY · EST.</small>
          </div>
          <div className="admin-art-spark spark-one">✦</div>
          <div className="admin-art-spark spark-two">✧</div>
        </div>
        <div className="admin-date-strip">
          <span>STAFF CONSOLE</span>
          <span id="adminWelcomeDate">{formatToday()}</span>
        </div>
      </section>

      <div className="admin-quick-grid" aria-label="Quick library actions">
        {QUICK_ACTIONS.map(action => (
          <button key={action.tab} className="admin-quick-card" type="button" onClick={() => setTab(action.tab)}>
            <span className={"admin-quick-icon " + action.tone}>{action.icon}</span>
            <span><b>{action.title}</b><small>{action.detail}</small></span>
            <strong>→</strong>
          </button>
        ))}
      </div>

      <div className="admin-overview-grid">
        <section className="admin-overview-panel">
          <div className="admin-panel-heading">
            <div><span className="admin-kicker">YOUR PRIORITIES</span><h3>Daily operations</h3></div>
            <span className="admin-panel-mark">01</span>
          </div>
          <div id="adminPriorityList" className="admin-priority-list">
            {priorities.map(item => (
              <div key={item.tab} className="admin-priority-row">
                <span className={"priority-icon priority-" + item.tone}>{item.icon}</span>
                <span className="priority-copy"><b>{item.title}</b><small>{item.detail}</small></span>
                <span className={"priority-count" + (item.count ? " has-work" : "")}>{item.count}</span>
                <button className="priority-open" type="button" onClick={() => setTab(item.tab)}>Open →</button>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-overview-panel admin-occupancy-panel">
          <div className="admin-panel-heading">
            <div><span className="admin-kicker">SPACE &amp; SAFETY</span><h3>Library occupancy</h3></div>
            <span className="admin-panel-mark">02</span>
          </div>
          <div className="occupancy-number">
            <strong id="dashboardOccupancyCount">{inside}</strong>
            <span id="dashboardOccupancyCapacity">of {places} places used</span>
          </div>
          <div className="occupancy-track">
            <span
              id="dashboardOccupancyBar"
              style={{ width: occupancy + "%" }}
              className={inside >= places ? "at-capacity" : undefined}
            ></span>
          </div>
          <div className="occupancy-footer">
            <span><i className="occupancy-dot"></i> Currently in library</span>
            <button type="button" onClick={() => setTab("attendanceTab")}>Manage attendance ↗</button>
          </div>
        </section>
      </div>

      <div className="notice notice-success">
        Librarian access is controlled by the account role. Only accounts with the librarian role can access this workspace.
      </div>

      <div className="admin-stats-heading">
        <div><p className="eyebrow">LIVE OVERVIEW</p><h3>Library snapshot</h3></div>
        <span>Figures update from available library records</span>
      </div>
      <div className="stats-grid admin-stats-grid" id="adminStats">
        {stats.map(([label, value]) => (
          <div key={label} className="stat-card">
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="tabs admin-tabs" role="tablist">
        {TABS.map(item => (
          <button
            key={item.id}
            className={"tab-btn" + (tab === item.id ? " active" : "")}
            data-tab-target={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className="admin-mobile-tab-picker" htmlFor="adminMobileTabSelect">
        Dashboard section
        <select
          id="adminMobileTabSelect"
          aria-label="Choose dashboard section"
          value={tab}
          onChange={event => setTab(event.target.value)}
        >
          {TABS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>

      <BorrowRequestsTab active={tab === "borrowRequestsTab"} />
      <PendingLearnersTab active={tab === "pendingLearnersTab"} />
      <AllLearnersTab active={tab === "allLearnersTab"} onViewCard={setCardMember} />
      <BooksTab active={tab === "booksAdminTab"} />
      <AttendanceTab active={tab === "attendanceTab"} />
      <EbooksTab active={tab === "ebooksTab"} />
      <NewsAdminTab active={tab === "newsAdminTab"} />
      <StatisticsTab active={tab === "statisticsTab"} />

      <CardModal member={cardMember} onClose={() => setCardMember(null)} />
    </section>
  );
}
