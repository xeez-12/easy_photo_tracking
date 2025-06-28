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
        insights.recommendations += '. Sensitive content found - proceed with caution';
    }
    
    return insights;
};

// Analyze and match profiles across platforms
const analyzeProfiles = (results) => {
    const profiles = results
        .filter(result => result.profile)
        .map(result => result.profile)
        .filter(profile => profile.name && profile.url);
    
    if (profiles.length < 2) return {};
    
    // Group similar profiles
    const profileGroups = [];
    const processed = new Set();
    
    for (let i = 0; i < profiles.length; i++) {
        if (processed.has(i)) continue;
        
        const group = [profiles[i]];
        processed.add(i);
        
        for (let j = i + 1; j < profiles.length; j++) {
            if (processed.has(j)) continue;
            
            if (isSimilarProfile(profiles[i], profiles[j])) {
                group.push(profiles[j]);
                processed.add(j);
            }
        }
        
        profileGroups.push(group);
    }
    
    // Generate insights
    const insights = {
        profileGroups: profileGroups.filter(group => group.length > 1),
        uniqueProfiles: profileGroups.length,
        platforms: {}
    };
    
    // Count platforms
    profiles.forEach(profile => {
        insights.platforms[profile.platform] = (insights.platforms[profile.platform] || 0) + 1;
    });
    
    return {
        profileAnalysis: insights
    };
};

// Check if two profiles are similar using multiple methods
const isSimilarProfile = (profile1, profile2) => {
    if (profile1.url === profile2.url) return true;
    
    // Name similarity
    const nameSimilarity = stringSimilarity.compareTwoStrings(
        profile1.name.toLowerCase(), 
        profile2.name.toLowerCase()
    );
    
    if (nameSimilarity > 0.8) return true;
    
    // Handle similarity
    if (profile1.handle && profile2.handle) {
        const handleSimilarity = stringSimilarity.compareTwoStrings(
            profile1.handle.toLowerCase(),
            profile2.handle.toLowerCase()
        );
        
        if (handleSimilarity > 0.9) return true;
    }
    
    // Bio similarity
    if (profile1.bio && profile2.bio) {
        const tokens1 = tokenizer.tokenize(profile1.bio);
        const tokens2 = tokenizer.tokenize(profile2.bio);
        
        const stemmed1 = tokens1.map(token => stemmer.stem(token));
        const stemmed2 = tokens2.map(token => stemmer.stem(token));
        
        const commonTerms = stemmed1.filter(token => stemmed2.includes(token));
        const similarity = commonTerms.length / Math.max(stemmed1.length, stemmed2.length);
        
        if (similarity > 0.6) return true;
    }
    
    // Image similarity (if available)
    if (profile1.profileImage && profile2.profileImage) {
        // This would require image comparison AI which is heavy
        // For now, we skip or use simple dimension comparison
        if (profile1.profileImageDimensions && profile2.profileImageDimensions) {
            const ratio1 = profile1.profileImageDimensions.width / profile1.profileImageDimensions.height;
            const ratio2 = profile2.profileImageDimensions.width / profile2.profileImageDimensions.height;
            if (Math.abs(ratio1 - ratio2) < 0.1) {
                // Similar aspect ratio might indicate same image
                return true;
            }
        }
    }
    
    return false;
};

// Verify profile authenticity
const verifyProfile = (profile) => {
    let score = 0;
    
    // Profile completeness
    if (profile.name) score += 0.2;
    if (profile.handle) score += 0.1;
    if (profile.bio) score += 0.1;
    if (profile.profileImage) score += 0.2;
    
    // Activity level
    if (profile.posts && profile.posts.length > 5) score += 0.2;
    if (profile.tweets && profile.tweets.length > 3) score += 0.2;
    
    // Verification badge (if available)
    if (profile.verified) score += 0.3;
    
    return {
        score,
        status: score > 0.7 ? 'Likely authentic' : 'Possibly fake'
    };
};

// Find connections between profiles
const findConnections = (profiles) => {
    const connections = [];
    
    // For each pair of profiles, check if they mention each other
    for (let i = 0; i < profiles.length; i++) {
        for (let j = i + 1; j < profiles.length; j++) {
            if (profiles[i].bio && profiles[j].bio) {
                const name1 = profiles[i].name.split(' ')[0];
                const name2 = profiles[j].name.split(' ')[0];
                const handle1 = profiles[i].handle.replace('@', '');
                const handle2 = profiles[j].handle.replace('@', '');
                
                if (profiles[i].bio.includes(handle2) || profiles[i].bio.includes(name2)) {
                    connections.push({
                        source: profiles[i].url,
                        target: profiles[j].url,
                        type: 'mention'
                    });
                }
                
                if (profiles[j].bio.includes(handle1) || profiles[j].bio.includes(name1)) {
                    connections.push({
                        source: profiles[j].url,
                        target: profiles[i].url,
                        type: 'mention'
                    });
                }
            }
        }
    }
    
    return connections;
};

module.exports = {
    analyzeResults,
    analyzeProfiles,
    verifyProfile,
    findConnections
};

