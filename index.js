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

// Discord Token (REGENERATE AND MOVE TO ENV)
const DISCORD_TOKEN = 'MTMxMzMwMjY3NzgyMzgxNTc1MQ.GK_Azd.dNfw2K8tRNcC_ca2KT8mkCIenQosapfNrw_HWk'; // Replace with new token

// Extensive military-grade user agents
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0 (Military-Grade-Browser/1.0)',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15 (MIL-STD-810G/1.1)',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 (Secure-Agent/2.0)',
  'Mozilla/5.0 (iPhone14,2; U; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 (MIL-OPS/3.0)',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0 (Tactical-Browser/4.0)',
  'Mozilla/5.0 (Android 13; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0 (Field-Unit/5.0)',
];

const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

// Military-grade complex headers
const getHeaders = () => ({
  'User-Agent': getRandomUserAgent(),
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,de;q=0.8,fr;q=0.7',
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
  'X-Forwarded-For': `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`, // Spoof IP
  'X-Requested-With': 'XMLHttpRequest',
  'Authorization': 'Bearer MIL-SEC-TOKEN-2025', // Placeholder, replace with real if needed
  'Cookie': `session_id=${Math.random().toString(36).substring(2, 15)}; secure=true`, // Dynamic session
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

async function scrapeSocialMediaFromEngines(query) {
  try {
    const platforms = ['x.com', 'facebook.com', 'linkedin.com', 'instagram.com', 'twitter.com'];
    const socialResults = [];
    const profileImages = [];
    let phone = null;
    let email = null;

    for (const platform of platforms) {
      // Bing search
      const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}+site:${platform}`;
      const bingResponse = await axiosInstance.get(bingUrl);
      const $bing = cheerio.load(bingResponse.data);

      $bing('li.b_algo').each((i, elem) => {
        const title = $bing(elem).find('h2').text().trim().substring(0, 100);
        const link = $bing(elem).find('a').attr('href');
        const snippet = $bing(elem).find('.b_caption p').text().trim().substring(0, 200);
        if (title && link && snippet) {
          socialResults.push({ platform, title, link, snippet });
        }
      });

      $bing('img').each((i, elem) => {
        const src = $bing(elem).attr('src');
        if (src && src.includes('/profile/') && src.startsWith('http')) {
          profileImages.push(src);
        }
      });

      // DuckDuckGo search
      const duckUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}+site:${platform}`;
      const duckResponse = await axiosInstance.get(duckUrl);
      const $duck = cheerio.load(duckResponse.data);

      $duck('div.result').each((i, elem) => {
        const title = $duck(elem).find('h2.result__title').text().trim().substring(0, 100);
        const link = $duck(elem).find('a.result__url').attr('href');
        const snippet = $duck(elem).find('div.result__snippet').text().trim().substring(0, 200);
        if (title && link && snippet) {
          socialResults.push({ platform, title, link, snippet });
        }
      });

      $duck('img').each((i, elem) => {
        const src = $duck(elem).attr('src');
        if (src && src.includes('/profile/') && src.startsWith('http')) {
          profileImages.push(src);
        }
      });
    }

    // Deep search for phone and email
    const deepBingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}+phone+email+site:${platforms.join('|')}`;
    const deepResponse = await axiosInstance.get(deepBingUrl);
    const $deep = cheerio.load(deepResponse.data);
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
    const response = await axiosInstance.get(url, { responseType: 'arraybuffer', maxContentLength: 5e6 });
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
    .setDescription('Perform a deep OSINT social media search')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('The search query')
        .setRequired(true))
    .toJSON(),
];

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag} at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}`);
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
      .setColor('#0099ff')
      .setTitle(`🕵️‍♂️ OSINT Social Media Report: ${query.substring(0, 100)}`)
      .setDescription('Deep search results from social platforms.')
      .setTimestamp()
      .setFooter({ text: 'Generated by OSINT Bot' });

    const socialData = await scrapeSocialMediaFromEngines(query);
    if (socialData.socialResults.length > 0) {
      socialData.socialResults.slice(0, 3).forEach((result, i) => {
        const profileImagePath = socialData.profileImages[i] ? await saveImage(socialData.profileImages[i], query, 'profile') : null;
        embed.addFields({
          name: `${i + 1}. ${result.platform} - [${result.title.substring(0, 50)}](${result.link})`,
          value: result.snippet.substring(0, 200),
          inline: false,
        });
        if (profileImagePath) {
          embed.data.fields[i].inline = true; // Adjust layout
          embed.setAuthor({ name: result.platform, iconURL: `attachment://${path.basename(profileImagePath)}` });
        }
      });
    }

    if (socialData.phone || socialData.email) {
      embed.addFields({
        name: '🔍 Deep Findings',
        value: [
          socialData.phone ? `📞 Phone: ${socialData.phone}` : '',
          socialData.email ? `📧 Email: ${socialData.email}` : '',
        ].filter(Boolean).join('\n').substring(0, 1024),
        inline: false,
      });
    }

    const validImages = socialData.profileImages.slice(0, 3).map(img => saveImage(img, query, 'profile')).filter(p => p);
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
