const express = require('express');
const path = require('path');
const { getJson } = require('serpapi');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Serve the index.html file for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint for Google Lens and Gemini processing
app.post('/process-image', async (req, res) => {
  const { imageUrl } = req.body;

  try {
    // Google Lens search via SerpApi
    const lensResponse = await new Promise((resolve, reject) => {
      getJson(
        {
          engine: 'google_lens',
          hl: 'en',
          country: 'jp',
          url: imageUrl,
          api_key: process.env.SERPAPI_KEY, // Use environment variable
        },
        (json) => {
          if (json.error) reject(json.error);
          else resolve(json);
        }
      );
    });

    const visualMatches = lensResponse['visual_matches'] || [];

    // Send visual matches to Gemini for verification/enhancement
    const geminiResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      {
        contents: [
          {
            parts: [
              {
                text: `Analyze these Google Lens visual matches and provide a concise summary of the most relevant location or object information: ${JSON.stringify(visualMatches.slice(0, 5))}`,
              },
            ],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GEMINI_API_KEY}`, // Use environment variable
        },
      }
    );

    const geminiSummary = geminiResponse.data.candidates[0].content.parts[0].text;

    res.json({
      visualMatches,
      geminiSummary,
    });
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
