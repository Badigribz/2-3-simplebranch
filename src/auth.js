// ─────────────────────────────────────────────
// SHARED AUTH CHECK UTILITY
// Import this at the top of any protected page
// ─────────────────────────────────────────────

// Helper function to get cookie value
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

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

// Logout function with XSRF token
export async function logout() {
  try {
    // Get XSRF token from cookie
    const xsrfToken = getCookie('XSRF-TOKEN');
    const decodedToken = xsrfToken ? decodeURIComponent(xsrfToken) : '';

    await fetch('http://127.0.0.1:8000/api/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 
        'Accept': 'application/json',
        'X-XSRF-TOKEN': decodedToken,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    console.log('Logged out successfully');
  } catch (err) {
    console.error('Logout failed:', err);
  } finally {
    // Always redirect to login, even if logout request fails
    window.location.href = '/login.html';
  }
}