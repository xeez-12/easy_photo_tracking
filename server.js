const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const userAgent = require('user-agents');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// Fixed user agent generation with robust fallback
const getRandomHeaders = (reqId) => {
    // Generate random device type
    const deviceTypes = ['desktop', 'mobile'];
    const randomDevice = deviceTypes[Math.floor(Math.random() * deviceTypes.length)];
    
    // Generate user agent with fallback
    let ua;
    try {
        ua = new userAgent({ deviceCategory: randomDevice }).toString();
    } catch (e) {
        // Fallback user agents
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

// Enhanced search engine scrapers with profile extraction
const searchEngines = {
    bing: {
        url: (query, page = 0) => `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${page * 10 + 1}`,
        parser: ($) => {
            const results = [];
            $('li.b_algo').each((i, el) => {
                const title = $(el).find('h2').text().trim() || 'No title';
                const url = $(el).find('a').attr('href') || '';
                const snippet = $(el).find('.b_caption p').text().trim() || '';
                const dateElement = $(el).find('.news_dt');
                const date = dateElement.length ? dateElement.text().trim() : '';
                
                // Extract profile information
                let profile = '';
                const profileElement = $(el).find('.b_attribution cite');
                if (profileElement.length) {
                    profile = profileElement.text().trim();
                }
                
                if (title && url && !url.includes('bing.com')) {
                    results.push({ 
                        title, 
                        url, 
                        snippet,
                        date,
                        source: 'Bing',
                        icon: 'search',
                        profile
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
                
                // Improved URL parsing
                if (url.startsWith('/l/?uddg=')) {
                    try {
                        const params = new URLSearchParams(url.split('?')[1]);
                        url = params.get('uddg') ? decodeURIComponent(params.get('uddg')) : url;
                    } catch (e) {
                        // Fallback to original URL
                    }
                }
                
                const snippet = $(el).find('.result__snippet').text().trim() || '';
                
                // Extract profile information
                let profile = '';
                const profileElement = $(el).find('.result__url');
                if (profileElement.length) {
                    profile = profileElement.text().trim();
                }
                
                if (title && url) {
                    results.push({ 
                        title, 
                        url: url.startsWith('//') ? `https:${url}` : url,
                        snippet,
                        source: 'DuckDuckGo',
                        icon: 'search',
                        profile
                    });
                }
            });
            return results;
        }
    }
};

// Enhanced scraping function with robust error handling
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
                validateStatus: () => true // Bypass status code errors
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

// Enhanced AI analysis with profile extraction
const generateInsights = (results) => {
    const insights = {};
    
    // Basic analysis
    insights.summary = `Found ${results.length} relevant results across multiple sources.`;
    
    // Extract profiles
    const profiles = results
        .filter(result => result.profile)
        .map(result => result.profile)
        .filter((value, index, self) => self.indexOf(value) === index);
    
    if (profiles.length > 0) {
        insights.keyFindings = `Identified ${profiles.length} unique profiles: ${profiles.slice(0, 3).join(', ')}${profiles.length > 3 ? '...' : ''}`;
    } else {
        insights.keyFindings = 'No profile information extracted';
    }
    
    // Social media detection
    const socialMediaKeywords = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'];
    const socialMediaResults = results.filter(result => 
        socialMediaKeywords.some(keyword => 
            result.url.toLowerCase().includes(keyword) ||
            result.title.toLowerCase().includes(keyword)
        )
    );
    
    if (socialMediaResults.length > 0) {
        insights.keyFindings += `. Found ${socialMediaResults.length} social media references`;
    }
    
    // Risk assessment
    const riskKeywords = ['breach', 'leak', 'hack', 'scam', 'fraud', 'exposed'];
    const hasRisk = results.some(result => 
        riskKeywords.some(keyword => 
            (result.title + result.snippet).toLowerCase().includes(keyword)
        )
    );
    
    insights.riskLevel = hasRisk ? 'High (Sensitive content detected)' : 'Low';
    
    // Recommendations
    insights.recommendations = 'Verify all sources and cross-reference information';
    
    if (profiles.length > 0) {
        insights.recommendations += '. Analyze extracted profiles for connections';
    }
    
    if (socialMediaResults.length > 0) {
        insights.recommendations += '. Investigate social media references';
    }
    
    if (hasRisk) {
        insights.recommendations += '. Sensitive content found - proceed with caution';
    }
    
    return insights;
};

// Main search function with error resilience
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
    } catch (error) {
        log(reqId, `Search error: ${error.message}`, 'error');
    }
    
    return results.slice(0, 50);
};

// API endpoint with robust error handling
app.post('/api/search', async (req, res) => {
    const reqId = req.headers['x-request-id'] || Math.random().toString(36).substring(2, 12);
    const { query } = req.body || {};
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
        return res.status(400).json({ message: 'Query is required' });
    }
    
    try {
        log(reqId, `Processing query: "${query}"`);
        
        const results = await performSearch(reqId, query);
        const insights = generateInsights(results);
        
        res.json({ 
            results,
            insights
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

