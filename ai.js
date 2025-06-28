// ai.js - Advanced OSINT AI analysis module
const natural = require('natural');
const stringSimilarity = require('string-similarity');
const SentimentAnalyzer = natural.SentimentAnalyzer;
const stemmer = natural.PorterStemmer;
const analyzer = new SentimentAnalyzer('English', stemmer, 'afinn');
const TfIdf = natural.TfIdf;
const { WordTokenizer, SentenceTokenizer } = natural;
const metaphone = natural.Metaphone;
const levenshtein = require('fast-levenshtein');

// Initialize NLP tools
const wordTokenizer = new WordTokenizer();
const sentenceTokenizer = new SentenceTokenizer();
const tfidf = new TfIdf();

// Enhanced analyzeResults function with multiple analysis dimensions
const analyzeResults = (results, query) => {
    const insights = {
        summary: '',
        keyFindings: [],
        sentiment: 'Neutral',
        riskAssessment: {},
        profileAnalysis: {},
        contentAnalysis: {},
        recommendations: [],
        metadata: {
            totalResults: results.length,
            trustedSources: results.filter(r => r.isTrusted).length,
            socialMediaProfiles: 0
        }
    };

    // 1. Content Analysis
    const allText = results.map(r => `${r.title} ${r.snippet}`).join(' ');
    const sentences = sentenceTokenizer.tokenize(allText);
    
    // TF-IDF Analysis
    results.forEach(result => {
        const text = `${result.title} ${result.snippet}`;
        tfidf.addDocument(text);
    });
    
    // Get top keywords
    const keywordScores = {};
    tfidf.listTerms(0).forEach(item => {
        if (item.term.length > 3) { // Only consider meaningful terms
            keywordScores[item.term] = (keywordScores[item.term] || 0) + item.tfidf;
        }
    });
    
    const topKeywords = Object.entries(keywordScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([term]) => term);
    
    insights.contentAnalysis.keywords = topKeywords;
    
    // Sentiment Analysis
    const sentiments = sentences.map(s => analyzer.getSentiment(wordTokenizer.tokenize(s)));
    const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    insights.sentiment = avgSentiment > 0.2 ? 'Positive' : 
                        avgSentiment < -0.2 ? 'Negative' : 'Neutral';
    
    // 2. Profile Analysis
    const profiles = results
        .filter(result => result.profile)
        .map(result => result.profile)
        .filter((value, index, self) => 
            index === self.findIndex(p => p.url === value.url)
        );
    
    insights.metadata.socialMediaProfiles = profiles.length;
    
    if (profiles.length > 0) {
        insights.profileAnalysis = analyzeProfiles(results).profileAnalysis;
        insights.keyFindings.push(`Found ${profiles.length} social media profiles`);
    }
    
    // 3. Risk Assessment
    const riskKeywords = {
        security: ['breach', 'hack', 'leak', 'compromise', 'vulnerability'],
        fraud: ['scam', 'fraud', 'phishing', 'fake', 'counterfeit'],
        privacy: ['exposed', 'private', 'sensitive', 'personal', 'data'],
        reputation: ['controversy', 'accusation', 'lawsuit', 'allegation']
    };
    
    insights.riskAssessment = {
        security: 0,
        fraud: 0,
        privacy: 0,
        reputation: 0
    };
    
    Object.entries(riskKeywords).forEach(([category, keywords]) => {
        keywords.forEach(keyword => {
            if (allText.toLowerCase().includes(keyword)) {
                insights.riskAssessment[category]++;
            }
        });
    });
    
    // Calculate overall risk score
    const riskScore = Object.values(insights.riskAssessment).reduce((a, b) => a + b, 0);
    insights.riskAssessment.level = riskScore > 5 ? 'High' : 
                                  riskScore > 2 ? 'Medium' : 'Low';
    
    // 4. Generate Summary
    insights.summary = `Analysis of ${results.length} results found ${
        profiles.length > 0 ? `${profiles.length} social media profiles and ` : ''
    }${topKeywords.length} key topics. Sentiment is ${insights.sentiment} and risk level is ${
        insights.riskAssessment.level
    }.`;
    
    // 5. Generate Recommendations
    if (profiles.length > 0) {
        insights.recommendations.push(
            'Investigate linked social media profiles for connections and patterns'
        );
    }
    
    if (insights.riskAssessment.level !== 'Low') {
        insights.recommendations.push(
            'Review flagged content for potential risks or threats'
        );
    }
    
    if (topKeywords.includes(query.toLowerCase())) {
        insights.recommendations.push(
            'Query appears in multiple results - likely significant relevance'
        );
    }
    
    return insights;
};

// Enhanced profile analysis with multiple matching techniques
const analyzeProfiles = (results) => {
    const profiles = results
        .filter(result => result.profile)
        .map(result => result.profile)
        .filter(profile => profile.name && profile.url);
    
    if (profiles.length < 2) return { profileAnalysis: {} };
    
    // 1. Group similar profiles
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
        
        if (group.length > 1) {
            profileGroups.push(group);
        }
    }
    
    // 2. Analyze profile connections
    const connections = findConnections(profiles);
    
    // 3. Verify profile authenticity
    const verificationResults = profiles.map(profile => ({
        url: profile.url,
        ...verifyProfile(profile)
    }));
    
    // 4. Platform distribution
    const platformDistribution = {};
    profiles.forEach(profile => {
        platformDistribution[profile.platform] = (platformDistribution[profile.platform] || 0) + 1;
    });
    
    return {
        profileAnalysis: {
            profileGroups,
            connections,
            verificationResults,
            platformDistribution,
            totalProfiles: profiles.length,
            matchedGroups: profileGroups.length
        }
    };
};

// Enhanced similarity check with multiple techniques
const isSimilarProfile = (profile1, profile2) => {
    // 1. Exact URL match
    if (profile1.url === profile2.url) return true;
    
    // 2. Name similarity (multiple methods)
    const nameSimilarity = {
        levenshtein: 1 - (levenshtein.get(profile1.name.toLowerCase(), profile2.name.toLowerCase()) / 
                         Math.max(profile1.name.length, profile2.name.length)),
        cosine: stringSimilarity.compareTwoStrings(profile1.name.toLowerCase(), profile2.name.toLowerCase()),
        metaphone: metaphone.compare(profile1.name, profile2.name) ? 1 : 0
    };
    
    const nameScore = (nameSimilarity.levenshtein * 0.4) + 
                     (nameSimilarity.cosine * 0.4) + 
                     (nameSimilarity.metaphone * 0.2);
    
    if (nameScore > 0.85) return true;
    
    // 3. Handle similarity
    if (profile1.handle && profile2.handle) {
        const handleSimilarity = stringSimilarity.compareTwoStrings(
            profile1.handle.toLowerCase(),
            profile2.handle.toLowerCase()
        );
        if (handleSimilarity > 0.9) return true;
    }
    
    // 4. Bio similarity (TF-IDF and keyword matching)
    if (profile1.bio && profile2.bio) {
        const bio1 = wordTokenizer.tokenize(profile1.bio.toLowerCase());
        const bio2 = wordTokenizer.tokenize(profile2.bio.toLowerCase());
        
        const commonTerms = [...new Set(bio1)].filter(term => 
            bio2.includes(term) && term.length > 3
        ).length;
        
        const similarityScore = commonTerms / 
            Math.max(
                [...new Set(bio1)].length, 
                [...new Set(bio2)].length
            );
        
        if (similarityScore > 0.6) return true;
    }
    
    // 5. Image similarity (basic dimension check)
    if (profile1.profileImageDimensions && profile2.profileImageDimensions) {
        const ratio1 = profile1.profileImageDimensions.width / profile1.profileImageDimensions.height;
        const ratio2 = profile2.profileImageDimensions.width / profile2.profileImageDimensions.height;
        if (Math.abs(ratio1 - ratio2) < 0.1) {
            return true;
        }
    }
    
    return false;
};

// Enhanced profile verification with multiple factors
const verifyProfile = (profile) => {
    let score = 0;
    const factors = [];
    
    // 1. Profile completeness
    if (profile.name) {
        score += 0.1;
        factors.push({ name: 'Has name', value: 0.1 });
    }
    if (profile.handle) {
        score += 0.1;
        factors.push({ name: 'Has handle', value: 0.1 });
    }
    if (profile.bio && profile.bio.length > 10) {
        score += 0.15;
        factors.push({ name: 'Detailed bio', value: 0.15 });
    }
    if (profile.profileImage) {
        score += 0.2;
        factors.push({ name: 'Profile image', value: 0.2 });
    }
    
    // 2. Activity level
    if (profile.posts && profile.posts.length > 5) {
        score += 0.15;
        factors.push({ name: 'Active posts', value: 0.15 });
    }
    if (profile.tweets && profile.tweets.length > 3) {
        score += 0.1;
        factors.push({ name: 'Active tweets', value: 0.1 });
    }
    
    // 3. Social proof
    if (profile.stats) {
        if (profile.stats.followers > 1000) {
            score += 0.1;
            factors.push({ name: 'High followers', value: 0.1 });
        }
        if (profile.stats.verified) {
            score += 0.3;
            factors.push({ name: 'Verified account', value: 0.3 });
        }
    }
    
    // 4. Platform consistency
    if (profile.platform) {
        score += 0.1;
        factors.push({ name: 'Platform consistency', value: 0.1 });
    }
    
    return {
        score: Math.min(1, score), // Cap at 1
        status: score > 0.7 ? 'Likely authentic' : 
               score > 0.4 ? 'Possibly authentic' : 'Potentially fake',
        factors
    };
};

// Enhanced connection finding with mention analysis
const findConnections = (profiles) => {
    const connections = [];
    const mentionMap = new Map();
    
    // 1. Build mention map
    profiles.forEach(profile => {
        if (!profile.bio) return;
        
        // Check for mentions of other profiles
        profiles.forEach(otherProfile => {
            if (profile.url === otherProfile.url) return;
            
            const nameParts = otherProfile.name.split(' ');
            const firstName = nameParts[0];
            const handle = otherProfile.handle?.replace('@', '') || '';
            
            if ((handle && profile.bio.includes(handle)) || 
                (firstName && profile.bio.includes(firstName))) {
                if (!mentionMap.has(profile.url)) {
                    mentionMap.set(profile.url, new Set());
                }
                mentionMap.get(profile.url).add(otherProfile.url);
            }
        });
    });
    
    // 2. Convert to connection objects
    mentionMap.forEach((mentioned, sourceUrl) => {
        mentioned.forEach(targetUrl => {
            connections.push({
                source: sourceUrl,
                target: targetUrl,
                type: 'mention',
                strength: 1
            });
        });
    });
    
    // 3. Find common connections
    profiles.forEach(profile1 => {
        profiles.forEach(profile2 => {
            if (profile1.url === profile2.url) return;
            
            const commonConnections = connections.filter(conn => 
                (conn.source === profile1.url && conn.target === profile2.url) ||
                (conn.source === profile2.url && conn.target === profile1.url)
            ).length;
            
            if (commonConnections > 0) {
                connections.push({
                    source: profile1.url,
                    target: profile2.url,
                    type: 'common',
                    strength: commonConnections
                });
            }
        });
    });
    
    return connections;
};

// Additional analysis functions
const analyzeContentPatterns = (results) => {
    const patterns = {
        temporal: {},
        thematic: {},
        sourceDistribution: {}
    };
    
    // Temporal analysis
    results.forEach(result => {
        if (result.date) {
            const date = new Date(result.date).toISOString().split('T')[0];
            patterns.temporal[date] = (patterns.temporal[date] || 0) + 1;
        }
    });
    
    // Thematic analysis
    const allText = results.map(r => `${r.title} ${r.snippet}`).join(' ');
    const words = wordTokenizer.tokenize(allText.toLowerCase());
    const wordFreq = {};
    words.forEach(word => {
        if (word.length > 3) { // Ignore short words
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
    });
    
    patterns.thematic = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .reduce((obj, [word, count]) => {
            obj[word] = count;
            return obj;
        }, {});
    
    // Source distribution
    results.forEach(result => {
        const domain = new URL(result.url).hostname.replace('www.', '');
        patterns.sourceDistribution[domain] = (patterns.sourceDistribution[domain] || 0) + 1;
    });
    
    return patterns;
};

module.exports = {
    analyzeResults,
    analyzeProfiles,
    verifyProfile,
    findConnections,
    analyzeContentPatterns
};


