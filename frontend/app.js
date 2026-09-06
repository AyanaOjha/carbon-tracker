// ===== SETUP =====
// Change this to your deployed backend URL once you deploy it on Render.
const API_URL = 'http://localhost:5000/api/logs';

let currentUser = '';

const MODE_LABELS = {
  walk: 'on foot',
  bike: 'by bicycle',
  bus: 'by bus',
  train: 'by train',
  car: 'by car'
};

// ===== "Login" (just remembers the name, no password) =====
function setUser() {
  const name = document.getElementById('userNameInput').value.trim();
  if (!name) return alert('Please enter a name');

  currentUser = name;
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('app-section').classList.remove('hidden');

  loadLogs();
  loadLeaderboard();
}

// ===== CREATE - submit the form =====
document.getElementById('logForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const date = document.getElementById('dateInput').value;
  const mode = document.getElementById('modeInput').value;
  const distanceKm = parseFloat(document.getElementById('distanceInput').value);

  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

// Renders each log as a journal-style line, not a table row
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

// Draws a simple bar chart of CO2 saved for the last 7 days using plain HTML/CSS.
// No external library needed - this avoids CDN blocks on restricted networks.
function renderWeekChart(logs) {
  const today = new Date();
  const days = [];
  const totals = [];

  // Build the last 7 days, oldest to newest
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
  const maxValue = Math.max(...totals, 0.1); // avoid divide-by-zero if all days are 0

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

// ===== UPDATE =====
async function editLog(id, currentMode, currentDistance, currentDate) {
  const newDistance = prompt('New distance (km):', currentDistance);
  if (newDistance === null) return;

  const newMode = prompt('New mode (walk/bike/bus/train/car):', currentMode);
  if (newMode === null) return;

  await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: newMode,
      distanceKm: parseFloat(newDistance),
      date: currentDate
    })
  });

  loadLogs();
  loadLeaderboard();
}

// ===== DELETE =====
async function deleteLog(id) {
  await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
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
