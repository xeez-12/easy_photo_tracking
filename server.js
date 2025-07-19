require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const NodeCache = require('node-cache');
const crypto = require('crypto');

const settings = require('./setting.js');

// Function to calculate Euclidean distance between two coordinates (approximate)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

const app = express();
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/dataset', express.static(path.join(__dirname, 'dataset')));

app.post('/api/gemini', async (req, res) => {
  const { imageData, prompt } = req.body;

  const cacheKey = crypto.createHash('sha256').update(imageData).digest('hex');

  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    return res.json({ result: cachedResult });
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageData
                }
              },
              {
                text: `${settings.analysisPrompt}\nUser Prompt: ${prompt}\n\nDataset Context:\n${settings.datasetEntries.map(e => e.description).join('\n')}`
              }
            ]
          }
        ],
        generationConfig: settings.generationConfig,
        tools: settings.tools
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    ).catch(async (error) => {
      if (error.code === 'ECONNABORTED') {
        console.warn('Retrying Gemini API request due to timeout...');
        return await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: imageData
                    }
                  },
                  {
                    text: `${settings.analysisPrompt}\nUser Prompt: ${prompt}\n\nDataset Context:\n${settings.datasetEntries.map(e => e.description).join('\n')}`
                  }
                ]
              }
            ],
            generationConfig: settings.generationConfig,
            tools: settings.tools
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 45000
          }
        );
      }
      throw error;
    });

    let result = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No valid response from Gemini API';

    // Parse the AI response to extract coordinates
    const coordMatch = result.match(/Coordinates:\s*\[(-?\d+\.\d+),\s*(-?\d+\.\d+)\]/);
    if (coordMatch && settings.datasetEntries.length > 0) {
      const [_, lat, lon] = coordMatch;
      const estimatedCoords = [parseFloat(lat), parseFloat(lon)];

      // Find the nearest dataset entry
      let nearestMatch = settings.datasetEntries[0];
      let minDistance = Infinity;
      for (const entry of settings.datasetEntries) {
        const distance = calculateDistance(estimatedCoords[0], estimatedCoords[1], entry.coords[0], entry.coords[1]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestMatch = entry;
        }
      }

      // Append nearest match information to the result
      result += `\nNearest Dataset Match: [${nearestMatch.coords[0]}, ${nearestMatch.coords[1]}], Distance: ${minDistance.toFixed(2)} km`;
    }

    cache.set(cacheKey, result);
    res.json({ result });
  } catch (error) {
    console.error('Gemini API error:', error.message);
    res.status(500).json({ error: 'Error processing Gemini API request' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
