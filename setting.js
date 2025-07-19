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
  model: 'gemini-2.5-pro', // Upgraded to a more advanced model for enhanced analysis
  generationConfig: {
    thinkingConfig: {
      thinkingBudget: 1000 // Increased for deeper analysis and verification
    },
    responseMimeType: 'text/plain',
    temperature: 0.4, // Lowered for higher precision
    maxOutputTokens: 4096 // Increased for detailed output
  },
  tools: [
    {
      googleSearch: {}
    }
  ],
  datasetContext,
  analysisPrompt: `
    Analyze the provided image to identify key visual elements, including buildings and landmarks.
    Search for accurate geographic coordinates based on visual cues and dataset context.
    Verify the coordinates by cross-checking with known building patterns and dataset information.
    Detect similarities with known buildings and confirm the most accurate coordinates.
    Return the result in the format: 'Coordinates: [latitude, longitude], Verification: [confidence level], Building Similarity: [similarity description]'.
  `
};
