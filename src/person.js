import { requireAuth } from './auth.js';

// ─────────────────────────────────────────────
// AUTH CHECK - Wrap everything
// ─────────────────────────────────────────────
(async function initPerson() {
  const user = await requireAuth();
  if (!user) return; // Will redirect to login if not authenticated

  // ─────────────────────────────────────────────
  // XSRF TOKEN HELPERS
  // ─────────────────────────────────────────────
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function getAuthHeaders() {
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
    fetch(`http://127.0.0.1:8000/api/people/${personId}`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })
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
    loadGalleryPhotos();  // Load photos when entering edit mode
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
        credentials: 'include',
        headers: getAuthHeaders(),
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
  // PHOTO UPLOAD
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
      // Get XSRF token for FormData upload
      const xsrfToken = getCookie('XSRF-TOKEN');
      const decodedToken = xsrfToken ? decodeURIComponent(xsrfToken) : '';

      const response = await fetch(`http://127.0.0.1:8000/api/people/${personId}/photo`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': decodedToken
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

  // ─────────────────────────────────────────────
  // GALLERY: Set up gallery button link
  // ─────────────────────────────────────────────
  const galleryBtn = document.getElementById('gallery-btn');
  if (galleryBtn && personId) {
    galleryBtn.href = `./gallery.html?id=${personId}`;
  }

  // ─────────────────────────────────────────────
  // GALLERY: Load gallery summary
  // ─────────────────────────────────────────────
  async function loadGallerySummary() {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/people/${personId}/photos`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to load photos');
      
      const photos = await response.json();
      const summary = document.getElementById('gallery-summary');
      
      if (photos.length === 0) {
        summary.textContent = 'No photos in gallery yet. Click "Edit Profile" to add some!';
      } else {
        summary.textContent = `${photos.length} photo${photos.length !== 1 ? 's' : ''} in gallery. Click "View Gallery" to see them.`;
      }
    } catch (err) {
      console.error('Failed to load gallery summary:', err);
    }
  }

  // Load summary when page loads
  if (personId) {
    loadGallerySummary();
  }

  // ─────────────────────────────────────────────
  // GALLERY: Upload multiple photos
  // ─────────────────────────────────────────────
  const galleryUpload = document.getElementById('gallery-upload');
  galleryUpload?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Validate files
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} is too large (max 5MB)`);
        return;
      }
    }

    // Get XSRF token once for all uploads
    const xsrfToken = getCookie('XSRF-TOKEN');
    const decodedToken = xsrfToken ? decodeURIComponent(xsrfToken) : '';

    // Upload each photo
    const uploadPromises = files.map(async (file) => {
      const formData = new FormData();
      formData.append('photo', file);
      
      // Prompt for title and caption
      const title = prompt(`Title for ${file.name}:`) || '';
      const caption = prompt(`Story/caption for ${file.name}:`) || '';
      
      formData.append('title', title);
      formData.append('caption', caption);

      const response = await fetch(`http://127.0.0.1:8000/api/people/${personId}/photos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
        headers: { 
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': decodedToken
        }
      });

      if (!response.ok) throw new Error(`Failed to upload ${file.name}`);
      return response.json();
    });

    try {
      await Promise.all(uploadPromises);
      alert('Photos uploaded successfully!');
      loadGalleryPhotos();  // Refresh the gallery
      loadGallerySummary(); // Update summary
    } catch (err) {
      console.error('Photo upload failed:', err);
      alert(`Some photos failed to upload: ${err.message}`);
    }
  });

  // ─────────────────────────────────────────────
  // GALLERY: Load photos for management (in edit mode)
  // ─────────────────────────────────────────────
  async function loadGalleryPhotos() {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/people/${personId}/photos`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to load photos');
      
      const photos = await response.json();
      const container = document.getElementById('gallery-photos');
      container.innerHTML = '';

      if (photos.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: rgba(140, 200, 255, 0.5);">No photos yet. Upload some above!</p>';
        return;
      }

      photos.forEach(photo => {
        const item = document.createElement('div');
        item.className = 'gallery-photo-item';
        
        const img = document.createElement('img');
        img.src = photo.url;
        img.alt = photo.title || 'Gallery photo';
        
        const info = document.createElement('div');
        info.className = 'gallery-photo-info';
        info.textContent = photo.title || '(no title)';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'gallery-photo-delete';
        deleteBtn.textContent = '✕';
        deleteBtn.onclick = () => deletePhoto(photo.id);
        
        item.appendChild(img);
        item.appendChild(info);
        item.appendChild(deleteBtn);
        container.appendChild(item);
      });
    } catch (err) {
      console.error('Failed to load gallery photos:', err);
    }
  }

  // ─────────────────────────────────────────────
  // GALLERY: Delete a photo
  // ─────────────────────────────────────────────
  async function deletePhoto(photoId) {
    if (!confirm('Delete this photo from the gallery?')) return;

    try {
      // Get XSRF token
      const xsrfToken = getCookie('XSRF-TOKEN');
      const decodedToken = xsrfToken ? decodeURIComponent(xsrfToken) : '';

      const response = await fetch(`http://127.0.0.1:8000/api/photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': decodedToken
        }
      });

      if (!response.ok) throw new Error('Failed to delete photo');
      
      alert('Photo deleted');
      loadGalleryPhotos();
      loadGallerySummary();
    } catch (err) {
      console.error('Delete failed:', err);
      alert(`Failed to delete photo: ${err.message}`);
    }
  }

})(); // ← Closing the auth-protected function