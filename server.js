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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBnAFtB1TcTzpkJ1CwxgjSurhhUSVOo9HI'; // Move to env for security
const PORT = process.env.PORT || 3000;

// Expanded user-agent pool
const userAgents = [
    userAgent.random().toString(),
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Android 13; Mobile; rv:126.0) Gecko/20100101 Firefox/126.0',
    userAgent.random().toString(),
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
    'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
];

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

// Enhanced scraping with pagination and retries
async function scrapeSearchEngine(query, engine, maxRetries = 2) {
    const results = new Set();
    const baseUrl = engine === 'bing' 
        ? 'https://www.bing.com/search?q='
        : 'https://duckduckgo.com/html/?q=';
    const maxPages = 2; // Reduced to 2 pages
    let currentPage = 1;

    while (currentPage <= maxPages) {
        const url = `${baseUrl}${encodeURIComponent(query)}${engine === 'bing' && currentPage > 1 ? `&first=${(currentPage - 1) * 10 + 1}` : ''}`;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                console.log(`Scraping ${engine} page ${currentPage} with URL: ${url}`); // Debug log
                const response = await axios.get(url, {
                    headers: getRandomHeaders(),
                    timeout: 10000,
                    maxRedirects: 3
                });
                const $ = cheerio.load(response.data);

                if (engine === 'bing') {
                    $('.b_algo').each((i, element) => {
                        const title = $(element).find('h2').text().trim() || 'No title';
                        const link = $(element).find('a').attr('href') || '';
                        const snippet = $(element).find('.b_caption p').text().trim() || '';
                        if (title && link && !link.includes('advertisement') && !results.has(link)) {
                            results.add(link);
                            results.add(JSON.stringify({ title, link, snippet }));
                        }
                    });
                    const nextPage = $('.sb_pagN').last().find('a').attr('href');
                    if (!nextPage || results.size >= 50) break;
                } else {
                    $('.result__body').each((i, element) => {
                        const title = $(element).find('.result__title').text().trim() || 'No title';
                        const link = $(element).find('.result__url').attr('href') || '';
                        const snippet = $(element).find('.result__snippet').text().trim() || '';
                        if (title && link && !link.includes('ad') && !results.has(link)) {
                            results.add(link);
                            results.add(JSON.stringify({ title, link, snippet }));
                        }
                    });
                    const nextPage = $('.result--more__btn').length > 0;
                    if (!nextPage || results.size >= 50) break;
                }

                console.log(`Successfully scraped ${engine} page ${currentPage}, results count: ${results.size}`); // Debug log
                currentPage++;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced to 1 second
                break;
            } catch (error) {
                retryCount++;
                console.error(`Error scraping ${engine} page ${currentPage} (attempt ${retryCount}):`, error.message, error.response?.status);
                if (retryCount === maxRetries || error.response?.status === 403 || error.code === 'ECONNRESET') {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Adjusted backoff
            }
        }
    }

    const parsedResults = Array.from(results)
        .filter(item => typeof item === 'string')
        .map(item => JSON.parse(item))
        .slice(0, 50);
    console.log(`Final ${engine} results count: ${parsedResults.length}`); // Debug log
    return parsedResults;
}

// Fixed processWithGemini function
async function processWithGemini(query, scrapedData) {
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
        console.log('Sending request to Gemini API...'); // Debug log
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
                },
                timeout: 30000 // Increased to 30 seconds
            }
        );

        if (response.data.candidates && response.data.candidates[0] && response.data.candidates[0].content) {
            console.log('Received response from Gemini API'); // Debug log
            return response.data.candidates[0].content.parts[0].text || 'No response generated';
        } else {
            throw new Error('Invalid response format from Gemini API');
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error.message, error.response?.status, error.response?.data);
        throw new Error(`Failed to process data with AI: ${error.message || 'Unknown error'}`);
    }
}

app.post('/api/search', async (req, res) => {
    const { query } = req.body || {};
    if (!query || typeof query !== 'string' || query.trim() === '') {
        return res.status(400).json({ message: 'Query is required and must be a non-empty string' });
    }

    try {
        console.log(`Processing query: ${query}`); // Debug log
        // Parallel scraping
        const [bingResults, duckduckgoResults] = await Promise.all([
            scrapeSearchEngine(query.trim(), 'bing'),
            scrapeSearchEngine(query.trim(), 'duckduckgo')
        ]);
        const scrapedData = { bing: bingResults, duckduckgo: duckduckgoResults };

        console.log(`Bing results: ${bingResults.length}, DuckDuckGo results: ${duckduckgoResults.length}`); // Debug log
        if (bingResults.length === 0 && duckduckgoResults.length === 0) {
            return res.status(404).json({ message: 'No data retrieved from search engines' });
        }

        const aiResponse = await processWithGemini(query.trim(), scrapedData);
        res.json({ response: aiResponse });
    } catch (error) {
        console.error('Error in /api/search:', error.message, error.response?.status);
        res.status(error.response?.status || 500).json({ message: error.message || 'Internal server error' });
    }
});

// Serve index.html statically
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Graceful shutdown
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

