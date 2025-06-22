import express from 'express';
import multer from 'multer';
import { AutoModel, AutoProcessor, RawImage, Tensor, dot, softmax } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } }); // Batas 10MB

// Middleware untuk parsing JSON dan CORS
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Sajikan index.html untuk rute root dengan pengecekan
app.get(['/', '/index.html'], (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('Error: index.html tidak ditemukan di', indexPath);
    return res.status(404).send('Error: index.html tidak ditemukan. Pastikan file ada di direktori proyek.');
  }
  res.sendFile(indexPath);
});

// Buat direktori uploads jika belum ada
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Direktori uploads dibuat di', uploadsDir);
}

// Variabel global untuk status dan data
let isReady = false;
let vision_model, location_model, processor, gps_data;

// Fungsi inisialisasi
async function initialize() {
  try {
    console.log('Memulai inisialisasi model dan data...');
    const model_id = 'Xenova/geoclip-large-patch14';
    const cacheDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'cache');

    // Muat model secara paralel
    const [vision, location, proc] = await Promise.all([
      AutoModel.from_pretrained(model_id, { model_file_name: 'vision_model', cache_dir }),
      AutoModel.from_pretrained(model_id, { model_file_name: 'location_model', quantized: false, cache_dir }),
      AutoProcessor.from_pretrained(model_id, { cache_dir }),
    ]);
    vision_model = vision;
    location_model = location;
    processor = proc;

    // Muat koordinat GPS
    const gpsDataPath = path.join(__dirname, 'coordinates_100K.json');
    if (!fs.existsSync(gpsDataPath)) {
      throw new Error('coordinates_100K.json tidak ditemukan di ' + gpsDataPath);
    }
    gps_data = JSON.parse(fs.readFileSync(gpsDataPath)).slice(0, 10000); // 10K untuk performa
    console.log(`Berhasil memuat ${gps_data.length} koordinat GPS.`);

    isReady = true;
    console.log('Inisialisasi selesai. Server siap.');
  } catch (error) {
    console.error('Gagal inisialisasi:', error.message);
    isReady = false;
    throw error;
  }
}

// Mulai server setelah inisialisasi selesai
async function startServer() {
  try {
    await initialize();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server berjalan di http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Gagal memulai server:', error.message);
    process.exit(1); // Hentikan jika gagal
  }
}
startServer();

// Endpoint untuk prediksi lokasi
app.post('/predict', upload.single('photo'), async (req, res) => {
  if (!isReady) {
    return res.status(503).json({ error: 'Server belum siap. Tunggu inisialisasi selesai.' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
    }

    const imagePath = path.join(__dirname, req.file.path);
    if (!fs.existsSync(imagePath)) {
      return res.status(500).json({ error: 'File gambar tidak ditemukan di server' });
    }

    const image = await RawImage.read(imagePath);
    if (!image || !image.data) {
      return res.status(400).json({ error: 'Gambar tidak dapat dibaca atau korup' });
    }

    const vision_inputs = await processor(image, { return_tensors: 'pt' });
    const { image_embeds } = await vision_model(vision_inputs);
    if (!image_embeds || !image_embeds.data) {
      return res.status(500).json({ error: 'Gagal menghasilkan embedding gambar' });
    }
    const norm_image_embeds = image_embeds.normalize().data;

    const coordinate_batch_size = 1000;
    const exp_logit_scale = Math.exp(4.5);
    const scores = [];

    for (let i = 0; i < gps_data.length; i += coordinate_batch_size) {
      const chunk = gps_data.slice(i, i + coordinate_batch_size);
      const { location_embeds } = await location_model({
        location: new Tensor('float32', chunk.flat(), [chunk.length, 2]),
      });
      if (!location_embeds || !location_embeds.data) {
        continue; // Lewati batch jika gagal
      }
      const norm_location_embeds = location_embeds.normalize().tolist();

      for (const embed of norm_location_embeds) {
        const score = exp_logit_scale * dot(norm_image_embeds, embed);
        scores.push(score);
      }
    }

    if (scores.length === 0) {
      return res.status(500).json({ error: 'Gagal menghitung skor prediksi' });
    }

    const top_k = 10;
    const results = softmax(scores)
      .map((x, i) => [x, i])
      .sort((a, b) => b[0] - a[0])
      .slice(0, top_k)
      .map(([score, index]) => ({ index, gps: gps_data[index], score }));

    let weighted_lat = 0, weighted_lng = 0, total_weight = 0;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const weight = result.score * Math.exp(-i * 0.3);
      weighted_lat += result.gps[0] * weight;
      weighted_lng += result.gps[1] * weight;
      total_weight += weight;
    }

    if (total_weight === 0) {
      return res.status(500).json({ error: 'Gagal menghitung koordinat akhir' });
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

    try {
      fs.unlinkSync(imagePath);
    } catch (unlinkError) {
      console.warn('Peringatan: Gagal menghapus file sementara:', unlinkError.message);
    }

    res.json(final_result);
  } catch (error) {
    console.error('Error prediksi:', error.message);
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(path.join(__dirname, req.file.path));
      } catch (unlinkError) {
        console.warn('Peringatan: Gagal menghapus file sementara:', unlinkError.message);
      }
    }
    res.status(500).json({ error: 'Gagal memproses gambar: ' + error.message });
  }
});

// Tangani rute yang tidak ditemukan
app.use((req, res) => {
  res.status(404).json({ error: 'Rute tidak ditemukan. Gunakan / untuk UI atau /predict untuk prediksi.' });
});
