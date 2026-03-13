// ─────────────────────────────────────────────
// REGISTRATION HANDLER
// ─────────────────────────────────────────────

const form = document.getElementById('register-form');
const submitBtn = document.getElementById('submit-btn');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Hide previous messages
  errorMessage.classList.remove('visible');
  successMessage.classList.remove('visible');

  // Get form data
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const passwordConfirm = document.getElementById('password-confirm').value;
  const registrationNote = document.getElementById('registration-note').value.trim();

  // Validate passwords match
  if (password !== passwordConfirm) {
    showError('Passwords do not match');
    return;
  }

  // Validate password length
  if (password.length < 8) {
    showError('Password must be at least 8 characters');
    return;
  }

  // Validate registration note
  if (registrationNote.length < 10) {
    showError('Please provide more detail about who you are (at least 10 characters)');
    return;
  }

  // Show loading state
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="loading-spinner"></span> Submitting request...';

  try {
    // Attempt registration
    const response = await fetch('http://127.0.0.1:8000/api/register', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        name,
        email,
        password,
        password_confirmation: passwordConfirm,
        registration_note: registrationNote
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Registration successful
      console.log('Registration successful:', data);
      
      // Show success message
      showSuccess(
        data.message || 
        'Registration successful! Your account is pending approval. You will receive an email when approved.'
      );

      // Hide form
      form.classList.add('hidden');

      // Optional: Redirect to login after 5 seconds
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 5000);

    } else {
      // Registration failed
      handleRegistrationError(response.status, data);
    }

  } catch (err) {
    console.error('Registration error:', err);
    showError('Network error. Please check your connection and try again.');
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitBtn.textContent = 'Request Access';
  }
});

function handleRegistrationError(status, data) {
  // Check for validation errors
  if (status === 422 && data.errors) {
    const errors = Object.values(data.errors).flat();
    showError(errors.join('<br>'));
  } else if (data.message) {
    showError(data.message);
  } else {
    showError('Registration failed. Please try again.');
  }
}

function showError(message) {
  errorMessage.innerHTML = message;
  errorMessage.classList.add('visible');

  // Scroll to error
  errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showSuccess(message) {
  successMessage.innerHTML = message;
  successMessage.classList.add('visible');

  // Scroll to success
  successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}