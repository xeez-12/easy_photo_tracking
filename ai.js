// ai.js - Enhanced AI Analysis with Gemini
const natural = require('natural');
const stringSimilarity = require('string-similarity');
const axios = require('axios');

// API Configuration
const API_KEY = 'AIzaSyC8lXn6FseViCQ828diDWQJX5dinHm_4Cw';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Initialize NLP tools
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;
const metaphone = natural.Metaphone;

// Enhanced Gemini AI integration
const queryGemini = async (prompt) => {
    try {
        const response = await axios.post(`${API_URL}?key=${API_KEY}`, {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        }, {
            timeout: 10000
        });

        return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
        console.error('Gemini API error:', error.message);
        return '';
    }
};

// Analyze OSINT results with AI
const analyzeResults = async (results, query) => {
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
    
    // AI-powered analysis of results
    try {
        const prompt = `Analyze these OSINT search results for query "${query}":\n\n${JSON.stringify(results.slice(0, 10), null, 2)}\n\nProvide key insights, potential risks, and recommendations in JSON format with these keys: summary, keyFindings, riskAssessment, recommendations.`;
        const aiResponse = await queryGemini(prompt);
        
        if (aiResponse) {
            try {
                const aiInsights = JSON.parse(aiResponse);
                return {
                    ...insights,
                    ...aiInsights,
                    aiGenerated: true
                };
            } catch (e) {
                // If JSON parsing fails, use as text
                return {
                    ...insights,
                    aiAnalysis: aiResponse,
                    aiGenerated: true
                };
            }
        }
    } catch (e) {
        console.error('AI analysis failed:', e);
    }
    
    // Fallback to basic analysis if AI fails
    return {
        ...insights,
        aiGenerated: false,
        riskAssessment: 'Unknown',
        recommendations: 'Verify all sources manually'
    };
};

// Analyze and match profiles across platforms with AI
const analyzeProfiles = async (profiles) => {
    if (profiles.length < 2) return {};
    
    // Group similar profiles with AI assistance
    const profileGroups = [];
    const processed = new Set();
    
    for (let i = 0; i < profiles.length; i++) {
        if (processed.has(i)) continue;
        
        const group = [profiles[i]];
        processed.add(i);
        
        for (let j = i + 1; j < profiles.length; j++) {
            if (processed.has(j)) continue;
            
            if (await isSimilarProfile(profiles[i], profiles[j])) {
                group.push(profiles[j]);
                processed.add(j);
            }
        }
        
        if (group.length > 1) {
            profileGroups.push(group);
        }
    }
    
    // Generate insights with AI
    let aiConnections = [];
    if (profileGroups.length > 0) {
        try {
            const prompt = `Analyze these potentially connected profiles:\n\n${JSON.stringify(profileGroups, null, 2)}\n\nIdentify connections, patterns, and potential risks in JSON format with these keys: connections, patterns, risks.`;
            const aiResponse = await queryGemini(prompt);
            
            if (aiResponse) {
                try {
                    aiConnections = JSON.parse(aiResponse);
                } catch (e) {
                    aiConnections = { analysis: aiResponse };
                }
            }
        } catch (e) {
            console.error('AI profile analysis failed:', e);
        }
    }
    
    return {
        profileGroups,
        uniqueProfiles: profileGroups.length,
        platforms: countPlatforms(profiles),
        aiConnections
    };
};

// Count platforms in profiles
const countPlatforms = (profiles) => {
    const counts = {};
    profiles.forEach(profile => {
        counts[profile.platform] = (counts[profile.platform] || 0) + 1;
    });
    return counts;
};

// Enhanced profile similarity check with AI
const isSimilarProfile = async (profile1, profile2) => {
    if (profile1.url === profile2.url) return true;
    
    // Basic checks
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
    
    // AI-powered similarity check
    try {
        const prompt = `Determine if these two profiles belong to the same person:\n\nProfile 1:\n${JSON.stringify(profile1, null, 2)}\n\nProfile 2:\n${JSON.stringify(profile2, null, 2)}\n\nRespond with JSON: { "samePerson": boolean, "confidence": number, "reasons": string[] }`;
        const aiResponse = await queryGemini(prompt);
        
        if (aiResponse) {
            try {
                const { samePerson, confidence } = JSON.parse(aiResponse);
                return samePerson && confidence > 0.7;
            } catch (e) {
                // If JSON parsing fails, look for keywords
                return aiResponse.toLowerCase().includes('yes') || 
                       aiResponse.toLowerCase().includes('same person');
            }
        }
    } catch (e) {
        console.error('AI similarity check failed:', e);
    }
    
    // Fallback to basic similarity
    return false;
};

// Enhanced profile analysis with AI
const analyzeProfile = async (profile) => {
    const analysis = {
        authenticity: await verifyProfile(profile),
        riskFactors: [],
        connections: []
    };
    
    // AI-powered analysis
    try {
        const prompt = `Analyze this social media profile for authenticity and risks:\n\n${JSON.stringify(profile, null, 2)}\n\nProvide analysis in JSON format with these keys: authenticityScore, riskFactors, behaviorPatterns.`;
        const aiResponse = await queryGemini(prompt);
        
        if (aiResponse) {
            try {
                const aiAnalysis = JSON.parse(aiResponse);
                return {
                    ...analysis,
                    ...aiAnalysis,
                    aiGenerated: true
                };
            } catch (e) {
                return {
                    ...analysis,
                    aiAnalysis: aiResponse,
                    aiGenerated: true
                };
            }
        }
    } catch (e) {
        console.error('AI profile analysis failed:', e);
    }
    
    return analysis;
};

// Verify profile authenticity with AI
const verifyProfile = async (profile) => {
    // Basic verification
    let score = 0;
    if (profile.name) score += 0.2;
    if (profile.handle) score += 0.1;
    if (profile.bio) score += 0.1;
    if (profile.profileImage) score += 0.2;
    if (profile.posts && profile.posts.length > 5) score += 0.2;
    if (profile.tweets && profile.tweets.length > 3) score += 0.2;
    if (profile.verified) score += 0.3;
    
    // AI verification
    try {
        const prompt = `Rate the authenticity of this profile from 0-100:\n\n${JSON.stringify(profile, null, 2)}\n\nConsider factors like completeness, activity, verification. Respond with JSON: { "score": number, "reason": string }`;
        const aiResponse = await queryGemini(prompt);
        
        if (aiResponse) {
            try {
                const { score: aiScore } = JSON.parse(aiResponse);
                if (aiScore) {
                    // Combine scores with AI having more weight
                    score = (score * 0.3) + (aiScore / 100 * 0.7);
                }
            } catch (e) {
                // If JSON parsing fails, ignore AI score
            }
        }
    } catch (e) {
        console.error('AI verification failed:', e);
    }
    
    return {
        score: Math.min(1, Math.max(0, score)), // Ensure between 0-1
        status: score > 0.7 ? 'Likely authentic' : 
                score > 0.4 ? 'Possibly authentic' : 
                'Possibly fake'
    };
};

// Filter results with AI
const filterResults = async (results, query) => {
    if (results.length === 0) return results;
    
    try {
        const prompt = `Filter these search results for query "${query}", keeping only the most relevant and trustworthy:\n\n${JSON.stringify(results, null, 2)}\n\nReturn array indices of relevant results.`;
        const aiResponse = await queryGemini(prompt);
        
        if (aiResponse) {
            try {
                // Try to parse as JSON array
                const indices = JSON.parse(aiResponse);
                if (Array.isArray(indices)) {
                    return indices.map(i => results[i]).filter(Boolean);
                }
                
                // Try to extract numbers from text
                const numberMatches = aiResponse.match(/\d+/g);
                if (numberMatches) {
                    return numberMatches.map(Number)
                        .filter(i => i >= 0 && i < results.length)
                        .map(i => results[i]);
                }
            } catch (e) {
                // If parsing fails, return original results
            }
        }
    } catch (e) {
        console.error('AI filtering failed:', e);
    }
    
    return results;
};

module.exports = {
    analyzeResults,
    analyzeProfiles,
    analyzeProfile,
    verifyProfile,
    filterResults,
    queryGemini
};
