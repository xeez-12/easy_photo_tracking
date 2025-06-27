// Enhanced social media detection with 25+ platforms
const socialDomains = {
    'twitter.com': {
        name: 'Twitter',
        handleRegex: /twitter\.com\/([^\/]+)/,
        profileRegex: /twitter\.com\/([^\/]+)/,
        icon: 'twitter',
        baseDomain: 'twitter.com'
    },
    'instagram.com': {
        name: 'Instagram',
        handleRegex: /instagram\.com\/([^\/]+)/,
        profileRegex: /instagram\.com\/([^\/]+)/,
        icon: 'instagram',
        baseDomain: 'instagram.com'
    },
    'facebook.com': {
        name: 'Facebook',
        handleRegex: /facebook\.com\/([^\/]+)/,
        profileRegex: /facebook\.com\/([^\/]+)/,
        icon: 'facebook',
        baseDomain: 'facebook.com'
    },
    'linkedin.com': {
        name: 'LinkedIn',
        handleRegex: /linkedin\.com\/in\/([^\/]+)/,
        profileRegex: /linkedin\.com\/in\/([^\/]+)/,
        icon: 'linkedin',
        baseDomain: 'linkedin.com'
    },
    'tiktok.com': {
        name: 'TikTok',
        handleRegex: /tiktok\.com\/@([^\/]+)/,
        profileRegex: /tiktok\.com\/@([^\/]+)/,
        icon: 'tiktok',
        baseDomain: 'tiktok.com'
    },
    'youtube.com': {
        name: 'YouTube',
        handleRegex: /youtube\.com\/@([^\/]+)/,
        profileRegex: /youtube\.com\/(channel|user|c)\/([^\/]+)/,
        icon: 'youtube',
        baseDomain: 'youtube.com'
    },
    'pinterest.com': {
        name: 'Pinterest',
        handleRegex: /pinterest\.(com|fr)\/([^\/]+)/,
        icon: 'pinterest',
        baseDomain: 'pinterest.com'
    },
    'reddit.com': {
        name: 'Reddit',
        handleRegex: /reddit\.com\/user\/([^\/]+)/,
        icon: 'reddit',
        baseDomain: 'reddit.com'
    },
    'snapchat.com': {
        name: 'Snapchat',
        handleRegex: /snapchat\.com\/add\/([^\/]+)/,
        icon: 'snapchat',
        baseDomain: 'snapchat.com'
    },
    'tumblr.com': {
        name: 'Tumblr',
        handleRegex: /tumblr\.com\/blog\/([^\/]+)/,
        icon: 'tumblr',
        baseDomain: 'tumblr.com'
    },
    'flickr.com': {
        name: 'Flickr',
        handleRegex: /flickr\.com\/people\/([^\/]+)/,
        icon: 'flickr',
        baseDomain: 'flickr.com'
    },
    'vk.com': {
        name: 'VKontakte',
        handleRegex: /vk\.com\/([^\/]+)/,
        icon: 'vk',
        baseDomain: 'vk.com'
    },
    'weibo.com': {
        name: 'Weibo',
        handleRegex: /weibo\.com\/([^\/]+)/,
        icon: 'weibo',
        baseDomain: 'weibo.com'
    },
    'telegram.me': {
        name: 'Telegram',
        handleRegex: /telegram\.me\/([^\/]+)/,
        icon: 'telegram',
        baseDomain: 'telegram.me'
    },
    'medium.com': {
        name: 'Medium',
        handleRegex: /medium\.com\/@([^\/]+)/,
        icon: 'medium',
        baseDomain: 'medium.com'
    },
    'github.com': {
        name: 'GitHub',
        handleRegex: /github\.com\/([^\/]+)/,
        icon: 'github',
        baseDomain: 'github.com'
    },
    'quora.com': {
        name: 'Quora',
        handleRegex: /quora\.com\/profile\/([^\/]+)/,
        icon: 'quora',
        baseDomain: 'quora.com'
    },
    'twitch.tv': {
        name: 'Twitch',
        handleRegex: /twitch\.tv\/([^\/]+)/,
        icon: 'twitch',
        baseDomain: 'twitch.tv'
    },
    'discord.com': {
        name: 'Discord',
        handleRegex: /discord\.com\/users\/([^\/]+)/,
        icon: 'discord',
        baseDomain: 'discord.com'
    },
    'patreon.com': {
        name: 'Patreon',
        handleRegex: /patreon\.com\/([^\/]+)/,
        icon: 'patreon',
        baseDomain: 'patreon.com'
    },
    'onlyfans.com': {
        name: 'OnlyFans',
        handleRegex: /onlyfans\.com\/([^\/]+)/,
        icon: 'onlyfans',
        baseDomain: 'onlyfans.com'
    },
    'fiverr.com': {
        name: 'Fiverr',
        handleRegex: /fiverr\.com\/([^\/]+)/,
        icon: 'fiverr',
        baseDomain: 'fiverr.com'
    },
    'behance.net': {
        name: 'Behance',
        handleRegex: /behance\.net\/([^\/]+)/,
        icon: 'behance',
        baseDomain: 'behance.net'
    },
    'dribbble.com': {
        name: 'Dribbble',
        handleRegex: /dribbble\.com\/([^\/]+)/,
        icon: 'dribbble',
        baseDomain: 'dribbble.com'
    },
    'soundcloud.com': {
        name: 'SoundCloud',
        handleRegex: /soundcloud\.com\/([^\/]+)/,
        icon: 'soundcloud',
        baseDomain: 'soundcloud.com'
    }
};

// Enhanced profile extraction with image detection
const extractSocialProfile = (url, title, snippet) => {
    for (const [domain, platform] of Object.entries(socialDomains)) {
        if (url.includes(domain)) {
            const handleMatch = url.match(platform.handleRegex);
            const handle = handleMatch ? handleMatch[1] : '';
            
            const nameMatch = title.match(new RegExp(`(?:@)?${handle}\\b`, 'i')) || 
                             snippet.match(new RegExp(`(?:@)?${handle}\\b`, 'i'));
            
            let name = nameMatch ? nameMatch[0] : handle || title.split(' ')[0];
            
            // Clean up name
            name = name.replace(/^[@\/]+/, '').trim();
            
            return {
                name,
                handle: handle ? `@${handle}` : '',
                url,
                platform: platform.name,
                icon: platform.icon,
                baseDomain: domain
            };
        }
    }
    return null;
};

// Enhanced image URL normalization
const normalizeImageUrl = (url, baseDomain) => {
    if (!url) return '';
    
    // Remove tracking parameters
    const cleanUrl = url.split('?')[0].split('#')[0];
    
    // Handle relative URLs
    if (cleanUrl.startsWith('//')) {
        return 'https:' + cleanUrl;
    } else if (cleanUrl.startsWith('/')) {
        return `https://${baseDomain}${cleanUrl}`;
    } else if (!cleanUrl.startsWith('http')) {
        return `https://${baseDomain}/${cleanUrl}`;
    }
    
    // Ensure HTTPS
    return cleanUrl.replace('http://', 'https://');
};

module.exports = {
    socialDomains,
    extractSocialProfile,
    normalizeImageUrl
};

