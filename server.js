// server.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
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
let browser; // Global browser instance for Puppeteer

// Enhanced headers with rotating user agents
const getRandomHeaders = () => {
    const ua = new userAgent({
        deviceCategory: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
        platform: Math.random() > 0.5 ? 'Win32' : 'Linux x86_64'
    }).toString();

    return {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.google.com/',
        'DNT': '1'
    };
};

// Initialize Puppeteer browser
const initBrowser = async () => {
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920x1080'
            ]
        });
        console.log('Puppeteer browser launched');
    } catch (err) {
        console.error('Error launching browser:', err);
    }
};

// Enhanced social media scrapers
const socialMediaScrapers = {
    twitter: {
        scrape: async (username) => {
            const url = `https://twitter.com/${username}`;
            try {
                const page = await browser.newPage();
                await page.setUserAgent(getRandomHeaders()['User-Agent']);
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                
                const profile = await page.evaluate(() => {
                    const name = document.querySelector('div[data-testid="UserName"]')?.textContent?.trim();
                    const handle = document.querySelector('div[data-testid="UserName"] div:nth-child(2)')?.textContent?.trim();
                    const bio = document.querySelector('div[data-testid="UserDescription"]')?.textContent?.trim();
                    const location = document.querySelector('div[data-testid="UserLocation"]')?.textContent?.trim();
                    const joinDate = document.querySelector('div[data-testid="UserJoinDate"]')?.textContent?.trim();
                    const following = document.querySelector('a[href*="/following"] span')?.textContent?.trim();
                    const followers = document.querySelector('a[href*="/followers"] span')?.textContent?.trim();
                    const profileImage = document.querySelector('img[alt="Opens profile photo"]')?.src;
                    
                    // Get recent tweets
                    const tweets = [];
                    const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
                    tweetElements.forEach(el => {
                        const text = el.querySelector('div[data-testid="tweetText"]')?.textContent?.trim();
                        const likes = el.querySelector('div[data-testid="like"]')?.textContent?.trim();
                        const retweets = el.querySelector('div[data-testid="retweet"]')?.textContent?.trim();
                        const replies = el.querySelector('div[data-testid="reply"]')?.textContent?.trim();
                        const time = el.querySelector('time')?.getAttribute('datetime');
                        
                        if (text) {
                            tweets.push({
                                text,
                                likes: likes || '0',
                                retweets: retweets || '0',
                                replies: replies || '0',
                                timestamp: time || new Date().toISOString()
                            });
                        }
                    });

                    return {
                        name,
                        handle,
                        bio,
                        location,
                        joinDate,
                        stats: {
                            following: following ? parseInt(following.replace(/,/g, '')) : 0,
                            followers: followers ? parseInt(followers.replace(/,/g, '')) : 0,
                        },
                        profileImage,
                        tweets: tweets.slice(0, 5),
                        verified: !!document.querySelector('svg[aria-label="Verified account"]')
                    };
                });

                await page.close();
                return {
                    success: true,
                    profile: {
                        ...profile,
                        platform: 'Twitter',
                        url
                    }
                };
            } catch (err) {
                console.error('Twitter scrape error:', err);
                return { success: false, error: err.message };
            }
        }
    },
    instagram: {
        scrape: async (username) => {
            const url = `https://www.instagram.com/${username}/`;
            try {
                const page = await browser.newPage();
                await page.setUserAgent(getRandomHeaders()['User-Agent']);
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                
                const profile = await page.evaluate(() => {
                    const name = document.querySelector('h1')?.textContent?.trim();
                    const bio = document.querySelector('h1 + div')?.textContent?.trim();
                    const statsElements = document.querySelectorAll('header section ul li');
                    const posts = statsElements[0]?.querySelector('span')?.textContent?.trim();
                    const followers = statsElements[1]?.querySelector('span')?.textContent?.trim();
                    const following = statsElements[2]?.querySelector('span')?.textContent?.trim();
                    const profileImage = document.querySelector('header img')?.src;
                    
                    // Get recent posts
                    const postsElements = document.querySelectorAll('article img');
                    const postsData = Array.from(postsElements).map(img => ({
                        image: img.src
                    })).slice(0, 9);

                    return {
                        name,
                        bio,
                        stats: {
                            posts: posts ? parseInt(posts.replace(/,/g, '')) : 0,
                            followers: followers ? parseInt(followers.replace(/,/g, '')) : 0,
                            following: following ? parseInt(following.replace(/,/g, '')) : 0
                        },
                        profileImage,
                        posts: postsData,
                        verified: !!document.querySelector('svg[aria-label="Verified"]')
                    };
                });

                await page.close();
                return {
                    success: true,
                    profile: {
                        ...profile,
                        platform: 'Instagram',
                        url
                    }
                };
            } catch (err) {
                console.error('Instagram scrape error:', err);
                return { success: false, error: err.message };
            }
        }
    },
    facebook: {
        scrape: async (username) => {
            const url = `https://www.facebook.com/${username}`;
            try {
                const page = await browser.newPage();
                await page.setUserAgent(getRandomHeaders()['User-Agent']);
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                
                const profile = await page.evaluate(() => {
                    const name = document.querySelector('h1')?.textContent?.trim();
                    const bio = document.querySelector('div[data-testid="profile_timeline_intro_card"]')?.textContent?.trim();
                    const profileImage = document.querySelector('img[data-visualcompletion="media-vc-image"]')?.src;
                    
                    return {
                        name,
                        bio,
                        profileImage,
                        verified: !!document.querySelector('img[alt="Verified"]')
                    };
                });

                await page.close();
                return {
                    success: true,
                    profile: {
                        ...profile,
                        platform: 'Facebook',
                        url
                    }
                };
            } catch (err) {
                console.error('Facebook scrape error:', err);
                return { success: false, error: err.message };
            }
        }
    },
    linkedin: {
        scrape: async (username) => {
            const url = `https://www.linkedin.com/in/${username}`;
            try {
                const page = await browser.newPage();
                await page.setUserAgent(getRandomHeaders()['User-Agent']);
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                
                const profile = await page.evaluate(() => {
                    const name = document.querySelector('h1')?.textContent?.trim();
                    const headline = document.querySelector('div.text-body-medium')?.textContent?.trim();
                    const about = document.querySelector('div.pv-shared-text-with-see-more')?.textContent?.trim();
                    const profileImage = document.querySelector('img.pv-top-card-profile-picture__image')?.src;
                    
                    // Get experience
                    const experience = [];
                    const expElements = document.querySelectorAll('section#experience-section ul li');
                    expElements.forEach(el => {
                        const title = el.querySelector('h3')?.textContent?.trim();
                        const company = el.querySelector('p:nth-child(2) span:nth-child(2)')?.textContent?.trim();
                        const duration = el.querySelector('span.date-range span:nth-child(2)')?.textContent?.trim();
                        
                        if (title) {
                            experience.push({
                                title,
                                company,
                                duration
                            });
                        }
                    });

                    return {
                        name,
                        headline,
                        about,
                        profileImage,
                        experience: experience.slice(0, 3)
                    };
                });

                await page.close();
                return {
                    success: true,
                    profile: {
                        ...profile,
                        platform: 'LinkedIn',
                        url
                    }
                };
            } catch (err) {
                console.error('LinkedIn scrape error:', err);
                return { success: false, error: err.message };
            }
        }
    }
};

// Enhanced search function with social media focus
const performSearch = async (query) => {
    try {
        // First extract potential usernames from query
        const usernames = utils.extractUsernames(query);
        
        // Check for direct social media URLs
        const socialUrls = utils.getPlatformFromUrl(query) ? [query] : [];
        
        // Combine all targets
        const targets = [...usernames, ...socialUrls];
        
        const results = [];
        
        // Scrape each social media platform for each target
        for (const target of targets) {
            const platform = utils.getPlatformFromUrl(target) || 
                           (target.startsWith('@') ? 
                           target.substring(1).toLowerCase() : 
                           target.toLowerCase());
            
            if (socialMediaScrapers[platform]) {
                const scrapeResult = await socialMediaScrapers[platform].scrape(target);
                if (scrapeResult.success) {
                    results.push({
                        title: `${scrapeResult.profile.name} (${scrapeResult.profile.platform})`,
                        url: scrapeResult.profile.url,
                        snippet: scrapeResult.profile.bio || scrapeResult.profile.headline || '',
                        profile: scrapeResult.profile,
                        source: 'Direct Scrape',
                        isTrusted: true
                    });
                }
            }
        }
        
        // Fallback to search engines if no direct results
        if (results.length === 0) {
            const searchResults = await scrapeSearchEngines(query);
            return searchResults.slice(0, 20);
        }
        
        return results;
    } catch (err) {
        console.error('Search error:', err);
        return [];
    }
};

// Search engine fallback
const scrapeSearchEngines = async (query) => {
    // ... (keep the existing search engine scraping code from your original server.js)
    // This is just a placeholder - you should keep your existing search engine implementation
    // as a fallback when direct social media scraping doesn't find results
    return [];
};

// API endpoints
app.post('/api/search', async (req, res) => {
    const { query } = req.body || {};
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
        return res.status(400).json({ message: 'Query is required' });
    }
    
    try {
        const results = await performSearch(query);
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
        console.error('Search error:', error);
        res.status(500).json({ 
            message: 'Search failed', 
            error: error.message 
        });
    }
});

// Initialize server
const startServer = async () => {
    await initBrowser();
    
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    if (browser) await browser.close();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

startServer();
