import express from 'express';
import multer from 'multer';
import { AutoModel, AutoProcessor, RawImage, Tensor, dot, softmax } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

// Add CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Serve static files
app.use(express.static(__dirname));

// Global variables for models and data
let vision_model, location_model, processor, gps_data;

// Load GeoClip models once at startup
async function loadModels() {
    try {
        const model_id = 'Xenova/geoclip-large-patch14';
        console.log('Loading vision model...');
        vision_model = await AutoModel.from_pretrained(model_id, { model_file_name: 'vision_model', quantized: true });
        console.log('Vision model loaded.');
        console.log('Loading location model...');
        location_model = await AutoModel.from_pretrained(model_id, { model_file_name: 'location_model', quantized: true });
        console.log('Location model loaded.');
        console.log('Loading processor...');
        processor = await AutoProcessor.from_pretrained(model_id);
        console.log('Processor loaded.');
    } catch (error) {
        console.error('Failed to load models:', error);
        process.exit(1); // Exit if models fail to load
    }
}

// Load pre-downloaded GPS coordinates
async function loadGPSData() {
    try {
        console.log('Loading GPS coordinates from local file...');
        const gpsDataPath = path.join(__dirname, 'coordinates_100K.json'); // Local JSON file
        gps_data = JSON.parse(fs.readFileSync(gpsDataPath, 'utf8')).slice(0, 50000); // Limit to 50k
        console.log(`Loaded ${gps_data.length} GPS coordinates.`);
    } catch (error) {
        console.error('Failed to load GPS data:', error);
        process.exit(1); // Exit if data fails to load
    }
}

// Initialize models and data
async function initialize() {
    await loadModels();
    await loadGPSData();
}
initialize().catch(error => {
    console.error('Initialization failed:', error);
    process.exit(1);
});

// API to process photo and predict location
app.post('/predict', upload.single('photo'), async (req, res) => {
    let imagePath;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        imagePath = path.join(__dirname, req.file.path);
        const image = await RawImage.read(imagePath);

        // Process image
        const vision_inputs = await processor(image);

        // Calculate image embedding
        const { image_embeds } = await vision_model(vision_inputs);
        const norm_image_embeds = image_embeds.normalize().data;

        // Process coordinates in smaller batches to reduce memory usage
        const coordinate_batch_size = 500; // Reduced batch size for Railway
        const exp_logit_scale = Math.exp(4.0); // Slightly lower temperature for stability
        const scores = [];

        for (let i = 0; i < gps_data.length; i += coordinate_batch_size) {
            const chunk = gps_data.slice(i, i + coordinate_batch_size);
            const { location_embeds } = await location_model({
                location: new Tensor('float32', chunk.flat(), [chunk.length, 2])
            });
            const norm_location_embeds = location_embeds.normalize().tolist();

            for (const embed of norm_location_embeds) {
                const score = exp_logit_scale * dot(norm_image_embeds, embed);
                scores.push(score);
            }
        }

        // Get top 10 predictions
        const top_k = 10;
        const results = softmax(scores)
            .map((x, i) => [x, i])
            .sort((a, b) => b[0] - a[0])
            .slice(0, top_k)
            .map(([score, index]) => ({ index, gps: gps_data[index], score }));

        // Weighted average for final coordinates
        let weighted_lat = 0, weighted_lng = 0, total_weight = 0;
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const weight = result.score * Math.exp(-i * 0.3);
            weighted_lat += result.gps[0] * weight;
            weighted_lng += result.gps[1] * weight;
            total_weight += weight;
        }

        const final_result = {
            latitude: weighted_lat / total_weight,
            longitude: weighted_lng / total_weight,
            score: results[0].score,
            top_predictions: results.slice(0, 8).map(r => ({
                lat: r.gps[0],
                lng: r.gps[1],
                confidence: r.score
            }))
        };

        // Clean up uploaded file
        fs.unlinkSync(imagePath);
        res.json(final_result);
    } catch (error) {
        console.error('Error processing image:', error);
        if (imagePath && fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath); // Clean up on error
        }
        res.status(500).json({ error: 'Failed to process image' });
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});

// Start server
const PORT = process.env.PORT || 8080; // Railway typically uses 8080
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
