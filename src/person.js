// ─────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────
let currentPerson = null;
let originalData = null;  // for cancel/revert

const urlParams = new URLSearchParams(window.location.search);
const personId = urlParams.get('id');

// ─────────────────────────────────────────────
// DOM ELEMENTS
// ─────────────────────────────────────────────
const profileName = document.getElementById('profile-name');
const profileDates = document.getElementById('profile-dates');

// View mode
const bioView = document.getElementById('bio-view');
const birthDateView = document.getElementById('birth-date-view');
const birthPlaceView = document.getElementById('birth-place-view');
const deathDateView = document.getElementById('death-date-view');

// Edit mode
const bioEdit = document.getElementById('bio-edit');
const birthDateEdit = document.getElementById('birth-date-edit');
const birthPlaceEdit = document.getElementById('birth-place-edit');
const deathDateEdit = document.getElementById('death-date-edit');

// Buttons
const btnEdit = document.getElementById('btn-edit');
const btnSave = document.getElementById('btn-save');
const btnCancel = document.getElementById('btn-cancel');
const photoUpload = document.getElementById('photo-upload');

// ─────────────────────────────────────────────
// LOAD PERSON DATA
// ─────────────────────────────────────────────
if (!personId) {
  profileName.textContent = 'Invalid URL';
  console.error('No person ID in URL. Expected: /person.html?id=2');
} else {
  loadPerson();
}

function loadPerson() {
  fetch(`http://127.0.0.1:8000/api/people/${personId}`)
    .then(res => {
      if (!res.ok) throw new Error(`Person not found (${res.status})`);
      return res.json();
    })
    .then(person => {
      console.log('Loaded person:', person);
      currentPerson = person;
      originalData = JSON.parse(JSON.stringify(person)); // deep clone for cancel
      displayPerson(person);
    })
    .catch(err => {
      console.error('Failed to load person data:', err);
      profileName.textContent = 'Error loading profile';
      profileDates.textContent = err.message;
    });
}

// ─────────────────────────────────────────────
// DISPLAY PERSON DATA (VIEW MODE)
// ─────────────────────────────────────────────
function displayPerson(person) {
  // Name
  profileName.textContent = person.name;

  // Dates summary
  const birthDate = person.birth_date || '?';
  const deathDate = person.death_date || 'Present';
  profileDates.textContent = `${birthDate} — ${deathDate}`;

  // Bio
  if (person.bio && person.bio.trim()) {
    bioView.innerHTML = `<p>${person.bio}</p>`;
  } else {
    bioView.innerHTML = '<p class="empty-state">No biography available yet.</p>';
  }

  // Details
  birthDateView.textContent = person.birth_date || '—';
  birthPlaceView.textContent = person.birth_place || '—';
  deathDateView.textContent = person.death_date || '—';

  // Photo
  if (person.photo_path) {
    const photoContainer = document.getElementById('photo-container');
    const img = document.createElement('img');
    img.src = `http://127.0.0.1:8000/storage/${person.photo_path}`;
    img.alt = `${person.name} photo`;
    img.className = 'profile-photo';
    
    img.onerror = () => {
      console.warn('Photo failed to load:', img.src);
    };
    
    img.onload = () => {
      photoContainer.replaceWith(img);
      img.id = 'photo-container';  // preserve ID for future edits
    };
  }
}

// ─────────────────────────────────────────────
// POPULATE EDIT FIELDS
// ─────────────────────────────────────────────
function populateEditFields() {
  bioEdit.value = currentPerson.bio || '';
  birthDateEdit.value = currentPerson.birth_date || '';
  birthPlaceEdit.value = currentPerson.birth_place || '';
  deathDateEdit.value = currentPerson.death_date || '';
}

// ─────────────────────────────────────────────
// EDIT MODE TOGGLE
// ─────────────────────────────────────────────
btnEdit?.addEventListener('click', () => {
  document.body.classList.add('editing');
  populateEditFields();
});

btnCancel?.addEventListener('click', () => {
  document.body.classList.remove('editing');
  // Revert to original data
  currentPerson = JSON.parse(JSON.stringify(originalData));
  displayPerson(currentPerson);
});

// ─────────────────────────────────────────────
// SAVE CHANGES
// ─────────────────────────────────────────────
btnSave?.addEventListener('click', async () => {
  // Gather data from edit fields
  const updatedData = {
    bio: bioEdit.value.trim() || null,
    birth_date: birthDateEdit.value || null,
    birth_place: birthPlaceEdit.value.trim() || null,
    death_date: deathDateEdit.value || null,
  };

  try {
    const response = await fetch(`http://127.0.0.1:8000/api/people/${personId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(updatedData)
    });

    if (!response.ok) {
      throw new Error(`Save failed: ${response.status}`);
    }

    const updated = await response.json();
    console.log('Saved successfully:', updated);

    // Update current state
    currentPerson = updated;
    originalData = JSON.parse(JSON.stringify(updated));

    // Exit edit mode and refresh display
    document.body.classList.remove('editing');
    displayPerson(updated);

    // Optional: Show success message
    alert('Profile updated successfully!');

  } catch (err) {
    console.error('Save failed:', err);
    alert(`Failed to save changes: ${err.message}`);
  }
});

// ─────────────────────────────────────────────
// PHOTO UPLOAD (Phase 2 - basic version)
// ─────────────────────────────────────────────
photoUpload?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('Image must be smaller than 5MB');
    return;
  }

  // Show preview immediately
  const reader = new FileReader();
  reader.onload = (event) => {
    const photoContainer = document.getElementById('photo-container');
    
    // Create new img or update existing
    let img = photoContainer.tagName === 'IMG' 
      ? photoContainer 
      : document.createElement('img');
    
    img.src = event.target.result;
    img.alt = `${currentPerson.name} photo`;
    img.className = 'profile-photo';
    img.id = 'photo-container';
    
    if (photoContainer.tagName !== 'IMG') {
      photoContainer.replaceWith(img);
    }
  };
  reader.readAsDataURL(file);

  // Upload to server
  const formData = new FormData();
  formData.append('photo', file);

  try {
    const response = await fetch(`http://127.0.0.1:8000/api/people/${personId}/photo`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('Photo uploaded:', result);

    // Update current person data
    currentPerson.photo_path = result.photo_path;
    originalData.photo_path = result.photo_path;

    alert('Photo uploaded successfully!');

  } catch (err) {
    console.error('Photo upload failed:', err);
    alert(`Failed to upload photo: ${err.message}`);
    // Reload to revert preview
    displayPerson(currentPerson);
  }
});