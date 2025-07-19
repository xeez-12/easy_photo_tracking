require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const NodeCache = require('node-cache');
const crypto = require('crypto'); // Added for generating unique hash

const settings = require('./setting.js');

const app = express();
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // Cache for 10 minutes

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/dataset', express.static(path.join(__dirname, 'dataset')));

app.post('/api/gemini', async (req, res) => {
  const { imageData, prompt } = req.body;

  // Generate a unique cache key using a hash of the entire imageData
  const cacheKey = crypto.createHash('sha256').update(imageData).digest('hex');

  // Check cache
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
                text: `${settings.analysisPrompt}\nUser Prompt: ${prompt}\n\nDataset Context:\n${settings.datasetContext}`
              }
            ]
          }
        ],
        generationConfig: settings.generationConfig,
        tools: settings.tools
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000 // Increased timeout for complex analysis
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
                    text: `${settings.analysisPrompt}\nUser Prompt: ${prompt}\n\nDataset Context:\n${settings.datasetContext}`
                  }
                ]
              }
            ],
            generationConfig: settings.generationConfig,
            tools: settings.tools
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 20000 // Longer timeout for retry
          }
        );
      }
      throw error;
    });

    const result = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No valid response from Gemini API';
    
    // Store in cache
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
