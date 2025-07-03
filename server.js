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

// Expanded User Agent Pool
const userAgentPool = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/127.0.2651.74 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Android 13; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0',
    'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Android 15; Mobile; rv:129.0) Gecko/129.0 Firefox/129.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/128.0.2739.42 Safari/537.36'
];

// Perfected Headers Configuration
const getAdvancedHeaders = (referer = null, isXHR = false) => {
    const userAgent = userAgentPool[Math.floor(Math.random() * userAgentPool.length)];
    const headers = {
        'User-Agent': userAgent,
        'Accept': isXHR ? 'application/json, text/plain, */*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8,fr;q=0.7,id;q=0.6',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': isXHR ? 'empty' : 'document',
        'Sec-Fetch-Mode': isXHR ? 'cors' : 'navigate',
        'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
        'Sec-Fetch-User': isXHR ? undefined : '?1',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': `"Not_A Brand";v="8", "Chromium";v="${Math.floor(Math.random() * 10) + 120}", "Google Chrome";v="${Math.floor(Math.random() * 10) + 120}"`,
        'sec-ch-ua-mobile': userAgent.includes('Mobile') ? '?1' : '?0',
        'sec-ch-ua-platform': userAgent.includes('Windows') ? '"Windows"' : userAgent.includes('Macintosh') ? '"macOS"' : userAgent.includes('Linux') ? '"Linux"' : '"Android"',
        'sec-ch-ua-platform-version': userAgent.includes('Windows') ? `"${Math.floor(Math.random() * 2) + 10}.0.0"` : '"14.0.0"',
        'sec-ch-ua-full-version': `"${Math.floor(Math.random() * 10) + 120}.0.${Math.floor(Math.random() * 1000)}.0"`,
        'X-Forwarded-For': generateRandomIP(),
        'X-Real-IP': generateRandomIP(),
        'Pragma': 'no-cache',
        'Referer': referer || undefined,
        'Origin': referer ? new URL(referer).origin : undefined
    };
    if (isXHR) headers['X-Requested-With'] = 'XMLHttpRequest';
    return Object.fromEntries(Object.entries(headers).filter(([_, v]) => v !== undefined));
};

// Generate Random IP
function generateRandomIP() {
    const ranges = [
        [8, 8, 8, 8], [1, 1, 1, 1], [208, 67, 222, 222], [4, 2, 2, 1],
        [64, 6, 64, 6], [185, 228, 168, 9], [172, 217, 0, 0], [104, 16, 0, 0],
        [198, 51, 100, 0], [203, 0, 113, 0]
    ];
    const range = ranges[Math.floor(Math.random() * ranges.length)];
    return range.map(num => num + Math.floor(Math.random() * 50)).join('.');
}

// Sleep function
const sleep = (ms) => new Promise(resolve => 
    setTimeout(resolve, ms + Math.floor(Math.random() * 1000))
);

// Advanced Bing Search
async function searchBingAdvanced(query, maxPages = 5, retries = 3) {
    const allResults = [];
    const cookieJar = new tough.CookieJar();

    for (let attempt = 0; attempt < retries; attempt++) {
        for (let page = 0; page < maxPages; page++) {
            const first = page * 10;
            const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&count=10&FORM=PERE`;

            try {
                const response = await axios.get(searchUrl, {
                    headers: getAdvancedHeaders('https://www.bing.com/'),
                    timeout: 20000,
                    maxRedirects: 5,
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

                $('.b_rs li a, .b_pag a').each((i, element) => {
                    const relatedQuery = $(element).text().trim();
                    if (relatedQuery && relatedQuery !== query) {
                        pageResults.push({
                            type: 'related_search',
                            query: relatedQuery,
                            source: 'bing',
                            page: page + 1
                        });
                    }
                });

                allResults.push(...pageResults);

                if (pageResults.length === 0) break;
                await sleep(2000 + Math.random() * 2000);

            } catch (error) {
                if (error.response?.status === 429 || error.response?.status === 403) {
                    await sleep(10000 * (attempt + 1));
                    continue;
                }
                break;
            }
        }
        if (allResults.length > 0) break;
    }

    return allResults;
}

// Enhanced DuckDuckGo Search
async function searchDuckDuckGoAdvanced(query, maxResults = 50, retries = 3) {
    const strategies = [
        { url: 'https://html.duckduckgo.com/html/', method: 'POST' },
        { url: 'https://duckduckgo.com/html/', method: 'GET' },
        { url: 'https://lite.duckduckgo.com/lite/', method: 'GET' }
    ];

    for (let attempt = 0; attempt < retries; attempt++) {
        for (const strategy of strategies) {
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
                            timeout: 20000
                        }
                    );
                } else {
                    response = await axios.get(strategy.url, {
                        params: { q: query, kl: 'us-en' },
                        headers: getAdvancedHeaders('https://duckduckgo.com/'),
                        timeout: 20000
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

                    if (results.length > 0) break;
                }

                if (results.length > 0) return results;

            } catch (error) {
                if (error.response?.status === 429 || error.response?.status === 403) {
                    await sleep(10000 * (attempt + 1));
                    continue;
                }
            }
        }
    }

    return [];
}

// Social Media URL Builders
const socialMediaPatterns = {
    tiktok: [
        'site:tiktok.com "@{username}"',
        'site:tiktok.com/{username}',
        'tiktok.com/@{username}',
        '"{username}" tiktok',
        'tiktok "{username}" profile'
    ],
    facebook: [
        'site:facebook.com "{username}"',
        'facebook.com/{username}',
        'site:fb.com "{username}"',
        '"{username}" facebook profile',
        'facebook "{username}" page'
    ],
    instagram: [
        'site:instagram.com "{username}"',
        'instagram.com/{username}',
        'site:instagr.am "{username}"',
        '"{username}" instagram',
        'instagram profile "{username}"'
    ],
    youtube: [
        'site:youtube.com "{username}"',
        'youtube.com/@{username}',
        'youtube.com/c/{username}',
        'youtube.com/user/{username}',
        'youtube "{username}" channel'
    ],
    twitter: [
        'site:twitter.com "{username}"',
        'site:x.com "{username}"',
        'twitter.com/{username}',
        'x.com/{username}',
        '"{username}" twitter profile'
    ],
    linkedin: [
        'site:linkedin.com/in "{username}"',
        'linkedin.com/in/{username}',
        'site:linkedin.com "{username}"',
        '"{username}" linkedin profile'
    ],
    github: [
        'site:github.com "{username}"',
        'github.com/{username}',
        '"{username}" github profile'
    ],
    reddit: [
        'site:reddit.com/u "{username}"',
        'site:reddit.com/user/{username}',
        'reddit.com/u/{username}',
        '"{username}" reddit user'
    ]
};

// Phone Number Search Patterns
const phoneNumberPatterns = {
    tiktok: ['"{phoneNumber}" tiktok', 'site:tiktok.com phone "{phoneNumber}"'],
    facebook: ['"{phoneNumber}" facebook', 'site:facebook.com phone "{phoneNumber}"'],
    instagram: ['"{phoneNumber}" instagram', 'site:instagram.com phone "{phoneNumber}"'],
    youtube: ['"{phoneNumber}" youtube', 'site:youtube.com phone "{phoneNumber}"'],
    twitter: ['"{phoneNumber}" twitter', 'site:twitter.com phone "{phoneNumber}"', 'site:x.com phone "{phoneNumber}"'],
    linkedin: ['"{phoneNumber}" linkedin', 'site:linkedin.com phone "{phoneNumber}"'],
    github: ['"{phoneNumber}" github', 'site:github.com phone "{phoneNumber}"'],
    reddit: ['"{phoneNumber}" reddit', 'site:reddit.com phone "{phoneNumber}"']
};

// Advanced Social Media Scraping
async function scrapeSocialMediaProfile(url, platform, retries = 3) {
    let browser;
    for (let attempt = 0; attempt < retries; attempt++) {
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
            await page.setExtraHTTPHeaders(getAdvancedHeaders(url));

            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            } catch (gotoError) {
                if (gotoError.message.includes('blocked') || gotoError.message.includes('timeout')) {
                    await browser.close();
                    await sleep(10000 * (attempt + 1));
                    continue;
                }
                throw gotoError;
            }

            const profileData = await page.evaluate((platform) => {
                const getText = (selector) => document.querySelector(selector)?.textContent?.trim() || '';
                const getImage = (selector) => document.querySelector(selector)?.src || '';

                const platformSelectors = {
                    tiktok: {
                        profilePic: 'img[data-testid="user-avatar"], img[alt*="profile"]',
                        bio: '[data-testid="user-bio"], .user-bio',
                        followers: '[data-testid="user-followers"] strong, .follower-count',
                        posts: '[data-testid="user-videos"] strong, .video-count'
                    },
                    instagram: {
                        profilePic: 'img[alt*="profile picture"], img.x1y9k2m',
                        bio: '._aa_y div div span, .bio-text',
                        followers: 'a[href*="/followers/"] span, .follower-count',
                        posts: 'span._ac2a, .post-count'
                    },
                    twitter: {
                        profilePic: 'img[alt="Profile picture"], img[alt*="avatar"]',
                        bio: '[data-testid="UserDescription"], .user-bio',
                        followers: '[data-testid="followers"] span, .follower-count',
                        posts: '[data-testid="tweet"], .tweet-count'
                    },
                    facebook: {
                        profilePic: 'img.x1y9k2m, img[alt*="profile"]',
                        bio: 'div.x1heor9g div.x1iorvi4 span, .about-section',
                        followers: 'span.x1e558r4, .follower-count',
                        posts: 'div.x1n2onr6 div.x1yztbdb, .post-count'
                    },
                    youtube: {
                        profilePic: 'img#img, img[alt*="channel"]',
                        bio: '#description.ytd-channel-about-metadata-renderer, .channel-description',
                        followers: '#subscriber-count, .subscriber-count',
                        posts: 'ytd-grid-video-renderer, .video-count'
                    },
                    linkedin: {
                        profilePic: 'img.pv-top-card--photo, img[alt*="profile"]',
                        bio: '.pv-about-section .pv-about__summary-text, .about-text',
                        followers: '.follower-count, .connection-count',
                        posts: '.share-box-feed-entry, .post-count'
                    },
                    github: {
                        profilePic: 'img.avatar-user, img[alt*="avatar"]',
                        bio: '.p-bio, .user-bio',
                        followers: 'a[href*="/followers"] .text-bold, .follower-count',
                        posts: '.js-repos-container, .repo-count'
                    },
                    reddit: {
                        profilePic: 'img[alt="User avatar"], img[alt*="profile"]',
                        bio: '.profile-bio, .user-bio',
                        followers: '.profile-followers, .follower-count',
                        posts: '.Post, .post-count'
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
            if (browser) await browser.close();
            if (attempt < retries - 1) {
                await sleep(10000 * (attempt + 1));
                continue;
            }
            return { url, error: error.message, scraped_at: new Date().toISOString(), platform };
        }
    }
    return { url, error: 'All retries failed', scraped_at: new Date().toISOString(), platform };
}

// Advanced Social Media Search
async function searchSocialMediaAdvanced(username, platform, maxRetries = 3) {
    const patterns = socialMediaPatterns[platform] || [`site:${platform}.com "${username}"`];
    const allResults = [];

    for (const pattern of patterns) {
        const query = pattern.replace(/{username}/g, username);

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const [bingResults, ddgResults] = await Promise.all([
                    searchBingAdvanced(query, 2),
                    searchDuckDuckGoAdvanced(query, 20)
                ]);

                const combinedResults = [...bingResults, ...ddgResults].filter(result => 
                    result.url && !result.url.includes('duckduckgo.com') && !result.url.includes('bing.com')
                );

                for (const result of combinedResults) {
                    const profileData = await scrapeSocialMediaProfile(result.url, platform);
                    allResults.push({ ...result, ...profileData, platform, query });
                }

                await sleep(1500);
                break;

            } catch (error) {
                if (error.response?.status === 429 || error.response?.status === 403) {
                    await sleep(10000 * (attempt + 1));
                    continue;
                }
                console.error(`Error in social media search for ${platform}: ${error.message}`);
            }
        }
    }

    const uniqueResults = allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.url === result.url)
    );

    return uniqueResults;
}

// Advanced Phone Number Search
async function searchPhoneNumberAdvanced(phoneNumber, maxRetries = 3) {
    const allResults = [];
    const platforms = ['tiktok', 'facebook', 'instagram', 'youtube', 'twitter', 'linkedin', 'github', 'reddit'];

    for (const platform of platforms) {
        const patterns = phoneNumberPatterns[platform] || [`"${phoneNumber}" ${platform}`];
        for (const pattern of patterns) {
            const query = pattern.replace(/{phoneNumber}/g, phoneNumber);

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    const [bingResults, ddgResults] = await Promise.all([
                        searchBingAdvanced(query, 2),
                        searchDuckDuckGoAdvanced(query, 20)
                    ]);

                    const combinedResults = [...bingResults, ...ddgResults].filter(result => 
                        result.url && !result.url.includes('duckduckgo.com') && !result.url.includes('bing.com')
                    );

                    for (const result of combinedResults) {
                        const profileData = await scrapeSocialMediaProfile(result.url, platform);
                        allResults.push({ ...result, ...profileData, platform, query });
                    }

                    await sleep(1500);
                    break;

                } catch (error) {
                    if (error.response?.status === 429 || error.response?.status === 403) {
                        await sleep(10000 * (attempt + 1));
                        continue;
                    }
                    console.error(`Error in phone number search for ${platform}: ${error.message}`);
                }
            }
        }
    }

    const uniqueResults = allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.url === result.url)
    );

    return uniqueResults;
}

// Comprehensive Deep Search Function
async function performComprehensiveSearch(username) {
    const results = {
        timestamp: new Date().toISOString(),
        username,
        social_media: {},
        general_search: [],
        email_search: [],
        phone_search: [],
        leaked_data: [],
        professional_info: [],
        total_results: 0
    };

    const platforms = ['tiktok', 'facebook', 'instagram', 'youtube', 'twitter', 'linkedin', 'github', 'reddit'];
    for (const platform of platforms) {
        try {
            const platformResults = await searchSocialMediaAdvanced(username, platform);
            results.social_media[platform] = platformResults;
            results.total_results += platformResults.length;
            await sleep(2000);
        } catch (error) {
            results.social_media[platform] = [];
        }
    }

    const generalQueries = [
        `"${username}" profile`,
        `"${username}" account`,
        `"${username}" user`,
        `${username} contact information`,
        `${username} email address`,
        `${username} phone number`
    ];

    for (const query of generalQueries) {
        try {
            const [bingResults, ddgResults] = await Promise.all([
                searchBingAdvanced(query, 2),
                searchDuckDuckGoAdvanced(query, 15)
            ]);

            results.general_search.push(...bingResults, ...ddgResults);
            await sleep(1500);
        } catch (error) {
            // Silent error handling
        }
    }

    const emailPatterns = [
        `"${username}@gmail.com"`,
        `"${username}@yahoo.com"`,
        `"${username}@hotmail.com"`,
        `"${username}@outlook.com"`,
        `"${username}@protonmail.com"`
    ];

    for (const emailQuery of emailPatterns) {
        try {
            const emailResults = await searchBingAdvanced(emailQuery, 1);
            results.email_search.push(...emailResults);
            await sleep(1000);
        } catch (error) {
            // Silent error handling
        }
    }

    const breachQueries = [
        `"${username}" site:haveibeenpwned.com`,
        `"${username}" data breach`,
        `"${username}" leaked database`,
        `"${username}" site:dehashed.com`
    ];

    for (const breachQuery of breachQueries) {
        try {
            const breachResults = await searchDuckDuckGoAdvanced(breachQuery, 10);
            results.leaked_data.push(...breachResults);
            await sleep(1500);
        } catch (error) {
            // Silent error handling
        }
    }

    const professionalQueries = [
        `"${username}" CV resume`,
        `"${username}" work experience`,
        `"${username}" company employee`,
        `"${username}" job title position`
    ];

    for (const profQuery of professionalQueries) {
        try {
            const profResults = await searchBingAdvanced(profQuery, 1);
            results.professional_info.push(...profResults);
            await sleep(1500);
        } catch (error) {
            // Silent error handling
        }
    }

    let allText = '';
    Object.values(results).forEach(section => {
        if (Array.isArray(section)) {
            section.forEach(item => {
                if (item.title) allText += ` ${item.title}`;
                if (item.snippet) allText += ` ${item.snippet}`;
                if (item.bio) allText += ` ${item.bio}`;
            });
        } else if (typeof section === 'object' && section !== null) {
            Object.values(section).forEach(items => {
                if (Array.isArray(items)) {
                    items.forEach(item => {
                        if (item.title) allText += ` ${item.title}`;
                        if (item.snippet) allText += ` ${item.snippet}`;
                        if (item.bio) allText += ` ${item.bio}`;
                    });
                }
            });
        }
    });

    results.extracted_contacts = extractAdvancedContactInfo(allText);
    results.total_results = Object.values(results.social_media).reduce((sum, arr) => sum + arr.length, 0) +
                           results.general_search.length +
                           results.email_search.length +
                           results.leaked_data.length +
                           results.professional_info.length;

    console.log(`Investigation complete for ${username}. Total results: ${results.total_results}`);
    return results;
}

// Advanced Contact Info Extraction
function extractAdvancedContactInfo(text) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    const usernameRegex = /@([a-zA-Z0-9_]+)/g;
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    const socialRegex = /(facebook|twitter|instagram|linkedin|tiktok|youtube)\.com\/[\w.-]+/gi;

    return {
        emails: [...new Set(text.match(emailRegex) || [])],
        phones: [...new Set(text.match(phoneRegex) || [])],
        usernames: [...new Set(text.match(usernameRegex) || [])],
        urls: [...new Set(text.match(urlRegex) || [])],
        social_profiles: [...new Set(text.match(socialRegex) || [])]
    };
}

// Enhanced Website Capture
async function captureAdvancedInfo(url) {
    let browser;
    try {
        const axiosResponse = await axios.get(url, {
            headers: getAdvancedHeaders(),
            timeout: 15000,
            maxRedirects: 5
        });

        const $ = cheerio.load(axiosResponse.data);
        const basicInfo = {
            url,
            title: $('title').text().trim(),
            description: $('meta[name="description"]').attr('content') || '',
            keywords: $('meta[name="keywords"]').attr('content') || '',
            ogTitle: $('meta[property="og:title"]').attr('content') || '',
            ogDescription: $('meta[property="og:description"]').attr('content') || '',
            ogImage: $('meta[property="og:image"]').attr('content') || '',
            twitterCard: $('meta[name="twitter:card"]').attr('content') || '',
            canonical: $('link[rel="canonical"]').attr('href') || '',
            robots: $('meta[name="robots"]').attr('content') || '',
            headers: axiosResponse.headers,
            status: axiosResponse.status
        };

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
            await page.setExtraHTTPHeaders(getAdvancedHeaders(url));

            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            const screenshot = await page.screenshot({ 
                encoding: 'base64',
                fullPage: false,
                clip: { x: 0, y: 0, width: 1366, height: 768 }
            });

            const advancedInfo = await page.evaluate(() => {
                return {
                    finalUrl: window.location.href,
                    pageText: document.body.innerText.substring(0, 2000),
                    forms: Array.from(document.forms).map(form => ({
                        action: form.action,
                        method: form.method,
                        inputs: Array.from(form.elements).map(el => ({
                            type: el.type,
                            name: el.name,
                            id: el.id
                        }))
                    })),
                    links: Array.from(document.links).slice(0, 50).map(link => ({
                        href: link.href,
                        text: link.textContent.trim()
                    })),
                    scripts: Array.from(document.scripts).map(script => script.src).filter(Boolean),
                    technologies: {
                        hasJquery: typeof window.jQuery !== 'undefined',
                        hasReact: typeof window.React !== 'undefined',
                        hasAngular: typeof window.angular !== 'undefined',
                        hasVue: typeof window.Vue !== 'undefined'
                    }
                };
            });

            await browser.close();

            return {
                ...basicInfo,
                ...advancedInfo,
                screenshot: `data:image/png;base64,${screenshot}`,
                captured_at: new Date().toISOString(),
                capture_method: 'advanced'
            };

        } catch (puppeteerError) {
            return {
                ...basicInfo,
                captured_at: new Date().toISOString(),
                capture_method: 'basic'
            };
        }

    } catch (error) {
        return {
            url,
            error: error.message,
            captured_at: new Date().toISOString(),
            capture_method: 'failed'
        };
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
    }
}

// Routes
app.post('/api/investigate', async (req, res) => {
    const { username, deep = true } = req.body;

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
            error: 'Investigation failed', 
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

app.post('/api/phone-search', async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
        const results = await searchPhoneNumberAdvanced(phoneNumber);
        res.json({
            success: true,
            phoneNumber,
            count: results.length,
            results
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Phone number search failed', 
            details: error.message 
        });
    }
});

app.post('/api/advanced-search', async (req, res) => {
    const { query, maxResults = 50, sources = ['bing', 'duckduckgo'] } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        const results = [];

        if (sources.includes('bing')) {
            const bingResults = await searchBingAdvanced(query, 3);
            results.push(...bingResults);
        }

        if (sources.includes('duckduckgo')) {
            const ddgResults = await searchDuckDuckGoAdvanced(query, maxResults);
            results.push(...ddgResults);
        }

        res.json({
            success: true,
            query,
            sources_used: sources,
            total: results.length,
            results
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Advanced search failed', 
            details: error.message 
        });
    }
});

app.post('/api/capture', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const capture = await captureAdvancedInfo(url);
        res.json({
            success: true,
            capture
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Capture failed', 
            details: error.message 
        });
    }
});

app.post('/api/batch-investigate', async (req, res) => {
    const { usernames, reportProgress = false } = req.body;

    if (!usernames || !Array.isArray(usernames)) {
        return res.status(400).json({ error: 'Usernames array is required' });
    }

    try {
        const investigations = [];
        const total = usernames.length;

        for (let i = 0; i < usernames.length; i++) {
            const username = usernames[i];
            const investigation = await performComprehensiveSearch(username);
            investigations.push(investigation);
            await sleep(5000);
        }

        res.json({
            success: true,
            batch_id: uuidv4(),
            total_investigated: investigations.length,
            summary: {
                total_results: investigations.reduce((sum, inv) => sum + inv.total_results, 0),
                avg_results_per_user: Math.round(investigations.reduce((sum, inv) => sum + inv.total_results, 0) / investigations.length)
            },
            investigations
        });

    } catch (error) {
        res.status(500).json({ 
            error: 'Batch investigation failed', 
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
        features: [
            'Advanced Multi-Engine Search',
            'Deep Social Media Investigation',
            'Phone Number Search',
            'Comprehensive OSINT Framework',
            'Enhanced Web Capture',
            'Contact Extraction',
            'Data Breach Investigation',
            'Professional Information Mining',
            'Batch Processing',
            'Rate Limiting & Evasion',
            'Browser Fingerprinting',
            'Social Media Metadata Extraction'
        ],
        supported_platforms: Object.keys(socialMediaPatterns)
    });
});

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './public' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`OSINT Investigation Platform running on port ${PORT}`);
});
