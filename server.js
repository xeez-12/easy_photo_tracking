const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const UserAgent = require('user-agents');
const tough = require('tough-cookie');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Enhanced User Agent Pool
const userAgentPool = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Android 15; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
];

// Advanced Headers Configuration
const getAdvancedHeaders = (referer = null, isXHR = false) => {
    const userAgent = userAgentPool[Math.floor(Math.random() * userAgentPool.length)];
    const headers = {
        'User-Agent': userAgent,
        'Accept': isXHR ? 'application/json, text/plain, */*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8,es;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': isXHR ? 'empty' : 'document',
        'Sec-Fetch-Mode': isXHR ? 'cors' : 'navigate',
        'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
        'Cache-Control': 'no-cache',
        'sec-ch-ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'X-Forwarded-For': generateRandomIP(),
        'Pragma': 'no-cache'
    };
    if (referer) headers['Referer'] = referer;
    if (isXHR) headers['X-Requested-With'] = 'XMLHttpRequest';
    return Object.fromEntries(Object.entries(headers).filter(([_, v]) => v !== undefined));
};

// Generate Random IP
function generateRandomIP() {
    const ranges = [
        [8, 8, 8, 8], [1, 1, 1, 1], [208, 67, 222, 222],
        [4, 2, 2, 1], [64, 6, 64, 6], [185, 228, 168, 9]
    ];
    const range = ranges[Math.floor(Math.random() * ranges.length)];
    return range.map(num => num + Math.floor(Math.random() * 10)).join('.');
}

// Sleep function
const sleep = (ms) => new Promise(resolve => 
    setTimeout(resolve, ms + Math.floor(Math.random() * 500))
);

// Optimized Bing Search
async function searchBingAdvanced(query, maxPages = 3) {
    const allResults = [];
    const cookieJar = new tough.CookieJar();

    for (let page = 0; page < maxPages; page++) {
        const first = page * 10;
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&count=10&FORM=PERE`;

        try {
            const response = await axios.get(searchUrl, {
                headers: getAdvancedHeaders('https://www.bing.com/'),
                timeout: 15000,
                maxRedirects: 5,
                jar: cookieJar,
                withCredentials: true
            });

            const $ = cheerio.load(response.data);
            const pageResults = [];

            $('.b_algo, .b_ans').each((i, element) => {
                const $el = $(element);
                const titleEl = $el.find('h2 a, h3 a').first();
                const title = titleEl.text().trim();
                const url = titleEl.attr('href');
                const snippet = $el.find('.b_caption p, .b_snippet').text().trim();
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
            await sleep(1000);

        } catch (error) {
            if (error.response?.status === 429) {
                await sleep(5000);
                continue;
            }
            break;
        }
    }

    return allResults;
}

// Optimized DuckDuckGo Search
async function searchDuckDuckGoAdvanced(query, maxResults = 30) {
    const strategies = [
        { url: 'https://html.duckduckgo.com/html/', method: 'POST' },
        { url: 'https://duckduckgo.com/html/', method: 'GET' }
    ];

    for (const strategy of strategies) {
        try {
            let response;
            if (strategy.method === 'POST') {
                response = await axios.post(strategy.url, 
                    `q=${encodeURIComponent(query)}&b=&kl=us-en`,
                    {
                        headers: {
                            ...getAdvancedHeaders('https://duckduckgo.com/'),
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Origin': 'https://duckduckgo.com'
                        },
                        timeout: 15000
                    }
                );
            } else {
                response = await axios.get(strategy.url, {
                    params: { q: query, kl: 'us-en' },
                    headers: getAdvancedHeaders('https://duckduckgo.com/'),
                    timeout: 15000
                });
            }

            const $ = cheerio.load(response.data);
            const results = [];

            $('.result, .web-result, .results_links').each((i, element) => {
                if (results.length >= maxResults) return false;
                const $el = $(element);
                const titleEl = $el.find('a[href]:first, .result__title a, .result__a');
                const title = titleEl.text().trim();
                const url = titleEl.attr('href');
                const snippet = $el.find('.result__snippet, .snippet').text().trim();

                if (title && url && !url.includes('duckduckgo.com')) {
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

        } catch (error) {
            continue;
        }
    }

    return [];
}

// Expanded Social Media URL Patterns
const socialMediaPatterns = {
    tiktok: [
        'site:tiktok.com "@{username}"',
        'tiktok.com/@{username}',
        '"{username}" tiktok profile'
    ],
    facebook: [
        'site:facebook.com "{username}"',
        'facebook.com/{username}',
        '"{username}" facebook profile'
    ],
    instagram: [
        'site:instagram.com "{username}"',
        'instagram.com/{username}',
        '"{username}" instagram profile'
    ],
    youtube: [
        'site:youtube.com "@{username}"',
        'youtube.com/@{username}',
        'youtube "{username}" channel'
    ],
    twitter: [
        'site:twitter.com "{username}"',
        'site:x.com "{username}"',
        'x.com/{username}',
        '"{username}" twitter profile'
    ],
    linkedin: [
        'site:linkedin.com/in "{username}"',
        'linkedin.com/in/{username}',
        '"{username}" linkedin profile'
    ],
    github: [
        'site:github.com "{username}"',
        'github.com/{username}',
        '"{username}" github profile'
    ],
    reddit: [
        'site:reddit.com/u "{username}"',
        'reddit.com/u/{username}',
        '"{username}" reddit user'
    ],
    snapchat: [
        'site:snapchat.com/add/{username}',
        'snapchat.com/add/{username}',
        '"{username}" snapchat profile'
    ],
    pinterest: [
        'site:pinterest.com/{username}',
        'pinterest.com/{username}',
        '"{username}" pinterest profile'
    ],
    twitch: [
        'site:twitch.tv/{username}',
        'twitch.tv/{username}',
        '"{username}" twitch channel'
    ]
};

// Social Media Profile Scraping
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

        let profileData = { url, platform, bio: '', followers: 0, posts: 0, profile_picture: '' };

        switch (platform) {
            case 'tiktok':
                profileData = await page.evaluate(() => {
                    return {
                        bio: document.querySelector('h2[data-e2e="user-bio"]')?.textContent.trim() || '',
                        followers: parseInt(document.querySelector('strong[data-e2e="followers-count"]')?.textContent.replace(/[^0-9]/g, '') || '0'),
                        posts: parseInt(document.querySelector('strong[data-e2e="video-count"]')?.textContent.replace(/[^0-9]/g, '') || '0'),
                        profile_picture: document.querySelector('img[data-e2e="user-avatar"]')?.src || ''
                    };
                });
                break;
            case 'instagram':
                profileData = await page.evaluate(() => {
                    return {
                        bio: document.querySelector('meta[name="description"]')?.content.split(' - ')[1] || '',
                        followers: parseInt(document.querySelector('meta[name="description"]')?.content.match(/(\d+\.?\d*[KMB]?) Followers/)?.[1] || '0',
                        posts: parseInt(document.querySelector('meta[name="description"]')?.content.match(/(\d+\.?\d*[KMB]?) Posts/)?.[1] || '0'),
                        profile_picture: document.querySelector('img[alt*="profile picture"]')?.src || ''
                    };
                });
                break;
            case 'twitter':
                profileData = await page.evaluate(() => {
                    return {
                        bio: document.querySelector('div[data-testid="UserDescription"]')?.textContent.trim() || '',
                        followers: parseInt(document.querySelector('a[href*="/followers"] span')?.textContent.replace(/[^0-9]/g, '') || '0'),
                        posts: parseInt(document.querySelector('a[href*="/tweets"] span')?.textContent.replace(/[^0-9]/g, '') || '0'),
                        profile_picture: document.querySelector('img[src*="profile_images"]')?.src || ''
                    };
                });
                break;
            case 'linkedin':
                profileData = await page.evaluate(() => {
                    return {
                        bio: document.querySelector('.pv-top-card--list li')?.textContent.trim() || '',
                        followers: parseInt(document.querySelector('.pv-follows__count')?.textContent.replace(/[^0-9]/g, '') || '0'),
                        posts: 0,
                        profile_picture: document.querySelector('.pv-top-card-profile-picture img')?.src || ''
                    };
                });
                break;
            // Add similar cases for other platforms (github, reddit, snapchat, pinterest, twitch)
        }

        profileData.url = url;
        profileData.platform = platform;

        const screenshot = await page.screenshot({ encoding: 'base64' });
        profileData.screenshot = `data:image/png;base64,${screenshot}`;

        await browser.close();
        return profileData;

    } catch (error) {
        return { url, platform, error: error.message };
    } finally {
        if (browser) await browser.close();
    }
}

// Enhanced Social Media Search
async function searchSocialMediaAdvanced(username, platform) {
    const patterns = socialMediaPatterns[platform] || [`site:${platform}.com "${username}"`];
    const allResults = [];

    for (const pattern of patterns) {
        const query = pattern.replace(/{username}/g, username);
        try {
            const [bingResults, ddgResults] = await Promise.all([
                searchBingAdvanced(query, 2),
                searchDuckDuckGoAdvanced(query, 15)
            ]);

            const results = [...bingResults, ...ddgResults].filter(r => 
                r.url.includes(platform) && !r.url.includes('login')
            );

            for (const result of results) {
                if (allResults.find(r => r.url === result.url)) continue;
                const profileData = await scrapeSocialMediaProfile(result.url, platform);
                allResults.push({
                    ...result,
                    ...profileData,
                    platform,
                    query
                });
                await sleep(1000);
            }

        } catch (error) {
            // Silent error handling
        }
    }

    return allResults;
}

// Comprehensive Deep Search
async function performComprehensiveSearch(username) {
    const results = {
        timestamp: new Date().toISOString(),
        username,
        social_media: {},
        total_results: 0
    };

    const platforms = ['tiktok', 'facebook', 'instagram', 'youtube', 'twitter', 'linkedin', 'github', 'reddit', 'snapchat', 'pinterest', 'twitch'];
    for (const platform of platforms) {
        try {
            const platformResults = await searchSocialMediaAdvanced(username, platform);
            results.social_media[platform] = platformResults;
            results.total_results += platformResults.length;
            await sleep(1000);
        } catch (error) {
            results.social_media[platform] = [];
        }
    }

    results.extracted_contacts = extractAdvancedContactInfo(
        JSON.stringify(results.social_media)
    );
    results.total_results = Object.values(results.social_media).reduce((sum, arr) => sum + arr.length, 0);

    console.log(`Deep search complete for ${username}. Total results: ${results.total_results}`);
    return results;
}

// Advanced Contact Info Extraction
function extractAdvancedContactInfo(text) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    const usernameRegex = /@([a-zA-Z0-9_]+)/g;
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;

    return {
        emails: [...new Set(text.match(emailRegex) || [])],
        phones: [...new Set(text.match(phoneRegex) || [])],
        usernames: [...new Set(text.match(usernameRegex) || [])],
        urls: [...new Set(text.match(urlRegex) || [])]
    };
}

// Routes
app.post('/api/investigate', async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    try {
        const investigation = await performComprehensiveSearch(username);
        res.json({
            success: true,
            investigation_id: uuidv4(),
            investigation
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Deep search failed', 
            details: error.message 
        });
    }
});

app.post('/api/search/:platform', async (req, res) => {
    const { platform } = req.params;
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    try {
        const results = await searchSocialMediaAdvanced(username, platform);
        res.json({
            success: true,
            platform,
            username,
            count: results.length,
            results
        });
    } catch (error) {
        res.status(500).json({ 
            error: `${platform} search failed`, 
            details: error.message 
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '3.3.0-railway',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        features: [
            'Deep Social Media Search',
            'Profile Data Extraction',
            'Optimized Search Engines',
            'Card-based UI Results',
            'Rate Limiting & Evasion',
            'Browser Fingerprinting'
        ],
        supported_platforms: Object.keys(socialMediaPatterns)
    });
});

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './public' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`OSINT Social Media Platform running on port ${PORT}`);
});

