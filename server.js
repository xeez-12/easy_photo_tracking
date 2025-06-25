const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const userAgent = require('user-agents');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';
const PORT = process.env.PORT || 3000;

const userAgents = [
    userAgent.random().toString(),
    userAgent.random().toString(),
    userAgent.random().toString()
];

async function scrapeSearchEngine(query, engine) {
    const headers = {
        'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive'
    };

    const url = engine === 'bing' 
        ? `https://www.bing.com/search?q=${encodeURIComponent(query)}`
        : `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    try {
        const response = await axios.get(url, { headers });
        const $ = cheerio.load(response.data);
        const results = [];

        if (engine === 'bing') {
            $('.b_algo').each((i, element) => {
                const title = $(element).find('h2').text().trim();
                const link = $(element).find('a').attr('href');
                const snippet = $(element).find('.b_caption p').text().trim();
                if (title && link) {
                    results.push({ title, link, snippet });
                }
            });
        } else {
            $('.result__body').each((i, element) => {
                const title = $(element).find('.result__title').text().trim();
                const link = $(element).find('.result__url').attr('href');
                const snippet = $(element).find('.result__snippet').text().trim();
                if (title && link) {
                    results.push({ title, link, snippet });
                }
            });
        }

        return results.slice(0, 5);
    } catch (error) {
        console.error(`Error scraping ${engine}:`, error.message);
        return [];
    }
}

async function processWithGemini(query, scrapedData) {
    const prompt = `
        You are an advanced OSINT assistant specializing in analyzing publicly available data from social media and web sources. 

        User query: ${query}

        Scraped data from Bing and DuckDuckGo:
        \`\`\`
        ${JSON.stringify(scrapedData, null, 2)}
        \`\`\`

        Please provide a comprehensive, well-structured response with:
        - Relevant findings from the scraped data
        - Clear explanations of sources and their credibility
        - Actionable insights or next steps for the user
        - Use proper formatting with headings, bullet points, and emphasis where appropriate
        - Be concise, factual, and ethical in handling sensitive information
        - Avoid speculation or unverified claims

        Format your response using markdown-style formatting for better readability. Wrap raw data in triple backticks (```) as a data file.
    `;

    try {
        const response = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.8,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GEMINI_API_KEY}`
                }
            }
        );

        if (response.data.candidates && response.data.candidates[0] && response.data.candidates[0].content) {
            return response.data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('Invalid response format from Gemini API');
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error.message);
        throw new Error('Failed to process data with AI');
    }
}

app.post('/api/search', async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ message: 'Query is required' });
    }

    try {
        const bingResults = await scrapeSearchEngine(query, 'bing');
        const duckduckgoResults = await scrapeSearchEngine(query, 'duckduckgo');
        const scrapedData = { bing: bingResults, duckduckgo: duckduckgoResults };

        const aiResponse = await processWithGemini(query, scrapedData);
        res.json({ response: aiResponse });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
