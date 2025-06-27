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

// Advanced header configuration
const getRandomHeaders = (reqId) => {
    const ua = new userAgent({ deviceCategory: 'desktop' }).toString();
    
    const headers = {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        'TE': 'Trailers',
        'X-Request-ID': reqId,
        'X-Forwarded-For': Array(4).fill().map(() => Math.floor(Math.random() * 255)).join('.'),
        'Referer': `https://www.google.com/search?q=${Math.random().toString(36).substring(7)}`,
        'DNT': '1',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1'
    };

    // Add cookies for specific domains
    if (Math.random() > 0.7) {
        headers['Cookie'] = `session_id=${Math.random().toString(36).substring(2)}; consent=yes`;
    }

    return headers;
};

// Rotating proxy middleware
const proxyMiddleware = (req, res, next) => {
    const proxies = [
        // Free proxy list would go here in production
        // Example: 'http://user:pass@ip:port'
    ];

    if (proxies.length > 0) {
        const proxy = proxies[Math.floor(Math.random() * proxies.length)];
        req.proxyConfig = {
            host: proxy.split('@')[1].split(':')[0],
            port: parseInt(proxy.split(':')[2]),
            auth: {
                username: proxy.split('//')[1].split(':')[0],
                password: proxy.split(':')[1].split('@')[0]
            }
        };
    }
    next();
};

// Enhanced scraping function with platform detection
const scrapePlatform = async (reqId, query, platform) => {
    const results = [];
    const platforms = {
        twitter: {
            url: `https://twitter.com/search?q=${encodeURIComponent(query)}&f=user`,
            selector: 'div[data-testid="UserCell"]',
            parser: ($, el) => {
                const name = $(el).find('div[dir="ltr"] span').first().text().trim();
                const handle = $(el).find('div[dir="ltr"] span:contains("@")').text().trim();
                const bio = $(el).find('div[data-testid="UserBio"]').text().trim();
                const url = `https://twitter.com/${handle}`;
                return { 
                    title: name || 'Twitter User', 
                    url, 
                    description: bio,
                    source: 'Twitter',
                    icon: 'twitter'
                };
            }
        },
        instagram: {
            url: `https://www.instagram.com/web/search/topsearch/?query=${encodeURIComponent(query)}`,
            isAPI: true,
            parser: (data) => {
                return data.users.map(user => ({
                    title: user.user.username,
                    url: `https://instagram.com/${user.user.username}`,
                    description: user.user.full_name,
                    source: 'Instagram',
                    icon: 'instagram',
                    followers: user.user.follower_count
                }));
            }
        },
        linkedin: {
            url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`,
            selector: '.entity-result',
            parser: ($, el) => {
                const name = $(el).find('.entity-result__title-text a').text().trim();
                const title = $(el).find('.entity-result__primary-subtitle').text().trim();
                const url = $(el).find('.entity-result__title-text a').attr('href') || '';
                return { 
                    title: name || 'LinkedIn Profile', 
                    url, 
                    description: title,
                    source: 'LinkedIn',
                    icon: 'linkedin'
                };
            }
        },
        github: {
            url: `https://github.com/search?q=${encodeURIComponent(query)}&type=users`,
            selector: '.user-list-item',
            parser: ($, el) => {
                const name = $(el).find('.f4 a').text().trim();
                const bio = $(el).find('.user-list-bio').text().trim();
                const url = `https://github.com/${name}`;
                return { 
                    title: name || 'GitHub User', 
                    url, 
                    description: bio,
                    source: 'GitHub',
                    icon: 'github'
                };
            }
        },
        facebook: {
            url: `https://www.facebook.com/public/${encodeURIComponent(query)}`,
            selector: 'div._4p2o',
            parser: ($, el) => {
                const name = $(el).find('._2ial > a').text().trim();
                const url = $(el).find('._2ial > a').attr('href') || '';
                const location = $(el).find('._glm').text().trim();
                return { 
                    title: name || 'Facebook Profile', 
                    url, 
                    description: location,
                    source: 'Facebook',
                    icon: 'facebook'
                };
            }
        }
    };

    const config = platforms[platform];
    if (!config) return [];

    try {
        log(reqId, `Scraping ${platform} for: ${query}`);
        
        if (config.isAPI) {
            const response = await axios.get(config.url, {
                headers: getRandomHeaders(reqId),
                timeout: 15000,
                proxy: req.proxyConfig
            });
            return config.parser(response.data);
        }

        const response = await axios.get(config.url, {
            headers: getRandomHeaders(reqId),
            timeout: 15000,
            proxy: req.proxyConfig
        });
        
        const $ = cheerio.load(response.data);
        const items = [];
        
        $(config.selector).each((i, el) => {
            try {
                const result = config.parser($, el);
                if (result) items.push(result);
            } catch (e) {
                log(reqId, `Error parsing ${platform} item: ${e.message}`, 'warn');
            }
        });
        
        log(reqId, `Found ${items.length} results on ${platform}`);
        return items;
    } catch (error) {
        log(reqId, `Error scraping ${platform}: ${error.message}`, 'error');
        return [];
    }
};

// AI-powered analysis function
const generateAnalysis = (results) => {
    const insights = {
        summary: '',
        keyFindings: [],
        recommendations: []
    };

    // Generate summary based on results
    if (results.length === 0) {
        insights.summary = 'No significant digital footprint found for this query.';
        return insights;
    }

    const platforms = [...new Set(results.map(r => r.source))];
    const hasSocialMedia = platforms.some(p => ['Twitter', 'Instagram', 'Facebook'].includes(p));
    const hasProfessional = platforms.some(p => ['LinkedIn', 'GitHub'].includes(p));

    insights.summary = `Found digital presence across ${platforms.length} platforms. `;
    
    if (hasSocialMedia && hasProfessional) {
        insights.summary += 'The subject maintains both professional and social media profiles.';
    } else if (hasProfessional) {
        insights.summary += 'The subject primarily maintains professional profiles.';
    } else if (hasSocialMedia) {
        insights.summary += 'The subject primarily maintains social media profiles.';
    }

    // Key findings
    if (results.some(r => r.source === 'Twitter' && r.description.includes('CEO'))) {
        insights.keyFindings.push('Potential executive position based on Twitter bio');
    }
    
    if (results.some(r => r.source === 'GitHub' && r.description.includes('security'))) {
        insights.keyFindings.push('Shows interest in security based on GitHub activity');
    }
    
    if (results.some(r => r.source === 'LinkedIn' && r.description.includes('Engineer'))) {
        insights.keyFindings.push('Professional engineering background based on LinkedIn profile');
    }

    // Recommendations
    if (results.length > 0) {
        insights.recommendations.push('Review all found profiles for connections and associations');
    }
    
    if (platforms.includes('GitHub')) {
        insights.recommendations.push('Analyze GitHub repositories for technical expertise');
    }
    
    if (!platforms.includes('LinkedIn')) {
        insights.recommendations.push('Consider searching professional networks for additional information');
    }

    return insights;
};

// Main search endpoint
app.post('/api/search', proxyMiddleware, async (req, res) => {
    const reqId = req.headers['x-request-id'] || Math.random().toString(36).substring(2, 12);
    const { query, platforms = [] } = req.body || {};
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
        return res.status(400).json({ message: 'Query is required and must be a non-empty string' });
    }

    try {
        log(reqId, `Processing query: "${query}"`);
        
        // Scrape all requested platforms in parallel
        const scrapePromises = platforms.map(platform => 
            scrapePlatform(reqId, query.trim(), platform)
        );
        
        const results = (await Promise.all(scrapePromises))
            .flat()
            .filter(r => r)
            .slice(0, 25);
        
        // Generate AI insights
        const insights = generateAnalysis(results);
        
        log(reqId, `Found ${results.length} results across ${platforms.length} platforms`);
        res.json({ results, insights });
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
