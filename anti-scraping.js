const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

module.exports = {
    applyAntiScraping: (app) => {
        // Apply lightweight security headers
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

        // Lightweight rate limiting for free tier
        const apiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 50, // Limit each IP to 50 requests per windowMs
            message: 'Too many requests, please try again later.',
            headers: true,
            standardHeaders: true,
            legacyHeaders: false
        });

        app.use('/api/', apiLimiter);

        // Basic bot detection
        app.use('/api/', (req, res, next) => {
            const userAgent = req.get('User-Agent') || '';
            if (userAgent && (userAgent.includes('bot') || userAgent.includes('crawler'))) {
                return res.status(403).json({ error: 'Access denied' });
            }
            next();
        });
    }
};
