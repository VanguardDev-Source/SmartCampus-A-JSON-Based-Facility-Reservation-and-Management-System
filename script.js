// =============================================
// CAMPUS FACILITY RESERVATION SYSTEM
// Clean, Simple & Beginner-Friendly Version
// =============================================

// Default facilities (if none saved yet)
const DEFAULT_FACILITIES = [
  { id: 'R101', name: 'Room 101', img: 'https://www.pasigcatholic.edu.ph/assets/logo/00.png', desc: 'Lecture room, 30 seats' },
  { id: 'LAB-A', name: 'Computer Lab A', img: 'https://www.pasigcatholic.edu.ph/assets/logo/00.png', desc: 'PC lab with 20 computers' },
  { id: 'HALL-1', name: 'Crown Jewel', img: 'https://storage.googleapis.com/school_sites/spud/images/facilities/C031B0A2CA-1721691919.jpg', desc: 'Large hall for events' },
  { id: 'AV-R', name: 'Audio Visual Room', img: 'https://www.pasigcatholic.edu.ph/assets/logo/00.png', desc: 'Projector and sound system' }
];

// Where we save data in browser
const STORAGE = {
  USERS: 'cfr_users_v1',
  FACILITIES: 'cfr_facilities_v1',
  BOOKINGS: 'cfr_bookings_v1'
};

// Current logged-in user
let currentUser = null;
let facilities = [];
let selectedFacilityId = null;

// Get all HTML elements we need
const el = {
  authBox: document.getElementById('authBox'),
  app: document.getElementById('app'),
  userInfo: document.getElementById('userInfo'),
  facilityList: document.getElementById('facilityList'),
  selectedFacilityName: document.getElementById('selectedFacilityName'),
  date: document.getElementById('date'),
  from: document.getElementById('from'),
  to: document.getElementById('to'),
  purpose: document.getElementById('purpose'),
  availabilityInfo: document.getElementById('availabilityInfo'),
  reservationsTbody: document.getElementById('reservationsTbody'),
  filterUser: document.getElementById('filterUser'),

  // Forms
  loginForm: document.getElementById('loginForm'),
  signupForm: document.getElementById('signupForm'),
  loginUser: document.getElementById('loginUser'),
  loginPass: document.getElementById('loginPass'),
  signupUser: document.getElementById('signupUser'),
  signupPass: document.getElementById('signupPass'),
  signupName: document.getElementById('signupName'),

  // Admin
  adminModal: document.getElementById('adminModal'),
  currentFacilities: document.getElementById('currentFacilities'),
  facilityEditor: document.getElementById('facilityEditor'),
  facId: document.getElementById('facId'),
  facName: document.getElementById('facName'),
  facDesc: document.getElementById('facDesc'),
  facImg: document.getElementById('facImg')
};

// =============================================
// Helper Functions
// =============================================

// Convert time like "14:30" → minutes (870)
function timeToMinutes(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Check if new booking conflicts with existing ones
function hasConflict(facilityId, date, fromTime, toTime, ignoreBookingId = null) {
  const bookings = getBookings();
  const newStart = timeToMinutes(fromTime);
  const newEnd = timeToMinutes(toTime);

  if (newStart >= newEnd) {
    alert("End time must be after start time!");
    return true;
  }

  return bookings.some(booking => {
    if (ignoreBookingId && booking.id === ignoreBookingId) return false;
    if (booking.facilityId !== facilityId || booking.date !== date) return false;
    if (!['Pending', 'Approved'].includes(booking.status)) return false;

    const existingStart = timeToMinutes(booking.from);
    const existingEnd = timeToMinutes(booking.to);

    return newStart < existingEnd && existingStart < newEnd;
  });
}

// Get data from localStorage
function getUsers() { return JSON.parse(localStorage.getItem(STORAGE.USERS) || '[]'); }
function getFacilities() { return JSON.parse(localStorage.getItem(STORAGE.FACILITIES) || '[]'); }
function getBookings() { return JSON.parse(localStorage.getItem(STORAGE.BOOKINGS) || '[]'); }

// Save data
function saveFacilities(facs) { localStorage.setItem(STORAGE.FACILITIES, JSON.stringify(facs)); }
function saveBookings(bookings) { localStorage.setItem(STORAGE.BOOKINGS, JSON.stringify(bookings)); }

// =============================================
// Render Functions (Update the page)
// =============================================

function showFacilities() {
  el.facilityList.innerHTML = '';
  facilities.forEach(fac => {
    const div = document.createElement('div');
    div.className = 'facility';
    div.innerHTML = `
      <img src="${fac.img}" onerror="this.src='https://www.pasigcatholic.edu.ph/assets/logo/00.png'" alt="${fac.name}">
      <div>
        <strong>${fac.name}</strong>
        <div class="small muted">${fac.desc}</div>
      </div>
    `;
    div.onclick = () => {
      selectedFacilityId = fac.id;
      el.selectedFacilityName.textContent = fac.name;
      document.querySelectorAll('.facility').forEach(d => d.style.borderColor = d === div ? '#dbeafe' : 'transparent');
      checkAvailability();
    };
    el.facilityList.appendChild(div);
  });
}

function showBookings() {
  const bookings = getBookings();
  const showOnlyMine = el.filterUser.value === 'mine';

  el.reservationsTbody.innerHTML = '';

  bookings
    .sort((a, b) => a.date.localeCompare(b.date) || a.from.localeCompare(b.from))
    .forEach(booking => {
      if (showOnlyMine && booking.username !== currentUser.username) return;

      const facility = facilities.find(f => f.id === booking.facilityId) || { name: booking.facilityId };
      let actions = '';

      // Users can cancel their own bookings
      if (currentUser.username === booking.username) {
        actions += `<button class="btn-ghost" onclick="cancelBooking('${booking.id}')">Cancel</button>`;
      }

      // Admins can approve/reject pending bookings
      if (currentUser.role === 'admin' && booking.status === 'Pending') {
        actions += `
          <button onclick="approveBooking('${booking.id}')">Approve</button>
          <button class="btn-ghost" onclick="rejectBooking('${booking.id}')">Reject</button>
        `;
      }

      el.reservationsTbody.innerHTML += `
        <tr>
          <td>${facility.name}</td>
          <td>${booking.date}</td>
          <td>${booking.from} - ${booking.to}</td>
          <td>${booking.displayName || booking.username}</td>
          <td><span class="status ${booking.status.toLowerCase()}">${booking.status}</span></td>
          <td class="actions">${actions}</td>
        </tr>
      `;
    });
}

function checkAvailability() {
  if (!selectedFacilityId || !el.date.value) {
    el.availabilityInfo.textContent = 'Choose a facility and date to see availability.';
    return;
  }

  const bookings = getBookings().filter(b =>
    b.facilityId === selectedFacilityId && b.date === el.date.value && b.status !== 'Rejected'
  );

  if (bookings.length === 0) {
    el.availabilityInfo.textContent = 'No bookings — fully available!';
  } else {
    const list = bookings.map(b => `${b.from}-${b.to} (${b.displayName || b.username})`).join('<br>');
    el.availabilityInfo.innerHTML = `<strong>Booked times:</strong><br>${list}`;
  }
}

function showAdminFacilities() {
  if (currentUser.role !== 'admin') return;
  el.currentFacilities.innerHTML = '<h4 style="margin:16px 0 8px">Current Facilities:</h4>';

  facilities.forEach(fac => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:12px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;';
    div.innerHTML = `
      <div>
        <strong>${fac.name}</strong> <small>(${fac.id})</small><br>
        <small>${fac.desc}</small>
      </div>
      <div>
        <button onclick="editFacility('${fac.id}')">Edit</button>
        <button class="btn-ghost" onclick="deleteFacility('${fac.id}')">Delete</button>
      </div>
    `;
    el.currentFacilities.appendChild(div);
  });
}

// =============================================
// Actions
// =============================================

function login() {
  const username = el.loginUser.value.trim();
  const password = el.loginPass.value;
  const users = getUsers();
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    alert('Wrong username or password!');
    return;
  }

  currentUser = { username: user.username, name: user.name, role: user.role };
  el.authBox.classList.add('hidden');
  el.app.classList.remove('hidden');
  el.userInfo.textContent = `${currentUser.name} (${currentUser.role})`;

  showBookings();
  showFacilities();
  showAdminFacilities();
}

function signup() {
  const username = el.signupUser.value.trim();
  const password = el.signupPass.value;
  const name = el.signupName.value.trim();

  if (!username || !password || !name) {
    alert('Please fill all fields');
    return;
  }

  const users = getUsers();
  if (users.some(u => u.username === username)) {
    alert('Username already taken!');
    return;
  }

  users.push({ username, password, name, role: 'user' });
  localStorage.setItem(STORAGE.USERS, JSON.stringify(users));
  alert('Account created! Now login.');
  el.signupForm.classList.add('hidden');
  el.loginForm.classList.remove('hidden');
}

function makeBooking() {
  if (!selectedFacilityId) return alert('Please select a facility');
  const date = el.date.value;
  const from = el.from.value;
  const to = el.to.value;
  const purpose = el.purpose.value.trim();

  if (!date || !from || !to) return alert('Please fill date and time');

  if (hasConflict(selectedFacilityId, date, from, to)) {
    alert('This time slot is already booked!');
    return;
  }

  const bookings = getBookings();
  bookings.push({
    id: 'bk_' + Date.now(),
    facilityId: selectedFacilityId,
    date, from, to, purpose,
    username: currentUser.username,
    displayName: currentUser.name,
    status: 'Pending',
    createdAt: new Date().toISOString()
  });

  saveBookings(bookings);
  alert('Booking submitted! Waiting for approval.');
  showBookings();
  checkAvailability();
  el.from.value = el.to.value = el.purpose.value = '';
}

function cancelBooking(id) {
  if (!confirm('Cancel this booking?')) return;
  let bookings = getBookings();
  bookings = bookings.filter(b => b.id !== id);
  saveBookings(bookings);
  showBookings();
  checkAvailability();
}

function approveBooking(id) { changeBookingStatus(id, 'Approved'); }
function rejectBooking(id) { changeBookingStatus(id, 'Rejected'); }

function changeBookingStatus(id, status) {
  const bookings = getBookings();
  const booking = bookings.find(b => b.id === id);
  if (booking) {
    booking.status = status;
    saveBookings(bookings);
    showBookings();
    checkAvailability();
  }
}

// Admin: Facility Management
function editFacility(id) {
  const fac = facilities.find(f => f.id === id);
  if (!fac) return;

  el.facId.value = fac.id;
  el.facName.value = fac.name;
  el.facDesc.value = fac.desc;
  el.facImg.value = fac.img || '';
  el.facilityEditor.classList.remove('hidden');
  document.getElementById('btnAddFacility').textContent = 'Cancel';
}

function deleteFacility(id) {
  if (!confirm('Delete this facility? Existing bookings will lose the name.')) return;
  facilities = facilities.filter(f => f.id !== id);
  saveFacilities(facilities);
  showFacilities();
  showAdminFacilities();
}

function saveFacility() {
  const id = el.facId.value.trim();
  const name = el.facName.value.trim();
  const desc = el.facDesc.value.trim();
  const img = el.facImg.value.trim() || 'https://www.pasigcatholic.edu.ph/assets/logo/00.png';

  if (!id || !name || !desc) return alert('Fill ID, Name, and Description');

  const existing = facilities.find(f => f.id === id);
  if (existing) {
    Object.assign(existing, { id, name, desc, img });
  } else {
    facilities.push({ id, name, desc, img });
  }

  saveFacilities(facilities);
  showFacilities();
  showAdminFacilities();
  el.facilityEditor.classList.add('hidden');
  document.getElementById('btnAddFacility').textContent = '+ Add New Facility';
}

// =============================================
// Admin Modal Controls
// =============================================

function openAdminModal() {
  if (currentUser.role !== 'admin') return alert('Only admins can access this');
  el.adminModal.classList.add('active');
  showAdminFacilities();
}

function closeAdminModal() {
  el.adminModal.classList.remove('active');
  el.facilityEditor.classList.add('hidden');
  document.getElementById('btnAddFacility').textContent = '+ Add New Facility';
}

// =============================================
// Event Listeners
// =============================================

document.getElementById('btnLogin').onclick = login;
document.getElementById('btnSignup').onclick = signup;
document.getElementById('showSignup').onclick = () => { el.loginForm.classList.add('hidden'); el.signupForm.classList.remove('hidden'); };
document.getElementById('showLogin').onclick = () => { el.signupForm.classList.add('hidden'); el.loginForm.classList.remove('hidden'); };

document.getElementById('btnBook').onclick = makeBooking;
document.getElementById('btnClear').onclick = () => { el.from.value = el.to.value = el.purpose.value = ''; };
el.filterUser.onchange = showBookings;
el.date.onchange = checkAvailability;

document.getElementById('openAdminModal').onclick = openAdminModal;
document.getElementById('btnAddFacility').onclick = () => {
  el.facilityEditor.classList.toggle('hidden');
  const isVisible = !el.facilityEditor.classList.contains('hidden');
  document.getElementById('btnAddFacility').textContent = isVisible ? 'Cancel' : '+ Add New Facility';
  if (isVisible) {
    el.facId.value = el.facName.value = el.facDesc.value = el.facImg.value = '';
  }
};
document.getElementById('btnSaveFacility').onclick = saveFacility;
document.getElementById('btnCancelFacility').onclick = () => {
  el.facilityEditor.classList.add('hidden');
  document.getElementById('btnAddFacility').textContent = '+ Add New Facility';
};

// Close modal with Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAdminModal();
});

// =============================================
// Initialize App
// =============================================

(function init() {
  // Create default admin if none exists
  if (!localStorage.getItem(STORAGE.USERS)) {
    localStorage.setItem(STORAGE.USERS, JSON.stringify([
      { username: 'admin', password: 'admin123', name: 'Administrator', role: 'admin' }
    ]));
  }

  // Load or create facilities
  const saved = localStorage.getItem(STORAGE.FACILITIES);
  facilities = saved ? JSON.parse(saved) : DEFAULT_FACILITIES;
  if (!saved) saveFacilities(facilities);

  // Create empty bookings if none
  if (!localStorage.getItem(STORAGE.BOOKINGS)) {
    localStorage.setItem(STORAGE.BOOKINGS, '[]');
  }

  // Set today’s date
  el.date.value = new Date().toISOString().split('T')[0];

  // Show facilities
  showFacilities();
  showBookings();
})();