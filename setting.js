const fs = require('fs-extra');
const path = require('path');

// Read all .txt files in the dataset folder and parse coordinates
const datasetPath = path.join(__dirname, 'dataset');
const datasetEntries = fs.existsSync(datasetPath)
  ? fs.readdirSync(datasetPath)
      .filter(file => file.endsWith('.txt'))
      .map(file => {
        const content = fs.readFileSync(path.join(datasetPath, file), 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        return lines.map(line => {
          const match = line.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
          return match ? { coords: [parseFloat(match[1]), parseFloat(match[2])], description: line } : null;
        }).filter(item => item);
      })
      .flat()
  : [];

module.exports = {
  model: 'gemini-2.5-flash',
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
  datasetEntries, // Export parsed dataset entries
  analysisPrompt: `
    Analyze the provided image to identify key visual elements, including buildings and landmarks.
    Estimate initial geographic coordinates based on visual cues and dataset context.
    Verify the coordinates by cross-checking with known building patterns and dataset information.
    Detect similarities with known buildings and provide a confidence level.
    Return the result in the format: 'Coordinates: [latitude, longitude], Verification: [confidence level], Building Similarity: [similarity description]'.
  `
};
