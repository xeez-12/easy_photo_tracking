const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const { Agent } = require('https');
const fs = require('fs').promises;
const path = require('path');

// Environment variables (set these in Railway)
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'YOUR_DISCORD_BOT_TOKEN';

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Sophisticated user agent rotation
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
];

// Random user agent selector
const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

// Complex headers for scraping
const getHeaders = () => ({
  'User-Agent': getRandomUserAgent(),
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
});

// HTTPS Agent for connection pooling
const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 10,
  rejectUnauthorized: false,
});

// Axios instance with custom configuration
const axiosInstance = axios.create({
  httpsAgent,
  timeout: 15000,
  headers: getHeaders(),
});

// Function to scrape Bing
async function scrapeBing(query) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);

    const results = [];
    const images = [];

    // Extract text results
    $('li.b_algo').each((i, elem) => {
      const title = $(elem).find('h2').text().trim();
      const link = $(elem).find('a').attr('href');
      const snippet = $(elem).find('.b_caption p').text().trim();
      if (title && link && snippet) {
        results.push({ title, link, snippet });
      }
    });

    // Extract images
    $('div.b_imagePair img').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src && src.startsWith('http')) {
        images.push(src);
      }
    });

    return { results, images };
  } catch (error) {
    console.error('Bing scraping error:', error.message);
    return { results: [], images: [] };
  }
}

// Function to scrape DuckDuckGo
async function scrapeDuckDuckGo(query) {
  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);

    const results = [];
    const images = [];

    // Extract text results
    $('div.result').each((i, elem) => {
      const title = $(elem).find('h2.result__title').text().trim();
      const link = $(elem).find('a.result__url').attr('href');
      const snippet = $(elem).find('div.result__snippet').text().trim();
      if (title && link && snippet) {
        results.push({ title, link, snippet });
      }
    });

    // Extract images (DuckDuckGo image results are limited in HTML version)
    $('img.tile--img__img').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src && src.startsWith('http')) {
        images.push(src);
      }
    });

    return { results, images };
  } catch (error) {
    console.error('DuckDuckGo scraping error:', error.message);
    return { results: [], images: [] };
  }
}

// Function to scrape social media mentions (simplified for X/Twitter-like results)
async function scrapeSocialMedia(query) {
  try {
    const bingResults = await scrapeBing(`${query} site:x.com`);
    const socialResults = bingResults.results.map(result => ({
      platform: 'X',
      title: result.title,
      link: result.link,
      snippet: result.snippet,
    }));
    return socialResults;
  } catch (error) {
    console.error('Social media scraping error:', error.message);
    return [];
  }
}

// Function to download and save an image
async function saveImage(url, query) {
  try {
    const response = await axiosInstance.get(url, { responseType: 'arraybuffer' });
    const imageName = `${query}_${Date.now()}.jpg`;
    const imagePath = path.join(__dirname, 'images', imageName);
    await fs.mkdir(path.join(__dirname, 'images'), { recursive: true });
    await fs.writeFile(imagePath, response.data);
    return imagePath;
  } catch (error) {
    console.error('Image download error:', error.message);
    return null;
  }
}

// Discord bot command handler
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith('!osint')) return;

  const query = message.content.slice(6).trim();
  if (!query) {
    return message.reply('Please provide a search query. Usage: `!osint <query>`');
  }

  // Create intelligence-like embed
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`OSINT Report: ${query}`)
    .setTimestamp()
    .setFooter({ text: 'Generated by OSINT Bot' });

  // Scrape Bing
  const bingData = await scrapeBing(query);
  if (bingData.results.length > 0) {
    embed.addFields({
      name: 'Bing Web Results',
      value: bingData.results
        .slice(0, 3)
        .map((r, i) => `${i + 1}. [${r.title}](${r.link})\n${r.snippet}`)
        .join('\n\n'),
      inline: false,
    });
  }

  // Scrape DuckDuckGo
  const duckData = await scrapeDuckDuckGo(query);
  if (duckData.results.length > 0) {
    embed.addFields({
      name: 'DuckDuckGo Web Results',
      value: duckData.results
        .slice(0, 3)
        .map((r, i) => `${i + 1}. [${r.title}](${r.link})\n${r.snippet}`)
        .join('\n\n'),
      inline: false,
    });
  }

  // Scrape social media
  const socialData = await scrapeSocialMedia(query);
  if (socialData.length > 0) {
    embed.addFields({
      name: 'Social Media Mentions (X)',
      value: socialData
        .slice(0, 3)
        .map((r, i) => `${i + 1}. [${r.title}](${r.link})\n${r.snippet}`)
        .join('\n\n'),
      inline: false,
    });
  }

  // Handle images
  const allImages = [...bingData.images, ...duckData.images].slice(0, 3);
  const savedImages = await Promise.all(allImages.map(img => saveImage(img, query)));
  const validImages = savedImages.filter(img => img);

  if (validImages.length > 0) {
    embed.addFields({
      name: 'Related Images',
      value: 'Images have been retrieved and stored. Check the bot’s server for details.',
      inline: false,
    });
    // Note: Discord.js v14 doesn't support direct image uploads in embeds easily.
    // For Railway, images are saved locally and can be accessed via file system.
  }

  // Send the embed
  await message.reply({ embeds: [embed] });

  // Send images as attachments if any
  if (validImages.length > 0) {
    const attachments = validImages.map(img => ({
      attachment: img,
      name: path.basename(img),
    }));
    await message.reply({ files: attachments });
  }
});

// Bot ready event
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Login to Discord
client.login(DISCORD_TOKEN);

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Railway-specific configuration
const port = process.env.PORT || 3000;
require('http').createServer((req, res) => {
  res.writeHead(200);
  res.end('OSINT Bot is running');
}).listen(port, () => {
  console.log(`Server running on port ${port}`);
});
