const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const userAgent = require('user-agents');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBnAFtB1TcTzpkJ1CwxgjSurhhUSVOo9HI'; // Set in env
const PORT = process.env.PORT || 3000;

// Expanded user-agent pool
const userAgents = Array(10).fill().map(() => userAgent.random().toString());

// Simple logging function
const log = (reqId, message, level = 'info') => {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    console[level](`[${timestamp}] [${reqId}] [${level.toUpperCase()}] ${message}`);
};

// Complex headers with randomization
function getRandomHeaders() {
    const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
    return {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': `https://www.google.com/search?q=${encodeURIComponent(Math.random().toString(36).substring(7))}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Cookie': `session_id=${Math.random().toString(36).substring(2, 15)}; visited=true`,
        'Upgrade-Insecure-Requests': '1'
    };
}

// Enhanced scraping with pagination
async function scrapeSearchEngine(reqId, query, engine) {
    const results = new Set();
    const baseUrl = engine === 'bing' 
        ? 'https://www.bing.com/search?q='
        : 'https://duckduckgo.com/html/?q=';
    const maxPages = 1; // Single page
    let currentPage = 1;

    while (currentPage <= maxPages) {
        const url = `${baseUrl}${encodeURIComponent(query)}${engine === 'bing' && currentPage > 1 ? `&first=${(currentPage - 1) * 10 + 1}` : ''}`;
        log(reqId, `Scraping ${engine} page ${currentPage} with URL: ${url}`);

        try {
            const response = await axios.get(url, {
                headers: getRandomHeaders(),
                timeout: 20000, // 20 seconds
                maxRedirects: 3
            });
            const $ = cheerio.load(response.data);

            if (engine === 'bing') {
                $('.b_algo').each((i, element) => {
                    const title = $(element).find('h2 a').text().trim() || 'No title';
                    const link = $(element).find('a').attr('href') || '';
                    const snippet = $(element).find('.b_caption p').text().trim() || '';
                    if (title && link && !link.includes('advertisement')) {
                        results.add(JSON.stringify({ title, link, snippet })); // Only add JSON
                    }
                });
            } else {
                $('.result__body').each((i, element) => {
                    const title = $(element).find('.result__title a').text().trim() || 'No title';
                    const link = $(element).find('.result__url').attr('href') || '';
                    const snippet = $(element).find('.result__snippet').text().trim() || '';
                    if (title && link && !link.includes('ad')) {
                        results.add(JSON.stringify({ title, link, snippet })); // Only add JSON
                    }
                });
            }

            log(reqId, `Successfully scraped ${engine} page ${currentPage}, results count: ${results.size}`, 'info');
            currentPage++;
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
        } catch (error) {
            log(reqId, `Error scraping ${engine} page ${currentPage}: ${error.message} (Status: ${error.response?.status})`, 'error');
            break;
        }
    }

    const parsedResults = Array.from(results)
        .map(item => {
            try {
                return JSON.parse(item); // Parse only valid JSON
            } catch (e) {
                log(reqId, `Skipping invalid JSON: ${item}`, 'warn');
                return null;
            }
        })
        .filter(item => item !== null)
        .slice(0, 50);
    log(reqId, `Final ${engine} results count: ${parsedResults.length}`);
    return parsedResults;
}

// Process with Gemini API
async function processWithGemini(reqId, query, scrapedData) {
    const scrapedDataJson = JSON.stringify(scrapedData, null, 2);
    const prompt = `You are an advanced OSINT assistant specializing in analyzing publicly available data from web sources.

User query: ${query}

Scraped data from Bing and DuckDuckGo:
${scrapedDataJson}

Please provide a comprehensive, well-structured response with:
- Relevant findings from the scraped data
- Clear explanations of sources and their credibility
- Actionable insights or next steps for the user
- Use proper formatting with headings, bullet points, and emphasis where appropriate
- Be concise, factual, and ethical in handling sensitive information
- Avoid speculation or unverified claims

Format your response using markdown-style formatting for better readability.`;

    try {
        log(reqId, 'Sending request to Gemini API...');
        const response = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
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
                },
                timeout: 30000 // 30 seconds
            }
        );

        if (response.data.candidates && response.data.candidates[0] && response.data.candidates[0].content) {
            log(reqId, 'Received response from Gemini API');
            return response.data.candidates[0].content.parts[0].text || 'No response generated';
        } else {
            throw new Error('Invalid response format from Gemini API');
        }
    } catch (error) {
        log(reqId, `Error calling Gemini API: ${error.message} (Status: ${error.response?.status})`, 'error');
        throw new Error(`Failed to process data with AI: ${error.message || 'Unknown error'}`);
    }
}

app.post('/api/search', async (req, res) => {
    const reqId = Math.random().toString(36).substring(2, 8); // Unique request ID
    const { query } = req.body || {};
    if (!query || typeof query !== 'string' || query.trim() === '') {
        return res.status(400).json({ message: 'Query is required and must be a non-empty string' });
    }

    try {
        log(reqId, `Processing query: ${query}`);
        const [bingResults, duckduckgoResults] = await Promise.all([
            scrapeSearchEngine(reqId, query.trim(), 'bing'),
            scrapeSearchEngine(reqId, query.trim(), 'duckduckgo')
        ]);
        const scrapedData = { bing: bingResults, duckduckgo: duckduckgoResults };

        log(reqId, `Bing results: ${bingResults.length}, DuckDuckGo results: ${duckduckgoResults.length}`);
        if (bingResults.length === 0 && duckduckgoResults.length === 0) {
            return res.status(404).json({ message: 'No data retrieved from search engines' });
        }

        const aiResponse = await processWithGemini(reqId, query.trim(), scrapedData);
        res.json({ response: aiResponse });
    } catch (error) {
        log(reqId, `Error in /api/search: ${error.message} (Status: ${error.response?.status})`, 'error');
        res.status(error.response?.status || 500).json({ message: error.message || 'Internal server error' });
    }
});

// Serve index.html statically
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Graceful shutdown
const server = app.listen(PORT, () => {
    log('SERVER', `Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
    log('SERVER', 'SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    log('SERVER', `Uncaught Exception: ${err.message}`, 'error');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log('SERVER', `Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
    process.exit(1);
});


