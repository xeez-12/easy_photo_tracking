const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const tough = require('tough-cookie');
const puppeteer = require('puppeteer');
const userAgentPool = require('./useragents');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Enhanced Headers Configuration
const getAdvancedHeaders = (referer = null, isXHR = false) => {
    const userAgent = userAgentPool[Math.floor(Math.random() * userAgentPool.length)];
    return {
        'User-Agent': userAgent,
        'Accept': isXHR ? 'application/json, text/plain, */*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,en-GB;q=0.8,es;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': isXHR ? 'empty' : 'document',
        'Sec-Fetch-Mode': isXHR ? 'cors' : 'navigate',
        'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
        'Sec-Fetch-User': isXHR ? undefined : '?1',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Not A;Brand";v="99", "Chromium";v="130", "Google Chrome";v="130"',
        'sec-ch-ua-mobile': userAgent.includes('Mobile') ? '?1' : '?0',
        'sec-ch-ua-platform': userAgent.includes('Windows') ? '"Windows"' : userAgent.includes('Macintosh') ? '"macOS"' : '"Linux"',
        'X-Forwarded-For': generateRandomIP(),
        'X-Real-IP': generateRandomIP(),
        'Pragma': 'no-cache',
        'Referer': referer || 'https://www.google.com/',
        'Origin': referer ? new URL(referer).origin : 'https://www.google.com'
    };
};

// Generate Random IP
function generateRandomIP() {
    const ranges = [
        [8, 8, 8, 8], [1, 1, 1, 1], [208, 67, 222, 222],
        [4, 2, 2, 1], [64, 6, 64, 6], [185, 228, 168, 9],
        [172, 217, 0, 0], [142, 250, 0, 0], [104, 16, 0, 0]
    ];
    const range = ranges[Math.floor(Math.random() * ranges.length)];
    return range.map(num => num + Math.floor(Math.random() * 10)).join('.');
}

// Sleep function with minimal jitter
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms + Math.floor(Math.random() * 200)));

// Advanced Social Media Scraping
async function scrapeSocialMediaProfile(url, platform, retries = 2) {
    let browser;
    for (let attempt = 1; attempt <= retries; attempt++) {
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
                    '--disable-gpu',
                    '--window-size=1366,768'
                ],
                executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium'
            });

            const page = await browser.newPage();
            const userAgent = userAgentPool[Math.floor(Math.random() * userAgentPool.length)];
            await page.setUserAgent(userAgent);
            await page.setViewport({ width: 1366, height: 768 });
            await page.setExtraHTTPHeaders(getAdvancedHeaders(url));

            try {
                await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
            } catch (navError) {
                if (attempt === retries) throw new Error(`Navigation failed for ${url}: ${navError.message}`);
                await sleep(500);
                continue;
            }

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
 hensiv                bio: '[data-testid="UserDescription"]',
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
                    telegram: {
                        profilePic: 'img.tgme_page_photo_image',
                        bio: '.tgme_page_description',
                        followers: '.tgme_page_extra',
                        posts: '.tgme_channel_history'
                    },
                    spotify: {
                        profilePic: 'img.profile-image',
                        bio: '.profile-bio',
                        followers: '.follower-count',
                        posts: '.playlist-count'
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
            if (attempt === retries) {
                return {
                    url,
                    error: error.message,
                    scraped_at: new Date().toISOString(),
                    platform
                };
            }
            await sleep(500);
        } finally {
            if (browser) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }
}

// Advanced Bing Search
async function searchBingAdvanced(query, maxPages = 1, retries = 2) {
    const allResults = [];
    const cookieJar = new tough.CookieJar();

    for (let page = 0; page < maxPages; page++) {
        const first = page * 10;
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&count=10&FORM=PERE`;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await axios.get(searchUrl, {
                    headers: getAdvancedHeaders('https://www.bing.com/'),
                    timeout: 10000,
                    maxRedirects: 3,
                    jar: cookieJar,
                    withCredentials: true
                });

                const $ = cheerio.load(response.data);
                const pageResults = [];

                $('.b_algo, .b_ans, .b_top').each((i, element) => {
                    const $el = $(element);
                    const titleEl = $el.find('h2 a, h3 a, .b_topTitle a').first();
                    const title = titleEl.text().trim();
                    const url = titleEl.attr('href');
                    const snippet = $el.find('.b_caption p, .b_snippet, .b_descript').text().trim();
                    const displayUrl = $el.find('cite').text().trim();

                    if (title && url && !url.includes('bing.com/ck/')) {
                        pageResults.push({
                            title,
                            url: url.startsWith('http') ? url : 'https://' + url,
                            snippet,
                            displayUrl,
                            source: 'bing',
                            page: page + 1,
                            position: i + 1
                        });
                    }
                });

                allResults.push(...pageResults);

                if (pageResults.length === 0) break;
                await sleep(300);
                break;

            } catch (error) {
                if (error.response?.status === 429 && attempt < retries) {
                    await sleep(3000 * attempt);
                    continue;
                }
                break;
            }
        }
    }

    return allResults;
}

// Advanced DuckDuckGo Search
async function searchDuckDuckGoAdvanced(query, maxResults = 10, retries = 2) {
    const strategies = [
        { url: 'https://html.duckduckgo.com/html/', method: 'POST' },
        { url: 'https://duckduckgo.com/html/', method: 'GET' },
        { url: 'https://lite.duckduckgo.com/lite/', method: 'GET' }
    ];

    for (const strategy of strategies) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                let response;
                if (strategy.method === 'POST') {
                    response = await axios.post(strategy.url, 
                        `q=${encodeURIComponent(query)}&b=&kl=us-en&df=`,
                        {
                            headers: {
                                ...getAdvancedHeaders('https://duckduckgo.com/'),
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'Origin': 'https://duckduckgo.com'
                            },
                            timeout: 10000
                        }
                    );
                } else {
                    response = await axios.get(strategy.url, {
                        params: { q: query, kl: 'us-en' },
                        headers: getAdvancedHeaders('https://duckduckgo.com/'),
                        timeout: 10000
                    });
                }

                const $ = cheerio.load(response.data);
                const results = [];

                const selectors = [
                    '.result, .web-result',
                    '.results_links',
                    '[data-result-index]',
                    '.result__body'
                ];

                for (const selector of selectors) {
                    $(selector).each((i, element) => {
                        if (results.length >= maxResults) return false;

                        const $el = $(element);
                        const titleEl = $el.find('a[href]:first, .result__title a, .result__a');
                        const title = titleEl.text().trim();
                        const url = titleEl.attr('href');
                        const snippet = $el.find('.result__snippet, .snippet, .result-snippet').text().trim();

                        if (title && url && !url.includes('duckduckgo.com') && !results.find(r => r.url === url)) {
                            results.push({
                                title,
                                url: url.startsWith('//') ? 'https:' + url : url,
                                snippet,
                                source: 'duckduckgo',
                                strategy: strategy.url
                            });
                        }
                    });

                    if (results.length > 0) return results;
                }

                if (results.length > 0) return results;
                await sleep(300);

            } catch (error) {
                if (attempt === retries) continue;
                await sleep(1000 * attempt);
            }
        }
    }

    return [];
}

// Social Media URL Builders
const socialMediaPatterns = {
    tiktok: ['site:tiktok.com "@{username}"', 'tiktok.com/@{username}', '"{username}" tiktok profile'],
    instagram: ['site:instagram.com "{username}"', 'instagram.com/{username}', '"{username}" instagram'],
    twitter: ['site:twitter.com "{username}"', 'twitter.com/{username}', '"{username}" twitter profile'],
    youtube: ['site:youtube.com "{username}"', 'youtube.com/@{username}', '"{username}" youtube channel'],
    telegram: ['site:t.me "{username}"', 't.me/{username}', '"{username}" telegram profile'],
    spotify: ['site:spotify.com/user/{username}', 'spotify.com/user/{username}', '"{username}" spotify profile'],
    facebook: ['site:facebook.com "{username}"', 'facebook.com/{username}', '"{username}" facebook profile']
};

// Advanced Social Media Search
async function searchSocialMediaAdvanced(username, platform, maxResults = 2) {
    if (!username || !platform) {
        throw new Error('Username and platform are required');
    }
    const patterns = socialMediaPatterns[platform] || [];
    const allResults = [];

    for (const pattern of patterns) {
        const query = pattern.replace(/{username}/g, username);

        try {
            const [bingResults, ddgResults] = await Promise.all([
                searchBingAdvanced(query, 1),
                searchDuckDuckGoAdvanced(query, maxResults)
            ]);

            const combinedResults = [...bingResults, ...ddgResults].slice(0, maxResults);

            for (const result of combinedResults) {
                const targetDomain = {
                    tiktok: 'tiktok.com',
                    instagram: 'instagram.com',
                    twitter: 'twitter.com',
                    youtube: 'youtube.com',
                    telegram: 't.me',
                    spotify: 'spotify.com',
                    facebook: 'facebook.com'
                }[platform];

                if (result.url && result.url.includes(targetDomain) && !result.url.includes('duckduckgo.com') && !result.url.includes('bing.com')) {
                    const profileData = await scrapeSocialMediaProfile(result.url, platform);
                    allResults.push({ ...result, ...profileData, platform, query });
                }
            }

            await sleep(300);

        } catch (error) {
            console.error(`Error searching ${platform}: ${error.message}`);
        }
    }

    return allResults.slice(0, maxResults);
}

// Comprehensive Deep Search Function
async function performComprehensiveSearch(username, platforms = [], maxResults = 2) {
    if (!username) {
        throw new Error('Username is required');
    }

    const results = {
        timestamp: new Date().toISOString(),
        username,
        social_media: {},
        total_results: 0
    };

    const selectedPlatforms = platforms.length > 0 ? platforms : Object.keys(socialMediaPatterns);
    for (const platform of selectedPlatforms) {
        if (!socialMediaPatterns[platform]) {
            results.social_media[platform] = { error: 'Unsupported platform' };
            continue;
        }
        try {
            const platformResults = await searchSocialMediaAdvanced(username, platform, maxResults);
            results.social_media[platform] = platformResults;
            results.total_results += platformResults.length;
            await sleep(300);
        } catch (error) {
            results.social_media[platform] = { error: error.message };
        }
    }

    return results;
}

// Routes
app.post('/api/investigate', async (req, res) => {
    const { username, platforms = [], maxResults = 2 } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    try {
        const investigation = await performComprehensiveSearch(username, platforms, maxResults);
        res.json({
            success: true,
            investigation_id: uuidv4(),
            investigation
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Investigation failed', 
            details: error.message 
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '3.4.0-railway',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        supported_platforms: Object.keys(socialMediaPatterns)
    });
});

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './public' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`OSINT Investigation Platform running on port ${PORT}`);
});
