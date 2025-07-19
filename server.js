const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

const settings = require('./setting.js');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/dataset', express.static(path.join(__dirname, 'dataset')));

app.post('/api/gemini', async (req, res) => {
    const { imageData, prompt } = req.body;
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
                }],
                generationConfig: settings.generationConfig,
                tools: settings.tools
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


