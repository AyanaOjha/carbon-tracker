// ===== SETUP =====
const API_BASE = window.location.port === '5000' || window.location.port === '80'
  ? `${window.location.origin}/api`
  : 'http://localhost:5000/api';

const API_URL = `${API_BASE}/logs`;
const AUTH_URL = `${API_BASE}/auth`;

let currentUser = localStorage.getItem('carbon_user') || '';
let authToken = localStorage.getItem('carbon_token') || '';
let currentRole = localStorage.getItem('carbon_role') || 'commuter';
let tempMfaToken = '';

const MODE_LABELS = {
  walk: 'on foot',
  bike: 'by bicycle',
  bus: 'by bus',
  train: 'by train',
  car: 'by car'
};

// Check if user was previously logged in on page load
window.addEventListener('DOMContentLoaded', () => {
  if (currentUser) {
    updateAuthUI();
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');
    loadLogs();
    loadLeaderboard();
  }
});

// ===== "Quick Open" (Journal Name Mode) =====
function setUser() {
  const name = document.getElementById('userNameInput').value.trim();
  if (!name) return alert('Please enter a name');

  currentUser = name;
  currentRole = 'commuter';
  authToken = '';
  localStorage.setItem('carbon_user', currentUser);
  localStorage.removeItem('carbon_token');
  localStorage.setItem('carbon_role', currentRole);

  updateAuthUI();
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('app-section').classList.remove('hidden');

  loadLogs();
  loadLeaderboard();
}

// Update authentication badge and buttons
function updateAuthUI() {
  const userBadge = document.getElementById('userBadge');
  const authBtn = document.getElementById('authBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const mfaSetupBtn = document.getElementById('mfaSetupBtn');

  if (currentUser) {
    userBadge.textContent = `${currentUser} [${currentRole.toUpperCase()}]`;
    userBadge.classList.remove('hidden');
    authBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    if (authToken) {
      mfaSetupBtn.classList.remove('hidden');
    }
  } else {
    userBadge.classList.add('hidden');
    authBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    mfaSetupBtn.classList.add('hidden');
  }
}

function logout() {
  currentUser = '';
  authToken = '';
  currentRole = 'commuter';
  localStorage.removeItem('carbon_user');
  localStorage.removeItem('carbon_token');
  localStorage.removeItem('carbon_role');

  updateAuthUI();
  document.getElementById('app-section').classList.add('hidden');
  document.getElementById('login-section').classList.remove('hidden');
}

// ===== Auth Modal Controls =====
function openAuthModal() {
  document.getElementById('authModal').classList.remove('hidden');
  switchTab('login');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.add('hidden');
  document.getElementById('mfaChallengeSection').classList.add('hidden');
  document.getElementById('mfaSetupSection').classList.add('hidden');
}

function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
  document.getElementById('loginForm').classList.toggle('hidden', !isLogin);
  document.getElementById('registerForm').classList.toggle('hidden', isLogin);
  document.getElementById('mfaChallengeSection').classList.add('hidden');
  document.getElementById('mfaSetupSection').classList.add('hidden');
}

// ===== Register User (Salted Bcrypt Password) =====
async function handleRegister(e) {
  e.preventDefault();
  const userName = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;

  try {
    const res = await fetch(`${AUTH_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, email, password, role })
    });
    const data = await res.json();

    if (!res.ok) {
      return alert(`Registration Failed: ${data.error}`);
    }

    alert(`Account created successfully with salted bcrypt password!\nYou may now sign in as ${role}.`);
    switchTab('login');
    document.getElementById('loginUsername').value = userName;
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ===== Login User =====
async function handleLogin(e) {
  e.preventDefault();
  const userName = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, password })
    });
    const data = await res.json();

    if (!res.ok) {
      return alert(`Login Failed: ${data.error}`);
    }

    // Check if MFA is required (Question 2b)
    if (data.mfaRequired) {
      tempMfaToken = data.tempToken;
      document.getElementById('loginForm').classList.add('hidden');
      document.getElementById('mfaChallengeSection').classList.remove('hidden');
      return;
    }

    // Direct Login (No MFA)
    finishLogin(data.user.userName, data.token, data.user.role);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ===== MFA Login Step 2 (TOTP verification) =====
async function submitMfaLogin() {
  const token = document.getElementById('totpInput').value.trim();
  if (!token || token.length !== 6) {
    return alert('Please enter a 6-digit TOTP code.');
  }

  try {
    const res = await fetch(`${AUTH_URL}/mfa/login-step2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: tempMfaToken, token })
    });
    const data = await res.json();

    if (!res.ok) {
      return alert(`MFA Failed: ${data.error}`);
    }

    finishLogin(data.user.userName, data.token, data.user.role);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

function finishLogin(name, token, role) {
  currentUser = name;
  authToken = token;
  currentRole = role;

  localStorage.setItem('carbon_user', currentUser);
  localStorage.setItem('carbon_token', authToken);
  localStorage.setItem('carbon_role', currentRole);

  closeAuthModal();
  updateAuthUI();

  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('app-section').classList.remove('hidden');

  loadLogs();
  loadLeaderboard();
}

// ===== MFA Setup (Generate QR Code for Google Authenticator) =====
async function startMfaSetup() {
  if (!authToken) return alert('Please sign in first to configure MFA.');

  try {
    const res = await fetch(`${AUTH_URL}/mfa/setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    const data = await res.json();

    if (!res.ok) {
      return alert(`MFA Setup Error: ${data.error}`);
    }

    openAuthModal();
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('mfaSetupSection').classList.remove('hidden');

    const qrContainer = document.getElementById('qrCodeContainer');
    qrContainer.innerHTML = `<img src="${data.qrCodeDataUrl}" alt="Scan QR Code with Google Authenticator">`;
    document.getElementById('manualSecret').textContent = data.secret;
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function confirmMfaSetup() {
  const token = document.getElementById('verifyTotpInput').value.trim();
  if (!token || token.length !== 6) {
    return alert('Please enter the 6-digit code shown in Google Authenticator.');
  }

  try {
    const res = await fetch(`${AUTH_URL}/mfa/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ token })
    });
    const data = await res.json();

    if (!res.ok) {
      return alert(`Verification Failed: ${data.error}`);
    }

    alert('Two-Factor Authentication is now ENABLED on your account!');
    closeAuthModal();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ===== CREATE - submit the form =====
document.getElementById('logForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const date = document.getElementById('dateInput').value;
  const mode = document.getElementById('modeInput').value;
  const distanceKm = parseFloat(document.getElementById('distanceInput').value);

  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userName: currentUser, date, mode, distanceKm })
  });

  document.getElementById('logForm').reset();
  loadLogs();
  loadLeaderboard();
});

// ===== READ - fetch and display this user's logs =====
async function loadLogs() {
  const res = await fetch(`${API_URL}/${currentUser}`);
  const logs = await res.json();

  renderLogList(logs);
  renderWeekChart(logs);

  const totalCo2 = logs.reduce((sum, log) => sum + log.co2SavedKg, 0);
  document.getElementById('totalImpact').textContent = totalCo2.toFixed(1);
}

// Renders each log as a journal-style line
function renderLogList(logs) {
  const container = document.getElementById('logsList');
  container.innerHTML = '';

  if (logs.length === 0) {
    container.innerHTML = '<p class="empty-note">No trips logged yet — add your first one above.</p>';
    return;
  }

  logs.forEach((log) => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
      <div class="log-entry-main">
        <span class="log-entry-date">${new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        <span class="log-entry-detail">${log.distanceKm} km ${MODE_LABELS[log.mode] || log.mode}</span>
      </div>
      <span class="log-entry-co2">+${log.co2SavedKg.toFixed(2)} kg</span>
      <span class="log-entry-actions">
        <button onclick="editLog('${log._id}', '${log.mode}', ${log.distanceKm}, '${log.date}')">Edit</button>
        <button onclick="deleteLog('${log._id}')">Remove</button>
      </span>
    `;
    container.appendChild(entry);
  });
}

// Draws a simple bar chart of CO2 saved for the last 7 days
function renderWeekChart(logs) {
  const today = new Date();
  const days = [];
  const totals = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toLocaleDateString('en-GB', { weekday: 'short' }));

    const dayTotal = logs
      .filter((log) => new Date(log.date).toDateString() === d.toDateString())
      .reduce((sum, log) => sum + log.co2SavedKg, 0);

    totals.push(dayTotal);
  }

  const container = document.getElementById('weekChart');
  const maxValue = Math.max(...totals, 0.1);

  container.innerHTML = '';

  days.forEach((day, i) => {
    const value = totals[i];
    const heightPercent = (value / maxValue) * 100;

    const col = document.createElement('div');
    col.className = 'bar-col';
    col.innerHTML = `
      <span class="bar-value">${value > 0 ? value.toFixed(1) : ''}</span>
      <div class="bar" style="height: ${Math.max(heightPercent, 2)}%"></div>
      <span class="bar-label">${day}</span>
    `;
    container.appendChild(col);
  });
}

// ===== UPDATE (Enforces RBAC) =====
async function editLog(id, currentMode, currentDistance, currentDate) {
  const newDistance = prompt('New distance (km):', currentDistance);
  if (newDistance === null) return;

  const newMode = prompt('New mode (walk/bike/bus/train/car):', currentMode);
  if (newMode === null) return;

  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      mode: newMode,
      distanceKm: parseFloat(newDistance),
      date: currentDate
    })
  });

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      alert(`Access Denied (401 Unauthorized):\nAuthentication required. Please sign in as a Supervisor to edit records.`);
    } else if (res.status === 403) {
      alert(`Access Denied (403 Forbidden - RBAC Policy):\nOnly users with the 'Supervisor' or 'Admin' role can edit commute records.\nCurrent user role: '${currentRole}'.`);
    } else {
      alert(`Error: ${data.error || 'Failed to update'}`);
    }
    return;
  }

  alert('Commute log successfully updated!');
  loadLogs();
  loadLeaderboard();
}

// ===== DELETE (Enforces RBAC) =====
async function deleteLog(id) {
  if (!confirm('Are you sure you want to remove this commute entry?')) return;

  const headers = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_URL}/${id}`, {
    method: 'DELETE',
    headers
  });

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      alert(`Access Denied (401 Unauthorized):\nAuthentication required. Please sign in as a Supervisor to delete records.`);
    } else if (res.status === 403) {
      alert(`Access Denied (403 Forbidden - RBAC Policy):\nOnly users with the 'Supervisor' or 'Admin' role can delete commute records.\nCurrent user role: '${currentRole}'.`);
    } else {
      alert(`Error: ${data.error || 'Failed to delete'}`);
    }
    return;
  }

  alert('Commute log successfully deleted!');
  loadLogs();
  loadLeaderboard();
}

// ===== Leaderboard =====
async function loadLeaderboard() {
  const res = await fetch(`${API_URL}/leaderboard/all`);
  const leaderboard = await res.json();

  const list = document.getElementById('leaderboardList');
  list.innerHTML = '';

  if (leaderboard.length === 0) {
    list.innerHTML = '<p class="empty-note">No entries yet.</p>';
    return;
  }

  leaderboard.forEach((entry) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${entry._id}</span><span>${entry.totalCo2Saved.toFixed(2)} kg</span>`;
    list.appendChild(li);
  });
}
