const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { Agent } = require('https');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files (UI)
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
  })
);

// Expanded user agents
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/121.0.0.0',
  'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Android 14; Mobile; rv:122.0) Gecko/122.0 Firefox/122.0',
];

const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

// Advanced headers
const getHeaders = () => ({
  'User-Agent': getRandomUserAgent(),
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'DNT': '1', // Do Not Track
  'Sec-Ch-Ua': `"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"`,
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
});

// HTTPS agent
const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 15,
  rejectUnauthorized: false,
});

const axiosInstance = axios.create({
  httpsAgent,
  timeout: 20000,
  headers: getHeaders(),
});

// Scrape Bing for username
async function scrapeBing(username) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(`"${username}" site:*.com`)}`;
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);

    const results = [];
    $('li.b_algo').each((i, elem) => {
      const title = $(elem).find('h2').text().trim().slice(0, 256);
      const link = $(elem).find('a').attr('href');
      const snippet = $(elem).find('.b_caption p').text().trim().slice(0, 1024);
      if (title && link && snippet) {
        results.push({ title, link, snippet, platform: 'Web' });
      }
    });

    return results;
  } catch (error) {
    console.error('Bing scraping error:', error.message);
    return [];
  }
}

// Scrape DuckDuckGo for username
async function scrapeDuckDuckGo(username) {
  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(`"${username}"`)}`;
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);

    const results = [];
    $('div.result').each((i, elem) => {
      const title = $(elem).find('h2.result__title').text().trim().slice(0, 256);
      const link = $(elem).find('a.result__url').attr('href');
      const snippet = $(elem).find('div.result__snippet').text().trim().slice(0, 1024);
      if (title && link && snippet) {
        results.push({ title, link, snippet, platform: 'Web' });
      }
    });

    return results;
  } catch (error) {
    console.error('DuckDuckGo scraping error:', error.message);
    return [];
  }
}

// Scrape social media platforms (X, GitHub, Reddit)
async function scrapeSocialMedia(username) {
  try {
    const platforms = [
      { name: 'X', query: `site:x.com "${username}"` },
      { name: 'GitHub', query: `site:github.com "${username}"` },
      { name: 'Reddit', query: `site:reddit.com "${username}"` },
    ];

    const results = [];
    for (const platform of platforms) {
      const url = `https://www.bing.com/search?q=${encodeURIComponent(platform.query)}`;
      const response = await axiosInstance.get(url);
      const $ = cheerio.load(response.data);

      $('li.b_algo').each((i, elem) => {
        const title = $(elem).find('h2').text().trim().slice(0, 256);
        const link = $(elem).find('a').attr('href');
        const snippet = $(elem).find('.b_caption p').text().trim().slice(0, 1024);
        if (title && link && snippet) {
          results.push({ title, link, snippet, platform: platform.name });
        }
      });
    }

    return results;
  } catch (error) {
    console.error('Social media scraping error:', error.message);
    return [];
  }
}

// API endpoint for username search
app.post('/api/search', async (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string' || username.length < 3) {
    return res.status(400).json({ error: 'Invalid username' });
  }

  try {
    const [bingResults, duckResults, socialResults] = await Promise.all([
      scrapeBing(username),
      scrapeDuckDuckGo(username),
      scrapeSocialMedia(username),
    ]);

    const allResults = [...bingResults, ...duckResults, ...socialResults].slice(0, 20);
    res.json({ results: allResults });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve UI
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Railway port binding
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});
