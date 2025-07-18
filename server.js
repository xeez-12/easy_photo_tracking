const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

// Load configuration
const config = require('./config.json');

// Middleware to parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Serve static files from 'public' and 'dataset' folders
app.use(express.static(path.join(__dirname, 'public')));
app.use('/dataset', express.static(path.join(__dirname, 'dataset')));

// Gemini API endpoint
app.post('/api/gemini', async (req, res) => {
    const { imageData, prompt } = req.body;
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: imageData
                            }
                        },
                        { text: prompt }
                    ]
                }]
            },
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );

        const result = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No valid response from Gemini API';
        res.json({ result });
    } catch (error) {
        console.error('Gemini API error:', error.message);
        res.status(500).json({ error: 'Error processing Gemini API request' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

