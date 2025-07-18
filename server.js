import { Hyperbrowser } from "@hyperbrowser/sdk";
import { config } from "dotenv";
import express from "express";
import cors from "cors";

config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const hbClient = new Hyperbrowser({
  apiKey: process.env.HYPERBROWSER_API_KEY,
});

const scrapeSocialMedia = async (platform, username) => {
  const platformConfigs = {
    tiktok: {
      url: `https://www.tiktok.com/@${username}`,
      selectors: {
        username: '.tiktok-1i2n4k0-H2UserName',
        bio: '.tiktok-1m1g4rt-PBio',
        followers: '.tiktok-1p6d20z-SpanCount',
        posts: '.tiktok-1p6d20z-SpanCount:nth-child(1)'
      }
    },
    instagram: {
      url: `https://www.instagram.com/${username}/`,
      selectors: {
        username: 'h2._aacl',
        bio: '._aacl._aacw._aacy._aacz',
        followers: '._aacl._aaco._aacw._aacx._aada:nth-child(2) span',
        posts: '._aacl._aaco._aacw._aacx._aada:nth-child(1) span'
      }
    },
    facebook: {
      url: `https://www.facebook.com/${username}`,
      selectors: {
        username: 'h1.x1heor9g',
        bio: '.x1heor9g + div',
        followers: '.x1n2onr6 span',
        posts: 'N/A'
      }
    },
    x: {
      url: `https://x.com/${username}`,
      selectors: {
        username: '[data-testid="UserName"]',
        bio: '[data-testid="UserDescription"]',
        followers: '[data-testid="followers"] span',
        posts: '[data-testid="primaryColumn"] article'
      }
    },
    youtube: {
      url: `https://www.youtube.com/@${username}`,
      selectors: {
        username: '#channel-name',
        bio: '#description',
        followers: '#subscriber-count',
        posts: '#videos-tab'
      }
    }
  };

  const config = platformConfigs[platform];
  if (!config) throw new Error('Invalid platform');

  try {
    const result = await hbClient.agents.browserUse.startAndWait({
      task: `Navigate to ${config.url} and extract the following:
      - Username: ${config.selectors.username}
      - Bio: ${config.selectors.bio}
      - Followers: ${config.selectors.followers}
      - Posts: ${config.selectors.posts}`,
      searchEngine: 'bing' // Alternating between Bing and DuckDuckGo can be implemented with a toggle
    });

    return {
      username: result.data?.finalResult?.username || 'N/A',
      bio: result.data?.finalResult?.bio || 'N/A',
      followers: result.data?.finalResult?.followers || 'N/A',
      posts: result.data?.finalResult?.posts || 'N/A'
    };
  } catch (error) {
    throw new Error(`Scraping failed: ${error.message}`);
  }
};

app.post('/scrape', async (req, res) => {
  const { platform, username } = req.body;
  
  try {
    const data = await scrapeSocialMedia(platform, username);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: '.' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
