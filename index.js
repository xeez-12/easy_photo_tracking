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
    max: 50,
  })
);

// Comprehensive user agents (2025-compatible, updated for June 2025)
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-G993U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/125.0.0.0',
  'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 YaBrowser/24.6.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 OPR/110.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/124.0.0.0 Safari/537.36',
];

const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

// Advanced headers
const getHeaders = () => ({
  'User-Agent': getRandomUserAgent(),
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,fr;q=0.7,es;q=0.5',
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
  'Sec-Ch-Ua': `"Chromium";v="126", "Google Chrome";v="126", "Not.A/Brand";v="99"`,
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Referer': 'https://www.google.com/',
  'Priority': 'u=0, i',
});

// HTTPS agent
const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 30,
  maxFreeSockets: 15,
  timeout: 35000,
  rejectUnauthorized: false,
});

// Axios instance with error handling
const axiosInstance = axios.create({
  httpsAgent,
  timeout: 35000,
  headers: getHeaders(),
  validateStatus: (status) => status >= 200 && status < 400, // Handle non-2xx responses gracefully
});

// Retry logic with jitter
const retryRequest = async (fn, retries = 3, delay = 1500) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      const jitter = Math.random() * 500; // Add jitter to avoid synchronized retries
      console.warn(`Retrying (${i + 1}/${retries}) after error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i) + jitter));
    }
  }
};

// Extract profile picture with fallback
async function getProfilePicture(url) {
  try {
    const response = await axiosInstance.get(url, { timeout: 10000 });
    const $ = cheerio.load(response.data);

    const selectors = [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'img[src*="profile"], img[src*="avatar"], img[src*="user"]',
      'img[class*="profile"], img[class*="avatar"], img[class*="user"]',
      'img[alt*="profile"], img[alt*="avatar"], img[alt*="user"]',
    ];

    for (const selector of selectors) {
      const img = $(selector).first();
      let src = selector.includes('meta') ? img.attr('content') : img.attr('src');
      if (src) {
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

// Social media platforms (20+)
const platforms = [
  { name: 'X', domain: 'x.com', query: (username) => `site:x.com "${username}" -inurl:(signup | login | explore | trends | premium | settings | help)` },
  { name: 'GitHub', domain: 'github.com', query: (username) => `site:github.com "${username}" -inurl:(signup | login | join | auth | enterprise)` },
  { name: 'Reddit', domain: 'reddit.com', query: (username) => `site:reddit.com "${username}" -inurl:(signup | login | register | oauth | premium)` },
  { name: 'Instagram', domain: 'instagram.com', query: (username) => `site:instagram.com "${username}" -inurl:(signup | login | accounts | help | reels)` },
  { name: 'LinkedIn', domain: 'linkedin.com', query: (username) => `site:linkedin.com "${username}" -inurl:(signup | login | join | auth | sales)` },
  { name: 'TikTok', domain: 'tiktok.com', query: (username) => `site:tiktok.com "${username}" -inurl:(signup | login | creator | support | foryou)` },
  { name: 'Facebook', domain: 'facebook.com', query: (username) => `site:facebook.com "${username}" -inurl:(signup | login | account | help | marketplace)` },
  { name: 'YouTube', domain: 'youtube.com', query: (username) => `site:youtube.com "${username}" -inurl:(signup | login | account | watch | shorts)` },
  { name: 'Twitch', domain: 'twitch.tv', query: (username) => `site:twitch.tv "${username}" -inurl:(signup | login | auth | directory)` },
  { name: 'Discord', domain: 'discord.com', query: (username) => `site:discord.com "${username}" -inurl:(signup | login | invite | nitro | support)` },
  { name: 'Pinterest', domain: 'pinterest.com', query: (username) => `site:pinterest.com "${username}" -inurl:(signup | login | account | ideas)` },
  { name: 'Snapchat', domain: 'snapchat.com', query: (username) => `site:snapchat.com "${username}" -inurl:(signup | login | support | ads)` },
  { name: 'Medium', domain: 'medium.com', query: (username) => `site:medium.com "${username}" -inurl:(signup | login | signin | membership)` },
  { name: 'Quora', domain: 'quora.com', query: (username) => `site:quora.com "${username}" -inurl:(signup | login | join | spaces)` },
  { name: 'StackOverflow', domain: 'stackoverflow.com', query: (username) => `site:stackoverflow.com "${username}" -inurl:(signup | login | auth | teams)` },
  { name: 'Behance', domain: 'behance.net', query: (username) => `site:behance.net "${username}" -inurl:(signup | login | join | projects)` },
  { name: 'Dribbble', domain: 'dribbble.com', query: (username) => `site:dribbble.com "${username}" -inurl:(signup | login | join | shots)` },
  { name: 'Vimeo', domain: 'vimeo.com', query: (username) => `site:vimeo.com "${username}" -inurl:(signup | login | join | watch)` },
  { name: 'SoundCloud', domain: 'soundcloud.com', query: (username) => `site:soundcloud.com "${username}" -inurl:(signup | login | auth | tracks)` },
  { name: 'Flickr', domain: 'flickr.com', query: (username) => `site:flickr.com "${username}" -inurl:(signup | login | join | photos)` },
  { name: 'Mastodon', domain: 'mastodon.social', query: (username) => `site:mastodon.social "${username}" -inurl:(signup | login | auth | about)` },
  { name: 'Bluesky', domain: 'bsky.app', query: (username) => `site:bsky.app "${username}" -inurl:(signup | login | join | feed)` },
];

// Scrape Bing for social media
async function scrapeBingSocial(username) {
  const results = [];
  for (const platform of platforms) {
    try {
      const scrape = async () => {
        const query = platform.query(username);
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en-US&mkt=en-US&cc=US`;
        const response = await axiosInstance.get(url);
        if (response.status !== 200) throw new Error(`HTTP ${response.status} from Bing`);
        const $ = cheerio.load(response.data);

        $('li.b_algo').each((i, elem) => {
          const title = $(elem).find('h2').text().trim().slice(0, 256) || 'No Title';
          const link = $(elem).find('a').attr('href');
          const snippet = $(elem).find('.b_caption p').text().trim().slice(0, 1024) || 'No Snippet';

          if (
            link &&
            link.includes(platform.domain) &&
            !snippet.match(/[\u4e00-\u9fff]/) &&
            !title.match(/login|signup|register|join|auth|account|help|support|premium|explore|trends|creator|reels|foryou|marketplace|watch|shorts|nitro|directory|spaces|teams|projects|shots|photos|feed/i) &&
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

  // Fetch profile pictures with concurrency limit
  const limitedPromises = [];
  const maxConcurrent = 5;
  for (const result of results) {
    limitedPromises.push(
      (async () => {
        result.image = await getProfilePicture(result.link) || null;
      })()
    );
    if (limitedPromises.length >= maxConcurrent) {
      await Promise.all(limitedPromises.splice(0, maxConcurrent));
    }
  }
  await Promise.all(limitedPromises);

  return results;
}

// Scrape DuckDuckGo for social media
async function scrapeDuckDuckGoSocial(username) {
  const results = [];
  for (const platform of platforms) {
    try {
      const scrape = async () => {
        const query = platform.query(username);
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await axiosInstance.get(url);
        if (response.status !== 200) throw new Error(`HTTP ${response.status} from DuckDuckGo`);
        const $ = cheerio.load(response.data);

        $('.result__body').each((i, elem) => {
          const title = $(elem).find('.result__title a').text().trim().slice(0, 256) || 'No Title';
          let link = $(elem).find('.result__url').attr('href') || $(elem).find('.result__title a').attr('href');
          const snippet = $(elem).find('.result__snippet').text().trim().slice(0, 1024) || 'No Snippet';

          if (link && link.startsWith('/l/')) {
            const match = response.data.match(/uddg=([^&]+)/);
            if (match) link = decodeURIComponent(match[1]);
          }

          if (
            link &&
            link.includes(platform.domain) &&
            !snippet.match(/[\u4e00-\u9fff]/) &&
            !title.match(/login|signup|register|join|auth|account|help|support|premium|explore|trends|creator|reels|foryou|marketplace|watch|shorts|nitro|directory|spaces|teams|projects|shots|photos|feed/i) &&
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

  // Fetch profile pictures with concurrency limit
  const limitedPromises = [];
  const maxConcurrent = 5;
  for (const result of results) {
    limitedPromises.push(
      (async () => {
        result.image = await getProfilePicture(result.link) || null;
      })()
    );
    if (limitedPromises.length >= maxConcurrent) {
      await Promise.all(limitedPromises.splice(0, maxConcurrent));
    }
  }
  await Promise.all(limitedPromises);

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

    // Combine, deduplicate, and sort
    const allResults = [...bingResults, ...duckResults]
      .filter((v, i, a) => a.findIndex(t => t.link === v.link) === i)
      .sort((a, b) => {
        const aHasUsername = a.title.toLowerCase().includes(username.toLowerCase()) ? 1 : 0;
        const bHasUsername = b.title.toLowerCase().includes(username.toLowerCase()) ? 1 : 0;
        return bHasUsername - aHasUsername;
      })
      .slice(0, 20); // Limit to 20 high-quality results

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
  console.log(`Server running on port ${port} at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}`);
});

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error.message);
});
