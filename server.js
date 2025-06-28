const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const userAgent = require('user-agents');
const cors = require('cors');
const path = require('path');
const sizeOf = require('image-size');
const utils = require('./utils');
const ai = require('./ai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// Enhanced user agent generation with rotating devices and languages
const getRandomHeaders = (reqId) => {
    const deviceTypes = ['desktop', 'mobile', 'tablet'];
    const languages = ['en-US', 'en-GB', 'en', 'id-ID'];
    const randomDevice = deviceTypes[Math.floor(Math.random() * deviceTypes.length)];
    const randomLang = languages[Math.floor(Math.random() * languages.length)];

    let ua;
    try {
        ua = new userAgent({
            deviceCategory: randomDevice,
            platform: Math.random() > 0.5 ? 'Win32' : 'Linux x86_64',
            userAgent: Math.random() > 0.5 ? 'Chrome' : 'Firefox'
        }).toString();
    } catch (e) {
        const fallbackAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Linux; Android 13; SM-S901U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'
        ];
        ua = fallbackAgents[Math.floor(Math.random() * fallbackAgents.length)];
    }
    
    return {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': randomLang,
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
        'Sec-Fetch-User': '?1',
        'TE': 'trailers'
    };
};

// Trusted domains and sources
const TRUSTED_DOMAINS = [
    'twitter.com', 'facebook.com', 'instagram.com', 'linkedin.com',
    'youtube.com', 'github.com', 'reddit.com', 'medium.com',
    'wikipedia.org', 'nytimes.com', 'bbc.com', 'theguardian.com',
    'reuters.com', 'apnews.com', 'bloomberg.com'
];

// Enhanced search engine scrapers focusing on trusted sources
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
                    
                    // Check if from trusted domain
                    const isTrusted = TRUSTED_DOMAINS.some(domain => url.includes(domain));
                    if (!isTrusted) return;
                    
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
                        results.push({ 
                            title, 
                            url, 
                            snippet,
                            date,
                            image,
                            profile,
                            source: 'Bing',
                            isTrusted
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
                    
                    // Check if from trusted domain
                    const isTrusted = TRUSTED_DOMAINS.some(domain => url.includes(domain));
                    if (!isTrusted) return;
                    
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
                        results.push({ 
                            title, 
                            url: url.startsWith('//') ? `https:${url}` : url,
                            snippet,
                            image,
                            profile,
                            source: 'DuckDuckGo',
                            isTrusted
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

// Enhanced scraping function with trusted sources priority
const scrapeEngine = async (reqId, engine, query) => {
    const results = [];
    let page = 0;
    const maxPages = 2;  // Reduced to avoid blocking
    const maxResults = 20;
    
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
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
        } catch (error) {
            log(reqId, `Error scraping ${engine} page ${page + 1}: ${error.message}`, 'error');
            // Add delay before retry
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    return results.slice(0, maxResults);
};

// Main search function focusing on trusted sources
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
        
        // Sort by trusted sources first
        results.sort((a, b) => (b.isTrusted ? 1 : 0) - (a.isTrusted ? 1 : 0));
        
        return results;
    } catch (error) {
        log(reqId, `Search error: ${error.message}`, 'error');
        return [];
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
