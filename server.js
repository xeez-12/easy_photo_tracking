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

// Expanded User Agent Pool
const userAgentPool = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/605.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
];

// Enhanced Headers Configuration
const getAdvancedHeaders = (referer = null, isXHR = false) => {
    const userAgent = userAgentPool[Math.floor(Math.random() * userAgentPool.length)];
    return {
        'User-Agent': userAgent,
        'Accept': isXHR ? 'application/json, text/plain, */*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': isXHR ? 'empty' : 'document',
        'Sec-Fetch-Mode': isXHR ? 'cors' : 'navigate',
        'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
        'Cache-Control': 'max-age=0',
        'Referer': referer || 'https://www.google.com/',
        'Origin': referer ? new URL(referer).origin : 'https://www.google.com'
    };
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
    setTimeout(resolve, ms + Math.floor(Math.random() * 1000))
);

// Gemini AI Integration
async function enhanceWithGemini(content, context) {
    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Analyze and summarize this social media content for relevant user information: ${content.substring(0, 4000)}`
                    }]
                }]
            })
        });
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
        console.error('Gemini AI Error:', error.message);
        return '';
    }
}

// Advanced Social Media Scraping
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

            const platformSelectors = {
                tiktok: {
                    bio: '[data-testid="user-bio"]',
                    followers: '[data-testid="user-followers"] strong',
                    posts: '[data-testid="user-videos"] strong'
                },
                instagram: {
                    bio: '._aa_y div div span',
                    followers: 'a[href*="/followers/"] span',
                    posts: 'span._ac2a'
                },
                twitter: {
                    bio: '[data-testid="UserDescription"]',
                    followers: '[data-testid="followers"] span',
                    posts: '[data-testid="tweet"]'
                },
                facebook: {
                    bio: 'div.x1heor9g div.x1iorvi4 span',
                    followers: 'span.x1e558r4',
                    posts: 'div.x1n2onr6 div.x1yztbdb'
                },
                youtube: {
                    bio: '#description.ytd-channel-about-metadata-renderer',
                    followers: '#subscriber-count',
                    posts: 'ytd-grid-video-renderer'
                },
                linkedin: {
                    bio: '.pv-about-section .pv-about__summary-text',
                    followers: '.follower-count',
                    posts: '.share-box-feed-entry'
                },
                github: {
                    bio: '.p-bio',
                    followers: 'a[href*="/followers"] .text-bold',
                    posts: '.js-repos-container'
                },
                reddit: {
                    bio: '.profile-bio',
                    followers: '.profile-followers',
                    posts: '.Post'
                }
            };

            const selectors = platformSelectors[platform] || {};
            return {
                bio: getText(selectors.bio),
                followers: getText(selectors.followers),
                postCount: document.querySelectorAll(selectors.posts).length || getText(selectors.posts)
            };
        }, platform);

        const pageContent = await page.evaluate(() => document.body.innerText);
        const aiSummary = await enhanceWithGemini(pageContent, `Social media profile analysis for ${platform}`);

        const screenshot = await page.screenshot({ 
            encoding: 'base64',
            fullPage: false,
            clip: { x: 0, y: 0, width: 1366, height: 768 }
        });

        await browser.close();

        return {
            url,
            ...profileData,
            aiSummary,
            screenshot: `data:image/png;base64,${screenshot}`,
            scraped_at: new Date().toISOString(),
            platform
        };
    } catch (error) {
        return { url, error: error.message, scraped_at: new Date().toISOString(), platform };
    } finally {
        if (browser) await browser.close();
    }
}

// Advanced Bing Search
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
            if (error.response?.status === 429) {
                await sleep(10000);
                continue;
            }
            break;
        }
    }

    return allResults;
}

// Enhanced DuckDuckGo Search
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
                    `q=${encodeURIComponent(query)}&b=&kl=id-id&df=`,
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
                    params: { q: query, kl: 'id-id' },
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

// Advanced Social Media Search
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
            console.error(`Error searching ${platform}:`, error.message);
        }
    }

    return allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.url === result.url)
    );
}

// Phone Number Search (+62 only)
async function searchPhoneNumberAdvanced(phoneNumber, platform) {
    if (!phoneNumber.startsWith('+62')) {
        return [];
    }

    const patterns = socialMediaPatterns[platform] || [`site:${platform}.com "${phoneNumber}"`];
    const allResults = [];

    for (const pattern of patterns) {
        const query = pattern.replace(/{username}/g, phoneNumber);

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
                    const phoneRegex = /\+62\d{9,11}/g;
                    const textContent = profileData.bio || result.snippet || '';
                    const phoneMatch = textContent.match(phoneRegex);
                    const phone = phoneMatch ? phoneMatch[0] : null;
                    allResults.push({ ...result, ...profileData, platform, query, phone });
                }
            }

            await sleep(1500);
        } catch (error) {
            console.error(`Error searching phone on ${platform}:`, error.message);
        }
    }

    return allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.url === result.url)
    );
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
        `${username} contact information`
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
            console.error('General search error:', error.message);
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
            console.error('Email search error:', error.message);
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
            console.error('Breach search error:', error.message);
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
            console.error('Professional search error:', error.message);
        }
    }

    let allText = '';
    Object.values(results).forEach(section => {
        if (Array.isArray(section)) {
            section.forEach(item => {
                if (item.title) allText += ` ${item.title}`;
                if (item.snippet) allText += ` ${item.snippet}`;
                if (item.bio) allText += ` ${item.bio}`;
                if (item.aiSummary) allText += ` ${item.aiSummary}`;
            });
        } else if (typeof section === 'object' && section !== null) {
            Object.values(section).forEach(items => {
                if (Array.isArray(items)) {
                    items.forEach(item => {
                        if (item.title) allText += ` ${item.title}`;
                        if (item.snippet) allText += ` ${item.snippet}`;
                        if (item.bio) allText += ` ${item.bio}`;
                        if (item.aiSummary) allText += ` ${item.aiSummary}`;
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
    const phoneRegex = /\+62\d{9,11}/g;
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
        const pageContent = $('body').text();
        const aiSummary = await enhanceWithGemini(pageContent, `Website content analysis for ${url}`);

        const basicInfo = {
            url,
            title: $('title').text().trim(),
            description: $('meta[name="description"]').attr('content') || '',
            keywords: $('meta[name="keywords"]').attr('content') || '',
            aiSummary,
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
                    links: Array.from(document.links).slice(0, 50).map(link => ({
                        href: link.href,
                        text: link.textContent.trim()
                    })),
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
        if (browser) await browser.close();
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
            investigation: formatResults(investigation)
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
            results: formatResults(results)
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
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
        const results = await searchPhoneNumberAdvanced(phoneNumber, platform);
        res.json({
            success: true,
            platform,
            phoneNumber,
            count: results.length,
            results: formatResults(results)
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
            results: formatResults(results)
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
            capture: formatResults(capture)
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
        for (const username of usernames) {
            const investigation = await performComprehensiveSearch(username);
            investigations.push(formatResults(investigation));
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
            'AI-Powered Scraping',
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
            'Phone Number Search (+62)'
        ],
        supported_platforms: Object.keys(socialMediaPatterns)
    });
});

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './public' });
});

// Format Results for Better Display
function formatResults(data) {
    if (Array.isArray(data)) {
        return data.map(item => ({
            ...item,
            title: item.title ? `<strong>${item.title}</strong>` : '',
            snippet: item.snippet ? `<p style="color: #666; margin: 5px 0;">${item.snippet}</p>` : '',
            bio: item.bio ? `<div style="font-style: italic; color: #333;">${item.bio}</div>` : '',
            aiSummary: item.aiSummary ? `<div style="background: #f5f5f5; padding: 10px; border-radius: 5px;">AI Summary: ${item.aiSummary}</div>` : '',
            url: item.url ? `<a href="${item.url}" style="color: #0066cc; text-decoration: none;">${item.url}</a>` : '',
            phone: item.phone ? `<span style="color: #2e7d32;">${item.phone}</span>` : ''
        }));
    } else if (typeof data === 'object' && data !== null) {
        const formatted = { ...data };
        Object.keys(formatted).forEach(key => {
            if (Array.isArray(formatted[key])) {
                formatted[key] = formatResults(formatted[key]);
            } else if (typeof formatted[key] === 'object' && formatted[key] !== null) {
                formatted[key] = formatResults(formatted[key]);
            }
        });
        return formatted;
    }
    return data;
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`OSINT Investigation Platform running on port ${PORT}`);
});
