// Extract person ID from URL
const urlParams = new URLSearchParams(window.location.search);
const personId = urlParams.get('id');

const slider = document.getElementById('slider');
const emptyState = document.getElementById('empty-state');
const personName = document.getElementById('person-name');
const photoCount = document.getElementById('photo-count');
const backBtn = document.getElementById('back-btn');

// Set back button URL
backBtn.href = `/person.html?id=${personId}`;

// ─────────────────────────────────────────────
// LOAD PHOTOS FROM API
// ─────────────────────────────────────────────
if (!personId) {
  personName.textContent = 'Invalid URL';
  emptyState.style.display = 'block';
} else {
  loadGallery();
}

async function loadGallery() {
  try {
    // Fetch person data
    const personRes = await fetch(`http://127.0.0.1:8000/api/people/${personId}`);
    if (!personRes.ok) throw new Error('Person not found');
    const person = await personRes.json();

    personName.textContent = `${person.name}'s Gallery`;

    // Fetch photos
    const photosRes = await fetch(`http://127.0.0.1:8000/api/people/${personId}/photos`);
    if (!photosRes.ok) throw new Error('Failed to load photos');
    const photos = await photosRes.json();

    if (photos.length === 0) {
      emptyState.style.display = 'block';
      photoCount.textContent = 'No photos';
      return;
    }

    photoCount.textContent = `${photos.length} photo${photos.length !== 1 ? 's' : ''}`;

    // Build slider
    photos.forEach(photo => {
      const li = document.createElement('li');
      li.className = 'item';
      li.style.backgroundImage = `url('${photo.url}')`;

      const content = document.createElement('div');
      content.className = 'content';

      if (photo.title) {
        const title = document.createElement('h2');
        title.className = 'title';
        title.textContent = photo.title;
        content.appendChild(title);
      }

      if (photo.caption) {
        const desc = document.createElement('p');
        desc.className = 'description';
        desc.textContent = photo.caption;
        content.appendChild(desc);
      }

      li.appendChild(content);
      slider.appendChild(li);
    });

  } catch (err) {
    console.error('Failed to load gallery:', err);
    personName.textContent = 'Error loading gallery';
    emptyState.style.display = 'block';
  }
}

// ─────────────────────────────────────────────
// SLIDER NAVIGATION
// ─────────────────────────────────────────────
function activate(e) {
  const items = document.querySelectorAll('.item');
  
  if (e.target.matches('.next')) {
    slider.append(items[0]);  // Move first to end
  }
  
  if (e.target.matches('.prev')) {
    slider.prepend(items[items.length - 1]);  // Move last to start
  }
}

document.addEventListener('click', activate, false);

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') {
    const items = document.querySelectorAll('.item');
    slider.append(items[0]);
  }
  if (e.key === 'ArrowLeft') {
    const items = document.querySelectorAll('.item');
    slider.prepend(items[items.length - 1]);
  }
});