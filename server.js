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

// Sleep function with reduced jitter
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms + Math.floor(Math.random() * 500)));

// Advanced Social Media Scraping with Optimized Performance
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
                await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
            } catch (navError) {
                if (attempt === retries) throw navError;
                await sleep(1000);
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
                    pinterest: {
                        profilePic: 'img[alt*="profile picture"]',
                        bio: '.profile-bio',
                        followers: '.follower-count',
                        posts: '.pin-count'
                    },
                    github: {
                        profilePic: 'img.avatar-user',
                        bio: '.p-bio',
                        followers: 'a[href*="/followers"] .text-bold',
                        posts: '.js-repos-container'
                    },
                    telegram: {
                        profilePic: 'img.tgme_page_photo_image',
                        bio: '.tgme_page_description',
                        followers: '.tgme_page_extra',
                        posts: '.tgme_channel_history'
                    },
                    linkedin: {
                        profilePic: 'img.pv-top-card--photo',
                        bio: '.pv-about-section .pv-about__summary-text',
                        followers: '.follower-count',
                        posts: '.share-box-feed-entry'
                    },
                    reddit: {
                        profilePic: 'img[alt="User avatar"]',
                        bio: '.profile-bio',
                        followers: '.profile-followers',
                        posts: '.Post'
                    },
                    snapchat: {
                        profilePic: 'img.snapcode',
                        bio: '.profile-bio',
                        followers: '.follower-count',
                        posts: '.story-count'
                    },
                    tumblr: {
                        profilePic: 'img.avatar',
                        bio: '.blog-description',
                        followers: '.follower-count',
                        posts: '.post'
                    },
                    weibo: {
                        profilePic: 'img.user-avatar',
                        bio: '.profile-desc',
                        followers: '.follower-count',
                        posts: '.weibo-post'
                    },
                    vk: {
                        profilePic: 'img.profile-img',
                        bio: '.profile-info',
                        followers: '.friends-count',
                        posts: '.wall-post'
                    },
                    discord: {
                        profilePic: 'img.avatar',
                        bio: '.user-bio',
                        followers: '.member-count',
                        posts: '.message'
                    },
                    twitch: {
                        profilePic: 'img.profile-picture',
                        bio: '.channel-bio',
                        followers: '.follower-count',
                        posts: '.video-count'
                    },
                    medium: {
                        profilePic: 'img.author-image',
                        bio: '.author-bio',
                        followers: '.follower-count',
                        posts: '.post-count'
                    },
                    quora: {
                        profilePic: 'img.profile-photo',
                        bio: '.profile-bio',
                        followers: '.follower-count',
                        posts: '.answer-count'
                    },
                    flickr: {
                        profilePic: 'img.buddyicon',
                        bio: '.profile-description',
                        followers: '.follower-count',
                        posts: '.photo-count'
                    },
                    behance: {
                        profilePic: 'img.profile-image',
                        bio: '.profile-bio',
                        followers: '.follower-count',
                        posts: '.project-count'
                    },
                    dribbble: {
                        profilePic: 'img.user-avatar',
                        bio: '.bio-text',
                        followers: '.follower-count',
                        posts: '.shot-count'
                    },
                    soundcloud: {
                        profilePic: 'img.profile-pic',
                        bio: '.profile-bio',
                        followers: '.follower-count',
                        posts: '.track-count'
                    },
                    mastodon: {
                        profilePic: 'img.account-avatar',
                        bio: '.account-bio',
                        followers: '.followers-count',
                        posts: '.toot-count'
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
            await sleep(1000);
        } finally {
            if (browser) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }
}

// Advanced Bing Search with Optimized Performance
async function searchBingAdvanced(query, maxPages = 2, retries = 2) {
    const allResults = [];
    const cookieJar = new tough.CookieJar();

    for (let page = 0; page < maxPages; page++) {
        const first = page * 10;
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&count=10&FORM=PERE`;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await axios.get(searchUrl, {
                    headers: getAdvancedHeaders('https://www.bing.com/'),
                    timeout: 15000,
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
                await sleep(1000);
                break;

            } catch (error) {
                if (error.response?.status === 429 && attempt < retries) {
                    await sleep(5000 * attempt);
                    continue;
                }
                break;
            }
        }
    }

    return allResults;
}

// Enhanced DuckDuckGo Search with Optimized Performance
async function searchDuckDuckGoAdvanced(query, maxResults = 20, retries = 2) {
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
                await sleep(1000);

            } catch (error) {
                if (attempt === retries) continue;
                await sleep(1500 * attempt);
            }
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
    pinterest: ['site:pinterest.com "{username}"', 'pinterest.com/{username}', '"{username}" pinterest profile'],
    github: ['site:github.com "{username}"', 'github.com/{username}', '"{username}" github profile'],
    telegram: ['site:t.me "{username}"', 't.me/{username}', '"{username}" telegram profile'],
    linkedin: ['site:linkedin.com/in "{username}"', 'linkedin.com/in/{username}', '"{username}" linkedin profile'],
    reddit: ['site:reddit.com/u "{username}"', 'reddit.com/u/{username}', '"{username}" reddit user'],
    snapchat: ['site:snapchat.com/add/{username}', 'snapchat.com/add/{username}', '"{username}" snapchat profile'],
    tumblr: ['site:{username}.tumblr.com', '{username}.tumblr.com', '"{username}" tumblr blog'],
    weibo: ['site:weibo.com "{username}"', 'weibo.com/{username}', '"{username}" weibo profile'],
    vk: ['site:vk.com "{username}"', 'vk.com/{username}', '"{username}" vk profile'],
    discord: ['site:discord.com/users/{username}', 'discord.com/users/{username}', '"{username}" discord profile'],
    twitch: ['site:twitch.tv "{username}"', 'twitch.tv/{username}', '"{username}" twitch channel'],
    medium: ['site:medium.com/@{username}', 'medium.com/@{username}', '"{username}" medium profile'],
    quora: ['site:quora.com/profile/{username}', 'quora.com/profile/{username}', '"{username}" quora profile'],
    flickr: ['site:flickr.com/people/{username}', 'flickr.com/people/{username}', '"{username}" flickr profile'],
    behance: ['site:behance.net/{username}', 'behance.net/{username}', '"{username}" behance profile'],
    dribbble: ['site:dribbble.com/{username}', 'dribbble.com/{username}', '"{username}" dribbble profile'],
    soundcloud: ['site:soundcloud.com/{username}', 'soundcloud.com/{username}', '"{username}" soundcloud profile'],
    mastodon: ['site:mastodon.social/@{username}', 'mastodon.social/@{username}', '"{username}" mastodon profile']
};

// Advanced Social Media Search
async function searchSocialMediaAdvanced(username, platform, maxResults = 2) {
    const patterns = socialMediaPatterns[platform] || [`site:${platform}.com "${username}"`];
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
                    facebook: 'facebook.com',
                    instagram: 'instagram.com',
                    youtube: 'youtube.com',
                    twitter: 'twitter.com',
                    pinterest: 'pinterest.com',
                    github: 'github.com',
                    telegram: 't.me',
                    linkedin: 'linkedin.com',
                    reddit: 'reddit.com',
                    snapchat: 'snapchat.com',
                    tumblr: 'tumblr.com',
                    weibo: 'weibo.com',
                    vk: 'vk.com',
                    discord: 'discord.com',
                    twitch: 'twitch.tv',
                    medium: 'medium.com',
                    quora: 'quora.com',
                    flickr: 'flickr.com',
                    behance: 'behance.net',
                    dribbble: 'dribbble.com',
                    soundcloud: 'soundcloud.com',
                    mastodon: 'mastodon.social'
                }[platform];

                if (result.url && result.url.includes(targetDomain) && !result.url.includes('duckduckgo.com') && !result.url.includes('bing.com')) {
                    const profileData = await scrapeSocialMediaProfile(result.url, platform);
                    allResults.push({ ...result, ...profileData, platform, query });
                }
            }

            await sleep(500);

        } catch (error) {
            // Silent error handling
        }
    }

    return allResults.slice(0, maxResults);
}

// Phone Number Search
async function searchPhoneNumberAdvanced(username, platform, maxResults = 2) {
    const patterns = socialMediaPatterns[platform] || [`site:${platform}.com "${username}"`];
    const allResults = [];

    for (const pattern of patterns) {
        const query = pattern.replace(/{username}/g, username);

        try {
            const [bingResults, ddgResults] = await Promise.all([
                searchBingAdvanced(`${query} phone number`, 1),
                searchDuckDuckGoAdvanced(`${query} phone number`, maxResults)
            ]);

            const combinedResults = [...bingResults, ...ddgResults].slice(0, maxResults);

            for (const result of combinedResults) {
                const targetDomain = {
                    tiktok: 'tiktok.com',
                    facebook: 'facebook.com',
                    instagram: 'instagram.com',
                    youtube: 'youtube.com',
                    twitter: 'twitter.com',
                    pinterest: 'pinterest.com',
                    github: 'github.com',
                    telegram: 't.me',
                    linkedin: 'linkedin.com',
                    reddit: 'reddit.com',
                    snapchat: 'snapchat.com',
                    tumblr: 'tumblr.com',
                    weibo: 'weibo.com',
                    vk: 'vk.com',
                    discord: 'discord.com',
                    twitch: 'twitch.tv',
                    medium: 'medium.com',
                    quora: 'quora.com',
                    flickr: 'flickr.com',
                    behance: 'behance.net',
                    dribbble: 'dribbble.com',
                    soundcloud: 'soundcloud.com',
                    mastodon: 'mastodon.social'
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

            await sleep(500);

        } catch (error) {
            // Silent error handling
        }
    }

    return allResults.slice(0, maxResults);
}

// Comprehensive Deep Search Function
async function performComprehensiveSearch(username, platforms = [], maxResults = 2) {
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

    const selectedPlatforms = platforms.length > 0 ? platforms : Object.keys(socialMediaPatterns);
    for (const platform of selectedPlatforms) {
        try {
            const platformResults = await searchSocialMediaAdvanced(username, platform, maxResults);
            results.social_media[platform] = platformResults;
            results.total_results += platformResults.length;
            await sleep(500);
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
                searchBingAdvanced(query, 1),
                searchDuckDuckGoAdvanced(query, maxResults)
            ]);

            results.general_search.push(...bingResults, ...ddgResults);
            await sleep(500);
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
            await sleep(500);
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
            const breachResults = await searchDuckDuckGoAdvanced(breachQuery, maxResults);
            results.leaked_data.push(...breachResults);
            await sleep(500);
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
            await sleep(500);
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
    const socialRegex = /(facebook|twitter|instagram|linkedin|tiktok|youtube|pinterest|github|telegram|reddit|snapchat|tumblr|weibo|vk|discord|twitch|medium|quora|flickr|behance|dribbble|soundcloud|mastodon)\.com\/[\w.-]+/gi;

    return {
        emails: [...new Set(text.match(emailRegex) || [])],
        phones: [...new Set(text.match(phoneRegex) || [])],
        usernames: [...new Set(text.match(usernameRegex) || [])],
        urls: [...new Set(text.match(urlRegex) || [])],
        social_profiles: [...new Set(text.match(socialRegex) || [])]
    };
}

// Enhanced Website Capture
async function captureAdvancedInfo(url, retries = 2) {
    let browser;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const axiosResponse = await axios.get(url, {
                headers: getAdvancedHeaders(),
                timeout: 10000,
                maxRedirects: 3
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
                await page.setUserAgent(userAgentPool[0]);
                await page.setViewport({ width: 1366, height: 768 });

                await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });

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
            if (attempt === retries) {
                return {
                    url,
                    error: error.message,
                    captured_at: new Date().toISOString(),
                    capture_method: 'failed'
                };
            }
            await sleep(1000);
        } finally {
            if (browser) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }
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

app.post('/api/search/:platform', async (req, res) => {
    const { platform } = req.params;
    const { username, maxResults = 2 } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    try {
        const results = await searchSocialMediaAdvanced(username, platform, maxResults);
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
    const { username, maxResults = 2 } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    try {
        const results = await searchPhoneNumberAdvanced(username, platform, maxResults);
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
    const { query, maxResults = 20, sources = ['bing', 'duckduckgo'] } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        const results = [];

        if (sources.includes('bing')) {
            const bingResults = await searchBingAdvanced(query, 1);
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
    const { usernames, platforms = [], maxResults = 2, reportProgress = false } = req.body;

    if (!usernames || !Array.isArray(usernames)) {
        return res.status(400).json({ error: 'Usernames array is required' });
    }

    try {
        const investigations = [];
        const total = usernames.length;

        for (let i = 0; i < usernames.length; i++) {
            const username = usernames[i];
            const investigation = await performComprehensiveSearch(username, platforms, maxResults);
            investigations.push(investigation);
            await sleep(1000);
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
        version: '3.3.2-railway',
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
            'Phone Number Search'
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
