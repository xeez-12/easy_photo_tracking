const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/scrape', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const $ = cheerio.load(data);
        const title = $('title').text();
        const links = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href) links.push(href);
        });

        res.json({ title, links: links.slice(0, 5) }); // Batasi 5 link untuk demo
    } catch (error) {
        res.status(500).json({ error: 'Failed to scrape: ' + error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
