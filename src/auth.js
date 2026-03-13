// ─────────────────────────────────────────────
// SHARED AUTH CHECK UTILITY
// Import this at the top of any protected page
// ─────────────────────────────────────────────

export async function requireAuth() {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/user', {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      // Not authenticated - redirect to login
      console.log('Not authenticated, redirecting to login...');
      window.location.href = '/login.html';
      return null;
    }

    const user = await response.json();
    console.log('Authenticated as:', user.name, `(${user.role})`);

    // Store user data globally
    window.currentUser = user;

    return user;

  } catch (err) {
    console.error('Auth check failed:', err);
    window.location.href = '/login.html';
    return null;
  }
}

// Optional: Check if user has a specific role
export function requireRole(role) {
  if (!window.currentUser) {
    window.location.href = '/login.html';
    return false;
  }

  if (window.currentUser.role !== role) {
    alert(`This page requires ${role} access`);
    window.location.href = '/';
    return false;
  }

  return true;
}

// Logout function
export async function logout() {
  try {
    await fetch('http://127.0.0.1:8000/api/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });
  } catch (err) {
    console.error('Logout failed:', err);
  } finally {
    // Always redirect to login, even if logout request fails
    window.location.href = '/login.html';
  }
}