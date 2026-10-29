/* ==========================================
   STATE MANAGEMENT & INITIAL DATA
========================================== */

let sampleBooks = [
  { id: 1, title: "Fun with Phonics", author: "A. Smith", category: "Primary (PP - Grade 8)", icon: "🎨" },
  { id: 2, title: "Junior Mathematics Vol 1", author: "B. Johnson", category: "Primary (PP - Grade 8)", icon: "📐" },
  { id: 3, title: "Secondary Chemistry", author: "Dr. K. Patel", category: "High School", icon: "🧪" },
  { id: 4, title: "World History: 20th Century", author: "M. Davies", category: "High School", icon: "🌍" },
  { id: 5, title: "Advanced Data Structures", author: "E. Cormen", category: "University", icon: "💻" },
  { id: 6, title: "Principles of Macroeconomics", author: "N. Mankiw", category: "University", icon: "📊" },
  { id: 7, title: "The Great Novel", author: "L. Tolstoy", category: "General / Fiction", icon: "📚" }
];

let state = {
  users: JSON.parse(localStorage.getItem('amg_users')) || [],
  currentUser: JSON.parse(localStorage.getItem('amg_current_user')) || null,
  borrowRequests: JSON.parse(localStorage.getItem('amg_requests')) || [],
  starredBooks: JSON.parse(localStorage.getItem('amg_starred')) || [],
  currentCategory: 'All',
  searchQuery: ''
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  renderBooks();
  updateAuthUI();
});

/* ==========================================
   NAVIGATION & UI CONTROLS
========================================== */

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');

  if (sectionId === 'profileSection') {
    renderLearnerProfile();
  }
  if (sectionId === 'librarianSection') {
    renderLibrarianTables();
  }
}

function toggleDropdown() {
  document.getElementById("dropdownMenu").classList.toggle("show");
}

window.onclick = function(event) {
  if (!event.target.matches('.btn-primary')) {
    const dropdowns = document.getElementsByClassName("dropdown-content");
    for (let i = 0; i < dropdowns.length; i++) {
      let openDropdown = dropdowns[i];
      if (openDropdown.classList.contains('show')) {
        openDropdown.classList.remove('show');
      }
    }
  }
};

function togglePortalView() {
  const libSec = document.getElementById('librarianSection');
  if (libSec.classList.contains('active')) {
    showSection('heroSection');
  } else {
    showSection('librarianSection');
  }
}

/* ==========================================
   AUTH & REGISTRATION FLOW
========================================== */

function openAuthModal(mode) {
  document.getElementById('authModal').style.display = 'flex';
  if (mode === 'register') {
    document.getElementById('registerFormContainer').classList.remove('hidden');
    document.getElementById('loginFormContainer').classList.add('hidden');
    goToStep1();
  } else {
    document.getElementById('registerFormContainer').classList.add('hidden');
    document.getElementById('loginFormContainer').classList.remove('hidden');
  }
}

function closeAuthModal() {
  document.getElementById('authModal').style.display = 'none';
}

function goToStep1() {
  document.getElementById('regStep1').classList.add('active');
  document.getElementById('regStep2').classList.remove('active');
}

function goToStep2() {
  const name = document.getElementById('regFullName').value.trim();
  const school = document.getElementById('regSchool').value.trim();
  const pass = document.getElementById('regPassword').value.trim();

  if (!name || !school || !pass) {
    alert("Please fill in all learner details before proceeding.");
    return;
  }

  document.getElementById('regStep1').classList.remove('active');
  document.getElementById('regStep2').classList.add('active');
}

function completeRegistration() {
  const fullName = document.getElementById('regFullName').value.trim();
  const gender = document.getElementById('regGender').value;
  const school = document.getElementById('regSchool').value.trim();
  const studyLevel = document.getElementById('regStudyLevel').value.trim();
  const eduLevel = document.getElementById('regEduLevel').value;
  const password = document.getElementById('regPassword').value.trim();

  const guardianName = document.getElementById('regGuardianName').value.trim();
  const guardianRelation = document.getElementById('regGuardianRelation').value;
  const guardianPhone = document.getElementById('regGuardianPhone').value.trim();

  if (!guardianName || !guardianPhone) {
    alert("Please fill in guardian details.");
    return;
  }

  // Generate automatically unique library ID
  const libraryNumber = "AMG-" + Math.floor(100000 + Math.random() * 900000);

  const newUser = {
    id: Date.now(),
    fullName,
    gender,
    school,
    studyLevel,
    eduLevel,
    password,
    guardianName,
    guardianRelation,
    guardianPhone,
    libraryNumber,
    isApproved: false // Requires librarian approval
  };

  state.users.push(newUser);
  saveState();

  alert(`Registration successful! Your unique Library ID is ${libraryNumber}. Please wait for Librarian approval before borrowing.`);
  closeAuthModal();
}

function performLogin() {
  const name = document.getElementById('loginFullName').value.trim();
  const pass = document.getElementById('loginPassword').value.trim();

  const user = state.users.find(u => u.fullName.toLowerCase() === name.toLowerCase() && u.password === pass);

  if (!user) {
    alert("Invalid Full Name or Password!");
    return;
  }

  state.currentUser = user;
  saveState();
  updateAuthUI();
  closeAuthModal();
  alert(`Welcome back, ${user.fullName}!`);
}

function logout() {
  state.currentUser = null;
  saveState();
  updateAuthUI();
  showSection('heroSection');
}

function updateAuthUI() {
  const memberDropdown = document.getElementById('memberDropdown');
  const userBadge = document.getElementById('userBadge');
  const navProfileBtn = document.getElementById('navProfileBtn');

  if (state.currentUser) {
    memberDropdown.classList.add('hidden');
    userBadge.classList.remove('hidden');
    navProfileBtn.classList.remove('hidden');
    document.getElementById('navUserName').innerText = state.currentUser.fullName;
  } else {
    memberDropdown.classList.remove('hidden');
    userBadge.classList.add('hidden');
    navProfileBtn.classList.add('hidden');
  }
}

/* ==========================================
   BOOK SHELF & BORROWING
========================================== */

function renderBooks() {
  const grid = document.getElementById('bookGrid');
  grid.innerHTML = '';

  const filtered = sampleBooks.filter(book => {
    const matchesCat = (state.currentCategory === 'All') ||
      (state.currentCategory === 'Starred' && state.starredBooks.includes(book.id)) ||
      (book.category === state.currentCategory);

    const matchesSearch = book.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                          book.author.toLowerCase().includes(state.searchQuery.toLowerCase());

    return matchesCat && matchesSearch;
  });

  filtered.forEach(book => {
    const isStarred = state.starredBooks.includes(book.id);
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      <button class="star-btn" onclick="toggleStar(${book.id})">${isStarred ? '⭐' : '☆'}</button>
      <div class="book-cover">${book.icon}</div>
      <div class="book-details">
        <div class="book-title">${book.title}</div>
        <div class="book-author">By ${book.author}</div>
        <div class="book-category">${book.category}</div>
        <button class="btn btn-primary btn-sm mt-1" onclick="requestBorrow(${book.id})">Borrow</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function toggleStar(bookId) {
  if (state.starredBooks.includes(bookId)) {
    state.starredBooks = state.starredBooks.filter(id => id !== bookId);
  } else {
    state.starredBooks.push(bookId);
  }
  saveState();
  renderBooks();
}

function filterCategory(cat) {
  state.currentCategory = cat;
  document.querySelectorAll('.pill').forEach(p => {
    p.classList.toggle('active', p.innerText.includes(cat) || (cat === 'All' && p.innerText === 'All'));
  });
  renderBooks();
}

function filterBooks() {
  state.searchQuery = document.getElementById('searchInput').value;
  renderBooks();
}

function requestBorrow(bookId) {
  if (!state.currentUser) {
    alert("Please log in or register first to borrow books!");
    openAuthModal('login');
    return;
  }

  if (!state.currentUser.isApproved) {
    alert("Your registration account is still pending approval from the librarian.");
    return;
  }

  const book = sampleBooks.find(b => b.id === bookId);
  const existingReq = state.borrowRequests.find(r => r.userId === state.currentUser.id && r.bookId === bookId && r.status === 'Pending');

  if (existingReq) {
    alert("You already have a pending borrow request for this book.");
    return;
  }

  const newRequest = {
    id: Date.now(),
    userId: state.currentUser.id,
    userName: state.currentUser.fullName,
    bookId: book.id,
    bookTitle: book.title,
    bookCategory: book.category,
    status: 'Pending'
  };

  state.borrowRequests.push(newRequest);
  saveState();
  alert(`Borrow request submitted for "${book.title}". Waiting for librarian approval.`);
}

/* ==========================================
   LEARNER PROFILE & BARCODE GENERATION
========================================== */

function renderLearnerProfile() {
  if (!state.currentUser) return;

  const u = state.currentUser;
  document.getElementById('cardFullName').innerText = u.fullName;
  document.getElementById('cardSchool').innerText = u.school;
  document.getElementById('cardStudyLevel').innerText = u.studyLevel;
  document.getElementById('cardEduLevel').innerText = u.eduLevel;
  document.getElementById('cardLibraryNum').innerText = u.libraryNumber;
  document.getElementById('cardImage').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${u.libraryNumber}`;

  generateBarcode(u.libraryNumber, 'barcodeContainer');
  renderMyLoans();
}

function generateBarcode(code, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    const width = (charCode % 4) + 2;
    const bar = document.createElement('div');
    bar.className = 'barcode-line';
    bar.style.width = width + 'px';
    bar.style.marginRight = '2px';
    container.appendChild(bar);
  }
}

function renderMyLoans() {
  const container = document.getElementById('myLoansList');
  container.innerHTML = '';

  const myReqs = state.borrowRequests.filter(r => r.userId === state.currentUser.id);

  if (myReqs.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);">No active loans or requests.</p>';
    return;
  }

  myReqs.forEach(req => {
    const div = document.createElement('div');
    div.style.padding = '0.5rem';
    div.style.borderBottom = '1px solid var(--border-color)';
    div.innerHTML = `
      <strong>${req.bookTitle}</strong> 
      <span class="badge" style="background:${req.status === 'Approved' ? '#dcfce7' : '#fef3c7'}">
        ${req.status}
      </span>
    `;
    container.appendChild(div);
  });
}

function downloadCard(elementId) {
  const target = document.getElementById(elementId);
  html2canvas(target).then(canvas => {
    const link = document.createElement('a');
    link.download = 'AMG-Library-Card.png';
    link.href = canvas.toDataURL();
    link.click();
  });
}

/* ==========================================
   LIBRARIAN PORTAL MANAGEMENT
========================================== */

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  event.target.classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

function renderLibrarianTables() {
  // Borrow Requests Table
  const reqTable = document.getElementById('borrowRequestsTable');
  reqTable.innerHTML = '';
  state.borrowRequests.forEach(req => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${req.userName}</td>
      <td>${req.bookTitle}</td>
      <td>${req.bookCategory}</td>
      <td><span class="badge">${req.status}</span></td>
      <td>
        ${req.status === 'Pending' ? `
          <button class="btn btn-sm btn-success" onclick="processRequest(${req.id}, 'Approved')">Accept</button>
          <button class="btn btn-sm btn-danger" onclick="processRequest(${req.id}, 'Declined')">Decline</button>
        ` : 'Processed'}
      </td>
    `;
    reqTable.appendChild(tr);
  });

  // Pending Learner Registrations
  const pendTable = document.getElementById('pendingLearnersTable');
  pendTable.innerHTML = '';
  state.users.filter(u => !u.isApproved).forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.fullName}</td>
      <td>${u.school}</td>
      <td>${u.eduLevel}</td>
      <td>${u.guardianName} (${u.guardianPhone})</td>
      <td>
        <button class="btn btn-sm btn-success" onclick="approveLearner(${u.id})">Approve</button>
      </td>
    `;
    pendTable.appendChild(tr);
  });

  // All Registered Learners
  const allTable = document.getElementById('allLearnersTable');
  allTable.innerHTML = '';
  state.users.filter(u => u.isApproved).forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.libraryNumber}</td>
      <td>${u.fullName}</td>
      <td>${u.eduLevel}</td>
      <td>${u.guardianName} (${u.guardianRelation})</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="viewLibrarianCard(${u.id})">🎴 View Card</button>
      </td>
    `;
    allTable.appendChild(tr);
  });
}

function processRequest(reqId, status) {
  const req = state.borrowRequests.find(r => r.id === reqId);
  if (req) {
    req.status = status;
    saveState();
    renderLibrarianTables();
  }
}

function approveLearner(userId) {
  const u = state.users.find(user => user.id === userId);
  if (u) {
    u.isApproved = true;
    saveState();
    renderLibrarianTables();
  }
}

function viewLibrarianCard(userId) {
  const u = state.users.find(user => user.id === userId);
  if (!u) return;

  document.getElementById('libModalCardFullName').innerText = u.fullName;
  document.getElementById('libModalCardSchool').innerText = u.school;
  document.getElementById('libModalCardStudyLevel').innerText = u.studyLevel;
  document.getElementById('libModalCardEduLevel').innerText = u.eduLevel;
  document.getElementById('libModalCardLibraryNum').innerText = u.libraryNumber;
  document.getElementById('libModalCardImage').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${u.libraryNumber}`;

  generateBarcode(u.libraryNumber, 'libModalBarcodeContainer');
  document.getElementById('librarianCardModal').style.display = 'flex';
}

function closeLibrarianCardModal() {
  document.getElementById('librarianCardModal').style.display = 'none';
}

/* LOCAL STORAGE HELPER */
function saveState() {
  localStorage.setItem('amg_users', JSON.stringify(state.users));
  localStorage.setItem('amg_current_user', JSON.stringify(state.currentUser));
  localStorage.setItem('amg_requests', JSON.stringify(state.borrowRequests));
  localStorage.setItem('amg_starred', JSON.stringify(state.starredBooks));
}