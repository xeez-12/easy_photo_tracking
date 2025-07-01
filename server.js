const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// User-Agent rotation
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
];

// Randomly select a user-agent
const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

// Headers for scraping
const headers = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'DNT': '1',
    'Upgrade-Insecure-Requests': '1',
};

// Function to scrape Bing
async function scrapeBing(query) {
    try {
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        const response = await axios.get(url, {
            headers: { ...headers, 'User-Agent': getRandomUserAgent() },
            timeout: 10000,
        });
        const $ = cheerio.load(response.data);
        const results = [];

        $('#b_results .b_algo').each((i, element) => {
            const title = $(element).find('h2').text().trim();
            const link = $(element).find('a').attr('href');
            const snippet = $(element).find('.b_caption p').text().trim();
            if (title && link && snippet) {
                results.push({ title, link, snippet });
            }
        });

        return results.slice(0, 5); // Limit to top 5 results
    } catch (error) {
        console.error('Bing scraping error:', error.message);
        return [];
    }
}

// Function to scrape DuckDuckGo
async function scrapeDuckDuckGo(query) {
    try {
        const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await axios.get(url, {
            headers: { ...headers, 'User-Agent': getRandomUserAgent() },
            timeout: 10000,
        });
        const $ = cheerio.load(response.data);
        const results = [];

        $('.results .result__body').each((i, element) => {
            const title = $(element).find('.result__title a').text().trim();
            const link = $(element).find('.result__url').attr('href');
            const snippet = $(element).find('.result__snippet').text().trim();
            if (title && link && snippet) {
                results.push({ title, link: `https://duckduckgo.com${link}`, snippet });
            }
        });

        return results.slice(0, 5); // Limit to top 5 results
    } catch (error) {
        console.error('DuckDuckGo scraping error:', error.message);
        return [];
    }
}

// Function to query Gemini API
async function queryGemini(content) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        console.error('Gemini API key not set');
        return null;
    }

    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{ text: `Summarize the following information about a username in 2-3 sentences: ${content}` }]
                }]
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000,
            }
        );
        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Gemini API error:', error.message);
        return null;
    }
}

// Search endpoint
app.post('/search', async (req, res) => {
    const { username } = req.body;

    if (!username || !username.startsWith('@')) {
        return res.status(400).json({ error: 'Invalid username. Must start with @' });
    }

    try {
        // Scrape Bing and DuckDuckGo concurrently
        const [bingResults, duckduckgoResults] = await Promise.all([
            scrapeBing(username),
            scrapeDuckDuckGo(username),
        ]);

        // Combine and deduplicate results
        const allResults = [...bingResults, ...duckduckgoResults];
        const uniqueResults = Array.from(
            new Map(allResults.map(item => [item.link, item])).values()
        );

        // Prepare content for Gemini
        const content = uniqueResults
            .map(r => `Title: ${r.title}\nSnippet: ${r.snippet}`)
            .join('\n\n');

        // Query Gemini for summary
        const summary = content ? await queryGemini(content) : null;

        res.json({ results: uniqueResults, summary });
    } catch (error) {
        console.error('Search error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
