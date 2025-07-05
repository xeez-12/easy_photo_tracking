const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// User Agent Pool
const userAgentPool = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/605.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1'
];

// Social Media Scraping Function
async function scrapeSocialMediaProfile(url, platform) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
            executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium'
        });

        const page = await browser.newPage();
        await page.setUserAgent(userAgentPool[Math.floor(Math.random() * userAgentPool.length)]);
        await page.setViewport({ width: 1366, height: 768 });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const profileData = await page.evaluate((platform) => {
            const getText = (selector) => document.querySelector(selector)?.textContent?.trim() || '';
            const getImage = (selector) => document.querySelector(selector)?.src || '';

            const platformSelectors = {
                tiktok: {
                    profilePic: 'img[data-testid="user-avatar"]',
                    bio: '[data-testid="user-bio"]',
                    followers: '[data-testid="user-followers"] strong',
                    posts: '[data-testid="user-videos"] strong'
                },
                instagram: {
                    profilePic: 'img[alt*="profile picture"]',
                    bio: '._aa_y div div span',
                    followers: 'a[href*="/followers/"] span',
                    posts: 'span._ac2a'
                },
                twitter: {
                    profilePic: 'img[alt="Profile picture"]',
                    bio: '[data-testid="UserDescription"]',
                    followers: '[data-testid="followers"] span',
                    posts: '[data-testid="tweet"]'
                },
                facebook: {
                    profilePic: 'img.x1y9k2m',
                    bio: 'div.x1heor9g div.x1iorvi4 span',
                    followers: 'span.x1e558r4',
                    posts: 'div.x1n2onr6 div.x1yztbdb'
                },
                youtube: {
                    profilePic: 'img#img',
                    bio: '#description.ytd-channel-about-metadata-renderer',
                    followers: '#subscriber-count',
                    posts: 'ytd-grid-video-renderer'
                },
                linkedin: {
                    profilePic: 'img.pv-top-card--photo',
                    bio: '.pv-about-section .pv-about__summary-text',
                    followers: '.follower-count',
                    posts: '.share-box-feed-entry'
                }
            };

            const selectors = platformSelectors[platform] || {};
            return {
                profilePic: getImage(selectors.profilePic),
                bio: getText(selectors.bio),
                followers: getText(selectors.followers),
                postCount: document.querySelectorAll(selectors.posts).length || getText(selectors.posts)
            };
        }, platform);

        const screenshot = await page.screenshot({ 
            encoding: 'base64',
            fullPage: false,
            clip: { x: 0, y: 0, width: 1366, height: 768 }
        });

        await browser.close();

        return {
            url,
            ...profileData,
            screenshot: `data:image/png;base64,${screenshot}`,
            scraped_at: new Date().toISOString(),
            platform
        };
    } catch (error) {
        return { url, error: error.message, scraped_at: new Date().toISOString(), platform };
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
    }
}

// Gemini API Integration
async function queryGemini(prompt) {
    try {
        const response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        }, {
            params: {
                key: process.env.GEMINI_API_KEY
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Gemini API Error:', error.response?.data || error.message);
        return "Error processing your request with Gemini API";
    }
}

// Routes
app.post('/api/scrape-social', async (req, res) => {
    const { url, platform } = req.body;

    if (!url || !platform) {
        return res.status(400).json({ error: 'URL and platform are required' });
    }

    try {
        const result = await scrapeSocialMediaProfile(url, platform);
        res.json({
            success: true,
            result
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Scraping failed', 
            details: error.message 
        });
    }
});

app.post('/api/query-gemini', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const response = await queryGemini(prompt);
        res.json({
            success: true,
            response
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Gemini query failed', 
            details: error.message 
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './public' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`OSINT Platform running on port ${PORT}`);
});
