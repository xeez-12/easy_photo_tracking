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

// CORS untuk mengizinkan akses dari UI
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Buat direktori uploads jika belum ada
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Load model GeoClip saat server mulai
let vision_model, location_model, processor;
async function loadModels() {
  const model_id = 'Xenova/geoclip-large-patch14';
  console.log('Memuat vision model...');
  vision_model = await AutoModel.from_pretrained(model_id, { model_file_name: 'vision_model' });
  console.log('Vision model dimuat.');
  console.log('Memuat location model...');
  location_model = await AutoModel.from_pretrained(model_id, { model_file_name: 'location_model', quantized: false });
  console.log('Location model dimuat.');
  console.log('Memuat processor...');
  processor = await AutoProcessor.from_pretrained(model_id);
  console.log('Processor dimuat.');
}
loadModels();

// Load koordinat GPS dari file lokal
let gps_data;
async function loadGPSData() {
  const gpsDataPath = path.join(__dirname, 'coordinates_100K.json');
  console.log('Memuat koordinat GPS...');
  try {
    gps_data = JSON.parse(fs.readFileSync(gpsDataPath)).slice(0, 10000); // Gunakan 10K untuk performa
    console.log(`Berhasil memuat ${gps_data.length} koordinat GPS.`);
  } catch (error) {
    console.error('Gagal memuat koordinat GPS:', error);
    throw new Error('Gagal memuat koordinat GPS');
  }
}
loadGPSData();

// Endpoint untuk memprediksi lokasi dari gambar
app.post('/predict', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
    }

    const imagePath = path.join(__dirname, req.file.path);
    const image = await RawImage.read(imagePath);

    // Proses gambar
    const vision_inputs = await processor(image);
    const { image_embeds } = await vision_model(vision_inputs);
    const norm_image_embeds = image_embeds.normalize().data;

    // Batch processing koordinat
    const coordinate_batch_size = 1000;
    const exp_logit_scale = Math.exp(4.5);
    const scores = [];

    for (let i = 0; i < gps_data.length; i += coordinate_batch_size) {
      const chunk = gps_data.slice(i, i + coordinate_batch_size);
      const { location_embeds } = await location_model({
        location: new Tensor('float32', chunk.flat(), [chunk.length, 2]),
      });
      const norm_location_embeds = location_embeds.normalize().tolist();

      for (const embed of norm_location_embeds) {
        const score = exp_logit_scale * dot(norm_image_embeds, embed);
        scores.push(score);
      }
    }

    // Ambil top 10 prediksi
    const top_k = 10;
    const results = softmax(scores)
      .map((x, i) => [x, i])
      .sort((a, b) => b[0] - a[0])
      .slice(0, top_k)
      .map(([score, index]) => ({ index, gps: gps_data[index], score }));

    // Hitung rata-rata tertimbang
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
        confidence: r.score,
      })),
    };

    // Hapus file sementara
    try {
      fs.unlinkSync(imagePath);
    } catch (unlinkError) {
      console.warn('Peringatan: Gagal menghapus file sementara:', unlinkError.message);
    }

    res.json(final_result);
  } catch (error) {
    console.error('Error:', error);
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(path.join(__dirname, req.file.path));
      } catch (unlinkError) {
        console.warn('Peringatan: Gagal menghapus file sementara setelah error:', unlinkError.message);
      }
    }
    res.status(500).json({ error: 'Gagal memproses gambar' });
  }
});

// Jalankan server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server berjalan di http://0.0.0.0:${PORT}`));
