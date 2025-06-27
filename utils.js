// Utility functions for enhanced scraping
const extractSocialProfile = (url, title, snippet) => {
    const socialDomains = {
        'twitter.com': {
            name: 'Twitter',
            handleRegex: /twitter\.com\/([^\/]+)/,
            profileRegex: /twitter\.com\/([^\/]+)/,
            icon: 'twitter'
        },
        'instagram.com': {
            name: 'Instagram',
            handleRegex: /instagram\.com\/([^\/]+)/,
            profileRegex: /instagram\.com\/([^\/]+)/,
            icon: 'instagram'
        },
        'facebook.com': {
            name: 'Facebook',
            handleRegex: /facebook\.com\/([^\/]+)/,
            profileRegex: /facebook\.com\/([^\/]+)/,
            icon: 'facebook'
        },
        'linkedin.com': {
            name: 'LinkedIn',
            handleRegex: /linkedin\.com\/in\/([^\/]+)/,
            profileRegex: /linkedin\.com\/in\/([^\/]+)/,
            icon: 'linkedin'
        },
        'tiktok.com': {
            name: 'TikTok',
            handleRegex: /tiktok\.com\/@([^\/]+)/,
            profileRegex: /tiktok\.com\/@([^\/]+)/,
            icon: 'tiktok'
        },
        'youtube.com': {
            name: 'YouTube',
            handleRegex: /youtube\.com\/@([^\/]+)/,
            profileRegex: /youtube\.com\/@([^\/]+)/,
            icon: 'youtube'
        }
    };

    for (const [domain, platform] of Object.entries(socialDomains)) {
        if (url.includes(domain)) {
            const handleMatch = url.match(platform.handleRegex);
            const handle = handleMatch ? handleMatch[1] : '';
            
            const nameMatch = title.match(new RegExp(`(?:@)?${handle}\\b`, 'i')) || 
                             snippet.match(new RegExp(`(?:@)?${handle}\\b`, 'i'));
            const name = nameMatch ? nameMatch[0] : handle || title.split(' ')[0];
            
            return {
                name,
                handle: handle ? `@${handle}` : '',
                url,
                platform: platform.name,
                icon: platform.icon
            };
        }
    }
    
    return null;
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

module.exports = {
    extractSocialProfile,
    normalizeImageUrl
};
