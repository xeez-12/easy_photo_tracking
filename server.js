const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const tough = require('tough-cookie');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Enhanced User Agent Pool with mobile and desktop agents
const userAgentPool = [
    // Mobile
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    
    // Desktop
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/112.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13.3; rv:109.0) Gecko/20100101 Firefox/112.0',
    
    // Specialized
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/112.0'
];

// Enhanced Headers Configuration with rotating IPs
const getAdvancedHeaders = (referer = null, isXHR = false) => {
    const userAgent = userAgentPool[Math.floor(Math.random() * userAgentPool.length)];
    return {
        'User-Agent': userAgent,
        'Accept': isXHR ? 'application/json, text/plain, */*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': isXHR ? 'empty' : 'document',
        'Sec-Fetch-Mode': isXHR ? 'cors' : 'navigate',
        'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
        'Sec-Fetch-User': isXHR ? undefined : '?1',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
        'sec-ch-ua-mobile': userAgent.includes('Mobile') ? '?1' : '?0',
        'sec-ch-ua-platform': userAgent.includes('Windows') ? '"Windows"' : 
                             userAgent.includes('Mac') ? '"macOS"' : 
                             userAgent.includes('Linux') ? '"Linux"' : 
                             userAgent.includes('iPhone') ? '"iOS"' : 
                             userAgent.includes('Android') ? '"Android"' : '"Unknown"',
        'X-Forwarded-For': generateRandomIP(),
        'X-Real-IP': generateRandomIP(),
        'Pragma': 'no-cache',
        'Referer': referer || 'https://www.google.com/',
        'Origin': referer ? new URL(referer).origin : 'https://www.google.com'
    };
};

// Generate random IP from common ranges
function generateRandomIP() {
    const ranges = [
        [104, 16, 0, 0], // Cloudflare
        [172, 64, 0, 0], // Cloudflare
        [108, 162, 0, 0], // Cloudflare
        [141, 101, 0, 0], // Cloudflare
        [8, 8, 8, 8], // Google DNS
        [1, 1, 1, 1], // Cloudflare DNS
        [208, 67, 222, 222], // OpenDNS
        [64, 6, 64, 6], // Verisign
        [185, 228, 168, 9] // CleanBrowsing
    ];
    const range = ranges[Math.floor(Math.random() * ranges.length)];
    return `${range[0]}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

// Sleep function with random jitter
const sleep = (ms) => new Promise(resolve => 
    setTimeout(resolve, ms + Math.floor(Math.random() * 2000))
);

// Enhanced Social Media Scraping with better selectors
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
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--blink-settings=imagesEnabled=true'
            ],
            executablePath: process.env.CHROMIUM_PATH || puppeteer.executablePath(),
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        await page.setUserAgent(userAgentPool[Math.floor(Math.random() * userAgentPool.length)]);
        await page.setViewport({ width: 1366, height: 768 });
        await page.setJavaScriptEnabled(true);
        await page.setRequestInterception(true);

        // Block unnecessary resources to speed up loading
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto(url, { 
            waitUntil: 'networkidle2', 
            timeout: 30000,
            referer: 'https://www.google.com/'
        });

        // Wait for potential dynamic content
        await page.waitForTimeout(3000);

        const profileData = await page.evaluate((platform) => {
            const getText = (selector) => {
                const el = document.querySelector(selector);
                return el ? el.textContent.trim() : '';
            };

            const getImage = (selector) => {
                const el = document.querySelector(selector);
                return el ? (el.src || el.getAttribute('data-src') || '') : '';
            };

            const getAttribute = (selector, attr) => {
                const el = document.querySelector(selector);
                return el ? el.getAttribute(attr) : '';
            };

            const platformSelectors = {
                tiktok: {
                    profilePic: 'img[data-e2e="user-avatar"], img[alt*="profile photo"]',
                    bio: '[data-e2e="user-bio"], .tiktok-1qb12g8-DivShareDesc',
                    followers: '[data-e2e="followers-count"], strong[title*="Followers"]',
                    following: '[data-e2e="following-count"], strong[title*="Following"]',
                    posts: '[data-e2e="video-count"], strong[title*="Posts"]',
                    verified: 'svg[data-e2e="verified-icon"]',
                    username: 'h1[data-e2e="user-title"], .tiktok-1qb12g8-DivShareTitle'
                },
                instagram: {
                    profilePic: 'img[alt*="profile picture"], img[alt*="Profile picture"]',
                    bio: '.-vDIg span, .x7a106z',
                    followers: 'a[href*="/followers/"] span, a[href*="/followers/"] span span',
                    following: 'a[href*="/following/"] span, a[href*="/following/"] span span',
                    posts: 'span._ac2a, span.html-span',
                    verified: 'svg[aria-label="Verified"]',
                    username: 'h1._aacl, h1._aad0, h2._aacl'
                },
                twitter: {
                    profilePic: 'img[alt="Profile image"], img[alt="Profile photo"]',
                    bio: '[data-testid="UserDescription"]',
                    followers: '[href$="/followers"] span span',
                    following: '[href$="/following"] span span',
                    posts: '[href$="/media"] span span, [href$="/posts"] span span',
                    verified: '[data-testid="icon-verified"]',
                    username: '[data-testid="UserName"] div:nth-of-type(2) span'
                },
                facebook: {
                    profilePic: 'img[alt*="profile picture"], img[alt*="Profile picture"]',
                    bio: 'div[data-visualcompletion="ignore"] div div span',
                    followers: 'a[href*="/friends"] span',
                    following: 'a[href*="/following"] span',
                    posts: 'a[href*="/posts"] span',
                    verified: 'img[alt*="Verified"]',
                    username: 'h1 span'
                },
                youtube: {
                    profilePic: 'img#img, yt-img-shadow img',
                    bio: '#description.ytd-channel-about-metadata-renderer',
                    subscribers: '#subscriber-count',
                    videos: '#videos-count',
                    verified: 'ytd-badge-supported-renderer[aria-label="Verified"]',
                    username: 'yt-formatted-string.ytd-channel-name'
                },
                linkedin: {
                    profilePic: 'img.pv-top-card-profile-picture__image, img.profile-photo-edit__preview',
                    bio: '.pv-about-section .pv-about__summary-text',
                    connections: '.pv-top-card--list-bullet span',
                    posts: '.profile-creator-shared-feed-update__commentary',
                    verified: 'li-icon[type="verified"]',
                    username: 'h1.text-heading-xlarge'
                },
                github: {
                    profilePic: 'img.avatar-user',
                    bio: '.p-note.user-profile-bio',
                    followers: 'a[href$="?tab=followers"] span',
                    following: 'a[href$="?tab=following"] span',
                    repos: 'a[href$="?tab=repositories"] span',
                    username: 'span.p-nickname.vcard-username'
                },
                reddit: {
                    profilePic: 'img[alt*="User avatar"], img[alt*="Profile image"]',
                    bio: '.profile-bio',
                    karma: '.profile-karma',
                    posts: '.Post',
                    username: 'h1._2yYPPW47QxD4lFQTKpfpLQ'
                }
            };

            const selectors = platformSelectors[platform] || {};
            const result = {
                profilePic: getImage(selectors.profilePic),
                bio: getText(selectors.bio),
                followers: getText(selectors.followers),
                following: getText(selectors.following),
                postCount: getText(selectors.posts) || document.querySelectorAll(selectors.posts).length,
                verified: !!document.querySelector(selectors.verified),
                name: getText(selectors.username),
                title: getText(selectors.username) || getText('h1') || getText('title')
            };

            // Special handling for YouTube subscribers
            if (platform === 'youtube' && result.followers.includes('subscribers')) {
                result.followers = result.followers.replace('subscribers', '').trim();
            }

            return result;
        }, platform);

        // Take screenshot of the profile section
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
        console.error(`Error scraping ${platform} profile:`, error);
        return { 
            url, 
            error: error.message, 
            scraped_at: new Date().toISOString(), 
            platform 
        };
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) {
                console.error('Error closing browser:', e);
            }
        }
    }
}

// Enhanced Bing Search with better result parsing
async function searchBingAdvanced(query, maxPages = 5) {
    const allResults = [];
    const cookieJar = new tough.CookieJar();

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

            // Handle different Bing result types
            $('.b_algo, .b_ans, .b_top').each((i, element) => {
                const $el = $(element);
                
                // Extract title and URL
                const titleEl = $el.find('h2 a, h3 a, .b_topTitle a').first();
                const title = titleEl.text().trim();
                let url = titleEl.attr('href');
                
                // Handle Bing redirects
                if (url && url.startsWith('https://www.bing.com/ck/')) {
                    const realUrl = $el.find('a[href^="http"]').attr('href');
                    if (realUrl) url = realUrl;
                }
                
                // Extract snippet and display URL
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
            await sleep(2000 + Math.random() * 3000);

        } catch (error) {
            if (error.response?.status === 429) {
                await sleep(10000);
                continue;
            }
            break;
        }
    }

    return allResults;
}

// Enhanced DuckDuckGo Search with multiple strategies
async function searchDuckDuckGoAdvanced(query, maxResults = 50) {
    const strategies = [
        { url: 'https://html.duckduckgo.com/html/', method: 'POST' },
        { url: 'https://duckduckgo.com/html/', method: 'GET' },
        { url: 'https://lite.duckduckgo.com/lite/', method: 'GET' }
    ];

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

            // Try different selectors for different DDG versions
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
                    let url = titleEl.attr('href');
                    
                    // Handle DDG redirects
                    if (url && url.startsWith('/')) {
                        url = `https://duckduckgo.com${url}`;
                    } else if (url && url.startsWith('//')) {
                        url = `https:${url}`;
                    }
                    
                    const snippet = $el.find('.result__snippet, .snippet, .result-snippet').text().trim();

                    if (title && url && !url.includes('duckduckgo.com') && !results.find(r => r.url === url)) {
                        results.push({
                            title,
                            url,
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
            console.error(`DuckDuckGo search failed with strategy ${strategy.url}:`, error);
            continue;
        }
    }

    return [];
}

// Enhanced Social Media URL Patterns
const socialMediaPatterns = {
    tiktok: [
        'site:tiktok.com "@{username}"',
        'tiktok.com/@{username}',
        '"{username}" tiktok profile',
        '"{username}" tiktok account'
    ],
    facebook: [
        'site:facebook.com "{username}"',
        'facebook.com/{username}',
        '"{username}" facebook profile',
        '"{username}" facebook account'
    ],
    instagram: [
        'site:instagram.com "{username}"',
        'instagram.com/{username}',
        '"{username}" instagram',
        '"{username}" instagram profile'
    ],
    youtube: [
        'site:youtube.com "{username}"',
        'youtube.com/@{username}',
        '"{username}" youtube channel',
        '"{username}" youtube account'
    ],
    twitter: [
        'site:twitter.com "{username}"',
        'twitter.com/{username}',
        '"{username}" twitter profile',
        '"{username}" twitter account'
    ],
    linkedin: [
        'site:linkedin.com/in "{username}"',
        'linkedin.com/in/{username}',
        '"{username}" linkedin profile',
        '"{username}" linkedin account'
    ],
    github: [
        'site:github.com "{username}"',
        'github.com/{username}',
        '"{username}" github profile',
        '"{username}" github account'
    ],
    reddit: [
        'site:reddit.com/u "{username}"',
        'reddit.com/u/{username}',
        '"{username}" reddit user',
        '"{username}" reddit profile'
    ]
};

// Enhanced Social Media Search with better error handling
async function searchSocialMediaAdvanced(username, platform) {
    const patterns = socialMediaPatterns[platform] || [`site:${platform}.com "${username}"`];
    const allResults = [];

    for (const pattern of patterns) {
        const query = pattern.replace(/{username}/g, username);

        try {
            const [bingResults, ddgResults] = await Promise.all([
                searchBingAdvanced(query, 2),
                searchDuckDuckGoAdvanced(query, 20)
            ]);

            const combinedResults = [...bingResults, ...ddgResults];

            for (const result of combinedResults) {
                const targetDomain = {
                    tiktok: 'tiktok.com',
                    facebook: 'facebook.com',
                    instagram: 'instagram.com',
                    youtube: 'youtube.com',
                    twitter: 'twitter.com',
                    linkedin: 'linkedin.com',
                    github: 'github.com',
                    reddit: 'reddit.com'
                }[platform];

                if (result.url && result.url.includes(targetDomain) && !result.url.includes('duckduckgo.com') && !result.url.includes('bing.com')) {
                    try {
                        const profileData = await scrapeSocialMediaProfile(result.url, platform);
                        allResults.push({ 
                            ...result, 
                            ...profileData, 
                            platform, 
                            query 
                        });
                    } catch (scrapeError) {
                        console.error(`Error scraping ${result.url}:`, scrapeError);
                        allResults.push({
                            ...result,
                            platform,
                            query,
                            error: scrapeError.message
                        });
                    }
                    await sleep(2000 + Math.random() * 3000);
                }
            }

        } catch (error) {
            console.error(`Error searching ${platform} for ${username}:`, error);
        }
    }

    // Deduplicate results by URL
    const uniqueResults = allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.url === result.url)
    );

    return uniqueResults;
}

// Enhanced Phone Number Search with better regex
async function searchPhoneNumberAdvanced(username, platform) {
    const patterns = socialMediaPatterns[platform] || [`site:${platform}.com "${username}"`];
    const allResults = [];

    for (const pattern of patterns) {
        const query = pattern.replace(/{username}/g, username);

        try {
            const [bingResults, ddgResults] = await Promise.all([
                searchBingAdvanced(`${query} phone number`, 2),
                searchDuckDuckGoAdvanced(`${query} phone number`, 20)
            ]);

            const combinedResults = [...bingResults, ...ddgResults];

            for (const result of combinedResults) {
                const targetDomain = {
                    tiktok: 'tiktok.com',
                    facebook: 'facebook.com',
                    instagram: 'instagram.com',
                    youtube: 'youtube.com',
                    twitter: 'twitter.com',
                    linkedin: 'linkedin.com',
                    github: 'github.com',
                    reddit: 'reddit.com'
                }[platform];

                if (result.url && result.url.includes(targetDomain) && !result.url.includes('duckduckgo.com') && !result.url.includes('bing.com')) {
                    try {
                        const profileData = await scrapeSocialMediaProfile(result.url, platform);
                        
                        // Enhanced phone number regex
                        const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
                        const textContent = (profileData.bio || '') + ' ' + (result.snippet || '');
                        const phoneMatches = textContent.match(phoneRegex) || [];
                        const phone = phoneMatches.length > 0 ? phoneMatches[0] : null;
                        
                        allResults.push({ 
                            ...result, 
                            ...profileData, 
                            platform, 
                            query, 
                            phone 
                        });
                    } catch (scrapeError) {
                        console.error(`Error scraping ${result.url}:`, scrapeError);
                        allResults.push({
                            ...result,
                            platform,
                            query,
                            error: scrapeError.message
                        });
                    }
                    await sleep(2000 + Math.random() * 3000);
                }
            }

        } catch (error) {
            console.error(`Error searching phone for ${username} on ${platform}:`, error);
        }
    }

    // Deduplicate results by URL
    const uniqueResults = allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.url === result.url)
    );

    return uniqueResults;
}

// Enhanced Comprehensive Search with better error handling
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

    // Search all platforms in parallel with timeout
    const platforms = ['tiktok', 'facebook', 'instagram', 'youtube', 'twitter', 'linkedin', 'github', 'reddit'];
    const platformPromises = platforms.map(platform => 
        searchSocialMediaAdvanced(username, platform)
            .then(platformResults => ({ platform, platformResults }))
            .catch(error => ({ platform, error }))
    );

    try {
        const platformResults = await Promise.all(platformPromises);
        
        platformResults.forEach(({ platform, platformResults, error }) => {
            if (error) {
                results.social_media[platform] = [];
                console.error(`Error searching ${platform}:`, error);
            } else {
                results.social_media[platform] = platformResults;
                results.total_results += platformResults.length;
            }
        });
    } catch (error) {
        console.error('Error in platform searches:', error);
    }

    // Enhanced general search queries
    const generalQueries = [
        `"${username}" profile`,
        `"${username}" account`,
        `"${username}" user`,
        `${username} contact information`,
        `${username} email address`,
        `${username} phone number`,
        `"${username}" bio`,
        `"${username}" about`
    ];

    try {
        const generalSearchPromises = generalQueries.map(query => 
            Promise.all([
                searchBingAdvanced(query, 1),
                searchDuckDuckGoAdvanced(query, 10)
            ])
        );
        
        const generalSearchResults = await Promise.all(generalSearchPromises);
        results.general_search = generalSearchResults.flat(2);
        results.total_results += results.general_search.length;
    } catch (error) {
        console.error('Error in general search:', error);
    }

    // Enhanced email patterns
    const emailPatterns = [
        `"${username}@gmail.com"`,
        `"${username}@yahoo.com"`,
        `"${username}@hotmail.com"`,
        `"${username}@outlook.com"`,
        `"${username}@protonmail.com"`,
        `"${username}@icloud.com"`,
        `"${username}@aol.com"`,
        `"${username}@mail.com"`
    ];

    try {
        const emailSearchPromises = emailPatterns.map(query => 
            searchBingAdvanced(query, 1)
        );
        
        const emailSearchResults = await Promise.all(emailSearchPromises);
        results.email_search = emailSearchResults.flat();
        results.total_results += results.email_search.length;
    } catch (error) {
        console.error('Error in email search:', error);
    }

    // Enhanced breach queries
    const breachQueries = [
        `"${username}" site:haveibeenpwned.com`,
        `"${username}" data breach`,
        `"${username}" leaked database`,
        `"${username}" site:dehashed.com`,
        `"${username}" password leak`,
        `"${username}" credential leak`
    ];

    try {
        const breachSearchPromises = breachQueries.map(query => 
            searchDuckDuckGoAdvanced(query, 10)
        );
        
        const breachSearchResults = await Promise.all(breachSearchPromises);
        results.leaked_data = breachSearchResults.flat();
        results.total_results += results.leaked_data.length;
    } catch (error) {
        console.error('Error in breach search:', error);
    }

    // Enhanced professional queries
    const professionalQueries = [
        `"${username}" CV resume`,
        `"${username}" work experience`,
        `"${username}" company employee`,
        `"${username}" job title position`,
        `"${username}" linkedin profile`,
        `"${username}" professional background`
    ];

    try {
        const professionalSearchPromises = professionalQueries.map(query => 
            searchBingAdvanced(query, 1)
        );
        
        const professionalSearchResults = await Promise.all(professionalSearchPromises);
        results.professional_info = professionalSearchResults.flat();
        results.total_results += results.professional_info.length;
    } catch (error) {
        console.error('Error in professional search:', error);
    }

    // Enhanced contact info extraction
    results.extracted_contacts = extractAdvancedContactInfo(
        JSON.stringify(results)
    );

    console.log(`Investigation complete for ${username}. Total results: ${results.total_results}`);
    return results;
}

// Enhanced Contact Info Extraction
function extractAdvancedContactInfo(text) {
    // Enhanced email regex
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    
    // Enhanced phone regex (international support)
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
    
    // Enhanced username regex
    const usernameRegex = /(?:^|\s)@([a-zA-Z0-9_]{3,})/g;
    
    // Enhanced URL regex
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    
    // Enhanced social media profile regex
    const socialRegex = /(?:facebook|twitter|instagram|linkedin|tiktok|youtube|github|reddit)\.com\/(?:in\/)?[\w.-]+/gi;

    return {
        emails: [...new Set(text.match(emailRegex) || [])],
        phones: [...new Set(text.match(phoneRegex) || [])],
        usernames: [...new Set(text.match(usernameRegex) || []).map(u => u.trim())],
        urls: [...new Set(text.match(urlRegex) || [])],
        social_profiles: [...new Set(text.match(socialRegex) || [])]
    };
}

// Enhanced Website Capture with more metadata
async function captureAdvancedInfo(url) {
    let browser;
    try {
        // First try with axios for basic info
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

        // Then use Puppeteer for advanced capture
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
                executablePath: process.env.CHROMIUM_PATH || puppeteer.executablePath()
            });

            const page = await browser.newPage();
            await page.setUserAgent(userAgentPool[0]);
            await page.setViewport({ width: 1366, height: 768 });

            // Intercept requests to block unnecessary resources
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            await page.goto(url, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });

            // Take screenshot
            const screenshot = await page.screenshot({ 
                encoding: 'base64',
                fullPage: false,
                clip: { x: 0, y: 0, width: 1366, height: 768 }
            });

            // Extract advanced info
            const advancedInfo = await page.evaluate(() => {
                const getMeta = (name) => {
                    const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
                    return el ? el.content : null;
                };

                return {
                    finalUrl: window.location.href,
                    pageText: document.body.innerText.substring(0, 5000),
                    forms: Array.from(document.forms).map(form => ({
                        action: form.action,
                        method: form.method,
                        inputs: Array.from(form.elements).map(el => ({
                            type: el.type,
                            name: el.name,
                            id: el.id,
                            placeholder: el.placeholder
                        }))
                    })),
                    links: Array.from(document.links).slice(0, 50).map(link => ({
                        href: link.href,
                        text: link.textContent.trim(),
                        rel: link.rel
                    })),
                    scripts: Array.from(document.scripts).map(script => script.src).filter(Boolean),
                    iframes: Array.from(document.querySelectorAll('iframe')).map(iframe => ({
                        src: iframe.src,
                        title: iframe.title
                    })),
                    meta: {
                        viewport: getMeta('viewport'),
                        author: getMeta('author'),
                        generator: getMeta('generator'),
                        themeColor: getMeta('theme-color')
                    },
                    technologies: {
                        hasJquery: typeof window.jQuery !== 'undefined',
                        hasReact: typeof window.React !== 'undefined',
                        hasAngular: typeof window.angular !== 'undefined',
                        hasVue: typeof window.Vue !== 'undefined',
                        hasGoogleAnalytics: typeof window.ga !== 'undefined',
                        hasGTM: typeof window.google_tag_manager !== 'undefined'
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
            console.error('Puppeteer capture failed:', puppeteerError);
            return {
                ...basicInfo,
                error: puppeteerError.message,
                captured_at: new Date().toISOString(),
                capture_method: 'basic'
            };
        }

    } catch (error) {
        console.error('Website capture failed:', error);
        return {
            url,
            error: error.message,
            captured_at: new Date().toISOString(),
            capture_method: 'failed'
        };
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) {
                console.error('Error closing browser:', e);
            }
        }
    }
}

// Enhanced Batch Investigation with progress tracking
async function performBatchInvestigation(usernames, reportProgress = false) {
    const investigations = [];
    const total = usernames.length;

    for (let i = 0; i < usernames.length; i++) {
        const username = usernames[i];
        try {
            const investigation = await performComprehensiveSearch(username);
            investigations.push(investigation);
            
            if (reportProgress) {
                // In a real implementation, you might emit progress via WebSocket or similar
                console.log(`Progress: ${i + 1}/${total} (${Math.round(((i + 1) / total) * 100)}%)`);
            }
            
            await sleep(3000 + Math.random() * 4000); // Random delay between requests
            
        } catch (error) {
            console.error(`Error investigating ${username}:`, error);
            investigations.push({
                username,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    return {
        batch_id: uuidv4(),
        total_investigated: investigations.length,
        summary: {
            total_results: investigations.reduce((sum, inv) => sum + (inv.total_results || 0), 0),
            avg_results_per_user: Math.round(
                investigations.reduce((sum, inv) => sum + (inv.total_results || 0), 0) / 
                Math.max(1, investigations.length)
            ),
            success_rate: Math.round(
                (investigations.filter(inv => !inv.error).length / investigations.length) * 100
            )
        },
        investigations
    };
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
        console.error('Investigation error:', error);
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

    if (!socialMediaPatterns[platform]) {
        return res.status(400).json({ error: 'Unsupported platform' });
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
        console.error(`${platform} search error:`, error);
        res.status(500).json({ 
            error: `${platform} search failed`, 
            details: error.message 
        });
    }
});

app.post('/api/search-phone/:platform', async (req, res) => {
    const { platform } = req.params;
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    if (!socialMediaPatterns[platform]) {
        return res.status(400).json({ error: 'Unsupported platform' });
    }

    try {
        const results = await searchPhoneNumberAdvanced(username, platform);
        res.json({
            success: true,
            platform,
            username,
            count: results.length,
            results
        });
    } catch (error) {
        console.error(`${platform} phone search error:`, error);
        res.status(500).json({ 
            error: `${platform} phone search failed`, 
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
        console.error('Advanced search error:', error);
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
        console.error('Capture error:', error);
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
        const batchResult = await performBatchInvestigation(usernames, reportProgress);
        res.json({
            success: true,
            ...batchResult
        });
    } catch (error) {
        console.error('Batch investigation error:', error);
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
        version: '4.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        features: [
            'Advanced Multi-Engine Search',
            'Deep Social Media Investigation',
            'Comprehensive OSINT Framework',
            'Enhanced Web Capture',
            'Contact Extraction',
            'Data Breach Investigation',
            'Professional Information Mining',
            'Batch Processing',
            'Rate Limiting & Evasion',
            'Browser Fingerprinting',
            'Social Media Metadata Extraction',
            'Phone Number Search',
            'Stealth Mode Browsing',
            'Ad Blocking',
            'Multi-Platform Support'
        ],
        supported_platforms: Object.keys(socialMediaPatterns),
        user_agents: userAgentPool.length
    });
});

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './public' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error', 
        details: err.message 
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`OSINT Investigation Platform running on port ${PORT}`);
});
