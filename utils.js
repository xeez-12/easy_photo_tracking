// utils.js - Enhanced Utility Functions
const SOCIAL_MEDIA_DOMAINS = [
    'twitter.com', 'facebook.com', 'instagram.com', 
    'linkedin.com', 'tiktok.com', 'youtube.com',
    'reddit.com', 'pinterest.com', 'tumblr.com',
    'flickr.com', 'vimeo.com', 'github.com',
    'gitlab.com', 'medium.com', 'vk.com',
    'weibo.com', 'telegram.org', 'discord.com',
    'twitch.tv', 'patreon.com'
];

const getPlatformFromUrl = (url) => {
    if (!url) return null;
    
    const domainMappings = {
        'twitter.com': 'twitter',
        'facebook.com': 'facebook',
        'instagram.com': 'instagram',
        'linkedin.com': 'linkedin',
        'tiktok.com': 'tiktok',
        'youtube.com': 'youtube',
        'youtu.be': 'youtube',
        'reddit.com': 'reddit',
        'pinterest.com': 'pinterest',
        'tumblr.com': 'tumblr',
        'flickr.com': 'flickr',
        'vimeo.com': 'vimeo',
        'github.com': 'github',
        'gitlab.com': 'gitlab',
        'bitbucket.org': 'bitbucket',
        'medium.com': 'medium',
        'deviantart.com': 'deviantart',
        'vk.com': 'vk',
        'weibo.com': 'weibo',
        'douyin.com': 'douyin',
        't.me': 'telegram',
        'snapchat.com': 'snapchat',
        'whatsapp.com': 'whatsapp',
        'discord.com': 'discord',
        'twitch.tv': 'twitch',
        'patreon.com': 'patreon',
        'onlyfans.com': 'onlyfans',
        'fiverr.com': 'fiverr',
        'upwork.com': 'upwork'
    };
    
    try {
        const domain = new URL(url).hostname.replace('www.', '');
        for (const [pattern, platform] of Object.entries(domainMappings)) {
            if (domain.includes(pattern)) {
                return platform;
            }
        }
    } catch (e) {
        // Invalid URL
    }
    
    return null;
};

const getUsernameFromUrl = (url, platform) => {
    if (!url || !platform) return null;
    
    try {
        const parsedUrl = new URL(url);
        const pathParts = parsedUrl.pathname.split('/').filter(part => part);
        
        switch (platform) {
            case 'twitter':
            case 'instagram':
            case 'tiktok':
            case 'github':
            case 'gitlab':
            case 'medium':
                return pathParts[0] || null;
            case 'youtube':
                if (pathParts[0] === 'channel') return pathParts[1] || null;
                if (pathParts[0] === 'c' || pathParts[0] === 'user') return pathParts[1] || null;
                return pathParts[0] || null;
            case 'facebook':
                return pathParts[1] || null;
            case 'linkedin':
                if (pathParts[0] === 'in') return pathParts[1] || null;
                return pathParts[0] || null;
            case 'reddit':
                if (pathParts[0] === 'user') return pathParts[1] || null;
                return pathParts[0] ? pathParts[0].replace('u/', '') : null;
            default:
                return pathParts[0] || null;
        }
    } catch (e) {
        return null;
    }
};

const extractSocialProfile = (url, title, snippet) => {
    const platform = getPlatformFromUrl(url);
    if (!platform) return null;
    
    const platformData = {
        name: platform.charAt(0).toUpperCase() + platform.slice(1),
        icon: platform
    };
    
    try {
        const username = getUsernameFromUrl(url, platform);
        return {
            name: title || username || platformData.name,
            handle: username ? `@${username}` : '',
            url,
            platform: platformData.name,
            icon: platformData.icon,
            extractedFrom: snippet || ''
        };
    } catch (e) {
        return {
            name: title || platformData.name,
            handle: '',
            url,
            platform: platformData.name,
            icon: platformData.icon,
            extractedFrom: snippet || ''
        };
    }
};

const normalizeImageUrl = (url, baseDomain) => {
    if (!url) return '';
    
    // Convert relative URLs to absolute
    if (url.startsWith('//')) {
        return 'https:' + url;
    } else if (url.startsWith('/')) {
        return `https://${baseDomain}${url}`;
    } else if (!url.startsWith('http')) {
        return `https://${baseDomain}/${url}`;
    }
    
    return url;
};

const extractUsernames = (text) => {
    if (!text) return [];
    // Match @username and username patterns
    const pattern = /(?:^|\s)(?:@)?([a-zA-Z0-9_.-]+)(?=\s|$)/g;
    const usernames = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
        if (match[1].length > 3) { // Ignore short strings
            usernames.push(match[1]);
        }
    }
    return [...new Set(usernames)]; // Remove duplicates
};

const isBlockedDomain = (url) => {
    const blockedDomains = [
        'baidu.com',
        'qq.com',
        'weibo.com',
        'zhihu.com',
        'douban.com',
        't.co',
        'bit.ly',
        'goo.gl',
        'tinyurl.com',
        'ow.ly',
        'buff.ly',
        'adf.ly'
    ];
    
    try {
        const domain = new URL(url).hostname;
        return blockedDomains.some(blocked => domain.includes(blocked));
    } catch (e) {
        return false;
    }
};

const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
};

module.exports = {
    SOCIAL_MEDIA_DOMAINS,
    getPlatformFromUrl,
    getUsernameFromUrl,
    extractSocialProfile,
    normalizeImageUrl,
    extractUsernames,
    isBlockedDomain,
    isValidUrl
};
