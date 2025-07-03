const { RateLimiterMemory } = require('rate-limiter-flexible');
const crypto = require('crypto');
const helmet = require('helmet');

const rateLimiter = new RateLimiterMemory({
    points: 100,
    duration: 3600,
});

module.exports = {
    applyAntiScraping: (app) => {
        // Apply helmet security headers
        app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
                    scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
                    imgSrc: ["'self'", 'data:'],
                    connectSrc: ["'self'"],
                    upgradeInsecureRequests: true
                }
            },
            xContentTypeOptions: 'nosniff',
            xFrameOptions: 'DENY',
            referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
        }));

        // Rate limiting middleware
        app.use((req, res, next) => {
            const clientIp = req.ip;
            rateLimiter.consume(clientIp)
                .then(() => {
                    const token = crypto.randomBytes(16).toString('hex');
                    res.set('X-OSINT-Token', token);
                    next();
                })
                .catch(() => {
                    res.status(429).json({ error: 'Rate limit exceeded' });
                });
        });

        // Prevent direct access to sensitive endpoints
        app.use('/api/', (req, res, next) => {
            const userAgent = req.get('User-Agent') || '';
            if (!userAgent || userAgent.includes('bot') || userAgent.includes('crawler')) {
                return res.status(403).json({ error: 'Access denied' });
            }
            next();
        });

        // Obfuscate sensitive data in responses
        app.use((req, res, next) => {
            const originalJson = res.json;
            res.json = function(data) {
                if (data && typeof data === 'object') {
                    const obfuscatedData = JSON.parse(JSON.stringify(data));
                    // Add noise to numerical data
                    if (obfuscatedData.followers) {
                        obfuscatedData.followers = Math.round(obfuscatedData.followers * (1 + (Math.random() * 0.02 - 0.01)));
                    }
                    if (obfuscatedData.posts) {
                        obfuscatedData.posts = Math.round(obfuscatedData.posts * (1 + (Math.random() * 0.02 - 0.01)));
                    }
                    return originalJson.call(this, obfuscatedData);
                }
                return originalJson.call(this, data);
            };
            next();
        });
    }
};
