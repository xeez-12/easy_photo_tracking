const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// User-Agent rotation (2025-compliant)
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
    'Mozilla/5.0 (Linux; Android 15; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
];

// Randomly select a user-agent
const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

// Complex headers
const headers = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'DNT': '1',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'no-cache',
};

// Gemini API key (hardcoded for simplicity, replace with your key)
const GEMINI_API_KEY = 'AIzaSyBnAFtB1TcTzpkJ1CwxgjSurhhUSVOo9HI'; // Replace with actual key

// Scrape social media platforms
async function scrapePlatform(platform, username) {
    const platforms = {
        instagram: {
            url: `https://www.instagram.com/${username.slice(1)}/`,
            selector: {
                bio: 'h1.x7a9k1c.xd2fa33.x1s688f.x3x7a5n.x1b0d5xa.x6s0dn4.x78zum5.x1r8uery.x1iorvi4.x1s688f.x1vjfegm.x1mzt3pk.x1v7f7x3.x1lcm9me.x1yr5g0i.xrt01vj.x10y3i5r.x1r0g7tt.x1q0g3np.xv55p1a.x1e2slr6.x1s8p6kr.x1f3drcq.x1d9alj2.x1v6e6kh.x1y1aw1k.x1sxyh0.xwib8y2.x1pi30zi.x1swx91k.x1n2onr6.x1v0e8p1.x1pg5gki.x1y0kpm3.x3f7gcn.x1wrg8bm.x1c4vz4f.x1q1anwi.x1t2p2lz.x1v6e6kh.x1d9alj2.x1y1aw1k.x1sxyh0.xwib8y2.x1pi30zi.x1swx91k.x1n2onr6.x1v0e8p1.x1pg5gki.x1y0kpm3.x3f7gcn.x1wrg8bm.x1c4vz4f.x1q1anwi.x1t2p2lz',
                followers: 'span.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.xt0psk2.x1i0vuye.xvs91rp.x1s688f.x5n08af.x10wh9bi.x1wdrske.x8viiok.x18hxmgj',
                posts: 'span.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.xt0psk2.x1i0vuye.xvs91rp.x1s688f.x5n08af.x10wh9bi.x1wdrske.x8viiok.x18hxmgj',
            }
        },
        tiktok: {
            url: `https://www.tiktok.com/@${username.slice(1)}`,
            selector: {
                bio: 'h2.jsx-1386553757',
                followers: 'strong[data-e2e="followers-count"]',
                posts: 'strong[data-e2e="videos-count"]',
            }
        },
        facebook: {
            url: `https://www.facebook.com/${username.slice(1)}`,
            selector: {
                bio: 'div.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.x1vvkbs.x1s688f',
                followers: 'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x1xmvt09.x1lliihq.x1s688f',
                posts: null, // Facebook posts are harder to scrape reliably
            }
        },
        youtube: {
            url: `https://www.youtube.com/@${username.slice(1)}`,
            selector: {
                bio: 'yt-formatted-string#description',
                followers: 'yt-formatted-string#subscriber-count',
                posts: null, // YouTube video count requires dynamic loading
            }
        },
        x: {
            url: `https://x.com/${username.slice(1)}`,
            selector: {
                bio: 'div[data-testid="UserDescription"]',
                followers: 'a[href*="/followers"] span',
                posts: 'div[data-testid="primaryColumn"] div[data-testid="cellInnerDiv"]',
            }
        },
        github: {
            url: `https://github.com/${username.slice(1)}`,
            selector: {
                bio: 'div.p-note.user-profile-bio',
                followers: 'a[href*="/followers"] span',
                posts: 'span.Counter.js-profile-repository-count', // Repositories
            }
        }
    };

    try {
        const config = platforms[platform];
        if (!config) return null;

        const response = await axios.get(config.url, {
            headers: { ...headers, 'User-Agent': getRandomUserAgent() },
            timeout: 10000,
        });
        const $ = cheerio.load(response.data);

        const result = {
            platform: platform.charAt(0).toUpperCase() + platform.slice(1),
            username,
            bio: config.selector.bio ? $(config.selector.bio).text().trim() || 'N/A' : 'N/A',
            followers: config.selector.followers ? $(config.selector.followers).text().trim() || 'N/A' : 'N/A',
            posts: config.selector.posts ? $(config.selector.posts).text().trim() || 'N/A' : 'N/A',
        };

        return result;
    } catch (error) {
        console.error(`Error scraping ${platform}:`, error.message);
        return null;
    }
}

// Query Gemini API
async function queryGemini(content) {
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{ text: `Summarize the following social media profile information in 2-3 sentences: ${content}` }]
                }]
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000,
            }
        );
        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Gemini API error:', error.message);
        return null;
    }
}

// Search endpoint
app.post('/search', async (req, res) => {
    const { username } = req.body;

    if (!username || !username.startsWith('@')) {
        return res.status(400).json({ error: 'Invalid username. Must start with @' });
    }

    try {
        // Scrape multiple platforms concurrently
        const platforms = ['instagram', 'tiktok', 'facebook', 'youtube', 'x', 'github'];
        const scrapePromises = platforms.map(platform => scrapePlatform(platform, username));
        const results = (await Promise.all(scrapePromises)).filter(result => result);

        // Prepare content for Gemini
        const content = results
            .map(r => `Platform: ${r.platform}\nUsername: ${r.username}\nBio: ${r.bio}\nFollowers: ${r.followers}\nPosts: ${r.posts}`)
            .join('\n\n');

        // Query Gemini for summary
        const summary = content ? await queryGemini(content) : null;

        res.json({ results, summary });
    } catch (error) {
        console.error('Search error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
