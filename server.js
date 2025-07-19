const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const app = express();

const settings = require('./setting.js');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/dataset', express.static(path.join(__dirname, 'dataset')));

// Function to read all .txt files from the dataset folder
async function getDatasetContext() {
    const datasetPath = path.join(__dirname, 'dataset');
    try {
        const files = await fs.readdir(datasetPath);
        const txtFiles = files.filter(file => file.endsWith('.txt'));
        let context = '';

        for (const file of txtFiles) {
            const filePath = path.join(datasetPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            context += `File: ${file}\n${content}\n\n`;
        }

        return context || 'No dataset files found.';
    } catch (error) {
        console.error('Error reading dataset:', error.message);
        return 'Error loading dataset context.';
    }
}

app.post('/api/gemini', async (req, res) => {
    const { imageData, prompt } = req.body;
    try {
        // Aggregate context from dataset files
        const datasetContext = await getDatasetContext();

        // Enhanced prompt with dataset context for better accuracy
        const enhancedPrompt = `
            ${prompt}
            Additional Context from Dataset:
            ${datasetContext}
            Instructions: Use the provided image and dataset context to provide a detailed and accurate response. 
            If the image contains a building, cross-reference with dataset descriptions to identify unique features 
            and avoid confusion with similar buildings. Provide specific details where possible.
        `;

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
                        { text: enhancedPrompt }
                    ]
                }],
                generationConfig: {
                    ...settings.generationConfig,
                    maxOutputTokens: 2048, // Increase token limit for more detailed responses
                    temperature: 0.7 // Adjust for balanced creativity and accuracy
                },
                tools: settings.tools
            },
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );

        const result = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No valid response from Gemini API';
        res.json({ result });
    } catch (error) {
        console.error('Gemini API error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        res.status(500).json({ error: 'Error processing Gemini API request' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
