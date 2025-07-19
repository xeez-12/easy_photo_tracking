const fs = require('fs-extra');
const path = require('path');

// Read all .txt files in the dataset folder
const datasetPath = path.join(__dirname, 'dataset');
const datasetContext = fs.existsSync(datasetPath)
  ? fs.readdirSync(datasetPath)
      .filter(file => file.endsWith('.txt'))
      .map(file => fs.readFileSync(path.join(datasetPath, file), 'utf-8'))
      .join('\n')
  : '';

module.exports = {
  model: 'gemini-2.5-pro',
  generationConfig: {
    thinkingConfig: {
      thinkingBudget: 1000
    },
    responseMimeType: 'text/plain',
    temperature: 0.4,
    maxOutputTokens: 4096
  },
  tools: [
    {
      googleSearch: {}
    }
  ],
  datasetContext,
  analysisPrompt: `
    Analyze the provided image to identify key visual elements, including buildings and landmarks.
    Search for initial geographic coordinates based on visual cues and dataset context.
    Compare these coordinates with the dataset to find the nearest matching location by calculating the smallest Euclidean distance to known coordinates in the dataset.
    Verify the coordinates by cross-checking with known building patterns, dataset information, and the nearest match.
    Detect similarities with known buildings and confirm the most accurate coordinates.
    Return the result in the format: 'Coordinates: [latitude, longitude], Nearest Dataset Match: [nearest latitude, longitude], Distance: [distance in km], Verification: [confidence level], Building Similarity: [similarity description]'.
  `
};
