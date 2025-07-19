module.exports = {
    model: 'gemini-2.5-flash', // Upgraded to a more advanced model for better vision capabilities
    generationConfig: {
        thinkingConfig: {
            thinkingBudget: 0
        },
        responseMimeType: 'text/plain',
        maxOutputTokens: 4096, // Support for longer responses
        temperature: 0.5 // Lower temperature for precise outputs
    },
    tools: [
        {
            googleSearch: {}
        }
    ]
};
