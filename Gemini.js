const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

async function summarizeArticle(text) {
  const prompt = `
    langkah 1: analisis teks untuk mencari akun media sosial
    teks: ${text}

    langkah 2: identifikasi informasi akun media sosial
    - fokus pada username, bio, followers, like, dan post
    - ambil semua akun yang ditemukan hingga maksimum 5 akun
    - username harus mengandung bagian dari query pengguna
    - hindari informasi lain seperti orang, umur, lokasi, tanggal, atau peristiwa

    langkah 3: buat ringkasan dalam bahasa indonesia yang terstruktur
    - gunakan naratif yang mengalir dengan format:
      @username
      bio: [deskripsi bio atau tidak tersedia]
      followers: [jumlah followers atau tidak tersedia]
      like: [jumlah like atau tidak tersedia]
      post: [jumlah post atau tidak tersedia]
    - tampilkan semua akun yang ditemukan (maksimum 5)
    - jika informasi tidak tersedia, tulis "tidak tersedia"
    - gunakan huruf kecil kecuali untuk nama proper
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.5,
        maxOutputTokens: 5000
      }
    });

    return response.text || 'maaf, terjadi kesalahan saat merangkum artikel.';
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('maaf, terjadi kesalahan saat merangkum artikel.');
  }
}

async function generateEnhancedResponse(query, scrapedData) {
  const enhancedPrompt = `
    langkah 1: persiapan data untuk laporan osint mendalam dalam bahasa indonesia
    - data bing: judul: ${scrapedData.bing.title}, ringkasan: ${scrapedData.bing.snippet}, url: ${scrapedData.bing.url}, metadata: ${JSON.stringify(scrapedData.bing.metadata || {})}, gambar: ${JSON.stringify(scrapedData.bing.images || [])}, akun media sosial: ${JSON.stringify(scrapedData.bing.socialMediaAccounts || [])}
    - data duckduckgo: judul: ${scrapedData.duckduckgo.title}, ringkasan: ${scrapedData.duckduckgo.snippet}, url: ${scrapedData.duckduckgo.url}, metadata: ${JSON.stringify(scrapedData.duckduckgo.metadata || {})}, gambar: ${JSON.stringify(scrapedData.duckduckgo.images || [])}, akun media sosial: ${JSON.stringify(scrapedData.duckduckgo.socialMediaAccounts || [])}
    - pertanyaan: ${query}

    langkah 2: analisis akun media sosial
    - ambil semua akun media sosial yang ditemukan dari data scraping (maksimum 5 akun) yang username-nya mengandung "${query}"
    - untuk setiap akun, sajikan informasi dengan format naratif:
      @username
      bio: [deskripsi bio atau tidak tersedia]
      followers: [jumlah followers atau tidak tersedia]
      like: [jumlah like atau tidak tersedia]
      post: [jumlah post atau tidak tersedia]

    langkah 3: tambahan elemen laporan
    - untuk setiap gambar dari data bing atau duckduckgo, sertakan:
      - url: [url gambar]
      - ringkasan: [deskripsi singkat 1-2 kalimat]
      - sumber: [website atau akun media sosial dengan platform dan nama pengguna]
    - informasi sumber: sumber bing: [deskripsi singkat judul, maksimal 20 kata], sumber duckduckgo: [deskripsi singkat judul, maksimal 20 kata]
    - sumber: [daftar url sumber]
    - catatan: [catatan tambahan, misalnya potensi bias atau kebutuhan verifikasi]

    langkah 4: panduan tambahan
    - hindari frasa seperti "berdasarkan informasi real-time" atau "berdasarkan informasi terkini yang telah anda kumpulkan"
    - gunakan huruf kecil kecuali untuk nama proper
    - jika informasi tidak cukup, tulis "tidak tersedia"
    - pastikan laporan minimal 600 kata dan sepenuhnya sesuai dengan struktur naratif
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: enhancedPrompt,
      config: {
        temperature: 0.4,
        maxOutputTokens: 10000
      }
    });

    let result = response.text || 'maaf, terjadi kesalahan saat memproses permintaan anda.';

    const unwantedPhrases = [
      'berdasarkan informasi real-time',
      'berdasarkan informasi terkini yang telah anda kumpulkan',
      'berikut adalah ringkasan artikel untuk keperluan osint',
      'artikel ini berpusat pada upaya pencarian informasi'
    ];
    for (const phrase of unwantedPhrases) {
      if (result.toLowerCase().startsWith(phrase)) {
        result = result.slice(phrase.length).trim();
        break;
      }
    }

    return result;
  } catch (error) {
    console.error('Enhanced Gemini API error:', error);
    throw new Error('maaf, terjadi kesalahan saat memproses permintaan osint.');
  }
}

async function analyzeQuery(query) {
  const analysisPrompt = `
    langkah 1: analisis kueri berikut untuk keperluan osint
    kueri: "${query}"

    langkah 2: tentukan parameter
    - intent: informational, navigational, transactional
    - category: news, education, entertainment, business, technology, politics, security, social media, software development
    - needsRealTimeData: true jika kueri membutuhkan data terkini, false jika tidak
    - osintPriority: high, medium, low berdasarkan relevansi untuk analisis intelijen

    langkah 3: kembalikan hasil dalam format json valid
    {
      "intent": "informational",
      "category": "social media",
      "needsRealTimeData": true,
      "osintPriority": "high"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            intent: { type: 'string' },
            category: { type: 'string' },
            needsRealTimeData: { type: 'boolean' },
            osintPriority: { type: 'string' }
          },
          required: ['intent', 'category', 'needsRealTimeData', 'osintPriority']
        }
      },
      contents: analysisPrompt
    });

    const rawJson = response.text;
    if (rawJson) {
      const data = JSON.parse(rawJson);
      return data;
    } else {
      throw new Error('empty response from model');
    }
  } catch (error) {
    console.error('Query analysis error:', error);
    return {
      intent: 'informational',
      category: 'social media',
      needsRealTimeData: true,
      osintPriority: 'medium'
    };
  }
}

module.exports = { summarizeArticle, generateEnhancedResponse, analyzeQuery };
