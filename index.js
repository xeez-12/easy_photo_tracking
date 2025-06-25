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
app.use(express.static('public'));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
  })
);

// Expanded user agents
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-G991U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 plastic/0.0',
  'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Android 13; Mobile; rv:123.0) Gecko/123.0 Firefox/123.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 YaBrowser/23.3.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 OPR/107.0.0.0',
];

const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

// Advanced headers
const getHeaders = () => ({
  'User-Agent': getRandomUserAgent(),
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.7,fr;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'DNT': '1',
  'Sec-Ch-Ua': `"Chromium";v="123", "Not:A-Brand";v="8", "Google Chrome";v="123"`,
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
});

// HTTPS agent
const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 20,
  rejectUnauthorized: false,
});

const axiosInstance = axios.create({
  httpsAgent,
  timeout: 25000,
  headers: getHeaders(),
});

// Extract profile picture from page
async function getProfilePicture(url) {
  try {
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);
    
    // Common profile picture selectors
    const selectors = [
      'img[src*="profile"], img[src*="avatar"], img[src*="user"]',
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'img[class*="profile"], img[class*="avatar"]',
    ];

    for (const selector of selectors) {
      const img = $(selector).first();
      if (selector.includes('meta')) {
        const src = img.attr('content');
        if (src && src.match(/\.(jpg|jpeg|png|webp)$/i)) return src;
      } else {
        const src = img.attr('src');
        if (src && src.match(/\.(jpg|jpeg|png|webp)$/i)) return src;
      }
    }
    return null;
  } catch (error) {
    console.error('Profile picture error:', error.message);
    return null;
  }
}

// Scrape Bing for social media
async function scrapeBingSocial(username) {
  const platforms = [
    { name: 'X', query: `site:x.com "${username}" -inurl:(signup | login)` },
    { name: 'GitHub', query: `site:github.com "${username}" -inurl:(signup | login)` },
    { name: 'Reddit', query: `site:reddit.com "${username}" -inurl:(signup | login)` },
    { name: 'Instagram', query: `site:instagram.com "${username}" -inurl:(signup | login)` },
    { name: 'LinkedIn', query: `site:linkedin.com "${username}" -inurl:(signup | login)` },
  ];

  const results = [];
  for (const platform of platforms) {
    try {
      const url = `https://www.bing.com/search?q=${encodeURIComponent(platform.query)}`;
      const response = await axiosInstance.get(url);
      const $ = cheerio.load(response.data);

      $('li.b_algo').each((i, elem) => {
        const title = $(elem).find('h2').text().trim().slice(0, 256);
        const link = $(elem).find('a').attr('href');
        const snippet = $(elem).find('.b_caption p').text().trim().slice(0, 1024);
        if (title && link && snippet && !snippet.match(/[\u4e00-\u9fff]/)) { // Filter out Chinese characters
          results.push({ title, link, snippet, platform: platform.name });
        }
      });
    } catch (error) {
      console.error(`Bing ${platform.name} error:`, error.message);
    }
  }

  // Fetch profile pictures
  for (const result of results) {
    const image = await getProfilePicture(result.link);
    result.image = image || null;
  }

  return results;
}

// Scrape DuckDuckGo for social media (fixed HTML version)
async function scrapeDuckDuckGoSocial(username) {
  const platforms = [
    { name: 'X', query: `site:x.com "${username}" -signup -login` },
    { name: 'GitHub', query: `site:github.com "${username}" -signup -login` },
    { name: 'Reddit', query: `site:reddit.com "${username}" -signup -login` },
    { name: 'Instagram', query: `site:instagram.com "${username}" -signup -login` },
    { name: 'LinkedIn', query: `site:linkedin.com "${username}" -signup -login` },
  ];

  const results = [];
  for (const platform of platforms) {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(platform.query)}`;
      const response = await axiosInstance.get(url, {
        headers: { ...getHeaders(), 'Accept': 'text/html' },
      });
      const $ = cheerio.load(response.data);

      $('.result__body').each((i, elem) => {
        const title = $(elem).find('.result__title a').text().trim().slice(0, 256);
        const link = $(elem).find('.result__url').attr('href') || $(elem).find('.result__title a').attr('href');
        const snippet = $(elem).find('.result__snippet').text().trim().slice(0, 1024);
        if (title && link && snippet && !snippet.match(/[\u4e00-\u9fff]/)) {
          results.push({ title, link, snippet, platform: platform.name });
        }
      });
    } catch (error) {
      console.error(`DuckDuckGo ${platform.name} error:`, error.message);
    }
  }

  // Fetch profile pictures
  for (const result of results) {
    const image = await getProfilePicture(result.link);
    result.image = image || null;
  }

  return results;
}

// API endpoint
app.post('/api/search', async (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string' || username.length < 3) {
    return res.status(400).json({ error: 'Invalid username' });
  }

  try {
    const [bingResults, duckResults] = await Promise.all([
      scrapeBingSocial(username),
      scrapeDuckDuckGoSocial(username),
    ]);

    // Combine and deduplicate results
    const allResults = [...bingResults, ...duckResults]
      .filter((v, i, a) => a.findIndex(t => t.link === v.link) === i)
      .slice(0, 15);

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
