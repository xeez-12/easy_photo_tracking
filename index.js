const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
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

// Discord Token (REGENERATE THIS AND MOVE TO ENV IN PRODUCTION)
const DISCORD_TOKEN = 'MTMxMzMwMjY3NzgyMzgxNTc1MQ.GK_Azd.dNfw2K8tRNcC_ca2KT8mkCIenQosapfNrw_HWk'; // Replace with new token

// Advanced user agents
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (iPhone14,2; U; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
];

const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

// Enhanced headers
const getHeaders = () => ({
  'User-Agent': getRandomUserAgent(),
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Referer': 'https://www.google.com/',
  'DNT': '1',
  'TE': 'trailers',
});

const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 10,
  rejectUnauthorized: false,
});

const axiosInstance = axios.create({
  httpsAgent,
  timeout: 20000,
  headers: getHeaders(),
  maxRedirects: 5,
});

async function scrapeTrustedWeb(query) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}+site:*.edu|*.org|*.gov|*.com`;
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);

    const results = [];
    const images = [];

    $('li.b_algo').each((i, elem) => {
      const title = $(elem).find('h2').text().trim().substring(0, 100);
      const link = $(elem).find('a').attr('href');
      const snippet = $(elem).find('.b_caption p').text().trim().substring(0, 200);
      if (title && link && snippet && /\.(edu|org|gov|com)$/.test(new URL(link).hostname)) {
        results.push({ title, link, snippet });
      }
    });

    $('div.b_imagePair img').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src && src.startsWith('http') && /\.(edu|org|gov|com)$/.test(new URL(src).hostname)) {
        images.push(src);
      }
    });

    return { results, images };
  } catch (error) {
    console.error('Trusted web scraping error:', error.message);
    return { results: [], images: [] };
  }
}

async function scrapeSocialMedia(query) {
  try {
    const platforms = ['x.com', 'facebook.com', 'linkedin.com'];
    const socialResults = [];
    const profileImages = [];

    for (const platform of platforms) {
      const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}+site:${platform}`;
      const response = await axiosInstance.get(bingUrl);
      const $ = cheerio.load(response.data);

      $('li.b_algo').each((i, elem) => {
        const title = $(elem).find('h2').text().trim().substring(0, 100);
        const link = $(elem).find('a').attr('href');
        const snippet = $(elem).find('.b_caption p').text().trim().substring(0, 200);
        if (title && link && snippet) {
          socialResults.push({ platform, title, link, snippet });
        }
      });

      $('img').each((i, elem) => {
        const src = $(elem).attr('src');
        if (src && src.includes('/profile/') && src.startsWith('http')) {
          profileImages.push(src);
        }
      });
    }

    // Simple regex for phone and email (ethical limits apply)
    const deepSearchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}+phone+email`;
    const deepResponse = await axiosInstance.get(deepSearchUrl);
    const $deep = cheerio.load(deepResponse.data);
    let phone = null;
    let email = null;
    $deep('p').each((i, elem) => {
      const text = $deep(elem).text().trim();
      const phoneMatch = text.match(/\+?\d{10,15}/);
      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (phoneMatch && !phone) phone = phoneMatch[0];
      if (emailMatch && !email) email = emailMatch[0];
    });

    return { socialResults, profileImages, phone, email };
  } catch (error) {
    console.error('Social media scraping error:', error.message);
    return { socialResults: [], profileImages: [], phone: null, email: null };
  }
}

async function saveImage(url, query, type = 'profile') {
  try {
    const response = await axiosInstance.get(url, { responseType: 'arraybuffer' });
    const imageName = `${query}_${type}_${Date.now()}.jpg`;
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
    .setDescription('Perform a deep OSINT search')
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
    await interaction.deferReply();
    const query = interaction.options.getString('query');

    const embed = new EmbedBuilder()
      .setColor('#1E90FF')
      .setTitle(`🕵️‍♂️ OSINT Intelligence Report: ${query.substring(0, 100)}`)
      .setDescription('Deep search results from trusted sources.')
      .setThumbnail('https://i.imgur.com/7QEm8BX.png') // Default OSINT icon
      .setTimestamp()
      .setFooter({ text: 'Powered by OSINT Bot', iconURL: 'https://i.imgur.com/7QEm8BX.png' });

    const webData = await scrapeTrustedWeb(query);
    if (webData.results.length > 0) {
      embed.addFields({
        name: '🌐 Trusted Web Results',
        value: webData.results.slice(0, 3).map((r, i) => `${i + 1}. [${r.title}](${r.link})\n${r.snippet}`).join('\n\n').substring(0, 1024),
        inline: false,
      });
    }

    const socialData = await scrapeSocialMedia(query);
    if (socialData.socialResults.length > 0) {
      embed.addFields({
        name: '📱 Social Media Mentions',
        value: socialData.socialResults.slice(0, 3).map((r, i) => `${i + 1}. [${r.title}](${r.link}) (${r.platform})\n${r.snippet}`).join('\n\n').substring(0, 1024),
        inline: false,
      });
    }

    if (socialData.profileImages.length > 0) {
      const profileImagePath = await saveImage(socialData.profileImages[0], query, 'profile');
      if (profileImagePath) {
        embed.setAuthor({ name: 'Social Profile', iconURL: `attachment://${path.basename(profileImagePath)}` });
      }
    }

    if (socialData.phone || socialData.email) {
      embed.addFields({
        name: '🔍 Deep Search Findings',
        value: [
          socialData.phone ? `📞 Phone: ${socialData.phone}` : '',
          socialData.email ? `📧 Email: ${socialData.email}` : '',
        ].filter(Boolean).join('\n').substring(0, 1024),
        inline: false,
      });
    }

    const allImages = [...webData.images, ...socialData.profileImages].slice(0, 3);
    const savedImages = await Promise.all(allImages.map(img => saveImage(img, query)));
    const validImages = savedImages.filter(img => img);

    await interaction.editReply({ embeds: [embed] });

    if (validImages.length > 0) {
      const attachments = validImages.map(img => new AttachmentBuilder(img, { name: path.basename(img) }));
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
