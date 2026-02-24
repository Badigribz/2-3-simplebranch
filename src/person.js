// Extract person ID from URL
// Expected URL format: http://localhost:1234/person.html?id=2
const urlParams = new URLSearchParams(window.location.search);
const personId = urlParams.get('id');

if (!personId) {
  document.getElementById('profile-name').textContent = 'Invalid URL';
  console.error('No person ID in URL. Expected: /person.html?id=2');
} else {
  // Fetch person data from your Laravel API
  fetch(`http://127.0.0.1:8000/api/people/${personId}`)
    .then(res => {
      if (!res.ok) throw new Error(`Person not found (${res.status})`);
      return res.json();
    })
    .then(person => {
      console.log('Loaded person:', person);

      // ── Populate name
      document.getElementById('profile-name').textContent = person.name;

      // ── Populate dates
      const birthDate = person.birth_date || '?';
      const deathDate = person.death_date || 'Present';
      document.getElementById('profile-dates').textContent = `${birthDate} — ${deathDate}`;

      // ── Populate bio
      if (person.bio && person.bio.trim()) {
        document.getElementById('profile-bio').innerHTML = `<p>${person.bio}</p>`;
      } else {
        document.getElementById('profile-bio').innerHTML = '<p class="empty-state">No biography available yet.</p>';
      }

      // ── Populate structured details
      if (person.birth_date) {
        document.getElementById('birth-date').textContent = person.birth_date;
      }
      
      if (person.birth_place) {
        document.getElementById('birth-place').textContent = person.birth_place;
      }
      
      if (person.death_date) {
        document.getElementById('death-date').textContent = person.death_date;
      }

      // ── If photo exists, replace placeholder
      if (person.photo_path) {
        const photoContainer = document.getElementById('photo-container');
        const img = document.createElement('img');
        
        // Assuming photo_path is relative to your Laravel public folder
        // Adjust this URL based on where you store photos
        img.src = `http://127.0.0.1:8000/storage/${person.photo_path}`;
        img.alt = `${person.name} photo`;
        img.className = 'profile-photo';
        
        img.onerror = () => {
          console.warn('Photo failed to load:', img.src);
          // Keep placeholder if image fails
        };
        
        img.onload = () => {
          photoContainer.replaceWith(img);
        };
      }
    })
    .catch(err => {
      console.error('Failed to load person data:', err);
      document.getElementById('profile-name').textContent = 'Error loading profile';
      document.getElementById('profile-dates').textContent = err.message;
    });
}