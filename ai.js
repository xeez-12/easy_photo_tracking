// ai.js - Advanced OSINT AI analysis
const natural = require('natural');
const stringSimilarity = require('string-similarity');

// Initialize NLP tools
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;
const metaphone = natural.Metaphone;

// Analyze OSINT results
const analyzeResults = (results, query) => {
    const insights = {};
    
    // Basic analysis
    insights.summary = `Found ${results.length} relevant results across multiple sources.`;
    
    // Extract profiles
    const profiles = results
        .filter(result => result.profile)
        .map(result => result.profile)
        .filter((value, index, self) => 
            index === self.findIndex(p => p.url === value.url)
        );
    
    if (profiles.length > 0) {
        insights.keyFindings = `Identified ${profiles.length} profiles: ${profiles.slice(0, 3).map(p => p.name).join(', ')}${profiles.length > 3 ? '...' : ''}`;
    } else {
        insights.keyFindings = 'No profile information extracted';
    }
    
    // Social media detection
    const socialMediaKeywords = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'];
    const socialMediaResults = results.filter(result => 
        socialMediaKeywords.some(keyword => 
            result.url.toLowerCase().includes(keyword) ||
            (result.profile && result.profile.url.toLowerCase().includes(keyword))
        )
    );
    
    if (socialMediaResults.length > 0) {
        insights.keyFindings += `. Found ${socialMediaResults.length} social media references`;
    }
    
    // Risk assessment
    const riskKeywords = ['breach', 'leak', 'hack', 'scam', 'fraud', 'exposed'];
    const hasRisk = results.some(result => 
        riskKeywords.some(keyword => 
            (result.title + result.snippet).toLowerCase().includes(keyword)
        )
    );
    
    insights.riskLevel = hasRisk ? 'High (Sensitive content detected)' : 'Low';
    
    // Recommendations
    insights.recommendations = 'Verify all sources and cross-reference information';
    
    if (profiles.length > 0) {
        insights.recommendations += '. Analyze extracted profiles for connections';
    }
    
    if (socialMediaResults.length > 0) {
        insights.recommendations += '. Investigate social media references';
    }
    
    if (hasRisk) {
        insights.recomm极致的
