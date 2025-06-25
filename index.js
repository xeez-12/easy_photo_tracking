const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const formidable = require('formidable');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const cache = new NodeCache({ stdTTL: 3600 }); // Cache selama 1 jam
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/search', async (req, res) => {
    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
        if (err) {
            return res.status(500).json({ error: 'Error parsing image' });
        }

        const image = files.image[0];
        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        try {
            // Baca file gambar sebagai base64
            const imageData = await fs.readFile(image.filepath, { encoding: 'base64' });
            const cacheKey = Buffer.from(imageData).toString('base64').slice(0, 50); // Gunakan hash singkat sebagai kunci cache

            // Cek cache
            const cachedResult = cache.get(cacheKey);
            if (cachedResult) {
                return res.json(cachedResult);
            }

            // Analisis gambar dengan Gemini API
            const analysisResponse = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    contents: [{
                        parts: [{
                            inlineData: {
                                mimeType: image.mimetype,
                                data: imageData
                            }
                        }, {
                            text: 'Describe this image in detail to help identify similar images.'
                        }]
                    }]
                },
                { headers: { 'Content-Type': 'application/json' } }
            );

            const description = analysisResponse.data.candidates[0].content.parts[0].text;

            // Cari gambar serupa di Bing
            const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
            const searchResponse = await axios.get('https://www.bing.com/images/search', {
                params: { q: description },
                headers: { 'User-Agent': userAgent }
            });

            const $ = cheerio.load(searchResponse.data);
            const images = [];
            $('.iusc').each((i, el) => {
                const imgUrl = $(el).attr('m') ? JSON.parse($(el).attr('m')).turl : null;
                if (imgUrl && images.length < 12) {
                    images.push({
                        url: imgUrl,
                        description: $(el).find('.inflnk').attr('aria-label') || 'Similar Image'
                    });
                }
            });

            // Simpan ke cache
            const result = { images };
            cache.set(cacheKey, result);

            // Hapus file sementara
            await fs.unlink(image.filepath);

            res.json(result);
        } catch (error) {
            console.error('Server error:', error);
            res.status(500).json({ error: 'Failed to process image' });
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
