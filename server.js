const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const tough = require('tough-cookie');
const puppeteer = require('puppeteer');
const userAgents = require('./useragents');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBy6dWTt2Ezq1_RJ9tK5pTmMYW3NWmUhrk'; // Set in environment variables

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Enhanced Headers Configuration
const getAdvancedHeaders = (referer = null, isXHR = false) => {
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
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
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
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
        [172, 217, 0, 0], [104, 244, 222, 1], [198, 51, 100, 1]
    ];
    const range = ranges[Math.floor(Math.random() * ranges.length)];
    return range.map(num => num + Math.floor(Math.random() * 10)).join('.');
}

// Sleep function with randomization
const sleep = (ms) => new Promise(resolve => 
    setTimeout(resolve, ms + Math.floor(Math.random() * 1000))
);

// Format data with Gemini AI
async function formatWithGemini(data) {
    try {
        const response = await axios.post(
            `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{
                        text: `Format the following scraped data into a clean, professional, and readable JSON structure. Ensure the output is concise, well-organized, and includes only relevant information. Data: ${JSON.stringify(data, null, 2)}`
                    }]
                }]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    ...getAdvancedHeaders()
                },
                timeout: 30000
            }
        );

        return JSON.parse(response.data.candidates[0].content.parts[0].text);
    } catch (error) {
        console.error('Gemini API error:', error.message);
        return data; // Fallback to original data if Gemini fails
    }
}

// Enhanced Social Media Scraping
async function scrapeSocialMediaProfile(url, platform, retries = 2) {
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
        await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
        await page.setViewport({ width: 1366, height: 768 });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const profileData = await page.evaluate((platform) => {
            const getText = (selector) => document.querySelector(selector)?.textContent?.trim() || '';
            const getImage = (selector) => document.querySelector(selector)?.src || '';
            const getAttribute = (selector, attr) => document.querySelector(selector)?.getAttribute(attr) || '';

            const platformSelectors = {
                tiktok: {
                    profilePic: 'img[data-testid="user-avatar"], img[alt*="profile photo"]',
                    username: '[data-testid="user-username"], h1',
                    bio: '[data-testid="user-bio"], .user-bio',
                    followers: '[data-testid="user-followers"] strong, .follower-count',
                    posts: '[data-testid="user-videos"] strong, .video-count',
                    verified: '[data-testid="verified-badge"]'
                },
                instagram: {
                    profilePic: 'img[alt*="profile picture"], img[src*="profile"]',
                    username: 'h2, ._aacl',
                    bio: '._aa_y div div span, .bio-text',
                    followers: 'a[href*="/followers/"] span, .follower-count',
                    posts: 'span._ac2a, .post-count',
                    verified: 'span[aria-label="Verified"]'
                },
                twitter: {
                    profilePic: 'img[alt="Profile picture"], img[src*="profile_images"]',
                    username: '[data-testid="UserName"], h1',
                    bio: '[data-testid="UserDescription"], .user-bio',
                    followers: '[data-testid="followers"] span, .followers-count',
                    posts: '[data-testid="tweet"], .tweet-count',
                    verified: '[data-testid="verified"]'
                },
                facebook: {
                    profilePic: 'img.x1y9k2m, img[alt*="profile"]',
                    username: 'h1, .profile-name',
                    bio: 'div.x1heor9g div.x1iorvi4 span, .bio-text',
                    followers: 'span.x1e558r4, .follower-count',
                    posts: 'div.x1n2onr6 div.x1yztbdb, .post-count',
                    verified: 'span[aria-label="Verified"]'
                },
                youtube: {
                    profilePic: 'img#img, img[src*="ytimg"]',
                    username: '#channel-name, h1',
                    bio: '#description.ytd-channel-about-metadata-renderer, .channel-bio',
                    followers: '#subscriber-count, .subscriber-count',
                    posts: 'ytd-grid-video-renderer, .video-count',
                    verified: '#badges .badge'
                },
                linkedin: {
                    profilePic: 'img.pv-top-card--photo, img.profile-photo',
                    username: 'h1, .profile-name',
                    bio: '.pv-about-section .pv-about__summary-text, .about-text',
                    followers: '.follower-count, .followers',
                    posts: '.share-box-feed-entry, .post-count',
                    verified: '.verified-badge'
                },
                github: {
                    profilePic: 'img.avatar-user, img[src*="avatar"]',
                    username: 'h1, .user-name',
                    bio: '.p-bio, .bio-text',
                    followers: 'a[href*="/followers"] .text-bold, .follower-count',
                    posts: '.js-repos-container, .repo-count',
                    verified: '.verified-badge'
                },
                reddit: {
                    profilePic: 'img[alt="User avatar"], img[src*="avatar"]',
                    username: 'h1, .user-name',
                    bio: '.profile-bio, .bio-text',
                    followers: '.profile-followers, .followers',
                    posts: '.Post, .post-count',
                    verified: '.verified-icon'
                }
            };

            const selectors = platformSelectors[platform] || {};
            return {
                profilePic: getImage(selectors.profilePic),
                username: getText(selectors.username),
                bio: getText(selectors.bio),
                followers: getText(selectors.followers),
                postCount: document.querySelectorAll(selectors.posts).length || getText(selectors.posts),
                verified: !!document.querySelector(selectors.verified),
                creationDate: getText('[data-testid="creation-date"], .join-date, .created-date')
            };
        }, platform);

        const screenshot = await page.screenshot({ 
            encoding: 'base64',
            fullPage: false,
            clip: { x: 0, y: 0, width: 1366, height: 768 }
        });

        await browser.close();

        const formattedData = await formatWithGemini({
            url,
            ...profileData,
            screenshot: `data:image/png;base64,${screenshot}`,
            scraped_at: new Date().toISOString(),
            platform
        });

        return formattedData;
    } catch (error) {
        if (retries > 0) {
            await sleep(5000);
            return scrapeSocialMediaProfile(url, platform, retries - 1);
        }
        console.error(`Failed to scrape ${platform} profile: ${error.message}`);
        return { url, error: error.message, scraped_at: new Date().toISOString(), platform };
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
    }
}

// Advanced Bing Search
async function searchBingAdvanced(query, maxPages = 5, retries = 2) {
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
            await sleep(2000);

        } catch (error) {
            if (error.response?.status === 429 && retries > 0) {
                await sleep(10000);
                return searchBingAdvanced(query, maxPages, retries - 1);
            }
            console.error(`Bing search error: ${error.message}`);
            break;
        }
    }

    return allResults;
}

// Enhanced DuckDuckGo Search
async function searchDuckDuckGoAdvanced(query, maxResults = 50, retries = 2) {
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
            if (retries > 0) {
                await sleep(5000);
                continue;
            }
            console.error(`DuckDuckGo search error: ${error.message}`);
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
                    const profileData = await scrapeSocialMediaProfile(result.url, platform);
                    allResults.push({ ...result, ...profileData, platform, query });
                }
            }

            await sleep(1500);

        } catch (error) {
            console.error(`Social media search error for ${platform}: ${error.message}`);
        }
    }

    const uniqueResults = allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.url === result.url)
    );

    return await formatWithGemini(uniqueResults);
}

// Cross-Platform Social Media Search
async function searchCrossPlatform(username) {
    const platforms = Object.keys(socialMediaPatterns);
    const allResults = [];

    await Promise.all(platforms.map(async (platform) => {
        try {
            const platformResults = await searchSocialMediaAdvanced(username, platform);
            allResults.push(...platformResults);
            await sleep(2000);
        } catch (error) {
            console.error(`Cross-platform search error for ${platform}: ${error.message}`);
        }
    }));

    const uniqueResults = allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.url === result.url)
    );

    return await formatWithGemini({
        username,
        platforms_searched: platforms,
        total_results: uniqueResults.length,
        results: uniqueResults
    });
}

// Phone Number Search
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
                    const profileData = await scrapeSocialMediaProfile(result.url, platform);
                    const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
                    const textContent = profileData.bio || result.snippet || '';
                    const phoneMatch = textContent.match(phoneRegex);
                    const phone = phoneMatch ? phoneMatch[0] : null;
                    allResults.push({ ...result, ...profileData, platform, query, phone });
                }
            }

            await sleep(1500);

        } catch (error) {
            console.error(`Phone search error for ${platform}: ${error.message}`);
        }
    }

    const uniqueResults = allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.url === result.url)
    );

    return await formatWithGemini(uniqueResults);
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

    const platforms = Object.keys(socialMediaPatterns);
    for (const platform of platforms) {
        try {
            const platformResults = await searchSocialMediaAdvanced(username, platform);
            results.social_media[platform] = platformResults;
            results.total_results += platformResults.length;
            await sleep(2000);
        } catch (error) {
            results.social_media[platform] = [];
            console.error(`Comprehensive search error for ${platform}: ${error.message}`);
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
            console.error(`General search error: ${error.message}`);
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
            console.error(`Email search error: ${error.message}`);
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
            console.error(`Breach search error: ${error.message}`);
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
            console.error(`Professional search error: ${error.message}`);
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
    return await formatWithGemini(results);
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
async function captureAdvancedInfo(url, retries = 2) {
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
            await page.setUserAgent(userAgents[0]);
            await page.setViewport({ width: 1366, height: 768 });

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

            const formattedData = await formatWithGemini({
                ...basicInfo,
                ...advancedInfo,
                screenshot: `data:image/png;base64,${screenshot}`,
                captured_at: new Date().toISOString(),
                capture_method: 'advanced'
            });

            return formattedData;

        } catch (puppeteerError) {
            console.error(`Puppeteer error during capture: ${puppeteerError.message}`);
            return await formatWithGemini({
                ...basicInfo,
                captured_at: new Date().toISOString(),
                capture_method: 'basic'
            });
        }

    } catch (error) {
        if (retries > 0) {
            await sleep(5000);
            return captureAdvancedInfo(url, retries - 1);
        }
        console.error(`Capture error: ${error.message}`);
        return await formatWithGemini({
            url,
            error: error.message,
            captured_at: new Date().toISOString(),
            capture_method: 'failed'
        });
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

app.post('/api/cross-platform-search', async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    try {
        const results = await searchCrossPlatform(username);
        res.json({
            success: true,
            username,
            count: results.total_results,
            results: results.results
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Cross-platform search failed', 
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

        const formattedResults = await formatWithGemini({
            query,
            sources_used: sources,
            total: results.length,
            results
        });

        res.json({
            success: true,
            ...formattedResults
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

        const formattedInvestigations = await formatWithGemini({
            batch_id: uuidv4(),
            total_investigated: investigations.length,
            summary: {
                total_results: investigations.reduce((sum, inv) => sum + inv.total_results, 0),
                avg_results_per_user: Math.round(investigations.reduce((sum, inv) => sum + inv.total_results, 0) / investigations.length)
            },
            investigations
        });

        res.json({
            success: true,
            ...formattedInvestigations
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
            'Cross-Platform Account Discovery',
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
            'Gemini AI Data Formatting'
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
