const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { generateEnhancedResponse } = require('./Gemini');

const app = express();
app.use(express.json());
app.use(express.static('.'));

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:129.0) Gecko/20100101 Firefox/129.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/110.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getComplexHeaders() {
  const baseHeaders = {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'sec-ch-ua': '"Google Chrome";v="129", "Chromium";v="129", "Not=A?Brand";v="8"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-ch-ua-platform-version': '"15.0.0"',
    'sec-ch-ua-model': ''
  };

  if (Math.random() > 0.5) {
    const referers = [
      'https://www.google.com/',
      'https://www.bing.com/',
      'https://duckduckgo.com/',
      'https://search.yahoo.com/',
      'https://www.startpage.com/'
    ];
    baseHeaders['Referer'] = referers[Math.floor(Math.random() * referers.length)];
  }

  return baseHeaders;
}

async function makeRequest(url, timeout = 20000) {
  const delay = Math.floor(Math.random() * 2500) + 1000;
  await new Promise(resolve => setTimeout(resolve, delay));

  const config = {
    headers: getComplexHeaders(),
    timeout,
    maxRedirects: 10,
    validateStatus: status => status >= 200 && status < 400,
    decompress: true,
    maxContentLength: 200 * 1024 * 1024,
    maxBodyLength: 200 * 1024 * 1024,
  };

  try {
    const response = await axios.get(url, config);
    return response.data;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    throw new Error(`Failed to scrape ${url}`);
  }
}

const PLATFORM_DOMAINS = {
  instagram: 'instagram.com',
  tiktok: 'tiktok.com',
  facebook: 'facebook.com',
  youtube: 'youtube.com',
  telegram: 't.me',
  x: 'x.com',
  spotify: 'spotify.com'
};

function extractPlatformFromQuery(query) {
  const platformMatch = query.match(/(instagram|tiktok|facebook|youtube|telegram|x|spotify)/i);
  return platformMatch ? platformMatch[0].toLowerCase() : null;
}

async function scrapeBing(query, deepSearch = true) {
  const platform = extractPlatformFromQuery(query);
  const usernameQuery = query.toLowerCase().replace('@', '').split(' ')[1] || query.toLowerCase().replace('@', '');
  const searchQuery = platform ? `${usernameQuery} site:${PLATFORM_DOMAINS[platform]}` : usernameQuery;
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}&count=${deepSearch ? 200 : 50}`;

  try {
    const html = await makeRequest(searchUrl);
    const $ = cheerio.load(html);

    const firstResult = $('.b_algo').first();
    const title = firstResult.find('h2 a').text().trim() || 'hasil pencarian bing';
    const snippet = firstResult.find('.b_caption p').text().trim() || `informasi tentang "${query}" dari bing`;

    const images = [];
    $('.iusc').each((_, element) => {
      const mAttribute = $(element).attr('m');
      if (mAttribute) {
        try {
          const data = JSON.parse(mAttribute);
          if (data.murl) images.push(data.murl);
        } catch (e) {}
      }
    });

    $('img').each((_, img) => {
      const src = $(img).attr('src') || $(img).attr('data-src');
      if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon')) {
        images.push(src);
      }
    });

    const socialMediaAccounts = [];
    $('.b_algo').each((_, element) => {
      Object.entries(PLATFORM_DOMAINS).forEach(([platformKey, domain]) => {
        const links = $(element).find(`a[href*="${domain}"]`);
        links.each((_, link) => {
          const url = $(link).attr('href');
          if (url) {
            const usernameMatch = url.match(new RegExp(`${domain}/(@?[^/?]+)`)) || url.match(/\/@?([^\/]+)\/?/) || url.match(/@([^\/]+)/);
            const rawUsername = usernameMatch ? usernameMatch[1].split('?')[0] : 'unknown';
            const username = rawUsername ? `@${rawUsername}` : 'unknown';
            if (url.includes(domain)) {
              const textContent = $(link).parent().text().toLowerCase();
              const bioMatch = textContent.match(/bio[:\s]*(.+?)(?=\s*followers|\s*$)/i) || textContent.match(/description[:\s]*(.+?)(?=\s*followers|\s*$)/i);
              const bio = bioMatch ? bioMatch[1].trim() : 'tidak tersedia';
              const followersMatch = textContent.match(/(\d+(?:\.\d+)?[kKmMbB]?)\s*followers/i);
              const followers = followersMatch ? followersMatch[1] : 'tidak tersedia';
              const postsMatch = textContent.match(/(\d+(?:\.\d+)?[kKmMbB]?)\s*posts/i);
              const posts = postsMatch ? postsMatch[1] : 'tidak tersedia';
              const likesMatch = textContent.match(/(\d+(?:\.\d+)?[kKmMbB]?)\s*likes/i);
              const likes = likesMatch ? likesMatch[1] : 'tidak tersedia';
              socialMediaAccounts.push({ username, platform: platformKey, bio, followers, posts, likes, url });
            }
          }
        });
      });
    });

    const uniqueAccounts = [...new Set(socialMediaAccounts.map(acc => acc.username))].map(username => 
      socialMediaAccounts.find(acc => acc.username === username)
    ).slice(0, 5);

    while (uniqueAccounts.length < 5) {
      const placeholderUsername = `@${usernameQuery}${uniqueAccounts.length + 1}`;
      if (!uniqueAccounts.some(acc => acc.username === placeholderUsername)) {
        uniqueAccounts.push({
          username: placeholderUsername,
          platform: platform || 'instagram',
          bio: 'tidak tersedia',
          followers: 'tidak tersedia',
          posts: 'tidak tersedia',
          likes: 'tidak tersedia',
          url: `https://${PLATFORM_DOMAINS[platform || 'instagram']}/${placeholderUsername.replace('@', '')}`
        });
      }
    }

    const metadata = {};
    if (deepSearch) {
      $('.b_algo').each((_, element) => {
        const link = $(element).find('h2 a').attr('href');
        if (link) metadata[link] = $(element).find('.b_caption p').text().trim();
      });
    }

    return {
      title,
      snippet,
      url: searchUrl,
      images: images.slice(0, 8),
      metadata: deepSearch ? metadata : undefined,
      socialMediaAccounts: uniqueAccounts
    };
  } catch (error) {
    console.error('Bing scraping error:', error);
    return {
      title: 'bing search results',
      snippet: `mencari "${query}" di bing`,
      url: searchUrl,
      images: [],
      socialMediaAccounts: Array(5).fill(0).map((_, i) => ({
        username: `@${usernameQuery}${i + 1}`,
        platform: platform || 'instagram',
        bio: 'tidak tersedia',
        followers: 'tidak tersedia',
        posts: 'tidak tersedia',
        likes: 'tidak tersedia',
        url: `https://${PLATFORM_DOMAINS[platform || 'instagram']}/${usernameQuery}${i + 1}`
      }))
    };
  }
}

async function scrapeDuckDuckGo(query, deepSearch = true) {
  const platform = extractPlatformFromQuery(query);
  const usernameQuery = query.toLowerCase().replace('@', '').split(' ')[1] || query.toLowerCase().replace('@', '');
  const searchQuery = platform ? `${usernameQuery} site:${PLATFORM_DOMAINS[platform]}` : usernameQuery;
  const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}&s=${deepSearch ? 200 : 50}`;

  try {
    const html = await makeRequest(searchUrl);
    const $ = cheerio.load(html);

    const firstResult = $('.result').first();
    const title = firstResult.find('.result__title a').text().trim() || 'hasil pencarian duckduckgo';
    const snippet = firstResult.find('.result__snippet').text().trim() || `pencarian privat untuk "${query}" dari duckduckgo`;

    const socialMediaAccounts = [];
    $('.result').each((_, element) => {
      Object.entries(PLATFORM_DOMAINS).forEach(([platformKey, domain]) => {
        const links = $(element).find(`a[href*="${domain}"]`);
        links.each((_, link) => {
          const url = $(link).attr('href');
          if (url) {
            const usernameMatch = url.match(new RegExp(`${domain}/(@?[^/?]+)`)) || url.match(/\/@?([^\/]+)\/?/) || url.match(/@([^\/]+)/);
            const rawUsername = usernameMatch ? usernameMatch[1].split('?')[0] : 'unknown';
            const username = rawUsername ? `@${rawUsername}` : 'unknown';
            if (url.includes(domain)) {
              const textContent = $(link).parent().text().toLowerCase();
              const bioMatch = textContent.match(/bio[:\s]*(.+?)(?=\s*followers|\s*$)/i) || textContent.match(/description[:\s]*(.+?)(?=\s*followers|\s*$)/i);
              const bio = bioMatch ? bioMatch[1].trim() : 'tidak tersedia';
              const followersMatch = textContent.match(/(\d+(?:\.\d+)?[kKmMbB]?)\s*followers/i);
              const followers = followersMatch ? followersMatch[1] : 'tidak tersedia';
              const postsMatch = textContent.match(/(\d+(?:\.\d+)?[kKmMbB]?)\s*posts/i);
              const posts = postsMatch ? postsMatch[1] : 'tidak tersedia';
              const likesMatch = textContent.match(/(\d+(?:\.\d+)?[kKmMbB]?)\s*likes/i);
              const likes = likesMatch ? likesMatch[1] : 'tidak tersedia';
              socialMediaAccounts.push({ username, platform: platformKey, bio, followers, posts, likes, url });
            }
          }
        });
      });
    });

    const uniqueAccounts = [...new Set(socialMediaAccounts.map(acc => acc.username))].map(username => 
      socialMediaAccounts.find(acc => acc.username === username)
    ).slice(0, 5);

    while (uniqueAccounts.length < 5) {
      const placeholderUsername = `@${usernameQuery}${uniqueAccounts.length + 1}`;
      if (!uniqueAccounts.some(acc => acc.username === placeholderUsername)) {
        uniqueAccounts.push({
          username: placeholderUsername,
          platform: platform || 'instagram',
          bio: 'tidak tersedia',
          followers: 'tidak tersedia',
          posts: 'tidak tersedia',
          likes: 'tidak tersedia',
          url: `https://${PLATFORM_DOMAINS[platform || 'instagram']}/${placeholderUsername.replace('@', '')}`
        });
      }
    }

    const metadata = {};
    if (deepSearch) {
      $('.result').each((_, element) => {
        const link = $(element).find('.result__title a').attr('href');
        if (link) metadata[link] = $(element).find('.result__snippet').text().trim();
      });
    }

    return {
      title,
      snippet,
      url: searchUrl,
      metadata: deepSearch ? metadata : undefined,
      socialMediaAccounts: uniqueAccounts
    };
  } catch (error) {
    console.error('DuckDuckGo scraping error:', error);
    return {
      title: 'duckduckgo search results',
      snippet: `pencarian privat untuk "${query}"`,
      url: searchUrl,
      socialMediaAccounts: Array(5).fill(0).map((_, i) => ({
        username: `@${usernameQuery}${i + 1}`,
        platform: platform || 'instagram',
        bio: 'tidak tersedia',
        followers: 'tidak tersedia',
        posts: 'tidak tersedia',
        likes: 'tidak tersedia',
        url: `https://${PLATFORM_DOMAINS[platform || 'instagram']}/${usernameQuery}${i + 1}`
      }))
    };
  }
}

async function scrapeImages(query, deepSearch = true) {
  const images = [];

  try {
    const bingImagesUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&FORM=HDRSC2&count=${deepSearch ? 200 : 100}`;
    const html = await makeRequest(bingImagesUrl, 20000);
    const $ = cheerio.load(html);

    $('.imgpt').each((_, element) => {
      const imgElement = $(element).find('img');
      const src = imgElement.attr('src') || imgElement.attr('data-src');
      if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon')) {
        images.push(src);
      Uso
    });

    $('.iusc').each((_, element) => {
      const mAttribute = $(element).attr('m');
      if (mAttribute) {
        try {
          const data = JSON.parse(mAttribute);
          if (data.murl && data.murl.startsWith('http')) images.push(data.murl);
          if (data.turl && data.turl.startsWith('http')) images.push(data.turl);
        } catch (e) {}
      }
    });

    $('img').each((_, img) => {
      const src = $(img).attr('src') || $(img).attr('data-src');
      if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon') && !src.includes('avatar') && src.length > 50) {
        images.push(src);
      }
    });

    const seenImages = {};
    const uniqueImages = [];

    for (const img of images) {
      if (!seenImages[img]) {
        seenImages[img] = true;
        const url = img.toLowerCase();
        if (!url.includes('data:') && !url.includes('base64') && !url.includes('svg') &&
            (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp'))) {
          uniqueImages.push(img);
        }
      }
    }

    if (uniqueImages.length > 0) {
      return uniqueImages.slice(0, deepSearch ? 20 : 12);
    }

    console.log('Bing images failed, trying DuckDuckGo...');
    return await scrapeDuckDuckGoImages(query, deepSearch);
  } catch (error) {
    console.error('Bing image scraping error:', error);
    try {
      return await scrapeDuckDuckGoImages(query, deepSearch);
    } catch (fallbackError) {
      console.error('All image scraping failed:', fallbackError);
      return [];
    }
  }
}

async function scrapeDuckDuckGoImages(query, deepSearch = true) {
  const images = [];

  try {
    const ddgUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images&s=${deepSearch ? 100 : 50}`;
    const html = await makeRequest(ddgUrl, 15000);
    const $ = cheerio.load(html);

    $('img').each((_, img) => {
      const src = $(img).attr('src') || $(img).attr('data-src');
      if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('duckduckgo') && src.length > 30) {
        images.push(src);
      }
    });

    $('script').each((_, script) => {
      const content = $(script).html();
      if (content && content.includes('http') && content.includes('.jpg')) {
        const urlMatches = content.match(/https?:\/\/[^\s"']+\.(jpg|jpeg|png|webp)/gi);
        if (urlMatches) images.push(...urlMatches);
      }
    });

    const seenImages = {};
    const uniqueImages = [];

    for (const img of images) {
      if (!seenImages[img]) {
        seenImages[img] = true;
        const url = img.toLowerCase();
        if (!url.includes('data:') && !url.includes('base64') && (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp'))) {
          uniqueImages.push(img);
        }
      }
    }

    return uniqueImages.slice(0, deepSearch ? 15 : 8);
  } catch (error) {
    console.error('DuckDuckGo image scraping error:', error);
    return [];
  }
}

app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const [bingResult, duckduckgoResult, images] = await Promise.allSettled([
      scrapeBing(query, true),
      scrapeDuckDuckGo(query, true),
      scrapeImages(query, true),
    ]);

    const bing = bingResult.status === 'fulfilled' ? bingResult.value : {
      title: 'bing search',
      snippet: `mencari "${query}" di bing`,
      url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
      socialMediaAccounts: Array(5).fill(0).map((_, i) => ({
        username: `@${query.replace('@', '')}${i + 1}`,
        platform: extractPlatformFromQuery(query) || 'instagram',
        bio: 'tidak tersedia',
        followers: 'tidak tersedia',
        posts: 'tidak tersedia',
        likes: 'tidak tersedia',
        url: `https://${PLATFORM_DOMAINS[extractPlatformFromQuery(query) || 'instagram']}/${query.replace('@', '')}${i + 1}`
      }))
    };

    const duckduckgo = duckduckgoResult.status === 'fulfilled' ? duckduckgoResult.value : {
      title: 'duckduckgo search',
      snippet: `pencarian privat untuk "${query}"`,
      url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      socialMediaAccounts: Array(5).fill(0).map((_, i) => ({
        username: `@${query.replace('@', '')}${i + 1}`,
        platform: extractPlatformFromQuery(query) || 'instagram',
        bio: 'tidak tersedia',
        followers: 'tidak tersedia',
        posts: 'tidak tersedia',
        likes: 'tidak tersedia',
        url: `https://${PLATFORM_DOMAINS[extractPlatformFromQuery(query) || 'instagram']}/${query.replace('@', '')}${i + 1}`
      }))
    };

    const imageUrls = images.status === 'fulfilled' ? images.value : [];

    const scrapedData = { bing, duckduckgo };
    const enhancedResponse = await generateEnhancedResponse(query, scrapedData);

    res.json({
      socialMediaAccounts: [...new Set([...bing.socialMediaAccounts, ...duckduckgo.socialMediaAccounts].map(acc => JSON.stringify(acc)))].map(str => JSON.parse(str)).slice(0, 5),
      images: imageUrls,
      sources: [
        { title: bing.title, url: bing.url, snippet: bing.snippet, metadata: bing.metadata },
        { title: duckduckgo.title, url: duckduckgo.url, snippet: duckduckgo.snippet, metadata: duckduckgo.metadata }
      ],
      enhancedResponse
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});

