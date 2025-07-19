const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const cv = require('opencv4nodejs');
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

// Function to preprocess image with OpenCV
async function preprocessImage(imageData) {
    try {
        // Decode base64 image to buffer
        const buffer = Buffer.from(imageData, 'base64');
        const img = cv.imdecode(buffer);

        // Extract features (e.g., edge detection, color histogram)
        const grayImg = img.bgrToGray();
        const edges = grayImg.canny(100, 200);
        const edgeCount = edges.countNonZero();

        // Basic color histogram
        const hist = img.calcHist([256], [0]);
        const dominantColor = hist.getData().slice(0, 3).join(', ');

        return {
            edgeCount: edgeCount,
            dominantColor: dominantColor,
            width: img.cols,
            height: img.rows
        };
    } catch (error) {
        console.error('OpenCV preprocessing error:', error.message);
        return {};
    }
}

app.post('/api/gemini', async (req, res) => {
    const { imageData, prompt } = req.body;
    try {
        // Aggregate context from dataset files
        const datasetContext = await getDatasetContext();

        // Preprocess image with OpenCV
        const imageFeatures = await preprocessImage(imageData);

        // Enhanced prompt with dataset context and image features
        const enhancedPrompt = `
            ${prompt}
            Additional Context from Dataset:
            ${datasetContext}
            Image Features (from OpenCV analysis):
            - Edge Count: ${imageFeatures.edgeCount || 'N/A'}
            - Dominant Color (RGB): ${imageFeatures.dominantColor || 'N/A'}
            - Image Dimensions: ${imageFeatures.width || 'N/A'}x${imageFeatures.height || 'N/A'}
            Instructions: Use the provided image, dataset context, and extracted image features to provide a highly accurate identification of the object in the image. 
            Even if the object is not a landmark, focus on unique visual characteristics (edges, colors, shapes) and cross-reference with dataset descriptions to ensure precise identification. 
            Provide a detailed response with confidence scores if possible.
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
                    maxOutputTokens: 4096, // Increased for detailed responses
                    temperature: 0.5 // Lower temperature for higher precision
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
