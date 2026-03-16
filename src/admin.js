import { requireAuth, requireRole, logout } from './auth.js';

// ─────────────────────────────────────────────
// AUTH CHECK - Admin only
// ─────────────────────────────────────────────
(async function initAdmin() {
  const user = await requireAuth();
  if (!user) return;

  // Check if user is admin
  if (!requireRole('admin')) return;

  console.log('Admin panel loaded for:', user.name);

  // Load data
  loadStats();
  loadPendingUsers();
  loadActiveUsers();

  // Logout handler
  document.getElementById('logout-btn').addEventListener('click', logout);
})();

// ─────────────────────────────────────────────
// HELPER: Get XSRF token
// ─────────────────────────────────────────────
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function getHeaders() {
  const xsrfToken = getCookie('XSRF-TOKEN');
  const decodedToken = xsrfToken ? decodeURIComponent(xsrfToken) : '';
  
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-XSRF-TOKEN': decodedToken
  };
}

// ─────────────────────────────────────────────
// LOAD STATS
// ─────────────────────────────────────────────
async function loadStats() {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/admin/stats', {
      credentials: 'include',
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Failed to load stats');

    const stats = await response.json();

    document.getElementById('stat-pending').textContent = stats.pending_users;
    document.getElementById('stat-active').textContent = stats.active_users;
    document.getElementById('stat-total').textContent = stats.total_users;
    document.getElementById('stat-admins').textContent = stats.admins;

  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ─────────────────────────────────────────────
// LOAD PENDING USERS
// ─────────────────────────────────────────────
async function loadPendingUsers() {
  const container = document.getElementById('pending-users');

  try {
    const response = await fetch('http://127.0.0.1:8000/api/admin/users/pending', {
      credentials: 'include',
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Failed to load pending users');

    const users = await response.json();

    if (users.length === 0) {
      container.innerHTML = '<div class="empty-state">No pending registrations</div>';
      return;
    }

    container.innerHTML = users.map(user => `
      <div class="user-card">
        <div class="user-info">
          <div class="user-name">${escapeHtml(user.name)}</div>
          <div class="user-email">${escapeHtml(user.email)}</div>
          <span class="badge badge-pending">Pending Approval</span>
          ${user.registration_note ? `
            <div class="user-note">
              <strong>"Who are you?"</strong><br>
              ${escapeHtml(user.registration_note)}
            </div>
          ` : ''}
        </div>
        <div class="user-actions">
          <button class="btn btn-success btn-sm" onclick="approveUser(${user.id})">
            ✓ Approve
          </button>
          <button class="btn btn-danger btn-sm" onclick="rejectUser(${user.id})">
            ✕ Reject
          </button>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Failed to load pending users:', err);
    container.innerHTML = '<div class="empty-state">Error loading pending users</div>';
  }
}

// ─────────────────────────────────────────────
// LOAD ACTIVE USERS
// ─────────────────────────────────────────────
async function loadActiveUsers() {
  const container = document.getElementById('active-users');

  try {
    const response = await fetch('http://127.0.0.1:8000/api/admin/users/active', {
      credentials: 'include',
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Failed to load active users');

    const users = await response.json();

    if (users.length === 0) {
      container.innerHTML = '<div class="empty-state">No active users</div>';
      return;
    }

    container.innerHTML = users.map(user => `
      <div class="user-card">
        <div class="user-info">
          <div class="user-name">
            ${escapeHtml(user.name)}
            <span class="role-badge role-${user.role}">${user.role}</span>
          </div>
          <div class="user-email">${escapeHtml(user.email)}</div>
          ${user.person ? `
            <div style="margin-top: 8px; font-size: 13px; color: rgba(140, 200, 255, 0.8);">
              🔗 Linked to: ${escapeHtml(user.person.name)}
            </div>
          ` : `
            <div style="margin-top: 8px; font-size: 13px; color: rgba(255, 180, 100, 0.8);">
              ⚠️ Not linked to tree
            </div>
          `}
        </div>
        <div class="user-actions">
          ${user.role !== 'admin' ? `
            <select onchange="changeRole(${user.id}, this.value)" style="margin-right: 8px;">
              <option value="">Change Role...</option>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          ` : ''}
          ${!user.person_id ? `
            <button class="btn btn-primary btn-sm" onclick="linkPerson(${user.id})">
              Link to Tree
            </button>
          ` : ''}
          <button class="btn btn-danger btn-sm" onclick="deactivateUser(${user.id})">
            Deactivate
          </button>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Failed to load active users:', err);
    container.innerHTML = '<div class="empty-state">Error loading active users</div>';
  }
}

// ─────────────────────────────────────────────
// APPROVE USER
// ─────────────────────────────────────────────
window.approveUser = async function(userId) {
  if (!confirm('Approve this user?')) return;

  try {
    const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${userId}/approve`, {
      method: 'POST',
      credentials: 'include',
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Approval failed');

    alert('User approved successfully!');
    
    // Reload data
    loadStats();
    loadPendingUsers();
    loadActiveUsers();

  } catch (err) {
    console.error('Approval failed:', err);
    alert('Failed to approve user');
  }
};

// ─────────────────────────────────────────────
// REJECT USER
// ─────────────────────────────────────────────
window.rejectUser = async function(userId) {
  if (!confirm('Reject and delete this registration? This cannot be undone.')) return;

  try {
    const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${userId}/reject`, {
      method: 'POST',
      credentials: 'include',
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Rejection failed');

    alert('User rejected and deleted');
    
    // Reload data
    loadStats();
    loadPendingUsers();

  } catch (err) {
    console.error('Rejection failed:', err);
    alert('Failed to reject user');
  }
};

// ─────────────────────────────────────────────
// CHANGE ROLE
// ─────────────────────────────────────────────
window.changeRole = async function(userId, newRole) {
  if (!newRole) return;

  if (!confirm(`Change user role to ${newRole}?`)) {
    event.target.selectedIndex = 0; // Reset dropdown
    return;
  }

  try {
    const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      credentials: 'include',
      headers: getHeaders(),
      body: JSON.stringify({ role: newRole })
    });

    if (!response.ok) throw new Error('Role change failed');

    alert('Role updated successfully!');
    
    // Reload data
    loadStats();
    loadActiveUsers();

  } catch (err) {
    console.error('Role change failed:', err);
    alert('Failed to change role');
    event.target.selectedIndex = 0;
  }
};

// ─────────────────────────────────────────────
// DEACTIVATE USER
// ─────────────────────────────────────────────
window.deactivateUser = async function(userId) {
  if (!confirm('Deactivate this user account?')) return;

  try {
    const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${userId}/deactivate`, {
      method: 'POST',
      credentials: 'include',
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Deactivation failed');

    alert('User deactivated');
    
    // Reload data
    loadStats();
    loadActiveUsers();

  } catch (err) {
    console.error('Deactivation failed:', err);
    alert('Failed to deactivate user');
  }
};

// ─────────────────────────────────────────────
// LINK TO PERSON (simplified version)
// ─────────────────────────────────────────────
window.linkPerson = async function(userId) {
  const personId = prompt('Enter Person ID to link this user to:');
  
  if (!personId) return;

  try {
    const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${userId}/link`, {
      method: 'POST',
      credentials: 'include',
      headers: getHeaders(),
      body: JSON.stringify({ person_id: parseInt(personId) })
    });

    if (!response.ok) throw new Error('Link failed');

    alert('User linked to person successfully!');
    loadActiveUsers();

  } catch (err) {
    console.error('Link failed:', err);
    alert('Failed to link user. Make sure the Person ID exists.');
  }
};

// ─────────────────────────────────────────────
// UTILITY: Escape HTML
// ─────────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}