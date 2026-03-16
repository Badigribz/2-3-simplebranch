// ─────────────────────────────────────────────
// LOGIN HANDLER - FINAL VERSION WITH XSRF FIX
// ─────────────────────────────────────────────

const form = document.getElementById('login-form');
const submitBtn = document.getElementById('submit-btn');
const errorMessage = document.getElementById('error-message');

// Helper function to get cookie value
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Check if already logged in
checkIfAlreadyLoggedIn();

async function checkIfAlreadyLoggedIn() {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/user', {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      // Already logged in, redirect to tree
      console.log('Already logged in, redirecting to tree...');
      window.location.href = '/';
    }
  } catch (err) {
    // Not logged in, stay on login page
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Hide previous errors
  errorMessage.classList.remove('visible');

  // Get form data
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // Validate
  if (!email || !password) {
    showError('Please enter both email and password');
    return;
  }

  // Show loading state
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="loading-spinner"></span> Signing in...';

  try {
    // Step 1: Get CSRF cookie
    await fetch('http://127.0.0.1:8000/sanctum/csrf-cookie', {
      method: 'GET',
      credentials: 'include',
      headers: { 
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    // Small delay to ensure cookie is set
    await new Promise(resolve => setTimeout(resolve, 150));

    // Step 2: Get the XSRF token from cookie and decode it
    const xsrfToken = getCookie('XSRF-TOKEN');
    const decodedToken = xsrfToken ? decodeURIComponent(xsrfToken) : '';

    console.log('XSRF Token found:', !!decodedToken);

    // Step 3: Attempt login with explicit XSRF header
    const response = await fetch('http://127.0.0.1:8000/api/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': decodedToken,  // Manual XSRF token
        'Referer': 'http://127.0.0.1:1234'  // Help Laravel identify origin
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    // Debug: Log response status
    console.log('Login response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('Login successful:', data.user.name);
      
      // Store user data (optional, for debugging)
      sessionStorage.setItem('user', JSON.stringify(data.user));

      // Redirect to tree
      window.location.href = '/';

    } else {
      // Login failed - get error message
      let errorMsg = 'Invalid email or password';
      
      try {
        const data = await response.json();
        errorMsg = data.message || errorMsg;
      } catch (e) {
        // If response isn't JSON, use status code
        if (response.status === 419) {
          errorMsg = 'Session error. Please refresh the page and try again.';
        } else if (response.status === 422) {
          errorMsg = 'Please check your email and password';
        }
      }
      
      handleLoginError(response.status, errorMsg);
    }

  } catch (err) {
    console.error('Login error:', err);
    showError('Network error. Please check your connection and try again.');
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
});

function handleLoginError(status, message) {
  switch (status) {
    case 419:
      // CSRF token mismatch
      showError('Session error. Please refresh the page and try again.');
      break;
    case 403:
      // Account pending approval or deactivated
      showError(message || 'Your account is pending approval');
      break;
    case 422:
      // Validation error
      showError('Please check your email and password');
      break;
    case 401:
    default:
      // Invalid credentials
      showError(message || 'Invalid email or password');
      break;
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('visible');

  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorMessage.classList.remove('visible');
  }, 5000);
}