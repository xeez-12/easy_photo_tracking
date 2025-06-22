
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

// Serve static files from root folder
app.use(express.static(__dirname));

// Load GeoClip models when server starts
let vision_model, location_model, processor;
async function loadModels() {
    const model_id = 'Xenova/geoclip-large-patch14';
    console.log('Loading vision model...');
    vision_model = await AutoModel.from_pretrained(model_id, { model_file_name: 'vision_model' });
    console.log('Vision model loaded.');
    console.log('Loading location model...');
    location_model = await AutoModel.from_pretrained(model_id, { model_file_name: 'location_model', quantized: false });
    console.log('Location model loaded.');
    console.log('Loading processor...');
    processor = await AutoProcessor.from_pretrained(model_id);
    console.log('Processor loaded.');
}
loadModels();

// Load GPS coordinates with high accuracy data
let gps_data;
async function loadGPSData() {
    const coordinate_data = 'https://huggingface.co/Xenova/geoclip-large-patch14/resolve/main/gps_gallery/coordinates_100K.json';
    console.log('Fetching GPS coordinates...');
    const response = await fetch(coordinate_data);
    if (!response.ok) throw new Error('Failed to fetch GPS coordinates');
    gps_data = (await response.json()).slice(0, 50000); // Increase to 50k for highest accuracy
    console.log(`Loaded ${gps_data.length} GPS coordinates.`);
}
loadGPSData();

// API to process photo and predict location with high accuracy
app.post('/predict', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const imagePath = path.join(__dirname, req.file.path);
        const image = await RawImage.read(imagePath);

        // Process image with correct processor
        const vision_inputs = await processor(image);

        // Calculate image embedding with high precision
        const { image_embeds } = await vision_model(vision_inputs);
        const norm_image_embeds = image_embeds.normalize().data;

        // Use optimal batch size and temperature scaling for accuracy
        const coordinate_batch_size = 1000; // Increased batch size
        const exp_logit_scale = Math.exp(4.5); // Higher temperature for better discrimination
        const scores = [];

        for (let i = 0; i < gps_data.length; i += coordinate_batch_size) {
            const chunk = gps_data.slice(i, i + coordinate_batch_size);
            const { location_embeds } = await location_model({
                location: new Tensor('float32', chunk.flat(), [chunk.length, 2])
            });
            const norm_location_embeds = location_embeds.normalize().tolist();

            // Calculate similarity scores with higher precision and temperature scaling
            for (const embed of norm_location_embeds) {
                const score = exp_logit_scale * dot(norm_image_embeds, embed);
                scores.push(score);
            }
        }

        // Get top 15 predictions for better ensemble
        const top_k = 10;
        const results = softmax(scores)
            .map((x, i) => [x, i])
            .sort((a, b) => b[0] - a[0])
            .slice(0, top_k)
            .map(([score, index]) => ({ index, gps: gps_data[index], score }));

        // Advanced weighted average with confidence-based weighting
        let weighted_lat = 0;
        let weighted_lng = 0;
        let total_weight = 0;

        // Use exponential weighting to favor top predictions more heavily
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const weight = result.score * Math.exp(-i * 0.3); // Reduced decay for better averaging
            weighted_lat += result.gps[0] * weight;
            weighted_lng += result.gps[1] * weight;
            total_weight += weight;
        }

        const final_result = {
            latitude: weighted_lat / total_weight,
            longitude: weighted_lng / total_weight,
            score: results[0].score, // Confidence score from best prediction
            top_predictions: results.slice(0, 8).map(r => ({ // Return top 8 for display
                lat: r.gps[0],
                lng: r.gps[1],
                confidence: r.score
            }))
        };

        // Delete file after processing
        try {
            fs.unlinkSync(imagePath);
        } catch (unlinkError) {
            console.warn('Warning: Could not delete temporary file:', unlinkError.message);
        }

        res.json(final_result);
    } catch (error) {
        console.error('Error:', error);
        // Delete file if error occurs
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(path.join(__dirname, req.file.path));
            } catch (unlinkError) {
                console.warn('Warning: Could not delete temporary file after error:', unlinkError.message);
            }
        }
        res.status(500).json({ error: 'Failed to process image' });
    }
});

// Run server with Replit port
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));
