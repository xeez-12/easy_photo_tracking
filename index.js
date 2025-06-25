const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const { Agent } = require('https');
const fs = require('fs').promises;
const path = require('path');

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Discord Token (REGENERATE THIS IMMEDIATELY AND REPLACE BELOW)
const DISCORD_TOKEN = 'MTMxMzMwMjY3NzgyMzgxNTc1MQ.GK_Azd.dNfw2K8tRNcC_ca2KT8mkCIenQosapfNrw_HWk'; // Replace with new token

// Sophisticated user agents
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
];

const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

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

const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 10,
  rejectUnauthorized: false,
});

const axiosInstance = axios.create({
  httpsAgent,
  timeout: 15000,
  headers: getHeaders(),
});

async function scrapeBing(query) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);

    const results = [];
    const images = [];

    $('li.b_algo').each((i, elem) => {
      const title = $(elem).find('h2').text().trim().substring(0, 256); // Limit title length
      const link = $(elem).find('a').attr('href');
      const snippet = $(elem).find('.b_caption p').text().trim().substring(0, 1024); // Limit snippet length
      if (title && link && snippet) {
        results.push({ title, link, snippet });
      }
    });

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

async function scrapeDuckDuckGo(query) {
  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);

    const results = [];
    const images = [];

    $('div.result').each((i, elem) => {
      const title = $(elem).find('h2.result__title').text().trim().substring(0, 256);
      const link = $(elem).find('a.result__url').attr('href');
      const snippet = $(elem).find('div.result__snippet').text().trim().substring(0, 1024);
      if (title && link && snippet) {
        results.push({ title, link, snippet });
      }
    });

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

// Register slash command
const commands = [
  new SlashCommandBuilder()
    .setName('osint')
    .setDescription('Perform an OSINT search')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('The search query')
        .setRequired(true))
    .toJSON(),
];

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    await client.application.commands.set(commands);
    console.log('Slash commands registered');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'osint') {
    await interaction.deferReply(); // Defer reply for long-running tasks
    const query = interaction.options.getString('query');

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`OSINT Report: ${query.substring(0, 256)}`)
      .setTimestamp()
      .setFooter({ text: 'Generated by OSINT Bot' });

    const bingData = await scrapeBing(query);
    if (bingData.results.length > 0) {
      embed.addFields({
        name: 'Bing Web Results',
        value: bingData.results.slice(0, 3).map((r, i) => `${i + 1}. [${r.title}](${r.link})\n${r.snippet.substring(0, 1024)}`).join('\n\n').substring(0, 1024),
        inline: false,
      });
    }

    const duckData = await scrapeDuckDuckGo(query);
    if (duckData.results.length > 0) {
      embed.addFields({
        name: 'DuckDuckGo Web Results',
        value: duckData.results.slice(0, 3).map((r, i) => `${i + 1}. [${r.title}](${r.link})\n${r.snippet.substring(0, 1024)}`).join('\n\n').substring(0, 1024),
        inline: false,
      });
    }

    const socialData = await scrapeSocialMedia(query);
    if (socialData.length > 0) {
      embed.addFields({
        name: 'Social Media Mentions (X)',
        value: socialData.slice(0, 3).map((r, i) => `${i + 1}. [${r.title}](${r.link})\n${r.snippet.substring(0, 1024)}`).join('\n\n').substring(0, 1024),
        inline: false,
      });
    }

    const allImages = [...bingData.images, ...duckData.images].slice(0, 3);
    const savedImages = await Promise.all(allImages.map(img => saveImage(img, query)));
    const validImages = savedImages.filter(img => img);

    if (validImages.length > 0) {
      embed.addFields({
        name: 'Related Images',
        value: 'Images have been retrieved and stored. Check the bot’s server for details.',
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });

    if (validImages.length > 0) {
      const attachments = validImages.map(img => ({
        attachment: img,
        name: path.basename(img),
      }));
      await interaction.followUp({ files: attachments });
    }
  }
});

// Railway HTTP server
const port = process.env.PORT || 3000;
require('http').createServer((req, res) => {
  res.writeHead(200);
  res.end('OSINT Bot is running');
}).listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

client.login(DISCORD_TOKEN);
