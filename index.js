const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const { exec } = require('child_process');
const dns = require('dns').promises;
const whois = require('whois-json');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files (index.html)

// Rate limiter
const rateLimiter = new RateLimiterMemory({ points: 10, duration: 60 });

// Ping command
app.get('/api/ping', async (req, res) => {
    try {
        await rateLimiter.consume(req.ip);
        const ip = req.query.ip;
        if (!ip) return res.status(400).json({ error: 'IP is required' });

        exec(`ping -c 10 ${ip}`, (error, stdout, stderr) => {
            if (error) return res.status(500).json({ error: `Ping failed: ${error.message}` });
            res.json({ result: stdout });
        });
    } catch (error) {
        res.status(500).json({ error: `Failed to process ping: ${error.message}` });
    }
});

// WHOIS lookup
app.get('/api/whois', async (req, res) => {
    try {
        await rateLimiter.consume(req.ip);
        const domain = req.query.domain;
        if (!domain) return res.status(400).json({ error: 'Domain is required' });

        const results = await whois(domain);
        const result = `Registrar: ${results.registrar || 'N/A'}\nCreated: ${results.creationDate || 'N/A'}\nExpires: ${results.expiryDate || 'N/A'}`;
        res.json({ result });
    } catch (error) {
        res.status(500).json({ error: `Failed to fetch WHOIS: ${error.message}` });
    }
});

// DNS lookup
app.get('/api/dns', async (req, res) => {
    try {
        await rateLimiter.consume(req.ip);
        const domain = req.query.domain;
        if (!domain) return res.status(400).json({ error: 'Domain is required' });

        const records = await dns.resolveAny(domain);
        const result = records.map(r => `${r.type}: ${r.value || r.address || r.entries.join(', ')}`).join('\n');
        res.json({ result });
    } catch (error) {
        res.status(500).json({ error: `Failed to fetch DNS: ${error.message}` });
    }
});

// Scrape web data
app.get('/api/scrape', async (req, res) => {
    try {
        await rateLimiter.consume(req.ip);
        const url = req.query.url;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 10000
        });
        const $ = cheerio.load(data);
        const title = $('title').text();
        const links = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href) links.push(href);
        });

        res.json({ title, links: links.slice(0, 10) });
    } catch (error) {
        res.status(500).json({ error: `Failed to scrape: ${error.message}` });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
