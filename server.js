// server.js - Enhanced OSINT Tracker
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const userAgent = require('user-agents');
const cors = require('cors');
const path = require('path');
const sizeOf = require('image-size');
const utils = require('./utils');
const ai = require('./ai');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Enhanced security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', limiter);

const PORT = process.env.PORT || 3000;

// Enhanced proxy and header management
const PROXY_LIST = process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : [];
let currentProxyIndex = 0;

const getNextProxy = () => {
  if (PROXY_LIST.length === 0) return null;
  currentProxyIndex = (currentProxyIndex + 1) % PROXY_LIST.length;
  return {
    protocol: 'http',
    host: PROXY_LIST[currentProxyIndex].split(':')[0],
    port: PROXY_LIST[currentProxyIndex].split(':')[1] || 80
  };
};

// Enhanced user agent generation with device-specific headers
const getRandomHeaders = (reqId) => {
  const deviceTypes = ['desktop', 'mobile', 'tablet'];
  const osTypes = ['Windows', 'Mac OS', 'Linux', 'iOS', 'Android'];
  const browserTypes = ['Chrome', 'Safari', 'Firefox', 'Edge', 'Samsung Browser'];
  
  const randomDevice = deviceTypes[Math.floor(Math.random() * deviceTypes.length)];
  const randomOS = osTypes[Math.floor(Math.random() * osTypes.length)];
  const randomBrowser = browserTypes[Math.floor(Math.random() * browserTypes.length)];

  let ua;
  try {
    ua = new userAgent({
      deviceCategory: randomDevice,
      platform: randomOS,
      browser: randomBrowser
    }).toString();
  } catch (e) {
    const fallbackAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 13; SM-S901U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    ];
    ua = fallbackAgents[Math.floor(Math.random() * fallbackAgents.length)];
  }

  // Device-specific headers
  const headers = {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'X-Request-ID': reqId,
    'X-Forwarded-For': `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    'Referer': 'https://www.google.com/',
    'DNT': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'TE': 'trailers'
  };

  // Add device-specific headers
  if (randomDevice === 'mobile') {
    headers['X-Mobile'] = 'true';
    headers['X-OperaMini-Phone-UA'] = ua;
  } else if (randomDevice === 'tablet') {
    headers['X-Tablet'] = 'true';
  }

  return headers;
};

// Enhanced social media scrapers with mobile support
const socialMediaScrapers = {
    twitter: {
        url: (username) => `https://nitter.net/${username}`,
        parser: ($, username) => {
            try {
                const name = $('.profile-card-fullname').first().text().trim() || 'Unknown';
                const handle = $('.profile-card-username').first().text().trim() || `@${username}`;
                const bio = $('.profile-bio').first().text().trim() || '';
                const location = $('.profile-location').first().text().trim() || '';
                const website = $('.profile-website').first().text().trim() || '';
                const joinDate = $('.profile-joindate').first().text().trim() || '';
                let profileImage = $('.profile-card-avatar').attr('src') || '';
                
                if (profileImage && !profileImage.startsWith('http')) {
                    profileImage = `https:${profileImage}`;
                }
                
                const stats = $('.profile-statlist');
                const tweets = stats.find('li:nth-child(1) span').text().trim() || '0';
                const following = stats.find('li:nth-child(2) span').text().trim() || '0';
                const followers = stats.find('li:nth-child(3) span').text().trim() || '0';
                
                const tweetsList = [];
                $('.timeline-item').each((i, el) => {
                    const tweet = {
                        text: $(el).find('.tweet-content').text().trim() || '',
                        timestamp: $(el).find('.tweet-date a').attr('title') || '',
                        likes: $(el).find('.icon-container:nth-child(3)').text().trim() || '0',
                        retweets: $(el).find('.icon-container:nth-child(2)').text().trim() || '0',
                        replies: $(el).find('.icon-container:nth-child(1)').text().trim() || '0'
                    };
                    tweetsList.push(tweet);
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
                    stats: {
                        tweets,
                        following,
                        followers
                    },
                    tweets: tweetsList.slice(0, 5)
                };
            } catch (e) {
                return null;
            }
        }
    },
    instagram: {
        url: (username) => `https://www.instagram.com/${username}/`,
        parser: ($, username) => {
            try {
                const name = $('meta[property="og:title"]').attr('content') || '';
                const bio = $('meta[property="og:description"]').attr('content') || '';
                let profileImage = $('meta[property="og:image"]').attr('content') || '';
                
                // Fallback for mobile view
                if (!profileImage) {
                    profileImage = $('img[data-testid="user-avatar"]').attr('src') || '';
                }
                
                // Extract stats
                let stats = { followers: '0', following: '0', posts: '0' };
                const statElements = $('header section ul li');
                if (statElements.length >= 3) {
                    stats.posts = statElements.eq(0).find('span').text().trim() || '0';
                    stats.followers = statElements.eq(1).find('span').text().trim() || '0';
                    stats.following = statElements.eq(2).find('span').text().trim() || '0';
                }
                
                const posts = [];
                $('article a[href*="/p/"]').each((i, el) => {
                    const postUrl = $(el).attr('href');
                    const postId = postUrl.split('/p/')[1].replace(/\//g, '');
                    let image = $(el).find('img').attr('src') || '';
                    
                    if (image && !image.startsWith('http')) {
                        image = `https://www.instagram.com${image}`;
                    }
                    
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
                    stats,
                    posts: posts.slice(0, 9)
                };
            } catch (e) {
                return null;
            }
        }
    },
    facebook: {
        url: (username) => `https://www.facebook.com/${username}`,
        parser: ($, username) => {
            try {
                const name = $('meta[property="og:title"]').attr('content') || '';
                const bio = $('meta[property="og:description"]').attr('content') || '';
                let profileImage = $('meta[property="og:image"]').attr('content') || '';
                
                // Extract basic info
                const info = {};
                $('div[data-testid="profile_information"] div').each((i, el) => {
                    const text = $(el).text().trim();
                    if (text.includes('Lives in')) info.location = text.replace('Lives in', '').trim();
                    if (text.includes('From')) info.hometown = text.replace('From', '').trim();
                });
                
                return {
                    platform: 'Facebook',
                    name,
                    bio,
                    profileImage,
                    ...info
                };
            } catch (e) {
                return null;
            }
        }
    }
};

// Enhanced search engine scrapers with AI integration
const searchEngines = {
    bing: {
        url: (query, page = 0) => `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${page * 10 + 1}`,
        parser: ($) => {
            const results = [];
            $('li.b_algo').each((i, el) => {
                try {
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
                    
                    if (title && url && !url.includes('bing.com') && !utils.isBlockedDomain(url)) {
                        // Check if social media
                        const isSocialMedia = utils.SOCIAL_MEDIA_DOMAINS.some(domain => url.includes(domain));
                        
                        results.push({ 
                            title, 
                            url, 
                            snippet,
                            date,
                            image,
                            profile,
                            source: 'Bing',
                            icon: 'search',
                            isSocialMedia
                        });
                    }
                } catch (e) {
                    // Skip this result if error occurs
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
                try {
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
                    
                    if (title && url && !utils.isBlockedDomain(url)) {
                        // Check if social media
                        const isSocialMedia = utils.SOCIAL_MEDIA_DOMAINS.some(domain => url.includes(domain));
                        
                        results.push({ 
                            title, 
                            url: url.startsWith('//') ? `https:${url}` : url,
                            snippet,
                            image,
                            profile,
                            source: 'DuckDuckGo',
                            icon: 'search',
                            isSocialMedia
                        });
                    }
                } catch (e) {
                    // Skip this result if error occurs
                }
            });
            return results;
        }
    },
    google: {
        url: (query, page = 0) => `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${page * 10}`,
        parser: ($) => {
            const results = [];
            $('div.g').each((i, el) => {
                try {
                    const title = $(el).find('h3').text().trim() || 'No title';
                    let url = $(el).find('a').attr('href') || '';
                    
                    // Clean Google tracking URLs
                    if (url.startsWith('/url?q=')) {
                        url = decodeURIComponent(url.split('/url?q=')[1].split('&')[0]);
                    }
                    
                    const snippet = $(el).find('div[data-sncf]').text().trim() || '';
                    
                    // Extract image
                    let image = '';
                    const imgElement = $(el).find('img');
                    if (imgElement.length && imgElement.attr('src')) {
                        image = imgElement.attr('src');
                        if (image.startsWith('//')) {
                            image = 'https:' + image;
                        } else if (image.startsWith('/')) {
                            image = 'https://www.google.com' + image;
                        }
                    }
                    
                    // Extract profile information
                    let profile = null;
                    const profileElement = $(el).find('cite');
                    if (profileElement.length) {
                        const profileUrl = $(el).find('a').attr('href') || '';
                        const profileText = profileElement.text().trim();
                        
                        if (profileText) {
                            profile = utils.extractSocialProfile(profileUrl, title, snippet);
                        }
                    }
                    
                    if (title && url && !url.includes('google.com') && !utils.isBlockedDomain(url)) {
                        // Check if social media
                        const isSocialMedia = utils.SOCIAL_MEDIA_DOMAINS.some(domain => url.includes(domain));
                        
                        results.push({ 
                            title, 
                            url,
                            snippet,
                            image,
                            profile,
                            source: 'Google',
                            icon: 'search',
                            isSocialMedia
                        });
                    }
                } catch (e) {
                    // Skip this result if error occurs
                }
            });
            return results;
        }
    }
};

// Enhanced scraping function with proxy rotation and AI analysis
const scrapeEngine = async (reqId, engine, query) => {
    const results = [];
    let page = 0;
    const maxPages = 3;
    const maxResults = 30;
    
    while (page < maxPages && results.length < maxResults) {
        try {
            const url = searchEngines[engine].url(query, page);
            log(reqId, `Scraping ${engine} page ${page + 1}: ${url}`);
            
            const proxy = getNextProxy();
            const axiosConfig = {
                headers: getRandomHeaders(reqId),
                timeout: 20000,
                validateStatus: () => true
            };
            
            if (proxy) {
                axiosConfig.proxy = proxy;
                log(reqId, `Using proxy: ${proxy.host}:${proxy.port}`);
            }
            
            const response = await axios.get(url, axiosConfig);
            
            // Handle blocking
            if (response.status === 403 || response.status === 429) {
                log(reqId, `Blocked by ${engine} with status ${response.status}`, 'warn');
                break;
            }
            
            const $ = cheerio.load(response.data);
            const pageResults = searchEngines[engine].parser($);
            
            // AI-powered result filtering
            const filteredResults = await ai.filterResults(pageResults, query);
            
            // Add to results if not duplicate
            filteredResults.forEach(result => {
                if (result.url && !results.some(r => r.url === result.url)) {
                    results.push(result);
                }
            });
            
            log(reqId, `Found ${filteredResults.length} filtered results on ${engine} page ${page + 1}`);
            
            // Stop if we have enough results
            if (results.length >= maxResults) break;
            
            page++;
            
            // Random delay between requests
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500));
        } catch (error) {
            log(reqId, `Error scraping ${engine} page ${page + 1}: ${error.message}`, 'error');
            // Add delay before retry
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    
    return results.slice(0, maxResults);
};

// Enhanced social media scraping with AI analysis
const scrapeSocialProfile = async (reqId, platform, username) => {
    try {
        if (!socialMediaScrapers[platform]) {
            return null;
        }
        
        const url = socialMediaScrapers[platform].url(username);
        log(reqId, `Scraping ${platform} profile: ${url}`);
        
        const proxy = getNextProxy();
        const axiosConfig = {
            headers: getRandomHeaders(reqId),
            timeout: 15000,
            validateStatus: () => true
        };
        
        if (proxy) {
            axiosConfig.proxy = proxy;
        }
        
        const response = await axios.get(url, axiosConfig);
        
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
        const profile = socialMediaScrapers[platform].parser($, username);
        
        if (!profile) return null;
        
        // Enhance with AI analysis
        const aiAnalysis = await ai.analyzeProfile(profile);
        profile.aiAnalysis = aiAnalysis;
        
        // Enhance with image dimensions
        if (profile.profileImage) {
            try {
                const imageResponse = await axios.get(profile.profileImage, {
                    responseType: 'arraybuffer',
                    timeout: 10000
                });
                const dimensions = sizeOf(imageResponse.data);
                profile.profileImageDimensions = dimensions;
            } catch (e) {
                // Skip if image fails to load
            }
        }
        
        return profile;
    } catch (error) {
        log(reqId, `Error scraping ${platform} profile: ${error.message}`, 'error');
        return null;
    }
};

// Main search function with AI integration
const performSearch = async (reqId, query) => {
    const results = [];
    
    try {
        // Scrape all engines with independent error handling
        const enginePromises = Object.keys(searchEngines).map(async engine => {
            try {
                return await scrapeEngine(reqId, engine, query);
            } catch (error) {
                log(reqId, `${engine} search failed: ${error.message}`, 'error');
                return [];
            }
        });
        
        const allResults = (await Promise.all(enginePromises)).flat();
        
        // Combine results and deduplicate
        const seenUrls = new Set();
        allResults.forEach(result => {
            if (result.url && !seenUrls.has(result.url)) {
                seenUrls.add(result.url);
                results.push(result);
            }
        });
        
        log(reqId, `Total unique results: ${results.length}`);
        
        // Separate social media and other results
        const socialMediaResults = results.filter(r => r.isSocialMedia);
        const otherResults = results.filter(r => !r.isSocialMedia);
        
        // Sort social media by platform importance
        const platformPriority = {
            'twitter.com': 1,
            'instagram.com': 2,
            'facebook.com': 3,
            'linkedin.com': 4,
            'tiktok.com': 5,
            'youtube.com': 6
        };
        
        socialMediaResults.sort((a, b) => {
            const aPlatform = Object.keys(platformPriority).find(p => a.url.includes(p)) || 'other';
            const bPlatform = Object.keys(platformPriority).find(p => b.url.includes(p)) || 'other';
            
            const aPriority = platformPriority[aPlatform] || 100;
            const bPriority = platformPriority[bPlatform] || 100;
            
            return aPriority - bPriority;
        });
        
        // Combine with social media first
        const finalResults = [...socialMediaResults, ...otherResults];
        
        // Enhance profiles with AI
        const enhancedResults = await Promise.all(finalResults.map(async result => {
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
        
        // AI-powered overall analysis
        const aiInsights = await ai.analyzeResults(enhancedResults, query);
        
        return {
            results: enhancedResults,
            insights: aiInsights
        };
    } catch (error) {
        log(reqId, `Search error: ${error.message}`, 'error');
        return {
            results: [],
            insights: {
                error: 'Search failed',
                message: error.message
            }
        };
    }
};

// API endpoints
app.post('/api/search', async (req, res) => {
    const reqId = req.headers['x-request-id'] || Math.random().toString(36).substring(2, 12);
    const { query } = req.body || {};
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
        return res.status(400).json({ message: 'Query is required' });
    }
    
    try {
        log(reqId, `Processing query: "${query}"`);
        
        const { results, insights } = await performSearch(reqId, query);
        
        res.json({ 
            success: true,
            query,
            results,
            insights,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        log(reqId, `Search error: ${error.message}`, 'error');
        res.status(500).json({ 
            success: false,
            message: 'Search failed', 
            error: error.message
        });
    }
});

// Profile analysis endpoint
app.post('/api/analyze-profile', async (req, res) => {
    const reqId = req.headers['x-request-id'] || Math.random().toString(36).substring(2, 12);
    const { url } = req.body || {};
    
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return res.status(400).json({ message: 'Profile URL is required' });
    }
    
    try {
        log(reqId, `Analyzing profile: ${url}`);
        
        const platform = utils.getPlatformFromUrl(url);
        if (!platform) {
            return res.status(400).json({ message: 'Unsupported platform' });
        }
        
        const username = utils.getUsernameFromUrl(url, platform);
        if (!username) {
            return res.status(400).json({ message: 'Could not extract username from URL' });
        }
        
        const profile = await scrapeSocialProfile(reqId, platform, username);
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        
        res.json({
            success: true,
            profile,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        log(reqId, `Profile analysis error: ${error.message}`, 'error');
        res.status(500).json({ 
            success: false,
            message: 'Profile analysis failed', 
            error: error.message
        });
    }
});

// Logging function with colors and timestamps
const log = (reqId, message, level = 'info') => {
    const timestamp = new Date().toLocaleString('en-US', { 
        timeZone: 'Asia/Jakarta',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const colors = {
        info: '\x1b[36m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
        debug: '\x1b[35m',
        success: '\x1b[32m'
    };
    
    const reset = '\x1b[0m';
    const levelColor = colors[level] || '';
    
    console.log(`${levelColor}[${timestamp}] [${reqId}] [${level.toUpperCase()}] ${message}${reset}`);
};

// Server setup
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
    res.status(404).send('Not found');
});

const server = app.listen(PORT, () => {
    log('SERVER', `Server running on port ${PORT}`, 'success');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    log('SERVER', 'Shutting down gracefully...', 'warn');
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
