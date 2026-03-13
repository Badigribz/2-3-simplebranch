// ─────────────────────────────────────────────
// LOGIN HANDLER
// ─────────────────────────────────────────────

const form = document.getElementById('login-form');
const submitBtn = document.getElementById('submit-btn');
const errorMessage = document.getElementById('error-message');

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
    // Step 1: Get CSRF cookie (required for Laravel Sanctum)
    await fetch('http://127.0.0.1:8000/sanctum/csrf-cookie', {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    // Step 2: Attempt login
    const response = await fetch('http://127.0.0.1:8000/api/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Login successful
      console.log('Login successful:', data.user.name);
      
      // Store user data (optional, for debugging)
      sessionStorage.setItem('user', JSON.stringify(data.user));

      // Redirect to tree
      window.location.href = '/';

    } else {
      // Login failed
      handleLoginError(response.status, data.message);
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
      showError('Invalid email or password');
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