const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const userAgent = require('user-agents');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBnAFtB1TcTzpkJ1CwxgjSurhhUSVOo9HI';
const PORT = process.env.PORT || 3000;

// Enhanced user-agent rotation
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
];

// Advanced headers with better randomization
function getRandomHeaders() {
    const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
    const acceptLanguages = ['en-US,en;q=0.9', 'en-GB,en;q=0.8', 'en-US,en;q=0.5'];
    const referers = [
        'https://www.google.com/',
        'https://duckduckgo.com/',
        'https://www.bing.com/',
        'https://search.yahoo.com/'
    ];
    
    return {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)],
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': referers[Math.floor(Math.random() * referers.length)],
        'Cache-Control': Math.random() > 0.5 ? 'no-cache' : 'max-age=0',
        'Pragma': 'no-cache',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
    };
}

// Optimized and faster scraping function
async function scrapeSearchEngine(query, engine, maxRetries = 2) {
    const results = [];
    const seenUrls = new Set();
    
    let searchUrl;
    if (engine === 'bing') {
        searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=50`;
    } else if (engine === 'duckduckgo') {
        searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    } else if (engine === 'yahoo') {
        searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&n=50`;
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`[${engine.toUpperCase()}] Attempt ${attempt + 1}: ${searchUrl}`);
            
            const response = await axios.get(searchUrl, {
                headers: getRandomHeaders(),
                timeout: 8000,
                maxRedirects: 2,
                validateStatus: (status) => status < 500
            });

            if (response.status !== 200) {
                console.log(`[${engine.toUpperCase()}] Status ${response.status}, retrying...`);
                continue;
            }

            const $ = cheerio.load(response.data);
            let foundResults = 0;

            if (engine === 'bing') {
                $('.b_algo, .b_ans').each((i, element) => {
                    const $el = $(element);
                    const title = $el.find('h2 a, h3 a, .b_title a').first().text().trim();
                    const link = $el.find('h2 a, h3 a, .b_title a').first().attr('href');
                    const snippet = $el.find('.b_caption p, .b_snippet').first().text().trim();
                    
                    if (title && link && !seenUrls.has(link) && !link.includes('microsoft.com/en-us/bing')) {
                        seenUrls.add(link);
                        results.push({ title, link, snippet: snippet || 'No description available' });
                        foundResults++;
                    }
                });
            } else if (engine === 'duckduckgo') {
                $('.result, .results_links').each((i, element) => {
                    const $el = $(element);
                    const title = $el.find('.result__title a, .result__a').text().trim();
                    const link = $el.find('.result__title a, .result__a').attr('href');
                    const snippet = $el.find('.result__snippet, .result__body').text().trim();
                    
                    if (title && link && !seenUrls.has(link)) {
                        seenUrls.add(link);
                        results.push({ title, link, snippet: snippet || 'No description available' });
                        foundResults++;
                    }
                });
            } else if (engine === 'yahoo') {
                $('.dd.algo, .algo').each((i, element) => {
                    const $el = $(element);
                    const title = $el.find('h3 a').text().trim();
                    const link = $el.find('h3 a').attr('href');
                    const snippet = $el.find('.compText').text().trim();
                    
                    if (title && link && !seenUrls.has(link)) {
                        seenUrls.add(link);
                        results.push({ title, link, snippet: snippet || 'No description available' });
                        foundResults++;
                    }
                });
            }

            console.log(`[${engine.toUpperCase()}] Found ${foundResults} results`);
            
            if (foundResults > 0) {
                break; // Success, exit retry loop
            }
            
        } catch (error) {
            console.error(`[${engine.toUpperCase()}] Error on attempt ${attempt + 1}:`, error.message);
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
    }

    return results.slice(0, 25); // Limit results per engine
}

// Optimized parallel scraping
async function performParallelSearch(query) {
    console.log(`\n🔍 Starting search for: "${query}"`);
    const startTime = Date.now();
    
    const searchPromises = [
        scrapeSearchEngine(query, 'bing').catch(err => {
            console.error('Bing search failed:', err.message);
            return [];
        }),
        scrapeSearchEngine(query, 'duckduckgo').catch(err => {
            console.error('DuckDuckGo search failed:', err.message);
            return [];
        }),
        scrapeSearchEngine(query, 'yahoo').catch(err => {
            console.error('Yahoo search failed:', err.message);
            return [];
        })
    ];

    const [bingResults, duckduckgoResults, yahooResults] = await Promise.allSettled(searchPromises);
    
    const results = {
        bing: bingResults.status === 'fulfilled' ? bingResults.value : [],
        duckduckgo: duckduckgoResults.status === 'fulfilled' ? duckduckgoResults.value : [],
        yahoo: yahooResults.status === 'fulfilled' ? yahooResults.value : []
    };

    const totalResults = results.bing.length + results.duckduckgo.length + results.yahoo.length;
    const searchTime = Date.now() - startTime;
    
    console.log(`✅ Search completed in ${searchTime}ms`);
    console.log(`📊 Results: Bing(${results.bing.length}) + DuckDuckGo(${results.duckduckgo.length}) + Yahoo(${results.yahoo.length}) = ${totalResults} total`);
    
    return results;
}

// Improved Gemini API processing
async function processWithGemini(query, scrapedData) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
        throw new Error('Gemini API key is not configured');
    }

    const totalResults = Object.values(scrapedData).reduce((sum, arr) => sum + arr.length, 0);
    if (totalResults === 0) {
        return `# Search Results for: "${query}"\n\n❌ **No results found** from any search engine.\n\nThis could be due to:\n- Network connectivity issues\n- Search engine blocking requests\n- Very specific or uncommon search terms\n\nTry:\n- Using different keywords\n- Checking your internet connection\n- Trying again in a few minutes`;
    }

    // Truncate data if too large
    const maxResultsPerEngine = 15;
    const truncatedData = {};
    Object.keys(scrapedData).forEach(engine => {
        truncatedData[engine] = scrapedData[engine].slice(0, maxResultsPerEngine);
    });

    const scrapedDataJson = JSON.stringify(truncatedData, null, 2);
    const prompt = `You are an advanced OSINT (Open Source Intelligence) assistant. Analyze the following search results and provide a comprehensive, well-structured response.

SEARCH QUERY: "${query}"

SEARCH RESULTS:
${scrapedDataJson}

Please provide a detailed analysis with:

## 🎯 Key Findings
- Extract the most relevant and important information
- Highlight credible sources and authoritative domains
- Identify patterns or trends in the data

## 📊 Source Analysis  
- Evaluate source credibility and reliability
- Note any official websites, news outlets, or academic sources
- Flag any potentially unreliable or biased sources

## 🔍 Detailed Insights
- Provide actionable information based on the results
- Explain context and background where relevant
- Connect related information from different sources

## 📝 Summary & Next Steps
- Concise summary of findings
- Suggested follow-up searches or investigation paths
- Recommendations for further verification

Format your response using clear markdown with headers, bullet points, and emphasis. Be factual, objective, and avoid speculation. If information seems incomplete or requires verification, mention this clearly.`;

    try {
        console.log('🤖 Processing with Gemini AI...');
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 4096,
                    candidateCount: 1
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const aiResponse = response.data.candidates[0].content.parts[0].text;
            console.log('✅ AI processing completed');
            return aiResponse;
        } else {
            console.error('Invalid Gemini API response structure:', JSON.stringify(response.data, null, 2));
            throw new Error('Invalid response format from Gemini API');
        }
    } catch (error) {
        console.error('❌ Gemini API Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
        
        // Fallback response without AI processing
        const fallbackResponse = generateFallbackResponse(query, scrapedData);
        return fallbackResponse;
    }
}

// Fallback response generator
function generateFallbackResponse(query, scrapedData) {
    const totalResults = Object.values(scrapedData).reduce((sum, arr) => sum + arr.length, 0);
    
    let response = `# Search Results for: "${query}"\n\n`;
    response += `📊 **Found ${totalResults} results** from multiple search engines\n\n`;
    
    Object.entries(scrapedData).forEach(([engine, results]) => {
        if (results.length > 0) {
            response += `## ${engine.charAt(0).toUpperCase() + engine.slice(1)} Results (${results.length})\n\n`;
            results.slice(0, 10).forEach((result, index) => {
                response += `### ${index + 1}. ${result.title}\n`;
                response += `🔗 **Link:** ${result.link}\n`;
                if (result.snippet) {
                    response += `📝 **Description:** ${result.snippet}\n`;
                }
                response += `\n`;
            });
        }
    });
    
    response += `\n---\n\n⚠️ **Note:** AI analysis temporarily unavailable. Raw search results provided above.\n`;
    response += `🔄 **Suggestion:** Try refreshing or contact support if AI processing continues to fail.\n`;
    
    return response;
}

// Main search endpoint
app.post('/api/search', async (req, res) => {
    const startTime = Date.now();
    const { query } = req.body || {};
    
    // Enhanced input validation
    if (!query || typeof query !== 'string') {
        return res.status(400).json({ 
            success: false,
            message: 'Query is required and must be a string',
            timestamp: new Date().toISOString()
        });
    }
    
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) {
        return res.status(400).json({ 
            success: false,
            message: 'Query must be at least 2 characters long',
            timestamp: new Date().toISOString()
        });
    }
    
    if (cleanQuery.length > 500) {
        return res.status(400).json({ 
            success: false,
            message: 'Query is too long (max 500 characters)',
            timestamp: new Date().toISOString()
        });
    }

    console.log(`\n🚀 New search request: "${cleanQuery}"`);
    
    try {
        // Perform parallel search
        const scrapedData = await performParallelSearch(cleanQuery);
        
        // Process with AI
        const aiResponse = await processWithGemini(cleanQuery, scrapedData);
        
        const totalTime = Date.now() - startTime;
        console.log(`🎉 Request completed in ${totalTime}ms\n`);
        
        res.json({ 
            success: true,
            response: aiResponse,
            metadata: {
                query: cleanQuery,
                processingTime: totalTime,
                resultsCount: {
                    bing: scrapedData.bing.length,
                    duckduckgo: scrapedData.duckduckgo.length,
                    yahoo: scrapedData.yahoo.length,
                    total: Object.values(scrapedData).reduce((sum, arr) => sum + arr.length, 0)
                },
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`❌ Search failed after ${totalTime}ms:`, error.message);
        
        res.status(500).json({ 
            success: false,
            message: 'Search operation failed: ' + error.message,
            metadata: {
                query: cleanQuery,
                processingTime: totalTime,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Serve static files and main page
app.get('/', (req, res) => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Advanced OSINT Search Tool</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            color: white;
        }
        
        .header h1 {
            font-size: 3rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .search-container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        
        .search-box {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
        }
        
        #searchInput {
            flex: 1;
            padding: 15px 20px;
            border: 2px solid #e1e5e9;
            border-radius: 50px;
            font-size: 16px;
            outline: none;
            transition: all 0.3s ease;
        }
        
        #searchInput:focus {
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        #searchBtn {
            padding: 15px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 50px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            min-width: 120px;
        }
        
        #searchBtn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        
        #searchBtn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }
        
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
            color: #667eea;
        }
        
        .loading i {
            font-size: 2rem;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        .results-container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            display: none;
        }
        
        .results-header {
            display: flex;
            justify-content: between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }
        
        .results-stats {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 10px 20px;
            border-radius: 50px;
            font-size: 14px;
            font-weight: 600;
        }
        
        .results-content {
            line-height: 1.8;
            color: #444;
        }
        
        .results-content h1, .results-content h2, .results-content h3 {
            color: #333;
            margin: 20px 0 10px 0;
        }
        
        .results-content h1 {
            color: #667eea;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }
        
        .results-content h2 {
            color: #764ba2;
        }
        
        .results-content a {
            color: #667eea;
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: all 0.3s ease;
        }
        
        .results-content a:hover {
            border-bottom-color: #667eea;
        }
        
        .results-content ul, .results-content ol {
            margin: 15px 0;
            padding-left: 30px;
        }
        
        .results-content li {
            margin: 8px 0;
        }
        
        .results-content blockquote {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 0 10px 10px 0;
        }
        
        .results-content code {
            background: #f1f3f4;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
        }
        
        .results-content pre {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            overflow-x: auto;
            margin: 20px 0;
        }
        
        .error-message {
            background: #fee;
            color: #c33;
            padding: 20px;
            border-radius: 10px;
            border: 1px solid #fcc;
            margin: 20px 0;
        }
        
        .footer {
            text-align: center;
            margin-top: 40px;
            color: white;
            opacity: 0.8;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .search-container, .results-container {
                padding: 20px;
            }
            
            .search-box {
                flex-direction: column;
            }
            
            #searchBtn {
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-search"></i> OSINT Search</h1>
            <p>Advanced Open Source Intelligence Research Tool</p>
        </div>
        
        <div class="search-container">
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="Enter your search query..." maxlength="500">
                <button id="searchBtn" onclick="performSearch()">
                    <i class="fas fa-search"></i> Search
                </button>
            </div>
            
            <div class="loading" id="loading">
                <i class="fas fa-spinner"></i>
                <p>Searching across multiple engines...</p>
            </div>
        </div>
        
        <div class="results-container" id="resultsContainer">
            <div class="results-header">
                <h2><i class="fas fa-chart-bar"></i> Search Results</h2>
                <div class="results-stats" id="resultsStats"></div>
            </div>
            <div class="results-content" id="resultsContent"></div>
        </div>
        
        <div class="footer">
            <p>&copy; 2024 OSINT Search Tool - Advanced Intelligence Gathering</p>
        </div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js"></script>
    <script>
        let isSearching = false;
        
        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !isSearching) {
                performSearch();
            }
        });
        
        async function performSearch() {
            if (isSearching) return;
            
            const query = document.getElementById('searchInput').value.trim();
            if (!query) {
                alert('Please enter a search query');
                return;
            }
            
            if (query.length < 2) {
                alert('Search query must be at least 2 characters long');
                return;
            }
            
            isSearching = true;
            
            // Update UI
            const searchBtn = document.getElementById('searchBtn');
            const loading = document.getElementById('loading');
            const resultsContainer = document.getElementById('resultsContainer');
            
            searchBtn.disabled = true;
            searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
            loading.style.display = 'block';
            resultsContainer.style.display = 'none';
            
            try {
                console.log('Starting search for:', query);
                const startTime = Date.now();
                
                const response = await fetch('/api/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ query: query })
                });
                
                const data = await response.json();
                const endTime = Date.now();
                
                console.log('Search completed in:', endTime - startTime, 'ms');
                console.log('Response:', data);
                
                if (!response.ok) {
                    throw new Error(data.message || 'Search failed');
                }
                
                if (data.success && data.response) {
                    displayResults(data.response, data.metadata);
                } else {
                    throw new Error('No results received');
                }
                
            } catch (error) {
                console.error('Search error:', error);
                displayError(error.message);
            } finally {
                isSearching = false;
                searchBtn.disabled = false;
                searchBtn.innerHTML = '<i class="fas fa-search"></i> Search';
                loading.style.display = 'none';
            }
        }
        
        function displayResults(response, metadata) {
            const resultsContainer = document.getElementById('resultsContainer');
            const resultsContent = document.getElementById('resultsContent');
            const resultsStats = document.getElementById('resultsStats');
            
            // Update stats
            if (metadata && metadata.resultsCount) {
                const total = metadata.resultsCount.total;
                const time = metadata.processingTime;
                resultsStats.textContent = total + ' results found in ' + time + 'ms';
            }
            
            // Convert markdown to HTML
            const htmlContent = marked.parse(response);
            resultsContent.innerHTML = htmlContent;
            
            // Show results
            resultsContainer.style.display = 'block';
            resultsContainer.scrollIntoView({ behavior: 'smooth' });
        }
        
        // Auto-focus search input on page load
        window.addEventListener('load', function() {
            document.getElementById('searchInput').focus();
        });
        
        // Add some example queries for better UX
        const exampleQueries = [
            'cybersecurity threats 2024',
            'artificial intelligence trends',
            'blockchain technology news',
            'data privacy regulations',
            'social media analysis tools'
        ];
        
        // Add placeholder rotation
        let placeholderIndex = 0;
        setInterval(() => {
            const input = document.getElementById('searchInput');
            if (!input.value && document.activeElement !== input) {
                input.placeholder = 'Try: ' + exampleQueries[placeholderIndex] + '...';
                placeholderIndex = (placeholderIndex + 1) % exampleQueries.length;
            }
        }, 3000);
    </script>
</body>
</html>`;
    
    res.send(htmlContent);
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        availableEndpoints: [
            'GET / - Main application',
            'POST /api/search - Search functionality',
            'GET /api/health - Health check'
        ],
        timestamp: new Date().toISOString()
    });
});

// Start server with enhanced logging
const server = app.listen(PORT, () => {
    console.log('🚀 ================================');
    console.log('🚀 OSINT Search Server Started');
    console.log('🚀 ================================');
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`⏰ Started at: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}`);
    console.log(`🔑 Gemini API: ${GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY' ? '✅ Configured' : '❌ Not Configured'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('🚀 ================================');
});

// Enhanced graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    process.exit(1);
});'smooth' });
        }
        
        function displayError(message) {
            const resultsContainer = document.getElementById('resultsContainer');
            const resultsContent = document.getElementById('resultsContent');
            const resultsStats = document.getElementById('resultsStats');
            
            resultsStats.textContent = 'Error occurred';
            resultsContent.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-triangle"></i> <strong>Search Error:</strong> ' + message + '</div>';
            
            resultsContainer.style.display = 'block';
            resultsContainer.scrollIntoView({ behavior:

