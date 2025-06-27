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

// Enhanced header configuration with rotating user agents
const getRandomHeaders = (reqId) => {
    const ua = new userAgent({
        deviceCategory: 'desktop',
        platform: Math.random() > 0.5 ? 'Win32' : 'Linux x86_64',
        browserName: Math.random() > 0.7 ? 'chrome' : (Math.random() > 0.5 ? 'firefox' : 'safari')
    }).toString();
    
    return {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        'TE': 'Trailers',
        'X-Request-ID': reqId,
        'X-Forwarded-For': `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        'Referer': `https://www.google.com/`,
        'DNT': '1',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Cookie': `session_id=${Math.random().toString(36).substring(2)}`
    };
};

// Search engine scrapers with enhanced bypass techniques
const searchEngines = {
    bing: {
        url: (query, page = 0) => `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${page * 10 + 1}&count=10`,
        parser: ($) => {
            const results = [];
            $('li.b_algo').each((i, el) => {
                const title = $(el).find('h2')?.text()?.trim() || 'No title';
                const url = $(el).find('a')?.attr('href') || '';
                const snippet = $(el).find('.b_caption p')?.text()?.trim() || '';
                const dateElement = $(el).find('.news_dt, .news_dt+span');
                const date = dateElement.length ? dateElement.text().trim() : '';
                
                if (title && url && !url.includes('bing.com')) {
                    results.push({ 
                        title, 
                        url, 
                        snippet,
                        date,
                        source: 'Bing',
                        icon: 'search'
                    });
                }
            });
            return results;
        }
    },
    duckduckgo: {
        url: (query, page = 0) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${page * 30}&dc=${page + 1}`,
        parser: ($) => {
            const results = [];
            $('.result').each((i, el) => {
                const linkElement = $(el).find('.result__a');
                const title = linkElement?.text()?.trim() || 'No title';
                let url = linkElement?.attr('href') || '';
                
                // Fix for DuckDuckGo URL parsing
                if (url.startsWith('/url?')) {
                    try {
                        const urlParams = new URLSearchParams(url.split('?')[1]);
                        url = urlParams.get('q') || '';
                    } catch (e) {
                        // Fallback to original URL if parsing fails
                    }
                }
                
                const snippet = $(el).find('.result__snippet')?.text()?.trim() || '';
                const dateElement = $(el).find('.result__timestamp');
                const date = dateElement.length ? dateElement.text().trim() : '';
                
                if (title && url) {
                    results.push({ 
                        title, 
                        url: url.startsWith('//') ? `https:${url}` : url,
                        snippet,
                        date,
                        source: 'DuckDuckGo',
                        icon: 'search'
                    });
                }
            });
            return results;
        }
    }
};

// Enhanced scraping function with retries and pagination
const scrapeEngine = async (reqId, engine, query) => {
    const results = [];
    let page = 0;
    const maxPages = 5;  // Increased from 3 to 5 for deeper search
    const maxResults = 100;
    
    while (page < maxPages && results.length < maxResults) {
        let attempt = 0;
        const maxAttempts = 2;
        let success = false;
        
        while (attempt < maxAttempts && !success) {
            try {
                const url = searchEngines[engine].url(query, page);
                log(reqId, `Scraping ${engine} page ${page + 1}: ${url}`);
                
                const response = await axios.get(url, {
                    headers: getRandomHeaders(reqId),
                    timeout: 20000,  // Increased timeout
                    maxRedirects: 5,
                    proxy: process.env.PROXY_URL ? {
                        protocol: 'http',
                        host: process.env.PROXY_HOST,
                        port: process.env.PROXY_PORT,
                        auth: {
                            username: process.env.PROXY_USER,
                            password: process.env.PROXY_PASS
                        }
                    } : undefined
                });
                
                const $ = cheerio.load(response.data);
                const pageResults = searchEngines[engine].parser($);
                
                // Filter out duplicates
                pageResults.forEach(result => {
                    if (!results.some(r => r.url === result.url)) {
                        results.push(result);
                    }
                });
                
                log(reqId, `Found ${pageResults.length} results on ${engine} page ${page + 1}`);
                success = true;
                
            } catch (error) {
                attempt++;
                log(reqId, `Attempt ${attempt} failed for ${engine} page ${page + 1}: ${error.message}`, 'error');
                if (attempt >= maxAttempts) {
                    log(reqId, `Giving up on ${engine} page ${page + 1} after ${maxAttempts} attempts`, 'warn');
                    break;
                }
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            }
        }
        
        // Stop if we have enough results
        if (results.length >= maxResults) break;
        
        page++;
        
        // Random delay between requests
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 1500) + 500));
    }
    
    return results.slice(0, maxResults);
};

// Enhanced AI analysis with social media detection
const generateInsights = (results) => {
    const insights = {};
    
    // Basic analysis
    insights.summary = `Found ${results.length} relevant results across multiple sources.`;
    
    // Social media detection
    const socialMediaKeywords = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'];
    const socialMediaResults = results.filter(result => 
        socialMediaKeywords.some(keyword => 
            result.url.toLowerCase().includes(keyword) ||
            result.title.toLowerCase().includes(keyword)
        )
    );
    
    if (socialMediaResults.length > 0) {
        insights.keyFindings = `Found ${socialMediaResults.length} social media references`;
    } else {
        insights.keyFindings = 'No significant social media presence detected';
    }
    
    // Risk assessment
    const riskKeywords = ['breach', 'leak', 'hack', 'scam', 'fraud', 'exposed', 'compromise'];
    const hasRisk = results.some(result => 
        riskKeywords.some(keyword => 
            (result.title + result.snippet).toLowerCase().includes(keyword)
        )
    );
    
    insights.riskLevel = hasRisk ? 'High (Sensitive content detected)' : 'Low';
    
    // Recommendations
    insights.recommendations = 'Verify all sources and cross-reference information';
    
    if (socialMediaResults.length > 0) {
        insights.recommendations += '. Consider investigating social media profiles';
    }
    
    if (hasRisk) {
        insights.recommendations += '. Sensitive content found - proceed with caution';
    }
    
    // Add deep search insights
    const deepSearchKeywords = ['database', 'archive', 'leak', 'breach', 'repository'];
    const hasDeepSearchResults = results.some(result => 
        deepSearchKeywords.some(keyword => 
            (result.title + result.snippet).toLowerCase().includes(keyword)
        )
    );
    
    if (hasDeepSearchResults) {
        insights.keyFindings += '. Potential deep web references detected';
        insights.recommendations += '. Deep web sources may require specialized tools';
    }
    
    return insights;
};

// Main search function
const performSearch = async (reqId, query) => {
    const results = [];
    
    try {
        // Scrape both engines in parallel
        const [bingResults, duckduckgoResults] = await Promise.allSettled([
            scrapeEngine(reqId, 'bing', query),
            scrapeEngine(reqId, 'duckduckgo', query)
        ]);
        
        // Process results
        const bing = bingResults.status === 'fulfilled' ? bingResults.value : [];
        const duckduckgo = duckduckgoResults.status === 'fulfilled' ? duckduckgoResults.value : [];
        
        // Combine results and deduplicate
        const allResults = [...bing, ...duckduckgo];
        const seenUrls = new Set();
        
        allResults.forEach(result => {
            if (!seenUrls.has(result.url)) {
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
        const insights = generateInsights(results);
        
        res.json({ 
            results,
            insights
        });
    } catch (error) {
        log(reqId, `Search error: ${error.message}`, 'error');
        res.status(500).json({ 
            message: 'Search failed', 
            error: error.message 
        });
    }
});

// Logging function
const log = (reqId, message, level = 'info') => {
    const timestamp = new Date().toLocaleString('en-US', { 
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
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

