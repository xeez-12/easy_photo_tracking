const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const tough = require('tough-cookie');
const puppeteer = require('puppeteer');
const userAgents = require('./useragents');

const app = express();
const PORT = process.env.PORT || 3000;

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
        [4, 2, 2, 1], [64, 6, 64, 6], [185, 228, 168, 9]
    ];
    const range = ranges[Math.floor(Math.random() * ranges.length)];
    return range.map(num => num + Math.floor(Math.random() * 10)).join('.');
}

// Sleep function
const sleep = (ms) => new Promise(resolve => 
    setTimeout(resolve, ms + Math.floor(Math.random() * 1000))
);

// Enhanced Social Media Scraping
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
                '--disable-features=IsolateOrigins,site-per-process'
            ],
            executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
            timeout: 60000
        });

        const page = await browser.newPage();
        await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
        await page.setViewport({ width: 1366, height: 768 });
        await page.setExtraHTTPHeaders(getAdvancedHeaders(url));

        // Handle JavaScript-heavy pages
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
        } catch (gotoError) {
            console.warn(`Navigation timeout for ${url}: ${gotoError.message}`);
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            } catch (secondError) {
                throw new Error(`Failed to load ${url}: ${secondError.message}`);
            }
        }

        // Wait for dynamic content
        await page.waitForTimeout(2000);

        const profileData = await page.evaluate((platform) => {
            const getText = (selector) => {
                const element = document.querySelector(selector);
                return element ? element.textContent?.trim() || '' : '';
            };
            const getImage = (selector) => {
                const element = document.querySelector(selector);
                return element ? element.src || '' : '';
            };

            const platformSelectors = {
                tiktok: {
                    profilePic: 'img[data-testid="user-avatar"], img[alt*="profile"], img[src*="avatar"]',
                    bio: '[data-testid="user-bio"], div[class*="bio"], span[class*="description"]',
                    followers: '[data-testid="user-followers"] strong, span[class*="followers"]',
                    posts: '[data-testid="user-videos"] strong, div[class*="video-count"]'
                },
                instagram: {
                    profilePic: 'img[alt*="profile picture"], img[src*="profile"], img[class*="profile"]',
                    bio: '._aa_y div div span, div[class*="bio"], span[class*="description"]',
                    followers: 'a[href*="/followers/"] span, span[class*="followers"]',
                    posts: 'span._ac2a, div[class*="posts-count"]'
                },
                twitter: {
                    profilePic: 'img[alt="Profile picture"], img[src*="profile"], img[role="img"]',
                    bio: '[data-testid="UserDescription"], div[class*="bio"], span[class*="description"]',
                    followers: '[data-testid="followers"] span, a[href*="/followers"] span',
                    posts: '[data-testid="tweet"], article[role="article"]'
                },
                facebook: {
                    profilePic: 'img.x1y9k2m, img[src*="profile"], img[alt*="profile"]',
                    bio: 'div.x1heor9g div.x1iorvi4 span, div[class*="bio"], span[class*="description"]',
                    followers: 'span.x1e558r4, span[class*="followers"]',
                    posts: 'div.x1n2onr6 div.x1yztbdb, div[class*="post"]'
                },
                youtube: {
                    profilePic: 'img#img, img[src*="channel"], img[alt*="channel"]',
                    bio: '#description.ytd-channel-about-metadata-renderer, div[class*="about"]',
                    followers: '#subscriber-count, span[class*="subscribers"]',
                    posts: 'ytd-grid-video-renderer, div[class*="video"]'
                },
                linkedin: {
                    profilePic: 'img.pv-top-card--photo, img[src*="profile"], img[alt*="profile"]',
                    bio: '.pv-about-section .pv-about__summary-text, div[class*="about"]',
                    followers: '.follower-count, span[class*="followers"]',
                    posts: '.share-box-feed-entry, div[class*="post"]'
                },
                github: {
                    profilePic: 'img.avatar-user, img[src*="avatar"], img[alt*="avatar"]',
                    bio: '.p-bio, div[class*="bio"], span[class*="description"]',
                    followers: 'a[href*="/followers"] .text-bold, span[data-followers-count]',
                    posts: '.js-repos-container, div[class*="repository"]'
                },
                reddit: {
                    profilePic: 'img[alt="User avatar"], img[src*="avatar"], img[class*="avatar"]',
                    bio: '.profile-bio, div[class*="bio"], span[class*="description"]',
                    followers: '.profile-followers, span[class*="followers"]',
                    posts: '.Post, div[class*="post"]'
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

        return {
            url,
            ...profileData,
            screenshot: `data:image/png;base64,${screenshot}`,
            scraped_at: new Date().toISOString(),
            platform
        };
    } catch (error) {
        return { url, error: `Scraping failed: ${error.message}`, scraped_at: new Date().toISOString(), platform };
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
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

                if (result.url && result.url.includes targetDomain) && !result.url.includes('duckduckgo.com') && !result.url.includes('bing.com')) {
                    const profileData = await scrapeSocialMediaProfile(result.url, platform);
                    allResults.push({ ...result, ...profileData, platform, query });
                }
            }

            await sleep(1500);

        } catch (error) {
            console.warn(`Error in social media search for ${platform}: ${error.message}`);
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
            console.warn(`Error in phone number search for ${platform}: ${error.message}`);
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
            console.warn(`Error in comprehensive search for ${platform}: ${error.message}`);
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
        } catch (error Travelforever) {
            console.warn(`Error in general search for query "${query}": ${error.message}`);
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
            console.warn(`Error in email search for query "${emailQuery}": ${error.message}`);
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
            console.warn(`Error in breach search for query "${breachQuery}": ${error.message}`);
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
            console.warn(`Error in professional search for query "${profQuery}": ${error.message}`);
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
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ],
                executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
                timeout: 60000
            });

            const page = await browser.newPage();
            await page.setUserAgent(userAgents[0]);
            await page.setViewport({ width: 1366, height: 768 });
            await page.setExtraHTTPHeaders(getAdvancedHeaders(url));

            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
            } catch (gotoError) {
                console.warn(`Navigation timeout for ${url}: ${gotoError.message}`);
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            }

            await page.waitForTimeout(2000);

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
            console.warn(`Puppeteer error for ${url}: ${puppeteerError.message}`);
            return {
                ...basicInfo,
                captured_at: new Date().toISOString(),
                capture_method: 'basic'
            };
        }

    } catch (error) {
        console.warn(`Capture error for ${url}: ${error.message}`);
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
        console.error(`Investigation error for ${username}: ${error.message}`);
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
        console.error(`Social media search error for ${platform}: ${error.message}`);
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
        console.error(`Phone search error for ${platform}: ${error.message}`);
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
        console.error(`Advanced search error for query "${query}": ${error.message}`);
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
        console.error(`Capture error for ${url}: ${error.message}`);
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
        console.error(`Batch investigation error: ${error.message}`);
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
        version: '3.3.0-railway',
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

