const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const userAgent = require('user-agents');
const cors = require('cors');
const path = require('path');
const utils = require('./utils');
const ai = require('./ai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// Enhanced user agent generation
const getRandomHeaders = (reqId) => {
    const deviceTypes = ['desktop', 'mobile'];
    const randomDevice = deviceTypes[Math.floor(Math.random() * deviceTypes.length)];
    
    let ua;
    try {
        ua = new userAgent({ deviceCategory: randomDevice }).toString();
    } catch (e) {
        const fallbackAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Linux; Android 13; SM-S901U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'
        ];
        ua = fallbackAgents[Math.floor(Math.random() * fallbackAgents.length)];
    }
    
    return {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'X-Request-ID': reqId,
        'X-Forwarded-For': `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        'Referer': `https://www.google.com/`,
        'DNT': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1'
    };
};

// Social media scrapers
const socialMediaScrapers = {
    twitter: {
        url: (username) => `https://twitter.com/${username}`,
        parser: ($, username) => {
            const name = $('div[data-testid="UserName"] div span').first().text().trim();
            const handle = $('div[data-testid="UserName"] div span').eq(1).text().trim();
            const bio = $('div[data-testid="UserDescription"]').text().trim();
            const location = $('div[data-testid="UserLocation"] span').text().trim();
            const website = $('div[data-testid="UserUrl"] a').attr('href') || '';
            const joinDate = $('div[data-testid="UserJoinDate"] span').text().trim();
            const profileImage = $('img[alt="Opens profile photo"]').attr('src') || '';
            
            const tweets = [];
            $('article[data-testid="tweet"]').each((i, el) => {
                const tweet = {
                    id: $(el).attr('data-tweet-id'),
                    text: $(el).find('div[data-testid="tweetText"]').text().trim(),
                    timestamp: $(el).find('time').attr('datetime'),
                    likes: parseInt($(el).find('div[data-testid="like"]').text().replace(/\D/g, '') || 0,
                    retweets: parseInt($(el).find('div[data-testid="retweet"]').text().replace(/\D/g, '') || 0,
                    replies: parseInt($(el).find('div[data-testid="reply"]').text().replace(/\D/g, '') || 0),
                    images: []
                };
                
                $(el).find('img[alt="Image"]').each((i, img) => {
                    const imageUrl = $(img).attr('src');
                    if (imageUrl) tweet.images.push(imageUrl);
                });
                
                tweets.push(tweet);
            });
            
            return {
                platform: 'Twitter',
                name,
                handle,
                bio,
                location,
                website,
                joinDate,
                profileImage,
                tweets: tweets.slice(0, 5)
            };
        }
    },
    instagram: {
        url: (username) => `https://www.instagram.com/${username}/`,
        parser: ($, username) => {
            const name = $('meta[property="og:title"]').attr('content') || '';
            const bio = $('meta[property="og:description"]').attr('content') || '';
            const profileImage = $('meta[property="og:image"]').attr('content') || '';
            
            const posts = [];
            $('article a[href*="/p/"]').each((i, el) => {
                const postUrl = $(el).attr('href');
                const postId = postUrl.split('/p/')[1].replace(/\//g, '');
                const image = $(el).find('img').attr('src') || '';
                
                if (postId && image) {
                    posts.push({
                        id: postId,
                        url: `https://www.instagram.com${postUrl}`,
                        image
                    });
                }
            });
            
            return {
                platform: 'Instagram',
                name,
                bio,
                profileImage,
                posts: posts.slice(0, 9)
            };
        }
    },
    facebook: {
        url: (username) => `https://www.facebook.com/${username}`,
        parser: ($, username) => {
            const name = $('title').text().replace(' - Facebook', '').trim();
            const profileImage = $('meta[property="og:image"]').attr('content') || '';
            
            return {
                platform: 'Facebook',
                name,
                profileImage
            };
        }
    },
    linkedin: {
        url: (username) => `https://www.linkedin.com/in/${username}`,
        parser: ($, username) => {
            const name = $('title').text().split('|')[0].trim();
            const headline = $('.text-heading-xlarge').first().text().trim();
            const location = $('.text-body-small.inline').first().text().trim();
            const profileImage = $('.pv-top-card-profile-picture__image').attr('src') || '';
            
            return {
                platform: 'LinkedIn',
                name,
                headline,
                location,
                profileImage
            };
        }
    },
    tiktok: {
        url: (username) => `https://www.tiktok.com/@${username}`,
        parser: ($, username) => {
            const name = $('h1').first().text().trim();
            const handle = $('h2').first().text().trim();
            const bio = $('h2').eq(1).text().trim();
            const profileImage = $('img[data-e2e="user-avatar"]').attr('src') || '';
            
            return {
                platform: 'TikTok',
                name,
                handle,
                bio,
                profileImage
            };
        }
    }
};

// Enhanced search engine scrapers with social media detection
const searchEngines = {
    bing: {
        url: (query, page = 0) => `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${page * 10 + 1}`,
        parser: ($) => {
            const results = [];
            $('li.b_algo').each((i, el) => {
                const title = $(el).find('h2').text().trim() || 'No title';
                let url = $(el).find('a').attr('href') || '';
                const snippet = $(el).find('.b_caption p').text().trim() || '';
                const dateElement = $(el).find('.news_dt');
                const date = dateElement.length ? dateElement.text().trim() : '';
                
                // Extract image
                let image = '';
                const imgElement = $(el).find('img');
                if (imgElement.length && imgElement.attr('src')) {
                    image = imgElement.attr('src');
                    if (image.startsWith('//')) {
                        image = 'https:' + image;
                    } else if (image.startsWith('/')) {
                        image = 'https://www.bing.com' + image;
                    }
                }
                
                // Extract profile information
                let profile = null;
                const profileElement = $(el).find('.b_attribution cite');
                if (profileElement.length) {
                    const profileUrl = $(el).find('.b_attribution a').attr('href') || '';
                    const profileName = profileElement.text().trim();
                    
                    if (profileName) {
                        profile = utils.extractSocialProfile(profileUrl, title, snippet);
                    }
                }
                
                if (title && url && !url.includes('bing.com')) {
                    results.push({ 
                        title, 
                        url, 
                        snippet,
                        date,
                        image,
                        profile,
                        source: 'Bing',
                        icon: 'search'
                    });
                }
            });
            return results;
        }
    },
    duckduckgo: {
        url: (query, page = 0) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${page * 30}`,
        parser: ($) => {
            const results = [];
            $('.result').each((i, el) => {
                const linkElement = $(el).find('.result__a');
                const title = linkElement.text().trim() || 'No title';
                let url = linkElement.attr('href') || '';
                
                // Fix DuckDuckGo URL parsing
                if (url.startsWith('/l/?uddg=')) {
                    try {
                        const params = new URLSearchParams(url.split('?')[1]);
                        url = params.get('uddg') ? decodeURIComponent(params.get('uddg')) : url;
                    } catch (e) {
                        // Fallback to original URL
                    }
                }
                
                const snippet = $(el).find('.result__snippet').text().trim() || '';
                
                // Extract image
                let image = '';
                const imgElement = $(el).find('img');
                if (imgElement.length && imgElement.attr('src')) {
                    image = imgElement.attr('src');
                    if (image.startsWith('//')) {
                        image = 'https:' + image;
                    }
                }
                
                // Extract profile information
                let profile = null;
                const profileElement = $(el).find('.result__url');
                if (profileElement.length) {
                    const profileUrl = $(el).find('.result__url').attr('href') || '';
                    const profileText = profileElement.text().trim();
                    
                    if (profileText) {
                        profile = utils.extractSocialProfile(profileUrl, title, snippet);
                    }
                }
                
                if (title && url) {
                    results.push({ 
                        title, 
                        url: url.startsWith('//') ? `https:${url}` : url,
                        snippet,
                        image,
                        profile,
                        source: 'DuckDuckGo',
                        icon: 'search'
                    });
                }
            });
            return results;
        }
    }
};

// Scrape social media profile
const scrapeSocialProfile = async (reqId, platform, username) => {
    try {
        if (!socialMediaScrapers[platform]) {
            throw new Error(`Unsupported platform: ${platform}`);
        }
        
        const url = socialMediaScrapers[platform].url(username);
        log(reqId, `Scraping ${platform} profile: ${url}`);
        
        const response = await axios.get(url, {
            headers: getRandomHeaders(reqId),
            timeout: 20000,
            validateStatus: () => true
        });
        
        // Handle blocking
        if (response.status === 403 || response.status === 429) {
            log(reqId, `Blocked by ${platform} with status ${response.status}`, 'warn');
            return null;
        }
        
        // Handle CAPTCHAs
        if (response.data.includes('captcha') || response.data.includes('CAPTCHA')) {
            log(reqId, `CAPTCHA detected on ${platform}`, 'warn');
            return null;
        }
        
        const $ = cheerio.load(response.data);
        return socialMediaScrapers[platform].parser($, username);
    } catch (error) {
        log(reqId, `Error scraping ${platform} profile: ${error.message}`, 'error');
        return null;
    }
};

// Enhanced scraping function
const scrapeEngine = async (reqId, engine, query) => {
    const results = [];
    let page = 0;
    const maxPages = 5;
    const maxResults = 50;
    
    while (page < maxPages && results.length < maxResults) {
        try {
            const url = searchEngines[engine].url(query, page);
            log(reqId, `Scraping ${engine} page ${page + 1}: ${url}`);
            
            const response = await axios.get(url, {
                headers: getRandomHeaders(reqId),
                timeout: 20000,
                validateStatus: () => true
            });
            
            // Handle blocking
            if (response.status === 403 || response.status === 429) {
                log(reqId, `Blocked by ${engine} with status ${response.status}`, 'warn');
                break;
            }
            
            // Handle CAPTCHAs
            if (response.data.includes('captcha') || response.data.includes('CAPTCHA')) {
                log(reqId, `CAPTCHA detected on ${engine} page ${page + 1}`, 'warn');
                break;
            }
            
            const $ = cheerio.load(response.data);
            const pageResults = searchEngines[engine].parser($);
            
            // Filter out duplicates and invalid URLs
            pageResults.forEach(result => {
                if (result.url && 
                    !results.some(r => r.url === result.url) &&
                    result.url.startsWith('http')) {
                    results.push(result);
                }
            });
            
            log(reqId, `Found ${pageResults.length} results on ${engine} page ${page + 1}`);
            
            // Stop if we have enough results
            if (results.length >= maxResults) break;
            
            page++;
            
            // Random delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        } catch (error) {
            log(reqId, `Error scraping ${engine} page ${page + 1}: ${error.message}`, 'error');
            // Add delay before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    return results.slice(0, maxResults);
};

// Main search function
const performSearch = async (reqId, query) => {
    const results = [];
    
    try {
        // Scrape both engines with independent error handling
        let bingResults = [];
        let duckduckgoResults = [];
        
        try {
            bingResults = await scrapeEngine(reqId, 'bing', query);
        } catch (bingError) {
            log(reqId, `Bing search failed: ${bingError.message}`, 'error');
        }
        
        try {
            duckduckgoResults = await scrapeEngine(reqId, 'duckduckgo', query);
        } catch (ddgError) {
            log(reqId, `DuckDuckGo search failed: ${ddgError.message}`, 'error');
        }
        
        // Combine results and deduplicate
        const allResults = [...bingResults, ...duckduckgoResults];
        const seenUrls = new Set();
        
        allResults.forEach(result => {
            if (result.url && !seenUrls.has(result.url)) {
                seenUrls.add(result.url);
                results.push(result);
            }
        });
        
        log(reqId, `Total unique results: ${results.length}`);
        
        // Enhance social media profiles with additional scraping
        const enhancedResults = await Promise.all(results.map(async result => {
            if (result.profile) {
                try {
                    const platform = utils.getPlatformFromUrl(result.profile.url);
                    if (platform) {
                        const username = utils.getUsernameFromUrl(result.profile.url, platform);
                        if (username) {
                            const detailedProfile = await scrapeSocialProfile(reqId, platform, username);
                            if (detailedProfile) {
                                result.profile = {
                                    ...result.profile,
                                    ...detailedProfile
                                };
                            }
                        }
                    }
                } catch (e) {
                    log(reqId, `Error enhancing profile: ${e.message}`, 'error');
                }
            }
            return result;
        }));
        
        return enhancedResults;
    } catch (error) {
        log(reqId, `Search error: ${error.message}`, 'error');
        return results.slice(0, 50);
    }
};

// API endpoint
app.post('/api/search', async (req, res) => {
    const reqId = req.headers['x-request-id'] || Math.random().toString(36).substring(2, 12);
    const { query } = req.body || {};
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
        return res.status(400).json({ message: 'Query is required' });
    }
    
    try {
        log(reqId, `Processing query: "${query}"`);
        
        const results = await performSearch(reqId, query);
        
        // AI analysis
        const insights = ai.analyzeResults(results, query);
        const profileAnalysis = ai.analyzeProfiles(results);
        
        res.json({ 
            results,
            insights: {
                ...insights,
                ...profileAnalysis
            }
        });
    } catch (error) {
        log(reqId, `Search error: ${error.message}`, 'error');
        res.status(500).json({ 
            message: 'Search failed', 
            error: 'Internal server error'
        });
    }
});

// Logging function
const log = (reqId, message, level = 'info') => {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    const colors = {
        info: '\x1b[36m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
        debug: '\x1b[35m'
    };
    const reset = '\x1b[0m';
    console.log(`${colors[level] || ''}[${timestamp}] [${reqId}] [${level.toUpperCase()}] ${message}${reset}`);
};

// Server setup
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
    res.status(404).send('Not found');
});

const server = app.listen(PORT, () => {
    log('SERVER', `Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    log('SERVER', 'Shutting down gracefully...');
    server.close(() => {
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    log('SERVER', `Uncaught Exception: ${err.message}`, 'error');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log('SERVER', `Unhandled Rejection: ${reason}`, 'error');
});
