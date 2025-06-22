// Mapbox initialization (assuming original functionality)
mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN'; // Set in environment variable on Railway
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [0, 0],
  zoom: 2,
});

// Basic Street View placeholder (assuming Google Maps Street View was intended)
function initStreetView() {
  const panorama = new google.maps.StreetViewPanorama(
    document.getElementById('streetView'),
    {
      position: { lat: 0, lng: 0 },
      pov: { heading: 0, pitch: 0 },
    }
  );
}

// Handle image upload (original functionality)
document.getElementById('imageUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    // Upload to a temporary URL (e.g., via Cloudinary or Railway-compatible storage)
    const formData = new FormData();
    formData.append('file', file);
    // Placeholder for actual file to a temporary URL
    const imageUrl = URL.createObjectURL(file); // This is a placeholder; use a real upload service for production

    // Trigger Lens search
    await processImage(imageUrl);
  }
});

// Handle Lens icon click
document.getElementById('lensSearch').addEventListener('click', () => {
  // Trigger file upload dialog
  document.getElementById('imageUpload').click();
});

// Process image with Google Lens and Gemini
async function processImage(imageUrl) {
  try {
    const response = await fetch('/process-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl }),
    });

    const data = await response.json();
    if (data.error) {
      console.error('Error:', data.error);
      alert('Failed to process image');
      return;
    }

    // Display similar images
    const similarImagesContainer = document.getElementById('similarImages');
    similarImagesContainer.innerHTML = '';
    data.visualMatches.slice(0, 4).forEach((match) => {
      const img = document.createElement('img');
      img.src = match.thumbnail;
      img.alt = 'Similar image';
      similarImagesContainer.appendChild(img);
    });

    // Display Gemini summary
    document.getElementById('geminiSummary').textContent = data.textContent || 'Summary: ' + data.geminiSummary;
  } catch (error) {
    console.error('Error:', error);
    alert('Error processing image');
  }
}

// Initialize original functionality
window.onload = () => {
  // Initialize Street View if Google Maps was included
  if (typeof googlemaps !== 'undefined') {
    initStreetView();
  }
};
