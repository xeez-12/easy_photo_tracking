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
    max: 50, // Reduced to avoid blocks
  })
);

// Comprehensive user agents (2025-compatible)
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-G990U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/123.0.0.0',
  'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 YaBrowser/24.1.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 OPR/108.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/21.0 Chrome/122.0.0.0 Safari/537.36',
];

const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

// Advanced headers (mimics real browser)
const getHeaders = () => ({
  'User-Agent': getRandomUserAgent(),
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.8,fr;q=0.6,es;q=0.4',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'DNT': '1',
  'Sec-Ch-Ua': `"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"`,
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Referer': 'https://www.google.com/', // Fake referer to avoid blocks
  'Priority': 'u=0, i',
});

// HTTPS agent with optimized settings
const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 25,
  maxFreeSockets: 10,
  timeout: 30000,
  rejectUnauthorized: false,
});

// Axios instance with retry logic
const axiosInstance = axios.create({
  httpsAgent,
  timeout: 30000,
  headers: getHeaders(),
});

// Add retry logic
const retryRequest = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`Retrying (${i + 1}/${retries}) after error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
};

// Extract profile picture
async function getProfilePicture(url) {
  try {
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);

    const selectors = [
      'img[src*="profile"], img[src*="avatar"], img[src*="user"]',
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'img[class*="profile"], img[class*="avatar"], img[class*="user"]',
      'img[alt*="profile"], img[alt*="avatar"]',
    ];

    for (const selector of selectors) {
      const img = $(selector).first();
      let src = selector.includes('meta') ? img.attr('content') : img.attr('src');
      if (src) {
        // Handle relative URLs
        if (src.startsWith('/')) {
          const { origin } = new URL(url);
          src = `${origin}${src}`;
        }
        if (src.match(/\.(jpg|jpeg|png|webp)$/i)) return src;
      }
    }
    return null;
  } catch (error) {
    console.error(`Profile picture error for ${url}:`, error.message);
    return null;
  }
}

// Scrape Bing for social media
async function scrapeBingSocial(username) {
  const platforms = [
    { name: 'X', domain: 'x.com', query: `site:x.com "${username}" -inurl:(signup | login | explore | trends | premium)` },
    { name: 'GitHub', domain: 'github.com', query: `site:github.com "${username}" -inurl:(signup | login | join)` },
    { name: 'Reddit', domain: 'reddit.com', query: `site:reddit.com "${username}" -inurl:(signup | login | register)` },
    { name: 'Instagram', domain: 'instagram.com', query: `site:instagram.com "${username}" -inurl:(signup | login | accounts)` },
    { name: 'LinkedIn', domain: 'linkedin.com', query: `site:linkedin.com "${username}" -inurl:(signup | login | join)` },
    { name: 'TikTok', domain: 'tiktok.com', query: `site:tiktok.com "${username}" -inurl:(signup | login | creator)` },
  ];

  const results = [];
  for (const platform of platforms) {
    try {
      const scrape = async () => {
        const url = `https://www.bing.com/search?q=${encodeURIComponent(platform.query)}&setlang=en-US`;
        const response = await axiosInstance.get(url, {
          headers: { ...getHeaders(), 'Accept-Language': 'en-US,en;q=0.9' },
        });
        const $ = cheerio.load(response.data);

        $('li.b_algo').each((i, elem) => {
          const title = $(elem).find('h2').text().trim().slice(0, 256);
          const link = $(elem).find('a').attr('href');
          const snippet = $(elem).find('.b_caption p').text().trim().slice(0, 1024);

          // Strict relevance filters
          if (
            title && link && snippet &&
            link.includes(platform.domain) &&
            !snippet.match(/[\u4e00-\u9fff]/) && // No Chinese
            !title.match(/login|signup|register|join/i) &&
            (title.toLowerCase().includes(username.toLowerCase()) || snippet.toLowerCase().includes(username.toLowerCase()))
          ) {
            results.push({ title, link, snippet, platform: platform.name });
          }
        });
      };
      await retryRequest(scrape);
    } catch (error) {
      console.error(`Bing ${platform.name} error:`, error.message);
    }
  }

  // Fetch profile pictures
  await Promise.all(results.map(async (result) => {
    result.image = await getProfilePicture(result.link) || null;
  }));

  return results;
}

// Scrape DuckDuckGo for social media (fixed and optimized)
async function scrapeDuckDuckGoSocial(username) {
  const platforms = [
    { name: 'X', domain: 'x.com', query: `site:x.com "${username}" -signup -login -explore -trends` },
    { name: 'GitHub', domain: 'github.com', query: `site:github.com "${username}" -signup -login -join` },
    { name: 'Reddit', domain: 'reddit.com', query: `site:reddit.com "${username}" -signup -login -register` },
    { name: 'Instagram', domain: 'instagram.com', query: `site:instagram.com "${username}" -signup -login -accounts` },
    { name: 'LinkedIn', domain: 'linkedin.com', query: `site:linkedin.com "${username}" -signup -login -join` },
    { name: 'TikTok', domain: 'tiktok.com', query: `site:tiktok.com "${username}" -signup -login -creator` },
  ];

  const results = [];
  for (const platform of platforms) {
    try {
      const scrape = async () => {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(platform.query)}`;
        const response = await axiosInstance.get(url, {
          headers: {
            ...getHeaders(),
            'Accept': 'text/html',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        const $ = cheerio.load(response.data);

        $('.result__body').each((i, elem) => {
          const title = $(elem).find('.result__title a').text().trim().slice(0, 256);
          let link = $(elem).find('.result__url').attr('href') || $(elem).find('.result__title a').attr('href');
          const snippet = $(elem).find('.result__snippet').text().trim().slice(0, 1024);

          // Handle DuckDuckGo's /l/?uddg= redirects
          if (link && link.startsWith('/l/')) {
            const match = response.data.match(/uddg=([^&]+)/);
            if (match) link = decodeURIComponent(match[1]);
          }

          // Strict relevance filters
          if (
            title && link && snippet &&
            link.includes(platform.domain) &&
            !snippet.match(/[\u4e00-\u9fff]/) &&
            !title.match(/login|signup|register|join/i) &&
            (title.toLowerCase().includes(username.toLowerCase()) || snippet.toLowerCase().includes(username.toLowerCase()))
          ) {
            results.push({ title, link, snippet, platform: platform.name });
          }
        });
      };
      await retryRequest(scrape);
    } catch (error) {
      console.error(`DuckDuckGo ${platform.name} error:`, error.message);
    }
  }

  // Fetch profile pictures
  await Promise.all(results.map(async (result) => {
    result.image = await getProfilePicture(result.link) || null;
  }));

  return results;
}

// API endpoint
app.post('/api/search', async (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string' || username.length < 3 || username.length > 50) {
    return res.status(400).json({ error: 'Username must be 3-50 characters' });
  }

  try {
    const [bingResults, duckResults] = await Promise.all([
      scrapeBingSocial(username),
      scrapeDuckDuckGoSocial(username),
    ]);

    // Combine and deduplicate
    const allResults = [...bingResults, ...duckResults]
      .filter((v, i, a) => a.findIndex(t => t.link === v.link) === i)
      .sort((a, b) => {
        // Prioritize results with username in title
        const aHasUsername = a.title.toLowerCase().includes(username.toLowerCase()) ? 1 : 0;
        const bHasUsername = b.title.toLowerCase().includes(username.toLowerCase()) ? 1 : 0;
        return bHasUsername - aHasUsername;
      })
      .slice(0, 12); // Limit to 12 high-quality results

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
