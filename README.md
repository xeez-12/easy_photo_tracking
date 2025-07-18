#  Geolocation AI with Gemini

![San Francisco](https://images.pexels.com/photos/208745/pexels-photo-208745.jpeg)

A modern web app that uses **Gemini AI** to extract geographic coordinates from photos and displays them on a sleek, interactive **Mapbox** map. Upload a photo, and let the system automatically detect and display its real-world location.  

---

## Features

- 🔍 **AI-Powered Geolocation**  
  Automatically analyzes uploaded images using **Gemini AI** to extract latitude and longitude metadata or visual clues.

- 🗺️ **Mapbox Integration**  
  Visually pin detected locations on a fully interactive Mapbox map with custom markers.

- 📦 **Smart Location Matching**  
  Matches the coordinates to a dataset with clustering and nearest-neighbor algorithms for enhanced location accuracy.

- 💡 **Client-Side Optimized**  
  Built for performance across all devices — fast loading, smooth UI, and mobile responsiveness.

---

## Deploy Instantly

You can deploy this app instantly to popular platforms:

- [![Deploy on Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=your-vercel-template-link)
- [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/your-railway-template-id)

> Just click a button and you’re live. No manual setup required.

---

## 🔐 Environment Variables

Ensure the following environment variables are set on your platform:

```env
GEMINI_API_KEY=your_google_api_key
MAPBOX_ACCESS_TOKEN=your_mapbox_token

