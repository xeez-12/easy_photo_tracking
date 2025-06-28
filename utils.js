// Utility functions for enhanced scraping
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
    
    for (const [domain, platform] of Object.entries(domainMappings)) {
        if (url.includes(domain)) {
            return platform;
        }
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
            icon: platformData.icon
        };
    } catch (e) {
        return {
            name: title || platformData.name,
            handle: '',
            url,
            platform: platformData.name,
            icon: platformData.icon
        };
    }
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
        'tinyurl.com'
    ];
    
    try {
        const domain = new URL(url).hostname;
        return blockedDomains.some(blocked => domain.includes(blocked));
    } catch (e) {
        return false;
    }
};

// URL safety check (simulated)
const checkUrlSafety = async (url) => {
    try {
        // In a real implementation, this would call an API like Google Safe Browsing
        return {
            safe: true,
            threats: []
        };
    } catch (e) {
        return {
            safe: false,
            threats: ['Unknown']
        };
    }
};

module.exports = {
    getPlatformFromUrl,
    getUsernameFromUrl,
    extractSocialProfile,
    isBlockedDomain,
    checkUrlSafety
};
