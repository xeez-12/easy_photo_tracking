const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const tough = require('tough-cookie');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Highly Complex User Agent Pool
const userAgentPool = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/605.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Android 15; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0',
    'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/605.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/130.0.2849.68 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (Android 14; Tablet; rv:132.0) Gecko/132.0 Firefox/132.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/605.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/115.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.68',
    'Mozilla/5.0 (Linux; Android 15; SM-G998B Build/VP5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.58 Mobile Safari/537.36'
];

// Enhanced Headers Configuration with Advanced Fingerprinting Evasion
const getAdvancedHeaders = (referer = null, isXHR = false) => {
    const userAgent = userAgentPool[Math.floor(Math.random() * userAgentPool.length)];
    const platform = userAgent.includes('Windows') ? '"Windows"' :
                    userAgent.includes('Macintosh') ? '"macOS"' :
                    userAgent.includes('Linux') ? '"Linux"' :
                    userAgent.includes('Android') ? '"Android"' : '"iOS"';
    const mobile = userAgent.includes('Mobile') ? '?1' : '?0';
    const accept = isXHR ? 'application/json, text/plain, */*' : 
                   'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
    return {
        'User-Agent': userAgent,
        'Accept': accept,
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8,fr;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': isXHR ? undefined : '1',
        'Sec-Fetch-Dest': isXHR ? 'empty' : 'document',
        'Sec-Fetch-Mode': isXHR ? 'cors' : 'navigate',
        'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
        'Sec-Fetch-User': isXHR ? undefined : '?1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'sec-ch-ua': userAgent.includes('Chrome') ? '"Google Chrome";v="130", "Chromium";v="130", "Not?A_Brand";v="24"' :
                     userAgent.includes('Firefox') ? '"Firefox";v="132", "Gecko";v="20100101"' :
                     userAgent.includes('Safari') ? '"Safari";v="18", "WebKit";v="605.1.15"' : '"Not?A_Brand";v="99"',
        'sec-ch-ua-mobile': mobile,
        'sec-ch-ua-platform': platform,
        'sec-ch-ua-platform-version': userAgent.includes('Windows') ? '"11.0.0"' :
                                     userAgent.includes('Macintosh') ? '"15.1.0"' :
                                     userAgent.includes('Android') ? '"15.0.0"' : '"18.1.0"',
        'X-Forwarded-For': generateRandomIP(),
        'X-Real-IP': generateRandomIP(),
        'Referer': referer || getRandomReferer(),
        'Origin': referer ? new URL(referer).origin : 'https://www.google.com',
        'X-Requested-With': isXHR ? 'XMLHttpRequest' : undefined,
        'Sec-GPC': '1',
        'Priority': isXHR ? 'u=1, i' : 'u=0, i'
    };
};

// Random Referer Generator
function getRandomReferer() {
    const referers = [
        'https://www.google.com/',
        'https://www.bing.com/',
        'https://duckduckgo.com/',
        'https://www.yahoo.com/',
        'https://www.ecosia.org/'
    ];
    return referers[Math.floor(Math.random() * referers.length)];
}

// Generate Random IP
function generateRandomIP() {
    const ranges = [
        [10, 0, 0, 0], [172, 16, 0, 0], [192, 168, 0, 0],
        [198, 51, 100, 0], [203, 0, 113, 0], [100, 64, 0, 0]
    ];
    const range = ranges[Math.floor(Math.random() * ranges.length)];
    return range.map((num, i) => i === 0 ? num : Math.floor(Math.random() * 256)).join('.');
}

// Sleep function with jitter
const sleep = (ms) => new Promise(resolve => 
    setTimeout(resolve, ms + Math.floor(Math.random() * 1500))
);

// Advanced Social Media Scraping with Deep Data Extraction
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
                '--disable-features=site-per-process',
                '--blink-settings=imagesEnabled=true'
            ],
            executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium'
        });

        const context = await browser.createIncognitoBrowserContext();
        const page = await context.newPage();
        await page.setUserAgent(userAgentPool[Math.floor(Math.random() * userAgentPool.length)]);
        await page.setViewport({ width: 1440, height: 900 });
        await page.setExtraHTTPHeaders(getAdvancedHeaders(url));

        // Enable request interception for optimization
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font'].includes(request.resourceType()) && Math.random() > 0.3) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // Navigate with retry logic
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
                break;
            } catch (error) {
                attempts++;
                if (attempts === maxAttempts) throw error;
                await sleep(2000);
            }
        }

        // Wait for dynamic content
        await page.waitForTimeout(3000);

        const profileData = await page.evaluate((platform) => {
            const getText = (selector) => document.querySelector(selector)?.textContent?.trim() || '';
            const getImage = (selector) => document.querySelector(selector)?.src || '';
            const getAttribute = (selector, attr) => document.querySelector(selector)?.getAttribute(attr) || '';

            const platformSelectors = {
                tiktok: {
                    profilePic: 'img[data-testid="user-avatar"], img[alt*="profile photo"]',
                    username: '[data-testid="user-username"], h1[itemprop="name"]',
                    bio: '[data-testid="user-bio"], .tiktok-bio',
                    followers: '[data-testid="user-followers"] strong, span[data-e2e="followers-count"]',
                    following: '[data-testid="user-following"] strong, span[data-e2e="following-count"]',
                    posts: '[data-testid="user-videos"] strong, span[data-e2e="videos-count"]',
                    verified: '[data-testid="verified-badge"], .verified-icon',
                    links: 'a[href*="/"], a[href*="http"]'
                },
                instagram: {
                    profilePic: 'img[alt*="profile picture"], img.x1q0g3np',
                    username: 'h2._aacl, span._aacl',
                    bio: '._aa_y div div span, .x1q0g3np span',
                    followers: 'a[href*="/followers/"] span, span._ac2a',
                    following: 'a[href*="/following/"] span',
                    posts: 'span._ac2a, span[data-testid="user-posts-count"]',
                    verified: '.x1i10hfl[title="Verified"], .verified-badge',
                    links: 'a[href*="/"], a[href*="http"]'
                },
                twitter: {
                    profilePic: 'img[alt="Profile picture"], img.css-9pa8cd',
                    username: '[data-testid="UserName"] div, span[data-testid="UserHandle"]',
                    bio: '[data-testid="UserDescription"], div[data-testid="UserBio"]',
                    followers: '[data-testid="followers"] span, a[href*="/followers"] span',
                    following: '[data-testid="following"] span, a[href*="/following"] span',
                    posts: '[data-testid="tweet"] article, [data-testid="cellInnerDiv"]',
                    verified: '[data-testid="UserBadges"] svg, .r-1fmj7o5',
                    location: '[data-testid="UserLocation"], span[data-testid="UserLocation"]',
                    links: 'a[href*="/"], a[href*="http"]'
                },
                facebook: {
                    profilePic: 'img.x1y9k2m, img[data-visualcompletion="media-vc-image"]',
                    username: 'h1.x1heor9g, span.x1heor9g',
                    bio: 'div.x1iorvi4 div.x1iorvi4 span, .x1yztbdb span',
                    followers: 'span.x1e558r4, a[href*="/followers"] span',
                    following: 'a[href*="/following"] span',
                    posts: 'div.x1n2onr6 div.x1yztbdb, .x1y1aw1k article',
                    verified: '.x1i10hfl[title="Verified"], .verified-icon',
                    links: 'a[href*="/"], a[href*="http"]'
                },
                youtube: {
                    profilePic: 'img#img, img.yt-img-shadow',
                    username: '#channel-name, h1.ytd-channel-name',
                    bio: '#description.ytd-channel-about-metadata-renderer, #description-container',
                    followers: '#subscriber-count, span.ytd-channel-statistics',
                    posts: 'ytd-grid-video-renderer, #video-title',
                    verified: '#badges .badge, .ytd-channel-name .verified',
                    links: 'a[href*="/"], a[href*="http"]'
                },
                linkedin: {
                    profilePic: 'img.pv-top-card--photo, img.profile-photo',
                    username: 'h1.t-24, .text-heading-xlarge',
                    bio: '.pv-about-section .pv-about__summary-text, .text-body-medium',
                    followers: '.follower-count, span.t-16.t-black--light',
                    posts: '.share-box-feed-entry, .feed-shared-update-v2',
                    verified: '.pv-top-card--verified, .verified-badge',
                    company: '.pv-top-card--company, .org-top-card-summary__company',
                    links: 'a[href*="/"], a[href*="http"]'
                },
                github: {
                    profilePic: 'img.avatar-user, img.u-photo',
                    username: '.p-name.vcard-fullname, h1.vcard-names',
                    bio: '.p-bio, .user-profile-bio',
                    followers: 'a[href*="/followers"] .text-bold, span.follower-count',
                    following: 'a[href*="/following"] .text-bold',
                    posts: '.js-repos-container, .repository',
                    verified: '.verified-badge, .Label--success',
                    links: 'a[href*="/"], a[href*="http"]'
                },
                reddit: {
                    profilePic: 'img[alt="User avatar"], img.s1gr2x0g',
                    username: 'h1._3Xzp4__8d0rr, span._2eJ8MPsMAzCS8gEvaZ3ws8',
                    bio: '.profile-bio, div._3xXJx3vYSWIbSkZmsvW5gQ',
                    followers: '.profile-followers, span._2eJ8MPsMAzCS8gEvaZ3ws8',
                    posts: '.Post, article._1poyrkZ7g36PawDuexNS',
                    verified: '.verified-icon, .id-card-verified',
                    links: 'a[href*="/"], a[href*="http"]'
                }
            };

            const selectors = platformSelectors[platform] || {};
            const links = Array.from(document.querySelectorAll(selectors.links || 'a[href]'))
                .map(link => ({
                    href: link.href,
                    text: link.textContent.trim()
                }))
                .filter(link => link.href && !link.href.includes('javascript:'));

            return {
                profilePic: getImage(selectors.profilePic),
                username: getText(selectors.username),
                bio: getText(selectors.bio),
                followers: getText(selectors.followers),
                following: getText(selectors.following),
                postCount: document.querySelectorAll(selectors.posts).length || getText(selectors.posts),
                verified: !!document.querySelector(selectors.verified),
                location: getText(selectors.location || ''),
                company: getText(selectors.company || ''),
                externalLinks: links.slice(0, 10),
                metadata: {
                    title: document.title,
                    description: document.querySelector('meta[name="description"]')?.content || '',
                    ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
                    language: document.documentElement.lang || 'unknown'
                }
            };
        }, platform);

        // Capture multiple screenshots for better analysis
        const screenshots = [
            await page.screenshot({ 
                encoding: 'base64',
                fullPage: false,
                clip: { x: 0, y: 0, width: 1440, height: 900 }
            }),
            await page.screenshot({ 
                encoding: 'base64',
                fullPage: true
            })
        ];

        await context.close();
        await browser.close();

        return {
            url,
            ...profileData,
            screenshots: {
                viewport: `data:image/png;base64,${screenshots[0]}`,
                fullPage: `data:image/png;base64,${screenshots[1]}`
            },
            scraped_at: new Date().toISOString(),
            platform,
            status: 'success'
        };
    } catch (error) {
        return { 
            url, 
            error: error.message, 
            scraped_at: new Date().toISOString(), 
            platform, 
            status: 'failed' 
        };
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
    }
}

// Advanced Bing Search with Enhanced Error Handling
async function searchBingAdvanced(query, maxPages = 5) {
    const allResults = [];
    const cookieJar = new tough.CookieJar();

    for (let page = 0; page < maxPages; page++) {
        const first = page * 10;
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&count=10&FORM=PERE`;

        try {
            const response = await axios.get(searchUrl, {
                headers: getAdvancedHeaders('https://www.bing.com/'),
                timeout: 25000,
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
                        position: i + 1,
                        cached: $el.find('.b_attribution').text().includes('Cached')
                    });
                }
            });

            allResults.push(...pageResults);

            if (pageResults.length === 0) break;
            await sleep(2500);

        } catch (error) {
            if (error.response?.status === 429) {
                await sleep(15000);
                continue;
            }
            break;
        }
    }

    return allResults;
}

// Enhanced DuckDuckGo Search with Multiple Strategies
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
                        timeout: 25000
                    }
                );
            } else {
                response = await axios.get(strategy.url, {
                    params: { q: query, kl: 'us-en', df: '' },
                    headers: getAdvancedHeaders('https://duckduckgo.com/'),
                    timeout: 25000
                });
            }

            const $ = cheerio.load(response.data);
            const results = [];

            const selectors = [
                '.result, .web-result',
                '.results_links',
                '[data-result-index]',
                '.result__body',
                '.links_main'
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
                            strategy: strategy.url,
                            timestamp: new Date().toISOString()
                        });
                    }
                });

                if (results.length > 0) break;
            }

            if (results.length > 0) return results;

        } catch (error) {
            continue;
        }
    }

    return [];
}

// Social Media URL Builders
const socialMediaPatterns = {
    tiktok: ['site:tiktok.com "@{username}"', 'tiktok.com/@{username}', '"{username}" tiktok profile'],
    facebook: ['site:facebook.com "{username}"', 'facebook.com/{username}', '"{username}" facebook profile'],
    instagram: ['site:instagram.com "{username}"', 'instagram.com/{username}', '"{username}" instagram'],
    youtube: ['site:youtube.com "{username}"', 'youtube.com/@{username}', '"{username}" youtube channel'],
    twitter: ['site:twitter.com "{username}"', 'twitter.com/{username}', '"{username}" twitter profile'],
    linkedin: ['site:linkedin.com/in "{username}"', 'linkedin.com/in/{username}', '"{username}" linkedin profile'],
    github: ['site:github.com "{username}"', 'github.com/{username}', '"{username}" github profile'],
    reddit: ['site:reddit.com/u "{username}"', 'reddit.com/u/{username}', '"{username}" reddit user']
};

// Advanced Social Media Search (Platform-Specific)
async function searchSocialMediaAdvanced(username, platform) {
    const patterns = socialMediaPatterns[platform] || [`site:${platform}.com "${username}"`];
    const allResults = [];

    for (const pattern of patterns) {
        const query = pattern.replace(/{username}/g, username);

        try {
            const [bingResults, ddgResults] = await Promise.all([
                searchBingAdvanced(query, 3),
                searchDuckDuckGoAdvanced(query, 25)
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
                    const profileData = await scrapeSocialMediaProfile(result.url, platform);
                    allResults.push({ ...result, ...profileData, platform, query });
                }
            }

            await sleep(2000);

        } catch (error) {
            continue;
        }
    }

    const uniqueResults = allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.url === result.url)
    );

    return uniqueResults;
}

// Phone Number Search
async function searchPhoneNumberAdvanced(username, platform) {
    const patterns = socialMediaPatterns[platform] || [`site:${platform}.com "${username}"`];
    const allResults = [];

    for (const pattern of patterns) {
        const query = pattern.replace(/{username}/g, username);

        try {
            const [bingResults, ddgResults] = await Promise.all([
                searchBingAdvanced(`${query} phone number`, 3),
                searchDuckDuckGoAdvanced(`${query} phone number`, 25)
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
                    const profileData = await scrapeSocialMediaProfile(result.url, platform);
                    const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
                    const textContent = profileData.bio || result.snippet || '';
                    const phoneMatch = textContent.match(phoneRegex);
                    const phone = phoneMatch ? phoneMatch[0] : null;
                    allResults.push({ ...result, ...profileData, platform, query, phone });
                }
            }

            await sleep(2000);

        } catch (error) {
            continue;
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
        total_results: 0,
        analysis: {
            confidence_score: 0,
            verified_profiles: 0
        }
    };

    const platforms = ['tiktok', 'facebook', 'instagram', 'youtube', 'twitter', 'linkedin', 'github', 'reddit'];
    for (const platform of platforms) {
        try {
            const platformResults = await searchSocialMediaAdvanced(username, platform);
            results.social_media[platform] = platformResults;
            results.total_results += platformResults.length;
            results.analysis.verified_profiles += platformResults.filter(r => r.verified).length;
            await sleep(3000);
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
                searchBingAdvanced(query, 3),
                searchDuckDuckGoAdvanced(query, 20)
            ]);

            results.general_search.push(...bingResults, ...ddgResults);
            await sleep(2000);
        } catch (error) {
            continue;
        }
    }

    const emailPatterns = [
        `"${username}@gmail.com"`,
        `"${username}@yahoo.com"`,
        `"${username}@hotmail.com"`,
        `"${username}@outlook.com"`,
        `"${username}@protonmail.com"`,
        `"${username}@icloud.com"`
    ];

    for (const emailQuery of emailPatterns) {
        try {
            const emailResults = await searchBingAdvanced(emailQuery, 2);
            results.email_search.push(...emailResults);
            await sleep(1500);
        } catch (error) {
            continue;
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
            const breachResults = await searchDuckDuckGoAdvanced(breachQuery, 15);
            results.leaked_data.push(...breachResults);
            await sleep(2000);
        } catch (error) {
            continue;
        }
    }

    const professionalQueries = [
        `"${username}" CV resume`,
        `"${username}" work experience`,
        `"${username}" company employee`,
        `"${username}" job title position`,
        `"${username}" portfolio`
    ];

    for (const profQuery of professionalQueries) {
        try {
            const profResults = await searchBingAdvanced(profQuery, 2);
            results.professional_info.push(...profResults);
            await sleep(2000);
        } catch (error) {
            continue;
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
    results.analysis.confidence_score = calculateConfidenceScore(results);

    console.log(`Investigation complete for ${username}. Total results: ${results.total_results}`);
    return results;
}

// Calculate Confidence Score
function calculateConfidenceScore(results) {
    let score = 0;
    const verifiedWeight = 0.4;
    const totalResultsWeight = 0.3;
    const uniquePlatformsWeight = 0.2;
    const contactInfoWeight = 0.1;

    score += results.analysis.verified_profiles * verifiedWeight;
    score += Math.min(results.total_results / 50, 1) * totalResultsWeight;
    score += Object.keys(results.social_media).filter(p => results.social_media[p].length > 0).length * uniquePlatformsWeight;
    score += (results.extracted_contacts.emails.length + results.extracted_contacts.phones.length) * contactInfoWeight;

    return Math.min(Math.round(score * 100), 100);
}

// Advanced Contact Info Extraction
function extractAdvancedContactInfo(text) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    const usernameRegex = /@([a-zA-Z0-9_]+)/g;
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    const socialRegex = /(facebook|twitter|instagram|linkedin|tiktok|youtube|github|reddit)\.com\/[\w.-]+/gi;

    return {
        emails: [...new Set(text.match(emailRegex) || [])],
        phones: [...new Set(text.match(phoneRegex) || [])],
        usernames: [...new Set(text.match(usernameRegex) || [])].slice(0, 50),
        urls: [...new Set(text.match(urlRegex) || [])].slice(0, 100),
        social_profiles: [...new Set(text.match(socialRegex) || [])].slice(0, 50)
    };
}

// Enhanced Website Capture
async function captureAdvancedInfo(url) {
    let browser;
    try {
        const axiosResponse = await axios.get(url, {
            headers: getAdvancedHeaders(),
            timeout: 20000,
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
            status: axiosResponse.status,
            contentType: axiosResponse.headers['content-type'] || ''
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
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=site-per-process'
                ],
                executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium'
            });

            const context = await browser.createIncognitoBrowserContext();
            const page = await context.newPage();
            await page.setUserAgent(userAgentPool[0]);
            await page.setViewport({ width: 1440, height: 900 });
            await page.setExtraHTTPHeaders(getAdvancedHeaders(url));

            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'stylesheet', 'font'].includes(request.resourceType()) && Math.random() > 0.3) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

            const screenshots = [
                await page.screenshot({ 
                    encoding: 'base64',
                    fullPage: false,
                    clip: { x: 0, y: 0, width: 1440, height: 900 }
                }),
                await page.screenshot({ 
                    encoding: 'base64',
                    fullPage: true
                })
            ];

            const advancedInfo = await page.evaluate(() => {
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
                            placeholder: el.placeholder || ''
                        }))
                    })),
                    links: Array.from(document.links).slice(0, 100).map(link => ({
                        href: link.href,
                        text: link.textContent.trim(),
                        rel: link.rel || ''
                    })),
                    scripts: Array.from(document.scripts).map(script => ({
                        src: script.src,
                        inline: !script.src ? script.textContent.substring(0, 500) : ''
                    })).filter(s => s.src || s.inline),
                    technologies: {
                        hasJquery: typeof window.jQuery !== 'undefined',
                        hasReact: typeof window.React !== 'undefined',
                        hasAngular: typeof window.angular !== 'undefined',
                        hasVue: typeof window.Vue !== 'undefined',
                        hasWordpress: !!document.querySelector('meta[name="generator"][content*="WordPress"]'),
                        hasShopify: !!document.querySelector('script[src*="shopify"]')
                    },
                    metadata: {
                        charset: document.characterSet,
                        viewport: document.querySelector('meta[name="viewport"]')?.content || '',
                        favicon: document.querySelector('link[rel*="icon"]')?.href || ''
                    }
                };
            });

            await context.close();
            await browser.close();

            return {
                ...basicInfo,
                ...advancedInfo,
                screenshots: {
                    viewport: `data:image/png;base64,${screenshots[0]}`,
                    fullPage: `data:image/png;base64,${screenshots[1]}`
                },
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

// Routes (Unchanged)
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

app.post('/api/search-phone/:platform', async (req, res) => {
    const { platform } = req.params;
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
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
            await sleep(6000);
        }

        res.json({
            success: true,
            batch_id: uuidv4(),
            total_investigated: investigations.length,
            summary: {
                total_results: investigations.reduce((sum, inv) => sum + inv.total_results, 0),
                avg_results_per_user: Math.round(investigations.reduce((sum, inv) => sum + inv.total_results, 0) / investigations.length),
                avg_confidence_score: Math.round(investigations.reduce((sum, inv) => sum + inv.analysis.confidence_score, 0) / investigations.length)
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
            'Comprehensive OSINT Framework',
            'Enhanced Web Capture',
            'Contact Extraction',
            'Data Breach Investigation',
            'Professional Information Mining',
            'Batch Processing',
            'Advanced Rate Limiting & Evasion',
            'Browser Fingerprinting Protection',
            'Deep Social Media Metadata Extraction',
            'Phone Number Search',
            'Confidence Scoring'
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
