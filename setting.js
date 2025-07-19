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
  model: 'gemini-2.5-pro', // Hypothetical advanced model for better photo analysis
  generationConfig: {
    thinkingConfig: {
      thinkingBudget: 500 // Increased for deeper analysis
    },
    responseMimeType: 'text/plain',
    temperature: 0.7, // Balanced for accuracy and creativity
    maxOutputTokens: 2048 // Increased for detailed responses
  },
  tools: [
    {
      googleSearch: {}
    }
  ],
  datasetContext // Export dataset context for use in API calls
};
